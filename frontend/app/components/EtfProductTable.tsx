"use client";

import { useEffect, useMemo, useState } from "react";
import dataset from "@/public/data/etf-products.json";
import trendDataset from "@/public/data/etf-trends-52w.json";
import styles from "./EtfProductTable.module.css";

type TopicStatus = "持續熱門" | "話題升溫" | "近期下降" | "一般關注" | "資料不足";
type TopicFilter = "全部" | TopicStatus;
type EventType = "宣告配息" | "配息" | "分割" | "無";
type SortKey = "shortHeat" | "longHeat" | "aum" | "aumMom" | "netSubscription" | "oneMonthReturn";
type SortDirection = "asc" | "desc";

type EtfProduct = {
  isRecentOffering: boolean;
  code: string;
  name: string;
  issuer: string;
  category: string;
  topicStatus: TopicStatus;
  shortHeat: number;
  longHeat: number;
  aum: number | null;
  aumMom: number | null;
  netSubscription: number | null;
  beneficiariesMom: number | null;
  recurringInvestmentMom: number | null;
  oneMonthReturn: number;
  categoryRank: string;
  eventType: EventType;
  eventDate: string | null;
  eventValue: number | null;
  newsUrl: string | null;
};

type ProductDataset = {
  updatedAt: string;
  source: string;
  products: EtfProduct[];
};

type TrendDataset = {
  updatedAt: string;
  source: string;
  dates: string[];
  series: Record<string, Array<number | null>>;
};

const source = dataset as unknown as ProductDataset;
const trendSource = trendDataset as TrendDataset;
const PAGE_SIZE = 15;
const DEFAULT_SORT: { key: SortKey; direction: SortDirection } = { key: "shortHeat", direction: "desc" };
const TOPIC_FILTERS: TopicFilter[] = ["全部", "持續熱門", "話題升溫", "近期下降", "一般關注"];
const oneDecimal = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function uniqueValues(products: EtfProduct[], field: "issuer" | "category" | "eventType") {
  return [...new Set(products.map(product => product[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-TW"));
}

function signed(value: number, formatter = oneDecimal) {
  return `${value > 0 ? "+" : ""}${formatter.format(value)}`;
}

function formatHundredMillion(value: number | null, showSign = false) {
  if (value === null) return "—";
  const converted = value / 100_000_000;
  return showSign ? signed(converted) : oneDecimal.format(converted);
}

function formatDecimalPercent(value: number | null) {
  return value === null ? "—" : `${signed(value * 100)}%`;
}

function formatPointPercent(value: number | null) {
  return value === null ? "—" : `${signed(value)}%`;
}

function formatEventValue(product: EtfProduct) {
  if (product.eventValue === null || product.eventType === "無") return "—";
  if (product.eventType === "分割") return `1 拆 ${oneDecimal.format(product.eventValue).replace(".0", "")}`;
  return `${twoDecimals.format(product.eventValue * 100)}%`;
}

function valueClass(value: number | null) {
  if (value === null || value === 0) return styles.neutralValue;
  return value > 0 ? styles.positiveValue : styles.negativeValue;
}

function statusClass(status: TopicStatus) {
  if (status === "持續熱門") return styles.statusHot;
  if (status === "話題升溫") return styles.statusRising;
  if (status === "近期下降") return styles.statusFalling;
  if (status === "資料不足") return styles.statusInsufficient;
  return styles.statusGeneral;
}

function eventClass(eventType: EventType) {
  if (eventType === "宣告配息") return styles.eventAnnounced;
  if (eventType === "配息") return styles.eventDividend;
  if (eventType === "分割") return styles.eventSplit;
  return styles.eventNone;
}

function TrendLine({ values, label }: { values: Array<number | null>; label: string }) {
  const chartWidth = 420;
  const chartHeight = 166;
  const top = 14;
  const bottom = 148;
  const plotHeight = bottom - top;
  const coordinates = values.map((value, index) => {
    if (value === null) return null;
    const x = (index / Math.max(1, values.length - 1)) * chartWidth;
    const y = bottom - (Math.max(0, Math.min(100, value)) / 100) * plotHeight;
    return { x, y, value };
  });
  let linePath = "";
  let drawing = false;
  coordinates.forEach(point => {
    if (!point) {
      drawing = false;
      return;
    }
    linePath += `${drawing ? " L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    drawing = true;
  });
  const validPoints = coordinates.filter((point): point is NonNullable<typeof point> => point !== null);
  const first = validPoints[0];
  const last = validPoints.at(-1);
  const areaPath = first && last ? `${linePath} L${last.x.toFixed(1)} ${bottom} L${first.x.toFixed(1)} ${bottom} Z` : "";

  return (
    <svg className={styles.trendChart} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${label}近 52 週搜尋熱度走勢`}>
      <defs>
        <linearGradient id="etfTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ab234" stopOpacity=".22" />
          <stop offset="100%" stopColor="#4ab234" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map(value => {
        const y = bottom - value / 100 * plotHeight;
        return <line key={value} x1="0" x2={chartWidth} y1={y} y2={y} className={styles.trendGrid} />;
      })}
      {areaPath && <path d={areaPath} className={styles.trendArea} />}
      {linePath && <path d={linePath} className={styles.trendLine} />}
      {last && <circle cx={last.x} cy={last.y} r="4.5" className={styles.trendDot} />}
    </svg>
  );
}

function compareProducts(a: EtfProduct, b: EtfProduct, key: SortKey, direction: SortDirection) {
  const left = a[key];
  const right = b[key];
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "desc" ? right - left : left - right;
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}>
      <button type="button" className={styles.sortButton} onClick={() => onSort(sortKey)}>
        {label}<span aria-hidden="true">{active ? (direction === "desc" ? "↓" : "↑") : "↕"}</span>
      </button>
    </th>
  );
}

export default function EtfProductTable() {
  const products = source.products;
  const issuers = useMemo(() => uniqueValues(products, "issuer"), [products]);
  const categories = useMemo(() => uniqueValues(products, "category"), [products]);
  const events = useMemo(() => uniqueValues(products, "eventType"), [products]);
  const [query, setQuery] = useState("");
  const [recentOffering, setRecentOffering] = useState("全部");
  const [issuer, setIssuer] = useState("全部");
  const [category, setCategory] = useState("全部");
  const [eventType, setEventType] = useState("全部");
  const [topicStatus, setTopicStatus] = useState<TopicFilter>("持續熱門");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<EtfProduct | null>(null);

  useEffect(() => {
    if (!selectedProduct) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedProduct(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedProduct]);

  const baseFiltered = useMemo(() => products.filter(product => {
    const codeMatches = product.code.toLowerCase().includes(query.trim().toLowerCase());
    const recentMatches = recentOffering === "全部" || (recentOffering === "是") === product.isRecentOffering;
    return codeMatches
      && recentMatches
      && (issuer === "全部" || product.issuer === issuer)
      && (category === "全部" || product.category === category)
      && (eventType === "全部" || product.eventType === eventType);
  }), [products, query, recentOffering, issuer, category, eventType]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(TOPIC_FILTERS.map(status => [status, 0])) as Record<TopicFilter, number>;
    counts["全部"] = baseFiltered.length;
    baseFiltered.forEach(product => { counts[product.topicStatus] = (counts[product.topicStatus] ?? 0) + 1; });
    return counts;
  }, [baseFiltered]);

  const sortedProducts = useMemo(() => {
    const filtered = topicStatus === "全部"
      ? baseFiltered
      : baseFiltered.filter(product => product.topicStatus === topicStatus);
    return filtered
      .map((product, index) => ({ product, index }))
      .sort((left, right) => compareProducts(left.product, right.product, sort.key, sort.direction) || left.index - right.index)
      .map(item => item.product);
  }, [baseFiltered, topicStatus, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = sortedProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = sortedProducts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sortedProducts.length);

  function toggleSort(key: SortKey) {
    setSort(current => {
      if (current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return DEFAULT_SORT;
    });
    setPage(1);
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setRecentOffering("全部");
    setIssuer("全部");
    setCategory("全部");
    setEventType("全部");
    setTopicStatus("全部");
    setSort(DEFAULT_SORT);
    setPage(1);
  }

  return (
    <section className={styles.section} id="etf-products">
      <header className={styles.header}>
        <div>
          <span className="eyebrow">ETF PRODUCT WATCHLIST · LIVE DATA</span>
          <h2>ETF 市場話題觀察</h2>
          <p>追蹤各檔 ETF 搜尋關注度、產品規模、資金流向、績效與事件資訊。</p>
        </div>
        <div className={styles.updateDate}><span>資料更新日</span><b>{source.updatedAt.replaceAll("-", "/")}</b></div>
      </header>

      <div className={styles.controls}>
        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={event => updateFilter(setQuery, event.target.value)} placeholder="搜尋 ETF 代碼" aria-label="搜尋 ETF 代碼" />
        </label>
        <label><span>近期募集</span><select value={recentOffering} onChange={event => updateFilter(setRecentOffering, event.target.value)}><option>全部</option><option>是</option><option>否</option></select></label>
        <label><span>發行投信</span><select value={issuer} onChange={event => updateFilter(setIssuer, event.target.value)}><option>全部</option>{issuers.map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span>ETF 分類</span><select value={category} onChange={event => updateFilter(setCategory, event.target.value)}><option>全部</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span>事件狀態</span><select value={eventType} onChange={event => updateFilter(setEventType, event.target.value)}><option>全部</option>{events.map(value => <option key={value}>{value}</option>)}</select></label>
        <button type="button" className={styles.clearButton} onClick={clearFilters}>↺ 清除篩選</button>
      </div>

      <div className={styles.statusRow} aria-label="話題狀態篩選">
        <span>話題狀態：</span>
        {TOPIC_FILTERS.map(status => <button type="button" key={status} className={`${styles.statusFilter} ${topicStatus === status ? styles.activeStatus : ""}`} aria-pressed={topicStatus === status} onClick={() => { setTopicStatus(status); setPage(1); }}>{status}<small>{statusCounts[status]}</small></button>)}
      </div>

      <div className={styles.tableFrame}>
        <p className={styles.scrollHint} id="etf-table-scroll-hint">
          <span><b aria-hidden="true">↗</b>點擊任一資料列查看單檔詳情</span>
          <span><b aria-hidden="true">↔</b>左右滑動可瀏覽完整欄位</span>
        </p>
        <div
          className={styles.tableScroll}
          role="region"
          aria-label="ETF 市場話題觀察表格，可左右滑動"
          aria-describedby="etf-table-scroll-hint"
          tabIndex={0}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ETF 代碼</th><th>ETF 名稱</th><th>發行投信</th><th>ETF 分類</th><th>話題狀態</th>
                <SortHeader label="短期熱度" sortKey="shortHeat" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} />
                <SortHeader label="長期熱度" sortKey="longHeat" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} />
                <SortHeader label="AUM（億元）" sortKey="aum" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} />
                <SortHeader label="AUM MoM" sortKey="aumMom" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} />
                <SortHeader label="淨申購（億元）" sortKey="netSubscription" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} />
                <th>受益人數 MoM</th><th>定期定額 MoM</th>
                <SortHeader label="近 1 月報酬率" sortKey="oneMonthReturn" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} />
                <th>同類型排名</th><th>事件</th><th>配息率／分割比率</th><th>相關新聞</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map(product => <tr
                key={product.code}
                className={styles.productRow}
                tabIndex={0}
                aria-label={`查看 ${product.code} ${product.name} 詳情`}
                onClick={() => setSelectedProduct(product)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedProduct(product);
                  }
                }}
              >
                <td className={styles.code}>{product.code}</td>
                <td className={styles.name}>{product.name}</td>
                <td>{product.issuer}</td><td>{product.category}</td>
                <td><span className={`${styles.badge} ${statusClass(product.topicStatus)}`}>{product.topicStatus}</span></td>
                <td className={styles.heat}>{oneDecimal.format(product.shortHeat)}</td>
                <td className={styles.heat}>{oneDecimal.format(product.longHeat)}</td>
                <td className={styles.number}>{formatHundredMillion(product.aum)}</td>
                <td className={`${styles.number} ${valueClass(product.aumMom)}`}>{formatDecimalPercent(product.aumMom)}</td>
                <td className={`${styles.number} ${valueClass(product.netSubscription)}`}>{formatHundredMillion(product.netSubscription, true)}</td>
                <td className={`${styles.number} ${valueClass(product.beneficiariesMom)}`}>{formatDecimalPercent(product.beneficiariesMom)}</td>
                <td className={`${styles.number} ${valueClass(product.recurringInvestmentMom)}`}>{formatDecimalPercent(product.recurringInvestmentMom)}</td>
                <td className={`${styles.number} ${valueClass(product.oneMonthReturn)}`}>{formatPointPercent(product.oneMonthReturn)}</td>
                <td className={styles.rank}>{product.categoryRank}</td>
                <td className={styles.eventCell}><span className={`${styles.eventBadge} ${eventClass(product.eventType)}`}>{product.eventType}</span>{product.eventDate && <small>{product.eventDate.replaceAll("-", "/")}</small>}</td>
                <td className={styles.eventValue}>{formatEventValue(product)}</td>
                <td>{product.newsUrl ? <a className={styles.newsLink} href={product.newsUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>查看新聞 ↗</a> : "—"}</td>
              </tr>)}
              {visibleProducts.length === 0 && <tr><td className={styles.empty} colSpan={17}>找不到符合條件的 ETF</td></tr>}
            </tbody>
          </table>
        </div>

        <footer className={styles.footer}>
          <span aria-live="polite">顯示第 {rangeStart}–{rangeEnd} 筆，共 {sortedProducts.length} 筆</span>
          <nav className={styles.pagination} aria-label="產品表格分頁">
            <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="上一頁">‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => <button type="button" key={pageNumber} className={pageNumber === currentPage ? styles.currentPage : ""} onClick={() => setPage(pageNumber)} aria-current={pageNumber === currentPage ? "page" : undefined}>{pageNumber}</button>)}
            <button type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="下一頁">›</button>
          </nav>
          <span>每頁顯示 {PAGE_SIZE} 筆</span>
        </footer>
      </div>
      <p className={styles.disclaimer}>僅顯示具有足夠 Google Trends 搜尋資料的 ETF。熱度反映各 ETF 相對自身歷史的搜尋狀態，不代表跨 ETF 絕對搜尋量，也不構成投資建議。</p>

      {selectedProduct && <>
        <button type="button" className={styles.drawerOverlay} onClick={() => setSelectedProduct(null)} aria-label="關閉 ETF 詳情" />
        <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="etf-detail-title">
          <button type="button" className={styles.drawerClose} onClick={() => setSelectedProduct(null)} aria-label="關閉 ETF 詳情" autoFocus>✕</button>
          <div className={styles.drawerHeading}>
            <span className={`${styles.badge} ${statusClass(selectedProduct.topicStatus)}`}>{selectedProduct.topicStatus}</span>
            <h2 id="etf-detail-title">{selectedProduct.code}</h2>
            <h3>{selectedProduct.name}</h3>
            <p>{selectedProduct.issuer} · {selectedProduct.category}</p>
          </div>

          <section className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}><h4>搜尋熱度走勢</h4><span>近 52 週</span></div>
            <TrendLine values={trendSource.series[selectedProduct.code] ?? []} label={`${selectedProduct.code} ${selectedProduct.name}`} />
            <div className={styles.trendDates}><span>{trendSource.dates[0]?.replaceAll("-", "/")}</span><span>{trendSource.dates.at(-1)?.replaceAll("-", "/")}</span></div>
            <div className={styles.heatCards}>
              <div><span>短期熱度</span><b>{oneDecimal.format(selectedProduct.shortHeat)}</b></div>
              <div><span>長期熱度</span><b>{oneDecimal.format(selectedProduct.longHeat)}</b></div>
            </div>
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}><h4>產品動能</h4><span>市場資料</span></div>
            <dl className={styles.momentumList}>
              <div><dt>AUM</dt><dd>{selectedProduct.aum === null ? "—" : `${formatHundredMillion(selectedProduct.aum)} 億`}</dd></div>
              <div><dt>AUM MoM</dt><dd className={valueClass(selectedProduct.aumMom)}>{formatDecimalPercent(selectedProduct.aumMom)}</dd></div>
              <div><dt>淨申購</dt><dd className={valueClass(selectedProduct.netSubscription)}>{selectedProduct.netSubscription === null ? "—" : `${formatHundredMillion(selectedProduct.netSubscription, true)} 億`}</dd></div>
              <div><dt>受益人數 MoM</dt><dd className={valueClass(selectedProduct.beneficiariesMom)}>{formatDecimalPercent(selectedProduct.beneficiariesMom)}</dd></div>
              <div><dt>定期定額 MoM</dt><dd className={valueClass(selectedProduct.recurringInvestmentMom)}>{formatDecimalPercent(selectedProduct.recurringInvestmentMom)}</dd></div>
            </dl>
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.outcomeGrid}>
              <div><span>近 1 月績效</span><b className={valueClass(selectedProduct.oneMonthReturn)}>{formatPointPercent(selectedProduct.oneMonthReturn)}</b></div>
              <div><span>同類排名</span><b>{selectedProduct.categoryRank}</b><small>{selectedProduct.category}</small></div>
            </div>
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}><h4>最近事件</h4>{selectedProduct.eventDate && <span>{selectedProduct.eventDate.replaceAll("-", "/")}</span>}</div>
            {selectedProduct.eventType === "無" ? <p className={styles.noEvent}>目前無近期事件</p> : <div className={styles.eventDetail}>
              <div><span className={`${styles.eventBadge} ${eventClass(selectedProduct.eventType)}`}>{selectedProduct.eventType}</span><b>{selectedProduct.eventType === "分割" ? "分割比率" : "年化配息率"}</b></div>
              <strong>{formatEventValue(selectedProduct)}</strong>
            </div>}
            {selectedProduct.newsUrl && <a className={styles.drawerNewsLink} href={selectedProduct.newsUrl} target="_blank" rel="noreferrer">查看相關新聞 <span>↗</span></a>}
          </section>

          <p className={styles.drawerSource}>搜尋趨勢截至 {trendSource.updatedAt.replaceAll("-", "/")}；產品資料截至 {source.updatedAt.replaceAll("-", "/")}。</p>
        </aside>
      </>}
    </section>
  );
}
