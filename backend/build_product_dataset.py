#!/usr/bin/env python3
"""Convert the product workbook's frontend table to static JSON."""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
CORE_NS = "http://purl.org/dc/terms/"
NS = {"m": MAIN_NS, "dcterms": CORE_NS}
CELL_TO_FIELD = {
    "A": "isRecentOffering",
    "B": "code",
    "C": "name",
    "D": "issuer",
    "E": "category",
    "F": "topicStatus",
    "G": "shortHeat",
    "H": "longHeat",
    "I": "aum",
    "J": "aumMom",
    "K": "netSubscription",
    "L": "beneficiariesMom",
    "M": "recurringInvestmentMom",
    "N": "oneMonthReturn",
    "O": "categoryRank",
    "P": "eventType",
    "Q": "eventDate",
    "R": "eventValue",
    "S": "newsUrl",
}
NUMBER_FIELDS = {
    "shortHeat",
    "longHeat",
    "aum",
    "aumMom",
    "netSubscription",
    "beneficiariesMom",
    "recurringInvestmentMom",
    "oneMonthReturn",
    "eventValue",
}


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(".//m:t", NS))
        for item in root.findall("m:si", NS)
    ]


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    value = cell.find("m:v", NS)
    raw = value.text if value is not None and value.text is not None else ""
    if cell.get("t") == "s" and raw:
        return strings[int(raw)]
    if cell.get("t") == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//m:t", NS))
    return raw


def excel_date(raw: str) -> str | None:
    if not raw:
        return None
    return (datetime(1899, 12, 30) + timedelta(days=float(raw))).date().isoformat()


def number(raw: str) -> float | int | None:
    if not raw:
        return None
    value = float(raw)
    return int(value) if value.is_integer() else value


def workbook_date(archive: zipfile.ZipFile) -> str:
    core = ET.fromstring(archive.read("docProps/core.xml"))
    modified = core.find("dcterms:modified", NS)
    if modified is None or not modified.text:
        return ""
    return modified.text[:10]


def build_dataset(input_path: Path) -> dict[str, object]:
    with zipfile.ZipFile(input_path) as archive:
        strings = shared_strings(archive)
        worksheet = ET.fromstring(archive.read("xl/worksheets/sheet2.xml"))
        if worksheet.findall(".//m:f", NS):
            raise ValueError("Product worksheet must contain fixed values, not formulas")

        products: list[dict[str, object]] = []
        rows = worksheet.findall(".//m:sheetData/m:row", NS)
        for row in rows[1:]:
            raw_row: dict[str, str] = {}
            for cell in row.findall("m:c", NS):
                reference = cell.get("r", "")
                match = re.match(r"[A-Z]+", reference)
                if match:
                    raw_row[match.group()] = cell_value(cell, strings)

            if not raw_row.get("B"):
                continue

            product: dict[str, object] = {}
            for column, field in CELL_TO_FIELD.items():
                raw = raw_row.get(column, "")
                if field == "isRecentOffering":
                    product[field] = raw == "是"
                elif field == "eventDate":
                    product[field] = excel_date(raw)
                elif field in NUMBER_FIELDS:
                    product[field] = number(raw)
                else:
                    product[field] = raw or None
            products.append(product)

        codes = [str(product["code"]) for product in products]
        if len(codes) != len(set(codes)):
            raise ValueError("ETF codes must be unique")

        return {
            "updatedAt": workbook_date(archive),
            "source": input_path.name,
            "products": products,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "frontend/public/data/etf-products.json",
    )
    args = parser.parse_args()

    dataset = build_dataset(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(dataset, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(dataset['products'])} products to {args.output}")


if __name__ == "__main__":
    main()
