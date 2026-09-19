import { randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { thumbPath } from "./thumbs.js";

export const widgetSettingsSchema = z.object({
  title: z.string().trim().max(30).default("Arbeitsplan"),
  small: z.enum(["next", "today", "countdown"]).default("next"),
  medium: z.enum(["twoDays", "week"]).default("twoDays"),
  large: z.enum(["week", "twoWeeks", "month"]).default("week"),
  extraLarge: z.enum(["week", "month"]).default("week"),
  showImages: z.boolean().default(true),
  showTimes: z.boolean().default(true),
  showHours: z.boolean().default(true),
  showFree: z.boolean().default(true),
  theme: z.enum(["auto", "light", "dark"]).default("auto"),
});

export type WidgetSettings = z.infer<typeof widgetSettingsSchema>;

export function readWidgetSettings(user: Pick<User, "widgetSettings">): WidgetSettings {
  let raw: unknown = {};
  try {
    raw = user.widgetSettings ? JSON.parse(user.widgetSettings) : {};
  } catch {
    raw = {};
  }
  const parsed = widgetSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : widgetSettingsSchema.parse({});
}

export async function ensureWidgetToken(user: User) {
  if (user.widgetToken) return user.widgetToken;
  return rotateWidgetToken(user.id);
}

export async function rotateWidgetToken(userId: string) {
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: userId }, data: { widgetToken: token } });
  return token;
}

function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(ymd: string) {
  const dow = (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(ymd, -dow);
}

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function netHours(start: string | null, end: string | null, breakMinutes: number, allDay: boolean) {
  if (allDay || !start || !end) return 0;
  let span = minutes(end) - minutes(start);
  if (span <= 0) span += 24 * 60;
  return Math.max(0, span - breakMinutes) / 60;
}

/**
 * Everything the Scriptable widget needs, from the Monday of the current month's
 * first week through six weeks ahead of today. `base` turns image paths into URLs.
 */
export async function widgetPayload(user: User, base: string) {
  const timeZone = user.timezone || env.TZ;
  const today = todayIn(timeZone);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = mondayOf(monthStart);
  const to = addDays(mondayOf(today), 7 * 6 - 1);

  const shifts = await prisma.shift.findMany({
    where: { userId: user.id, date: { gte: from, lte: to } },
    include: { shiftType: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const abs = (path: string | null) =>
    path ? (/^https?:\/\//i.test(path) ? path : `${base.replace(/\/$/, "")}${path}`) : null;

  const typeCache = new Map<string, Promise<{ image: string | null; thumb: string | null }>>();
  const imagesFor = (id: string, imagePath: string | null) => {
    if (!typeCache.has(id)) {
      typeCache.set(
        id,
        (async () => ({
          image: abs(await thumbPath(imagePath, 512)),
          thumb: abs(await thumbPath(imagePath, 160)),
        }))(),
      );
    }
    return typeCache.get(id)!;
  };

  const byDate = new Map<string, (typeof shifts)[number]>();
  for (const s of shifts) if (!byDate.has(s.date)) byDate.set(s.date, s);

  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = byDate.get(d);
    if (!s) {
      days.push({ date: d, shift: null });
      continue;
    }
    const t = s.shiftType;
    const { image, thumb } = await imagesFor(t.id, t.imagePath);
    days.push({
      date: d,
      shift: {
        code: t.code,
        name: t.name,
        color: t.color,
        allDay: t.allDay,
        start: t.allDay ? null : t.startTime,
        end: t.allDay ? null : t.endTime,
        breakMinutes: t.breakMinutes,
        hours: Math.round(netHours(t.startTime, t.endTime, t.breakMinutes, t.allDay) * 100) / 100,
        image,
        thumb,
      },
    });
  }

  return {
    version: 1,
    settings: readWidgetSettings(user),
    today,
    timeZone,
    openUrl: abs("/app/heute"),
    generatedAt: new Date().toISOString(),
    days,
  };
}

export type WidgetPayload = Awaited<ReturnType<typeof widgetPayload>>;
