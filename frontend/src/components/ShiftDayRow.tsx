import type { ReactNode } from "react";
import type { ShiftType } from "../types";
import { useChrome } from "../hooks/useChrome";
import { listTileClass } from "../lib/platform";
import { weekdayShort, workLabelCompact } from "../lib/dates";

export function ShiftDayRow({
  date,
  type,
  selected = false,
  emptyHint = "wählen",
  emptyCover,
  grow = false,
  onOpen,
  trailing,
}: {
  date: Date;
  type?: ShiftType | null;
  selected?: boolean;
  emptyHint?: string;
  emptyCover?: ReactNode;
  grow?: boolean;
  onOpen: () => void;
  trailing?: ReactNode;
}) {
  const chrome = useChrome();
  const empty = !type;

  return (
    <div
      className={`flex items-stretch overflow-hidden ${
        grow ? "min-h-0 flex-1" : "h-[4.25rem] min-h-[4.25rem]"
      } ${listTileClass(chrome, selected)}`}
    >
      <button
        type="button"
        className={`shift-cover shrink-0 overflow-hidden bg-canvas ${
          grow ? "aspect-square h-full min-h-0 w-auto max-h-full self-stretch" : "size-16"
        }`}
        onClick={onOpen}
        aria-label={`${weekdayShort(date)} ${type?.code ?? emptyHint}`}
      >
        {type?.imagePath ? (
          <img src={type.imagePath} alt="" className="size-full object-cover" />
        ) : empty ? (
          <span className="grid size-full place-items-center text-muted">
            {emptyCover ?? <span className="text-[0.85rem] font-bold">–</span>}
          </span>
        ) : (
          <span className="grid size-full place-items-center text-[0.85rem] font-bold">{type.code}</span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="font-bold leading-none">
            {weekdayShort(date)} {date.getDate()}.
          </p>
          <p className="mt-0.5 text-[0.8rem] leading-none text-muted">
            {empty ? emptyHint : workLabelCompact(type.startTime, type.endTime, type.allDay)}
          </p>
        </button>
        {type ? (
          <p className="shrink-0 text-[1.25rem] font-extrabold leading-none text-primary">{type.code}</p>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
