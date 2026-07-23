import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("full_name");

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Employees</h1>
      <p className="mt-1 text-sm text-slate-500">
        Contact info, role, and write-up history for everyone with an account.
      </p>

      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {(profiles ?? []).length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">No employees yet.</li>
        )}
        {(profiles ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/employees/${p.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {p.full_name}
                  {(p.role === "admin" || p.role === "mechanic") && (
                    <span className="ml-1.5 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                      {p.role}
                    </span>
                  )}
                </p>
                <p className="text-slate-500">
                  {p.email ?? "No email on file"}
                  {p.phone && <> · {p.phone}</>}
                </p>
              </div>
              <span className="text-slate-400">View →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
