# Base Set USD Price Audit

## Observed live calculation

The public `base-set` detail response retrieved on 2026-07-18 reported a latest live snapshot with `weightedMarketValueUsd` of **$118.54933333** and `componentCount` of **15**. The persisted component payload contains 15 priced cards totaling **$1,778.24**. The current oracle divides the weighted sum by the covered weight, so it stores and displays the **mean price of the 15 priced cards**, not a one-copy collection subtotal.

The configured universe contains 16 equal-weight components. Base Set Machamp (`base1-8`) is the unpriced component in the live snapshot.

## Provider evidence

| Component | Relevant provider observation |
|---|---|
| Machamp (`base1-8`) | TCGdex reports the unlimited holo variant but its `tcgplayer` payload is `null`; no TCGplayer USD market price is available through the configured source. Its Cardmarket payload is EUR-only. [1] |
| Alakazam (`base1-1`) | TCGdex exposes a TCGplayer holofoil USD `marketPrice` of 86.56. [2] |
| Blastoise (`base1-2`) | TCGdex exposes a TCGplayer holofoil USD `marketPrice` of 232.06. [3] |
| Charizard (`base1-4`) | TCGdex exposes a TCGplayer holofoil USD `marketPrice` of 773.51. [4] |
| Venusaur (`base1-15`) | TCGdex exposes a TCGplayer holofoil USD `marketPrice` of 157.26. [5] |

## Correction principle

Public copy must not call the existing average a complete “USD basket value.” The corrected interface should present a **15-card live subtotal** only when it has 15 prices, state the missing component explicitly, and retain the coverage count. The historical archive is also an average and must be converted to its documented 15-card subtotal if it is displayed alongside the live subtotal.

## Reviewable pricing-field and condition evidence

The live oracle’s sole USD selector is `pricing.tcgplayer.holofoil.marketPrice`. Its component records persist the approved variant as `holofoil`, the selected field as `pricing.tcgplayer.holofoil.marketPrice`, the returned USD `marketPriceUsd`, and the source label `TCGdex / TCGplayer`. This selection is defined in `shared/priceProvenance.ts`, consumed by `server/services/indexOracle.ts`, and exposed to public-detail consumers as `priceProvenance.live`.

The earlier chart segment is deliberately not treated as the same series. Its provenance is `TCGdex price-history`, condition `holo-good`, field `monthly holo-good price proxy`, and coverage of 15 approved components from November 2022 through September 2024. These semantics are exposed separately as `priceProvenance.archive`; the dashed chart bridge is a source-transition guide, not a market-price observation.

## References

[1]: https://api.tcgdex.net/v2/en/cards/base1-8
[2]: https://api.tcgdex.net/v2/en/cards/base1-1
[3]: https://api.tcgdex.net/v2/en/cards/base1-2
[4]: https://api.tcgdex.net/v2/en/cards/base1-4
[5]: https://api.tcgdex.net/v2/en/cards/base1-15
