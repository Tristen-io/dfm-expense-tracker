import { redirect } from "next/navigation";
import TicketForm from "@/components/TicketForm";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NewTicketPage({
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
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Report an issue</h1>
      <p className="mt-1 text-sm text-slate-500">
        Logged as <span className="font-medium">{profile.full_name}</span>.
      </p>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <TicketForm assets={assets ?? []} defaultAssetId={defaultAssetId} />
      </div>
    </div>
  );
}
