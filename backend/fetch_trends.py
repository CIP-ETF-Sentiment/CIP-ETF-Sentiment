"""Fetch Google Trends data for ETF-related keywords via pytrends.

Replaces the Selenium-based approach in the original test.py — pytrends
calls the Trends API directly, so this can run unattended in CI (no
browser needed).
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"
KEYWORDS_FILE = Path(__file__).resolve().parent / "keywords.json"


def load_keywords() -> list[str]:
    with open(KEYWORDS_FILE, encoding="utf-8") as f:
        return json.load(f)


def fetch_trends(keywords: list[str]) -> dict:
    from pytrends.request import TrendReq

    pytrends = TrendReq(hl="zh-TW", tz=480)
    results = {}

    for keyword in keywords:
        pytrends.build_payload([keyword], timeframe="today 5-y", geo="TW")
        df = pytrends.interest_over_time()

        if df.empty:
            results[keyword] = []
            continue

        results[keyword] = [
            {"date": str(date.date()), "value": int(row[keyword])}
            for date, row in df.iterrows()
        ]

    return results


def main():
    DATA_DIR.mkdir(exist_ok=True)
    keywords = load_keywords()
    trends = fetch_trends(keywords)

    out_path = DATA_DIR / "trends.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(trends, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(trends)} keywords to {out_path}")


if __name__ == "__main__":
    main()
