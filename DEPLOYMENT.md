# Deployment

This guide deploys the three Base Set testnet modules with Hardhat Deploy. It is intended for local validation and the Robinhood Chain testnet only.

## Required variables

Copy `.env.example` to `.env` and populate the testnet values.

| Variable | Required | Purpose |
|---|---:|---|
| `DEPLOYER_PRIVATE_KEY` | For testnet | Private key for a funded **testnet-only** deployment account. |
| `ROBINHOOD_TESTNET_RPC_URL` | No | RPC endpoint; defaults to the public Robinhood testnet endpoint. |
| `ADMIN_ADDRESS` | No | Admin role holder; defaults to deployer. |
| `TREASURY_ADDRESS` | No | Pool treasury recipient; defaults to deployer. |
| `ORACLE_ADDRESS` | No | Evidence registry oracle; defaults to deployer. |
| `BASE_SET_MAX_CONTRIBUTION_ETH` | No | Native-token cap per receipt; defaults to `0.05`. |
| `BASE_SET_EXPECTED_COMPONENTS` | No | Curated Base Set holofoil component count; defaults to `16`. |
| `BASE_SET_METHODOLOGY_DIGEST` | No | 32-byte digest for the methodology release. |
| `BASE_SET_DOCUMENTATION_DIGEST` | No | 32-byte digest for the documentation release. |

> Never use a mainnet private key. The deployment script rejects obvious zero-address role assignments but cannot detect where a private key originated.

## Validate locally

```bash
pnpm install
pnpm validate
pnpm deploy:local
```

Hardhat Deploy writes local deployment metadata under `deployments/` when a persistent network is used. For a temporary in-memory Hardhat network, use the command output as a development check only.

## Deploy to Robinhood Chain testnet

```bash
pnpm check:env
pnpm deploy:robinhood-testnet
pnpm verify:deployment
pnpm export:abi
```

The deploy script performs the following ordered operations:

1. Deploys `BaseSetTestnetLiquidityPool` with the selected admin, treasury, and contribution cap.
2. Deploys `BaseSetPriceEvidenceRegistry` with the selected admin, oracle, 16-component default, and source-field descriptor hashes.
3. Deploys `PokedexMarketRegistry` with the selected admin and operator.
4. Configures and activates the registry with the two module addresses and documentation digests.
5. Writes a deterministic deployment log that can be committed with the release record.

## Post-deployment verification

After deployment, record the following in the GitHub release and the public product configuration.

| Item | Why it matters |
|---|---|
| Chain ID and RPC source | Confirms the intended testnet. |
| Pool, evidence registry, and market registry addresses | Lets independent users inspect code and events. |
| Deployment transaction hashes and block numbers | Provides an immutable deployment record. |
| Role holders | Makes operational control visible. |
| Pool cap and expected component count | Confirms the testnet receipt and methodology boundaries. |
| Repository commit/tag | Connects verified bytecode to an open-source source revision. |

## Application handoff

The existing Pokedex app needs the pool address and the small compatibility ABI exported by `pnpm export:abi`. The required receipt interface remains:

```solidity
function contribute() external payable;
event ContributionReceived(address indexed contributor, uint256 amount);
```

Price retrieval remains off-chain. The evidence registry should only be wired after the app can create and retain the canonical evidence bundle represented by each on-chain digest.
