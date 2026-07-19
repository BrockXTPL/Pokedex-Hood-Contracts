const endpoint = new URL("http://localhost:3000/api/trpc/market.detail");
endpoint.searchParams.set("input", JSON.stringify({ json: { slug: "base-set" } }));

const response = await fetch(endpoint);
if (!response.ok) throw new Error(`Market detail request failed: ${response.status}`);
const envelope = await response.json();
const detail = envelope.result?.data?.json ?? envelope.result?.data;
if (!detail?.latestSnapshot) throw new Error("The Base Set detail response did not include a latest snapshot.");

let componentData;
try {
  componentData = JSON.parse(detail.latestSnapshot.componentData);
} catch {
  componentData = detail.latestSnapshot.componentData;
}

const report = {
  latestSnapshot: {
    id: detail.latestSnapshot.id,
    weightedMarketValueUsd: detail.latestSnapshot.weightedMarketValueUsd,
    componentCount: detail.latestSnapshot.componentCount,
    dataProvider: detail.latestSnapshot.dataProvider,
    calculationVersion: detail.latestSnapshot.calculationVersion,
    observedAt: detail.latestSnapshot.observedAt,
  },
  components: detail.components,
  componentData,
};

console.log(JSON.stringify(report, null, 2));
