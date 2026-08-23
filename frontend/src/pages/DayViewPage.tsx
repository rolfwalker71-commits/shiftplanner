import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { Shift } from "../types";
import { ShiftPhotoCard } from "../components/ShiftPhotoCard";
import { dayWindow, formatDate, iso } from "../lib/dates";

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
          const type = (byDay.get(key) ?? [])[0]?.shiftType;
          return (
            <article
              key={key}
              id={`day-${key}`}
              data-day={key}
              className="w-[calc(100%-2rem)] shrink-0 snap-center px-4"
            >
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
                <ShiftPhotoCard date={d} type={type} />
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
        <p className="text-[0.75rem] leading-snug text-muted">← Tag wischen</p>
        <p className="sr-only">Aktueller Tag {formatDate(current)}</p>
      </div>
    </div>
  );
}
