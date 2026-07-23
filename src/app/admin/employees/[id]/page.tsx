import { notFound, redirect } from "next/navigation";
import WriteUpList from "@/components/WriteUpList";
import { createClient } from "@/lib/supabase/server";
import { setEmployeeRole, updateEmployeeContactInfo } from "@/lib/actions/profile";
import { createWriteUp } from "@/lib/actions/writeUps";
import { getCurrentProfile } from "@/lib/auth";
import { WRITE_UP_CATEGORIES, type Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  mechanic: "Mechanic",
  admin: "Admin",
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");

  const supabase = await createClient();
  const [{ data: employee }, { data: writeUps }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("write_ups")
      .select("*")
      .eq("user_id", id)
      .order("incident_date", { ascending: false }),
  ]);

  if (!employee) notFound();
  // Re-bound to a definitely-non-null const: TS's narrowing from the check
  // above doesn't reliably carry into the "use server" closures defined
  // below, since each becomes its own function boundary.
  const target = employee;

  async function handleSaveContact(formData: FormData) {
    "use server";
    const phone = String(formData.get("phone") || "");
    const address = String(formData.get("address") || "");
    await updateEmployeeContactInfo(id, phone, address);
  }

  async function handleSetRole(formData: FormData) {
    "use server";
    const role = String(formData.get("role") || "employee") as Role;
    await setEmployeeRole(id, role);
  }

  async function handleAddWriteUp(formData: FormData) {
    "use server";
    formData.set("user_id", id);
    formData.set("employee_name", target.full_name);
    await createWriteUp({ error: null }, formData);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{employee.full_name}</h1>
          <p className="mt-1 text-sm text-slate-500">{employee.email ?? "No email on file"}</p>
        </div>
        {viewer.id !== employee.id && (
          <form action={handleSetRole} className="flex items-center gap-2">
            <label htmlFor="role" className="text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue={employee.role}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Update role
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Contact info</h2>
        <form action={handleSaveContact} className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={employee.phone ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-700">
              Address
            </label>
            <input
              id="address"
              name="address"
              type="text"
              defaultValue={employee.address ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Save contact info
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Add a write-up</h2>
        <p className="mt-1 text-sm text-slate-500">
          {employee.full_name} will see this on their own profile and can acknowledge it.
        </p>
        <form action={handleAddWriteUp} className="mt-3 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="incident_date" className="block text-sm font-medium text-slate-700">
                Incident date
              </label>
              <input
                id="incident_date"
                name="incident_date"
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="category"
                name="category"
                required
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select…
                </option>
                {WRITE_UP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">
              What happened
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              placeholder="Be specific: who, what, when, where, how"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="corrective_action"
              className="block text-sm font-medium text-slate-700"
            >
              Expected next steps (optional)
            </label>
            <textarea
              id="corrective_action"
              name="corrective_action"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add write-up
          </button>
        </form>
      </div>

      <h2 className="mt-6 text-base font-semibold text-slate-900">Write-up history</h2>
      <div className="mt-3">
        <WriteUpList writeUps={writeUps ?? []} mode="admin" />
      </div>
    </div>
  );
}
