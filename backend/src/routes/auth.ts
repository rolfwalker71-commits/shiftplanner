import type { FastifyInstance } from "fastify";
import { allowedEmails, env, googleConfigured, isEmailAllowed } from "../env.js";
import { prisma } from "../db.js";
import { setSession, clearSession, requireUser, getUser } from "../session.js";
import { authUrl, oauthClient, listCalendars, saveGoogleTokens } from "../lib/google.js";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/status", async (req) => {
    const user = await getUser(req);
    return {
      demoMode: env.DEMO_MODE,
      googleConfigured,
      openaiConfigured: Boolean(env.OPENAI_API_KEY),
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            selectedCalendarId: user.selectedCalendarId,
            timezone: user.timezone,
            googleConnected: Boolean(user.googleRefreshToken),
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

  app.post("/api/auth/logout", async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  app.get("/api/calendars", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const items = await listCalendars(user);
    return { items, selectedCalendarId: user.selectedCalendarId };
  });

  app.put("/api/settings", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const body = req.body as {
      selectedCalendarId?: string | null;
      timezone?: string;
    };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        selectedCalendarId: body.selectedCalendarId ?? user.selectedCalendarId,
        timezone: body.timezone ?? user.timezone,
      },
    });
    return {
      selectedCalendarId: updated.selectedCalendarId,
      timezone: updated.timezone,
    };
  });
}
