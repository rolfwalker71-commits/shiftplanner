import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";
import { env, googleConfigured } from "../env.js";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { uploadsDir } from "./images.js";

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
  "https://www.googleapis.com/auth/drive.file",
];

export function authUrl(loginHint?: string) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
}

function userAuth(user: User) {
  if (!googleConfigured || !user.googleRefreshToken) return null;
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: user.googleRefreshToken });
  return auth;
}

async function calendarClient(user: User) {
  const auth = userAuth(user);
  if (!auth) return null;
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

function localIllustration(imagePath?: string | null) {
  if (!imagePath) return null;
  const name = imagePath.split("/").pop();
  if (!name) return null;
  const file = resolve(uploadsDir, name);
  return existsSync(file) ? file : null;
}

async function ensureDriveIllustration(opts: {
  user: User;
  code: string;
  imagePath?: string | null;
  existingId?: string | null;
}) {
  const auth = userAuth(opts.user);
  const file = localIllustration(opts.imagePath);
  if (!auth || !file) return opts.existingId ?? null;
  const drive = google.drive({ version: "v3", auth });
  if (opts.existingId) {
    try {
      await drive.files.get({ fileId: opts.existingId, fields: "id" });
      return opts.existingId;
    } catch {
      /* upload again */
    }
  }
  try {
    const created = await drive.files.create({
      requestBody: {
        name: `Schichtklar-${opts.code}.png`,
        mimeType: "image/png",
      },
      media: {
        mimeType: "image/png",
        body: createReadStream(file),
      },
      fields: "id",
    });
    return created.data.id ?? null;
  } catch {
    return null;
  }
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
  imagePath?: string | null;
  googleDriveFileId?: string | null;
}) {
  const cal = await calendarClient(opts.user);
  const calendarId = opts.user.selectedCalendarId;
  if (!cal || !calendarId) return { eventId: null as string | null, driveFileId: opts.googleDriveFileId ?? null };

  const driveFileId = await ensureDriveIllustration({
    user: opts.user,
    code: opts.code,
    imagePath: opts.imagePath,
    existingId: opts.googleDriveFileId,
  });

  const timeLabel = opts.allDay || !opts.startTime
    ? "ganztags"
    : `${opts.startTime}–${opts.endTime}`;
  const body = {
    summary: `${opts.code} · ${opts.name}`,
    description: [
      `${opts.code} · ${opts.name}`,
      timeLabel,
      opts.description?.trim() || "",
      driveFileId ? "Schichtbild: siehe Anhang." : "",
      "Geplant mit Schichtklar",
    ]
      .filter(Boolean)
      .join("\n"),
    ...eventTimes(
      opts.date,
      opts.startTime,
      opts.endTime,
      opts.allDay,
      opts.user.timezone,
    ),
    ...(driveFileId
      ? {
          attachments: [
            {
              fileId: driveFileId,
              mimeType: "image/png",
              title: `${opts.code}.png`,
            },
          ],
        }
      : {}),
  };

  const params = { calendarId, supportsAttachments: Boolean(driveFileId) };
  if (opts.eventId) {
    const res = await cal.events.patch({
      ...params,
      eventId: opts.eventId,
      requestBody: body,
    });
    return { eventId: res.data.id ?? opts.eventId, driveFileId };
  }
  const res = await cal.events.insert({ ...params, requestBody: body });
  return { eventId: res.data.id ?? null, driveFileId };
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
