"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import AgentChat from "./components/AgentChat";
import CipDataSection from "./components/CipDataSection";
import EtfProductTable from "./components/EtfProductTable";
import MarketingDeck from "./components/MarketingDeck";
import SalesDashboard from "./components/SalesDashboard";

type Department = "marketing" | "sales" | "product";
type Algorithm = "composite" | "heat" | "growth" | "predict";
type Period = "30 天" | "90 天" | "12 個月" | "5 年";
type EtfCategory = "主動式ETF" | "債券型ETF" | "市值型ETF" | "產業型ETF" | "高股息ETF";
type CloudPeriod = "近 3 個月" | "全年";
type Keyword = {
  name: string;
  heat: number;
  growth: number;
  latest: number;
  peak: number;
  category: "需求" | "代號" | "同業" | "洞察";
  custom?: boolean;
};

const keywordData: Keyword[] = [{"name":"主動型ETF","heat":35,"growth":-29,"latest":17,"peak":100,"category":"需求"},{"name":"主動式ETF有哪些","heat":28,"growth":-33,"latest":19,"peak":100,"category":"需求"},{"name":"主動ETF比較","heat":35,"growth":-3,"latest":18,"peak":100,"category":"需求"},{"name":"主動ETF排名","heat":31,"growth":-8,"latest":13,"peak":100,"category":"需求"},{"name":"主動ETF值得買嗎","heat":0,"growth":0,"latest":0,"peak":100,"category":"需求"},{"name":"主動ETF怎麼選","heat":0,"growth":0,"latest":0,"peak":0,"category":"需求"},{"name":"主動ETF經理人","heat":17,"growth":-54,"latest":15,"peak":100,"category":"洞察"},{"name":"主動ETF換股","heat":13,"growth":1262,"latest":0,"peak":100,"category":"洞察"},{"name":"00403A","heat":20,"growth":29,"latest":10,"peak":100,"category":"代號"},{"name":"00991A","heat":70,"growth":77,"latest":48,"peak":100,"category":"代號"},{"name":"00400A","heat":41,"growth":-9,"latest":25,"peak":100,"category":"代號"},{"name":"00993A","heat":10,"growth":-61,"latest":8,"peak":100,"category":"代號"},{"name":"主動統一升級50","heat":23,"growth":113,"latest":9,"peak":100,"category":"同業"},{"name":"主動復華未來50","heat":72,"growth":56,"latest":78,"peak":100,"category":"同業"},{"name":"群益台灣強棒","heat":17,"growth":-46,"latest":0,"peak":100,"category":"同業"},{"name":"主動群益科技創新","heat":11,"growth":-53,"latest":16,"peak":100,"category":"同業"},{"name":"群益科技創新","heat":23,"growth":-32,"latest":20,"peak":100,"category":"同業"},{"name":"野村臺灣優選","heat":5,"growth":492,"latest":21,"peak":100,"category":"同業"},{"name":"國泰動能高息","heat":15,"growth":-56,"latest":15,"peak":100,"category":"同業"},{"name":"00981A 績效","heat":25,"growth":-25,"latest":10,"peak":100,"category":"洞察"},{"name":"00981A 經理人","heat":9,"growth":-68,"latest":5,"peak":100,"category":"洞察"},{"name":"00981A 換股","heat":2,"growth":-83,"latest":0,"peak":100,"category":"洞察"},{"name":"00403A 持股","heat":20,"growth":56,"latest":7,"peak":100,"category":"洞察"},{"name":"00992A 持股","heat":1,"growth":-96,"latest":0,"peak":100,"category":"洞察"},{"name":"00992A 績效","heat":1,"growth":-96,"latest":0,"peak":100,"category":"洞察"},{"name":"00980A 持股","heat":12,"growth":1169,"latest":100,"peak":100,"category":"洞察"},{"name":"00980A 經理人","heat":0,"growth":0,"latest":0,"peak":0,"category":"洞察"},{"name":"00980A 換股","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"00400A 績效","heat":12,"growth":1231,"latest":0,"peak":100,"category":"洞察"},{"name":"00400A 經理人","heat":4,"growth":-73,"latest":0,"peak":100,"category":"洞察"},{"name":"00400A 換股","heat":0,"growth":0,"latest":0,"peak":0,"category":"洞察"},{"name":"00993A 持股","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"00993A 換股","heat":0,"growth":0,"latest":0,"peak":0,"category":"洞察"},{"name":"陳釧瑤","heat":7,"growth":-70,"latest":5,"peak":100,"category":"需求"},{"name":"陳釧瑤 00981A","heat":4,"growth":-85,"latest":3,"peak":100,"category":"需求"},{"name":"00981A 00982A","heat":37,"growth":-33,"latest":25,"peak":100,"category":"代號"},{"name":"統一台股增長 績效","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"統一升級50 績效","heat":0,"growth":0,"latest":0,"peak":0,"category":"洞察"},{"name":"統一升級50 經理人","heat":0,"growth":0,"latest":0,"peak":0,"category":"洞察"},{"name":"復華未來50 持股","heat":1,"growth":69,"latest":0,"peak":100,"category":"洞察"},{"name":"復華未來50 績效","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"復華未來50 換股","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"群益台灣強棒 持股","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"群益台灣強棒 績效","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"群益台灣強棒 經理人","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"群益台灣強棒 換股","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"群益科技創新 持股","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"群益科技創新 績效","heat":0,"growth":0,"latest":0,"peak":0,"category":"洞察"},{"name":"群益科技創新 經理人","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"},{"name":"群益科技創新 換股","heat":0,"growth":0,"latest":0,"peak":100,"category":"洞察"}];

const monthlySeries: Record<string, number[] | string[]> = {
  labels: ["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"],
  "主動型ETF": [18,17,22,26,25,22,25,72,74,39,21,18],
  "主動ETF比較": [19,0,7,16,10,13,17,52,76,44,12,18],
  "主動ETF排名": [0,0,0,0,0,0,0,67,73,40,4,14],
  "主動復華未來50": [0,0,0,45,54,32,35,53,73,70,77,73],
  "00991A": [0,0,13,41,28,29,27,48,71,80,70,50],
  "主動統一升級50": [0,0,0,0,0,0,0,7,45,24,15,11],
  "國泰動能高息": [0,0,0,0,0,16,0,76,45,12,4,17],
  "群益科技創新": [0,0,0,12,32,0,18,63,45,27,9,20],
};

const yearlySeries: Record<string, number[] | string[]> = {
  labels: ["2021","2022","2023","2024","2025","2026"],
  "主動型ETF": [1,0,0,0,12,39], "主動ETF比較": [0,0,1,0,5,32], "主動ETF排名": [0,0,0,0,1,26],
  "主動復華未來50": [2,0,1,0,3,57], "00991A": [0,0,0,0,4,50], "主動統一升級50": [0,0,0,0,0,14],
  "國泰動能高息": [0,1,0,0,0,22], "群益科技創新": [1,2,4,1,1,27],
};

type MarketKeyword = { name: string; historical: number; recent: number; z: number; annual: number };
type CategoryProfile = {
  current: number;
  change: number;
  headline: string;
  summary: string;
  audience: string;
  channel: string;
  series: number[];
  keywords: MarketKeyword[];
};

const categoryProfiles: Record<EtfCategory, CategoryProfile> = {
  "主動式ETF": {
    current: 11.33, change: 26.17, headline: "從『有哪些』走向『持股／換股』",
    summary: "市場已越過品類教育期，開始追問經理人、績效與換股邏輯。內容重點應從介紹產品，前進到證明投資方法。",
    audience: "比較型散戶、主動投資族", channel: "搜尋 × Threads × 業務",
    series: [2.2,3.1,4.6,5.4,7.8,10.6,14.8,20.2,26.2,22.6,16.8,11.33],
    keywords: [
      {name:"00400A",historical:0,recent:35.83,z:35.83,annual:34.19},
      {name:"主動復華未來50",historical:1.12,recent:73.42,z:11.52,annual:58.41},
      {name:"00991A",historical:1.02,recent:66.83,z:11.17,annual:50.40},
      {name:"00980A 持股",historical:0,recent:25.33,z:25.33,annual:9.50},
      {name:"00981A 績效",historical:.10,recent:17.75,z:23.79,annual:23.00},
      {name:"主動ETF換股",historical:0,recent:22.00,z:22.00,annual:8.25},
      {name:"00400A 績效",historical:0,recent:21.67,z:21.67,annual:8.13},
      {name:"主動統一升級50",historical:0,recent:16.58,z:16.58,annual:12.77},
      {name:"00403A",historical:0,recent:15.08,z:15.08,annual:13.68},
      {name:"主動ETF排名",historical:.28,recent:19.50,z:9.33,annual:24.84},
    ],
  },
  "債券型ETF": {
    current: 2.59, change: -8.42, headline: "降息期待退潮，需求轉向收益確定性",
    summary: "債券 ETF 的泛詞熱度偏低，但投資級債、月配與美元債仍有明確意圖。適合以現金流情境承接，而非只談利率方向。",
    audience: "退休準備族、穩健配置族", channel: "FB × 火車站 × 業務",
    series: [4.6,4.3,4.0,3.7,3.5,3.3,3.1,2.9,2.7,2.5,2.8,2.59],
    keywords: [
      {name:"投資級債ETF",historical:18.4,recent:29.6,z:2.84,annual:24.8},
      {name:"美債ETF",historical:24.2,recent:31.4,z:2.21,annual:28.9},
      {name:"債券ETF月配息",historical:8.7,recent:18.5,z:3.76,annual:14.2},
      {name:"20年美債",historical:21.6,recent:25.1,z:1.44,annual:26.3},
      {name:"降息債券ETF",historical:5.2,recent:12.8,z:3.12,annual:10.4},
      {name:"美元債ETF",historical:9.8,recent:13.6,z:1.82,annual:12.7},
    ],
  },
  "市值型ETF": {
    current: 21.97, change: 14.28, headline: "大盤核心仍強，但比較需求正在分流",
    summary: "使用者不只搜尋 0050，也在比較費用率、分割後價格與新一代市值型商品。主推內容要回答『為什麼不是只買最大那檔』。",
    audience: "ETF 新手、定期定額族", channel: "搜尋 × FB × 分行",
    series: [18.0,19.4,21.1,23.8,22.2,25.7,29.8,34.1,30.6,27.9,24.0,21.97],
    keywords: [
      {name:"0050",historical:48.2,recent:72.8,z:4.18,annual:66.7},
      {name:"市值型ETF推薦",historical:12.1,recent:28.6,z:4.72,annual:22.4},
      {name:"0050 分割",historical:3.4,recent:24.8,z:7.96,annual:31.2},
      {name:"006208",historical:31.6,recent:46.2,z:3.19,annual:42.8},
      {name:"市值型ETF比較",historical:9.8,recent:21.7,z:3.88,annual:18.6},
      {name:"ETF 定期定額",historical:22.6,recent:33.4,z:2.63,annual:30.1},
    ],
  },
  "產業型ETF": {
    current: 8.30, change: 32.14, headline: "AI 題材仍在，市場改問供應鏈純度",
    summary: "科技與半導體仍是產業型主軸，但泛 AI 話題已進入篩選期。持股純度、記憶體與機器人是下一輪內容切角。",
    audience: "題材交易族、科技投資族", channel: "Threads × 搜尋 × 業務",
    series: [7.1,8.4,9.6,11.8,10.7,14.9,17.4,16.2,14.3,12.1,9.7,8.30],
    keywords: [
      {name:"半導體ETF",historical:20.7,recent:38.9,z:4.62,annual:34.8},
      {name:"AI ETF",historical:11.4,recent:29.3,z:5.21,annual:27.6},
      {name:"機器人ETF",historical:4.8,recent:18.1,z:5.84,annual:13.9},
      {name:"記憶體ETF",historical:3.1,recent:14.7,z:6.08,annual:10.2},
      {name:"科技ETF推薦",historical:8.6,recent:19.8,z:3.94,annual:17.1},
      {name:"台灣科技ETF",historical:10.3,recent:17.6,z:2.72,annual:16.4},
    ],
  },
  "高股息ETF": {
    current: 16.19, change: -4.73, headline: "除息季仍有流量，問題從殖利率轉向填息",
    summary: "高股息需求維持基本盤，但使用者更關心填息能力、配息來源與成分股汰換。品牌需用總報酬而非單一配息率溝通。",
    audience: "現金流族、存股族", channel: "FB × 火車站 × 搜尋",
    series: [19.2,22.6,28.1,25.4,21.0,18.7,20.2,22.4,20.1,18.0,15.3,16.19],
    keywords: [
      {name:"高股息ETF推薦",historical:28.8,recent:45.7,z:3.72,annual:41.6},
      {name:"ETF 填息",historical:13.7,recent:31.2,z:4.81,annual:24.9},
      {name:"月配息ETF",historical:25.1,recent:36.8,z:2.92,annual:34.1},
      {name:"高股息ETF比較",historical:16.4,recent:29.5,z:3.46,annual:27.8},
      {name:"配息來源",historical:6.8,recent:18.6,z:4.27,annual:14.5},
      {name:"高股息成分股",historical:10.9,recent:20.1,z:3.18,annual:18.7},
    ],
  },
};

const categoryColors = ["#4ab234", "#fba81a", "#239ee1", "#3c902a", "#f08f23"];

const chartColors = ["#4ab234", "#fba81a", "#239ee1", "#3c902a", "#f08f23", "#72c361", "#6f42c1", "#20c997"];

const departments = {
  marketing: { label: "行銷", kicker: "受眾 × 媒體", title: "把搜尋動能變成媒體火力", description: "看懂年齡溝通策略與 FB、Threads、火車站的角色分工。" },
  sales: { label: "業務", kicker: "散戶 × 產品", title: "比客戶早一步看見問題", description: "掌握整體散戶正在看什麼，以及產品與話題的距離。" },
  product: { label: "產品開發", kicker: "同業 × 缺口", title: "追同業，也找到下一個產品缺口", description: "追蹤同業產品、持股、績效與經理人話題的升溫速度。" },
};

const recommendations: Record<Algorithm, { product: string; action: string; reason: string; channel: string }[]> = {
  composite: [
    { product: "00991A", action: "建立市場標竿", reason: "近 13 週熱度 70、動能 +77%", channel: "FB / 業務話術" },
    { product: "主動復華未來50", action: "攔截同業需求", reason: "目前熱度 78，仍處高檔", channel: "搜尋 / Threads" },
    { product: "00403A", action: "放大持股內容", reason: "持股關注動能 +56%", channel: "Threads / 內容" },
    { product: "國泰動能高息", action: "品牌主場收斂", reason: "用高息熟悉度承接主動式需求", channel: "火車站 / FB" },
  ],
  heat: [
    { product: "主動復華未來50", action: "高熱度攔截", reason: "近 13 週熱度 72，榜首", channel: "搜尋 / FB" },
    { product: "00991A", action: "商品代號教育", reason: "近 13 週熱度 70", channel: "業務 / Threads" },
    { product: "00400A", action: "比較型內容", reason: "近 13 週熱度 41", channel: "內容 / 搜尋" },
    { product: "主動型 ETF", action: "品類收口", reason: "泛詞熱度 35，適合總整理", channel: "全通路" },
  ],
  growth: [
    { product: "主動統一升級50", action: "搶先卡位", reason: "近 13 週動能 +113%", channel: "Threads" },
    { product: "00991A", action: "擴大聲量", reason: "高基期仍成長 +77%", channel: "FB / 搜尋" },
    { product: "00403A 持股", action: "持股解密", reason: "內容詞動能 +56%", channel: "內容 / 業務" },
    { product: "野村臺灣優選", action: "同業雷達", reason: "低基期快速跳升，需觀察", channel: "產品情報" },
  ],
  predict: [
    { product: "主動復華未來50", action: "延續高檔", reason: "高熱度搭配正動能", channel: "搜尋 / FB" },
    { product: "00991A", action: "維持曝光", reason: "連續三月維持 50 以上", channel: "全通路" },
    { product: "主動 ETF 比較", action: "決策內容", reason: "比較需求仍有 35 熱度", channel: "SEO / 業務" },
    { product: "國泰動能高息", action: "事件脈衝", reason: "利用品牌主場創造第二波", channel: "火車站 / FB" },
  ],
};

function scoreFor(item: Keyword, algorithm: Algorithm) {
  const momentum = Math.max(-100, Math.min(item.growth, 150));
  if (algorithm === "heat") return item.heat;
  if (algorithm === "growth") return momentum;
  if (algorithm === "predict") return item.heat * .55 + momentum * .45;
  return item.heat * .65 + momentum * .35;
}

function TrendCanvas({ period }: { period: Period }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const source = period === "5 年" ? yearlySeries : monthlySeries;
  const labels = source.labels as string[];
  const slice = period === "30 天" ? 2 : period === "90 天" ? 4 : labels.length;
  const visibleLabels = labels.slice(-slice);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = 280;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, w, h);
      const pad = { l: 34, r: 16, t: 18, b: 28 };
      ctx.strokeStyle = "rgba(33,37,41,.12)";
      ctx.lineWidth = 1;
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "rgba(33,37,41,.52)";
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + ((h - pad.t - pad.b) / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        ctx.fillText(String(100 - i * 25), 4, y + 4);
      }
      visibleLabels.forEach((label, i) => {
        if (i % Math.max(1, Math.floor(visibleLabels.length / 5)) !== 0 && i !== visibleLabels.length - 1) return;
        const x = pad.l + (i / Math.max(1, visibleLabels.length - 1)) * (w - pad.l - pad.r);
        ctx.fillText(label.replace("2026-", ""), x - 14, h - 6);
      });
      Object.keys(source).filter(k => k !== "labels").forEach((key, seriesIndex) => {
        const values = (source[key] as number[]).slice(-slice);
        ctx.strokeStyle = chartColors[seriesIndex];
        ctx.lineWidth = key === "國泰動能高息" ? 3 : 1.8;
        ctx.globalAlpha = key === "國泰動能高息" ? 1 : .72;
        ctx.beginPath();
        values.forEach((value, i) => {
          const x = pad.l + (i / Math.max(1, values.length - 1)) * (w - pad.l - pad.r);
          const y = pad.t + (1 - value / 100) * (h - pad.t - pad.b);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [period, slice, visibleLabels.length, source]);

  return <canvas ref={canvasRef} aria-label={`ETF 關鍵字 ${period} 趨勢比較折線圖`} role="img" />;
}

function CategoryTrendCanvas({ active }: { active: EtfCategory }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = 230;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, w, h);
      const pad = { l: 28, r: 24, t: 16, b: 30 };
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "rgba(33,37,41,.48)";
      ctx.strokeStyle = "rgba(33,37,41,.10)";
      [0,10,20,30,40].forEach(value => {
        const y = h - pad.b - (value / 40) * (h - pad.t - pad.b);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        ctx.fillText(String(value), 4, y + 3);
      });
      ["09","11","01","03","05","07","08"].forEach((label,index,labels) => {
        const x = pad.l + (index / (labels.length - 1)) * (w - pad.l - pad.r);
        ctx.fillText(label, x - 6, h - 8);
      });
      (Object.keys(categoryProfiles) as EtfCategory[]).forEach((name,index) => {
        const values = categoryProfiles[name].series;
        const isActive = name === active;
        ctx.strokeStyle = categoryColors[index];
        ctx.lineWidth = isActive ? 3.5 : 1.3;
        ctx.globalAlpha = isActive ? 1 : .28;
        ctx.beginPath();
        values.forEach((value,i) => {
          const x = pad.l + (i / (values.length - 1)) * (w - pad.l - pad.r);
          const y = h - pad.b - (value / 40) * (h - pad.t - pad.b);
          if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();
        if (isActive) {
          const x = w - pad.r;
          const y = h - pad.b - (values[values.length - 1] / 40) * (h - pad.t - pad.b);
          ctx.beginPath(); ctx.arc(x,y,4.5,0,Math.PI*2); ctx.fillStyle = categoryColors[index]; ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    };
    draw();
    window.addEventListener("resize",draw);
    return () => window.removeEventListener("resize",draw);
  }, [active]);

  return <canvas ref={canvasRef} aria-label={`五大 ETF 分類趨勢，${active}高亮`} role="img" />;
}

function DepartmentPanel({ department, onToast }: { department: Department; onToast: (message: string) => void }) {
  if (department === "marketing") return <MarketingDeck onToast={onToast} />;
  if (department === "sales") return (
    <div className="department-grid">
      <div className="mini-panel">
        <div className="section-heading"><div><span className="eyebrow">RETAIL SIGNALS</span><h3>散戶現在問什麼</h3></div><span className="tag">近 13 週</span></div>
        {[{q:"哪一檔主動式 ETF 表現最好？",k:"排名",v:31},{q:"00981A 跟 00982A 怎麼選？",k:"比較",v:37},{q:"經理人最近換了哪些股票？",k:"換股",v:17}].map((x,i)=><button className="question-row" key={x.q}><span>{String(i+1).padStart(2,"0")}</span><div><b>{x.q}</b><small>話題標籤 · {x.k}</small></div><em>{x.v}</em></button>)}
      </div>
      <div className="mini-panel">
        <div className="section-heading"><div><span className="eyebrow">TALK TRACK</span><h3>本週業務話術</h3></div><span className="pulse-dot">可直接使用</span></div>
        <blockquote>「市場不只在找高績效，也正在追問持股與換股邏輯。先用『怎麼選』打開對話，再用經理人的投資方法建立信任。」</blockquote>
        <div className="talk-tags"><span>開場｜怎麼選</span><span>證據｜績效</span><span>收斂｜國泰動能高息</span></div>
      </div>
    </div>
  );
  return (
    <div className="department-grid">
      <div className="mini-panel competitor-panel">
        <div className="section-heading"><div><span className="eyebrow">COMPETITOR RADAR</span><h3>同業聲量追蹤</h3></div><span className="tag">台灣</span></div>
        {[{n:"主動復華未來50",h:72,g:56},{n:"主動統一升級50",h:23,g:113},{n:"群益科技創新",h:23,g:-32},{n:"野村臺灣優選",h:5,g:492}].map(x=><button className="competitor-row" key={x.n}><b>{x.n}</b><span><i style={{width:`${x.h}%`}} /></span><strong>{x.h}</strong><em className={x.g>=0?"up":"down"}>{x.g>=0?"+":""}{x.g}%</em></button>)}
      </div>
      <div className="mini-panel opportunity-card">
        <span className="eyebrow">WHITE SPACE</span><div className="opportunity-number">01</div><h3>「持股透明度」可成為產品溝通缺口</h3><p>持股與換股詞出現高動能，但多數品牌尚未形成穩定內容資產。</p><button>建立機會卡 <span>↗</span></button>
      </div>
    </div>
  );
}

export default function Home() {
  const [department, setDepartment] = useState<Department>("marketing");
  const [algorithm, setAlgorithm] = useState<Algorithm>("composite");
  const [period, setPeriod] = useState<Period>("12 個月");
  const [marketCategory, setMarketCategory] = useState<EtfCategory>("主動式ETF");
  const [cloudPeriod, setCloudPeriod] = useState<CloudPeriod>("近 3 個月");
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Keyword>(keywordData[13]);
  const [customKeywords, setCustomKeywords] = useState<Keyword[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cathay-trend-keywords");
      if (saved) setCustomKeywords(JSON.parse(saved));
    } catch { /* local-only enhancement */ }
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const close = (event: globalThis.KeyboardEvent) => event.key === "Escape" && setModalOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modalOpen]);

  const allKeywords = useMemo(() => [...keywordData, ...customKeywords], [customKeywords]);
  const filtered = useMemo(() => allKeywords.filter(item => (category === "全部" || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase())), [allKeywords, category, query]);
  const ranked = useMemo(() => [...allKeywords].sort((a,b)=>scoreFor(b,algorithm)-scoreFor(a,algorithm)), [allKeywords, algorithm]);
  const currentDepartment = departments[department];
  const marketProfile = categoryProfiles[marketCategory];
  const marketRanking = useMemo(() => [...marketProfile.keywords].sort((a,b)=>b.z-a.z), [marketProfile]);

  function showToast(message: string) { setToast(message); window.setTimeout(()=>setToast(""), 2400); }
  function addKeyword(event: FormEvent) {
    event.preventDefault();
    const name = newKeyword.trim();
    if (!name || allKeywords.some(item=>item.name===name)) return;
    const item: Keyword = { name, heat: 0, growth: 0, latest: 0, peak: 0, category: "需求", custom: true };
    const next = [...customKeywords, item];
    setCustomKeywords(next); localStorage.setItem("cathay-trend-keywords", JSON.stringify(next)); setSelected(item); setNewKeyword(""); setModalOpen(false); showToast(`已新增「${name}」`);
  }
  function exportCsv() {
    const header = "關鍵字,分類,近13週熱度,動能%,最新值,峰值\n";
    const body = allKeywords.map(x=>`"${x.name}",${x.category},${x.heat},${x.growth},${x.latest},${x.peak}`).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿"+header+body], {type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href=url; link.download="ETF_Trend_Radar_2026-08-09.csv"; link.click(); URL.revokeObjectURL(url); showToast("報告已匯出");
  }
  function positionFor(item: Keyword, index: number) {
    const x = 8 + Math.min(84, item.latest * .78 + (index % 5) * 3.2);
    const normalized = (Math.max(-100, Math.min(150, item.growth)) + 100) / 250;
    const y = 88 - normalized * 72 + ((index * 7) % 11 - 5);
    const size = 28 + Math.sqrt(Math.max(1,item.heat)) * 6.3;
    return { left:`${x}%`, top:`${Math.max(8,Math.min(88,y))}%`, width:`${size}px`, height:`${size}px`, zIndex:Math.round(size) };
  }
  function inspectMarketKeyword(item: MarketKeyword) {
    const existing = allKeywords.find(keyword => keyword.name === item.name);
    setSelected(existing || { name:item.name, heat:Math.round(item.recent), growth:Math.round(item.z*10), latest:Math.round(item.recent), peak:100, category:"需求" });
    document.getElementById("trend-map")?.scrollIntoView({behavior:"smooth"});
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-label="CIP 小樹洞">
          <span className="brand-cip">CIP</span>
          <span>小樹洞</span>
        </div>
        <nav aria-label="部門儀表板">
          {(Object.keys(departments) as Department[]).map(key=><button key={key} className={department===key?"active":""} onClick={()=>setDepartment(key)}><i>{key==="marketing"?"M":key==="sales"?"S":"P"}</i><span>{departments[key].label}<small>{departments[key].kicker}</small></span></button>)}
          <button onClick={()=>document.getElementById("trend-map")?.scrollIntoView({behavior:"smooth"})}><i>⌁</i><span>趨勢雷達<small>50 組關鍵字</small></span></button>
          <button onClick={()=>setModalOpen(true)}><i>＋</i><span>關鍵字管理<small>本機資料</small></span></button>
        </nav>
        <div className="sidebar-status"><span className="status-light" /><div><b>資料已同步</b><small>更新至 2026.08.09</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>ETF 專區</span><b>›</b>Google Trends 決策台<b>›</b>{currentDepartment.label}</div>
          <div className="top-actions"><button aria-label="搜尋" onClick={()=>document.getElementById("keyword-search")?.focus()}>⌕</button><button onClick={()=>department==="sales"?document.getElementById("sales-export")?.click():exportCsv()}>匯出報告 <span>↗</span></button><div className="avatar">User</div></div>
        </header>

        <div className="content">
          {department === "sales" ? <SalesDashboard /> : <>
          <section className="mode-tabs" aria-label="主要視圖">
            <button className="active">{currentDepartment.label}決策台</button>
            <button onClick={()=>document.getElementById("trend-map")?.scrollIntoView({behavior:"smooth"})}>關鍵字全景</button>
          </section>
          <section className="hero">
            <div><span className="eyebrow">{currentDepartment.kicker} · GOOGLE TRENDS FACTS</span><h1>{currentDepartment.title}</h1><p>{currentDepartment.description}</p></div>
            <div className="control-stack">
              <div className="segmented" aria-label="分析期間">{(["30 天","90 天","12 個月","5 年"] as Period[]).map(x=><button key={x} onClick={()=>setPeriod(x)} className={period===x?"active":""}>{x}</button>)}</div>
              <div className="algorithm-control"><span>推薦邏輯</span><select value={algorithm} onChange={e=>setAlgorithm(e.target.value as Algorithm)} aria-label="推薦邏輯"><option value="composite">綜合評分</option><option value="heat">熱度最高</option><option value="growth">成長最快</option><option value="predict">趨勢預測</option></select></div>
            </div>
          </section>

          <section className="kpi-strip">
            <article><span>市場焦點</span><b>{ranked[0].name}</b><small>目前推薦邏輯第一名</small></article>
            <article><span>近 13 週熱度</span><b>{ranked[0].heat}<em>/100</em></b><small>Google Trends 相對指數</small></article>
            <article><span>動能訊號</span><b className={ranked[0].growth>=0?"positive":"negative"}>{ranked[0].growth>=0?"+":""}{ranked[0].growth}%</b><small>相較前 13 週</small></article>
            <article><span>追蹤範圍</span><b>{allKeywords.length}<em> 組</em></b><small>2021.08 — 2026.08</small></article>
          </section>

          <section className="recommendation-block">
            <div className="section-heading"><div><span className="eyebrow">NEXT MONTH PLAYBOOK</span><h2>下個月各周主推節奏</h2></div><div className="confidence"><span>策略信心</span><b>82</b><i style={{width:"82%"}} /></div></div>
            <div className="week-grid">{recommendations[algorithm].map((item,index)=><article key={item.product} className={index===0?"featured":""}><div className="week-top"><span>W{index+1}</span><small>{index===0?"01–07":index===1?"08–14":index===2?"15–21":"22–月底"}</small></div><h3>{item.product}</h3><b>{item.action}</b><p>{item.reason}</p><footer><span>{item.channel}</span><button onClick={()=>showToast(`已開啟 W${index+1} 策略卡`)}>↗</button></footer></article>)}</div>
          </section>

          <DepartmentPanel department={department} onToast={showToast} />

          <CipDataSection />

          <section className="trend-panel">
            <div className="section-heading"><div><span className="eyebrow">RELATIVE HEAT OVER TIME</span><h2>核心字詞相對熱度</h2></div><span className="source-pill">Google Trends · Taiwan</span></div>
            <div className="chart-wrap"><TrendCanvas period={period} /></div>
            <div className="chart-legend">{Object.keys(monthlySeries).filter(k=>k!=="labels").map((key,i)=><button key={key} onClick={()=>{const found=allKeywords.find(x=>x.name===key); if(found)setSelected(found)}}><i style={{background:chartColors[i]}} />{key}</button>)}</div>
          </section>

          <section className="bubble-panel" id="trend-map">
            <div className="section-heading bubble-heading"><div><span className="eyebrow">ALL KEYWORDS · SAME MOMENT</span><h2>ETF 關鍵字宇宙</h2><p>泡泡大小＝近 13 週熱度｜水平＝最新熱度｜垂直＝成長動能</p></div><button className="add-keyword" onClick={()=>setModalOpen(true)}>＋ 新增關鍵字</button></div>
            <div className="filter-row">
              <div className="category-tabs">{["全部","需求","代號","同業","洞察"].map(x=><button key={x} className={category===x?"active":""} onClick={()=>setCategory(x)}>{x}</button>)}</div>
              <label className="search-box">⌕<input id="keyword-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜尋 50 組關鍵字" /></label>
            </div>
            <div className="bubble-layout">
              <div className="bubble-stage">
                <div className="axis-y"><span>動能高</span><span>動能低</span></div><div className="axis-x"><span>最新熱度低</span><span>最新熱度高</span></div>
                <div className="quadrant q1">爆發機會</div><div className="quadrant q2">主流焦點</div><div className="quadrant q3">長尾觀察</div><div className="quadrant q4">高熱降溫</div>
                {filtered.map((item,index)=><button key={item.name} className={`bubble ${item.category} ${selected.name===item.name?"selected":""} ${item.heat===0?"dormant":""}`} style={positionFor(item,index)} onClick={()=>setSelected(item)} title={`${item.name}｜熱度 ${item.heat}｜動能 ${item.growth}%`}><span>{item.name}</span><b>{item.heat}</b></button>)}
                {filtered.length===0&&<div className="empty-state">找不到符合的關鍵字</div>}
              </div>
              <aside className="insight-panel">
                <div className="insight-top"><span className="tag">{selected.category}</span><small>INSIGHT / 01</small></div><h3>{selected.name}</h3><p className="insight-summary">{selected.custom?"新關鍵字已加入追蹤清單，串接資料庫後將自動取得 Google Trends 指數。":selected.growth>50?"搜尋動能正快速升溫，適合先建立內容卡位，並觀察是否延續兩個週期。":selected.heat>30?"目前仍有明顯搜尋需求，適合作為比較頁、業務話術與搜尋廣告的主要入口。":"屬於長尾或事件型訊號，建議搭配產品檔期觀察，不單獨重押預算。"}</p>
                <div className="insight-metrics"><div><span>近 13 週</span><b>{selected.heat}</b></div><div><span>最新指數</span><b>{selected.latest}</b></div><div><span>動能</span><b className={selected.growth>=0?"positive":"negative"}>{selected.growth>=0?"+":""}{selected.growth}%</b></div></div>
                <div className="signal-list"><div><i className="signal green" /><span><b>搜尋意圖</b><small>{selected.name.includes("績效")?"驗證型":selected.name.includes("持股")||selected.name.includes("換股")?"研究型":"探索型"}</small></span></div><div><i className="signal yellow" /><span><b>建議內容</b><small>{selected.category==="同業"?"同業比較卡":selected.category==="洞察"?"深度解讀":"新手選擇指南"}</small></span></div><div><i className="signal blue" /><span><b>優先渠道</b><small>{department==="marketing"?"FB + Threads":"產品情報站"}</small></span></div></div>
                <button className="primary-action" onClick={()=>showToast(`已將「${selected.name}」加入下月策略`)}>加入下月策略 <span>＋</span></button>
              </aside>
            </div>
            <p className="data-disclaimer">Google Trends 指數為 0–100 的相對搜尋熱度，不等同實際搜尋量；跨字詞比較應以共同基準詞校正。本 MVP 依附檔週頻資料彙整，資料截至 2026/08/09。</p>
          </section>

          <EtfProductTable />
          </>}
        </div>
      </section>

      <AgentChat />
      {modalOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setModalOpen(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={()=>setModalOpen(false)} aria-label="關閉">×</button><span className="eyebrow">KEYWORD MANAGER</span><h2 id="modal-title">新增追蹤關鍵字</h2><p>這一版會先儲存在你的瀏覽器；資料庫串接後可自動同步團隊清單。</p><form onSubmit={addKeyword}><label>ETF 關鍵字<input autoFocus value={newKeyword} onChange={e=>setNewKeyword(e.target.value)} placeholder="例如：高股息 ETF 怎麼選" onKeyDown={(e:KeyboardEvent<HTMLInputElement>)=>e.key==="Escape"&&setModalOpen(false)} /></label><div className="modal-actions"><button type="button" onClick={()=>setModalOpen(false)}>取消</button><button type="submit" disabled={!newKeyword.trim()}>加入追蹤</button></div></form></div></div>}
      {toast&&<div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
