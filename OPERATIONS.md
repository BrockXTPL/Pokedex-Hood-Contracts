# Operations

The contracts are intentionally narrow; correct operation depends on disciplined off-chain procedures. This guide describes the minimum repeatable workflow for the testnet proof.

## Contribution reconciliation

The pool emits `ContributionReceived(contributor, amount)` for every accepted `contribute()` call and direct native-token transfer. The public application should treat the chain event as the receipt of record.

| Step | Action | Expected output |
|---|---|---|
| 1 | Read pool events from the configured deployment block onward. | Ordered receipt candidates. |
| 2 | Confirm transaction status, log address, topic, contributor, and amount. | Confirmed testnet contribution record. |
| 3 | Record the transaction hash and log index in application storage. | Idempotent reconciliation key. |
| 4 | Compare application funding progress against the event-derived total. | Explicitly identified drift, if any. |
| 5 | Display contribution status as testnet-only and unaudited. | Accurate public boundary. |

Do not infer a contribution from a wallet balance change or a pending transaction. Confirm the emitted event in a successful transaction receipt.

## Evidence submission

The `ORACLE_ROLE` may record a compact evidence anchor only after the off-chain job has created and retained a canonical evidence bundle.

The evidence bundle should contain, at minimum:

1. The Base Set market key and methodology version.
2. The UTC observation timestamp and provider update timestamp.
3. Canonical component IDs, selected variant/condition, and raw observed prices.
4. The live priced-card subtotal and both priced/configured component counts.
5. The exact source/field descriptor, such as the selected TCGdex/TCGplayer field.
6. A digest of the canonical JSON serialized in a documented, deterministic format.

The application must keep the canonical evidence bundle available off-chain. A hash on-chain proves consistency with a supplied bundle; it does not reconstruct data that has been discarded.

## Source transitions

The public chart may present a separately labelled archival proxy segment and a current live source segment in one visual. The on-chain evidence registry should not claim that a visual bridge is a market observation. Record only actual observed live values and explicit provenance.

## Pause and withdrawal procedure

A treasury withdrawal is a testnet operational event and should be observable.

1. Pause the pool using an authorized `PAUSER_ROLE` account.
2. Confirm the `PoolPaused` event and public interface state.
3. Execute `withdrawToTreasury(amount)` from the authorized `TREASURY_ROLE` account.
4. Confirm `TreasuryWithdrawal` and the treasury receipt transaction.
5. Publish a short operational note with transaction hashes and reason.
6. Resume only after confirming application reconciliation is correct.

## Role rotation

Grant the replacement role before revoking the prior role. Validate the new signer on the target testnet, record the role-grant transaction, then revoke the obsolete signer. Do not rotate every operational role in one untested transaction sequence.
