import { cleanup, render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("recharts", () => {
  const ResponsiveContainer = ({ children }: { children?: ReactNode }) => <div data-recharts="container">{children}</div>;
  const ComposedChart = ({ children }: { children?: ReactNode }) => <svg data-recharts="chart">{children}</svg>;
  const Series = ({ dataKey }: { dataKey?: string }) => <g data-series={dataKey} />;
  const Empty = () => <g />;

  return {
    Area: Series,
    ComposedChart,
    Line: Series,
    ReferenceLine: Empty,
    ResponsiveContainer,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});

import { IndexChart } from "./IndexChart";

afterEach(cleanup);

describe("IndexChart", () => {
  it("renders archive and live USD subtotals in one responsive chart with a labelled source-transition connector", () => {
    render(
      <IndexChart
        archivePoints={[
          { weightedMarketValueUsd: "28.75", pricedSubtotalUsd: "431.25", observedAt: "2023-07-31T00:00:00.000Z", componentCount: 15 },
          { weightedMarketValueUsd: "46.87", pricedSubtotalUsd: "703.05", observedAt: "2024-07-31T00:00:00.000Z", componentCount: 15 },
        ]}
        livePoints={[
          { weightedMarketValueUsd: "118.55", pricedSubtotalUsd: "1778.24", observedAt: "2026-07-18T10:00:00.000Z", componentCount: 15 },
          { weightedMarketValueUsd: "119.10", pricedSubtotalUsd: "1786.50", observedAt: "2026-07-18T11:00:00.000Z", componentCount: 15 },
        ]}
      />,
    );

    const chartRegion = screen.getByRole("region", { name: "Base Set historical USD priced-card subtotal chart" });
    expect(chartRegion.textContent).toContain("Historical archive · TCGdex price history");
    expect(chartRegion.textContent).toContain("Current observations · TCGdex / TCGplayer");
    expect(chartRegion.textContent).toContain("Source transition · visual guide");
    expect(screen.getByRole("status").textContent).toContain("2 historical archive observations and 2 current TCGdex observations");
    expect(screen.getByRole("status").textContent).toContain("not a market-price observation");

    const chartSurface = screen.getByTestId("usd-history-chart");
    expect(chartSurface.className).toContain("h-64");
    expect(chartSurface.className).toContain("sm:h-72");
    expect(chartSurface.querySelector('[data-series="archiveValue"]')).not.toBeNull();
    expect(chartSurface.querySelector('[data-series="liveValue"]')).not.toBeNull();
    expect(chartSurface.querySelector('[data-series="transitionValue"]')).not.toBeNull();
  });

  it("keeps the chart hidden until there are at least two valid USD observations", () => {
    render(
      <IndexChart
        archivePoints={[]}
        livePoints={[{ weightedMarketValueUsd: "118.55", observedAt: "2026-07-18T10:00:00.000Z", componentCount: 16 }]}
      />,
    );

    expect(screen.getByText("Building the USD price history")).toBeTruthy();
    expect(screen.queryByTestId("usd-history-chart")).toBeNull();
  });
});
