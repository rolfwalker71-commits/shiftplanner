import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import { Plus } from "lucide-react";
import { api } from "../api";
import type { Shift, ShiftType } from "../types";
import { useChrome } from "../hooks/useChrome";
import { listTileClass } from "../lib/platform";
import {
  iso,
  weekDays,
  weekRangeCompact,
  weekWindow,
  weekdayShort,
  workLabelCompact,
} from "../lib/dates";

export function PlanPage() {
  const chrome = useChrome();
  const weeks = useMemo(() => weekWindow(new Date(), 16, 24), []);
  const from = iso(weeks[0]);
  const to = iso(addDays(weeks[weeks.length - 1], 6));
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [current, setCurrent] = useState(() => iso(weekDays(new Date())[0]));
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState(() => iso(new Date()));
  const [msg, setMsg] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  async function reload() {
    const [t, s] = await Promise.all([api.shiftTypes(), api.shifts(from, to)]);
    setTypes(t);
    setShifts(s);
  }

  useEffect(() => {
    reload().catch(() => undefined);
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [shifts]);

  useEffect(() => {
    document.getElementById(`plan-week-${current}`)?.scrollIntoView({
      inline: "center",
      block: "nearest",
    });
  }, [weeks.length]);

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

  const mobile = chrome !== "desktop";
  const chips = (
    <div
      className={`hide-scrollbar flex gap-1 overflow-x-auto ${
        mobile
          ? "h-12 min-h-12 items-center bg-[var(--app-surface)] px-3"
          : "h-10 min-h-10 items-center rounded-md bg-card px-1 ring-1 ring-border"
      }`}
    >
      {types.map((t) => {
        const on = pickedType === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setPickedType(on ? null : t.id)}
            className={`h-8 shrink-0 rounded-full px-3 text-[0.8125rem] font-extrabold leading-none text-ink ${
              on ? "ring-2 ring-primary ring-offset-2 ring-offset-[var(--app-surface)]" : ""
            }`}
            style={{ background: t.color }}
          >
            {t.code}
          </button>
        );
      })}
    </div>
  );

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
      <h1
        className={`shrink-0 text-center font-extrabold leading-snug tracking-tight ${
          mobile ? "px-4 pb-1 pt-1 text-[1.2rem]" : "text-[1.15rem]"
        }`}
      >
        {weekRangeCompact(current)}
      </h1>
      <p className="sr-only" aria-live="polite">
        {msg}
      </p>

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
                id={`plan-week-${key}`}
                data-week={key}
                className={`flex h-full shrink-0 snap-center flex-col ${
                  mobile ? "w-full gap-1.5 px-4" : "w-full gap-2 px-1"
                }`}
              >
                {days.map((d) => {
                  const dayKey = iso(d);
                  const primary = (byDay.get(dayKey) ?? [])[0];
                  const type = primary?.shiftType;
                  const empty = !primary;
                  const selected = dayKey === pickedDay;
                  return (
                    <div
                      key={dayKey}
                      className={`flex min-h-0 flex-1 items-stretch overflow-hidden ${listTileClass(chrome, selected)}`}
                    >
                      {empty ? (
                        <button
                          type="button"
                          className="grid aspect-square h-full min-h-0 shrink-0 place-items-center self-stretch bg-canvas"
                          onClick={() => assign(dayKey)}
                          aria-label={`${weekdayShort(d)} Schicht wählen`}
                        >
                          <Plus className="size-5 text-muted" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="shift-cover aspect-square h-full min-h-0 shrink-0 self-stretch bg-canvas"
                          onClick={() => assign(dayKey)}
                        >
                          {type?.imagePath ? (
                            <img src={type.imagePath} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="grid size-full place-items-center text-[0.85rem] font-bold">
                              {type?.code}
                            </span>
                          )}
                        </button>
                      )}
                      <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => assign(dayKey)}
                        >
                          <p className="font-bold leading-none">
                            {weekdayShort(d)} {d.getDate()}.
                          </p>
                          <p className="mt-0.5 text-[0.8rem] leading-none text-muted">
                            {empty
                              ? "wählen"
                              : type
                                ? workLabelCompact(type.startTime, type.endTime, type.allDay)
                                : ""}
                          </p>
                        </button>
                        {type ? (
                          <p className="shrink-0 text-[1.25rem] font-extrabold leading-none text-primary">
                            {type.code}
                          </p>
                        ) : null}
                        {primary ? (
                          <button
                            type="button"
                            className="grid size-12 shrink-0 place-items-center text-[1.25rem] font-bold"
                            onClick={() => remove(primary.id)}
                            aria-label={`${type?.code ?? "Schicht"} löschen`}
                          >
                            ×
                          </button>
                        ) : (
                          <span className="grid size-12 shrink-0 place-items-center text-[1.15rem] text-muted">
                            ›
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      <div className="shrink-0">{chips}</div>
    </div>
  );
}
