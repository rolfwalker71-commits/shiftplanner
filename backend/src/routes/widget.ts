import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireUser } from "../session.js";
import {
  ensureWidgetToken,
  readWidgetSettings,
  rotateWidgetToken,
  widgetPayload,
  widgetSettingsSchema,
} from "../lib/widget.js";
import { buildWidgetScript } from "../lib/widgetScript.js";

/** The origin the phone should call: what the browser used, else APP_URL. */
function baseFrom(requested?: string) {
  if (requested) {
    try {
      const u = new URL(requested);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch {
      /* fall through */
    }
  }
  return env.APP_URL.replace(/\/$/, "");
}

export async function widgetRoutes(app: FastifyInstance) {
  app.get("/api/widget/settings", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    return { settings: readWidgetSettings(user), hasToken: Boolean(user.widgetToken) };
  });

  app.put("/api/widget/settings", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = widgetSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Ungültige Einstellungen" });
    const settings = widgetSettingsSchema.parse({ ...readWidgetSettings(user), ...parsed.data });
    await prisma.user.update({
      where: { id: user.id },
      data: { widgetSettings: JSON.stringify(settings) },
    });
    return { settings };
  });

  app.get("/api/widget/preview", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    return widgetPayload(user, "");
  });

  app.get("/api/widget/script", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const token = await ensureWidgetToken(user);
    const base = baseFrom((req.query as { base?: string }).base);
    reply.header("Content-Type", "text/javascript; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    return buildWidgetScript(base, token);
  });

  app.post("/api/widget/token", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    await rotateWidgetToken(user.id);
    return { ok: true };
  });

  // Called by the Scriptable widget; the token replaces the session cookie.
  app.get("/api/widget/data", async (req, reply) => {
    const token = (req.query as { token?: string }).token;
    if (!token || token.length < 20) return reply.code(401).send({ error: "Token fehlt" });
    const user = await prisma.user.findFirst({ where: { widgetToken: token } });
    if (!user) return reply.code(401).send({ error: "Link ungültig – Skript in der App neu kopieren" });
    reply.header("Cache-Control", "no-store");
    // Paths stay relative; the script prefixes the address it was configured with.
    return widgetPayload(user, "");
  });
}
