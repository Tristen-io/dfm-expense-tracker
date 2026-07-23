import { redirect } from "next/navigation";
import { addMaintenanceType, deleteMaintenanceType } from "@/lib/actions/maintenance";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Same list-management pattern as /admin/vendors and /admin/jobs. The
// fleet/layout.tsx gate already keeps employees out of everything under
// /fleet; this extra check is redundant with that but kept for symmetry
// with how the rest of this file's sibling pages are written.
export default async function MaintenanceTypesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "mechanic") redirect("/fleet");

  const resolvedParams = await searchParams;
  const errorParam = resolvedParams.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  const supabase = await createClient();
  const { data: types } = await supabase.from("maintenance_types").select("*").order("name");

  async function handleAdd(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "");
    try {
      await addMaintenanceType(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't add maintenance type.";
      redirect(`/fleet/maintenance-types?error=${encodeURIComponent(message)}`);
    }
    redirect("/fleet/maintenance-types");
  }

  async function handleDelete(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    await deleteMaintenanceType(id);
    redirect("/fleet/maintenance-types");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Maintenance types</h1>
      <p className="mt-1 text-sm text-slate-500">
        Types added here show up as suggestions when tracking a maintenance item on an asset.
        Admins and mechanics can still type a one-off type that isn&apos;t on this list.
      </p>

      <form
        action={handleAdd}
        className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex-1">
          <label htmlFor="name" className="block text-xs font-medium text-slate-600">
            Type name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Oil change"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add type
        </button>
      </form>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {(types ?? []).length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            No maintenance types added yet.
          </li>
        )}
        {(types ?? []).map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-slate-700">{t.name}</span>
            <form action={handleDelete}>
              <input type="hidden" name="id" value={t.id} />
              <button
                type="submit"
                className="text-slate-400 underline underline-offset-2 hover:text-red-600"
              >
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
