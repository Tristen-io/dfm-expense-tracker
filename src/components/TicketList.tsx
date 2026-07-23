import Link from "next/link";
import TicketPriorityBadge from "@/components/TicketPriorityBadge";
import TicketStatusBadge from "@/components/TicketStatusBadge";
import type { ServiceTicket } from "@/lib/types";

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const PRIORITY_RANK = { "911": 0, high: 1, medium: 2, low: 3 } as const;

// linkBase controls where each row links to: default is the fleet-staff
// ticket detail page (/fleet/tickets/[id]); pass null to render plain,
// non-linked items instead — used on /my-tickets, since employees can't
// reach /fleet/tickets/[id] (that route is fleet-staff only).
export default function TicketList({
  tickets,
  linkBase = "/fleet/tickets",
}: {
  tickets: ServiceTicket[];
  linkBase?: string | null;
}) {
  if (tickets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No service tickets yet.
      </p>
    );
  }

  // 911-priority tickets are pinned to the top regardless of sort/filter —
  // they need to be impossible to miss in the list.
  const sorted = [...tickets].sort((a, b) => {
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <ul className="space-y-3">
      {sorted.map((t) => {
        const cardClass = `block rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${
          t.priority === "911" ? "border-red-300" : "border-slate-200"
        } ${linkBase ? "transition hover:border-slate-300" : ""}`;

        const content = (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">{t.title}</p>
                <p className="text-sm text-slate-500">
                  {t.asset_number} — {t.asset_name} · {t.reported_by_name} ·{" "}
                  {dateTimeFmt.format(new Date(t.created_at))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TicketPriorityBadge priority={t.priority} />
                <TicketStatusBadge status={t.status} />
              </div>
            </div>
            {t.priority === "911" && !t.acknowledged_at && (
              <p className="mt-2 text-sm font-medium text-red-700">Not yet acknowledged</p>
            )}
          </>
        );

        return (
          <li key={t.id}>
            {linkBase ? (
              <Link href={`${linkBase}/${t.id}`} className={cardClass}>
                {content}
              </Link>
            ) : (
              <div className={cardClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
