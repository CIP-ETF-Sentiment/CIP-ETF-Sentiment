import { NextRequest, NextResponse } from "next/server";
import { getKeywordSeries } from "@/app/lib/trends.server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const keyword = searchParams.get("keyword");

  if (!category || !keyword) {
    return NextResponse.json({ error: "缺少 category 或 keyword 參數" }, { status: 400 });
  }

  const series = await getKeywordSeries(category, keyword);
  if (!series) {
    return NextResponse.json({ error: "找不到此關鍵字的週趨勢資料" }, { status: 404 });
  }

  return NextResponse.json(series);
}
