"use client";

import { useState, useTransition } from "react";
import { createServiceTicket } from "@/lib/actions/tickets";
import { TICKET_PRIORITIES, type Asset, type TicketPriority } from "@/lib/types";

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low — no rush",
  medium: "Medium — needs attention soon",
  high: "High — actively blocking work",
  "911": "911 — emergency",
};

export default function TicketForm({
  assets,
  defaultAssetId,
}: {
  assets: Asset[];
  defaultAssetId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [priority, setPriority] = useState<TicketPriority>("medium");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await createServiceTicket({ error: null }, formData);
      // createServiceTicket redirects to the new ticket on success, so a
      // returned value here always means it failed.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="asset_id" className="block text-sm font-medium text-slate-700">
          Asset / equipment
        </label>
        <select
          id="asset_id"
          name="asset_id"
          required
          defaultValue={defaultAssetId ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="" disabled>
            Select…
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.asset_number} — {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Check engine light on"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          placeholder="What's wrong, when it started, anything else relevant"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="priority" className="block text-sm font-medium text-slate-700">
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        {priority === "911" && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            If this is a life-threatening emergency, call 911 (or your local emergency services)
            directly — this app does not contact emergency services and submitting this form is
            not a substitute for that call. This just gets it in front of every admin
            immediately.
          </p>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}
