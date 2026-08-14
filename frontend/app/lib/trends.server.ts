import { readFile } from "node:fs/promises";
import path from "node:path";

type RawTrends = Record<
  string,
  {
    label: string;
    keywords: Record<string, { date: string; value: number | null }[]>;
  }
>;

export type TrendSeries = {
  categories: { slug: string; label: string }[];
  // each row: { date, [categorySlug]: weekly average value | null }
  rows: Array<Record<string, string | number | null>>;
};

export type KeywordSeries = {
  keyword: string;
  points: { date: string; value: number | null }[];
};

// trends.json is ~5MB — read once per server process and reuse across
// requests instead of re-parsing it on every call.
let rawTrendsCache: Promise<RawTrends> | null = null;

function loadRawTrends(): Promise<RawTrends> {
  if (!rawTrendsCache) {
    const filePath = path.join(process.cwd(), "public", "data", "trends.json");
    rawTrendsCache = readFile(filePath, "utf-8").then((raw) => JSON.parse(raw) as RawTrends);
  }
  return rawTrendsCache;
}

// Aggregates the per-keyword weekly CSVs (backend/raw/*.csv, parsed into
// trends.json by build_dataset.py) into one weekly-average series per
// category, so the frontend can chart overall category heat over time
// without shipping the full multi-megabyte per-keyword file to the client.
export async function loadCategoryTrends(): Promise<TrendSeries> {
  const data = await loadRawTrends();

  const categories = Object.entries(data).map(([slug, cat]) => ({
    slug,
    label: cat.label,
  }));

  const perCategoryAverages: Record<string, Map<string, number>> = {};
  const allDates = new Set<string>();

  for (const [slug, cat] of Object.entries(data)) {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const points of Object.values(cat.keywords)) {
      for (const { date, value } of points) {
        if (value == null) continue;
        const entry = totals.get(date) ?? { sum: 0, count: 0 };
        entry.sum += value;
        entry.count += 1;
        totals.set(date, entry);
        allDates.add(date);
      }
    }
    perCategoryAverages[slug] = new Map(
      [...totals.entries()].map(([date, { sum, count }]) => [
        date,
        Math.round((sum / count) * 100) / 100,
      ])
    );
  }

  const sortedDates = [...allDates].sort();
  const rows = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const { slug } of categories) {
      row[slug] = perCategoryAverages[slug].get(date) ?? null;
    }
    return row;
  });

  return { categories, rows };
}

// The z-score keyword list (backend/raw/z_score/*.xlsx) and the weekly CSV
// export (backend/raw/*.csv) aren't guaranteed to contain the same terms —
// returns null when this category/keyword pair has no weekly series.
export async function getKeywordSeries(
  slug: string,
  keyword: string
): Promise<KeywordSeries | null> {
  const data = await loadRawTrends();
  const points = data[slug]?.keywords[keyword];
  if (!points) return null;
  return { keyword, points };
}
