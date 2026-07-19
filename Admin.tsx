import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock3,
  FileCode2,
  KeyRound,
  Loader2,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TestTube2,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { BASE_SET_PROFILE_ALT, BASE_SET_PROFILE_IMAGE } from "@/lib/marketArtwork";

const formatDate = (value: Date | string | null | undefined) => value
  ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  : "Not yet";

function OwnerGate({ children }: { children: React.ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-white/45" aria-live="polite">Loading owner session…</div>;
  if (error) {
    return <div className="grid min-h-screen place-items-center p-6"><div role="alert" className="surface-card max-w-md rounded-[1.5rem] p-7 text-center"><CircleAlert className="mx-auto h-8 w-8 text-rose-200" /><h1 className="mt-5 text-2xl font-semibold text-white">Owner session unavailable</h1><p className="mt-3 text-sm leading-6 text-white/48">We could not verify this session. Retry before attempting to access owner controls.</p><Button onClick={() => void refresh()} className="mt-6 bg-white/[0.08] text-white hover:bg-white/[0.13]">Retry session check</Button></div></div>;
  }
  if (!user) {
    return <div className="grid min-h-screen place-items-center p-6"><div className="surface-card max-w-md rounded-[1.5rem] p-7 text-center"><KeyRound className="mx-auto h-8 w-8 text-amber-200" /><h1 className="mt-5 text-2xl font-semibold text-white">Owner sign-in required</h1><p className="mt-3 text-sm leading-6 text-white/48">The control room is restricted to the project owner. Sign in to continue.</p><Button onClick={() => startLogin()} className="mt-6 bg-amber-300 text-slate-950 hover:bg-amber-200">Sign in securely</Button></div></div>;
  }
  if (user.role !== "admin") {
    return <div className="grid min-h-screen place-items-center p-6"><div className="surface-card max-w-md rounded-[1.5rem] p-7 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-rose-200" /><h1 className="mt-5 text-2xl font-semibold text-white">Owner access only</h1><p className="mt-3 text-sm leading-6 text-white/48">Your current account does not have permission to view or operate the Pokemon Index Markets control room.</p><Link href="/"><Button variant="outline" className="mt-6 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white">Return to market</Button></Link></div></div>;
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}

function AdminContent() {
  const { data, isLoading, error, refetch } = trpc.admin.dashboard.useQuery(undefined, { refetchInterval: 20_000 });
  const contractTemplate = trpc.admin.baseSetContractTemplate.useQuery();
  const [oracleIntervalMinutes, setOracleIntervalMinutes] = useState("60");
  const [maximumOracleAgeMinutes, setMaximumOracleAgeMinutes] = useState("180");
  const base = data?.find(item => item.market.slug === "base-set");
  const futures = data?.filter(item => item.market.slug !== "base-set") ?? [];
  const [poolAddress, setPoolAddress] = useState("");
  const [marketAddress, setMarketAddress] = useState("");
  const [oracleAddress, setOracleAddress] = useState("");
  const [abiText, setAbiText] = useState("");
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (contractTemplate.data && !abiText) {
      setAbiText(JSON.stringify(contractTemplate.data.abi, null, 2));
    }
  }, [abiText, contractTemplate.data]);

  useEffect(() => {
    if (!base) return;
    setOracleIntervalMinutes(String(base.oracle.oracleIntervalMinutes));
    setMaximumOracleAgeMinutes(String(base.oracle.maximumOracleAgeMinutes));
  }, [base?.market.id, base?.oracle.oracleIntervalMinutes, base?.oracle.maximumOracleAgeMinutes]);

  const sync = trpc.admin.syncBaseSetNow.useMutation({
    onSuccess: result => {
      toast.success(result.oracle.ok ? "Base Set index synchronization completed." : "Synchronization completed with a coverage notice.");
      void refetch();
    },
    onError: error => toast.error(error.message),
  });
  const validation = trpc.admin.setBaseSetValidation.useMutation({
    onSuccess: () => { toast.success("Base Set validation state updated."); void refetch(); },
    onError: error => toast.error(error.message),
  });
  const futureApproval = trpc.admin.setFutureMarketApproval.useMutation({
    onSuccess: () => { toast.success("Future-market gate updated."); void refetch(); },
    onError: error => toast.error(error.message),
  });
  const updateOracleSettings = trpc.admin.updateBaseSetOracleSettings.useMutation({
    onSuccess: () => { toast.success("Oracle settings updated."); void refetch(); },
    onError: error => toast.error(error.message),
  });
  const configureSchedule = trpc.admin.configureBaseSetSchedule.useMutation({
    onSuccess: () => { toast.success("Managed oracle schedule configured."); void refetch(); },
    onError: error => toast.error(error.message),
  });
  const updateContract = trpc.admin.updateBaseSetContract.useMutation({
    onSuccess: () => { toast.success("Testnet contract descriptor stored server-side."); void refetch(); },
    onError: error => toast.error(error.message),
  });

  const validationReady = Boolean(base?.latestSnapshot && base?.contract?.isConfigured && base.funding.confirmedCount > 0);
  const baseValidated = base?.market.baseSetValidated ?? false;
  const hasConfiguredContract = base?.contract?.isConfigured ?? false;

  const saveOracleSettings = () => {
    const interval = Number(oracleIntervalMinutes);
    const maximumAge = Number(maximumOracleAgeMinutes);
    if (![5, 10, 15, 20, 30, 60].includes(interval) || !Number.isInteger(maximumAge) || maximumAge < interval) {
      toast.error("Choose a 5, 10, 15, 20, 30, or 60-minute cadence; freshness must be at least that interval.");
      return;
    }
    updateOracleSettings.mutate({ oracleIntervalMinutes: interval, maximumOracleAgeMinutes: maximumAge });
  };

  const updateTestnetContract = () => {
    let abi: Record<string, unknown>[] | undefined;
    try {
      const parsed = JSON.parse(abiText);
      if (!Array.isArray(parsed)) throw new Error("ABI must be an array.");
      abi = parsed as Record<string, unknown>[];
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ABI JSON is not valid.");
      return;
    }
    updateContract.mutate({
      liquidityPoolAddress: poolAddress || null,
      marketAddress: marketAddress || null,
      oracleAddress: oracleAddress || null,
      abi,
      isConfigured: configured,
    });
  };

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/[0.08] pb-7 pt-2">
        <div><Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white"><ChevronLeft className="h-3.5 w-3.5" /> Back to public market</Link><p className="eyebrow"><ShieldCheck className="h-3.5 w-3.5" /> Owner workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white">Testnet control room</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/48">Operate and validate the Base Set proof. Future markets remain locked until this evidence is complete and you explicitly unlock them.</p></div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="h-11 bg-cyan-300 text-slate-950 hover:bg-cyan-200"><RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} /> Run testnet sync</Button>
      </div>

      {isLoading ? <div className="mt-8 grid min-h-60 place-items-center text-sm text-white/42" aria-live="polite"><Loader2 className="mb-3 h-5 w-5 animate-spin" />Loading control data…</div> : !data ? <div role="alert" className="surface-card mt-8 grid min-h-60 place-items-center rounded-[1.4rem] p-6 text-center"><div><CircleAlert className="mx-auto h-7 w-7 text-rose-200" /><p className="mt-4 text-base font-medium text-white">Control data is unavailable</p><p className="mt-2 max-w-md text-sm leading-6 text-white/48">{error?.message ?? "Retry the request before modifying validation, schedules, or contract configuration."}</p><Button onClick={() => void refetch()} className="mt-5 bg-white/[0.08] text-white hover:bg-white/[0.13]">Retry control data</Button></div></div> : <div className="mt-8 grid gap-6">
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="surface-card rounded-[1.4rem] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><img src={BASE_SET_PROFILE_IMAGE} alt={BASE_SET_PROFILE_ALT} className="h-11 w-11 shrink-0 rounded-xl border border-amber-200/25 object-cover" /><div><p className="eyebrow"><TestTube2 className="h-3.5 w-3.5" /> Validation sequence</p><h2 className="mt-3 text-xl font-semibold text-white">Base Set testnet proof</h2></div></div><span className={`status-badge ${baseValidated ? "status-ready" : "status-testnet"}`}>{baseValidated ? "Validated" : "In validation"}</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className={`rounded-xl border p-3 ${hasConfiguredContract ? "border-emerald-300/18 bg-emerald-200/[0.06]" : "border-white/8 bg-white/[0.025]"}`}><FileCode2 className={`h-4 w-4 ${hasConfiguredContract ? "text-emerald-200" : "text-white/36"}`} /><p className="mt-3 text-xs font-medium text-white">Contract descriptor</p><p className="mt-1 text-[11px] text-white/42">{hasConfiguredContract ? "Stored" : "Required"}</p></div><div className={`rounded-xl border p-3 ${base?.latestSnapshot ? "border-emerald-300/18 bg-emerald-200/[0.06]" : "border-white/8 bg-white/[0.025]"}`}><Clock3 className={`h-4 w-4 ${base?.latestSnapshot ? "text-emerald-200" : "text-white/36"}`} /><p className="mt-3 text-xs font-medium text-white">Oracle evidence</p><p className="mt-1 text-[11px] text-white/42">{base?.latestSnapshot ? `${base.latestSnapshot.componentCount} prices recorded` : "Required"}</p></div><div className={`rounded-xl border p-3 ${base?.funding.confirmedCount ? "border-emerald-300/18 bg-emerald-200/[0.06]" : "border-white/8 bg-white/[0.025]"}`}><BadgeCheck className={`h-4 w-4 ${base?.funding.confirmedCount ? "text-emerald-200" : "text-white/36"}`} /><p className="mt-3 text-xs font-medium text-white">Funding receipt</p><p className="mt-1 text-[11px] text-white/42">{base?.funding.confirmedCount ? `${base.funding.confirmedCount} confirmed` : "Required"}</p></div></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-black/15 p-4"><div><p className="text-sm font-medium text-white">Validation gate</p><p className="mt-1 text-xs text-white/43">{validationReady ? "Evidence conditions are present. Your approval remains a deliberate action." : "Store a contract descriptor, record price evidence, and confirm a testnet contribution first."}</p></div><Button onClick={() => validation.mutate({ validated: !baseValidated })} disabled={validation.isPending || (!validationReady && !baseValidated)} className={baseValidated ? "bg-white/[0.08] text-white hover:bg-white/[0.13]" : "bg-amber-300 text-slate-950 hover:bg-amber-200"}>{validation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{baseValidated ? "Revoke validation" : "Approve Base Set validation"}</Button></div></div>

          <div className="surface-card rounded-[1.4rem] p-5 sm:p-6"><p className="eyebrow"><Clock3 className="h-3.5 w-3.5" /> Managed oracle</p><h2 className="mt-3 text-xl font-semibold text-white">Periodic managed updates</h2><p className="mt-2 text-sm leading-6 text-white/48">The scheduled callback fetches price inputs, persists a new index snapshot, and reconciles pending testnet receipts. It runs only after the site is published.</p><p className="mt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-white/42">Managed cadence</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/20 px-3 py-3 font-mono text-xs text-white/70">{base?.oracle.managedCron ?? "Choose a supported interval"}</code><Button onClick={() => configureSchedule.mutate()} disabled={configureSchedule.isPending || !base?.oracle.managedCron} className="h-11 shrink-0 bg-white/[0.08] text-white hover:bg-white/[0.13]">{configureSchedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}Activate</Button></div><div className="mt-5 rounded-xl border border-amber-300/12 bg-amber-200/[0.06] p-3 text-xs leading-5 text-amber-100/72"><CircleAlert className="mr-1.5 inline h-3.5 w-3.5 text-amber-200" /> Publishing is intentionally required before this platform-managed schedule can be activated. The configured schedule will appear in the project management interface after launch.</div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs text-white/48">Update interval (minutes)<Input type="number" min="1" max="1440" value={oracleIntervalMinutes} onChange={event => setOracleIntervalMinutes(event.target.value)} className="mt-2 h-10 border-white/12 bg-black/20 text-white" /></label><label className="text-xs text-white/48">Freshness threshold (minutes)<Input type="number" min="1" max="10080" value={maximumOracleAgeMinutes} onChange={event => setMaximumOracleAgeMinutes(event.target.value)} className="mt-2 h-10 border-white/12 bg-black/20 text-white" /></label><Button onClick={saveOracleSettings} disabled={updateOracleSettings.isPending} className="self-end bg-white/[0.08] text-white hover:bg-white/[0.13]">{updateOracleSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}Save limits</Button></div><div className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-white/40">Schedule</p><p className="mt-1.5 font-medium text-white/80">{base?.oracle.scheduleConfigured ? "Configured" : "Awaiting publish"}</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-white/40">Cadence</p><p className="mt-1.5 font-medium text-white/80">{base?.oracle.oracleIntervalMinutes ?? "—"} min</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-white/40">Freshness</p><p className="mt-1.5 font-medium text-white/80">{base?.oracle.maximumOracleAgeMinutes ?? "—"} min</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-white/40">Index feed</p><p className={`mt-1.5 font-medium ${base?.oracle.indexSyncHealth.state === "healthy" ? "text-emerald-200" : "text-amber-200"}`}>{base?.oracle.indexSyncHealth.state ?? "awaiting"}</p><p className="mt-1 text-[11px] text-white/42">{formatDate(base?.latestSnapshot?.observedAt)}</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-white/40">Receipt reconciliation</p><p className={`mt-1.5 font-medium ${base?.oracle.contributionSyncHealth.state === "healthy" ? "text-emerald-200" : "text-amber-200"}`}>{base?.oracle.contributionSyncHealth.state ?? "awaiting"}</p><p className="mt-1 text-[11px] text-white/42">{formatDate(base?.oracle.lastContributionSyncAt)}</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-white/40">Current index</p><p className="display-font mt-1.5 font-semibold text-white">{base?.latestSnapshot?.indexValue ?? "—"}</p></div></div></div>
        </section>

        <section className="surface-card rounded-[1.4rem] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow"><FileCode2 className="h-3.5 w-3.5" /> Server-side contract descriptor</p><h2 className="mt-3 text-xl font-semibold text-white">Configure Base Set testnet integration</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">Enter only verified Robinhood Chain testnet contract details. The private deployer key is never stored here. The public client receives a contract interface only after this owner-controlled server configuration is enabled.</p></div><span className={`status-badge ${hasConfiguredContract ? "status-ready" : "status-locked"}`}>{hasConfiguredContract ? "Configured" : "Not configured"}</span></div><div className="mt-6 grid gap-4 md:grid-cols-3"><div><label className="text-xs text-white/45">Liquidity-pool address</label><Input value={poolAddress} onChange={event => setPoolAddress(event.target.value)} placeholder={base?.contract?.liquidityPoolAddress ?? "0x…"} className="mt-2 h-11 border-white/12 bg-black/20 font-mono text-xs text-white" /></div><div><label className="text-xs text-white/45">Index-market address</label><Input value={marketAddress} onChange={event => setMarketAddress(event.target.value)} placeholder={base?.contract?.marketAddress ?? "Optional 0x…"} className="mt-2 h-11 border-white/12 bg-black/20 font-mono text-xs text-white" /></div><div><label className="text-xs text-white/45">Oracle address</label><Input value={oracleAddress} onChange={event => setOracleAddress(event.target.value)} placeholder={base?.contract?.oracleAddress ?? "Optional 0x…"} className="mt-2 h-11 border-white/12 bg-black/20 font-mono text-xs text-white" /></div></div><label className="mt-5 block text-xs text-white/45">Approved ABI JSON</label><Textarea value={abiText} onChange={event => setAbiText(event.target.value)} spellCheck={false} className="mt-2 min-h-40 border-white/12 bg-black/20 font-mono text-xs leading-5 text-white" /><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/15 p-3"><label className="flex items-center gap-3 text-sm text-white/75"><input type="checkbox" checked={configured} onChange={event => setConfigured(event.target.checked)} className="h-4 w-4 rounded border-white/30 bg-black/30 accent-amber-300" /> I have independently verified this is the correct testnet contract descriptor.</label><Button onClick={updateTestnetContract} disabled={updateContract.isPending} className="bg-amber-300 text-slate-950 hover:bg-amber-200">{updateContract.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}Store descriptor</Button></div></section>

        <section><div className="mb-5"><p className="eyebrow"><LockKeyhole className="h-3.5 w-3.5" /> Staged expansion</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">Future markets remain under owner control</h2></div><div className="grid gap-4 lg:grid-cols-3">{futures.map(item => <div key={item.market.slug} className="surface-card rounded-[1.35rem] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold text-white">{item.market.displayName}</p><p className="mt-1 text-sm text-white/42">{item.market.setCode.toUpperCase()} · Coming to Mainnet</p></div><LockKeyhole className="h-5 w-5 text-white/35" /></div><div className="mt-6 rounded-xl border border-white/[0.08] bg-black/15 p-3"><p className="text-xs text-white/42">Rollout state</p><p className="mt-1 text-sm font-medium text-white">{item.market.adminApproved ? "Configuration unlocked" : "Locked pending testnet proof"}</p><p className="mt-2 text-xs leading-5 text-white/38">Funding targets and deployment parameters are intentionally absent until you separately authorize the post-validation stage.</p></div><Button onClick={() => futureApproval.mutate({ slug: item.market.slug as "jungle" | "fossil" | "base-set-2", approved: !item.market.adminApproved })} disabled={futureApproval.isPending || (!baseValidated && !item.market.adminApproved)} aria-disabled={!baseValidated && !item.market.adminApproved} title={!baseValidated && !item.market.adminApproved ? "Validate the Base Set testnet proof before authorizing this market." : undefined} variant="outline" className={`mt-5 w-full border-white/14 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:text-white ${!baseValidated && !item.market.adminApproved ? "cursor-not-allowed opacity-50" : ""}`}>{item.market.adminApproved ? "Re-lock market" : !baseValidated ? "Await Base Set validation" : "Authorize configuration"}</Button></div>)}</div></section>
      </div>}
    </div>
  );
}

export default function Admin() {
  return <OwnerGate><AdminContent /></OwnerGate>;
}
