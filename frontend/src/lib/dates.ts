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

export function weekTitle(anchor: Date | string) {
  const days = weekDays(asDate(anchor));
  return `${formatDate(days[0])} bis ${formatDate(days[6])}`;
}

export function weekWindow(center: Date, back: number, forward: number) {
  const start = startOfWeek(addDays(center, -back * 7), { weekStartsOn: 1 });
  return Array.from({ length: back + forward + 1 }, (_, i) => addDays(start, i * 7));
}

export function monthLabel(anchor: Date) {
  return formatDateRange(startOfMonth(anchor), endOfMonth(anchor));
}

export function asDate(d: Date | string) {
  return typeof d === "string" ? parseISO(`${d}T12:00:00`) : d;
}

export function weekdayShort(d: Date) {
  return format(d, "EEEEEE", { locale: de });
}

export function weekdayLong(d: Date | string) {
  return format(asDate(d), "EEEE", { locale: de });
}

export function monthTitle(d: Date) {
  const label = format(d, "LLLL yyyy", { locale: de });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function listDayLabel(d: Date | string) {
  return format(asDate(d), "EEEEEE dd.MM.yyyy", { locale: de });
}

export function weekDayCaption(d: Date) {
  return format(d, "dd.MM.", { locale: de });
}

export function workLabel(start: string | null, end: string | null, allDay: boolean, breakMinutes: number) {
  if (allDay || !start || !end) return "ganztags";
  const pause = breakMinutes > 0 ? ` · Pause ${breakMinutes} Min` : "";
  return `${formatTimeRange(start, end, false)} Uhr${pause}`;
}

export function workLabelCompact(start: string | null, end: string | null, allDay: boolean) {
  return formatTimeRange(start, end, allDay);
}

export function workFacts(
  start: string | null,
  end: string | null,
  allDay: boolean,
  breakMinutes: number,
) {
  if (allDay || !start || !end) return "ganztags";
  const parts = [formatTimeRange(start, end, false)];
  if (breakMinutes > 0) parts.push(`P ${breakMinutes}`);
  const net = netHours(start, end, breakMinutes, false);
  if (net) parts.push(net.replace(" Std", ""));
  return parts.join(" · ");
}

export function dayWindow(center: Date, back: number, forward: number) {
  return eachDayOfInterval({ start: addDays(center, -back), end: addDays(center, forward) });
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
