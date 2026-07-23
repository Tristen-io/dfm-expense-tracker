import Link from "next/link";
import TicketList from "@/components/TicketList";
import { createClient } from "@/lib/supabase/server";
import { TICKET_STATUSES, type TicketStatus } from "@/lib/types";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const get = (key: string) => {
    const v = resolvedParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const statusParam = get("status");
  const status = TICKET_STATUSES.includes(statusParam as TicketStatus)
    ? (statusParam as TicketStatus)
    : undefined;

  const supabase = await createClient();
  let query = supabase.from("service_tickets").select("*");
  if (status) query = query.eq("status", status);
  const { data: tickets } = await query.order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Service tickets</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tickets?.length ?? 0} ticket{tickets?.length === 1 ? "" : "s"}
            {status ? ` (status: ${status.replaceAll("_", " ")})` : ""}.
          </p>
        </div>
        <Link
          href="/fleet/tickets/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Report an issue
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {TICKET_STATUSES.map((s) => (
          <a
            key={s}
            href={`/fleet/tickets?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 capitalize ${
              status === s
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {s.replaceAll("_", " ")}
          </a>
        ))}
        <Link
          href="/fleet/tickets"
          className={`rounded-lg border px-3 py-1.5 ${
            !status
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          All
        </Link>
      </div>

      <div className="mt-6">
        <TicketList tickets={tickets ?? []} />
      </div>
    </div>
  );
}
