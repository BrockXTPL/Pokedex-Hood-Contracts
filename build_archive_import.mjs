import { writeFile } from "node:fs/promises";

const cardIds = Array.from({ length: 16 }, (_, index) => index + 1);
const missingCardId = 8;
const sourceBaseUrl = "https://raw.githubusercontent.com/tcgdex/price-history/master/en/base1";
const sourceUrl = "https://github.com/tcgdex/price-history";
const sourceKey = "tcgdex-price-history";
const variant = "holo-good";
const minimumComponents = 10;

const sqlString = value => `'${String(value).replaceAll("'", "''")}'`;
const decimal = value => Number(value).toFixed(8);

const cards = await Promise.all(
  cardIds.map(async cardId => {
    const response = await fetch(`${sourceBaseUrl}/${cardId}.tcgplayer.json`);
    if (!response.ok) {
      return { cardId, history: null };
    }
    const payload = await response.json();
    return { cardId, history: payload.data?.[variant]?.history ?? null };
  })
);

const byMonth = new Map();
for (const { cardId, history } of cards) {
  if (!history) continue;
  for (const [date, point] of Object.entries(history)) {
    if (!Number.isFinite(point?.avg)) continue;
    const month = date.slice(0, 7);
    const monthEntries = byMonth.get(month) ?? new Map();
    const existing = monthEntries.get(cardId);
    if (!existing || date > existing.date) {
      monthEntries.set(cardId, { date, priceUsd: point.avg / 100, count: point.count ?? null });
    }
    byMonth.set(month, monthEntries);
  }
}

const monthly = [...byMonth.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([month, entries]) => {
    const components = [...entries.entries()]
      .sort(([left], [right]) => left - right)
      .map(([cardId, point]) => ({
        providerCardId: `base1-${cardId}`,
        cardNumber: String(cardId),
        sourceObservedAt: point.date,
        marketPriceUsd: Number(point.priceUsd.toFixed(2)),
        saleCount: point.count,
      }));
    const weightedMarketValueUsd = components.reduce((total, component) => total + component.marketPriceUsd, 0) / components.length;
    const observedAt = components.reduce((latest, component) => (component.sourceObservedAt > latest ? component.sourceObservedAt : latest), month + "-01");
    return { month, observedAt, components, weightedMarketValueUsd };
  })
  .filter(point => point.components.length >= minimumComponents);

if (monthly.length < 2) {
  throw new Error("The archive did not produce enough monthly points for a chart.");
}

const baselineMarketValueUsd = monthly[0].weightedMarketValueUsd;
const statements = [
  "START TRANSACTION;",
  "DELETE snapshots FROM indexSnapshots AS snapshots INNER JOIN markets AS market ON market.id = snapshots.marketId WHERE market.slug = 'base-set' AND snapshots.dataProvider = 'tcgdex-price-history';",
];

const archiveEvidence = JSON.stringify({
  kind: "historical_archive_monthly_proxy",
  source: "TCGdex price-history repository",
  sourceUrl,
  sourceVariant: variant,
  excludedApprovedComponents: [`base1-${missingCardId}`],
  aggregation: "latest observed average price per available component in each calendar month; no interpolation",
  note: "Per-card source observations are available in the linked public repository; this record deliberately preserves source provenance without implying a continuous live 16-card series.",
});

for (const point of monthly) {
  const normalizedIndexValue = (point.weightedMarketValueUsd / baselineMarketValueUsd) * 1000;
  statements.push(
    "INSERT INTO indexSnapshots (marketId, indexIdentifier, indexValue, weightedMarketValueUsd, baselineMarketValueUsd, componentCount, componentData, dataProvider, calculationVersion, methodologyVersion, oracleUpdateStatus, oracleUpdatedAt, providerUpdatedAt, observedAt) " +
      "SELECT market.id, " +
      `${sqlString("base-set-historical-archive")}, ${sqlString(decimal(normalizedIndexValue))}, ${sqlString(decimal(point.weightedMarketValueUsd))}, ${sqlString(decimal(baselineMarketValueUsd))}, ${point.components.length}, ${sqlString(archiveEvidence)}, ${sqlString(sourceKey)}, ${sqlString("archive-monthly-v1")}, ${sqlString("archive-holo-good-15-card-v1")}, ${sqlString("historical_archive")}, NULL, NULL, ${sqlString(point.observedAt + " 00:00:00")} ` +
      "FROM markets AS market WHERE market.slug = 'base-set';"
  );
}
statements.push("COMMIT;");

const manifest = {
  sourceKey,
  sourceUrl,
  sourceVariant: variant,
  generatedAt: new Date().toISOString(),
  monthlyPointCount: monthly.length,
  range: { startsAt: monthly[0].observedAt, endsAt: monthly.at(-1).observedAt },
  excludedApprovedComponents: [`base1-${missingCardId}`],
  points: monthly.map(point => ({
    observedAt: point.observedAt,
    weightedMarketValueUsd: Number(point.weightedMarketValueUsd.toFixed(2)),
    normalizedAuditValue: Number(((point.weightedMarketValueUsd / baselineMarketValueUsd) * 1000).toFixed(2)),
    componentCount: point.components.length,
  })),
};

await writeFile("archive-history-import.sql", statements.join("\n") + "\n");
await writeFile("archive-history-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
