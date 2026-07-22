import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import ExpenseForm from "@/components/ExpenseForm";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SubmitPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: vendors } = await supabase.from("vendors").select("*").order("name");

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">New expense</h1>
        <p className="mt-1 text-sm text-slate-500">
          Logged as <span className="font-medium">{profile.full_name}</span>.
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <ExpenseForm vendors={vendors ?? []} />
        </div>
      </main>
    </div>
  );
}
