import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import FleetTabs from "@/components/FleetTabs";
import { getCurrentProfile } from "@/lib/auth";

// Fleet-staff only (admin or mechanic) — same role-gated shape as
// admin/layout.tsx, mirrored at the middleware level in proxy.ts for
// defense in depth. This used to be open to every signed-in employee
// (Fleet & Equipment was shared crew visibility, like vendors/jobs); that
// changed when employees were scoped down to /report-issue, /my-tickets,
// and /maintenance-due instead — see those routes' own layouts/pages,
// which render <Navbar> themselves since they sit outside this one.
export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "mechanic") redirect("/report-issue");

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <FleetTabs isFleetStaff={profile.role === "admin" || profile.role === "mechanic"} />
        {children}
      </main>
    </div>
  );
}
