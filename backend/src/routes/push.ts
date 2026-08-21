import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser } from "../session.js";
import { getVapidKeys } from "../lib/vapid.js";
import { notifyShiftIfDue, reminderPayload } from "../lib/reminders.js";

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function pushRoutes(app: FastifyInstance) {
  app.get("/api/push/vapid-public-key", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { publicKey } = await getVapidKeys();
    return { publicKey };
  });

  app.post("/api/push/subscribe", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = subSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Ungültiges Abonnement" });
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      update: {
        userId: user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
      create: {
        userId: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });
    return { ok: true };
  });

  app.delete("/api/push/subscribe", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const endpoint = (req.query as { endpoint?: string }).endpoint;
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id, endpoint },
      });
    } else {
      await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
    }
    return { ok: true };
  });

  app.get("/api/push/status", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const count = await prisma.pushSubscription.count({ where: { userId: user.id } });
    return { subscribed: count > 0, devices: count };
  });

  app.post("/api/push/test", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const count = await prisma.pushSubscription.count({ where: { userId: user.id } });
    if (!count) {
      return reply.code(400).send({ error: "Keine Geräte angemeldet. Bitte zuerst Benachrichtigungen aktivieren." });
    }
    const tomorrowShift = await prisma.shift.findFirst({
      where: { userId: user.id },
      include: { shiftType: true },
      orderBy: { date: "asc" },
    });
    if (tomorrowShift) {
      await notifyShiftIfDue(tomorrowShift.id, { force: true });
      return { ok: true, preview: reminderPayload(tomorrowShift) };
    }
    return reply.code(400).send({ error: "Lege zuerst eine Schicht, dann kannst du eine Probe schicken." });
  });
}
