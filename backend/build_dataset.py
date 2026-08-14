"""Parse manually-downloaded Google Trends CSVs into dashboard JSON.

Input:  backend/raw/<category_slug>.csv  (Google Trends "Multiple terms"
        export — Date column + one column per keyword, values 0-100)
Output: frontend/public/data/trends.json    (raw weekly series, by category)
        frontend/public/data/analysis.json  (Z-score vs. historical baseline)
"""

import json
from pathlib import Path

import pandas as pd

RAW_DIR = Path(__file__).resolve().parent / "raw"
DATA_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"

CATEGORY_LABELS = {
    "active_etf": "主動式ETF",
    "bond_etf": "債券型ETF",
    "market_cap_etf": "市值型ETF",
    "sector_etf": "產業型ETF",
    "high_dividend_etf": "高股息ETF",
}


def load_category(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    df = df.rename(columns={df.columns[0]: "date"})
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    keyword_cols = [c for c in df.columns if c != "date"]
    df[keyword_cols] = df[keyword_cols].apply(pd.to_numeric, errors="coerce")

    return df.set_index("date")[keyword_cols]


def build_trends(categories: dict[str, pd.DataFrame]) -> dict:
    trends = {}
    for slug, df in categories.items():
        trends[slug] = {
            "label": CATEGORY_LABELS.get(slug, slug),
            "keywords": {
                keyword: [
                    {"date": str(date.date()), "value": None if pd.isna(v) else v}
                    for date, v in df[keyword].items()
                ]
                for keyword in df.columns
            },
        }
    return trends


def compute_zscores(categories: dict[str, pd.DataFrame]) -> list[dict]:
    rows = []
    for slug, df in categories.items():
        monthly = df.resample("ME").mean()
        current_year = monthly.index.max().year
        historical = monthly[monthly.index.year < current_year]
        current = monthly[monthly.index.year == current_year]

        for keyword in df.columns:
            hist_mean = historical[keyword].mean()
            hist_std = historical[keyword].std()
            current_mean = current[keyword].mean()
            z = (current_mean - hist_mean) / hist_std if hist_std else None

            rows.append(
                {
                    "category": slug,
                    "category_label": CATEGORY_LABELS.get(slug, slug),
                    "keyword": keyword,
                    "historical_mean": None if pd.isna(hist_mean) else round(hist_mean, 2),
                    "current_mean": None if pd.isna(current_mean) else round(current_mean, 2),
                    "z_score": None if z is None or pd.isna(z) else round(z, 2),
                }
            )

    rows.sort(key=lambda r: (r["z_score"] is None, -(r["z_score"] or 0)))
    return rows


def main():
    csv_files = sorted(RAW_DIR.glob("*.csv"))
    if not csv_files:
        print(f"No CSV files found in {RAW_DIR}")
        return

    categories = {f.stem: load_category(f) for f in csv_files}

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    trends = build_trends(categories)
    with open(DATA_DIR / "trends.json", "w", encoding="utf-8") as f:
        json.dump(trends, f, ensure_ascii=False, indent=2)

    analysis = compute_zscores(categories)
    with open(DATA_DIR / "analysis.json", "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)

    total_keywords = sum(len(df.columns) for df in categories.values())
    print(f"Parsed {len(categories)} categories, {total_keywords} keywords")
    print(f"Wrote {DATA_DIR / 'trends.json'}")
    print(f"Wrote {DATA_DIR / 'analysis.json'}")


if __name__ == "__main__":
    main()
