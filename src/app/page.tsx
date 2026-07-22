import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

// Landing route: proxy.ts guarantees we only get here when signed in.
// Send admins to the review dashboard, everyone else straight to the form.
export default async function Home() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(profile.role === "admin" ? "/admin/entries" : "/submit");
}
