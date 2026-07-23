import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import FleetTabs from "@/components/FleetTabs";
import { getCurrentProfile } from "@/lib/auth";

// Unlike admin/layout.tsx, this isn't role-gated — Fleet & Equipment is
// shared crew visibility (view assets, log meter readings, report/track
// tickets), same as vendors/jobs. Individual admin-only actions (creating
// or editing an asset, changing a ticket's status) are still guarded on
// their own pages/actions and by RLS; this layout only requires sign-in,
// the same floor every other page in the app has. First shared layout for
// a non-admin section — every other employee-facing page renders <Navbar>
// itself since there was only ever one route per area before this.
export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <FleetTabs isAdmin={profile.role === "admin"} />
        {children}
      </main>
    </div>
  );
}
