import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { addDays } from "date-fns";
import { api } from "../api";
import type { Shift } from "../types";
import { ShiftPhotoCard } from "../components/ShiftPhotoCard";
import { useChrome } from "../hooks/useChrome";
import { listTileClass } from "../lib/platform";
import { asDate, dayWindow, formatTime, iso, workFacts } from "../lib/dates";

export function DayViewPage() {
  const chrome = useChrome();
  const [params] = useSearchParams();
  const requested =
    params.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("date")!)
      ? params.get("date")!
      : iso(new Date());
  const days = useMemo(() => dayWindow(new Date(), 60, 120), []);
  const from = iso(days[0]);
  const to = iso(days[days.length - 1]);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [current, setCurrent] = useState(requested);
  const scroller = useRef<HTMLDivElement>(null);
  const mobile = chrome !== "desktop";

  async function reload() {
    setShifts(await api.shifts(from, to));
  }

  useEffect(() => {
    reload().catch(() => setShifts([]));
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return map;
  }, [shifts]);

  useEffect(() => {
    const el = document.getElementById(`day-${requested}`);
    el?.scrollIntoView({ inline: "center", block: "nearest" });
    setCurrent(requested);
  }, [requested, days.length]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = vis?.target.getAttribute("data-day");
        if (id) setCurrent(id);
      },
      { root, threshold: 0.55 },
    );
    for (const node of root.querySelectorAll("[data-day]")) obs.observe(node);
    return () => obs.disconnect();
  }, [days.length]);

  const placed = byDay.get(current) ?? [];
  const shift = placed[0];
  const type = shift?.shiftType;
  const tomorrow = byDay.get(iso(addDays(asDate(current), 1)))?.[0]?.shiftType;
  const tomorrowLine = tomorrow
    ? tomorrow.allDay || !tomorrow.startTime
      ? `Morgen · ${tomorrow.code}`
      : `Morgen · ${tomorrow.code} · ${formatTime(tomorrow.startTime)}`
    : "Morgen · frei";

  async function remove() {
    if (!shift) return;
    await api.deleteShift(shift.id);
    await reload();
  }

  const btn =
    chrome === "desktop"
      ? "flex h-10 min-h-10 flex-1 items-center justify-center rounded-md text-[0.8125rem] font-semibold"
      : "flex h-10 min-h-10 flex-1 items-center justify-center rounded-full text-[0.8125rem] font-semibold";

  return (
    <div
      className={`flex flex-col ${mobile ? "-mx-4 overflow-hidden" : "gap-3"}`}
      style={
        mobile
          ? {
              height:
                "calc(100dvh - var(--header-h) - var(--dock-h) - env(safe-area-inset-bottom, 0px) - 1rem)",
            }
          : undefined
      }
    >
      <div
        ref={scroller}
        className={`hide-scrollbar min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden ${
          mobile ? "" : "-mx-1"
        }`}
      >
        <div className="flex h-full">
          {days.map((d) => {
            const key = iso(d);
            const dayType = (byDay.get(key) ?? [])[0]?.shiftType;
            return (
              <article
                key={key}
                id={`day-${key}`}
                data-day={key}
                className={`h-full shrink-0 snap-center ${mobile ? "w-full px-4" : "w-full px-1"}`}
              >
                <div className={`h-full overflow-hidden ${listTileClass(chrome)}`}>
                  <ShiftPhotoCard date={d} type={dayType} fill />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className={`shrink-0 ${mobile ? "px-4 py-1.5" : ""}`}>
        <div className={`px-3 py-2 ${listTileClass(chrome)}`}>
          <p className="break-words text-[0.95rem] font-extrabold leading-snug">
            {type ? workFacts(type.startTime, type.endTime, type.allDay, type.breakMinutes) : "Keine Schicht"}
          </p>
          <p className="mt-0.5 break-words text-[0.8rem] leading-snug text-muted">{tomorrowLine}</p>
          <div className="mt-2 flex gap-2">
            <Link
              to={`/app/planen?date=${current}`}
              className={`${btn} bg-primary text-[var(--app-on-primary)]`}
            >
              Ändern
            </Link>
            {shift ? (
              <button type="button" className={`${btn} bg-secondary text-primary`} onClick={() => remove()}>
                Löschen
              </button>
            ) : null}
          </div>
        </div>
        <p className="sr-only">Aktueller Tag {current}</p>
      </div>
    </div>
  );
}
