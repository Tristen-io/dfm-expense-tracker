import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getCurrentProfile } from "@/lib/auth";

// Defense-in-depth: proxy.ts already blocks non-admins from /admin/*, but we
// re-check here since RSC data fetches on this subtree assume admin (RLS
// grants admins visibility into every row).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/submit");

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
