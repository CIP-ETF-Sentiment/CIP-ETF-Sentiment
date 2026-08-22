"""Build the business-dashboard dataset from the IT feed and weekly Trends export.

The workbook is read with the Python standard library so the data build stays
portable and does not add another runtime dependency to the frontend.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any


SHEET_NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ETF_TYPE_ORDER = ["ACT", "MKT", "BOND", "IND", "DIV"]
DIMENSION_ORDER = ["DEMAND", "TOPIC", "TIMING", "CONCERN"]


def excel_column(index: int) -> str:
    column = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        column = chr(65 + remainder) + column
    return column


def parse_sheet(feed_path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(feed_path) as workbook:
        root = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))

    sheet_rows: list[dict[str, str]] = []
    for row in root.findall(".//x:sheetData/x:row", SHEET_NS):
        values: dict[str, str] = {}
        for cell in row.findall("x:c", SHEET_NS):
            reference = cell.get("r", "")
            match = re.match(r"[A-Z]+", reference)
            if not match:
                continue
            value_node = cell.find("x:v", SHEET_NS)
            if value_node is not None:
                value = value_node.text or ""
            else:
                value = "".join(node.text or "" for node in cell.findall(".//x:t", SHEET_NS))
            values[match.group()] = value
        sheet_rows.append(values)

    headers = [sheet_rows[0].get(excel_column(index), "") for index in range(1, 26)]
    return [
        {headers[index - 1]: row.get(excel_column(index), "") for index in range(1, 26)}
        for row in sheet_rows[1:]
    ]


def parse_raw_value(raw_value: str) -> float | None:
    if raw_value == "":
        return None
    if raw_value == "<1":
        return 0.5
    return float(raw_value)


def percentile_rank(values: list[float], current: float) -> float | None:
    if len(values) < 2:
        return None
    lower = sum(value < current for value in values)
    equal = sum(value == current for value in values)
    return (lower + (equal - 1) / 2) / (len(values) - 1) * 100


def optional_float(value: str) -> float | None:
    return float(value) if value != "" else None


def build_dataset(feed_path: Path, trends_path: Path) -> dict[str, Any]:
    feed_rows = parse_sheet(feed_path)
    keyword_rows = [row for row in feed_rows if row["Record_Type"] == "KEYWORD_MAP"]
    product_rows = [row for row in feed_rows if row["Record_Type"] == "ETF_PRODUCT"]

    weekly_series: dict[str, list[tuple[str, float | None]]] = defaultdict(list)
    raw_less_than_one = 0
    raw_missing = 0
    with trends_path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            raw_value = row["Raw_GT"]
            raw_less_than_one += raw_value == "<1"
            raw_missing += raw_value == ""
            weekly_series[row["Keyword"]].append((row["Date"], parse_raw_value(raw_value)))

    for values in weekly_series.values():
        values.sort(key=lambda item: item[0])

    mappings_by_keyword: dict[str, list[dict[str, Any]]] = defaultdict(list)
    keyword_name_by_id: dict[str, str] = {}
    dimension_by_id: dict[str, tuple[str, str]] = {}
    type_labels: dict[str, str] = {}

    for row in keyword_rows:
        keyword_id = row["Keyword_ID"]
        keyword_name_by_id[keyword_id] = row["Keyword"]
        type_labels[row["ETF_Type_Code"]] = row["ETF_Type"]
        current_dimension = (row["Dimension_Code"], row["Dimension"])
        if keyword_id in dimension_by_id and dimension_by_id[keyword_id] != current_dimension:
            raise ValueError(f"Keyword {keyword_id} has conflicting dimensions")
        dimension_by_id[keyword_id] = current_dimension
        mappings_by_keyword[keyword_id].append(
            {
                "etfTypeCode": row["ETF_Type_Code"],
                "etfType": row["ETF_Type"],
                "productTheme": row["Product_Theme"],
                "joinKey": row["Join_Key"],
                "isPrimary": row["Is_Primary"] == "1",
                "recentZ": optional_float(row["Recent_Z"]),
                "zValid": row["Z_Valid"] == "1",
            }
        )

    keywords: list[dict[str, Any]] = []
    for keyword_id, name in keyword_name_by_id.items():
        full_series = weekly_series.get(name, [])
        recent = full_series[-52:]
        valid_values = [value for _, value in recent if value is not None]
        latest = recent[-1][1] if recent else None
        previous = recent[-2][1] if len(recent) > 1 else None
        dimension_code, dimension = dimension_by_id[keyword_id]
        mappings = sorted(
            mappings_by_keyword[keyword_id],
            key=lambda item: (
                not item["isPrimary"],
                ETF_TYPE_ORDER.index(item["etfTypeCode"]),
            ),
        )
        keywords.append(
            {
                "id": keyword_id,
                "name": name,
                "dimensionCode": dimension_code,
                "dimension": dimension,
                "latestRaw": latest,
                "previousRaw": previous,
                "weekDelta": None if latest is None or previous is None else latest - previous,
                "percentile52": None if latest is None else percentile_rank(valid_values, latest),
                "validWeeks52": len(valid_values),
                "trend52": [value for _, value in recent],
                "mappings": mappings,
            }
        )

    keyword_name_set = set(weekly_series)
    feed_keyword_set = set(keyword_name_by_id.values())
    if keyword_name_set != feed_keyword_set:
        raise ValueError(
            "The weekly Trends keywords and workbook keywords do not reconcile: "
            f"weekly-only={len(keyword_name_set - feed_keyword_set)}, "
            f"feed-only={len(feed_keyword_set - keyword_name_set)}"
        )

    product_groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in product_rows:
        product_groups[row["ETF_Code"]].append(row)

    products: list[dict[str, Any]] = []
    for code, rows in product_groups.items():
        source_row = rows[0]
        products.append(
            {
                "code": code,
                "name": source_row["ETF_Name"],
                "issuer": source_row["Issuer"],
                "topicStatus": source_row["Topic_Status"],
                "shortHeat": optional_float(source_row["Short_Heat"]),
                "longHeat": optional_float(source_row["Long_Heat"]),
                "aumTwd": optional_float(source_row["AUM_TWD"]),
                "aumMom": optional_float(source_row["AUM_MoM"]),
                "netSubscriptionTwd": optional_float(source_row["Net_Subscription_TWD"]),
                "holdersMom": optional_float(source_row["Holders_MoM"]),
                "dcaMom": optional_float(source_row["DCA_MoM"]),
                "return1mPct": optional_float(source_row["Return_1M_Pct"]),
                "joinKeys": sorted({row["Join_Key"] for row in rows}),
                "primaryJoinKeys": sorted({row["Join_Key"] for row in rows if row["Is_Primary"] == "1"}),
                "etfTypeCodes": sorted(
                    {row["ETF_Type_Code"] for row in rows},
                    key=ETF_TYPE_ORDER.index,
                ),
            }
        )

    latest_date = max(date for values in weekly_series.values() for date, _ in values)
    earliest_date = min(date for values in weekly_series.values() for date, _ in values)
    dates52 = [date for date, _ in next(iter(weekly_series.values()))[-52:]]

    dimensions = []
    for code in DIMENSION_ORDER:
        label = next(row["Dimension"] for row in keyword_rows if row["Dimension_Code"] == code)
        descriptions = {
            "DEMAND": "正在找產品與比較選項",
            "TOPIC": "正在關注市場與投資題材",
            "TIMING": "正在尋找進場、加碼或停利時點",
            "CONCERN": "正在確認風險、費用與市場疑慮",
        }
        dimensions.append({"code": code, "label": label, "description": descriptions[code]})

    return {
        "updatedAt": latest_date,
        "dateRange": {"start": earliest_date, "end": latest_date},
        "dates52": dates52,
        "sourceFiles": {"feed": feed_path.name, "trends": trends_path.name},
        "methodology": {
            "percentile": "Latest value ranked within each keyword's latest 52 valid weekly observations",
            "coverage": "Keywords with 52W percentile >= 80 divided by keywords with at least 13 valid weeks",
            "lessThanOne": "Google Trends '<1' values are represented as 0.5",
        },
        "dataQuality": {
            "weeklyRows": sum(len(values) for values in weekly_series.values()),
            "rawMissing": raw_missing,
            "rawLessThanOne": raw_less_than_one,
            "keywordMappings": len(keyword_rows),
            "productMappings": len(product_rows),
        },
        "etfTypes": [
            {"code": code, "label": type_labels[code]}
            for code in ETF_TYPE_ORDER
        ],
        "dimensions": dimensions,
        "keywords": sorted(keywords, key=lambda item: item["id"]),
        "products": sorted(products, key=lambda item: item["code"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed", required=True, type=Path, help="Path to the IT feed .xlsx")
    parser.add_argument("--trends", required=True, type=Path, help="Path to the long-format weekly CSV")
    parser.add_argument("--output", required=True, type=Path, help="Output JSON path")
    args = parser.parse_args()

    dataset = build_dataset(args.feed, args.trends)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(dataset, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"Wrote {args.output} with {len(dataset['keywords'])} keywords "
        f"and {len(dataset['products'])} products"
    )


if __name__ == "__main__":
    main()
