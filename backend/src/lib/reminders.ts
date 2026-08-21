import webpush from "web-push";
import type { PushSubscription as PrismaSub, Shift, ShiftType, User } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { configureWebPush } from "./vapid.js";

type ShiftWithType = Shift & { shiftType: ShiftType; user?: User };

function ymdInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hourInZone(date: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

function addDaysYmd(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function publicAsset(path?: string | null) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${env.APP_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function timeRange(type: ShiftType) {
  if (type.allDay || !type.startTime || !type.endTime) return "ganztags";
  return `${type.startTime}–${type.endTime} Uhr`;
}

function shiftBody(type: ShiftType, date: string) {
  const when = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  const parts = [type.name, timeRange(type)];
  if (!type.allDay && type.breakMinutes > 0) {
    parts.push(`Pause ${type.breakMinutes} Min`);
  }
  return `${when} · ${parts.join(" · ")}`;
}

export function reminderPayload(shift: ShiftWithType, opts?: { force?: boolean }) {
  const image = publicAsset(shift.shiftType.imagePath);
  const icon = image ?? publicAsset("/logo.svg");
  const prefix = opts?.force ? "Probe" : "Morgen";
  return {
    title: `${prefix}: ${shift.shiftType.code}`,
    body: shiftBody(shift.shiftType, shift.date),
    icon,
    image,
    badge: publicAsset("/logo.svg"),
    tag: `shift-${shift.id}`,
    data: { url: "/app" },
  };
}

async function sendToUser(userId: string, payload: ReturnType<typeof reminderPayload>) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return 0;
  await configureWebPush();
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (sub: PrismaSub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 16, urgency: "normal" },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
  return sent;
}

export async function notifyShiftIfDue(shiftId: string, opts?: { force?: boolean }) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { shiftType: true, user: true },
  });
  if (!shift) return false;
  const tz = shift.user.timezone || env.TZ;
  const now = new Date();
  const today = ymdInZone(now, tz);
  const tomorrow = addDaysYmd(today, 1);
  if (!opts?.force) {
    if (shift.date !== tomorrow) return false;
    if (hourInZone(now, tz) < env.NOTIFY_HOUR) return false;
    const already = await prisma.shiftReminder.findUnique({
      where: { shiftId_kind: { shiftId: shift.id, kind: "day_before" } },
    });
    if (already) return false;
  }
  const sent = await sendToUser(shift.userId, reminderPayload(shift, { force: opts?.force }));
  if (sent > 0 && !opts?.force) {
    await prisma.shiftReminder.upsert({
      where: { shiftId_kind: { shiftId: shift.id, kind: "day_before" } },
      update: { sentAt: now },
      create: { shiftId: shift.id, kind: "day_before" },
    });
  }
  return sent > 0;
}

export async function sendDueReminders() {
  const users = await prisma.user.findMany({
    where: { pushSubscriptions: { some: {} } },
    select: { id: true, timezone: true },
  });
  const now = new Date();
  for (const user of users) {
    const tz = user.timezone || env.TZ;
    if (hourInZone(now, tz) < env.NOTIFY_HOUR) continue;
    const tomorrow = addDaysYmd(ymdInZone(now, tz), 1);
    const shifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        date: tomorrow,
        reminders: { none: { kind: "day_before" } },
      },
      select: { id: true },
    });
    for (const s of shifts) {
      await notifyShiftIfDue(s.id);
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (timer) return;
  const tick = () => {
    sendDueReminders().catch((err) => {
      console.error("Schicht-Erinnerung fehlgeschlagen", err);
    });
  };
  tick();
  timer = setInterval(tick, 60 * 1000);
}
