"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendSeries } from "../lib/trends.server";

function formatTick(date: string) {
  return date.slice(0, 7); // YYYY-MM
}

export default function TrendChart({
  trends,
  selectedSlug,
}: {
  trends: TrendSeries;
  selectedSlug: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trends.rows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          interval={25}
          tick={{ fontSize: 14, fill: "#065f46" }}
        />
        <YAxis tick={{ fontSize: 14, fill: "#065f46" }} width={44} />
        <Tooltip
          labelFormatter={(label) => `週次：${label}`}
          formatter={(value, slug) => {
            const label =
              trends.categories.find((c) => c.slug === String(slug))?.label ?? String(slug);
            return [value, label] as [typeof value, string];
          }}
          contentStyle={{ fontSize: 14 }}
          labelStyle={{ fontSize: 14 }}
        />
        {[...trends.categories]
          .sort((a, b) => Number(a.slug === selectedSlug) - Number(b.slug === selectedSlug))
          .map((c) => {
            const active = c.slug === selectedSlug;
            return (
              <Line
                key={c.slug}
                dataKey={c.slug}
                name={c.label}
                dot={false}
                connectNulls
                stroke={active ? "#059669" : "#d4d4d8"}
                strokeWidth={active ? 3.5 : 1.5}
                isAnimationActive={false}
              />
            );
          })}
      </LineChart>
    </ResponsiveContainer>
  );
}
