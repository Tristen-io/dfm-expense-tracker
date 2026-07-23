"use client";

import { useState, useTransition } from "react";
import { deleteTimeOffRequest, updateTimeOffStatus } from "@/lib/actions/timeOff";
import StatusBadge from "@/components/StatusBadge";
import type { TimeOffRequest, TimeOffStatus } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(isoDate: string) {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

function formatDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso));
}

function totalDays(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

export default function TimeOffTable({
  requests,
  mode,
}: {
  requests: TimeOffRequest[];
  mode: "employee" | "admin";
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStatus(id: string, status: TimeOffStatus) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await updateTimeOffStatus(id, status);
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this time off request? This can't be undone.")) return;
    setPendingId(id);
    startTransition(async () => {
      try {
        await deleteTimeOffRequest(id);
      } finally {
        setPendingId(null);
      }
    });
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No time off requests yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((r) => {
        const busy = isPending && pendingId === r.id;
        const canEmployeeManage = mode === "employee" && r.status === "pending";

        return (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {r.type} — {totalDays(r.start_date, r.end_date)} day
                  {totalDays(r.start_date, r.end_date) === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(r.start_date)}
                  {r.end_date !== r.start_date && <> – {formatDate(r.end_date)}</>}
                  {mode === "admin" && <> · {r.employee_name}</>}
                </p>
                {r.reviewed_by_name && r.reviewed_at && (
                  <p className="text-xs text-slate-400">
                    Reviewed by {r.reviewed_by_name} on {formatDateTime(r.reviewed_at)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.short_notice && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Short notice
                  </span>
                )}
                <StatusBadge status={r.status} />
              </div>
            </div>

            {r.reason && <p className="mt-2 text-sm text-slate-600">{r.reason}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {mode === "admin" && r.status !== "approved" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatus(r.id, "approved")}
                  className="rounded-md bg-green-600 px-2.5 py-1 font-medium text-white hover:bg-green-500 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {mode === "admin" && r.status !== "denied" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatus(r.id, "denied")}
                  className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Deny
                </button>
              )}
              {mode === "admin" && r.status !== "pending" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatus(r.id, "pending")}
                  className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset to pending
                </button>
              )}
              {(mode === "admin" || canEmployeeManage) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(r.id)}
                  className="ml-auto text-slate-400 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
