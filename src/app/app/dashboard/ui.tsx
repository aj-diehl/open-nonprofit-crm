"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/shared/money";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const monthFormatterWithYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });
const monthFormatterFull = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatMonthTick(monthKey: string, showYear: boolean) {
  const date = parseMonthKey(monthKey);
  return showYear ? monthFormatterWithYear.format(date) : monthFormatter.format(date);
}

function formatMonthTooltip(monthKey: string) {
  const date = parseMonthKey(monthKey);
  return monthFormatterFull.format(date);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !label || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);

  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
      <div className="text-xs text-slate-500">{formatMonthTooltip(label)}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(value)}</div>
    </div>
  );
}

export function DonationsChart({ data }: { data: { month: string; total: number }[] }) {
  const showYear = data.length > 12;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="donationsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--muted)" />
          <XAxis
            dataKey="month"
            tickFormatter={(value) => formatMonthTick(String(value), showYear)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--ink-600)" }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(Number(value))}
            tickLine={false}
            axisLine={false}
            width={80}
            tick={{ fontSize: 12, fill: "var(--ink-600)" }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#donationsGradient)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--primary)", fill: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
