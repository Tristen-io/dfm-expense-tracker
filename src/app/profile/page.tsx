import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import ContactInfoForm from "@/components/ContactInfoForm";
import WriteUpList from "@/components/WriteUpList";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: writeUps } = await supabase
    .from("write_ups")
    .select("*")
    .eq("user_id", profile.id)
    .order("incident_date", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">My profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as <span className="font-medium">{profile.email ?? profile.full_name}</span>.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Contact info</h2>
          <p className="mt-1 text-sm text-slate-500">
            Keep this current — it&apos;s what your admin sees.
          </p>
          <div className="mt-4">
            <ContactInfoForm phone={profile.phone} address={profile.address} />
          </div>
        </div>

        {(writeUps ?? []).length > 0 && (
          <>
            <h2 className="mt-8 text-base font-semibold text-slate-900">Write-ups</h2>
            <div className="mt-3">
              <WriteUpList writeUps={writeUps ?? []} mode="employee" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
