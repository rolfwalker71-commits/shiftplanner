import type { ShiftType } from "../types";
import { formatDate, weekdayLong, workLabel } from "../lib/dates";

export function ShiftPhotoCard({
  date,
  type,
  compact = false,
}: {
  date: Date | string;
  type?: ShiftType | null;
  compact?: boolean;
}) {
  return (
    <div
      className={`shift-cover relative overflow-hidden rounded-2xl bg-canvas ${
        compact ? "aspect-[16/10] min-h-[7.5rem]" : "aspect-[3/4] min-h-[22rem]"
      }`}
    >
      {type?.imagePath ? (
        <img src={type.imagePath} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center px-6 text-center">
          <p className="text-[1.15rem] font-extrabold leading-snug text-muted">Keine Schicht</p>
        </div>
      )}
      <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-xl bg-white/45 px-3 py-1.5">
        <p className="text-[0.95rem] font-extrabold leading-snug text-ink">{weekdayLong(date)}</p>
        <p className="text-[0.9rem] font-extrabold leading-snug text-ink">{formatDate(date)}</p>
      </div>
      {type ? (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-white/45 px-4 py-1.5">
          <div className="flex items-end justify-between gap-3">
            <p className="text-[1.75rem] font-extrabold leading-none text-ink">{type.code}</p>
            <div className="min-w-0 text-right">
              <p className="text-[1rem] font-extrabold leading-snug text-ink">{type.name}</p>
              <p className="text-[0.8125rem] leading-snug text-ink">
                {workLabel(type.startTime, type.endTime, type.allDay, type.breakMinutes)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
