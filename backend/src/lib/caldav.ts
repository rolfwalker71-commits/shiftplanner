import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { createDAVClient } from "tsdav";
import type { User } from "@prisma/client";
import { env } from "../env.js";

export type CaldavCredentials = {
  serverUrl: string;
  username: string;
  password: string;
};

export type CaldavCalendar = {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
};

// App passwords are stored encrypted with a key derived from SESSION_SECRET.
// Changing SESSION_SECRET means reconnecting the CalDAV account.
const secretKey = createHash("sha256").update(`caldav:${env.SESSION_SECRET}`).digest();

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string) {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function normalizeServerUrl(url: string) {
  const trimmed = url.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  return parsed.toString();
}

export function caldavCredentials(user: User): CaldavCredentials | null {
  if (!user.caldavServerUrl || !user.caldavUsername || !user.caldavPassword) return null;
  const password = decryptSecret(user.caldavPassword);
  if (!password) return null;
  return { serverUrl: user.caldavServerUrl, username: user.caldavUsername, password };
}

function displayName(name: unknown, fallbackUrl: string) {
  if (typeof name === "string" && name.trim()) return name.trim();
  const tail = fallbackUrl.replace(/\/$/, "").split("/").pop();
  return tail ? decodeURIComponent(tail) : fallbackUrl;
}

/** Discovers the account and lists calendars that accept events. Throws when the login fails. */
export async function fetchCaldavCalendars(creds: CaldavCredentials): Promise<CaldavCalendar[]> {
  const client = await createDAVClient({
    serverUrl: creds.serverUrl,
    credentials: { username: creds.username, password: creds.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  const calendars = await client.fetchCalendars();
  return calendars
    .filter((c) => !c.components?.length || c.components.includes("VEVENT"))
    .map((c, i) => ({
      id: c.url,
      summary: displayName(c.displayName, c.url),
      primary: i === 0,
      backgroundColor: c.calendarColor?.slice(0, 7),
    }));
}

export async function listCaldavCalendars(user: User) {
  const creds = caldavCredentials(user);
  if (!creds) return [];
  try {
    return await fetchCaldavCalendars(creds);
  } catch {
    return [];
  }
}

function authHeader(creds: CaldavCredentials) {
  return `Basic ${Buffer.from(`${creds.username}:${creds.password}`, "utf8").toString("base64")}`;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function zoneOffsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - at.getTime();
}

/** Local wall-clock time in `timeZone` → UTC, so the event needs no VTIMEZONE block. */
function zonedToUtc(date: string, time: string, timeZone: string) {
  const guess = Date.parse(`${date}T${time}:00Z`);
  const first = zoneOffsetMs(new Date(guess), timeZone);
  const second = zoneOffsetMs(new Date(guess - first), timeZone);
  return new Date(guess - second);
}

function icsUtc(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsDate(iso: string) {
  return iso.replace(/-/g, "");
}

function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding at 75 octets without splitting UTF-8 characters. */
function fold(line: string) {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

function publicAsset(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${env.APP_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export type ShiftEventInput = {
  date: string;
  code: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  description?: string;
  imagePath?: string | null;
};

export function buildShiftIcs(uid: string, input: ShiftEventInput, timeZone: string) {
  const timed = !input.allDay && input.startTime && input.endTime;
  const timeLabel = timed ? `${input.startTime}–${input.endTime}` : "ganztags";
  const image = publicAsset(input.imagePath);
  const description = [
    `${input.code} · ${input.name}`,
    timeLabel,
    input.description?.trim() || "",
    image ? `Schichtbild: ${image}` : "",
    "Geplant mit Schichtklar",
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schichtklar//Schichtplanung//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(new Date())}`,
  ];
  if (timed) {
    const endDate = input.endTime! <= input.startTime! ? addDays(input.date, 1) : input.date;
    lines.push(`DTSTART:${icsUtc(zonedToUtc(input.date, input.startTime!, timeZone))}`);
    lines.push(`DTEND:${icsUtc(zonedToUtc(endDate, input.endTime!, timeZone))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(input.date)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDays(input.date, 1))}`);
    lines.push("TRANSP:TRANSPARENT");
  }
  lines.push(`SUMMARY:${icsText(`${input.code} · ${input.name}`)}`);
  lines.push(`DESCRIPTION:${icsText(description)}`);
  if (image) {
    lines.push(`URL:${image}`);
    lines.push(`ATTACH;FMTTYPE=image/png:${image}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

function collectionUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

async function putEvent(creds: CaldavCredentials, url: string, ics: string, create: boolean) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "text/calendar; charset=utf-8",
      ...(create ? { "If-None-Match": "*" } : {}),
    },
    body: ics,
  });
  if (!res.ok) throw new Error(`CalDAV PUT ${res.status}`);
}

export async function deleteCaldavEvent(user: User, eventUrl: string | null) {
  if (!eventUrl) return;
  const creds = caldavCredentials(user);
  if (!creds) return;
  try {
    await fetch(eventUrl, { method: "DELETE", headers: { Authorization: authHeader(creds) } });
  } catch {
    /* already gone or server unreachable */
  }
}

/** Creates or moves the shift event in the selected CalDAV calendar and returns its resource URL. */
export async function upsertCaldavEvent(opts: {
  user: User;
  eventUrl?: string | null;
  input: ShiftEventInput;
}): Promise<string | null> {
  const creds = caldavCredentials(opts.user);
  const calendarUrl = opts.user.caldavCalendarUrl;
  if (!creds || !calendarUrl) return null;
  const base = collectionUrl(calendarUrl);

  // Keep the resource (and its UID) when the event already lives in the selected calendar.
  if (opts.eventUrl && opts.eventUrl.startsWith(base)) {
    const uid = decodeURIComponent(opts.eventUrl.slice(base.length).replace(/\.ics$/i, ""));
    try {
      await putEvent(creds, opts.eventUrl, buildShiftIcs(uid, opts.input, opts.user.timezone), false);
      return opts.eventUrl;
    } catch {
      /* fall through and create a fresh event */
    }
  }
  if (opts.eventUrl) await deleteCaldavEvent(opts.user, opts.eventUrl);

  const uid = `schichtklar-${randomUUID()}`;
  const url = new URL(`${uid}.ics`, base).toString();
  try {
    await putEvent(creds, url, buildShiftIcs(uid, opts.input, opts.user.timezone), true);
    return url;
  } catch {
    return null;
  }
}
