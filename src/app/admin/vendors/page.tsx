import { redirect } from "next/navigation";
import { addVendor, deleteVendor } from "@/lib/actions/vendors";
import { createClient } from "@/lib/supabase/server";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const errorParam = resolvedParams.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  const supabase = await createClient();
  const { data: vendors } = await supabase.from("vendors").select("*").order("name");

  async function handleAdd(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "");
    try {
      await addVendor(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't add vendor.";
      redirect(`/admin/vendors?error=${encodeURIComponent(message)}`);
    }
    redirect("/admin/vendors");
  }

  async function handleDelete(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    await deleteVendor(id);
    redirect("/admin/vendors");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Vendors</h1>
      <p className="mt-1 text-sm text-slate-500">
        Vendors added here show up as suggestions on the expense form and let Reports break down
        spend by vendor. Employees can still type a vendor name that isn&apos;t on this list —
        it just won&apos;t be suggested or grouped as cleanly in reports.
      </p>

      <form
        action={handleAdd}
        className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex-1">
          <label htmlFor="name" className="block text-xs font-medium text-slate-600">
            Vendor name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. ABC Concrete Supply"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add vendor
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {(vendors ?? []).length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            No vendors added yet.
          </li>
        )}
        {(vendors ?? []).map((v) => (
          <li key={v.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-slate-700">{v.name}</span>
            <form action={handleDelete}>
              <input type="hidden" name="id" value={v.id} />
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
