import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import TimeOffForm from "@/components/TimeOffForm";
import TimeOffTable from "@/components/TimeOffTable";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function TimeOffPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("time_off_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("start_date", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">Time off</h1>
        <p className="mt-1 text-sm text-slate-500">
          Request time off and track its status. Requests can still be edited or deleted while
          pending.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <TimeOffForm />
        </div>

        <h2 className="mt-8 text-base font-semibold text-slate-900">Your requests</h2>
        <div className="mt-3">
          <TimeOffTable requests={requests ?? []} mode="employee" />
        </div>
      </main>
    </div>
  );
}
