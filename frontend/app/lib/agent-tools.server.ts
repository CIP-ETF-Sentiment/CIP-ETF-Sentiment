import { Type, type FunctionDeclaration } from "@google/genai";
import { getKeywordSeries } from "./trends.server";
import { keywordScore, isBreakout, type Metric, type ZScoreDataset } from "./zscore";
import dataset from "@/public/data/zscore.json";

const zscore = dataset as ZScoreDataset;

const RECENT_WEEKS = 26;

// Function-tool declarations for the classic chats.create()/generateContent
// function-calling interface (client.chats.create({ config: { tools: [...] } })).
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "list_categories",
    description: "列出所有 ETF 分類（例如主動式ETF、債券型ETF等）及其代碼(slug)。",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_top_keywords",
    description:
      "取得某個 ETF 分類中，依熱度 Z-score 排序的熱門關鍵字清單。可用來回答「哪個關鍵字最近很熱門」之類的問題。",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: "分類代碼(slug)，例如 active_etf、bond_etf、market_cap_etf、sector_etf、high_dividend_etf",
        },
        metric: {
          type: Type.STRING,
          enum: ["recent_z", "z_2026"],
          description: "recent_z=近3個月熱度（預設）；z_2026=全年熱度",
        },
        limit: { type: Type.NUMBER, description: "回傳筆數，預設 10" },
      },
      required: ["category"],
    },
  },
  {
    name: "get_keyword_trend",
    description: "取得某個關鍵字最近的 Google Trends 週搜尋熱度趨勢（最近約半年）。",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "分類代碼(slug)" },
        keyword: { type: Type.STRING, description: "確切的關鍵字文字" },
      },
      required: ["category", "keyword"],
    },
  },
  {
    name: "search_keyword",
    description: "跨所有分類搜尋包含指定文字的關鍵字，找不到確切分類時可以先用這個。",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "要搜尋的關鍵字片段" },
      },
      required: ["query"],
    },
  },
];

function round(n: number | null, digits = 2): number | null {
  if (n == null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_categories":
      return zscore.categories.map((c) => ({ slug: c.slug, label: c.label }));

    case "get_top_keywords": {
      const category = String(args.category ?? "");
      const metric = (args.metric as Metric) ?? "recent_z";
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const cat = zscore.categories.find((c) => c.slug === category);
      if (!cat) return { error: `找不到分類 "${category}"，請用 list_categories 確認代碼` };

      return [...cat.keywords]
        .sort((a, b) => keywordScore(b, metric) - keywordScore(a, metric))
        .slice(0, limit)
        .map((k) => ({
          keyword: k.keyword,
          historical_mean: round(k.historical_mean),
          recent_3m_mean: round(k.recent_3m_mean),
          mean_2026: round(k.mean_2026),
          z_score: isBreakout(k, metric) ? "breakout(無歷史基準，全新熱門詞)" : round(keywordScore(k, metric)),
        }));
    }

    case "get_keyword_trend": {
      const category = String(args.category ?? "");
      const keyword = String(args.keyword ?? "");
      const series = await getKeywordSeries(category, keyword);
      if (!series) return { error: `找不到 "${keyword}" 在分類 "${category}" 的週趨勢資料` };
      return { keyword, recent_weeks: series.points.slice(-RECENT_WEEKS) };
    }

    case "search_keyword": {
      const query = String(args.query ?? "").toLowerCase();
      const matches = zscore.categories.flatMap((c) =>
        c.keywords
          .filter((k) => k.keyword.toLowerCase().includes(query))
          .map((k) => ({
            category: c.slug,
            category_label: c.label,
            keyword: k.keyword,
            recent_z: isBreakout(k, "recent_z") ? "breakout" : round(k.recent_z),
          }))
      );
      return matches.slice(0, 20);
    }

    default:
      return { error: `未知的工具: ${name}` };
  }
}
