import { NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  HelpCircle,
  Settings,
  Upload,
  UserRound,
} from "lucide-react";
import type { Status } from "../types";
import { syncPushIfGranted } from "../lib/push";

const desktopLinks = [
  { to: "/app", label: "Kalender", icon: CalendarDays, end: true },
  { to: "/app/schichten", label: "Schichten", icon: ClipboardList },
  { to: "/app/import", label: "Einlesen", icon: Upload },
  { to: "/app/hilfe", label: "Hilfe", icon: HelpCircle },
  { to: "/app/einstellungen", label: "Einstellungen", icon: Settings },
];

const mobileLinks = [
  { to: "/app/woche", label: "Woche", icon: CalendarRange },
  { to: "/app/planen", label: "Einteilen", icon: ClipboardList },
  { to: "/app/monat", label: "Monat", icon: CalendarDays },
  { to: "/app/mehr", label: "Konto", icon: UserRound },
];

export function Layout({
  status,
  onLogout,
}: {
  status: Status;
  onLogout: () => void;
}) {
  useEffect(() => {
    syncPushIfGranted().catch(() => undefined);
  }, []);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="size-10" />
          <span className="text-[1.375rem] font-bold leading-snug tracking-tight">Arbeitsplan</span>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {desktopLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex h-10 items-center gap-2 rounded-full px-3 text-[0.875rem] ${
                  isActive ? "bg-canvas font-medium" : "text-muted hover:bg-canvas"
                }`
              }
            >
              <l.icon className="size-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 text-[0.8125rem] text-muted md:flex">
          <span className="max-w-40 break-words leading-snug">{status.user?.email}</span>
          <button type="button" className="rounded-full px-3 py-1 hover:bg-canvas" onClick={onLogout}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:pb-8">
        <Outlet context={{ status, onLogout }} />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
        style={{
          padding:
            "max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-right)) 0.75rem max(0.75rem, env(safe-area-inset-left))",
        }}
      >
        <div className="flex rounded-2xl bg-white p-1 shadow-lg ring-1 ring-line">
          {mobileLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-center text-[0.7rem] leading-snug ${
                  isActive ? "bg-canvas font-medium" : "text-muted"
                }`
              }
            >
              <l.icon className="size-4" />
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
