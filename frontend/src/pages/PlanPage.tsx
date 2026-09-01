import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addDays } from "date-fns";
import { Plus } from "lucide-react";
import { api } from "../api";
import type { Shift, ShiftType } from "../types";
import { useChrome } from "../hooks/useChrome";
import { ShiftDayRow } from "../components/ShiftDayRow";
import { useHeaderChip } from "../lib/headerChip";
import { asDate, iso, weekDays, weekTitle, weekWindow } from "../lib/dates";

export function PlanPage() {
  const chrome = useChrome();
  const [params] = useSearchParams();
  const requested =
    params.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("date")!)
      ? params.get("date")!
      : iso(new Date());
  const weeks = useMemo(() => weekWindow(new Date(), 16, 24), []);
  const from = iso(weeks[0]);
  const to = iso(addDays(weeks[weeks.length - 1], 6));
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [current, setCurrent] = useState(() => iso(weekDays(asDate(requested))[0]));
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState(requested);
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
    setPickedDay(requested);
    setCurrent(iso(weekDays(asDate(requested))[0]));
  }, [requested]);

  useEffect(() => {
    document.getElementById(`plan-week-${current}`)?.scrollIntoView({
      inline: "center",
      block: "nearest",
    });
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
  useHeaderChip(weekTitle(current));
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
                "calc(100dvh - var(--header-h) - var(--dock-h) - env(safe-area-inset-bottom, 0px) - 0.5rem)",
            }
          : undefined
      }
    >
      {mobile ? null : <h1 className="break-words text-[1.15rem] font-extrabold leading-snug">{weekTitle(current)}</h1>}
      <p className="sr-only" aria-live="polite">
        {msg}
      </p>

      <div
        ref={scroller}
        className={`hide-scrollbar min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [touch-action:pan-x] ${
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
                  return (
                    <ShiftDayRow
                      key={dayKey}
                      date={d}
                      type={type}
                      selected={dayKey === pickedDay}
                      grow
                      emptyCover={<Plus className="size-5" />}
                      onOpen={() => assign(dayKey)}
                      trailing={
                        primary ? (
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
                        )
                      }
                    />
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
