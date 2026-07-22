import type { Profile, Vendor } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";

export interface EntryFilters {
  employee?: string;
  job?: string;
  vendor?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
}

// Plain GET form — works with zero client JS, which keeps this reliable on
// spotty job-site mobile connections. Submitting reloads /admin/entries with
// the selected filters as query params.
export default function FiltersBar({
  profiles,
  vendors,
  filters,
}: {
  profiles: Profile[];
  vendors: Vendor[];
  filters: EntryFilters;
}) {
  const vendorNames = vendors.map((v) => v.name);

  return (
    <form method="get" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="employee" className="block text-xs font-medium text-slate-600">
          Employee
        </label>
        <select
          id="employee"
          name="employee"
          defaultValue={filters.employee ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">All</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="job" className="block text-xs font-medium text-slate-600">
          Job / project
        </label>
        <input
          id="job"
          name="job"
          type="text"
          defaultValue={filters.job ?? ""}
          placeholder="Search job…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
      </div>

      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="vendor" className="block text-xs font-medium text-slate-600">
          Vendor
        </label>
        <input
          id="vendor"
          name="vendor"
          type="text"
          list="filter-vendor-suggestions"
          defaultValue={filters.vendor ?? ""}
          placeholder="Search vendor…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
        <datalist id="filter-vendor-suggestions">
          {vendorNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="category" className="block text-xs font-medium text-slate-600">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={filters.category ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">All</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="status" className="block text-xs font-medium text-slate-600">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={filters.status ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="flagged">Flagged</option>
          <option value="awaiting_price">Awaiting price</option>
        </select>
      </div>

      <div>
        <label htmlFor="from" className="block text-xs font-medium text-slate-600">
          From
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={filters.from ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
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
          defaultValue={filters.to ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
      </div>

      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-7">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Apply filters
        </button>
        <a href="/admin/entries" className="px-2 py-2 text-sm text-slate-500 underline">
          Clear
        </a>
      </div>
    </form>
  );
}
