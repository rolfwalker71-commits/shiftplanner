import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addMonths, eachDayOfInterval, endOfMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api";
import type { Shift } from "../types";
import { useChrome } from "../hooks/useChrome";
import { ShiftDayRow } from "../components/ShiftDayRow";
import { iconBtnClass } from "../lib/platform";
import { iso, monthTitle } from "../lib/dates";

export function MonthListPage() {
  const chrome = useChrome();
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
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={iconBtnClass(chrome)}
          onClick={() => setAnchor(addMonths(anchor, -1))}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="text-[1.15rem] font-extrabold leading-snug tracking-tight">{monthTitle(anchor)}</h1>
        <button
          type="button"
          className={iconBtnClass(chrome)}
          onClick={() => setAnchor(addMonths(anchor, 1))}
          aria-label="Nächster Monat"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {days.map((d) => {
          const key = iso(d);
          const type = (byDay.get(key) ?? [])[0]?.shiftType;
          return (
            <ShiftDayRow
              key={key}
              date={d}
              type={type}
              emptyHint="Frei"
              onOpen={() => navigate(`/app/heute?date=${key}`)}
              trailing={
                <span className="grid size-12 shrink-0 place-items-center text-[1.15rem] text-muted">›</span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
