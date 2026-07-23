import { redirect } from "next/navigation";
import AssetForm from "@/components/AssetForm";
import { createAsset } from "@/lib/actions/assets";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NewAssetPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // Fleet & Equipment itself isn't admin-only, but adding to the registry
  // is — this route lives outside /admin so employees can still reach
  // everything else under /fleet, so the check has to happen here rather
  // than relying on admin/layout.tsx.
  if (profile.role !== "admin") redirect("/fleet/assets");

  const supabase = await createClient();
  const [{ data: categories }, { data: profiles }] = await Promise.all([
    supabase.from("asset_categories").select("*").order("name"),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Add an asset</h1>
      <p className="mt-1 text-sm text-slate-500">
        Adds a new vehicle or piece of equipment to the fleet registry.
      </p>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <AssetForm
          action={createAsset}
          categories={categories ?? []}
          profiles={profiles ?? []}
          submitLabel="Add asset"
        />
      </div>
    </div>
  );
}
