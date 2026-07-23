"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "done";

// Reached via the link in Supabase's password-reset email. Supabase
// supports two different redirect shapes depending on project settings —
// a "#access_token=..." hash fragment (implicit flow) or a "?code=..."
// query param (PKCE flow) — and there's no dashboard setting we can rely on
// being one or the other, so this handles both:
//   - PKCE: exchangeCodeForSession(code) turns the code into a session.
//   - Implicit: the browser client parses the hash automatically on init
//     and fires a "PASSWORD_RECOVERY" auth event once the session exists.
// Either way, once a session exists, updateUser({ password }) sets the new
// password on the account tied to that session.
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setStatus(ok ? "ready" : "invalid");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") finish(true);
    });

    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => finish(!error));
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) finish(true);
      });
    }

    // Give the hash-parsing / code exchange a few seconds before treating
    // the link as invalid or expired.
    const timeout = setTimeout(() => finish(false), 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    setStatus("done");
    setTimeout(() => router.push("/"), 1500);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>

        {status === "checking" && (
          <p className="mt-4 text-sm text-slate-500">Checking your reset link…</p>
        )}

        {status === "invalid" && (
          <div className="mt-4 space-y-3">
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              This link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="block text-center text-sm font-medium text-slate-900 underline underline-offset-2"
            >
              Request a new link
            </Link>
          </div>
        )}

        {status === "done" && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Password updated. Taking you to the app…
          </p>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
