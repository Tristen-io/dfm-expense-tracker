import { format, startOfMonth } from "date-fns";
import TotalsTable from "@/components/TotalsTable";
import { createClient } from "@/lib/supabase/server";
import { filteredExpensesQuery, parseFilters } from "@/lib/queries";
import {
  awaitingPriceCount,
  grandTotal,
  totalsByDay,
  totalsByJob,
  totalsByMonth,
  totalsByVendor,
  totalsByWeek,
} from "@/lib/reportUtils";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const parsed = parseFilters(resolvedParams);

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultFrom = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const filters = {
    ...parsed,
    from: parsed.from ?? defaultFrom,
    to: parsed.to ?? today,
  };

  const supabase = await createClient();
  const { data: expenses } = await filteredExpensesQuery(supabase, filters);
  const rows = expenses ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Totals for the selected date range and status. Defaults to the current month, all
        statuses.
      </p>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div>
          <label htmlFor="from" className="block text-xs font-medium text-slate-600">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from}
            className="mt-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-slate-600">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={filters.to}
            className="mt-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="awaiting_price">Awaiting price</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Update
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex-1 rounded-xl bg-slate-900 px-5 py-4 text-white">
          <p className="text-sm text-slate-300">
            Grand total ({rows.length} entr{rows.length === 1 ? "y" : "ies"})
          </p>
          <p className="text-2xl font-semibold">{currency.format(grandTotal(rows))}</p>
        </div>
        {awaitingPriceCount(rows) > 0 && (
          <div className="flex-1 rounded-xl bg-amber-50 px-5 py-4 ring-1 ring-inset ring-amber-600/20">
            <p className="text-sm text-amber-700">Not included above</p>
            <p className="text-2xl font-semibold text-amber-800">
              {awaitingPriceCount(rows)} order{awaitingPriceCount(rows) === 1 ? "" : "s"} awaiting
              price
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TotalsTable title="By day" rows={totalsByDay(rows)} />
        <TotalsTable title="By week" rows={totalsByWeek(rows)} />
        <TotalsTable title="By month" rows={totalsByMonth(rows)} />
        <TotalsTable title="By job / project" rows={totalsByJob(rows)} />
        <TotalsTable title="By vendor" rows={totalsByVendor(rows)} />
      </div>
    </div>
  );
}
