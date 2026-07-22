import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import EntriesTable from "@/components/EntriesTable";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function MyEntriesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", profile.id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">My entries</h1>
        <p className="mt-1 text-sm text-slate-500">
          Entries you can still edit are pending review. Once approved or flagged, ask your admin
          to make changes.
        </p>
        <div className="mt-6">
          <EntriesTable expenses={expenses ?? []} mode="employee" />
        </div>
      </main>
    </div>
  );
}
