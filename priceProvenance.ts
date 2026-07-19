export const LIVE_TCGDEX_PRICE_PROVENANCE = {
  sourceKind: "live",
  source: "TCGdex / TCGplayer",
  provider: "TCGdex",
  marketplace: "TCGplayer",
  variant: "holofoil",
  priceField: "pricing.tcgplayer.holofoil.marketPrice",
  currency: "USD",
} as const;

export const ARCHIVE_TCGDEX_PRICE_PROVENANCE = {
  sourceKind: "archive",
  source: "TCGdex price-history",
  provider: "TCGdex price-history",
  variant: "holo-good",
  priceField: "monthly holo-good price proxy",
  currency: "USD",
  coverage: "15 approved Base Set components, November 2022–September 2024",
} as const;

export const PRICE_PROVENANCE = {
  live: LIVE_TCGDEX_PRICE_PROVENANCE,
  archive: ARCHIVE_TCGDEX_PRICE_PROVENANCE,
} as const;

export type PriceProvenance = typeof PRICE_PROVENANCE;
