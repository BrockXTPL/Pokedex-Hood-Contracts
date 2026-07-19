# Architecture

The Pokedex Base Set testnet package uses three deliberately narrow contracts. It records contribution receipts and evidence anchors without moving the card-pricing calculation, external API calls, or user interface on-chain.

## Design principle

> **The chain records deterministic receipts and evidence commitments; the public application remains responsible for source retrieval, aggregation, coverage disclosure, and presentation.**

This boundary keeps variable external market data out of the EVM while leaving an auditable commitment trail for a reviewed off-chain observation.

| Layer | Artifact | Trust boundary |
|---|---|---|
| Public application | Live TCGdex/TCGplayer observations, archival proxy data, coverage UI | Can retrieve and display mutable third-party data; must disclose source and coverage. |
| Evidence preparation | Canonical JSON, card/component digest, source descriptor digest, evidence digest | Defines a reproducible record of what was observed off-chain. |
| `BaseSetPriceEvidenceRegistry` | Immutable snapshot tuple and event | Accepts only authorized oracle submissions; cannot independently validate third-party API prices. |
| `BaseSetTestnetLiquidityPool` | Capped testnet receipt and event | Accepts native testnet funds; does not encode any price, token, or return logic. |
| `PokedexMarketRegistry` | Stable references to deployed module addresses | Provides a discoverable testnet catalogue entry. |

## Module interaction

```text
                ┌──────────────────────────────────────────────┐
                │                 Pokedex web app              │
                │ pricing, coverage, history, disclosure UI    │
                └───────────────────┬──────────────────────────┘
                                    │ canonical evidence digest
                                    ▼
                 ┌────────────────────────────────────────┐
                 │  BaseSetPriceEvidenceRegistry           │
                 │  snapshot ID + source/component hashes  │
                 └───────────────────┬────────────────────┘
                                     │ configured address
                                     ▼
              ┌──────────────────────────────────────────────┐
              │              PokedexMarketRegistry            │
              │ Base Set market ID → pool + evidence registry │
              └───────────────────┬──────────────────────────┘
                                  │ configured address
                                  ▼
                   ┌──────────────────────────────────────┐
                   │ BaseSetTestnetLiquidityPool           │
                   │ capped receipts + contribution events │
                   └──────────────────────────────────────┘
```

## Evidence record format

The evidence registry stores a `Snapshot` using compact values and hashes. It does not store raw price feeds or card metadata.

| Field | Meaning |
|---|---|
| `snapshotId` | Deterministic 32-byte identifier derived off-chain from the market, observed timestamp, and evidence digest. |
| `observedAt` | UTC Unix timestamp when the application read the source data. |
| `providerUpdatedAt` | UTC Unix timestamp supplied by the price provider, if available. |
| `liveSubtotalUsdCents` | Observed priced-card subtotal in cents; not a complete-collection valuation. |
| `pricedComponentCount` | Number of basket components with compatible observed live prices. |
| `configuredComponentCount` | Methodology-defined Base Set holofoil basket size. |
| `componentDigest` | Hash of canonical component identifiers and chosen variants. |
| `sourceDigest` | Hash of the source/field/condition descriptor. |
| `evidenceDigest` | Hash of a canonical off-chain evidence bundle. |

## Role model

The package uses OpenZeppelin `AccessControl` to make administrative separation explicit.

| Contract | Role | Intended holder | Capability |
|---|---|---|---|
| Pool | `DEFAULT_ADMIN_ROLE` | Multisig or named testnet admin | Rotate roles and treasury recipient. |
| Pool | `PAUSER_ROLE` | Incident-response signer | Pause or resume new receipts. |
| Pool | `TREASURY_ROLE` | Testnet treasury operator | Withdraw only while the pool is paused. |
| Evidence registry | `ORACLE_ROLE` | Operational oracle signer | Record deterministic evidence snapshots. |
| Evidence registry | `DEFAULT_ADMIN_ROLE` | Multisig or named testnet admin | Rotate oracle role and update methodology field hashes. |
| Market registry | `OPERATOR_ROLE` | Deployment operator | Configure and activate module addresses. |

Production use should allocate these roles to appropriately controlled accounts; deployment scripts accept distinct role addresses for that reason.
