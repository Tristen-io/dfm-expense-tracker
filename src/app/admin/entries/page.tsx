import Link from "next/link";
import EntriesTable from "@/components/EntriesTable";
import FiltersBar from "@/components/FiltersBar";
import { createClient } from "@/lib/supabase/server";
import { filteredExpensesQuery, parseFilters } from "@/lib/queries";

export default async function AdminEntriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const filters = parseFilters(resolvedParams);

  const supabase = await createClient();
  const [{ data: profiles }, { data: vendors }, { data: expenses }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("vendors").select("*").order("name"),
    filteredExpensesQuery(supabase, filters),
  ]);

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">All entries</h1>
          <p className="mt-1 text-sm text-slate-500">
            {expenses?.length ?? 0} entr{expenses?.length === 1 ? "y" : "ies"} matching filters.
          </p>
        </div>
        <Link
          href={`/admin/export${query ? `?${query}` : ""}`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Export approved to CSV
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <FiltersBar profiles={profiles ?? []} vendors={vendors ?? []} filters={filters} />
      </div>

      <div className="mt-6">
        <EntriesTable expenses={expenses ?? []} mode="admin" />
      </div>
    </div>
  );
}
