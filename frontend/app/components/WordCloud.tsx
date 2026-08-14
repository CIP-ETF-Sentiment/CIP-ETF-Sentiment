"use client";

import { isBreakout, keywordScore, type KeywordStat, type Metric } from "../lib/zscore";

const MIN_SIZE = 14;
const MAX_SIZE = 54;

// Deterministic per-word "jitter" so the cloud looks hand-placed but never
// mismatches between server and client render (no Math.random()).
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function lerpColor(from: [number, number, number], to: [number, number, number], t: number) {
  const [r1, g1, b1] = from;
  const [r2, g2, b2] = to;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// Cooling keywords (score <= 0) fade to neutral gray; hot keywords ramp
// from light to deep green — keeps the palette strictly white/green.
function colorFor(norm: number, cooling: boolean) {
  if (cooling) {
    return lerpColor([161, 161, 170], [212, 212, 216], norm);
  }
  return lerpColor([134, 239, 172], [21, 94, 61], norm);
}

export default function WordCloud({
  words,
  metric,
  selectedKeyword,
  onSelect,
}: {
  words: KeywordStat[];
  metric: Metric;
  selectedKeyword: string | null;
  onSelect: (keyword: string) => void;
}) {
  if (words.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">此分類尚無資料</p>
    );
  }

  const scored = words.map((w) => ({
    stat: w,
    score: keywordScore(w, metric),
    breakout: isBreakout(w, metric),
  }));

  const scores = scored.map((s) => s.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  scored.sort((a, b) => b.score - a.score);

  return (
    <div className="flex min-h-[420px] flex-wrap content-center items-center justify-center gap-x-4 gap-y-2 px-4 py-10">
      {scored.map(({ stat, score, breakout }) => {
        const norm = (score - min) / range;
        const size = MIN_SIZE + Math.pow(Math.max(norm, 0), 0.6) * (MAX_SIZE - MIN_SIZE);
        const cooling = score <= 0 && !breakout;
        const hash = hashString(stat.keyword);
        const rotate = ((hash % 9) - 4) * 1.1; // -4.4deg .. 4.4deg
        const weight = norm > 0.55 ? 700 : norm > 0.25 ? 600 : 500;

        const tooltip = breakout
          ? `${stat.keyword} · 全新熱門詞（無歷史基準）`
          : `${stat.keyword} · Z-score ${score.toFixed(2)}`;
        const selected = stat.keyword === selectedKeyword;

        return (
          <button
            key={stat.keyword}
            type="button"
            title={tooltip}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(stat.keyword);
            }}
            className={`cursor-pointer leading-none transition-transform hover:scale-110 ${
              selected ? "rounded-md underline decoration-2 underline-offset-4" : ""
            }`}
            style={{
              fontSize: `${size}px`,
              fontWeight: weight,
              color: selected ? "#047857" : colorFor(Math.max(norm, 0), cooling),
              transform: `rotate(${rotate}deg)`,
            }}
          >
            {stat.keyword}
          </button>
        );
      })}
    </div>
  );
}
