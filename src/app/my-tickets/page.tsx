import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import TicketList from "@/components/TicketList";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Read-only — an employee's own reported tickets. No link into ticket
// detail (that page lives under the fleet-staff-only /fleet/tickets/[id]),
// no comments, no status changes; just "here's what I reported and where
// it stands." Fleet staff still use the full /fleet/tickets list.
export default async function MyTicketsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("service_tickets")
    .select("*")
    .eq("reported_by_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">My tickets</h1>
            <p className="mt-1 text-sm text-slate-500">
              Issues you&apos;ve reported and their current status.
            </p>
          </div>
          <Link
            href="/report-issue"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Report an issue
          </Link>
        </div>

        <div className="mt-6">
          <TicketList tickets={tickets ?? []} linkBase={null} />
        </div>
      </main>
    </div>
  );
}
