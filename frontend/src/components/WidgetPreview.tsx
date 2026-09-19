import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { WidgetPayload, WidgetSettings, WidgetShift } from "../types";

/*
 * HTML mirror of the Scriptable widget layouts (backend/src/lib/widgetScript.ts).
 * Keep both in step when a layout changes.
 */

export type WidgetFamily =
  | "small"
  | "medium"
  | "large"
  | "extraLarge"
  | "accessoryRectangular"
  | "accessoryCircular"
  | "accessoryInline";

export const WIDGET_SIZES: Record<"small" | "medium" | "large" | "extraLarge", [number, number]> = {
  small: [158, 158],
  medium: [338, 158],
  large: [338, 354],
  extraLarge: [715, 342],
};

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const INK = "#1D1D1F";

type Palette = { bg: string; card: string; ink: string; muted: string; accent: string; today: string; empty: string };
const LIGHT: Palette = { bg: "#F2F4F8", card: "#FFFFFF", ink: "#1D1D1F", muted: "#6E6E73", accent: "#007AFF", today: "rgba(0,122,255,0.14)", empty: "#E5E7EC" };
const DARK: Palette = { bg: "#0F1117", card: "#1C1F28", ink: "#F5F5F7", muted: "#9C9CA3", accent: "#0A84FF", today: "rgba(10,132,255,0.2)", empty: "#262A35" };

// ---------- dates ----------

const pad = (n: number) => (n < 10 ? "0" : "") + n;
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const dayDiff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
const addDays = (date: string, n: number) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const mondayOf = (date: string) => {
  const d = parse(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
};
function relLabel(date: string, today: string) {
  const diff = dayDiff(today, date);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  const d = parse(date);
  return `${WD[d.getDay()]} ${d.getDate()}.`;
}
function isoWeek(date: string) {
  const d = parse(date);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}
const timeText = (s: WidgetShift) => (s.allDay || !s.start || !s.end ? "ganztags" : `${s.start}–${s.end}`);
const hoursText = (h: number) => `${(Math.round(h * 10) / 10).toString().replace(".", ",")} Std.`;

// ---------- model ----------

class Model {
  constructor(
    readonly data: WidgetPayload,
    readonly s: WidgetSettings,
    readonly now: Date,
  ) {}
  get today() {
    return ymd(this.now);
  }
  day(date: string) {
    return this.data.days.find((d) => d.date === date) ?? { date, shift: null };
  }
  visible(shift: WidgetShift | null) {
    if (!shift) return null;
    if (shift.allDay && !this.s.showFree) return null;
    return shift;
  }
  nextWork() {
    const mins = this.now.getHours() * 60 + this.now.getMinutes();
    for (const d of this.data.days) {
      if (d.date < this.today || !d.shift || d.shift.allDay || !d.shift.start) continue;
      if (d.date === this.today && d.shift.end) {
        const s = toMin(d.shift.start);
        let e = toMin(d.shift.end);
        if (e <= s) e += 1440;
        if (mins >= e) continue;
      }
      return d as { date: string; shift: WidgetShift };
    }
    return null;
  }
  countdown(day: { date: string; shift: WidgetShift }) {
    const start = parse(day.date);
    const sm = toMin(day.shift.start!);
    start.setHours(Math.floor(sm / 60), sm % 60, 0, 0);
    const diff = Math.round((start.getTime() - this.now.getTime()) / 60000);
    if (diff <= 0) return "läuft";
    if (diff < 60) return `in ${diff} Min.`;
    if (diff < 24 * 60) return `in ${Math.round(diff / 60)} Std.`;
    const days = dayDiff(this.today, day.date);
    return `in ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  }
  weekHours(start: string) {
    let h = 0;
    for (let i = 0; i < 7; i++) h += this.day(addDays(start, i)).shift?.hours ?? 0;
    return h;
  }
}

// ---------- pieces ----------

function CodePill({ shift, size }: { shift: WidgetShift; size: number }) {
  return (
    <span
      style={{ background: shift.color, color: INK, fontSize: size, borderRadius: size, padding: "2px 7px" }}
      className="inline-block font-bold leading-tight whitespace-nowrap"
    >
      {shift.code}
    </span>
  );
}

function Avatar({ shift, size, m, p }: { shift: WidgetShift | null; size: number; m: Model; p: Palette }) {
  if (shift && m.s.showImages && shift.thumb) {
    return <img src={shift.thumb} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      style={{ width: size, height: size, background: shift ? shift.color : p.empty, color: shift ? INK : p.muted, fontSize: size * 0.34 }}
      className="grid shrink-0 place-items-center rounded-full font-bold"
    >
      {shift ? shift.code : "–"}
    </span>
  );
}

function Header({ m, p, right }: { m: Model; p: Palette; right?: string }) {
  return (
    <div className="flex items-center justify-between gap-2" style={{ color: p.ink }}>
      <span className="truncate text-[13px] font-bold">{m.s.title || "Arbeitsplan"}</span>
      {right ? <span className="shrink-0 text-[11px] font-medium" style={{ color: p.muted }}>{right}</span> : null}
    </div>
  );
}

function HeroTile({
  day,
  label,
  emptyTitle,
  emptyText,
  m,
  p,
  style,
}: {
  day: { date: string; shift: WidgetShift | null } | null;
  label: string;
  emptyTitle: string;
  emptyText?: string;
  m: Model;
  p: Palette;
  style?: CSSProperties;
}) {
  const shift = day ? m.visible(day.shift) : null;
  const img = shift && m.s.showImages ? shift.image : null;
  if (!shift) {
    return (
      <div style={{ background: p.card, color: p.ink, ...style }} className="flex flex-col p-3">
        <span className="text-[10px] font-semibold uppercase" style={{ color: p.muted }}>{label}</span>
        <span className="mt-1 text-[22px] font-bold leading-tight">{emptyTitle}</span>
        <span className="flex-1" />
        {emptyText ? <span className="text-[11px] font-medium leading-snug" style={{ color: p.muted }}>{emptyText}</span> : null}
      </div>
    );
  }
  const fg = img ? "#fff" : INK;
  return (
    <div
      style={{ background: img ? `center / cover url(${img})` : shift.color, ...style }}
      className="flex flex-col justify-end p-2"
    >
      <div
        className="rounded-[12px] px-[9px] pt-[5px] pb-[6px]"
        style={{ background: img ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)", color: fg }}
      >
        <div className="text-[9px] font-semibold uppercase opacity-85">{label}</div>
        <div className="truncate text-[20px] font-black leading-tight">{shift.code}</div>
        {m.s.showTimes ? <div className="truncate text-[11px] font-semibold">{timeText(shift)}</div> : null}
      </div>
    </div>
  );
}

function WeekColumns({ m, p, start, thumb }: { m: Model; p: Palette; start: string; thumb: number }) {
  return (
    <div className="grid grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const shift = m.visible(m.day(date).shift);
        const isToday = date === m.today;
        const d = parse(date);
        return (
          <div
            key={date}
            className="flex flex-col items-center gap-1 rounded-[12px] py-1"
            style={{ background: isToday ? p.today : undefined }}
          >
            <span className="text-[10px] font-semibold" style={{ color: isToday ? p.accent : p.muted }}>
              {WD[d.getDay()]} {d.getDate()}
            </span>
            <Avatar shift={shift} size={thumb} m={m} p={p} />
            <span className="max-w-full truncate text-[11px] font-bold" style={{ color: shift ? p.ink : p.muted }}>
              {shift ? shift.code : "frei"}
            </span>
            {m.s.showTimes && shift && !shift.allDay && thumb >= 36 ? (
              <span className="-mt-1 text-[9px] font-medium" style={{ color: p.muted }}>{shift.start}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------- layouts ----------

function Small({ m, p }: { m: Model; p: Palette }) {
  const full = { width: "100%", height: "100%" };
  if (m.s.small === "today") {
    const next = m.nextWork();
    return (
      <HeroTile
        day={m.day(m.today)}
        label="Heute"
        emptyTitle="Frei"
        emptyText={next ? `Nächste: ${relLabel(next.date, m.today)} · ${next.shift.code}` : ""}
        m={m}
        p={p}
        style={full}
      />
    );
  }
  if (m.s.small === "countdown") {
    const day = m.nextWork();
    const cd = day ? m.countdown(day) : "";
    return (
      <div className="flex h-full flex-col p-[14px]" style={{ background: p.bg, color: p.ink }}>
        <div className="flex items-center justify-between">
          <Avatar shift={day?.shift ?? null} size={40} m={m} p={p} />
          {day ? <CodePill shift={day.shift} size={13} /> : null}
        </div>
        <div className="flex-1" />
        {day ? (
          <>
            <div className="text-[26px] font-bold leading-tight" style={{ color: cd === "läuft" ? p.accent : p.ink }}>{cd}</div>
            <div className="truncate text-[11px] font-semibold" style={{ color: p.muted }}>
              {relLabel(day.date, m.today)}
              {m.s.showTimes ? ` · ${timeText(day.shift)}` : ""}
            </div>
            <div className="truncate text-[11px] font-medium" style={{ color: p.muted }}>{day.shift.name}</div>
          </>
        ) : (
          <>
            <div className="text-[24px] font-bold">Frei</div>
            <div className="text-[11px]" style={{ color: p.muted }}>Keine Schicht geplant</div>
          </>
        )}
      </div>
    );
  }
  const day = m.nextWork();
  return (
    <HeroTile
      day={day}
      label={day ? relLabel(day.date, m.today) : "Nächste Schicht"}
      emptyTitle="Frei"
      emptyText="Keine Schicht in den nächsten Wochen"
      m={m}
      p={p}
      style={full}
    />
  );
}

function Medium({ m, p }: { m: Model; p: Palette }) {
  if (m.s.medium === "week") {
    const start = mondayOf(m.today);
    return (
      <div className="flex h-full flex-col px-[10px] pt-3 pb-[10px]" style={{ background: p.bg }}>
        <Header m={m} p={p} right={`KW ${isoWeek(m.today)}${m.s.showHours ? ` · ${hoursText(m.weekHours(start))}` : ""}`} />
        <div className="flex-1" />
        <WeekColumns m={m} p={p} start={start} thumb={34} />
      </div>
    );
  }
  return (
    <div className="grid h-full grid-cols-2 gap-2 p-[10px]" style={{ background: p.bg }}>
      {["Heute", "Morgen"].map((label, i) => (
        <HeroTile
          key={label}
          day={m.day(addDays(m.today, i))}
          label={label}
          emptyTitle="Frei"
          m={m}
          p={p}
          style={{ borderRadius: 16, overflow: "hidden" }}
        />
      ))}
    </div>
  );
}

function Large({ m, p }: { m: Model; p: Palette }) {
  const start = mondayOf(m.today);
  if (m.s.large === "twoWeeks") {
    return (
      <div className="flex h-full flex-col px-[10px] pt-[14px] pb-3" style={{ background: p.bg }}>
        <Header m={m} p={p} right={m.s.showHours ? hoursText(m.weekHours(start) + m.weekHours(addDays(start, 7))) : ""} />
        {[0, 1].map((k) => {
          const ws = addDays(start, 7 * k);
          return (
            <div key={ws} className={k === 0 ? "mt-2" : "mt-[10px]"}>
              <div className="mb-1 pl-1 text-[11px] font-semibold" style={{ color: p.muted }}>
                KW {isoWeek(ws)} · {k === 0 ? "diese Woche" : "nächste Woche"}
              </div>
              <WeekColumns m={m} p={p} start={ws} thumb={38} />
            </div>
          );
        })}
      </div>
    );
  }
  if (m.s.large === "month") return <MonthGrid m={m} p={p} compact />;
  return (
    <div className="flex h-full flex-col gap-[3px] px-3 pt-[14px] pb-3" style={{ background: p.bg }}>
      <Header m={m} p={p} right={`KW ${isoWeek(m.today)}${m.s.showHours ? ` · ${hoursText(m.weekHours(start))}` : ""}`} />
      <div className="h-1" />
      {Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const shift = m.visible(m.day(date).shift);
        const isToday = date === m.today;
        const d = parse(date);
        return (
          <div
            key={date}
            className="flex items-center gap-[10px] rounded-[12px] py-[3px] pr-2 pl-[6px]"
            style={{ background: isToday ? p.today : undefined }}
          >
            <Avatar shift={shift} size={36} m={m} p={p} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold leading-tight" style={{ color: isToday ? p.accent : p.ink }}>
                {WD[d.getDay()]} {d.getDate()}.{isToday ? "  Heute" : ""}
              </div>
              <div className="truncate text-[11px] font-medium" style={{ color: p.muted }}>{shift ? shift.name : "frei"}</div>
            </div>
            {shift ? (
              <div className="flex flex-col items-end">
                <CodePill shift={shift} size={12} />
                {m.s.showTimes ? <span className="text-[10px] font-medium" style={{ color: p.muted }}>{timeText(shift)}</span> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({ m, p, compact }: { m: Model; p: Palette; compact: boolean }) {
  const first = `${m.today.slice(0, 8)}01`;
  const d0 = parse(first);
  const start = mondayOf(first);
  const month = first.slice(0, 7);
  let weeks = 0;
  while (addDays(start, weeks * 7).slice(0, 7) <= month && weeks < 6) weeks++;
  let hours = 0;
  for (const d of m.data.days) if (d.date.slice(0, 7) === month && d.shift) hours += d.shift.hours;
  const right = `${MONTHS[d0.getMonth()]} ${d0.getFullYear()}${!compact && m.s.showHours ? ` · ${hoursText(hours)}` : ""}`;
  return (
    <div className="flex h-full flex-col px-[10px] pt-[14px] pb-[10px]" style={{ background: p.bg }}>
      <Header m={m} p={p} right={right} />
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold" style={{ color: p.muted }}>
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <span key={d}>{compact ? d[0] : d}</span>
        ))}
      </div>
      <div className="mt-[2px] grid flex-1 grid-cols-7 gap-[2px]" style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}>
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const date = addDays(start, i);
          const inMonth = date.slice(0, 7) === month;
          const shift = inMonth ? m.visible(m.day(date).shift) : null;
          const isToday = date === m.today;
          const dayNum = (
            <span className="text-[10px] font-semibold" style={{ color: isToday ? p.accent : compact ? p.muted : p.ink, opacity: inMonth ? 1 : 0.35 }}>
              {parse(date).getDate()}
            </span>
          );
          if (compact) {
            return (
              <div key={date} className="flex flex-col items-center gap-[2px] rounded-[8px] pt-[2px]" style={{ background: isToday ? p.today : undefined }}>
                {dayNum}
                {shift ? <CodePill shift={shift} size={10} /> : null}
              </div>
            );
          }
          return (
            <div
              key={date}
              className="flex items-center justify-between gap-1 rounded-[10px] px-[6px]"
              style={{ background: isToday ? p.today : inMonth ? p.card : p.bg }}
            >
              <div className="flex flex-col">
                {dayNum}
                {shift ? <span className="text-[12px] font-black" style={{ color: p.ink }}>{shift.code}</span> : null}
              </div>
              {shift ? <Avatar shift={shift} size={30} m={m} p={p} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExtraLarge({ m, p }: { m: Model; p: Palette }) {
  if (m.s.extraLarge === "month") return <MonthGrid m={m} p={p} compact={false} />;
  const start = mondayOf(m.today);
  return (
    <div className="flex h-full flex-col p-[14px]" style={{ background: p.bg }}>
      <Header m={m} p={p} right={`KW ${isoWeek(m.today)}${m.s.showHours ? ` · ${hoursText(m.weekHours(start))}` : ""}`} />
      <div className="mt-[10px] grid flex-1 grid-cols-7 gap-2" style={{ gridTemplateRows: "auto 1fr" }}>
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(start, i);
          const d = parse(date);
          const isToday = date === m.today;
          return (
            <span key={`h${date}`} className="truncate text-[11px] font-semibold" style={{ color: isToday ? p.accent : p.muted }}>
              {WD[d.getDay()]} {d.getDate()}.{isToday ? " · Heute" : ""}
            </span>
          );
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(start, i);
          const shift = m.visible(m.day(date).shift);
          const img = shift && m.s.showImages ? shift.image : null;
          const fg = img ? "#fff" : shift ? INK : p.muted;
          return (
            <div
              key={date}
              className="flex flex-col justify-end overflow-hidden rounded-[16px] p-[6px]"
              style={{
                background: img ? `center / cover url(${img})` : shift ? shift.color : p.card,
                boxShadow: date === m.today ? `inset 0 0 0 3px ${p.accent}` : undefined,
              }}
            >
              <div
                className="rounded-[10px] px-[7px] pt-1 pb-[5px]"
                style={{ background: shift ? (img ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)") : undefined, color: fg }}
              >
                <div className="truncate text-[16px] font-black leading-tight">{shift ? shift.code : "frei"}</div>
                {shift && m.s.showTimes ? <div className="truncate text-[10px] font-semibold">{timeText(shift)}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Lock({ family, m }: { family: WidgetFamily; m: Model }) {
  const day = m.nextWork();
  if (family === "accessoryInline") {
    return (
      <span className="text-[13px] font-semibold text-white">
        {day ? `${day.shift.code} ${relLabel(day.date, m.today).toLowerCase()}${day.shift.start ? ` ${day.shift.start}` : ""}` : "Keine Schicht"}
      </span>
    );
  }
  if (family === "accessoryCircular") {
    return (
      <div className="grid size-[72px] place-items-center rounded-full bg-white/20 text-center text-white backdrop-blur">
        <div className="leading-none">
          <div className="text-[9px] font-semibold">
            {day ? (dayDiff(m.today, day.date) === 0 ? "HEUTE" : WD[parse(day.date).getDay()].toUpperCase()) : "FREI"}
          </div>
          <div className="text-[18px] font-black">{day ? day.shift.code : "–"}</div>
          {day?.shift.start ? <div className="text-[9px] font-medium">{day.shift.start}</div> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="w-[170px] leading-tight text-white">
      {day ? (
        <>
          <div className="truncate text-[15px] font-black">{relLabel(day.date, m.today)} · {day.shift.code}</div>
          <div className="truncate text-[12px] font-semibold">{timeText(day.shift)} · {m.countdown(day)}</div>
          <div className="truncate text-[12px] font-medium opacity-70">{day.shift.name}</div>
        </>
      ) : (
        <>
          <div className="text-[14px] font-bold">Keine Schicht</div>
          <div className="text-[12px] opacity-70">in den nächsten Wochen</div>
        </>
      )}
    </div>
  );
}

// ---------- public ----------

function useDark(theme: WidgetSettings["theme"]) {
  const [sys, setSys] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSys(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return theme === "dark" || (theme === "auto" && sys);
}

/** Scales its fixed-size child down to the available width. */
function Fit({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full">
      <div style={{ height: height * scale }} className="flex justify-center">
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top center" }}>{children}</div>
      </div>
    </div>
  );
}

export function WidgetPreview({
  family,
  data,
  settings,
}: {
  family: WidgetFamily;
  data: WidgetPayload;
  settings: WidgetSettings;
}) {
  const dark = useDark(settings.theme);
  const p = dark ? DARK : LIGHT;
  const m = new Model(data, settings, new Date());

  if (family.startsWith("accessory")) {
    return <Lock family={family} m={m} />;
  }
  const key = family as keyof typeof WIDGET_SIZES;
  const [w, h] = WIDGET_SIZES[key];
  const body =
    key === "small" ? <Small m={m} p={p} /> :
    key === "medium" ? <Medium m={m} p={p} /> :
    key === "large" ? <Large m={m} p={p} /> :
    <ExtraLarge m={m} p={p} />;
  return (
    <Fit width={w} height={h}>
      <div
        className="size-full overflow-hidden rounded-[22px] font-sans shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", fontSize: 13 }}
      >
        {body}
      </div>
    </Fit>
  );
}
