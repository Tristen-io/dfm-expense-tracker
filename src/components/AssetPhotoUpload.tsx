"use client";

import { useRef, useState, useTransition } from "react";
import { setAssetPhoto, getAssetPhotoSignedUrl } from "@/lib/actions/assets";
import { createClient } from "@/lib/supabase/client";

// Same direct-to-storage-then-persist-the-path pattern as the receipt
// upload in ExpenseForm, just against the "asset-photos" bucket and saved
// immediately (no surrounding form to submit) since this lives on the
// asset's own profile page rather than a create/edit form.
const MAX_PHOTO_MB = 8;

export default function AssetPhotoUpload({
  assetId,
  photoPath,
}: {
  assetId: string;
  photoPath: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please attach a photo (JPG, PNG, HEIC, etc).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`That photo is too large — please attach one under ${MAX_PHOTO_MB}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${assetId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("asset-photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }

      startTransition(async () => {
        try {
          await setAssetPhoto(assetId, path);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't save the photo.");
        }
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleView() {
    if (!photoPath) return;
    const url = await getAssetPhotoSignedUrl(photoPath);
    if (!url) {
      setError("Couldn't load photo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await setAssetPhoto(assetId, "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove the photo.");
      }
    });
  }

  return (
    <div>
      {photoPath && (
        <div className="mb-2 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={handleView}
            className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          >
            View current photo
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleRemove}
            className="text-slate-400 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={uploading || pending}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-60"
      />
      {uploading && <p className="mt-1 text-sm text-slate-500">Uploading…</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
