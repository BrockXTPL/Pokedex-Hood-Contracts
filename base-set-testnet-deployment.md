# Base Set Testnet Deployment Handoff

> **Scope:** This document covers the **Original Pokémon Base Set** proof on **Robinhood Chain testnet only**. It does not authorize or automate any mainnet deployment, funding transfer, or private-key handling.

## Contract Artifact

The testnet-only contribution receiver is located at:

```text
contracts/BaseSetTestnetLiquidityPool.sol
```

Its public funding method is:

```solidity
function contribute() external payable
```

It emits:

```solidity
event ContributionReceived(address indexed contributor, uint256 amount)
```

The matching ABI template is stored server-side at:

```text
server/contracts/baseSetTestnetPool.ts
```

The browser never imports this server module directly. The owner control room retrieves the approved ABI through a protected server procedure, and the public funding widget receives it only after the owner saves a verified testnet contract descriptor.

## Testnet Configuration

| Setting | Value |
| --- | --- |
| Network | Robinhood Chain Testnet |
| Chain ID | `46630` |
| Native asset | Testnet ETH |
| RPC URL | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com` |

## Owner Deployment Sequence

1. Compile `BaseSetTestnetLiquidityPool.sol` using a tool and compiler version you independently trust. Review the resulting bytecode and ABI before deployment.
2. In a wallet you control, select **Robinhood Chain Testnet** and use testnet funds only. Do not use a private key in this repository or in the site configuration.
3. Deploy the contract manually and wait for its deployment transaction to confirm.
4. Independently verify the deployed contract address, bytecode, and explorer record.
5. Sign in to the site’s owner-only **Testnet Control Room** and enter the confirmed liquidity-pool address. The approved `contribute` ABI is loaded from the server-side template; enable the descriptor only after independent verification.
6. Make one small, wallet-approved **testnet** contribution. The application should record it as pending, then reconcile its receipt and reflect the confirmed amount in the public funding progress display.
7. Trigger the owner-only testnet synchronization to capture the first Base Set price snapshot. After publishing, configure the managed schedule from the same owner interface.
8. Validate the Base Set proof only when the contract descriptor, oracle evidence, and at least one receipt-confirmed testnet contribution are present.

## Explicit Mainnet Gate

The Jungle, Fossil, and Base Set 2 cards must remain labelled **Coming to Mainnet** and locked until the Base Set testnet proof has been completed and an owner explicitly unlocks later configuration. Mainnet contract creation, mainnet funding, and mainnet transaction signing are out of scope for this handoff and require separate review, authorization, and security assessment.
