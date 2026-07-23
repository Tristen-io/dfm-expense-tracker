import TimeOffTable from "@/components/TimeOffTable";
import { createClient } from "@/lib/supabase/server";
import type { TimeOffStatus } from "@/lib/types";

const VALID_STATUSES: TimeOffStatus[] = ["pending", "approved", "denied"];

export default async function AdminTimeOffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const get = (key: string) => {
    const v = resolvedParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const statusParam = get("status");
  const status = VALID_STATUSES.includes(statusParam as TimeOffStatus)
    ? (statusParam as TimeOffStatus)
    : undefined;

  const supabase = await createClient();
  const [{ data: profiles }, query] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    (async () => {
      let q = supabase.from("time_off_requests").select("*");
      if (status) q = q.eq("status", status);
      return q.order("start_date", { ascending: false });
    })(),
  ]);
  const { data: requests } = query;

  const [{ count: pendingTotal }, { count: shortNoticeTotal }] = await Promise.all([
    supabase
      .from("time_off_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("time_off_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("short_notice", true),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Time off requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            {requests?.length ?? 0} request{requests?.length === 1 ? "" : "s"}
            {status ? ` (status: ${status})` : ""}.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <a
          href="/admin/time-off?status=pending"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Pending review</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{pendingTotal ?? 0}</p>
        </a>
        <a
          href="/admin/time-off?status=pending"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Short notice, pending</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{shortNoticeTotal ?? 0}</p>
        </a>
        <a
          href="/admin/time-off"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">All employees</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{profiles?.length ?? 0}</p>
        </a>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {["pending", "approved", "denied"].map((s) => (
          <a
            key={s}
            href={`/admin/time-off?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 capitalize ${
              status === s
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {s}
          </a>
        ))}
        <a
          href="/admin/time-off"
          className={`rounded-lg border px-3 py-1.5 ${
            !status
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          All
        </a>
      </div>

      <div className="mt-6">
        <TimeOffTable requests={requests ?? []} mode="admin" />
      </div>
    </div>
  );
}
