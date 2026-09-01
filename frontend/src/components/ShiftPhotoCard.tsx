import type { ShiftType } from "../types";
import { formatDate, weekdayLong } from "../lib/dates";

export function ShiftPhotoCard({
  date,
  type,
  compact = false,
  fill = false,
}: {
  date: Date | string;
  type?: ShiftType | null;
  compact?: boolean;
  fill?: boolean;
}) {
  return (
    <div
      className={`shift-cover relative overflow-hidden bg-canvas ${
        fill
          ? "h-full min-h-0"
          : compact
            ? "aspect-[16/10] min-h-[7.5rem] rounded-2xl"
            : "aspect-[3/4] min-h-[22rem] rounded-2xl"
      }`}
    >
      {type?.imagePath ? (
        <img src={type.imagePath} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center px-6 text-center">
          <p className="text-[1.15rem] font-extrabold leading-snug text-muted">Keine Schicht</p>
        </div>
      )}
      <div className={`absolute left-3 top-3 z-10 max-w-[70%] rounded-xl bg-white/45 ${fill ? "px-2.5 py-1" : "px-3 py-1.5"}`}>
        <p className={`font-extrabold leading-snug text-ink ${fill ? "text-[0.85rem]" : "text-[0.95rem]"}`}>
          {weekdayLong(date)}
        </p>
        <p className={`font-extrabold leading-snug text-ink ${fill ? "text-[0.8rem]" : "text-[0.9rem]"}`}>
          {formatDate(date)}
        </p>
      </div>
      {type ? (
        <div className={`absolute inset-x-3 bottom-3 z-10 flex items-center justify-center rounded-2xl bg-white/45 px-3 ${fill ? "py-0.5" : "py-1"}`}>
          <p className={`text-center font-extrabold leading-none text-ink ${fill ? "text-[0.95rem]" : "text-[1.05rem]"}`}>
            {type.name && type.name.toLowerCase() !== type.code.toLowerCase()
              ? `${type.code} · ${type.name}`
              : type.code}
          </p>
        </div>
      ) : null}
    </div>
  );
}
