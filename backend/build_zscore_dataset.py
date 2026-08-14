"""Parse the pre-computed Z-score workbooks into dashboard JSON.

Input:  backend/raw/z_score/<category_slug>.xlsx
        Columns: Keyword, Historical_Mean, Mean_2026, Recent_3M_Mean,
                 Z_2026, Recent_Z  ("inf" marks a keyword with no
                 historical baseline, i.e. a brand-new breakout term)
Output: frontend/public/data/zscore.json

Uses only the standard library (zipfile + xml.etree) since an xlsx
file is just a zip of XML parts — no pandas/openpyxl dependency needed.
"""

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent / "raw" / "z_score"
OUT_PATH = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data" / "zscore.json"

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

CATEGORY_LABELS = {
    "active_etf": "主動式ETF",
    "bond_etf": "債券型ETF",
    "market_cap_etf": "市值型ETF",
    "sector_etf": "產業型ETF",
    "high_dividend_etf": "高股息ETF",
}

COLUMNS = ["keyword", "historical_mean", "mean_2026", "recent_3m_mean", "z_2026", "recent_z"]


def _col_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref).group(0)
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


def _read_rows(path: Path) -> list[list[str | None]]:
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", NS):
                shared.append("".join(t.text or "" for t in si.findall(".//m:t", NS)))

        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//m:row", NS):
            cells = {}
            for c in row.findall("m:c", NS):
                idx = _col_index(c.get("r"))
                cell_type = c.get("t")
                if cell_type == "inlineStr":
                    text = "".join(t.text or "" for t in c.findall(".//m:t", NS))
                else:
                    v = c.find("m:v", NS)
                    text = v.text if v is not None else None
                    if cell_type == "s" and text is not None:
                        text = shared[int(text)]
                cells[idx] = text
            width = max(cells.keys(), default=-1) + 1
            rows.append([cells.get(i) for i in range(width)])
        return rows


def _number_or_flag(raw: str | None) -> tuple[float | None, bool]:
    """Returns (value, is_breakout). Breakout = no historical baseline (z was inf)."""
    if raw is None or raw == "":
        return None, False
    if raw.strip().lower() == "inf":
        return None, True
    return round(float(raw), 4), False


def parse_category(path: Path) -> list[dict]:
    rows = _read_rows(path)
    keywords = []
    for row in rows[1:]:  # skip header row
        row = row + [None] * (len(COLUMNS) - len(row))
        keyword = row[0]
        if not keyword:
            continue
        historical_mean, _ = _number_or_flag(row[1])
        mean_2026, _ = _number_or_flag(row[2])
        recent_3m_mean, _ = _number_or_flag(row[3])
        z_2026, z_2026_breakout = _number_or_flag(row[4])
        recent_z, recent_z_breakout = _number_or_flag(row[5])

        if historical_mean is None and mean_2026 is None and recent_3m_mean is None:
            continue  # keyword listed but no computed stats (leftover row)

        keywords.append(
            {
                "keyword": keyword,
                "historical_mean": historical_mean,
                "mean_2026": mean_2026,
                "recent_3m_mean": recent_3m_mean,
                "z_2026": z_2026,
                "z_2026_breakout": z_2026_breakout,
                "recent_z": recent_z,
                "recent_z_breakout": recent_z_breakout,
            }
        )
    return keywords


def main():
    files = sorted(RAW_DIR.glob("*.xlsx"))
    if not files:
        print(f"No xlsx files found in {RAW_DIR}")
        return

    categories = []
    for path in files:
        slug = path.stem
        keywords = parse_category(path)
        categories.append(
            {
                "slug": slug,
                "label": CATEGORY_LABELS.get(slug, slug),
                "keywords": keywords,
            }
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"categories": categories}, f, ensure_ascii=False, indent=2)

    for cat in categories:
        print(f"{cat['slug']}: {len(cat['keywords'])} keywords")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
