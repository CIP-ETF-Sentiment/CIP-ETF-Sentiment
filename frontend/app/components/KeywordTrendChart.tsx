"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KeywordSeries } from "../lib/trends.server";

function formatTick(date: string) {
  return date.slice(0, 7);
}

export default function KeywordTrendChart({
  categorySlug,
  keyword,
}: {
  categorySlug: string;
  keyword: string;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; series: KeywordSeries }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/keyword-trend?category=${encodeURIComponent(categorySlug)}&keyword=${encodeURIComponent(keyword)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setState({ status: "error", message: body?.error ?? "載入失敗" });
          return;
        }
        const series = (await res.json()) as KeywordSeries;
        setState({ status: "ready", series });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "載入失敗" });
      });

    return () => {
      cancelled = true;
    };
  }, [categorySlug, keyword]);

  if (state.status === "loading") {
    return (
      <p className="flex h-full items-center justify-center text-sm text-emerald-700">
        載入中…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p className="flex h-full items-center justify-center text-sm text-zinc-500">
        {state.message}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={state.series.points}
        margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
      >
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
          formatter={(value) => [value, keyword] as [typeof value, string]}
          contentStyle={{ fontSize: 14 }}
          labelStyle={{ fontSize: 14 }}
        />
        <Line
          dataKey="value"
          name={keyword}
          dot={false}
          connectNulls
          stroke="#059669"
          strokeWidth={3}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
