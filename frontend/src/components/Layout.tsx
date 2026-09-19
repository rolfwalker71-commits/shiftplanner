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
import { useChrome, useWide } from "../hooks/useChrome";
import { HeaderChipProvider, useHeaderChipState } from "../lib/headerChip";
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
  const wide = useWide();
  const glass = chrome === "ios";
  const { chip } = useHeaderChipState();

  useEffect(() => {
    syncPushIfGranted().catch(() => undefined);
  }, []);

  return (
    <div className={`min-h-dvh ${glass ? "" : "bg-background"}`}>
      <header
        className={`chrome-header sticky top-0 z-20 flex items-center justify-between gap-3 px-4 ${glass ? "py-2.5" : "py-2"}`}
        style={glass ? { paddingTop: "calc(0.625rem + env(safe-area-inset-top, 0px))" } : undefined}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img src="/logo.png" alt="" className="size-10 shrink-0 lg:size-8" />
          <span className="shrink-0 text-[1.25rem] font-extrabold leading-snug tracking-tight lg:text-[1.05rem] lg:font-semibold">
            Arbeitsplan
          </span>
          {chip.label ? (
            <div
              className={`ml-auto flex min-w-0 items-center gap-0.5 lg:hidden ${
                glass ? "glass rounded-full p-0.5" : ""
              }`}
            >
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
              <span
                className={`min-w-0 text-right text-[0.7rem] font-bold leading-snug ${
                  glass
                    ? `px-2 py-1 text-foreground ${chip.onPrev || chip.onNext ? "" : "px-3"}`
                    : "rounded-md bg-secondary px-2 py-1 text-primary"
                }`}
              >
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
        <nav className={`hidden items-center gap-0.5 lg:flex ${glass ? "glass rounded-full p-1" : ""}`}>
          {desktopLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                glass
                  ? `flex h-10 items-center gap-2 rounded-full px-4 text-[0.875rem] transition-colors ${
                      isActive ? "glass-strong glass font-semibold text-primary" : "text-foreground hover:bg-canvas"
                    }`
                  : `relative flex h-11 items-center gap-2 px-3 text-[0.875rem] ${
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
        <div
          className={`hidden items-center gap-3 text-[0.8125rem] text-muted lg:flex ${
            glass ? "glass rounded-full py-1 pl-4 pr-1" : ""
          }`}
        >
          <span className="max-w-40 break-words leading-snug">{status.user?.email}</span>
          <button
            type="button"
            className={glass ? "h-9 rounded-full px-3 text-foreground hover:bg-canvas" : "rounded-md px-3 py-1 hover:bg-primary/10"}
            onClick={onLogout}
          >
            Abmelden
          </button>
        </div>
      </header>

      <main
        className="mx-auto max-w-7xl px-4 pt-2 lg:pt-4 lg:pb-8"
        style={
          wide
            ? undefined
            : {
                paddingBottom: "calc(var(--dock-h) + env(safe-area-inset-bottom, 0px))",
              }
        }
      >
        <Outlet context={{ status, onLogout }} />
      </main>

      {wide ? null : glass ? (
        <nav
          className="fixed inset-x-3 z-40 mx-auto max-w-md lg:hidden"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="glass flex rounded-full p-1">
            {mobileLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 [touch-action:manipulation] ${
                    isActive ? "glass glass-strong text-primary" : "text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <l.icon className="size-[1.35rem]" strokeWidth={isActive ? 2.4 : 2} />
                    <span
                      className={`max-w-full break-words text-center text-[0.625rem] leading-none ${
                        isActive ? "font-semibold" : "font-medium"
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
      ) : (
        <nav
          className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 bg-[var(--app-surface)] lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex">
            {mobileLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-0.5 [touch-action:manipulation]"
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
      )}
    </div>
  );
}
