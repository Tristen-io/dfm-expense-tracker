import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import TicketPriorityBadge from "@/components/TicketPriorityBadge";
import TicketPanel from "@/components/TicketPanel";
import TicketStatusHistory from "@/components/TicketStatusHistory";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: ticket }, { data: comments }, { data: history }] = await Promise.all([
    supabase.from("service_tickets").select("*").eq("id", id).single(),
    supabase
      .from("ticket_comments")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ticket_status_history")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!ticket) notFound();

  // /fleet/* is already fleet-staff only (see fleet/layout.tsx) — this is
  // always true in practice, kept explicit for clarity in TicketPanel's props.
  const isFleetStaff = profile.role === "admin" || profile.role === "mechanic";
  const canManageAsReporter = ticket.reported_by_id === profile.id && ticket.status === "open";

  return (
    <div>
      <Link href="/fleet/tickets" className="text-sm text-slate-500 underline underline-offset-2">
        ← All tickets
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{ticket.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link
              href={`/fleet/assets/${ticket.asset_id}`}
              className="underline underline-offset-2 hover:text-slate-900"
            >
              {ticket.asset_number} — {ticket.asset_name}
            </Link>{" "}
            · Reported by {ticket.reported_by_name} on {dateTimeFmt.format(new Date(ticket.created_at))}
          </p>
        </div>
        <TicketPriorityBadge priority={ticket.priority} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TicketPanel
          ticket={ticket}
          comments={comments ?? []}
          isFleetStaff={isFleetStaff}
          canManageAsReporter={canManageAsReporter}
        />
        <TicketStatusHistory entries={history ?? []} />
      </div>
    </div>
  );
}
