import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExpenseCategory, ExpenseStatus } from "@/lib/types";
import type { EntryFilters } from "@/components/FiltersBar";

// Shared between the admin entries page and the CSV export route so both
// apply identical filtering logic.
export function filteredExpensesQuery(
  supabase: SupabaseClient<Database>,
  filters: EntryFilters
) {
  let query = supabase.from("expenses").select("*");

  if (filters.employee) query = query.eq("user_id", filters.employee);
  if (filters.job) query = query.ilike("job_name", `%${filters.job}%`);
  if (filters.category) query = query.eq("category", filters.category as ExpenseCategory);
  if (filters.status) query = query.eq("status", filters.status as ExpenseStatus);
  if (filters.from) query = query.gte("expense_date", filters.from);
  if (filters.to) query = query.lte("expense_date", filters.to);

  return query.order("expense_date", { ascending: false }).order("created_at", { ascending: false });
}

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): EntryFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    employee: get("employee") || undefined,
    job: get("job") || undefined,
    category: get("category") || undefined,
    status: get("status") || undefined,
    from: get("from") || undefined,
    to: get("to") || undefined,
  };
}
