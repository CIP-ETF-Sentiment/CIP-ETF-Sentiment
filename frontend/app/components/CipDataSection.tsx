"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dataset from "@/public/data/zscore.json";
import {
  isBreakout,
  keywordScore,
  METRIC_LABELS,
  type Category,
  type Metric,
  type ZScoreDataset,
} from "@/app/lib/zscore";
import type { KeywordSeries, TrendSeries } from "@/app/lib/trends.server";

const CATEGORY_ORDER = ["active_etf", "bond_etf", "market_cap_etf", "sector_etf", "high_dividend_etf"];
const CATEGORY_COLORS = ["#4ab234", "#fba81a", "#239ee1", "#3c902a", "#f08f23"];
const TABLE_TOP_N = 12;

const narratives: Record<string, { headline: string; summary: string; audience: string; channel: string }> = {
  active_etf: { headline:"從『有哪些』走向『持股／換股』", summary:"市場已越過品類教育期，開始追問經理人、績效與換股邏輯。內容重點應從介紹產品，前進到證明投資方法。", audience:"比較型散戶、主動投資族", channel:"搜尋 × Threads × 業務" },
  bond_etf: { headline:"降息期待退潮，需求轉向收益確定性", summary:"債券 ETF 的泛詞熱度偏低，但投資級債、月配與美元債仍有明確意圖。適合以現金流情境承接，而非只談利率方向。", audience:"退休準備族、穩健配置族", channel:"FB × 火車站 × 業務" },
  market_cap_etf: { headline:"大盤核心仍強，但比較需求正在分流", summary:"使用者不只搜尋代表性商品，也在比較費用率、分割後價格與新一代市值型產品。內容要回答為什麼不是只買最大那檔。", audience:"ETF 新手、定期定額族", channel:"搜尋 × FB × 分行" },
  sector_etf: { headline:"AI 題材仍在，市場改問供應鏈純度", summary:"科技與半導體仍是產業型主軸，但泛 AI 話題已進入篩選期。持股純度、記憶體與機器人是下一輪內容切角。", audience:"題材交易族、科技投資族", channel:"Threads × 搜尋 × 業務" },
  high_dividend_etf: { headline:"除息季仍有流量，問題從殖利率轉向填息", summary:"高股息需求維持基本盤，但使用者更關心填息能力、配息來源與成分股汰換。品牌需用總報酬而非單一配息率溝通。", audience:"現金流族、存股族", channel:"FB × 火車站 × 搜尋" },
};

function useCanvasSize(canvasRef: React.RefObject<HTMLCanvasElement | null>, draw: (canvas: HTMLCanvasElement) => void, deps: unknown[]) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => draw(canvas);
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
    // draw is intentionally recreated from the explicit dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function setupCanvas(canvas: HTMLCanvasElement, height = 230) {
  const parent = canvas.parentElement;
  if (!parent) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = parent.clientWidth;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function CategoryTrendCanvas({ trends, selectedSlug }: { trends: TrendSeries; selectedSlug: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rows = useMemo(() => trends.rows.slice(-104), [trends]);
  const [hoveredPoint,setHoveredPoint] = useState<{ index:number; x:number; alignLeft:boolean } | null>(null);
  const hoveredIndex = hoveredPoint?.index ?? null;
  const chartPad = { l:32, r:20, t:14, b:28 };
  useCanvasSize(ref, (canvas) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const pad = chartPad;
    const values = rows.flatMap(row => trends.categories.map(category => typeof row[category.slug] === "number" ? row[category.slug] as number : 0));
    const max = Math.max(10, Math.ceil(Math.max(...values) / 10) * 10);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(33,37,41,.48)";
    ctx.strokeStyle = "rgba(33,37,41,.10)";
    for (let index=0; index<=4; index+=1) {
      const value = max - (max/4)*index;
      const y = pad.t + ((height-pad.t-pad.b)/4)*index;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(width-pad.r,y); ctx.stroke();
      ctx.fillText(String(Math.round(value)),3,y+3);
    }
    rows.forEach((row,index) => {
      if (index % Math.max(1,Math.floor(rows.length/5)) !== 0 && index !== rows.length-1) return;
      const x = pad.l + (index/Math.max(1,rows.length-1))*(width-pad.l-pad.r);
      ctx.fillText(String(row.date).slice(2,7),x-12,height-7);
    });
    trends.categories.forEach((category) => {
      const colorIndex = CATEGORY_ORDER.indexOf(category.slug);
      const active = category.slug === selectedSlug;
      ctx.strokeStyle = CATEGORY_COLORS[colorIndex] ?? "#9bd48e";
      ctx.lineWidth = active ? 3.4 : 1.3;
      ctx.globalAlpha = active ? 1 : .24;
      ctx.beginPath();
      let started = false;
      rows.forEach((row,index) => {
        const value = row[category.slug];
        if (typeof value !== "number") return;
        const x = pad.l + (index/Math.max(1,rows.length-1))*(width-pad.l-pad.r);
        const y = height-pad.b-(value/max)*(height-pad.t-pad.b);
        if (!started) { ctx.moveTo(x,y); started=true; } else ctx.lineTo(x,y);
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    if (hoveredIndex !== null && rows[hoveredIndex]) {
      const x = pad.l + (hoveredIndex/Math.max(1,rows.length-1))*(width-pad.l-pad.r);
      ctx.save();
      ctx.strokeStyle = "rgba(39,48,42,.38)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,height-pad.b); ctx.stroke();
      ctx.setLineDash([]);
      trends.categories.forEach(category => {
        const value = rows[hoveredIndex][category.slug];
        if (typeof value !== "number") return;
        const colorIndex = CATEGORY_ORDER.indexOf(category.slug);
        const y = height-pad.b-(value/max)*(height-pad.t-pad.b);
        ctx.beginPath();
        ctx.arc(x,y,category.slug===selectedSlug ? 4.5 : 3.2,0,Math.PI*2);
        ctx.fillStyle = CATEGORY_COLORS[colorIndex] ?? "#9bd48e";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      });
      ctx.restore();
    }
  }, [trends, selectedSlug, hoveredIndex, rows]);

  const hoveredRow = hoveredIndex === null ? null : rows[hoveredIndex];
  const previousRow = hoveredIndex === null || hoveredIndex === 0 ? null : rows[hoveredIndex-1];

  function updateHoveredPoint(clientX: number) {
    const canvas = ref.current;
    if (!canvas || rows.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const localX = (clientX-rect.left)*(canvas.clientWidth/rect.width);
    const plotWidth = canvas.clientWidth-chartPad.l-chartPad.r;
    if (localX < chartPad.l || localX > canvas.clientWidth-chartPad.r) {
      setHoveredPoint(null);
      return;
    }
    const index = Math.round(((localX-chartPad.l)/Math.max(1,plotWidth))*(rows.length-1));
    const safeIndex = Math.max(0,Math.min(rows.length-1,index));
    const x = chartPad.l + (safeIndex/Math.max(1,rows.length-1))*plotWidth;
    setHoveredPoint(current => current?.index===safeIndex && current.x===x
      ? current
      : {index:safeIndex,x,alignLeft:x>canvas.clientWidth*.58});
  }

  return <div className="category-chart-interactive">
    <canvas
      ref={ref}
      role="img"
      aria-label="五大 ETF 分類真實週平均趨勢；將滑鼠移到圖表可查看每週五項分類指標"
      onPointerMove={event=>updateHoveredPoint(event.clientX)}
      onPointerLeave={()=>setHoveredPoint(null)}
    />
    {hoveredRow&&<div
      className={`category-hover-dashboard ${hoveredPoint?.alignLeft?"align-left":"align-right"}`}
      style={{left:hoveredPoint?.x ?? 0}}
      role="status"
      aria-live="polite"
    >
      <div className="category-hover-date"><span>週頻指標</span><b>{String(hoveredRow.date)}</b></div>
      <div className="category-hover-columns"><span>分類</span><span>數值</span><span>較前週</span></div>
      <div className="category-hover-metrics">
        {[...trends.categories].sort((categoryA,categoryB)=>{
          const valueA = hoveredRow[categoryA.slug];
          const valueB = hoveredRow[categoryB.slug];
          if (typeof valueA !== "number") return typeof valueB === "number" ? 1 : 0;
          if (typeof valueB !== "number") return -1;
          return valueB-valueA;
        }).map(category=>{
          const colorIndex = CATEGORY_ORDER.indexOf(category.slug);
          const value = hoveredRow[category.slug];
          const previousValue = previousRow?.[category.slug];
          const delta = typeof value === "number" && typeof previousValue === "number" ? value-previousValue : null;
          return <div key={category.slug} className={category.slug===selectedSlug?"active":""}>
            <span><i style={{background:CATEGORY_COLORS[colorIndex] ?? "#9bd48e"}} />{category.label.replace("ETF","")}</span>
            <b>{typeof value === "number"?value.toFixed(2):"—"}</b>
            <small className={(delta ?? 0)>=0?"up":"down"}>{delta===null?"—":`${delta>=0?"+":""}${delta.toFixed(2)}`}</small>
          </div>;
        })}
      </div>
    </div>}
  </div>;
}

function KeywordLineCanvas({ series }: { series: KeywordSeries }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasSize(ref, (canvas) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const points = series.points.slice(-104).filter(point => typeof point.value === "number");
    const pad = { l:32, r:20, t:14, b:28 };
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(33,37,41,.48)";
    ctx.strokeStyle = "rgba(33,37,41,.10)";
    for (let index=0; index<=4; index+=1) {
      const y = pad.t + ((height-pad.t-pad.b)/4)*index;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(width-pad.r,y); ctx.stroke();
      ctx.fillText(String(100-index*25),3,y+3);
    }
    points.forEach((point,index) => {
      if (index % Math.max(1,Math.floor(points.length/5)) !== 0 && index !== points.length-1) return;
      const x = pad.l + (index/Math.max(1,points.length-1))*(width-pad.l-pad.r);
      ctx.fillText(point.date.slice(2,7),x-12,height-7);
    });
    ctx.strokeStyle = "#4ab234";
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((point,index) => {
      const x = pad.l + (index/Math.max(1,points.length-1))*(width-pad.l-pad.r);
      const y = height-pad.b-((point.value ?? 0)/100)*(height-pad.t-pad.b);
      if (index===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }, [series]);
  return <canvas ref={ref} role="img" aria-label={`${series.keyword}真實週搜尋熱度趨勢`} />;
}

function KeywordTrend({ categorySlug, keyword }: { categorySlug: string; keyword: string }) {
  const [state,setState] = useState<{ status:"loading"|"error"|"ready"; message?:string; series?:KeywordSeries }>({status:"loading"});
  useEffect(() => {
    let cancelled = false;
    setState({status:"loading"});
    fetch(`/api/keyword-trend?category=${encodeURIComponent(categorySlug)}&keyword=${encodeURIComponent(keyword)}`)
      .then(async response => {
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) setState({status:"error",message:body?.error ?? "載入失敗"});
        else setState({status:"ready",series:body as KeywordSeries});
      })
      .catch(() => !cancelled && setState({status:"error",message:"載入失敗"}));
    return () => { cancelled=true; };
  }, [categorySlug,keyword]);
  if (state.status === "loading") return <div className="chart-state">正在讀取週趨勢…</div>;
  if (state.status === "error" || !state.series) return <div className="chart-state">{state.message}</div>;
  return <KeywordLineCanvas series={state.series} />;
}

function latestValue(trends: TrendSeries | null, slug: string) {
  if (!trends) return null;
  for (let index=trends.rows.length-1; index>=0; index-=1) {
    const value = trends.rows[index]?.[slug];
    if (typeof value === "number") return value;
  }
  return null;
}

function momentumValue(trends: TrendSeries | null, slug: string) {
  if (!trends) return null;
  const numbers = trends.rows.map(row => row[slug]).filter((value): value is number => typeof value === "number");
  if (numbers.length < 14) return null;
  const latest = numbers[numbers.length-1];
  const baseline = numbers[numbers.length-14];
  return baseline === 0 ? null : ((latest-baseline)/baseline)*100;
}

export default function CipDataSection() {
  const categories = useMemo(() => [...(dataset as ZScoreDataset).categories].sort((a,b)=>CATEGORY_ORDER.indexOf(a.slug)-CATEGORY_ORDER.indexOf(b.slug)), []);
  const [selectedSlug,setSelectedSlug] = useState(categories[0]?.slug ?? "active_etf");
  const [metric,setMetric] = useState<Metric>("recent_z");
  const [selectedKeyword,setSelectedKeyword] = useState<string | null>(null);
  const [trends,setTrends] = useState<TrendSeries | null>(null);
  const [trendError,setTrendError] = useState("");
  const selected = categories.find(category => category.slug===selectedSlug) ?? categories[0];
  const narrative = narratives[selectedSlug] ?? narratives.active_etf;

  useEffect(() => {
    fetch("/api/category-trends")
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "分類趨勢載入失敗");
        setTrends(body as TrendSeries);
      })
      .catch(error => setTrendError(error instanceof Error ? error.message : "分類趨勢載入失敗"));
  }, []);

  const ranked = useMemo(() => {
    const sorted = [...(selected?.keywords ?? [])].sort((a,b)=>keywordScore(b,metric)-keywordScore(a,metric));
    if (!selectedKeyword) return sorted.slice(0,TABLE_TOP_N);
    const index = sorted.findIndex(item => item.keyword===selectedKeyword);
    return index < 0 || index < TABLE_TOP_N ? sorted.slice(0,TABLE_TOP_N) : [...sorted.slice(0,TABLE_TOP_N-1),sorted[index]];
  }, [selected,metric,selectedKeyword]);
  const cloudWords = useMemo(() => [...(selected?.keywords ?? [])].sort((a,b)=>keywordScore(b,metric)-keywordScore(a,metric)), [selected,metric]);
  const cloudScores = cloudWords.map(item=>keywordScore(item,metric));
  const minScore = Math.min(...cloudScores,0);
  const maxScore = Math.max(...cloudScores,1);
  const current = latestValue(trends,selectedSlug);
  const momentum = momentumValue(trends,selectedSlug);

  function selectCategory(category: Category) {
    setSelectedSlug(category.slug);
    setSelectedKeyword(null);
  }

  return <>
    <section className="market-intelligence">
      <div className="section-heading market-heading"><div><span className="eyebrow">CIP 市場心聲 · LIVE DATA</span><h2>收集市場說出的心裡話</h2><p>五大 ETF 分類、Z-score 與週趨勢均直接使用 CIP-ETF-Sentiment 資料。</p></div><span className="source-pill">Google Trends · Taiwan</span></div>
      <div className="etf-category-tabs" aria-label="ETF 分類">
        {categories.map((category,index)=><button key={category.slug} className={selectedSlug===category.slug?"active":""} onClick={()=>selectCategory(category)}><i style={{background:CATEGORY_COLORS[index]}} /><span>{category.label}</span><b>{latestValue(trends,category.slug)?.toFixed(2) ?? "—"}</b></button>)}
      </div>
      <div className="market-story-grid">
        <article className="market-story">
          <div className="story-index">{String(categories.findIndex(category=>category.slug===selectedSlug)+1).padStart(2,"0")}</div>
          <span className="eyebrow">MARKET VOICE · {selected?.label}</span><h3>{narrative.headline}</h3><p>{narrative.summary}</p>
          <div className="story-facts"><div><span>最新週平均</span><b>{current?.toFixed(2) ?? "—"}</b></div><div><span>近 13 週動能</span><b className={(momentum ?? 0)>=0?"positive":"negative"}>{momentum==null?"—":`${momentum>=0?"+":""}${momentum.toFixed(2)}%`}</b></div></div>
          <footer><span>核心受眾｜{narrative.audience}</span><span>優先渠道｜{narrative.channel}</span></footer>
        </article>
        <article className="category-chart-card">
          <div className="category-chart-title"><div><b>{selectedKeyword?`「${selectedKeyword}」週趨勢`:"五大分類熱度趨勢"}</b><small>完整週頻資料 · 最多顯示近兩年</small></div>{selectedKeyword?<button className="chart-back" onClick={()=>setSelectedKeyword(null)}>← 返回分類比較</button>:<span>{selected?.label}高亮</span>}</div>
          <div className="category-chart">{selectedKeyword?<KeywordTrend categorySlug={selectedSlug} keyword={selectedKeyword}/>:trends?<CategoryTrendCanvas trends={trends} selectedSlug={selectedSlug}/>:<div className="chart-state">{trendError || "正在讀取真實趨勢…"}</div>}</div>
          <div className="category-mini-legend">{categories.map((category,index)=><button key={category.slug} className={selectedSlug===category.slug?"active":""} onClick={()=>selectCategory(category)}><i style={{background:CATEGORY_COLORS[index]}} />{category.label.replace("ETF","")}</button>)}</div>
        </article>
      </div>
    </section>

    <section className="signal-library">
      <article className="wordcloud-panel">
        <div className="section-heading"><div><span className="eyebrow">KEYWORD WORD CLOUD</span><h2>關鍵字文字雲</h2></div><div className="cloud-toggle">{(Object.keys(METRIC_LABELS) as Metric[]).map(value=><button key={value} className={metric===value?"active":""} onClick={()=>setMetric(value)}>{METRIC_LABELS[value]}</button>)}</div></div>
        <div className="word-cloud" aria-label={`${selected?.label}${METRIC_LABELS[metric]}熱門關鍵字`}>
          {cloudWords.map((item,index)=>{
            const score = keywordScore(item,metric);
            const norm = (score-minScore)/(maxScore-minScore || 1);
            const mean = metric==="recent_z"?item.recent_3m_mean:item.mean_2026;
            return <button key={item.keyword} className={`${index<3?"hot":""} ${selectedKeyword===item.keyword?"selected":""}`} style={{fontSize:`${Math.max(11,Math.min(31,11+norm*20))}px`,opacity:score<=0?.45:1}} onClick={()=>setSelectedKeyword(item.keyword)}>{item.keyword}<small>{mean?.toFixed(1) ?? "—"}</small></button>;
          })}
        </div>
        <p className="data-note">字級依 Z-score 排序呈現；點擊字詞後，右上圖表會改為該字詞的真實週趨勢。</p>
      </article>

      <article className="ranking-panel">
        <div className="section-heading"><div><span className="eyebrow">BREAKOUT RADAR</span><h2>熱門關鍵字排行</h2></div><span className="tag">{METRIC_LABELS[metric]}</span></div>
        <div className="ranking-table" role="table" aria-label={`${selected?.label}熱門關鍵字排行`}>
          <div className="ranking-head" role="row"><span>關鍵字</span><span>歷史平均</span><span>近期平均</span><span>Z-score</span></div>
          {ranked.map((item,index)=>{
            const breakout = isBreakout(item,metric);
            const mean = metric==="recent_z"?item.recent_3m_mean:item.mean_2026;
            const z = metric==="recent_z"?item.recent_z:item.z_2026;
            return <button role="row" className={selectedKeyword===item.keyword?"selected":""} key={item.keyword} onClick={()=>setSelectedKeyword(item.keyword)}><span><i>{String(index+1).padStart(2,"0")}</i><b>{item.keyword}</b>{breakout&&<em>全新熱門</em>}</span><span>{item.historical_mean?.toFixed(2) ?? "—"}</span><span>{mean?.toFixed(2) ?? "—"}</span><strong>{breakout?"Breakout":z?.toFixed(2) ?? "—"}</strong></button>;
          })}
        </div>
        <p className="data-note">Z-score 越高，代表近期熱度相較歷史基準越異常；沒有歷史基準的新詞標示為全新熱門。</p>
      </article>
    </section>
  </>;
}
