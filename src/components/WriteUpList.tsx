"use client";

import { useState, useTransition } from "react";
import { acknowledgeWriteUp, deleteWriteUp } from "@/lib/actions/writeUps";
import type { WriteUp } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(isoDate: string) {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

export default function WriteUpList({
  writeUps,
  mode,
}: {
  writeUps: WriteUp[];
  mode: "employee" | "admin";
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAcknowledge(id: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await acknowledgeWriteUp(id);
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleDelete(id: string, userId: string) {
    if (!confirm("Remove this write-up? This can't be undone.")) return;
    setPendingId(id);
    startTransition(async () => {
      try {
        await deleteWriteUp(id, userId);
      } finally {
        setPendingId(null);
      }
    });
  }

  if (writeUps.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No write-ups on file.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {writeUps.map((w) => {
        const busy = isPending && pendingId === w.id;

        return (
          <li key={w.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {w.category} — {formatDate(w.incident_date)}
                </p>
                <p className="text-xs text-slate-500">Filed by {w.created_by_name}</p>
              </div>
              {w.acknowledged_at ? (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  Acknowledged
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  Not yet acknowledged
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-slate-700">{w.description}</p>
            {w.corrective_action && (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium">Expected next steps:</span> {w.corrective_action}
              </p>
            )}

            <div className="mt-3 flex items-center gap-3 text-sm">
              {mode === "employee" && !w.acknowledged_at && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleAcknowledge(w.id)}
                  className="rounded-md bg-slate-900 px-2.5 py-1 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "I've read this"}
                </button>
              )}
              {mode === "admin" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(w.id, w.user_id)}
                  className="ml-auto text-slate-400 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
