import Link from "next/link";
import AssetTable from "@/components/AssetTable";
import { createClient } from "@/lib/supabase/server";
import type { AssetStatus } from "@/lib/types";

const VALID_STATUSES: AssetStatus[] = ["active", "out_of_service", "retired"];

export default async function AssetsPage({
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
  const status = VALID_STATUSES.includes(statusParam as AssetStatus)
    ? (statusParam as AssetStatus)
    : undefined;
  const category = get("category");

  const supabase = await createClient();
  const [{ data: assets }, { data: categories }] = await Promise.all([
    (async () => {
      let q = supabase.from("assets").select("*");
      if (status) q = q.eq("status", status);
      if (category) q = q.eq("category", category);
      return q.order("asset_number");
    })(),
    supabase.from("asset_categories").select("*").order("name"),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assets</h1>
          <p className="mt-1 text-sm text-slate-500">
            {assets?.length ?? 0} asset{assets?.length === 1 ? "" : "s"}
            {status ? ` (status: ${status.replace("_", " ")})` : ""}
            {category ? ` in ${category}` : ""}.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {VALID_STATUSES.map((s) => (
          <a
            key={s}
            href={`/fleet/assets?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 capitalize ${
              status === s
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {s.replace("_", " ")}
          </a>
        ))}
        <Link
          href="/fleet/assets"
          className={`rounded-lg border px-3 py-1.5 ${
            !status
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          All statuses
        </Link>
      </div>

      {(categories ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {categories!.map((c) => (
            <a
              key={c.id}
              href={`/fleet/assets?category=${encodeURIComponent(c.name)}${status ? `&status=${status}` : ""}`}
              className={`rounded-lg border px-3 py-1.5 ${
                category === c.name
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      <div className="mt-6">
        <AssetTable assets={assets ?? []} />
      </div>
    </div>
  );
}
