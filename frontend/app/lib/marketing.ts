import dataset from "@/public/data/zscore.json";
import { isBreakout, keywordScore, type Metric, type ZScoreDataset } from "./zscore";

const zscore = dataset as ZScoreDataset;

// Heuristics only — there's no real search-intent classifier behind this,
// just pattern matching on the keyword text itself.
const PRODUCT_CODE = /^\d{4,6}[A-Z]?/;
const BUY_INTENT = /怎麼買|定期定額|開戶|券商|申購/;
const COMPARE_INTENT = /比較|排名|績效|費用|殖利率|填息|配息|好嗎/;

export type Stage = "explore" | "find" | "compare" | "buy";

export const STAGE_LABELS: Record<Stage, string> = {
  explore: "探索主題",
  find: "尋找標的",
  compare: "比較商品",
  buy: "購買／通路",
};

export function classifyStage(keyword: string): Stage {
  if (BUY_INTENT.test(keyword)) return "buy";
  if (COMPARE_INTENT.test(keyword)) return "compare";
  if (PRODUCT_CODE.test(keyword)) return "find";
  return "explore";
}

export function isProductCode(keyword: string): boolean {
  return PRODUCT_CODE.test(keyword);
}

type FlatKeyword = {
  keyword: string;
  category: string;
  categoryLabel: string;
  historical_mean: number | null;
  mean_2026: number | null;
  recent_3m_mean: number | null;
  z_2026: number | null;
  z_2026_breakout: boolean;
  recent_z: number | null;
  recent_z_breakout: boolean;
};

export function flattenKeywords(): FlatKeyword[] {
  return zscore.categories.flatMap((c) => c.keywords.map((k) => ({ ...k, category: c.slug, categoryLabel: c.label })));
}

export type Opportunity = {
  keyword: string;
  category: string;
  categoryLabel: string;
  score: number;
  breakout: boolean;
};

export function topOpportunities(metric: Metric = "recent_z", limit = 8): Opportunity[] {
  return flattenKeywords()
    .map((k) => ({
      keyword: k.keyword,
      category: k.category,
      categoryLabel: k.categoryLabel,
      score: keywordScore(k, metric),
      breakout: isBreakout(k, metric),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type CategoryHeat = { slug: string; label: string; avgScore: number; topKeyword: string };

// Ranks categories by the average score of each category's 5 hottest keywords
// (using the top few instead of a flat average keeps one huge outlier from
// swamping a category that's mostly quiet).
export function categoryHeatRanking(metric: Metric = "recent_z"): CategoryHeat[] {
  return zscore.categories
    .map((c) => {
      const scored = c.keywords
        .map((k) => ({ keyword: k.keyword, score: keywordScore(k, metric) }))
        .sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 5);
      const avgScore = top.length ? top.reduce((s, x) => s + x.score, 0) / top.length : 0;
      return { slug: c.slug, label: c.label, avgScore: Math.round(avgScore * 100) / 100, topKeyword: scored[0]?.keyword ?? "—" };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

export type OpportunityKpis = {
  topProduct: Opportunity | null;
  topTheme: CategoryHeat | null;
  contentGap: Opportunity | null;
  coolingSignal: CategoryHeat | null;
};

export function getOpportunityKpis(metric: Metric = "recent_z"): OpportunityKpis {
  const pool = topOpportunities(metric, 60);
  const topProduct = pool.find((o) => isProductCode(o.keyword)) ?? pool[0] ?? null;
  const contentGap = pool.find((o) => COMPARE_INTENT.test(o.keyword) && !isProductCode(o.keyword)) ?? null;
  const ranking = categoryHeatRanking(metric);
  return {
    topProduct,
    topTheme: ranking[0] ?? null,
    contentGap,
    coolingSignal: ranking[ranking.length - 1] ?? null,
  };
}

// Weighted by recent_3m_mean (a proxy for how much real search volume sits
// behind a keyword) rather than a plain headcount of matching keywords.
export function intentDistribution(): Record<Stage, number> {
  const weights: Record<Stage, number> = { explore: 0, find: 0, compare: 0, buy: 0 };
  let total = 0;
  for (const k of flattenKeywords()) {
    const w = k.recent_3m_mean ?? 0;
    if (w <= 0) continue;
    weights[classifyStage(k.keyword)] += w;
    total += w;
  }
  if (total === 0) return weights;
  (Object.keys(weights) as Stage[]).forEach((s) => {
    weights[s] = Math.round((weights[s] / total) * 1000) / 10;
  });
  return weights;
}

export type JourneyStage = { stage: Stage; label: string; score: number; sample: string; count: number };

export function journeyForCategory(slug: string, metric: Metric = "recent_z"): JourneyStage[] {
  const stages: Stage[] = ["explore", "find", "compare", "buy"];
  const category = zscore.categories.find((c) => c.slug === slug);
  if (!category) return stages.map((s) => ({ stage: s, label: STAGE_LABELS[s], score: 0, sample: "—", count: 0 }));

  return stages.map((stage) => {
    const matched = category.keywords
      .filter((k) => classifyStage(k.keyword) === stage)
      .map((k) => ({ keyword: k.keyword, score: keywordScore(k, metric) }))
      .sort((a, b) => b.score - a.score);
    const avg = matched.length ? matched.reduce((s, x) => s + x.score, 0) / matched.length : 0;
    return {
      stage,
      label: STAGE_LABELS[stage],
      score: Math.round(avg * 100) / 100,
      sample: matched[0]?.keyword ?? "—",
      count: matched.length,
    };
  });
}

export function journeyDiagnosis(stages: JourneyStage[]): string {
  const withSamples = stages.filter((s) => s.count > 0);
  if (withSamples.length < 2) {
    return "此分類的關鍵字樣本數不足，暫時無法判斷斷點；建議擴充關鍵字清單後再觀察。";
  }
  const sorted = [...withSamples].sort((a, b) => b.score - a.score);
  const leader = sorted[0];
  const laggard = sorted[sorted.length - 1];
  return `目前「${leader.label}」熱度最高（代表詞：${leader.sample}），「${laggard.label}」相對最弱（代表詞：${laggard.sample}）。可優先檢視「${leader.label} → ${laggard.label}」之間是否出現斷點，並針對性補強對應內容。`;
}

export type MatrixPoint = {
  keyword: string;
  category: string;
  categoryLabel: string;
  heat: number;
  momentum: number;
  breakout: boolean;
};

export function matrixPoints(metric: Metric = "recent_z", limit = 24): MatrixPoint[] {
  return flattenKeywords()
    .map((k) => ({
      keyword: k.keyword,
      category: k.category,
      categoryLabel: k.categoryLabel,
      heat: (metric === "z_2026" ? k.mean_2026 : k.recent_3m_mean) ?? 0,
      momentum: keywordScore(k, metric),
      breakout: isBreakout(k, metric),
    }))
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, limit);
}
