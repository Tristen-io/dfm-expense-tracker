import type { TotalRow } from "@/lib/reportUtils";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function TotalsTable({ title, rows }: { title: string; rows: TotalRow[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No data for this range.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-700">
                {row.label}{" "}
                <span className="text-slate-400">
                  ({row.count} entr{row.count === 1 ? "y" : "ies"})
                </span>
              </span>
              <span className="font-medium text-slate-900">{currency.format(row.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
