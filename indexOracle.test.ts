import { describe, expect, it } from "vitest";
import { calculateWeightedIndex, selectTcgplayerHolofoilMarketPrice } from "./indexOracle";

describe("calculateWeightedIndex", () => {
  it("establishes the first valid weighted market value as the 1,000-point baseline", () => {
    const result = calculateWeightedIndex([
      { priceUsd: 100, weight: 0.6 },
      { priceUsd: 200, weight: 0.4 },
    ]);

    expect(result).toEqual({
      weightedMarketValue: 140,
      baselineMarketValue: 140,
      indexValue: 1000,
    });
  });

  it("normalizes a later observation against the persisted baseline", () => {
    const result = calculateWeightedIndex([
      { priceUsd: 120, weight: 0.6 },
      { priceUsd: 240, weight: 0.4 },
    ], 140);

    expect(result?.weightedMarketValue).toBe(168);
    expect(result?.baselineMarketValue).toBe(140);
    expect(result?.indexValue).toBeCloseTo(1200, 8);
  });

  it("rejects an empty or non-positive component basket", () => {
    expect(calculateWeightedIndex([])).toBeNull();
    expect(calculateWeightedIndex([{ priceUsd: 100, weight: 0 }])).toBeNull();
    expect(calculateWeightedIndex([{ priceUsd: 0, weight: 1 }])).toBeNull();
  });

  it("selects only the approved TCGplayer holofoil marketPrice and never substitutes another variant", () => {
    const pricing = {
      tcgplayer: {
        holofoil: { marketPrice: 86.56 },
        reverseHolofoil: { marketPrice: 204.1 },
        normal: { marketPrice: 3.25 },
      },
    };

    expect(selectTcgplayerHolofoilMarketPrice(pricing)).toBe(86.56);
    expect(selectTcgplayerHolofoilMarketPrice({
      tcgplayer: { reverseHolofoil: { marketPrice: 204.1 }, normal: { marketPrice: 3.25 } },
    })).toBeUndefined();
  });
});
