import Link from "next/link";
import EntriesTable from "@/components/EntriesTable";
import FiltersBar from "@/components/FiltersBar";
import { createClient } from "@/lib/supabase/server";
import { filteredExpensesQuery, parseFilters } from "@/lib/queries";

const PAGE_SIZE = 25;

export default async function AdminEntriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const filters = parseFilters(resolvedParams);

  const pageParam = resolvedParams.page;
  const page = Math.max(1, Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const [
    { data: profiles },
    { data: vendors },
    { data: jobs },
    { data: expenses, count },
    { count: pendingCount },
    { count: flaggedCount },
    { count: awaitingPriceCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("vendors").select("*").order("name"),
    supabase.from("jobs").select("*").order("name"),
    filteredExpensesQuery(supabase, filters, { withCount: true }).range(from, to),
    // These three counts intentionally ignore the current filters — they're
    // "needs your attention" indicators across every entry, not just what's
    // currently in view, so approving/flagging never quietly falls off an
    // admin's radar just because they had a filter applied.
    supabase.from("expenses").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("expenses").select("*", { count: "exact", head: true }).eq("status", "flagged"),
    supabase.from("expenses").select("*", { count: "exact", head: true }).is("amount", null),
  ]);

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString();

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageQuery = (p: number) => {
    const params = new URLSearchParams(query);
    params.set("page", String(p));
    return `/admin/entries?${params.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">All entries</h1>
          <p className="mt-1 text-sm text-slate-500">
            {count ?? 0} entr{count === 1 ? "y" : "ies"} matching filters.
          </p>
        </div>
        <Link
          href={`/admin/export${query ? `?${query}` : ""}`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Export approved to CSV
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Link
          href="/admin/entries?status=pending"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Pending review</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{pendingCount ?? 0}</p>
        </Link>
        <Link
          href="/admin/entries?status=flagged"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Flagged</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{flaggedCount ?? 0}</p>
        </Link>
        <Link
          href="/admin/entries?status=awaiting_price"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Awaiting price</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{awaitingPriceCount ?? 0}</p>
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <FiltersBar profiles={profiles ?? []} vendors={vendors ?? []} jobs={jobs ?? []} filters={filters} />
      </div>

      <div className="mt-6">
        <EntriesTable expenses={expenses ?? []} mode="admin" />
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link
            href={pageQuery(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`rounded-lg border border-slate-300 px-3 py-1.5 ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"
            }`}
          >
            ← Previous
          </Link>
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageQuery(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`rounded-lg border border-slate-300 px-3 py-1.5 ${
              page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
