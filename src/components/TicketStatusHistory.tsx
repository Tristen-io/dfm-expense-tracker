import type { TicketStatusHistoryEntry } from "@/lib/types";

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function TicketStatusHistory({ entries }: { entries: TicketStatusHistoryEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">History</h2>
      <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
        {entries.map((e) => (
          <li key={e.id} className="text-sm">
            <span className="font-medium capitalize text-slate-900">
              {e.status.replace("_", " ")}
            </span>{" "}
            <span className="text-slate-500">
              — {e.changed_by_name} · {dateTimeFmt.format(new Date(e.created_at))}
            </span>
            {e.note && <p className="text-slate-500">{e.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
