import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import TicketForm from "@/components/TicketForm";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The employee-facing equivalent of /fleet/tickets/new — same TicketForm,
// same createServiceTicket action, but reachable by everyone (not just
// fleet staff) since /fleet/* is gated. Fleet staff still have their own
// entry point at /fleet/tickets/new; this page exists mainly so employees
// have somewhere to land. Renders its own <Navbar> since it's outside the
// fleet layout, same pattern as /submit, /my-entries, /profile.
export default async function ReportIssuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const resolvedParams = await searchParams;
  const assetParam = resolvedParams.asset;
  const defaultAssetId = Array.isArray(assetParam) ? assetParam[0] : assetParam;

  const supabase = await createClient();
  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .neq("status", "retired")
    .order("asset_number");

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">Report an issue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Logged as <span className="font-medium">{profile.full_name}</span>. Pick the truck or
          equipment, describe what&apos;s wrong, and a mechanic or admin will pick it up.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <TicketForm assets={assets ?? []} defaultAssetId={defaultAssetId} />
        </div>
      </main>
    </div>
  );
}
