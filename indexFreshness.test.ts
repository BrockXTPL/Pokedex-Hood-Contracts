import { describe, expect, it } from "vitest";
import {
  MATERIAL_INDEX_MOVEMENT_POINTS,
  hasMaterialIndexMovement,
  isFlatIndexHistory,
} from "@shared/indexFreshness";

describe("index freshness presentation", () => {
  it("treats the persisted 1,000-point floating-point noise as a flat history", () => {
    const history = [
      { value: "1000.00000000" },
      { value: "1000.00000003" },
      { value: "1000.00000003" },
    ];

    expect(hasMaterialIndexMovement(history)).toBe(false);
    expect(isFlatIndexHistory(history)).toBe(true);
  });

  it("identifies a source-price change once it meets the material movement threshold", () => {
    const history = [
      { value: 1000 },
      { value: 1000 + MATERIAL_INDEX_MOVEMENT_POINTS },
    ];

    expect(hasMaterialIndexMovement(history)).toBe(true);
    expect(isFlatIndexHistory(history)).toBe(false);
  });

  it("does not claim a flat market from one usable observation or invalid data", () => {
    expect(isFlatIndexHistory([{ value: "1000" }])).toBe(false);
    expect(isFlatIndexHistory([{ value: "not-a-number" }, { value: "1000" }])).toBe(false);
  });
});
