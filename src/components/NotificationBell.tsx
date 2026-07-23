"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { markNotificationsRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/types";

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// Same outside-click/Escape-to-close shape as NavDropdown, but with a badge
// count on the trigger instead of a text label, so it's a separate small
// component rather than reusing NavDropdown directly.
export default function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read_at);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleMarkAllRead() {
    startTransition(async () => {
      await markNotificationsRead();
    });
  }

  function handleOpenOne(id: string) {
    startTransition(async () => {
      await markNotificationsRead(id);
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Notifications"
        className="relative rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        Notifications
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={handleMarkAllRead}
                className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="my-1 border-t border-slate-100" />
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No notifications.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link_path ?? "#"}
                    onClick={() => {
                      if (!n.read_at) handleOpenOne(n.id);
                      setOpen(false);
                    }}
                    className={`block px-3 py-2 text-sm hover:bg-slate-50 ${
                      n.read_at ? "text-slate-500" : "font-medium text-slate-900"
                    }`}
                  >
                    <p>{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                    <p className="text-xs text-slate-400">
                      {dateTimeFmt.format(new Date(n.created_at))}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
