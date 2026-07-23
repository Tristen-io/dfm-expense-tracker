"use client";

import { useRef, useState, useTransition } from "react";
import type { AssetFormState } from "@/lib/actions/assets";
import { METER_TYPES, METER_TYPE_LABELS, type Asset, type AssetCategory, type Profile } from "@/lib/types";

// Shared by the "new asset" and "edit asset" pages. `action` is bound by the
// caller — createAsset directly for new, updateAsset.bind(null, asset.id)
// for edit — so this component doesn't need to know which mode it's in
// beyond what defaults to show.
export default function AssetForm({
  action,
  asset,
  categories,
  profiles,
  submitLabel,
}: {
  action: (prevState: AssetFormState, formData: FormData) => Promise<AssetFormState>;
  asset?: Asset;
  categories: AssetCategory[];
  profiles: Profile[];
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await action({ error: null }, formData);
      // createAsset redirects on success and never returns here; updateAsset
      // returns { error: null, success: true } and stays on the page.
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="asset_number" className="block text-sm font-medium text-slate-700">
            Asset / unit number
          </label>
          <input
            id="asset_number"
            name="asset_number"
            type="text"
            required
            defaultValue={asset?.asset_number ?? ""}
            placeholder="e.g. T-14"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={asset?.name ?? ""}
            placeholder="e.g. 2019 Ford F-250"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700">
          Category
        </label>
        <input
          id="category"
          name="category"
          type="text"
          list="category-suggestions"
          defaultValue={asset?.category ?? ""}
          placeholder="e.g. Truck, Trailer, Excavator"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <datalist id="category-suggestions">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="make" className="block text-sm font-medium text-slate-700">
            Make
          </label>
          <input
            id="make"
            name="make"
            type="text"
            defaultValue={asset?.make ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-slate-700">
            Model
          </label>
          <input
            id="model"
            name="model"
            type="text"
            defaultValue={asset?.model ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-slate-700">
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            min="1900"
            max="2100"
            defaultValue={asset?.year ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="vin_or_serial" className="block text-sm font-medium text-slate-700">
          VIN / serial number
        </label>
        <input
          id="vin_or_serial"
          name="vin_or_serial"
          type="text"
          defaultValue={asset?.vin_or_serial ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={asset?.status ?? "active"}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="active">Active</option>
            <option value="out_of_service">Out of service</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <div>
          <label htmlFor="meter_type" className="block text-sm font-medium text-slate-700">
            Meter tracked
          </label>
          <select
            id="meter_type"
            name="meter_type"
            defaultValue={asset?.meter_type ?? "mileage"}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            {METER_TYPES.map((m) => (
              <option key={m} value={m}>
                {METER_TYPE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="assigned_to_id" className="block text-sm font-medium text-slate-700">
            Assigned to
          </label>
          <select
            id="assigned_to_id"
            name="assigned_to_id"
            defaultValue={asset?.assigned_to_id ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-slate-700">
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={asset?.location ?? ""}
            placeholder="e.g. Main yard"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="purchase_date" className="block text-sm font-medium text-slate-700">
          Purchase date
        </label>
        <input
          id="purchase_date"
          name="purchase_date"
          type="date"
          defaultValue={asset?.purchase_date ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={asset?.notes ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <input type="hidden" name="photo_path" value={asset?.photo_path ?? ""} />

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
