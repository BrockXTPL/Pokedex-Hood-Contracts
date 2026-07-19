const ids = Array.from({ length: 16 }, (_, index) => index + 1);
const baseUrl = "https://raw.githubusercontent.com/tcgdex/price-history/master/en/base1";

const summaries = await Promise.all(
  ids.map(async id => {
    const response = await fetch(`${baseUrl}/${id}.tcgplayer.json`);
    if (!response.ok) return { id, status: response.status, variants: [] };

    const payload = await response.json();
    const variants = Object.entries(payload.data ?? {}).map(([variant, entry]) => {
      const history = entry?.history ?? {};
      const dates = Object.keys(history).sort();
      return {
        variant,
        points: dates.length,
        startsAt: dates[0] ?? null,
        endsAt: dates.at(-1) ?? null,
      };
    });

    return { id, status: response.status, variants };
  })
);

console.log(JSON.stringify(summaries, null, 2));
