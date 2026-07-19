import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { parseEther, type Abi, type Hash } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { AlertTriangle, Check, ExternalLink, Loader2, Wallet, Wifi } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { BASE_SET_PROFILE_ALT, BASE_SET_PROFILE_IMAGE } from "@/lib/marketArtwork";
import { claimReceiptSubmission } from "@/lib/receiptSubmission";
import { isWalletConnectConfigured } from "@/lib/wagmi";
import { WALLET_CONNECTION_VERIFICATION } from "@shared/walletConnectionStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FundingSummary = {
  targetEth: string;
  confirmedEth: string;
  pendingEth: string;
  progressPercent: number;
  contributorCount: number;
  confirmedCount: number;
};

type ContractDescriptor = {
  isConfigured: boolean;
  chainId: number;
  liquidityPoolAddress: string | null;
  abi: unknown[];
};

type FundingWidgetProps = {
  funding: FundingSummary;
  contract: ContractDescriptor;
  onContributionRecorded: (confirmation: {
    transactionHash: Hash;
    funding: FundingSummary;
    contributionStatus: "confirmed" | "pending" | "failed";
  }) => void | Promise<void>;
};

const trimAddress = (address?: string) => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "");

export function FundingWidget({ funding, contract, onContributionRecorded }: FundingWidgetProps) {
  const [amount, setAmount] = useState("0.05");
  const [transaction, setTransaction] = useState<{ hash: Hash; amount: string; amountWei: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const submittedReceiptHashes = useRef(new Set<Hash>());
  const { address, chain, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const submitContribution = trpc.market.recordTestnetContribution.useMutation({
    onSuccess: async (result, variables) => {
      setTransaction(null);
      if (result.contributionStatus === "failed") {
        setStatusMessage({ tone: "error", text: "The receipt was recorded but did not pass destination or amount verification." });
        toast.error("The contribution did not pass testnet receipt verification.");
        return;
      }

      setStatusMessage({
        tone: "success",
        text: result.contributionStatus === "confirmed"
          ? "Testnet receipt verified. Funding total updated."
          : "Receipt recorded. The public funding total will update automatically as testnet confirmation completes.",
      });
      if (result.contributionStatus === "confirmed") toast.success("Testnet receipt verified.");
      const contributionStatus = result.contributionStatus === "confirmed" || result.contributionStatus === "failed"
        ? result.contributionStatus
        : "pending";
      await onContributionRecorded({
        transactionHash: variables.transactionHash as Hash,
        funding: result.funding,
        contributionStatus,
      });
    },
    onError: error => {
      setTransaction(null);
      setStatusMessage({ tone: "error", text: "The on-chain receipt is awaiting server reconciliation. It will be checked during the next managed update." });
      toast.error(error.message);
    },
  });
  const { isSuccess: receiptConfirmed, isError: receiptFailed } = useWaitForTransactionReceipt({
    hash: transaction?.hash,
    query: { enabled: Boolean(transaction?.hash) },
  });

  const isCorrectNetwork = chain?.id === ROBINHOOD_TESTNET_CHAIN_ID;
  const walletConnectConnector = useMemo(() => connectors.find(connector => connector.id === "walletConnect"), [connectors]);
  const injectedConnector = useMemo(() => connectors.find(connector => connector.id === "injected") ?? connectors[0], [connectors]);
  const contractReady = contract.isConfigured && Boolean(contract.liquidityPoolAddress) && contract.abi.length > 0;
  const contributionDisabled = !contractReady || !isConnected || isWriting || isSwitching || submitContribution.isPending || Boolean(transaction);

  useEffect(() => {
    if (!receiptConfirmed || !transaction || !address || !claimReceiptSubmission(submittedReceiptHashes.current, transaction.hash)) return;
    submitContribution.mutate({
      walletAddress: address,
      amountWei: transaction.amountWei,
      amountEth: transaction.amount,
      transactionHash: transaction.hash,
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    });
  }, [address, receiptConfirmed, submitContribution, transaction]);

  useEffect(() => {
    if (!receiptFailed) return;
    setTransaction(null);
    setStatusMessage({ tone: "error", text: "The testnet contribution transaction did not confirm, so no contribution was recorded." });
    toast.error("The testnet contribution transaction did not confirm.");
  }, [receiptFailed]);

  const connect = async (connector: (typeof connectors)[number] | undefined, label: string) => {
    if (!connector) {
      const message = `${label} is not available in this browser.`;
      setStatusMessage({ tone: "error", text: message });
      toast.error(message);
      return;
    }
    try {
      await connectAsync({ connector, chainId: ROBINHOOD_TESTNET_CHAIN_ID });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to connect ${label}.`;
      setStatusMessage({ tone: "error", text: message });
      toast.error(message);
    }
  };

  const contribute = async () => {
    if (!contractReady || !contract.liquidityPoolAddress || !address) return;
    setStatusMessage(null);
    let value: bigint;
    try {
      value = parseEther(amount);
      if (value.toString() === "0") throw new Error("Enter an amount above zero.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Enter a valid ETH amount.";
      setStatusMessage({ tone: "error", text: message });
      toast.error(message);
      return;
    }

    try {
      if (!isCorrectNetwork) {
        await switchChainAsync({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
      }
      const hash = await writeContractAsync({
        address: contract.liquidityPoolAddress as `0x${string}`,
        abi: contract.abi as Abi,
        functionName: "contribute",
        value,
      });
      setTransaction({ hash, amount, amountWei: value.toString() });
      toast.message("Transaction sent. Waiting for the testnet receipt.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The wallet transaction was not completed.";
      setStatusMessage({ tone: "error", text: message });
      toast.error(message);
    }
  };

  return (
    <aside className="surface-card outline-glow rounded-[1.45rem] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3"><img src={BASE_SET_PROFILE_IMAGE} alt={BASE_SET_PROFILE_ALT} className="h-11 w-11 shrink-0 rounded-xl border border-amber-200/30 object-cover shadow-[0_0_20px_rgba(251,191,36,0.16)]" /><div><p className="eyebrow"><Wifi className="h-3.5 w-3.5" /> Liquidity vault</p><h2 className="mt-3 text-xl font-semibold tracking-tight text-white">Fund the Base Set testnet launch</h2><p className="mt-2 text-sm leading-6 text-white/48">Contributions are testnet-only and require a transaction you approve in your own wallet.</p></div></div>
        <span className="status-badge status-testnet">Testnet</span>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="display-font text-2xl font-semibold text-white">{funding.confirmedEth} <span className="text-sm text-white/45">ETH</span></p>
            <p className="mt-1 text-xs text-white/42">Confirmed funding toward the {funding.targetEth} testnet ETH validation target</p>
          </div>
          <p className="display-font text-sm font-semibold text-amber-200">{funding.progressPercent.toFixed(1)}%</p>
        </div>
        <div className="funding-track mt-4"><div className="funding-fill" style={{ width: `${funding.progressPercent}%` }} /></div>
        <div className="mt-3 flex justify-between text-xs text-white/42">
          <span>{funding.contributorCount} confirmed contributor{funding.contributorCount === 1 ? "" : "s"}</span>
          <span>{funding.pendingEth !== "0.000000" ? `${funding.pendingEth} testnet ETH pending` : "Receipt-verified"}</span>
        </div>
        <p className="mt-3 border-t border-white/[0.07] pt-3 text-xs leading-5 text-cyan-50/65">This is a small validation target for the testnet proof; deployment gas is reviewed separately in your wallet and does not count toward it.</p>
      </div>

      {!contractReady && (
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-300/15 bg-amber-200/[0.07] p-3 text-xs leading-5 text-amber-100/75">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          The Base Set contract descriptor is awaiting owner configuration. Wallet transactions remain disabled until the verified testnet address and ABI are stored server-side.
        </div>
      )}

      {statusMessage && (
        <div role={statusMessage.tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-4 flex gap-3 rounded-xl border p-3 text-xs leading-5 ${statusMessage.tone === "error" ? "border-rose-300/18 bg-rose-300/[0.07] text-rose-100/85" : "border-emerald-300/18 bg-emerald-200/[0.07] text-emerald-50/85"}`}>
          {statusMessage.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
          {statusMessage.text}
        </div>
      )}

      {transaction && (
        <div role="status" aria-live="polite" className="mt-4 flex gap-3 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] p-3 text-xs leading-5 text-cyan-50/85"><Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />Waiting for the testnet receipt before recording this contribution.</div>
      )}

      {!isConnected ? (
        <>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => connect(injectedConnector, "MetaMask")} disabled={isConnecting} className="h-11 bg-amber-300 text-slate-950 hover:bg-amber-200">
            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            Connect MetaMask
          </Button>
          <Button
            variant="outline"
            onClick={() => connect(walletConnectConnector, "WalletConnect")}
            disabled={!isWalletConnectConfigured || isConnecting}
            className="h-11 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
          >
            <Wallet className="mr-2 h-4 w-4" />
            {isWalletConnectConfigured ? "WalletConnect" : "WalletConnect pending"}
          </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/42"><span className="font-medium text-white/64">Connection status:</span>{" "}{WALLET_CONNECTION_VERIFICATION.metaMask.label}{" "}{WALLET_CONNECTION_VERIFICATION.walletConnect.label}</p>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.05] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-cyan-100/55">Connected wallet</p>
              <p className="display-font mt-1 truncate text-sm font-semibold text-cyan-50">{trimAddress(address)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => disconnect()} className="text-cyan-100/70 hover:bg-white/10 hover:text-white">Disconnect</Button>
          </div>
          {!isCorrectNetwork && <p className="mt-3 text-xs leading-5 text-amber-200">Your wallet will be asked to switch to Robinhood Chain testnet before sending a transaction.</p>}
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="contribution" className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/46">Contribution amount</label>
        <div className="flex gap-2">
          <Input
            id="contribution"
            inputMode="decimal"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            disabled={!isConnected || !contractReady}
            className="h-11 border-white/12 bg-black/20 text-white placeholder:text-white/25"
            aria-describedby="contribution-caption"
          />
          <div className="flex h-11 items-center rounded-xl border border-white/12 bg-white/[0.045] px-3 text-sm font-semibold text-white/70">testnet ETH</div>
        </div>
        <p id="contribution-caption" className="mt-2 text-xs leading-5 text-white/40">You review the contribution amount, separate deployment gas, and recipient in your wallet before anything is sent.</p>
      </div>

      <Button onClick={contribute} disabled={contributionDisabled} className="mt-5 h-12 w-full bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200">
        {isWriting || isSwitching || submitContribution.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : transaction ? <Check className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
        {transaction ? "Receipt verification in progress" : !contractReady ? "Awaiting testnet contract" : !isConnected ? "Connect a wallet to contribute" : "Contribute on testnet"}
      </Button>
      <p className="mt-3 text-center text-[11px] leading-5 text-white/34">No mainnet assets, private keys, or funding requests are handled by this site.</p>
    </aside>
  );
}
