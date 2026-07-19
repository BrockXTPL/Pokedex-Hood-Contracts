import React from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type BasketHistoryPoint = {
  weightedMarketValueUsd: string | number;
  pricedSubtotalUsd?: string | number | null;
  observedAt: Date | string;
  componentCount: number;
  dataProvider?: string;
};

type IndexChartProps = {
  archivePoints: BasketHistoryPoint[];
  livePoints: BasketHistoryPoint[];
};

type ChartDatum = {
  time: number;
  label: string;
  archiveValue?: number;
  liveValue?: number;
  transitionValue?: number;
  sourceLabel: string;
  componentCount: number;
};

type HistoryTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: ChartDatum; dataKey?: string }>;
};

const usd = (value: number, fractionDigits = 2) => new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: fractionDigits,
  maximumFractionDigits: fractionDigits,
}).format(value);

const tooltipDate = (value: Date | string) => new Date(value).toLocaleDateString(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const pricedSubtotal = (point: BasketHistoryPoint) => {
  const suppliedSubtotal = Number(point.pricedSubtotalUsd);
  if (Number.isFinite(suppliedSubtotal) && suppliedSubtotal > 0) return suppliedSubtotal;

  const averageUsd = Number(point.weightedMarketValueUsd);
  const componentCount = Number(point.componentCount);
  if (!Number.isFinite(averageUsd) || !Number.isFinite(componentCount) || componentCount <= 0) return Number.NaN;
  return averageUsd * componentCount;
};

function HistoryTooltip({ active, payload }: HistoryTooltipProps) {
  if (!active || !payload?.length) return null;
  const selected = payload.find(entry => entry.dataKey !== "transitionValue" && typeof entry.value === "number") ?? payload[0];
  const point = selected.payload;
  const value = selected.value;
  if (!point || typeof value !== "number") return null;

  if (selected.dataKey === "transitionValue") {
    return (
      <div className="min-w-48 rounded-xl border border-white/15 bg-[#12192f]/95 px-3.5 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.36)]">
        <p className="text-xs font-medium text-white/88">Source transition</p>
        <p className="mt-1.5 text-[11px] leading-4 text-white/52">Visual bridge only — not a market-price observation.</p>
      </div>
    );
  }

  return (
    <div className="min-w-48 rounded-xl border border-white/15 bg-[#12192f]/95 px-3.5 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.36)]">
      <p className="text-xs font-medium text-white/88">{point.label}</p>
      <p className="display-font mt-1 text-base font-semibold text-white">{usd(value)}</p>
      <p className="mt-1.5 text-[11px] leading-4 text-white/52">{point.sourceLabel}</p>
      <p className="mt-0.5 text-[11px] text-white/40">{point.componentCount}-card priced subtotal</p>
    </div>
  );
}

export function IndexChart({ archivePoints, livePoints }: IndexChartProps) {
  const archiveData: ChartDatum[] = archivePoints
    .map(point => ({
      time: new Date(point.observedAt).getTime(),
      label: tooltipDate(point.observedAt),
      archiveValue: pricedSubtotal(point),
      sourceLabel: "Historical archive · TCGdex price history",
      componentCount: point.componentCount,
    }))
    .filter(point => Number.isFinite(point.time) && Number.isFinite(point.archiveValue));

  const liveData: ChartDatum[] = livePoints
    .map(point => ({
      time: new Date(point.observedAt).getTime(),
      label: tooltipDate(point.observedAt),
      liveValue: pricedSubtotal(point),
      sourceLabel: "Current observation · TCGdex / TCGplayer",
      componentCount: point.componentCount,
    }))
    .filter(point => Number.isFinite(point.time) && Number.isFinite(point.liveValue));

  const archiveEnd = archiveData.at(-1);
  const liveStart = liveData[0];
  const data = [...archiveData, ...liveData]
    .sort((left, right) => left.time - right.time)
    .map(point => ({
      ...point,
      transitionValue: point.time === archiveEnd?.time
        ? archiveEnd.archiveValue
        : point.time === liveStart?.time
          ? liveStart.liveValue
          : undefined,
    }));
  const values = data.flatMap(point => [point.archiveValue, point.liveValue]).filter((value): value is number => Number.isFinite(value));

  if (data.length < 2 || values.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
        <div>
          <p className="display-font text-sm font-semibold text-white/80">Building the USD price history</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/45">
            The chart will appear after at least two verified historical or live priced-card subtotals are available.
          </p>
        </div>
      </div>
    );
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const buffer = Math.max((maximum - minimum) * 0.16, Math.max(maximum * 0.08, 3));

  return (
    <div role="region" aria-label="Base Set historical USD priced-card subtotal chart">
      <p role="status" className="sr-only">
        One USD subtotal chart with {archiveData.length} historical archive observations and {liveData.length} current TCGdex observations. A dashed connector marks the source transition and is not a market-price observation.
      </p>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/50">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" /> Historical archive · TCGdex price history</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300" /> Current observations · TCGdex / TCGplayer</span>
        <span className="inline-flex items-center gap-2"><span className="w-4 border-t border-dashed border-slate-400" /> Source transition · visual guide</span>
      </div>
      <div data-testid="usd-history-chart" className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 14, right: 6, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="archiveUsdAreaGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ecc95c" stopOpacity={0.30} />
                <stop offset="100%" stopColor="#ecc95c" stopOpacity={0.015} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              minTickGap={58}
              tickFormatter={time => new Date(Number(time)).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
              tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[Math.max(0, minimum - buffer), maximum + buffer]}
              tickFormatter={value => usd(Number(value), 0)}
              tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }}
              width={60}
            />
            <Tooltip cursor={{ stroke: "rgba(236,201,92,0.32)", strokeWidth: 1 }} content={<HistoryTooltip />} />
            {archiveEnd && liveData.length > 0 && (
              <ReferenceLine
                x={archiveEnd.time}
                stroke="rgba(236,201,92,0.48)"
                strokeDasharray="4 4"
                label={{ value: "Archive ends", position: "insideTopRight", fill: "rgba(255,255,255,0.42)", fontSize: 10 }}
              />
            )}
            <Area
              type="linear"
              dataKey="archiveValue"
              stroke="#ecc95c"
              strokeWidth={2.25}
              fill="url(#archiveUsdAreaGradient)"
              connectNulls={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#f7dd83" }}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="transitionValue"
              stroke="#94a3b8"
              strokeWidth={1.75}
              strokeDasharray="4 5"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="liveValue"
              stroke="#67e8f9"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={{ r: 3, strokeWidth: 0, fill: "#a5f3fc" }}
              activeDot={{ r: 4.5, strokeWidth: 0, fill: "#cffafe" }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
