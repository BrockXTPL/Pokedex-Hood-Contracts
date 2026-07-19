# Historical Price Source Research — 2026-07-18

## TCGdex current-market API

The current provider is TCGdex. Its published card response embeds current Cardmarket and TCGplayer pricing. The documentation describes Cardmarket trend and one-, seven-, and thirty-day values, plus current TCGplayer USD price fields, but it does not document a public all-time-history endpoint in the card API.[1]

## TCGdex `price-history` repository

TCGdex maintains a public `price-history` repository that states it is updated daily with price information from multiple sources and contains pre-calculated one-, seven-, and twenty-eight-day averages and min/max values. The repository is MIT licensed. This is the strongest candidate to inspect for real historical data compatible with the existing card identifiers, subject to verifying that it contains the approved Base Set cards, useful time depth, and values that can be mapped to the selected USD market-price variant.[2]

## PriceCharting

PriceCharting offers historical price charts on its public site, but its official paid API and CSV documentation explicitly states that historic prices and historic sales are not supported. It is therefore not an appropriate API source for automatic all-time ingestion without a separately authorized data-access arrangement.[3]

## PokeWallet

PokeWallet documents authenticated card pricing access and public marketing claims about historical snapshots. The extracted API documentation confirms API-key authentication and describes current pricing fields, but the available reference did not establish an all-time historical endpoint, data model, or licensing terms suitable for ingestion. It remains a possible paid alternative only if its provider confirms the relevant endpoint and coverage.[4]

## Provisional direction

Inspect the TCGdex repository's actual Base Set files first. If it contains real, sufficiently complete daily history that can be mapped to the approved basket, import it with explicit source and coverage disclosure. Do not synthesize, interpolate, or scrape any unauthorised historical series.

## References

[1]: https://tcgdex.dev/markets-prices
[2]: https://github.com/tcgdex/price-history
[3]: https://www.pricecharting.com/api-documentation
[4]: https://pokewallet.io/api-docs

## Repository coverage check

The public repository contains an `en/base1/` directory with per-card TCGplayer JSON files, including sequential Base Set card numbers such as `4.tcgplayer.json` and `15.tcgplayer.json`. This confirms that the public history collection is organized by the same Base Set code and card-number convention used by the approved basket. The last visible repository commit is approximately two years old, so any imported chart must disclose the source cut-off date rather than imply it is a live all-time feed.

## Detailed compatibility check

The approved basket maps to Base Set card numbers `1` through `16`. The public source exposes `base1/{number}.tcgplayer.json` files for fifteen of those components; `base1/8.tcgplayer.json` returns HTTP 404, so Machamp has no matching historical file in the archive. For the fifteen available cards, `holo-good` is the only common long-run variant. It contains roughly 372–460 dated observations per card, begins on 2022-11-12 for most cards (2022-11-14 for Charizard), and ends between 2024-09-20 and 2024-09-23. Its integer `avg` fields are dollar cents, as illustrated by the first Charizard observation (`avg: 19499`) on 2022-11-14. The archive therefore offers a real but incomplete and stale 2022–2024 period, not all-time history through the present day.

The historical archive's `holo-good` condition cannot be assumed to be equivalent to the live TCGdex `tcgplayer.holo.marketPrice` field. Joining it to the live basket or labelling it as a continuous all-time series would risk creating a misleading comparison. Any free archival chart must be labelled as a separate, partial-coverage historical archive.

TCGplayer's official developer documentation says it is no longer granting new API access, preventing it from serving as a practical new licensed source for a complete history feed.[5] CardHedger publicly advertises both a Price History API and custom API arrangements, making it a potentially appropriate licensed provider to investigate if exact, current, all-component history is required.[6]

[5]: https://docs.tcgplayer.com/docs/getting-started
[6]: https://www.cardhedger.com/price_api_business
