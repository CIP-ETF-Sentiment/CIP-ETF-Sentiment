import { NextResponse } from "next/server";
import { loadCategoryTrends } from "@/app/lib/trends.server";

export const runtime = "nodejs";

export async function GET() {
  const trends = await loadCategoryTrends();
  return NextResponse.json(trends);
}
