import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addMonths, eachDayOfInterval, endOfMonth, startOfMonth } from "date-fns";
import { Calendar, CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api";
import type { Shift } from "../types";
import { iso, listDayLabel, monthTitle, workLabel } from "../lib/dates";

export function MonthListPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) }),
    [anchor],
  );
  const [shifts, setShifts] = useState<Shift[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.shifts(iso(days[0]), iso(days[days.length - 1])).then(setShifts).catch(() => setShifts([]));
  }, [days]);

  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [shifts]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-10 min-h-10 rounded-full bg-white p-0.5 ring-1 ring-line">
        <Link
          to="/app/heute"
          className="flex h-full min-h-0 flex-1 items-center justify-center gap-1 rounded-full text-[0.8125rem] leading-none text-muted"
        >
          <Calendar className="size-4" /> Tag
        </Link>
        <Link
          to="/app/woche"
          className="flex h-full min-h-0 flex-1 items-center justify-center gap-1 rounded-full text-[0.8125rem] leading-none text-muted"
        >
          <CalendarRange className="size-4" /> Woche
        </Link>
        <span className="flex h-full min-h-0 flex-1 items-center justify-center gap-1 rounded-full bg-canvas text-[0.8125rem] font-medium leading-none">
          <CalendarDays className="size-4" /> Monat
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full"
          onClick={() => setAnchor(addMonths(anchor, -1))}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="text-[1.15rem] font-bold leading-snug">{monthTitle(anchor)}</h1>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full"
          onClick={() => setAnchor(addMonths(anchor, 1))}
          aria-label="Nächster Monat"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {days.map((d) => {
          const key = iso(d);
          const primary = (byDay.get(key) ?? [])[0];
          const type = primary?.shiftType;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(`/app/heute?date=${key}`)}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-line"
            >
              <span className="shift-cover size-14 shrink-0 rounded-xl bg-canvas">
                {type?.imagePath ? (
                  <img src={type.imagePath} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-[0.8rem] font-bold text-muted">
                    {type?.code ?? "–"}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug">{listDayLabel(d)}</span>
                <span className="block text-[0.875rem] leading-snug text-muted">
                  {type
                    ? `${type.code} · ${workLabel(type.startTime, type.endTime, type.allDay, type.breakMinutes)}`
                    : "Frei"}
                </span>
              </span>
              <span className="text-[1.25rem] text-line">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
