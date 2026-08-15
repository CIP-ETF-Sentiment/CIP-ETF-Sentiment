"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeywordSeries, TrendSeries } from "@/app/lib/trends.server";
import {
  STAGE_LABELS,
  categoryHeatRanking,
  getOpportunityKpis,
  intentDistribution,
  journeyDiagnosis,
  journeyForCategory,
  matrixPoints,
  topOpportunities,
  type MatrixPoint,
} from "@/app/lib/marketing";
import { METRIC_LABELS, type Metric } from "@/app/lib/zscore";

const CATEGORY_ORDER = ["active_etf", "bond_etf", "market_cap_etf", "sector_etf", "high_dividend_etf"];
const CATEGORY_LABELS: Record<string, string> = {
  active_etf: "主動式ETF",
  bond_etf: "債券型ETF",
  market_cap_etf: "市值型ETF",
  sector_etf: "產業型ETF",
  high_dividend_etf: "高股息ETF",
};
const CHANNELS = ["搜尋廣告 / SEO", "內容 / Threads", "影音 / Display", "再行銷", "品牌字 / SEO"];

const TABS = [
  { id: "mkt-opportunity", label: "1｜機會雷達" },
  { id: "mkt-journey", label: "2｜搜尋旅程" },
  { id: "mkt-keywords", label: "3｜關鍵字機會" },
  { id: "mkt-campaign", label: "4｜主推策略" },
  { id: "mkt-insight", label: "5｜行銷洞察" },
];

type DrawerState = { open: false } | { open: true; keyword: string; category: string; tag: string };

function latestValue(trends: TrendSeries | null, slug: string): number | null {
  if (!trends) return null;
  for (let i = trends.rows.length - 1; i >= 0; i -= 1) {
    const v = trends.rows[i]?.[slug];
    if (typeof v === "number") return v;
  }
  return null;
}

function formatScore(score: number, breakout: boolean) {
  return breakout ? "全新熱門" : `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
}

function KeywordSpark({ series }: { series: KeywordSeries | null }) {
  if (!series) return <div className="spark" />;
  const points = series.points.slice(-40).filter((p) => typeof p.value === "number");
  const max = Math.max(1, ...points.map((p) => p.value ?? 0));
  return (
    <div className="spark">
      {points.map((p, i) => (
        <i key={i} style={{ height: `${Math.max(4, ((p.value ?? 0) / max) * 100)}%` }} title={`${p.date}: ${p.value}`} />
      ))}
    </div>
  );
}

export default function MarketingDeck({ onToast }: { onToast: (message: string) => void }) {
  const [metric, setMetric] = useState<Metric>("recent_z");
  const [journeyCategory, setJourneyCategory] = useState(CATEGORY_ORDER[0]);
  const [trends, setTrends] = useState<TrendSeries | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [drawerSeries, setDrawerSeries] = useState<KeywordSeries | null>(null);

  useEffect(() => {
    fetch("/api/category-trends")
      .then((r) => r.json())
      .then(setTrends)
      .catch(() => {});
  }, []);

  const kpis = useMemo(() => getOpportunityKpis(metric), [metric]);
  const ranked = useMemo(() => topOpportunities(metric, 6), [metric]);
  const themeRanking = useMemo(() => categoryHeatRanking(metric), [metric]);
  const journeyStages = useMemo(() => journeyForCategory(journeyCategory, metric), [journeyCategory, metric]);
  const diagnosis = useMemo(() => journeyDiagnosis(journeyStages), [journeyStages]);
  const intent = useMemo(() => intentDistribution(), []);
  const matrix = useMemo(() => matrixPoints(metric, 24), [metric]);

  const heatValues = matrix.map((p) => p.heat);
  const momentumValues = matrix.map((p) => p.momentum);
  const heatMax = Math.max(1, ...heatValues);
  const momentumMin = Math.min(0, ...momentumValues);
  const momentumMax = Math.max(1, ...momentumValues);

  function openDrawer(keyword: string, category: string, tag: string) {
    setDrawer({ open: true, keyword, category, tag });
    setDrawerSeries(null);
    fetch(`/api/keyword-trend?category=${encodeURIComponent(category)}&keyword=${encodeURIComponent(keyword)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDrawerSeries)
      .catch(() => setDrawerSeries(null));
  }
  function closeDrawer() {
    setDrawer({ open: false });
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const insights = useMemo(() => {
    const list: { icon: string; title: string; body: string; orange?: boolean; onClick: () => void }[] = [];
    if (kpis.topProduct) {
      const p = kpis.topProduct;
      list.push({
        icon: "1",
        title: `「${p.keyword}」搜尋動能快速升溫`,
        body: p.breakout
          ? "沒有歷史基準，屬於全新熱門詞；建議先加碼 Search，觀察是否為短期事件或會延續的長期趨勢。"
          : `${METRIC_LABELS[metric]} 分數 ${p.score.toFixed(2)}，建議優先加碼對應內容與搜尋廣告。`,
        onClick: () => openDrawer(p.keyword, p.category, "商品機會"),
      });
    }
    if (kpis.contentGap) {
      const g = kpis.contentGap;
      list.push({
        icon: "2",
        title: `「${g.keyword}」比較意圖明顯`,
        body: `屬於比較型關鍵字，${g.breakout ? "為全新熱門詞" : `分數 ${g.score.toFixed(2)}`}；若官網缺少對應比較頁，建議優先補 SEO Landing Page。`,
        orange: true,
        onClick: () => openDrawer(g.keyword, g.category, "內容機會"),
      });
    }
    if (kpis.topTheme) {
      const t = kpis.topTheme;
      list.push({
        icon: "3",
        title: `「${t.label}」是目前最強主題`,
        body: `代表詞「${t.topKeyword}」，前5大關鍵字平均分數 ${t.avgScore.toFixed(2)}；可從單品廣告延伸為主題型內容。`,
        onClick: () => scrollTo("mkt-journey"),
      });
    }
    if (kpis.coolingSignal) {
      const c = kpis.coolingSignal;
      list.push({
        icon: "4",
        title: `「${c.label}」熱度相對走弱`,
        body: `前5大關鍵字平均分數 ${c.avgScore.toFixed(2)}；建議降低非品牌字競價，保留高意圖字，等待訊號回升。`,
        orange: true,
        onClick: () => scrollTo("mkt-journey"),
      });
    }
    return list;
  }, [kpis, metric]);

  return (
    <div className="mkt-deck">
      <section className="hero">
        <div className="hero-head">
          <div>
            <div className="eyebrow">ETF 行銷決策中心</div>
            <h1>本週行銷決策總覽</h1>
            <div className="subtitle">
              將真實的 Google Trends 熱度資料轉成可執行的行銷決策：找機會、理解搜尋路徑、選關鍵字、安排主推，最後形成明確 Action。
            </div>
          </div>
          <div className="controls-row" style={{ marginTop: 0 }}>
            {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
              <button
                key={m}
                className={`tab ${metric === m ? "active" : ""}`}
                onClick={() => setMetric(m)}
                style={{ marginTop: 0 }}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className="tab" onClick={() => scrollTo(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid" id="mkt-opportunity">
        <article className="card orange-top">
          <div className="card-head">
            <div>
              <div className="eyebrow">機會雷達</div>
              <h2>本週最值得推廣</h2>
            </div>
            <span className="badge">Google Trends · Taiwan（真實資料）</span>
          </div>
          <div className="kpis">
            <div className="kpi emph">
              <div className="label">首選商品</div>
              <div className="value">{kpis.topProduct?.keyword ?? "—"}</div>
              <div className="delta">
                {kpis.topProduct ? `${kpis.topProduct.categoryLabel} · ${formatScore(kpis.topProduct.score, kpis.topProduct.breakout)}` : "—"}
              </div>
            </div>
            <div className="kpi">
              <div className="label">最強主題</div>
              <div className="value">{kpis.topTheme?.label ?? "—"}</div>
              <div className="delta">{kpis.topTheme ? `平均分數 ${kpis.topTheme.avgScore.toFixed(2)}` : "—"}</div>
            </div>
            <div className="kpi">
              <div className="label">內容缺口</div>
              <div className="value">{kpis.contentGap?.keyword ?? "—"}</div>
              <div className="delta">
                {kpis.contentGap ? formatScore(kpis.contentGap.score, kpis.contentGap.breakout) : "尚無明顯缺口"}
              </div>
            </div>
            <div className="kpi">
              <div className="label">降溫訊號</div>
              <div className="value">{kpis.coolingSignal?.label ?? "—"}</div>
              <div className={`delta ${(kpis.coolingSignal?.avgScore ?? 0) < 0 ? "down" : ""}`}>
                {kpis.coolingSignal ? `平均分數 ${kpis.coolingSignal.avgScore.toFixed(2)}` : "—"}
              </div>
            </div>
          </div>
          <div className="ranklist">
            {ranked.map((item, i) => (
              <div
                className="rankrow"
                key={item.keyword}
                onClick={() => openDrawer(item.keyword, item.category, "商品機會")}
              >
                <div className="rankno">{String(i + 1).padStart(2, "0")}</div>
                <div className="kw">
                  {item.keyword}
                  <small>{item.categoryLabel}</small>
                </div>
                <div className="meter">
                  <span
                    style={{
                      width: `${Math.max(6, Math.min(100, ((item.score - momentumMin) / (momentumMax - momentumMin || 1)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="z">{formatScore(item.score, item.breakout)}</div>
                <div className="arrow">↗</div>
              </div>
            ))}
          </div>
          <p className="note">排行與分數皆來自 zscore.json 真實資料（{METRIC_LABELS[metric]}），非示意數值。</p>
        </article>

        <aside className="card green-top">
          <div className="card-head">
            <div>
              <div className="eyebrow">行銷洞察</div>
              <h2>本週應立即處理</h2>
            </div>
            <span className="badge">行動優先</span>
          </div>
          <div className="insights">
            {insights.map((item) => (
              <div className={`insight ${item.orange ? "orange" : ""}`} key={item.title} onClick={item.onClick}>
                <div className="insight-icon">{item.icon}</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid" id="mkt-journey">
        <article className="card green-top">
          <div className="card-head">
            <div>
              <div className="eyebrow">搜尋旅程診斷</div>
              <h2>投資需求卡在哪一階段？</h2>
              <p className="note">
                依關鍵字文字（例如「怎麼買」「比較」「商品代號」）分類到探索／尋找標的／比較／購買四個階段，用各階段的真實熱度分數找出最可能的斷點。分類是關鍵字規則比對，非機器學習意圖分析。
              </p>
            </div>
            <span className="badge">階段診斷</span>
          </div>
          <div className="controls-row">
            <span className="theme-label">ETF 分類</span>
            <select
              className="selectbox"
              value={journeyCategory}
              onChange={(e) => setJourneyCategory(e.target.value)}
            >
              {CATEGORY_ORDER.map((slug) => (
                <option key={slug} value={slug}>
                  {CATEGORY_LABELS[slug]}
                </option>
              ))}
            </select>
          </div>
          <div className="funnel">
            {journeyStages.map((s, i) => (
              <div
                key={s.stage}
                className={`stage ${s.count === 0 ? "" : i === 0 ? "hot" : ""} ${s.score < 0 ? "warn" : ""}`}
                onClick={() => s.sample !== "—" && openDrawer(s.sample, journeyCategory, `搜尋旅程 · ${s.label}`)}
              >
                <div className="stage-name">
                  0{i + 1}｜{s.label}
                </div>
                <h3>{s.sample}</h3>
                <div className="idx">
                  {s.score.toFixed(2)} <small>{s.count} 個關鍵字</small>
                </div>
                <div className="leak">{s.count === 0 ? "此階段目前沒有匹配到關鍵字" : `代表詞熱度分數 ${s.score.toFixed(2)}`}</div>
              </div>
            ))}
          </div>
          <div className="diagnosis">{diagnosis}</div>

          <div className="intent-panel">
            <div className="intent-head">
              <div>
                <div className="eyebrow">需求意圖分布</div>
                <h3>目前市場主要在搜尋什麼？（全站真實資料）</h3>
              </div>
              <span className="badge">依搜尋量加權</span>
            </div>
            <div className="intent-bars">
              {(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map((stage) => (
                <div className="intent-row" key={stage}>
                  <span className="intent-name">{STAGE_LABELS[stage]}</span>
                  <div className="intent-track">
                    <i style={{ width: `${intent[stage]}%` }} />
                  </div>
                  <b>{intent[stage]}%</b>
                  <small>依「近期平均熱度」加權後的關鍵字佔比</small>
                </div>
              ))}
            </div>
            <p className="note">此區塊不使用年齡或性別資料，只用關鍵字文字分類搜尋意圖；正式規則可再與行銷團隊一起調整。</p>
          </div>
        </article>

        <aside className="card orange-top">
          <div className="card-head">
            <div>
              <div className="eyebrow">斷點判讀邏輯</div>
              <h2>如何判讀斷點</h2>
            </div>
            <span className="badge">判讀邏輯</span>
          </div>
          <div className="insights">
            <div className="insight">
              <div className="insight-icon">1</div>
              <div>
                <h3>主題熱、商品弱</h3>
                <p>代表市場有興趣，但沒有明顯 ETF 標的承接。優先提高商品可見度、主題頁與「推薦哪一檔」內容。</p>
              </div>
            </div>
            <div className="insight orange">
              <div className="insight-icon">2</div>
              <div>
                <h3>商品熱、比較更熱，但自家商品弱</h3>
                <p>可能是比較階段被競品攔截。應補競品比較、差異化利益點。</p>
              </div>
            </div>
            <div className="insight">
              <div className="insight-icon">3</div>
              <div>
                <h3>購買意圖熱、實際轉換弱</h3>
                <p>Google Trends 本身無法判斷下單卡點；若串 GA4 / 券商轉換漏斗，就能定位開戶或下單的 friction。</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid" id="mkt-keywords">
        <article className="card orange-top">
          <div className="card-head">
            <div>
              <div className="eyebrow">關鍵字機會矩陣</div>
              <h2>關鍵字機會象限</h2>
            </div>
            <span className="badge">熱度 × 動能（真實資料）</span>
          </div>
          <div className="matrix-wrap">
            <div className="matrix">
              <span className="axis-y">近期平均熱度 ↑</span>
              <span className="axis-x">{METRIC_LABELS[metric]} →</span>
              {matrix.map((p) => (
                <MatrixDot
                  key={p.keyword}
                  point={p}
                  heatMax={heatMax}
                  momentumMin={momentumMin}
                  momentumMax={momentumMax}
                  onClick={() => openDrawer(p.keyword, p.category, "關鍵字機會")}
                />
              ))}
            </div>
            <div className="matrix-detail">
              <span className="badge">說明</span>
              <h3>如何解讀</h3>
              <div className="detail-row">
                <span>X 軸</span>
                <b>{METRIC_LABELS[metric]}（動能）</b>
              </div>
              <div className="detail-row">
                <span>Y 軸</span>
                <b>近期平均搜尋熱度</b>
              </div>
              <div className="detail-row">
                <span>右上角</span>
                <b>高熱度 + 高動能，優先卡位</b>
              </div>
              <div className="detail-row">
                <span>點擊圓點</span>
                <b>可查看該關鍵字真實週趨勢</b>
              </div>
            </div>
          </div>
        </article>

        <aside className="card green-top">
          <div className="card-head">
            <div>
              <div className="eyebrow">關鍵字素材設計建議</div>
              <h2>素材文案應該說什麼</h2>
            </div>
            <span className="badge">由 intent 轉譯</span>
          </div>
          <div className="insights">
            <div className="insight">
              <div className="insight-icon">A</div>
              <div>
                <h3>比較型</h3>
                <p>關鍵字：比較、排名、績效、費用率 → 文案以「差異、優勢、適合誰」為核心。</p>
              </div>
            </div>
            <div className="insight orange">
              <div className="insight-icon">B</div>
              <div>
                <h3>購買型</h3>
                <p>關鍵字：怎麼買、定期定額、券商 → 文案降低操作門檻，CTA 要明確。</p>
              </div>
            </div>
            <div className="insight">
              <div className="insight-icon">C</div>
              <div>
                <h3>事件型</h3>
                <p>關鍵字：配息、降息、AI、行情 → 素材需要快製、時效強、可快速下線。</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="card orange-top" id="mkt-campaign" style={{ marginBottom: 26 }}>
        <div className="playbook-head">
          <div>
            <div className="eyebrow">下個月主推策略</div>
            <h2>下個月主推主題（全台，依真實熱度排序）</h2>
            <p className="note">依五大分類目前的真實熱度分數排序，作為主推順序的依據。地區細分（Google Trends 地區斷點）尚未串接，之後補上後這裡會再拆分各地區的主推順序。</p>
          </div>
        </div>

        <div className="theme-five">
          {themeRanking.map((t) => (
            <div className="theme-five-card" key={t.slug}>
              <span>{t.label.replace("ETF", "")}</span>
              <b>{(latestValue(trends, t.slug) ?? t.avgScore).toFixed(2)}</b>
              <small>代表詞：{t.topKeyword}</small>
            </div>
          ))}
        </div>

        <div className="gapbox" style={{ marginTop: 22 }}>
          <h4>地區熱度地圖 — 尚未串接</h4>
          <p className="check">
            <span className="miss">待補</span> Google Trends 地區斷點資料（pytrends 的 interest_by_region）目前還沒抓取，所以無法拆分各縣市的主推順序。抓回來後會在這裡補上互動地圖與地區排序。
          </p>
        </div>

        <div className="playbook">
          {themeRanking.map((t, i) => (
            <div className="week" key={t.slug} onClick={() => openDrawer(t.topKeyword, t.slug, "主推策略")}>
              <div className="week-top">
                <span className="wtag">第{i + 1}順位</span>
                <span className="date">全台</span>
              </div>
              <h3>{t.label}</h3>
              <div className="why">代表詞：{t.topKeyword}</div>
              <p>依真實熱度分數排序（{t.avgScore.toFixed(2)}），此順位越前面代表近期市場搜尋熱度越高。</p>
              <div className="channel">{CHANNELS[i % CHANNELS.length]}</div>
            </div>
          ))}
        </div>
        <p className="note">主推單位以五大 ETF 分類為主；一般關鍵字作為「為什麼要推」的證據，皆來自真實資料。</p>
      </section>

      <section id="mkt-insight">
        <article className="card green-top">
          <div className="card-head">
            <div>
              <div className="eyebrow">本週行動建議</div>
              <h2>本週 Action List</h2>
            </div>
            <span className="badge">可直接派工</span>
          </div>
          <div className="action-list">
            {kpis.topProduct && (
              <div className="action-item">
                <div className="prio">P1</div>
                <div>
                  <b>{kpis.topProduct.keyword}：新增「比較／怎麼買」內容與 Search Ads 組合</b>
                  <small>Owner：數位行銷｜目前為排行第一的關鍵字</small>
                </div>
                <button className="btn" onClick={() => onToast("已標記為 P1")}>
                  標記
                </button>
              </div>
            )}
            {kpis.topTheme && (
              <div className="action-item">
                <div className="prio">P1</div>
                <div>
                  <b>{kpis.topTheme.label}：補「主題 → 商品」承接頁</b>
                  <small>Owner：內容團隊｜目前為熱度最高的分類</small>
                </div>
                <button className="btn" onClick={() => onToast("已加入內容 Backlog")}>
                  加入
                </button>
              </div>
            )}
            {kpis.contentGap && (
              <div className="action-item">
                <div className="prio">P2</div>
                <div>
                  <b>{kpis.contentGap.keyword}：建立比較素材</b>
                  <small>Owner：產品行銷｜比較意圖明顯但可能缺內容</small>
                </div>
                <button className="btn" onClick={() => onToast("已建立比較 brief")}>
                  建立
                </button>
              </div>
            )}
            {kpis.coolingSignal && (
              <div className="action-item">
                <div className="prio">P3</div>
                <div>
                  <b>{kpis.coolingSignal.label}：檢視是否降低非品牌字投放</b>
                  <small>Owner：媒體代理商｜近期熱度相對走弱</small>
                </div>
                <button className="btn" onClick={() => onToast("已標記待檢視")}>
                  檢視
                </button>
              </div>
            )}
          </div>
        </article>
      </section>

      <div className="overlay show" style={{ display: drawer.open ? "block" : "none" }} onClick={closeDrawer} />
      <aside className={`drawer ${drawer.open ? "open" : ""}`} role="dialog" aria-label="關鍵字詳情">
        {drawer.open && (
          <>
            <button className="drawer-close" onClick={closeDrawer}>
              ✕
            </button>
            <span className="tag">{drawer.tag}</span>
            <h2>{drawer.keyword}</h2>
            <div style={{ fontSize: 13, color: "#6c7479" }}>
              {CATEGORY_LABELS[drawer.category] ?? drawer.category} · {METRIC_LABELS[metric]}週趨勢
            </div>
            <KeywordSpark series={drawerSeries} />
            <div className="drawer-section">
              <h4>真實週搜尋熱度</h4>
              {drawerSeries ? (
                <div className="detail-row">
                  <span>資料筆數</span>
                  <b>{drawerSeries.points.length} 週</b>
                </div>
              ) : (
                <div className="detail-row">
                  <span>狀態</span>
                  <b>載入中或此分類無週趨勢資料</b>
                </div>
              )}
              <div className="source-note">資料來自 backend/raw/*.csv 週頻資料（/api/keyword-trend）。</div>
            </div>
            <div className="drawer-section">
              <h4>相關搜尋 — 尚未串接</h4>
              <div className="source-note">Google Trends 的 related_queries 資料還沒抓取，之後補上後會在這裡顯示真實相關搜尋詞。</div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function MatrixDot({
  point,
  heatMax,
  momentumMin,
  momentumMax,
  onClick,
}: {
  point: MatrixPoint;
  heatMax: number;
  momentumMin: number;
  momentumMax: number;
  onClick: () => void;
}) {
  const left = 6 + ((point.momentum - momentumMin) / (momentumMax - momentumMin || 1)) * 82;
  const top = 82 - (point.heat / heatMax) * 68;
  const cls = point.breakout ? "dk" : point.momentum > 0 ? "g" : "o";
  return (
    <span className={`dot ${cls}`} style={{ left: `${left}%`, top: `${Math.max(4, Math.min(88, top))}%` }} onClick={onClick}>
      {point.keyword}
    </span>
  );
}
