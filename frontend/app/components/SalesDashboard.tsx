"use client";

import { useMemo, useState } from "react";
import dataset from "@/public/data/sales-dashboard.json";
import styles from "./SalesDashboard.module.css";

type EtfTypeCode = "ACT" | "MKT" | "BOND" | "IND" | "DIV";
type DimensionCode = "DEMAND" | "TOPIC" | "TIMING" | "CONCERN";
type DimensionFilter = "ALL" | DimensionCode;

type KeywordMapping = {
  etfTypeCode: EtfTypeCode;
  etfType: string;
  productTheme: string;
  joinKey: string;
  isPrimary: boolean;
  recentZ: number | null;
  zValid: boolean;
};

type SalesKeyword = {
  id: string;
  name: string;
  dimensionCode: DimensionCode;
  dimension: string;
  latestRaw: number | null;
  previousRaw: number | null;
  weekDelta: number | null;
  percentile52: number | null;
  validWeeks52: number;
  trend52: Array<number | null>;
  mappings: KeywordMapping[];
};

type SalesProduct = {
  code: string;
  name: string;
  issuer: string;
  topicStatus: string;
  shortHeat: number | null;
  longHeat: number | null;
  aumTwd: number | null;
  aumMom: number | null;
  netSubscriptionTwd: number | null;
  holdersMom: number | null;
  dcaMom: number | null;
  return1mPct: number | null;
  joinKeys: string[];
  primaryJoinKeys: string[];
  etfTypeCodes: EtfTypeCode[];
};

type SalesDataset = {
  updatedAt: string;
  dateRange: { start: string; end: string };
  dates52: string[];
  dataQuality: {
    weeklyRows: number;
    rawMissing: number;
    rawLessThanOne: number;
    keywordMappings: number;
    productMappings: number;
  };
  etfTypes: Array<{ code: EtfTypeCode; label: string }>;
  dimensions: Array<{ code: DimensionCode; label: string; description: string }>;
  keywords: SalesKeyword[];
  products: SalesProduct[];
};

const source = dataset as SalesDataset;
const MIN_VALID_WEEKS = 13;
const HOT_STATUSES = new Set(["持續熱門", "話題升溫"]);
const statusPriority: Record<string, number> = {
  持續熱門: 4,
  話題升溫: 3,
  一般關注: 2,
  近期下降: 1,
};

function keywordScore(keyword: SalesKeyword) {
  return (keyword.percentile52 ?? -1) * 1000 + (keyword.weekDelta ?? -999);
}

function signed(value: number | null, digits = 0, suffix = "") {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

function money(value: number | null, withSign = false) {
  if (value === null) return "—";
  const amount = value / 100_000_000;
  return `${withSign && amount > 0 ? "+" : ""}${amount.toFixed(1)}億`;
}

function ratio(value: number | null) {
  return value === null ? "—" : signed(value * 100, 1, "%");
}

function percentile(value: number | null) {
  return value === null ? "—" : `P${Math.round(value)}`;
}

function productStatusClass(status: string) {
  if (status === "持續熱門") return styles.statusHot;
  if (status === "話題升溫") return styles.statusRising;
  if (status === "近期下降") return styles.statusFalling;
  return styles.statusGeneral;
}

function Sparkline({ values, label }: { values: Array<number | null>; label: string }) {
  const valid = values.filter((value): value is number => value !== null);
  const min = valid.length ? Math.min(...valid) : 0;
  const max = valid.length ? Math.max(...valid) : 100;
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      if (value === null) return null;
      const x = (index / Math.max(1, values.length - 1)) * 300;
      const y = 80 - ((value - min) / span) * 62;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg className={styles.sparkline} viewBox="0 0 300 92" role="img" aria-label={`${label}近 52 週趨勢`}>
      <line x1="0" x2="300" y1="81" y2="81" className={styles.sparkBaseline} />
      <polyline points={points} className={styles.sparkLine} />
    </svg>
  );
}

export default function SalesDashboard() {
  const [selectedType, setSelectedType] = useState<EtfTypeCode>("DIV");
  const [dimension, setDimension] = useState<DimensionFilter>("ALL");
  const [selectedKeywordId, setSelectedKeywordId] = useState("");
  const [query, setQuery] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);

  const selectedTypeMeta = source.etfTypes.find(item => item.code === selectedType) ?? source.etfTypes[0];

  const typeKeywords = useMemo(
    () => source.keywords.filter(keyword => keyword.mappings.some(mapping => mapping.etfTypeCode === selectedType)),
    [selectedType],
  );

  const filteredKeywords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-TW");
    return typeKeywords
      .filter(keyword => dimension === "ALL" || keyword.dimensionCode === dimension)
      .filter(keyword => !normalizedQuery || keyword.name.toLocaleLowerCase("zh-TW").includes(normalizedQuery))
      .sort((left, right) => keywordScore(right) - keywordScore(left));
  }, [dimension, query, typeKeywords]);

  const selectedKeyword = filteredKeywords.find(keyword => keyword.id === selectedKeywordId)
    ?? filteredKeywords[0]
    ?? typeKeywords[0]
    ?? null;

  const selectedMapping = selectedKeyword?.mappings
    .filter(mapping => mapping.etfTypeCode === selectedType)
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))[0] ?? null;

  const coverage = useMemo(() => source.dimensions.map(item => {
    const candidates = typeKeywords.filter(keyword => keyword.dimensionCode === item.code && keyword.validWeeks52 >= MIN_VALID_WEEKS && keyword.percentile52 !== null);
    const hot = candidates.filter(keyword => (keyword.percentile52 ?? 0) >= 80);
    return {
      ...item,
      hot: hot.length,
      valid: candidates.length,
      value: candidates.length ? hot.length / candidates.length * 100 : 0,
      leader: [...hot].sort((left, right) => keywordScore(right) - keywordScore(left))[0]?.name ?? "尚無高熱度字詞",
    };
  }), [typeKeywords]);

  const typeProducts = useMemo(
    () => source.products.filter(product => product.etfTypeCodes.includes(selectedType)),
    [selectedType],
  );

  const relatedProducts = useMemo(() => {
    if (!selectedMapping) return [];
    const mapped = source.products.filter(product => product.joinKeys.includes(selectedMapping.joinKey));
    const hot = mapped.filter(product => HOT_STATUSES.has(product.topicStatus));
    const candidates = hot.length ? hot : mapped;
    return candidates.sort((left, right) =>
      (statusPriority[right.topicStatus] ?? 0) - (statusPriority[left.topicStatus] ?? 0)
      || (right.shortHeat ?? -1) - (left.shortHeat ?? -1),
    );
  }, [selectedMapping]);

  const visibleProducts = showAllProducts ? relatedProducts : relatedProducts.slice(0, 4);
  const hotProductCount = typeProducts.filter(product => HOT_STATUSES.has(product.topicStatus)).length;

  const risingKeywords = useMemo(
    () => [...typeKeywords]
      .filter(keyword => keyword.weekDelta !== null)
      .sort((left, right) => (right.weekDelta ?? -999) - (left.weekDelta ?? -999))
      .slice(0, 5),
    [typeKeywords],
  );

  const risingProducts = useMemo(
    () => [...typeProducts]
      .filter(product => product.aumMom !== null)
      .sort((left, right) => (right.aumMom ?? -999) - (left.aumMom ?? -999))
      .slice(0, 5),
    [typeProducts],
  );

  function selectType(code: EtfTypeCode) {
    setSelectedType(code);
    setDimension("ALL");
    setSelectedKeywordId("");
    setQuery("");
    setShowAllProducts(false);
  }

  function selectDimension(code: DimensionFilter) {
    setDimension(code);
    setSelectedKeywordId("");
    setShowAllProducts(false);
  }

  function exportSalesCsv() {
    const header = ["ETF類別", "面向", "關鍵字", "52W Percentile", "較上週", "本週 Raw GT", "有效週數", "Product Theme"];
    const rows = typeKeywords.map(keyword => {
      const mapping = keyword.mappings.find(item => item.etfTypeCode === selectedType);
      return [
        selectedTypeMeta.label,
        keyword.dimension,
        keyword.name,
        keyword.percentile52?.toFixed(1) ?? "",
        keyword.weekDelta ?? "",
        keyword.latestRaw ?? "",
        keyword.validWeeks52,
        mapping?.productTheme ?? "",
      ];
    });
    const csv = [header, ...rows]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `業務搜尋雷達_${selectedType}_${source.updatedAt}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.dashboard}>
      <button id="sales-export" className={styles.exportHook} type="button" onClick={exportSalesCsv} tabIndex={-1} aria-hidden="true" />

      <section className={styles.intro}>
        <div>
          <span className="eyebrow">SALES INTELLIGENCE · GOOGLE TRENDS</span>
          <h1>聽見市場這週在搜什麼</h1>
          <p>從搜尋熱度看到需求、題材、行動與疑慮，再回到實際 ETF 數據確認市場是否真的有反應。</p>
        </div>
        <div className={styles.syncBadge}><i /><span>週資料已同步</span><b>{source.updatedAt.replaceAll("-", "/")}</b></div>
      </section>

      <nav className={styles.typeTabs} aria-label="ETF 分類">
        {source.etfTypes.map(item => (
          <button key={item.code} type="button" className={selectedType === item.code ? styles.activeType : ""} onClick={() => selectType(item.code)} aria-pressed={selectedType === item.code}>
            <span>{item.label}</span><small>{item.code}</small>
          </button>
        ))}
      </nav>

      <section className={styles.radarSection} id="trend-map">
        <header className={styles.sectionHeader}>
          <div><span>01 · SEARCH RADAR</span><h2>本週大家在找什麼？</h2><p>字體大小依 Keyword 自身近 52 週 Percentile；不同 Keyword 的 Raw GT 不直接互相比較。</p></div>
          <label className={styles.searchBox}>⌕<input id="keyword-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`搜尋 ${typeKeywords.length} 組關鍵字`} /></label>
        </header>

        <div className={styles.dimensionTabs} aria-label="四大面向">
          <button type="button" className={dimension === "ALL" ? styles.activeDimension : ""} onClick={() => selectDimension("ALL")}>全部</button>
          {source.dimensions.map(item => <button type="button" key={item.code} className={dimension === item.code ? styles.activeDimension : ""} onClick={() => selectDimension(item.code)}>{item.label}</button>)}
        </div>

        <div className={styles.radarGrid}>
          <article className={styles.wordCloudCard}>
            <div className={styles.cloudMeta}><span>{selectedTypeMeta.label}</span><b>{filteredKeywords.length} 組訊號</b></div>
            <div className={styles.wordCloud} aria-label={`${selectedTypeMeta.label}熱門關鍵字`}>
              {filteredKeywords.slice(0, 22).map((keyword, index) => {
                const score = Math.max(0, keyword.percentile52 ?? 0);
                const size = 14 + score / 100 * 22 - Math.min(index, 10) * .35;
                return (
                  <button type="button" key={keyword.id} className={`${selectedKeyword?.id === keyword.id ? styles.selectedWord : ""} ${index < 3 ? styles.hotWord : ""}`} style={{ fontSize: `${size}px` }} onClick={() => { setSelectedKeywordId(keyword.id); setShowAllProducts(false); }}>
                    {keyword.name}
                  </button>
                );
              })}
              {filteredKeywords.length === 0 && <div className={styles.emptyState}>找不到符合條件的關鍵字</div>}
            </div>
            <p>只納入近 52 週至少 {MIN_VALID_WEEKS} 週有搜尋量的有效字詞。</p>
          </article>

          <aside className={styles.listeningCard}>
            <span className={styles.cardEyebrow}>NOW LISTENING</span>
            <h3>你點到的市場訊號</h3>
            {selectedKeyword ? <>
              <div className={styles.speechBubble}>
                <b>{selectedKeyword.name}</b>
                <span>{selectedKeyword.dimension} · {selectedMapping?.productTheme ?? "待建立題材對應"}</span>
              </div>
              <div className={styles.keywordMetrics}>
                <div><span>52W Percentile</span><b>{percentile(selectedKeyword.percentile52)}</b></div>
                <div><span>較上週</span><b className={(selectedKeyword.weekDelta ?? 0) >= 0 ? styles.up : styles.down}>{signed(selectedKeyword.weekDelta)}</b></div>
                <div><span>本週 Raw GT</span><b>{selectedKeyword.latestRaw ?? "—"}</b></div>
                <div><span>有效週數</span><b>{selectedKeyword.validWeeks52}/52</b></div>
              </div>
              <div className={styles.mappingPath}><span>{selectedKeyword.name}</span><i>→</i><b>{selectedMapping?.productTheme ?? "待對應"}</b><i>→</i><strong>{relatedProducts.length} 檔 ETF</strong></div>
              <div className={styles.sparkTitle}><span>近 52 週 Raw GT</span><small>{source.dates52[0]} - {source.dates52[source.dates52.length - 1]}</small></div>
              <Sparkline values={selectedKeyword.trend52} label={selectedKeyword.name} />
            </> : <div className={styles.emptyState}>請選擇一個關鍵字</div>}
          </aside>
        </div>
      </section>

      <section className={styles.coverageSection}>
        <header className={styles.sectionHeader}>
          <div><span>02 · INTENT COVERAGE</span><h2>四大面向走到哪一步？</h2><p>P80+ Keyword 數／有效 Keyword 數，讓業務分辨市場是在找產品、追題材、準備行動或產生疑慮。</p></div>
          <div className={styles.methodPill}>高熱門檻 · P80+</div>
        </header>
        <div className={styles.coverageGrid}>
          {coverage.map(item => (
            <button type="button" key={item.code} className={dimension === item.code ? styles.activeCoverage : ""} onClick={() => selectDimension(item.code)}>
              <div className={styles.coverageTop}><span>{item.label}</span><b>{item.value.toFixed(0)}%</b></div>
              <div className={styles.coverageTrack}><i style={{ width: `${item.value}%` }} /></div>
              <p>{item.description}</p>
              <footer><span>{item.hot}/{item.valid} 組</span><strong>{item.leader}</strong></footer>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.productSection}>
        <header className={styles.sectionHeader}>
          <div><span>03 · ETF HEAT</span><h2>{selectedTypeMeta.label} ETF 熱門產品</h2><p>搜尋訊號先對應 Product Theme，再以 ETF 的短期熱度與市場資料驗證是否有實際反應。</p></div>
          <div className={styles.mappingBadge}><span>{selectedKeyword?.name ?? "關鍵字"}</span><i>→</i><b>{selectedMapping?.productTheme ?? "題材"}</b></div>
        </header>

        <div className={styles.productLayout}>
          <aside className={styles.productSummary}>
            <span>目前產品池</span><h3>{selectedTypeMeta.label}</h3>
            <dl><div><dt>熱門產品</dt><dd>{hotProductCount} 檔</dd></div><div><dt>本次關聯</dt><dd>{relatedProducts.length} 檔</dd></div><div><dt>納入條件</dt><dd>話題升溫／持續熱門</dd></div><div><dt>排序依據</dt><dd>狀態、短期熱度</dd></div></dl>
            <p>這裡呈現的是同類型 ETF 的產品端熱度，不宜解讀為 Google 搜尋字直接造成 ETF 升溫。</p>
          </aside>

          <div className={styles.productList}>
            {visibleProducts.map(product => (
              <article key={product.code} className={styles.productCard}>
                <div className={styles.productIdentity}><div><b>{product.code}</b><span>{product.name} · {product.issuer}</span></div><div className={styles.productBadges}>{product.issuer === "國泰" && <em>自家商品</em>}<strong className={productStatusClass(product.topicStatus)}>{product.topicStatus}</strong></div></div>
                <div className={styles.productMetrics}>
                  <div><span>短期熱度</span><b className={styles.heatValue}>{product.shortHeat?.toFixed(1) ?? "—"}</b></div>
                  <div><span>長期熱度</span><b>{product.longHeat?.toFixed(1) ?? "—"}</b></div>
                  <div><span>AUM</span><b>{money(product.aumTwd)}</b></div>
                  <div><span>淨申購</span><b className={(product.netSubscriptionTwd ?? 0) >= 0 ? styles.up : styles.down}>{money(product.netSubscriptionTwd, true)}</b></div>
                  <div><span>AUM MoM</span><b className={(product.aumMom ?? 0) >= 0 ? styles.up : styles.down}>{ratio(product.aumMom)}</b></div>
                </div>
              </article>
            ))}
            {visibleProducts.length === 0 && <div className={styles.emptyState}>這個題材目前沒有可顯示的相關 ETF</div>}
            {relatedProducts.length > 4 && <button type="button" className={styles.expandProducts} onClick={() => setShowAllProducts(value => !value)}><span>{showAllProducts ? "收合產品" : `展開其餘 ${relatedProducts.length - 4} 檔相關 ETF`}</span><b>{showAllProducts ? "−" : "+"}</b></button>}
          </div>
        </div>
      </section>

      <section className={styles.changeSection}>
        <header className={styles.sectionHeader}>
          <div><span>04 · WHAT CHANGED</span><h2>這週什麼變化最快？</h2><p>左邊找搜尋升溫，右邊看同類 ETF 市場端最明顯的變化。</p></div>
        </header>
        <div className={styles.changeGrid}>
          <article className={styles.changeCard}><h3>搜尋升溫最快</h3>{risingKeywords.map((keyword, index) => <button type="button" key={keyword.id} onClick={() => { setDimension("ALL"); setSelectedKeywordId(keyword.id); document.getElementById("trend-map")?.scrollIntoView({ behavior: "smooth" }); }}><i>{index + 1}</i><span><b>{keyword.name}</b><small>{keyword.dimension} · {percentile(keyword.percentile52)}</small></span><strong>{signed(keyword.weekDelta)}</strong></button>)}</article>
          <article className={styles.changeCard}><h3>ETF 市場變化最快</h3>{risingProducts.map((product, index) => <div key={product.code}><i>{index + 1}</i><span><b>{product.code} · {product.name}</b><small>短期熱度 {product.shortHeat?.toFixed(1) ?? "—"} · AUM {money(product.aumTwd)}</small></span><strong>{ratio(product.aumMom)}</strong></div>)}</article>
        </div>
      </section>

      <p className={styles.disclaimer}>Google Trends 指數為 0-100 的相對搜尋熱度，不等同實際搜尋量；跨字詞比較採各自近 52 週 Percentile。ETF 市場資料僅用於驗證產品端是否同步出現變化，不構成投資建議。資料截至 {source.updatedAt.replaceAll("-", "/")}。</p>
    </div>
  );
}
