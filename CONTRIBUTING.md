# Contributing to Pokedex Base Set Testnet Contracts

Thank you for considering a contribution. This repository is intentionally narrow: it supports a **testnet-only** contribution-receipt flow, immutable price-evidence anchors, and a small market lifecycle catalogue. Changes should preserve that constrained scope rather than expand it into a token, custody, trading, or mainnet protocol.

## Before opening a change

Please discuss material design changes in an issue before investing substantial implementation time. Do **not** use public issues for suspected vulnerabilities; follow the private reporting path in [SECURITY.md](SECURITY.md).

| Change type | Expected discussion and evidence |
|---|---|
| Documentation or test clarification | Explain the behavioral contract being clarified and include the relevant validation output. |
| Contract behavior change | Explain the threat model, role implications, migration or deployment impact, and add regression tests. |
| ABI or event change | Treat as a breaking application-integration change. Document the compatibility impact and update the ABI export expectations. |
| Dependency or compiler change | Explain why it is needed, identify affected artifacts, and run the complete validation command. |

## Development workflow

Use Node.js 20 or later and pnpm. Copy `.env.example` only when you need to exercise a public testnet deployment; local compilation and testing do not require a private key.

```bash
pnpm install
pnpm validate
```

The validation command compiles the contracts, runs the unit and integration tests, executes Solhint, and checks formatting. A contribution should leave that command green before review.

```bash
pnpm compile
pnpm test
pnpm lint
pnpm export:abi
```

## Solidity and test expectations

Prefer small, explicit functions and custom errors over hidden behavior. Preserve the existing separation between administrative configuration, pausing, treasury withdrawal authority, and oracle submission authority. Do not store raw third-party pricing payloads, wallet-sensitive material, or off-chain card metadata on-chain.

Every behavior change must include regression coverage in `test/`. Test observable effects: access control, pause boundaries, receipts, events, persistent state, validation errors, and lifecycle transitions. The integration suite should continue to demonstrate the end-to-end deployment, configuration, activation, contribution, and evidence-recording flow.

## Pull request checklist

Before requesting review, confirm that the pull request includes a concise explanation of the intent and that it meets the following checklist.

- [ ] The change preserves the repository's testnet-only scope and does not add asset issuance, investment, custody, or mainnet claims.
- [ ] Relevant unit or integration tests have been added or updated.
- [ ] `pnpm validate` succeeds locally.
- [ ] Application-facing ABI or event changes, if any, have been explicitly documented.
- [ ] Deployment, operations, architecture, and security documentation has been updated when the behavioral or operational contract changed.
- [ ] No secrets, private keys, RPC credentials, or generated deployment artifacts are included.

## Style and commit hygiene

Use Prettier and Solhint rather than hand-formatting generated changes. Keep commits focused enough to review and revert. Avoid force-pushing after review has started unless a maintainer requests it. Generated directories such as `artifacts/`, `cache/`, `coverage/`, and `typechain-types/` should not be committed.

By participating, you agree to follow the project standards in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
