"use client";

import { useRef, useState, useTransition } from "react";
import { addMeterReading } from "@/lib/actions/assets";
import { METER_TYPE_LABELS, type MeterReading, type MeterReadingType } from "@/lib/types";

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function MeterReadingPanel({
  assetId,
  readingType,
  currentValue,
  readings,
  isFleetStaff,
}: {
  assetId: string;
  readingType: MeterReadingType;
  currentValue: number | null;
  readings: MeterReading[];
  isFleetStaff: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [isOverride, setIsOverride] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await addMeterReading({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setIsOverride(false);
    });
  }

  const unitLabel = METER_TYPE_LABELS[readingType];

  return (
    <div>
      <p className="text-sm text-slate-500">Current {unitLabel.toLowerCase()}</p>
      <p className="text-2xl font-semibold text-slate-900">
        {currentValue !== null ? currentValue.toLocaleString() : "—"}
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input type="hidden" name="asset_id" value={assetId} />
        <input type="hidden" name="reading_type" value={readingType} />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="value" className="block text-xs font-medium text-slate-600">
              New reading
            </label>
            <input
              id="value"
              name="value"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Log reading"}
          </button>
        </div>

        {isFleetStaff && (
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                name="is_override"
                checked={isOverride}
                onChange={(e) => setIsOverride(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              This is a correction (reading is lower than the last one on file)
            </label>
            {isOverride && (
              <input
                name="override_reason"
                type="text"
                required
                placeholder="Reason — e.g. hour meter replaced"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </div>
        )}

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>

      <h3 className="mt-6 text-sm font-semibold text-slate-900">History</h3>
      {readings.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No readings logged yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {readings.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">{r.value.toLocaleString()}</span>
                <span className="ml-2 text-slate-500">
                  {r.recorded_by_name} · {dateTimeFmt.format(new Date(r.created_at))}
                </span>
                {r.is_override && (
                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Correction{r.override_reason ? `: ${r.override_reason}` : ""}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
