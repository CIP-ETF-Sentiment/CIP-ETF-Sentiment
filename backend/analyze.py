"""Compute Z-scores for keyword heat vs. historical baseline.

Reads data/trends.json (produced by fetch_trends.py), writes
data/analysis.json for the frontend dashboard.
"""

import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"


def load_trends() -> pd.DataFrame:
    with open(DATA_DIR / "trends.json", encoding="utf-8") as f:
        trends = json.load(f)

    frames = []
    for keyword, points in trends.items():
        if not points:
            continue
        df = pd.DataFrame(points)
        df["date"] = pd.to_datetime(df["date"])
        df = df.rename(columns={"value": keyword}).drop(columns=[])
        frames.append(df.set_index("date")[[keyword]])

    if not frames:
        return pd.DataFrame()

    merged = pd.concat(frames, axis=1)
    return merged.sort_index()


def compute_zscores(daily_df: pd.DataFrame) -> pd.DataFrame:
    monthly = daily_df.resample("ME").mean()

    current_year = monthly.index.max().year
    historical = monthly[monthly.index.year < current_year]
    current = monthly[monthly.index.year == current_year]

    rows = []
    for keyword in daily_df.columns:
        hist_mean = historical[keyword].mean()
        hist_std = historical[keyword].std()
        current_mean = current[keyword].mean()
        z = (current_mean - hist_mean) / hist_std if hist_std else None

        rows.append(
            {
                "keyword": keyword,
                "historical_mean": None if pd.isna(hist_mean) else round(hist_mean, 2),
                "current_mean": None if pd.isna(current_mean) else round(current_mean, 2),
                "z_score": None if z is None or pd.isna(z) else round(z, 2),
            }
        )

    return pd.DataFrame(rows).sort_values("z_score", ascending=False)


def main():
    daily_df = load_trends()
    if daily_df.empty:
        print("No trend data found — run fetch_trends.py first.")
        return

    result_df = compute_zscores(daily_df)

    out_path = DATA_DIR / "analysis.json"
    result_df.to_json(out_path, orient="records", force_ascii=False, indent=2)

    print(f"Wrote analysis for {len(result_df)} keywords to {out_path}")


if __name__ == "__main__":
    main()
