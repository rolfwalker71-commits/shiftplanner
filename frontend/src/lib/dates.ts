import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";

/** Storage / API: yyyy-MM-dd */
export const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Display: dd.MM.yyyy */
export function formatDate(d: Date | string) {
  const date = typeof d === "string" ? parseISO(d.length === 10 ? `${d}T12:00:00` : d) : d;
  return format(date, "dd.MM.yyyy");
}

/** Display: HH:mm, 24-Stunden */
export function formatTime(hhmm: string | null | undefined) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  const hour = Number(h);
  const min = Number(m ?? 0);
  if (Number.isNaN(hour) || Number.isNaN(min)) return hhmm;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Accepts 6:30, 0630, 06.30 → HH:mm or null */
export function normalizeTime(raw: string) {
  const t = raw.trim().replace(".", ":").replace(",", ":");
  const compact = t.replace(":", "");
  let h: number;
  let m: number;
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    [h, m] = t.split(":").map(Number);
  } else if (/^\d{3,4}$/.test(compact)) {
    const p = compact.padStart(4, "0");
    h = Number(p.slice(0, 2));
    m = Number(p.slice(2));
  } else {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTimeRange(start: string | null, end: string | null, allDay: boolean) {
  if (allDay || !start || !end) return "ganztags";
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function formatDateRange(from: Date | string, to: Date | string) {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export function monthGrid(anchor: Date) {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function weekDays(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function monthLabel(anchor: Date) {
  return formatDateRange(startOfMonth(anchor), endOfMonth(anchor));
}

export function weekdayShort(d: Date) {
  return format(d, "EEEEEE", { locale: de });
}

export function netHours(
  start: string | null,
  end: string | null,
  breakMinutes: number,
  allDay: boolean,
) {
  if (allDay || !start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  minutes -= breakMinutes;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} Std`;
}
