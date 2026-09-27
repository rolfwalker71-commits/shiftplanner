import type { FastifyInstance } from "fastify";
import type { User } from "@prisma/client";
import { z } from "zod";
import { allowedEmails, caldavLoginConfigured, env, googleConfigured, isEmailAllowed } from "../env.js";
import { prisma } from "../db.js";
import { setSession, clearSession, requireUser, getUser } from "../session.js";
import { authUrl, oauthClient, saveGoogleTokens } from "../lib/google.js";
import {
  encryptSecret,
  fetchCaldavCalendars,
  normalizeServerUrl,
  type CaldavCalendar,
} from "../lib/caldav.js";
import {
  activeProvider,
  listProviderCalendars,
  resyncShifts,
  selectedCalendar,
} from "../lib/calendarSync.js";

const caldavSchema = z.object({
  serverUrl: z.string().trim().min(1).optional(),
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function tryCaldav(serverUrl: string, username: string, password: string) {
  try {
    return await fetchCaldavCalendars({ serverUrl, username, password });
  } catch {
    return null;
  }
}

function caldavData(serverUrl: string, username: string, password: string, calendars: CaldavCalendar[], user?: User) {
  const keep = user?.caldavCalendarUrl && calendars.some((c) => c.id === user.caldavCalendarUrl);
  return {
    calendarProvider: "caldav",
    caldavServerUrl: serverUrl,
    caldavUsername: username,
    caldavPassword: encryptSecret(password),
    caldavCalendarUrl: keep
      ? user!.caldavCalendarUrl
      : calendars.length === 1
        ? calendars[0].id
        : null,
  };
}

const caldavFailed =
  "Anmeldung am CalDAV-Server fehlgeschlagen. Server-Adresse, Benutzername und App-Passwort prüfen.";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/status", async (req) => {
    const user = await getUser(req);
    return {
      demoMode: env.DEMO_MODE,
      googleConfigured,
      caldavLoginConfigured,
      caldavServerUrl: env.CALDAV_SERVER_URL || null,
      openaiConfigured: Boolean(env.OPENAI_API_KEY),
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            selectedCalendarId: selectedCalendar(user),
            calendarProvider: activeProvider(user),
            timezone: user.timezone,
            googleConnected: Boolean(user.googleRefreshToken),
            caldavConnected: Boolean(user.caldavPassword),
            caldavUsername: user.caldavUsername,
            caldavServerUrl: user.caldavServerUrl,
          }
        : null,
    };
  });

  app.post("/api/auth/demo", async (req, reply) => {
    if (!env.DEMO_MODE) {
      return reply.code(403).send({ error: "Demo-Modus ist deaktiviert" });
    }
    const user = await prisma.user.upsert({
      where: { email: "demo@local" },
      update: {},
      create: { email: "demo@local", name: "Lokal" },
    });
    setSession(reply, user.id);
    return { ok: true };
  });

  app.get("/api/auth/google", async (_req, reply) => {
    if (!googleConfigured) {
      return reply.code(400).send({ error: "Google OAuth ist nicht konfiguriert" });
    }
    const hint = allowedEmails.length === 1 ? allowedEmails[0] : undefined;
    return reply.redirect(authUrl(hint));
  });

  app.get("/api/auth/google/callback", async (req, reply) => {
    const code = (req.query as { code?: string }).code;
    if (!code) return reply.redirect(`${env.APP_URL}/?error=oauth`);
    try {
      const client = oauthClient();
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        return reply.redirect(`${env.APP_URL}/?error=oauth`);
      }
      if (!isEmailAllowed(payload.email)) {
        return reply.redirect(`${env.APP_URL}/?error=forbidden`);
      }
      const user = await saveGoogleTokens({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        refreshToken: tokens.refresh_token,
      });
      setSession(reply, user.id);
      return reply.redirect(`${env.APP_URL}/app`);
    } catch {
      return reply.redirect(`${env.APP_URL}/?error=oauth`);
    }
  });

  app.post("/api/auth/caldav", async (req, reply) => {
    if (!caldavLoginConfigured) {
      return reply.code(400).send({ error: "CalDAV-Anmeldung ist nicht konfiguriert" });
    }
    const parsed = caldavSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Benutzername und Passwort angeben" });
    const username = parsed.data.username;
    if (!isEmailAllowed(username)) {
      return reply.code(403).send({ error: "Dieses Konto ist nicht freigegeben." });
    }
    const serverUrl = normalizeServerUrl(env.CALDAV_SERVER_URL);
    const calendars = await tryCaldav(serverUrl, username, parsed.data.password);
    if (!calendars) return reply.code(401).send({ error: caldavFailed });

    const email = username.includes("@") ? username.toLowerCase() : `${username.toLowerCase()}@caldav.local`;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ caldavUsername: username }, { email }] },
    });
    const data = caldavData(serverUrl, username, parsed.data.password, calendars, existing ?? undefined);
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data: { email, ...data } });
    setSession(reply, user.id);
    return { ok: true };
  });

  app.post("/api/caldav/connect", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = caldavSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Server, Benutzername und Passwort angeben" });
    const raw = parsed.data.serverUrl || env.CALDAV_SERVER_URL;
    if (!raw) return reply.code(400).send({ error: "Server-Adresse fehlt" });
    let serverUrl: string;
    try {
      serverUrl = normalizeServerUrl(raw);
    } catch {
      return reply.code(400).send({ error: "Server-Adresse ist ungültig" });
    }
    const calendars = await tryCaldav(serverUrl, parsed.data.username, parsed.data.password);
    if (!calendars) return reply.code(401).send({ error: caldavFailed });
    await prisma.user.update({
      where: { id: user.id },
      data: caldavData(serverUrl, parsed.data.username, parsed.data.password, calendars, user),
    });
    return { ok: true, calendars: calendars.length };
  });

  app.delete("/api/caldav", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        caldavPassword: null,
        caldavCalendarUrl: null,
        calendarProvider: user.googleRefreshToken ? "google" : null,
      },
    });
    return { ok: true };
  });

  app.post("/api/calendar/resync", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (!activeProvider(user) || !selectedCalendar(user)) {
      return reply.code(400).send({ error: "Zuerst einen Zielkalender wählen" });
    }
    return resyncShifts(user, todayIn(user.timezone));
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  app.get("/api/calendars", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const items = await listProviderCalendars(user);
    return { items, selectedCalendarId: selectedCalendar(user), provider: activeProvider(user) };
  });

  app.put("/api/settings", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const body = req.body as {
      selectedCalendarId?: string | null;
      calendarProvider?: "google" | "caldav";
      timezone?: string;
    };
    let current = user;
    if (body.calendarProvider === "google" && user.googleRefreshToken) {
      current = await prisma.user.update({ where: { id: user.id }, data: { calendarProvider: "google" } });
    } else if (body.calendarProvider === "caldav" && user.caldavPassword) {
      current = await prisma.user.update({ where: { id: user.id }, data: { calendarProvider: "caldav" } });
    }
    const provider = activeProvider(current);
    const calendarField = provider === "caldav" ? "caldavCalendarUrl" : "selectedCalendarId";
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.selectedCalendarId !== undefined && provider
          ? { [calendarField]: body.selectedCalendarId || null }
          : {}),
        timezone: body.timezone ?? user.timezone,
      },
    });
    return {
      selectedCalendarId: selectedCalendar(updated),
      calendarProvider: activeProvider(updated),
      timezone: updated.timezone,
    };
  });
}
