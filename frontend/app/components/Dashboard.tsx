"use client";

import { useMemo, useState } from "react";
import WordCloud from "./WordCloud";
import TrendChart from "./TrendChart";
import KeywordTrendChart from "./KeywordTrendChart";
import type { TrendSeries } from "../lib/trends.server";
import {
  isBreakout,
  keywordScore,
  METRIC_LABELS,
  type Metric,
  type ZScoreDataset,
} from "../lib/zscore";

const CATEGORY_ORDER = [
  "active_etf",
  "bond_etf",
  "market_cap_etf",
  "sector_etf",
  "high_dividend_etf",
];

const TABLE_TOP_N = 12;

export default function Dashboard({
  dataset,
  trends,
}: {
  dataset: ZScoreDataset;
  trends: TrendSeries;
}) {
  const categories = useMemo(
    () =>
      [...dataset.categories].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug)
      ),
    [dataset]
  );

  const [selectedSlug, setSelectedSlug] = useState(categories[0]?.slug ?? "");
  const [metric, setMetric] = useState<Metric>("recent_z");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const selected = categories.find((c) => c.slug === selectedSlug) ?? categories[0];

  const selectCategory = (slug: string) => {
    setSelectedSlug(slug);
    setSelectedKeyword(null);
  };

  const ranked = useMemo(() => {
    if (!selected) return [];
    const sorted = [...selected.keywords].sort(
      (a, b) => keywordScore(b, metric) - keywordScore(a, metric)
    );
    if (!selectedKeyword) return sorted.slice(0, TABLE_TOP_N);

    const idx = sorted.findIndex((k) => k.keyword === selectedKeyword);
    if (idx === -1 || idx < TABLE_TOP_N) return sorted.slice(0, TABLE_TOP_N);
    // selected keyword ranks outside the visible window — pull it into view
    return [...sorted.slice(0, TABLE_TOP_N - 1), sorted[idx]];
  }, [selected, metric, selectedKeyword]);

  return (
    <div
      className="min-h-screen bg-emerald-50"
      onClick={() => setSelectedKeyword(null)}
    >
      <header className="flex w-full items-center gap-3 border-b border-emerald-100 bg-white px-10 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-600 text-2xl font-bold text-white">
          CIP
        </div>
        <div>
          <h1 className="text-4xl font-bold text-emerald-950">CIP 小樹洞</h1>
          <p className="text-xl text-emerald-700">收集市場說出的心裡話</p>
        </div>
      </header>

      <main className="flex w-full flex-col gap-6 px-8 py-8">
        <section className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => selectCategory(c.slug)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                c.slug === selectedSlug
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100"
              }`}
            >
              {c.label}
            </button>
          ))}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-emerald-950">
              {selected?.label} · 關鍵字文字雲
            </h2>
            <div className="flex gap-1 rounded-full bg-emerald-50 p-1">
              {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMetric(m);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    metric === m
                      ? "bg-emerald-600 text-white"
                      : "text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {METRIC_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          {selected && (
            <WordCloud
              words={selected.keywords}
              metric={metric}
              selectedKeyword={selectedKeyword}
              onSelect={setSelectedKeyword}
            />
          )}
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
            <div className="shrink-0 border-b border-emerald-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-emerald-950">
                {selected?.label} · 熱門關鍵字排行
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-emerald-100 bg-emerald-50 text-emerald-800">
                    <th className="px-4 py-2.5 font-medium">關鍵字</th>
                    <th className="px-4 py-2.5 font-medium">歷史平均</th>
                    <th className="px-4 py-2.5 font-medium">近期平均</th>
                    <th className="px-4 py-2.5 font-medium">Z-score</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => {
                    const breakout = isBreakout(row, metric);
                    const meanField = metric === "z_2026" ? row.mean_2026 : row.recent_3m_mean;
                    const zField = metric === "z_2026" ? row.z_2026 : row.recent_z;
                    const isSelected = row.keyword === selectedKeyword;
                    return (
                      <tr
                        key={row.keyword}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedKeyword(row.keyword);
                        }}
                        className={`cursor-pointer border-b border-emerald-50 last:border-0 ${
                          isSelected ? "bg-emerald-100" : "hover:bg-emerald-50"
                        }`}
                      >
                        <td className="px-4 py-2 font-medium text-emerald-950">{row.keyword}</td>
                        <td className="px-4 py-2 text-emerald-700">
                          {row.historical_mean ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-emerald-700">{meanField ?? "-"}</td>
                        <td className="px-4 py-2 font-medium">
                          {breakout ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                              全新熱門
                            </span>
                          ) : (
                            <span className={zField && zField > 0 ? "text-emerald-700" : "text-zinc-500"}>
                              {zField?.toFixed(2) ?? "-"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-emerald-950">
                {selectedKeyword
                  ? `「${selectedKeyword}」週趨勢`
                  : `五大分類熱度趨勢（週平均，${selected?.label}為高亮）`}
              </h2>
              {selectedKeyword && (
                <button
                  onClick={() => setSelectedKeyword(null)}
                  className="text-xs font-medium text-emerald-600 hover:underline"
                >
                  ← 返回分類比較
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1">
              {selectedKeyword ? (
                <KeywordTrendChart categorySlug={selectedSlug} keyword={selectedKeyword} />
              ) : (
                <TrendChart trends={trends} selectedSlug={selectedSlug} />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
