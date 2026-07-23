"use client";

import { useRef, useState, useTransition } from "react";
import { createTimeOffRequest } from "@/lib/actions/timeOff";
import { TIME_OFF_TYPES } from "@/lib/types";

function todayLocalISODate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function TimeOffForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const today = todayLocalISODate();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await createTimeOffRequest({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-slate-700">
          Type
        </label>
        <select
          id="type"
          name="type"
          required
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="" disabled>
            Select a type…
          </option>
          {TIME_OFF_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium text-slate-700">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            min={today}
            defaultValue={today}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium text-slate-700">
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            min={today}
            defaultValue={today}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Requests submitted with less than a week&apos;s notice are still accepted, just flagged
        as short notice so your admin can see that at a glance.
      </p>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
          Reason (optional)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder="Optional — anything your admin should know"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
