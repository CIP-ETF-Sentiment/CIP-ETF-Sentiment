"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type KeywordStat = {
  keyword: string;
  category_label?: string;
  historical_mean: number | null;
  current_mean: number | null;
  z_score: number | null;
};

export default function HeatChart({ data }: { data: KeywordStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="keyword" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="z_score" fill="#2563eb" />
      </BarChart>
    </ResponsiveContainer>
  );
}
