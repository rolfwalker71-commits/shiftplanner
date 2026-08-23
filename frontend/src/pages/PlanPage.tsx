import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api } from "../api";
import type { Shift, ShiftType } from "../types";
import { iso, weekDayCaption, weekdayShort, weekDays, workLabel } from "../lib/dates";

export function PlanPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState(() => iso(new Date()));
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    const from = iso(days[0]);
    const to = iso(days[6]);
    const [t, s] = await Promise.all([api.shiftTypes(), api.shifts(from, to)]);
    setTypes(t);
    setShifts(s);
  }

  useEffect(() => {
    reload().catch(() => undefined);
  }, [days[0], days[6]]);

  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [shifts]);

  async function assign(date: string) {
    if (!pickedType) {
      setPickedDay(date);
      setMsg("Zuerst eine Schichtart unten antippen");
      return;
    }
    const existing = byDay.get(date) ?? [];
    try {
      for (const s of existing) await api.deleteShift(s.id);
      await api.createShift(pickedType, date);
      setPickedDay(date);
      setMsg("Schicht gelegt");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Fehler");
    }
  }

  async function remove(id: string) {
    await api.deleteShift(id);
    await reload();
  }

  return (
    <div className="flex flex-col gap-3 pb-28">
      <h1 className="text-[1.25rem] font-bold leading-snug">Einteilen</h1>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full"
          onClick={() => setAnchor(addWeeks(anchor, -1))}
          aria-label="Vorherige Woche"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="hide-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {days.map((d) => {
            const key = iso(d);
            const on = key === pickedDay;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPickedDay(key)}
                className={`min-h-11 min-w-[3.4rem] flex-1 rounded-2xl px-1 py-2 leading-snug ${
                  on ? "bg-navy text-white" : "bg-white text-ink ring-1 ring-line"
                }`}
              >
                <span className="block text-[0.7rem] font-semibold">{weekdayShort(d)}</span>
                <span className="block text-[0.75rem] font-bold">{weekDayCaption(d)}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full"
          onClick={() => setAnchor(addWeeks(anchor, 1))}
          aria-label="Nächste Woche"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {days.map((d) => {
          const key = iso(d);
          const placed = byDay.get(key) ?? [];
          const primary = placed[0];
          const type = primary?.shiftType;
          const empty = !primary;
          const selected = key === pickedDay;
          return (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ${
                selected ? "ring-navy" : "ring-line"
              }`}
            >
              {empty ? (
                <button
                  type="button"
                  className="grid size-14 shrink-0 place-items-center rounded-xl border-2 border-dashed border-line"
                  onClick={() => assign(key)}
                  aria-label={`${weekdayShort(d)} Schicht wählen`}
                >
                  <Plus className="size-5 text-muted" />
                </button>
              ) : (
                <Link to={`/app/heute?date=${key}`} className="shift-cover size-14 shrink-0 rounded-xl bg-canvas">
                  {type?.imagePath ? (
                    <img src={type.imagePath} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-[0.8rem] font-bold">{type?.code}</span>
                  )}
                </Link>
              )}
              <div className="min-w-0 flex-1">
                {empty ? (
                  <button type="button" className="block w-full text-left" onClick={() => assign(key)}>
                    <p className="font-bold leading-snug">
                      {weekdayShort(d)} {weekDayCaption(d)}
                    </p>
                    <p className="text-[0.875rem] leading-snug text-muted">Schicht wählen</p>
                  </button>
                ) : (
                  <Link to={`/app/heute?date=${key}`} className="block">
                    <p className="font-bold leading-snug">
                      {weekdayShort(d)} {weekDayCaption(d)}
                    </p>
                    <p className="text-[0.875rem] leading-snug text-muted">
                      {type ? workLabel(type.startTime, type.endTime, type.allDay, type.breakMinutes) : ""}
                    </p>
                  </Link>
                )}
              </div>
              {primary ? (
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-[1.25rem] font-bold text-ink"
                  onClick={() => remove(primary.id)}
                  aria-label={`${type?.code ?? "Schicht"} löschen`}
                >
                  ×
                </button>
              ) : (
                <span className="text-[1.25rem] text-line">›</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-24 z-10 rounded-2xl bg-white/95 p-2 shadow-sm ring-1 ring-line backdrop-blur">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
          {types.map((t) => {
            const on = pickedType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPickedType(on ? null : t.id)}
                className={`h-11 shrink-0 rounded-full px-4 text-[0.8125rem] font-bold leading-none text-ink ${
                  on ? "ring-2 ring-navy ring-offset-2" : ""
                }`}
                style={{ background: t.color }}
              >
                {t.code}
                <span className="ml-1 font-medium">{t.name}</span>
              </button>
            );
          })}
        </div>
        <p className="px-1 pt-1 text-[0.75rem] leading-snug text-muted">
          Tippen, dann Tag wählen — kein Ziehen
          {pickedType ? ` · ${types.find((t) => t.id === pickedType)?.code}` : ""}
        </p>
      </div>
      {msg ? <p className="text-[0.8125rem] leading-snug text-muted">{msg}</p> : null}
    </div>
  );
}
