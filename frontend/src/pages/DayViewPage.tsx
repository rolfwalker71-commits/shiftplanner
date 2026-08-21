import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { Shift } from "../types";
import {
  dayWindow,
  formatDate,
  iso,
  weekdayLong,
  workLabel,
} from "../lib/dates";

export function DayViewPage() {
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

  useEffect(() => {
    api.shifts(from, to).then(setShifts).catch(() => setShifts([]));
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

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={scroller}
        className="hide-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto pb-1"
      >
        {days.map((d) => {
          const key = iso(d);
          const placed = byDay.get(key) ?? [];
          const primary = placed[0];
          const type = primary?.shiftType;
          return (
            <article
              key={key}
              id={`day-${key}`}
              data-day={key}
              className="w-[calc(100%-2rem)] shrink-0 snap-center px-4"
            >
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
                <div className="shift-cover relative aspect-[3/4] min-h-[22rem] bg-canvas">
                  {type?.imagePath ? (
                    <img src={type.imagePath} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center px-6 text-center">
                      <p className="text-[1.25rem] font-bold leading-snug text-muted">Keine Schicht</p>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-xl bg-white/80 px-3 py-2">
                    <p className="text-[1rem] font-bold leading-snug text-ink">{weekdayLong(d)}</p>
                    <p className="text-[0.95rem] font-bold leading-snug text-ink">{formatDate(d)}</p>
                  </div>
                  {type ? (
                    <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-white/80 px-4 py-3">
                      <div className="flex items-end justify-between gap-3">
                        <p className="text-[2rem] font-bold leading-none text-ink">{type.code}</p>
                        <div className="min-w-0 text-right">
                          <p className="text-[1.05rem] font-bold leading-snug text-ink">{type.name}</p>
                          <p className="text-[0.875rem] leading-snug text-ink">
                            {workLabel(type.startTime, type.endTime, type.allDay, type.breakMinutes)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-1.5 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-navy" />
          <span className="size-1.5 rounded-full bg-line" />
        </div>
        <p className="text-[0.75rem] leading-snug text-muted">← Wischen für andere Tage</p>
        <p className="sr-only">Aktueller Tag {formatDate(current)}</p>
      </div>
    </div>
  );
}
