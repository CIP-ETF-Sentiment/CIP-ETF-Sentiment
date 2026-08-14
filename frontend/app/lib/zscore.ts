export type KeywordStat = {
  keyword: string;
  historical_mean: number | null;
  mean_2026: number | null;
  recent_3m_mean: number | null;
  z_2026: number | null;
  z_2026_breakout: boolean;
  recent_z: number | null;
  recent_z_breakout: boolean;
};

export type Category = {
  slug: string;
  label: string;
  keywords: KeywordStat[];
};

export type ZScoreDataset = {
  categories: Category[];
};

export type Metric = "recent_z" | "z_2026";

export const METRIC_LABELS: Record<Metric, string> = {
  recent_z: "近 3 個月熱度",
  z_2026: "全年熱度",
};

// Breakout keywords (no historical baseline, i.e. raw Z was infinite) rank
// above every finite Z-score. The tie-break keeps them ordered by how much
// search volume they actually carry (Google Trends values run 0-100).
const BREAKOUT_BASE = 10;

export function keywordScore(stat: KeywordStat, metric: Metric): number {
  const isBreakout = metric === "z_2026" ? stat.z_2026_breakout : stat.recent_z_breakout;
  if (isBreakout) {
    const mean = (metric === "z_2026" ? stat.mean_2026 : stat.recent_3m_mean) ?? 0;
    return BREAKOUT_BASE + mean / 100;
  }
  return (metric === "z_2026" ? stat.z_2026 : stat.recent_z) ?? 0;
}

export function isBreakout(stat: KeywordStat, metric: Metric): boolean {
  return metric === "z_2026" ? stat.z_2026_breakout : stat.recent_z_breakout;
}
