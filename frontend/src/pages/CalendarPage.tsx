import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { addMonths, addWeeks, isSameMonth, startOfMonth } from "date-fns";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api";
import type { Shift, ShiftType } from "../types";
import { formatDate, formatDateRange, iso, monthGrid, monthLabel, weekDays, weekdayShort } from "../lib/dates";
import { ShiftChip } from "../components/ShiftChip";

export function CalendarPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [active, setActive] = useState<{ kind: "type" | "shift"; type: ShiftType; shiftId?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "week") {
      const days = weekDays(anchor);
      return { from: iso(days[0]), to: iso(days[6]) };
    }
    const days = monthGrid(anchor);
    return { from: iso(days[0]), to: iso(days[days.length - 1]) };
  }, [anchor, view]);

  async function reload() {
    const [t, s] = await Promise.all([api.shiftTypes(), api.shifts(range.from, range.to)]);
    setTypes(t);
    setShifts(s);
  }

  useEffect(() => {
    reload().catch((err) => setToast(err.message));
  }, [range.from, range.to]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return map;
  }, [shifts]);

  const days = view === "month" ? monthGrid(anchor) : weekDays(anchor);

  async function onDragEnd(ev: DragEndEvent) {
    const over = ev.over?.id?.toString();
    const from = ev.active.id.toString();
    setActive(null);
    if (!over?.startsWith("day:")) return;
    const date = over.slice(4);
    try {
      if (from.startsWith("type:")) {
        const shiftTypeId = from.slice(5);
        await api.createShift(shiftTypeId, date);
        setToast(`Schicht gelegt am ${formatDate(date)}`);
      } else if (from.startsWith("shift:")) {
        const id = from.slice(6);
        if (ev.activatorEvent && "altKey" in ev.activatorEvent && (ev.activatorEvent as MouseEvent).altKey) {
          const src = shifts.find((s) => s.id === id);
          if (src) await api.createShift(src.shiftTypeId, date);
        } else {
          await api.moveShift(id, date);
        }
        setToast(`Schicht aktualisiert: ${formatDate(date)}`);
      }
      await reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Fehler");
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => {
        const id = e.active.id.toString();
        if (id.startsWith("type:")) {
          const type = types.find((t) => t.id === id.slice(5));
          if (type) setActive({ kind: "type", type });
        } else if (id.startsWith("shift:")) {
          const s = shifts.find((x) => x.id === id.slice(6));
          if (s) setActive({ kind: "shift", type: s.shiftType, shiftId: s.id });
        }
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-64">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[1rem] font-semibold">Schichtarten</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {types.map((t) => (
                <TypeDrag key={t.id} type={t} />
              ))}
            </div>
            <p className="mt-2 text-[0.75rem] text-muted">Auf einen Tag ziehen · Option halten = duplizieren</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-white" onClick={() => setAnchor(view === "month" ? addMonths(anchor, -1) : addWeeks(anchor, -1))} aria-label="Zurück">
                <ChevronLeft className="size-4" />
              </button>
              <h1 className="min-w-40 text-[1.15rem] font-semibold leading-snug">
                {view === "month"
                  ? monthLabel(anchor)
                  : formatDateRange(weekDays(anchor)[0], weekDays(anchor)[6])}
              </h1>
              <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-white" onClick={() => setAnchor(view === "month" ? addMonths(anchor, 1) : addWeeks(anchor, 1))} aria-label="Weiter">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="flex h-10 rounded-full bg-white p-0.5 ring-1 ring-line">
              <button type="button" onClick={() => setView("week")} className={`flex h-full items-center gap-1 rounded-full px-3 text-[0.8125rem] leading-none ${view === "week" ? "bg-canvas font-medium" : "text-muted"}`}>
                <CalendarRange className="size-4" /> Woche
              </button>
              <button type="button" onClick={() => { setView("month"); setAnchor(startOfMonth(anchor)); }} className={`flex h-full items-center gap-1 rounded-full px-3 text-[0.8125rem] leading-none ${view === "month" ? "bg-canvas font-medium" : "text-muted"}`}>
                <CalendarDays className="size-4" /> Monat
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[0.75rem] text-muted">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className={`grid grid-cols-7 gap-1.5 ${view === "week" ? "min-h-[28rem]" : ""}`}>
            {days.map((d) => (
              <DayCell
                key={iso(d)}
                date={d}
                outside={view === "month" && !isSameMonth(d, anchor)}
                week={view === "week"}
                shifts={byDay.get(iso(d)) ?? []}
                onDelete={async (id) => {
                  await api.deleteShift(id);
                  await reload();
                }}
              />
            ))}
          </div>
        </section>
      </div>

      <DragOverlay>
        {active ? <ShiftChip type={active.type} compact /> : null}
      </DragOverlay>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-navy px-4 py-2 text-[0.8125rem] text-white shadow-lg md:bottom-6">
          {toast}
          <button type="button" className="ml-3 underline" onClick={() => setToast(null)}>
            Ok
          </button>
        </div>
      ) : null}
    </DndContext>
  );
}

function TypeDrag({ type }: { type: ShiftType }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `type:${type.id}`,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="min-w-40 rounded-2xl bg-canvas p-2 text-left lg:min-w-0"
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      <ShiftChip type={type} />
    </button>
  );
}

function DayCell({
  date,
  outside,
  week,
  shifts,
  onDelete,
}: {
  date: Date;
  outside: boolean;
  week: boolean;
  shifts: Shift[];
  onDelete: (id: string) => void;
}) {
  const id = `day:${iso(date)}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const today = iso(date) === iso(new Date());
  return (
    <div
      ref={setNodeRef}
      className={`min-h-20 rounded-2xl bg-white p-1.5 ring-1 ${isOver ? "ring-navy" : today ? "ring-navy/60" : "ring-line"} ${week ? "min-h-72" : ""} ${outside ? "opacity-45" : ""}`}
    >
      <div
        className={`mb-1 break-words text-[0.75rem] leading-snug ${today ? "font-semibold text-navy" : "text-muted"}`}
        title={formatDate(date)}
      >
        {formatDate(date)}
        <span className="sr-only"> {weekdayShort(date)}</span>
      </div>
      <div className="flex flex-col gap-1">
        {shifts.map((s) => (
          <PlacedShift key={s.id} shift={s} onDelete={() => onDelete(s.id)} />
        ))}
      </div>
    </div>
  );
}

function PlacedShift({ shift, onDelete }: { shift: Shift; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `shift:${shift.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      className="group relative"
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      <ShiftChip type={shift.shiftType} compact />
      <button
        type="button"
        className="absolute -right-1 -top-1 hidden size-5 place-items-center rounded-full bg-white text-[0.7rem] ring-1 ring-line group-hover:grid"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDelete}
        aria-label="Entfernen"
      >
        ×
      </button>
    </div>
  );
}
