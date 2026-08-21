import { google } from "googleapis";
import { env, googleConfigured } from "../env.js";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";

export function oauthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
];

export function authUrl() {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });
}

async function calendarClient(user: User) {
  if (!googleConfigured || !user.googleRefreshToken) return null;
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: user.googleRefreshToken });
  return google.calendar({ version: "v3", auth });
}

export async function listCalendars(user: User) {
  const cal = await calendarClient(user);
  if (!cal) return [];
  const res = await cal.calendarList.list();
  return (res.data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: Boolean(c.primary),
    backgroundColor: c.backgroundColor,
  }));
}

function eventTimes(
  date: string,
  startTime: string | null,
  endTime: string | null,
  allDay: boolean,
  timeZone: string,
) {
  if (allDay || !startTime || !endTime) {
    const next = addDays(date, 1);
    return { start: { date }, end: { date: next } };
  }
  let endDate = date;
  if (endTime <= startTime) endDate = addDays(date, 1);
  return {
    start: { dateTime: `${date}T${startTime}:00`, timeZone },
    end: { dateTime: `${endDate}T${endTime}:00`, timeZone },
  };
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function upsertCalendarEvent(opts: {
  user: User;
  eventId?: string | null;
  date: string;
  code: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  description?: string;
}) {
  const cal = await calendarClient(opts.user);
  const calendarId = opts.user.selectedCalendarId;
  if (!cal || !calendarId) return null;

  const body = {
    summary: `${opts.code} · ${opts.name}`,
    description: opts.description || "Geplant mit Schichtklar",
    ...eventTimes(
      opts.date,
      opts.startTime,
      opts.endTime,
      opts.allDay,
      opts.user.timezone,
    ),
  };

  if (opts.eventId) {
    const res = await cal.events.patch({
      calendarId,
      eventId: opts.eventId,
      requestBody: body,
    });
    return res.data.id ?? opts.eventId;
  }
  const res = await cal.events.insert({ calendarId, requestBody: body });
  return res.data.id ?? null;
}

export async function deleteCalendarEvent(user: User, eventId: string | null) {
  if (!eventId) return;
  const cal = await calendarClient(user);
  const calendarId = user.selectedCalendarId;
  if (!cal || !calendarId) return;
  try {
    await cal.events.delete({ calendarId, eventId });
  } catch {
    /* already gone */
  }
}

export async function saveGoogleTokens(opts: {
  googleId: string;
  email: string;
  name?: string | null;
  refreshToken?: string | null;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: opts.googleId }, { email: opts.email }] },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId: opts.googleId,
        email: opts.email,
        name: opts.name ?? existing.name,
        googleRefreshToken: opts.refreshToken ?? existing.googleRefreshToken,
      },
    });
  }
  return prisma.user.create({
    data: {
      googleId: opts.googleId,
      email: opts.email,
      name: opts.name ?? undefined,
      googleRefreshToken: opts.refreshToken ?? undefined,
    },
  });
}
