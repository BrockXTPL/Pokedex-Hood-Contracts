import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("product branding", () => {
  it("uses Pokemon Index Markets as the product name and keeps $Pokedex as the ticker", () => {
    const indexPath = fileURLToPath(new URL("../../index.html", import.meta.url));
    const html = readFileSync(indexPath, "utf8");

    expect(html).toContain("Pokemon Index Markets");
    expect(html).toContain("$Pokedex");
  });
});
