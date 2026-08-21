import type { ShiftType } from "../types";
import { formatTimeRange, netHours } from "../lib/dates";

export function ShiftChip({
  type,
  compact = false,
}: {
  type: ShiftType;
  compact?: boolean;
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-xl px-2 py-1 text-[0.8125rem] leading-snug ring-1 ring-black/5"
      style={{ background: `${type.color}33` }}
    >
      {type.imagePath ? (
        <img
          src={type.imagePath}
          alt=""
          className={compact ? "size-6 rounded-md object-cover" : "size-8 rounded-lg object-cover"}
        />
      ) : (
        <span
          className={compact ? "size-6 rounded-md" : "size-8 rounded-lg"}
          style={{ background: type.color }}
        />
      )}
      <span className="min-w-0">
        <span className="block font-semibold">{type.code}</span>
        {!compact && (
          <span className="block text-[0.7rem] text-muted">
            {formatTimeRange(type.startTime, type.endTime, type.allDay)}
            {!type.allDay && type.breakMinutes ? ` · P ${type.breakMinutes} Min` : ""}
          </span>
        )}
      </span>
    </span>
  );
}

export function TypeMeta({ type }: { type: ShiftType }) {
  const net = netHours(type.startTime, type.endTime, type.breakMinutes, type.allDay);
  return (
    <p className="text-[0.8125rem] text-muted">
      {formatTimeRange(type.startTime, type.endTime, type.allDay)}
      {!type.allDay ? ` · Pause ${type.breakMinutes} Min${net ? ` · Netto ${net}` : ""}` : ""}
    </p>
  );
}
