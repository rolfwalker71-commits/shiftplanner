import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import { api } from "../api";
import type { Shift } from "../types";
import { ShiftPhotoCard } from "../components/ShiftPhotoCard";
import { iso, weekDays, weekTitle, weekWindow } from "../lib/dates";

export function WeekViewPage() {
  const weeks = useMemo(() => weekWindow(new Date(), 16, 24), []);
  const from = iso(weeks[0]);
  const to = iso(addDays(weeks[weeks.length - 1], 6));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [current, setCurrent] = useState(() => iso(weekDays(new Date())[0]));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.shifts(from, to).then(setShifts).catch(() => setShifts([]));
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [shifts]);

  useEffect(() => {
    const el = document.getElementById(`week-${current}`);
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current, weeks.length]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = vis?.target.getAttribute("data-week");
        if (id) setCurrent(id);
      },
      { root, threshold: 0.55 },
    );
    for (const node of root.querySelectorAll("[data-week]")) obs.observe(node);
    return () => obs.disconnect();
  }, [weeks.length]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={scroller}
        className="hide-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto"
      >
        {weeks.map((start) => {
          const key = iso(start);
          const days = weekDays(start);
          return (
            <section
              key={key}
              id={`week-${key}`}
              data-week={key}
              className="w-full shrink-0 snap-center px-4"
            >
              <h1 className="mb-2 break-words text-[1.15rem] font-extrabold leading-snug">{weekTitle(start)}</h1>
              <div className="flex flex-col gap-2">
                {days.map((d) => {
                  const dayKey = iso(d);
                  const type = (byDay.get(dayKey) ?? [])[0]?.shiftType;
                  return <ShiftPhotoCard key={dayKey} date={d} type={type} compact />;
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-center text-[0.75rem] leading-snug text-muted">← Woche wischen</p>
    </div>
  );
}
