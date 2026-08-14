# ETF 情緒熱度儀表板

追蹤 ETF 相關關鍵字在 Google Trends 上的搜尋熱度，計算相對歷史水準的 Z-score，找出目前正在升溫的 ETF 主題。

## 架構

- `backend/raw/*.csv`：手動從 Google Trends 匯出的原始資料，一個 ETF 分類一個檔案（`active_etf`、`bond_etf`、`market_cap_etf`、`sector_etf`、`high_dividend_etf`）。
- `backend/build_dataset.py`：把 `raw/*.csv` 解析、合併，計算 Z-score，輸出到 `frontend/public/data/trends.json`（原始時序）與 `analysis.json`（Z-score 排行）。
- `backend/fetch_trends.py`：用 [pytrends](https://github.com/GeneralMills/pytrends) 直接呼叫 Google Trends API 的自動化腳本，作為未來取代手動下載的備案（目前尚未接進主流程）。
- `.github/workflows/update-trends.yml`：`backend/raw/*.csv` 有變動 push 上去時，自動跑 `build_dataset.py` 並把結果 JSON commit 回 repo。
- `frontend/`：Next.js（App Router）+ Tailwind + Recharts，讀取 `public/data/analysis.json` 呈現熱度儀表板，部署在 Vercel。

資料量小、更新頻率低，所以直接用 JSON 檔當資料層，不另外架資料庫。

## 開發

```bash
# Backend / ETL
cd backend
pip install -r requirements.txt
python build_dataset.py   # 讀 raw/*.csv，產生 trends.json + analysis.json

# 前端
cd frontend
npm install
npm run dev
```

## 新增一批 Google Trends 資料的流程

1. 到 Google Trends 匯出「Multiple terms」CSV（Date + 每個關鍵字一欄）。
2. 存成 `backend/raw/<分類代號>.csv`，分類代號要對應 `backend/build_dataset.py` 裡的 `CATEGORY_LABELS`（沒有的分類要在那邊加一筆對應的中文顯示名稱）。
3. 跑 `python backend/build_dataset.py`，或直接把 CSV push 上 GitHub 讓 Actions 自動跑。

## 部署

前端部署到 Vercel，Root Directory 設為 `frontend/`。資料更新流程是本地/CI 跑 `build_dataset.py` 產生 JSON 並 commit，前端只讀 static JSON，不需要另外的後端服務在線上跑。
