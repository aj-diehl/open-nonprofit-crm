import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RangeOption = "3m" | "6m" | "12m" | "24m" | "ytd";

type SeriesPoint = { month: string; total: number };

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthKeyFromString(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 7) return null;
  const key = trimmed.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : null;
}

export function toCumulative(series: SeriesPoint[]) {
  let running = 0;
  return series.map((point) => {
    running += point.total;
    return { ...point, total: running };
  });
}

export function getRangeWindow(range: RangeOption) {
  const now = new Date();
  const monthsToLoad = range === "ytd" ? now.getMonth() + 1 : Number(range.replace("m", ""));
  const start =
    range === "ytd"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  if (range !== "ytd") {
    start.setMonth(start.getMonth() - (monthsToLoad - 1));
  }

  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsToLoad);

  return { start, end, monthsToLoad };
}

export async function loadDonationSeries(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  orgId: string,
  range: RangeOption
): Promise<SeriesPoint[]> {
  const { start, end, monthsToLoad } = getRangeWindow(range);

  const { data, error } = await supabase.rpc("dashboard_donation_series", {
    p_org_id: orgId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) {
    console.warn("[dashboard] failed to load donation series", error);
  }

  const buckets = new Map<string, number>();
  for (const row of (data || []) as Array<{ month?: string | Date; total?: number }>) {
    if (!row?.month) continue;
    let key: string | null = null;
    if (typeof row.month === "string") {
      key = toMonthKeyFromString(row.month);
    } else if (row.month instanceof Date) {
      key = toMonthKey(row.month);
    }
    if (!key) continue;
    buckets.set(key, Number(row.total || 0));
  }

  const months: SeriesPoint[] = [];
  const cursor = new Date(start);
  cursor.setDate(1);

  for (let i = 0; i < monthsToLoad; i++) {
    const key = toMonthKey(cursor);
    months.push({ month: key, total: buckets.get(key) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}
