import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import { api } from "../api";
import type { Shift } from "../types";
import { ShiftPhotoCard } from "../components/ShiftPhotoCard";
import { useChrome } from "../hooks/useChrome";
import { useHeaderChip } from "../lib/headerChip";
import { iso, weekDays, weekTitle, weekWindow } from "../lib/dates";

export function WeekViewPage() {
  const chrome = useChrome();
  const mobile = chrome !== "desktop";
  const weeks = useMemo(() => weekWindow(new Date(), 16, 24), []);
  const from = iso(weeks[0]);
  const to = iso(addDays(weeks[weeks.length - 1], 6));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [current, setCurrent] = useState(() => iso(weekDays(new Date())[0]));
  const scroller = useRef<HTMLDivElement>(null);
  useHeaderChip(weekTitle(current));

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
    <div
      className={`flex flex-col ${mobile ? "-mx-4 overflow-hidden" : "gap-3"}`}
      style={
        mobile
          ? {
              height:
                "calc(100dvh - var(--header-h) - var(--dock-h) - env(safe-area-inset-bottom, 0px) - 0.5rem)",
            }
          : undefined
      }
    >
      {mobile ? null : <h1 className="break-words text-[1.15rem] font-extrabold leading-snug">{weekTitle(current)}</h1>}
      <div
        ref={scroller}
        className={`hide-scrollbar min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden ${
          mobile ? "" : "-mx-1"
        }`}
      >
        <div className="flex h-full">
          {weeks.map((start) => {
            const key = iso(start);
            const days = weekDays(start);
            return (
              <section
                key={key}
                id={`week-${key}`}
                data-week={key}
                className={`flex h-full shrink-0 snap-center flex-col ${
                  mobile ? "w-full gap-1 px-4" : "w-full gap-2 px-1"
                }`}
              >
                {days.map((d) => {
                  const dayKey = iso(d);
                  const type = (byDay.get(dayKey) ?? [])[0]?.shiftType;
                  return (
                    <div
                      key={dayKey}
                      className={`min-h-0 flex-1 overflow-hidden ${
                        chrome === "desktop" ? "rounded-md" : "rounded-3xl"
                      }`}
                    >
                      <ShiftPhotoCard date={d} type={type} fill />
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
