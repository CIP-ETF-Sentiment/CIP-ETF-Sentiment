import analysis from "@/public/data/analysis.json";
import HeatChart from "./components/HeatChart";

const TOP_N = 20;

export default function Home() {
  const sorted = [...analysis].sort(
    (a, b) => (b.z_score ?? 0) - (a.z_score ?? 0)
  );
  const top = sorted.slice(0, TOP_N);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="mx-auto flex max-w-3xl flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            ETF 情緒熱度儀表板
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Google Trends 關鍵字熱度 vs. 歷史水準（Z-score），前 {TOP_N} 名 ·
            共 {sorted.length} 個關鍵字
          </p>
        </div>

        <HeatChart data={top} />

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <th className="py-2">分類</th>
              <th className="py-2">關鍵字</th>
              <th className="py-2">歷史平均</th>
              <th className="py-2">近期平均</th>
              <th className="py-2">Z-score</th>
            </tr>
          </thead>
          <tbody>
            {top.map((row) => (
              <tr
                key={`${row.category}-${row.keyword}`}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-2 text-zinc-500">{row.category_label}</td>
                <td className="py-2">{row.keyword}</td>
                <td className="py-2">{row.historical_mean ?? "-"}</td>
                <td className="py-2">{row.current_mean ?? "-"}</td>
                <td className="py-2">{row.z_score ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
