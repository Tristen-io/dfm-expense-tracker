"use client";

import { useRef, useState, useTransition } from "react";
import {
  addMaintenanceRecord,
  createMaintenanceSchedule,
  createMaintenanceSchedulesBulk,
  deleteMaintenanceSchedule,
} from "@/lib/actions/maintenance";
import { computeMaintenanceStatus } from "@/lib/maintenanceUtils";
import { MAINTENANCE_PRESETS } from "@/lib/maintenancePresets";
import MaintenanceStatusBadge from "@/components/MaintenanceStatusBadge";
import type { MaintenanceRecord, MaintenanceSchedule, MaintenanceType, MeterType } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(isoDate: string) {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

function ScheduleRow({
  schedule,
  records,
  currentMeterValue,
  meterType,
  isAdmin,
  assetId,
}: {
  schedule: MaintenanceSchedule;
  records: MaintenanceRecord[];
  currentMeterValue: number | null;
  meterType: MeterType;
  isAdmin: boolean;
  assetId: string;
}) {
  const [showLogForm, setShowLogForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const status = computeMaintenanceStatus(schedule, currentMeterValue);

  function handleLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await addMaintenanceRecord({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setShowLogForm(false);
    });
  }

  function handleDeleteSchedule() {
    if (!confirm(`Stop tracking "${schedule.maintenance_type}" for this asset?`)) return;
    startTransition(async () => {
      await deleteMaintenanceSchedule(schedule.id, assetId);
    });
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{schedule.maintenance_type}</p>
          <p className="text-xs text-slate-500">
            Every{" "}
            {[
              schedule.interval_days ? `${schedule.interval_days} days` : null,
              schedule.interval_meter
                ? `${schedule.interval_meter.toLocaleString()} ${meterType === "hours" ? "hrs" : "mi"}`
                : null,
            ]
              .filter(Boolean)
              .join(" or ")}
            {schedule.interval_days && schedule.interval_meter ? ", whichever first" : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Last done:{" "}
            {schedule.last_performed_date ? (
              <>
                {formatDate(schedule.last_performed_date)}
                {schedule.last_performed_meter !== null &&
                  ` at ${schedule.last_performed_meter.toLocaleString()}`}
              </>
            ) : (
              "never logged"
            )}
          </p>
        </div>
        <MaintenanceStatusBadge status={status} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setShowLogForm((v) => !v)}
          className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
        >
          Log service
        </button>
        {records.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            {showHistory ? "Hide" : "Show"} history ({records.length})
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            disabled={pending}
            onClick={handleDeleteSchedule}
            className="ml-auto text-slate-400 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
          >
            Stop tracking
          </button>
        )}
      </div>

      {showLogForm && (
        <form ref={formRef} onSubmit={handleLog} className="mt-3 space-y-2 rounded-md bg-slate-50 p-3">
          <input type="hidden" name="schedule_id" value={schedule.id} />
          <input type="hidden" name="asset_id" value={assetId} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">Date performed</label>
              <input
                name="performed_date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            {meterType !== "none" && schedule.interval_meter !== null && (
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  Meter at time of service
                </label>
                <input
                  name="performed_meter"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Notes (optional)</label>
            <input
              name="notes"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {showHistory && records.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          {records.map((r) => (
            <li key={r.id}>
              {formatDate(r.performed_date)}
              {r.performed_meter !== null && ` at ${r.performed_meter.toLocaleString()}`} —{" "}
              {r.performed_by_name}
              {r.notes && `: ${r.notes}`}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function QuickAddPresets({
  assetId,
  meterType,
  alreadyTracked,
}: {
  assetId: string;
  meterType: MeterType;
  alreadyTracked: Set<string>;
}) {
  const presets = MAINTENANCE_PRESETS[meterType];
  const available = presets.filter((p) => !alreadyTracked.has(p.name.toLowerCase()));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (available.length === 0) return null;

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleAdd() {
    const picks = available.filter((p) => selected.has(p.name));
    if (picks.length === 0) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await createMaintenanceSchedulesBulk(assetId, picks);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      if (result.added > 0) {
        setInfo(`Added ${result.added} item${result.added === 1 ? "" : "s"} with default intervals.`);
      }
    });
  }

  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-600">
        Common items — uses reasonable default intervals, edit anytime by removing and re-adding.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {available.map((p) => (
          <label key={p.name} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.has(p.name)}
              onChange={() => toggle(p.name)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {p.name}
            <span className="text-xs text-slate-400">
              (every{" "}
              {[
                p.interval_meter
                  ? `${p.interval_meter.toLocaleString()} ${meterType === "hours" ? "hrs" : "mi"}`
                  : null,
                p.interval_days ? `${p.interval_days} days` : null,
              ]
                .filter(Boolean)
                .join(" / ")}
              )
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {info && <p className="mt-2 text-xs text-green-700">{info}</p>}
      <button
        type="button"
        disabled={pending || selected.size === 0}
        onClick={handleAdd}
        className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : `Add selected${selected.size > 0 ? ` (${selected.size})` : ""}`}
      </button>
    </div>
  );
}

export default function MaintenanceSchedulePanel({
  assetId,
  meterType,
  currentMeterValue,
  schedules,
  recordsBySchedule,
  maintenanceTypes,
  isAdmin,
}: {
  assetId: string;
  meterType: MeterType;
  currentMeterValue: number | null;
  schedules: MaintenanceSchedule[];
  recordsBySchedule: Record<string, MaintenanceRecord[]>;
  maintenanceTypes: MaintenanceType[];
  isAdmin: boolean;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createMaintenanceSchedule(assetId, { error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setShowAddForm(false);
    });
  }

  return (
    <div>
      {schedules.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing being tracked yet.</p>
      ) : (
        <ul className="space-y-3">
          {schedules.map((s) => (
            <ScheduleRow
              key={s.id}
              schedule={s}
              records={recordsBySchedule[s.id] ?? []}
              currentMeterValue={currentMeterValue}
              meterType={meterType}
              isAdmin={isAdmin}
              assetId={assetId}
            />
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <QuickAddPresets
            assetId={assetId}
            meterType={meterType}
            alreadyTracked={new Set(schedules.map((s) => s.maintenance_type.toLowerCase()))}
          />

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="mt-3 text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          >
            {showAddForm ? "Cancel" : "+ Track a custom item"}
          </button>

          {showAddForm && (
            <form ref={formRef} onSubmit={handleAdd} className="mt-3 space-y-3 rounded-md bg-slate-50 p-3">
              <div>
                <label className="block text-xs font-medium text-slate-600">Type</label>
                <input
                  name="maintenance_type"
                  type="text"
                  required
                  list="maintenance-type-suggestions"
                  placeholder="e.g. Oil change"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <datalist id="maintenance-type-suggestions">
                  {maintenanceTypes.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Every N days</label>
                  <input
                    name="interval_days"
                    type="number"
                    min="1"
                    placeholder="e.g. 180"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                {meterType !== "none" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Every N {meterType === "hours" ? "hours" : "miles"}
                    </label>
                    <input
                      name="interval_meter"
                      type="number"
                      min="1"
                      placeholder="e.g. 5000"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Set one or both — if both are set, whichever comes first triggers the reminder.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600">Notes (optional)</label>
                <input
                  name="notes"
                  type="text"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Start tracking"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
