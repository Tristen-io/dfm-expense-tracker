"use client";

import { useEffect, useRef, useState } from "react";

// Client component (unlike the rest of Navbar) because closing on an
// outside click genuinely needs a document-level listener — the plain
// <details>/<summary> version this replaced had no way to do that and
// stayed open until its own summary was clicked again.
export default function NavDropdown({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        {label}
        <span
          className={`text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        // Closing on click here covers both "picked a link" (about to
        // navigate away anyway) and "clicked empty space inside the panel."
        <div
          onClick={() => setOpen(false)}
          className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
