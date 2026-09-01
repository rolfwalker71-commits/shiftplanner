import { NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Settings,
  Upload,
  UserRound,
} from "lucide-react";
import type { Status } from "../types";
import { useChrome } from "../hooks/useChrome";
import { HeaderChipProvider, useHeaderChipState } from "../lib/headerChip";
import { dockBarClass } from "../lib/platform";
import { syncPushIfGranted } from "../lib/push";

const desktopLinks = [
  { to: "/app", label: "Kalender", icon: CalendarDays, end: true },
  { to: "/app/schichten", label: "Schichten", icon: ClipboardList },
  { to: "/app/import", label: "Einlesen", icon: Upload },
  { to: "/app/hilfe", label: "Hilfe", icon: HelpCircle },
  { to: "/app/einstellungen", label: "Einstellungen", icon: Settings },
];

const mobileLinks = [
  { to: "/app/heute", label: "Tag", icon: Calendar },
  { to: "/app/woche", label: "Woche", icon: CalendarRange },
  { to: "/app/monat", label: "Monat", icon: CalendarDays },
  { to: "/app/planen", label: "Einteilen", icon: ClipboardList },
  { to: "/app/mehr", label: "Konto", icon: UserRound },
];

export function Layout({
  status,
  onLogout,
}: {
  status: Status;
  onLogout: () => void;
}) {
  return (
    <HeaderChipProvider>
      <LayoutInner status={status} onLogout={onLogout} />
    </HeaderChipProvider>
  );
}

function LayoutInner({
  status,
  onLogout,
}: {
  status: Status;
  onLogout: () => void;
}) {
  const chrome = useChrome();
  const { chip } = useHeaderChipState();

  useEffect(() => {
    syncPushIfGranted().catch(() => undefined);
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="chrome-header sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img src="/logo.png" alt="" className="size-10 shrink-0 lg:size-8" />
          <span className="shrink-0 text-[1.25rem] font-extrabold leading-snug tracking-tight lg:text-[1.05rem] lg:font-semibold">
            Arbeitsplan
          </span>
          {chip.label ? (
            <div className="ml-auto flex min-w-0 items-center gap-0.5 lg:hidden">
              {chip.onPrev ? (
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center text-primary"
                  onClick={chip.onPrev}
                  aria-label="Zurück"
                >
                  <ChevronLeft className="size-4" />
                </button>
              ) : null}
              <span className="min-w-0 rounded-md bg-secondary px-2 py-1 text-right text-[0.7rem] font-bold leading-snug text-primary">
                <span className="block break-words">{chip.label}</span>
              </span>
              {chip.onNext ? (
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center text-primary"
                  onClick={chip.onNext}
                  aria-label="Weiter"
                >
                  <ChevronRight className="size-4" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <nav className="hidden items-center gap-0.5 lg:flex">
          {desktopLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `relative flex h-11 items-center gap-2 px-3 text-[0.875rem] ${
                  isActive
                    ? "bg-primary/10 font-medium text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary"
                    : "text-muted hover:bg-primary/5"
                }`
              }
            >
              <l.icon className="size-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 text-[0.8125rem] text-muted lg:flex">
          <span className="max-w-40 break-words leading-snug">{status.user?.email}</span>
          <button type="button" className="rounded-md px-3 py-1 hover:bg-primary/10" onClick={onLogout}>
            Abmelden
          </button>
        </div>
      </header>

      <main
        className="mx-auto max-w-7xl px-4 pt-2 lg:pt-4 lg:pb-8"
        style={
          chrome === "desktop"
            ? undefined
            : {
                paddingBottom: "calc(var(--dock-h) + env(safe-area-inset-bottom, 0px))",
              }
        }
      >
        <Outlet context={{ status, onLogout }} />
      </main>

      <nav
        className={dockBarClass(chrome)}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex">
          {mobileLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-0.5"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid size-10 place-items-center rounded-full ${
                      isActive ? "bg-secondary text-primary" : "text-muted"
                    }`}
                  >
                    <l.icon className="size-5" />
                  </span>
                  <span
                    className={`max-w-full break-words text-center text-[0.7rem] leading-snug ${
                      isActive ? "font-semibold text-primary" : "text-muted"
                    }`}
                  >
                    {l.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
