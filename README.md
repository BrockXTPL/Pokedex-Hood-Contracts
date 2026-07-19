# Pokedex Base Set Testnet Contracts

> **Status: testnet-only and unaudited.** This repository is an engineering reference for the Pokedex Base Set proof. It is not a token sale, investment product, custody system, or mainnet deployment package.

This repository contains the small set of on-chain contracts that support the Pokedex Markets Base Set proof. The contracts accept **testnet-native-token contribution receipts**, anchor compact **off-chain price-evidence digests**, and publish a stable **market registry** entry that the public application can inspect.

The public product and methodology are available at [Pokedex Markets](https://pokedexmarkets.xyz) and its [Whitepaper](https://pokedexmarkets.xyz/whitepaper).

> **Publication note:** This source package intentionally does not declare a canonical GitHub repository URL. Before publishing, create the intended repository, replace the clone placeholder below with its assigned URL, and add the matching `repository` and `bugs` metadata to `package.json`.

## What is included

| Module                         | Responsibility                                                                  | What it deliberately does not do                                       |
| ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `BaseSetTestnetLiquidityPool`  | Accepts capped testnet contributions and emits application-compatible receipts. | Issue tokens, calculate returns, promise yield, or operate on mainnet. |
| `BaseSetPriceEvidenceRegistry` | Stores immutable hashes and coverage metadata for off-chain price observations. | Store raw card pricing, fetch APIs, or make market claims.             |
| `PokedexMarketRegistry`        | Binds the testnet pool and evidence registry to one Base Set market identifier. | Create a general-purpose market protocol or deploy assets.             |

The public UI currently models a curated **16-card Base Set holofoil basket**. The contracts do not attempt to encode card pricing or valuation rules on-chain; instead, they provide clear receipt and evidence boundaries for the off-chain methodology.

## Repository layout

```text
contracts/
  BaseSetTestnetLiquidityPool.sol      Testnet receipt receiver
  BaseSetPriceEvidenceRegistry.sol     Hash-addressed price-evidence anchors
  PokedexMarketRegistry.sol            Market lifecycle catalogue
  interfaces/                          Small application-facing interfaces
  mocks/                               Test-only fixtures
deploy/                                Deterministic Hardhat Deploy scripts
scripts/                               Environment, ABI, and deployment checks
test/                                  Unit and integration-style contract tests
docs/                                  Architecture, security, deployment, and operations notes
```

## Quick start

Use Node.js 20 or later and pnpm.

```bash
# After creating the canonical repository, substitute its assigned URL.
git clone <your-canonical-repository-url>
cd pokedex-base-set-contracts
cp .env.example .env
pnpm install
pnpm validate
```

The local Hardhat network needs no secret key. A testnet deployment needs a funded **testnet-only** deployer key and the role addresses described in [Deployment](docs/DEPLOYMENT.md).

```bash
pnpm deploy:local
pnpm deploy:robinhood-testnet
pnpm verify:deployment
pnpm export:abi
```

## Contract relationships

```text
PokedexMarketRegistry
  ├── BaseSetTestnetLiquidityPool
  │     └── ContributionReceived(contributor, amount)
  └── BaseSetPriceEvidenceRegistry
        └── SnapshotRecorded(snapshotId, coverage, subtotal, evidence digests)
```

The design separates native-token receipt handling from price-evidence storage. This keeps pricing API data, card metadata, and history files off-chain while leaving their integrity anchors and coverage disclosures inspectable on-chain.

## Public application compatibility

The pool preserves the ABI required by the Pokedex application:

```solidity
function contribute() external payable;
event ContributionReceived(address indexed contributor, uint256 amount);
```

The pool also accepts direct native-token transfers through `receive()`, applying the same cap, pause state, accounting, and receipt event as `contribute()`.

## Validation coverage

The local suite contains focused unit tests and an end-to-end integration path. It verifies observable state, events, error conditions, and permission boundaries rather than relying on internal implementation details alone.

| Area              | Behavioral coverage                                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contribution pool | Canonical receipts through `contribute()` and direct transfers, per-wallet accounting, contribution caps, pause and unpause controls, pause-gated withdrawals, treasury failure handling, and separated role grants. |
| Evidence registry | Oracle authorization, immutable snapshot retrieval, duplicate snapshot protection, timestamps, component-count validation, metadata updates for future records, and pause behavior.                                  |
| Market registry   | Module-address binding, operator-only configuration and activation, invalid transition handling, activated-market rewrite prevention, and the pause boundary.                                                        |
| Integration       | Full local deployment followed by configuration, activation, a contribution receipt, and an immutable evidence-recording transaction.                                                                                |

Run `pnpm validate` to compile, execute this suite, and check linting and formatting before using a change.

## Security and operational boundaries

| Boundary           | Enforcement                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Testnet-only scope | Documentation, deployment defaults, conservative contribution cap, and no token mechanics.                 |
| Role separation    | `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `TREASURY_ROLE`, and `ORACLE_ROLE` are split across contract modules. |
| Receipt integrity  | Every accepted contribution emits a canonical `ContributionReceived` event.                                |
| Evidence integrity | Snapshot IDs and source/component/evidence digests are immutable after recording.                          |
| Emergency control  | New contributions and price evidence can be paused; pool withdrawals require the pool to be paused first.  |
| No audit claim     | This repository makes no audit, safety, valuation, or mainnet-readiness claim.                             |

Read the [Security Policy](SECURITY.md) and the detailed [deployment security checklist](docs/SECURITY.md) before deploying or integrating these contracts. The repository intentionally favors explicit operational controls over unnecessary protocol complexity.

## Methodology boundary

The on-chain registry records a **subtotal and coverage metadata**, not a claim that every Base Set card is priced or that the subtotal is a complete collection valuation. The public product documents the current live source and the separately-labelled archival proxy. Consult the [public Whitepaper](https://pokedexmarkets.xyz/whitepaper) before relying on any displayed figure.

## Development commands

| Command              | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `pnpm compile`       | Compile Solidity contracts and generate TypeChain types.        |
| `pnpm test`          | Run pool, evidence, registry, and end-to-end integration tests. |
| `pnpm lint`          | Run Solhint and Prettier checks.                                |
| `pnpm validate`      | Compile, test, and lint the full repository.                    |
| `pnpm test:coverage` | Produce a local test coverage report.                           |
| `pnpm check:env`     | Validate required variables before a testnet deployment.        |
| `pnpm export:abi`    | Export the application-facing pool ABI into `exports/`.         |

## Responsible disclosure

Do not publish vulnerabilities in a public issue. See the root [Security Policy](SECURITY.md) for the private reporting path and [deployment security checklist](docs/SECURITY.md) for pre-deployment controls. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.

## License

MIT. See [LICENSE](LICENSE).
