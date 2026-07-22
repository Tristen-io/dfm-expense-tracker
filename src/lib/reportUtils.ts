import { format, startOfWeek } from "date-fns";
import type { Expense } from "@/lib/types";

export interface TotalRow {
  key: string;
  label: string;
  total: number;
  count: number;
}

function parseUTCDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`);
}

// Only entries with a known amount are counted toward dollar totals — an
// "awaiting price" order (amount === null) has nothing to add yet. Use
// awaitingPriceCount() to surface how many are excluded so they don't get
// forgotten.
function groupBy(expenses: Expense[], keyFn: (e: Expense) => { key: string; label: string }) {
  const map = new Map<string, TotalRow>();
  for (const e of expenses) {
    if (e.amount === null) continue;
    const { key, label } = keyFn(e);
    const existing = map.get(key);
    if (existing) {
      existing.total += e.amount;
      existing.count += 1;
    } else {
      map.set(key, { key, label, total: e.amount, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function totalsByDay(expenses: Expense[]): TotalRow[] {
  return groupBy(expenses, (e) => ({
    key: e.expense_date,
    label: format(parseUTCDate(e.expense_date), "EEE, MMM d, yyyy"),
  }));
}

export function totalsByWeek(expenses: Expense[]): TotalRow[] {
  return groupBy(expenses, (e) => {
    const weekStart = startOfWeek(parseUTCDate(e.expense_date), { weekStartsOn: 1 });
    return {
      key: format(weekStart, "yyyy-MM-dd"),
      label: `Week of ${format(weekStart, "MMM d, yyyy")}`,
    };
  });
}

export function totalsByMonth(expenses: Expense[]): TotalRow[] {
  return groupBy(expenses, (e) => {
    const d = parseUTCDate(e.expense_date);
    return { key: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });
}

export function totalsByJob(expenses: Expense[]): TotalRow[] {
  const rows = groupBy(expenses, (e) => ({ key: e.job_name, label: e.job_name }));
  return rows.sort((a, b) => b.total - a.total);
}

export function grandTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
}

export function awaitingPriceCount(expenses: Expense[]): number {
  return expenses.filter((e) => e.amount === null).length;
}
