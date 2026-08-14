import Dashboard from "./components/Dashboard";
import { loadCategoryTrends } from "./lib/trends.server";
import type { ZScoreDataset } from "./lib/zscore";
import dataset from "@/public/data/zscore.json";

export default async function Home() {
  const trends = await loadCategoryTrends();
  return <Dashboard dataset={dataset as ZScoreDataset} trends={trends} />;
}
