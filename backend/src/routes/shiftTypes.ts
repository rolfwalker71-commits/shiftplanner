import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser } from "../session.js";
import { generateShiftIllustration } from "../lib/images.js";
import { buildIllustrationPrompt } from "../lib/imagePrompt.js";

const typeSchema = z.object({
  code: z.string().trim().min(1).max(16),
  name: z.string().trim().min(1).max(80),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  breakMinutes: z.number().int().min(0).max(240).optional(),
  allDay: z.boolean().optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  description: z.string().max(500).optional(),
  showCodeInImage: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function shiftTypeRoutes(app: FastifyInstance) {
  app.get("/api/shift-types", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    return prisma.shiftType.findMany({
      where: { userId: user.id },
      orderBy: { sortOrder: "asc" },
    });
  });

  app.post("/api/shift-types", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = typeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const count = await prisma.shiftType.count({ where: { userId: user.id } });
    try {
      const created = await prisma.shiftType.create({
        data: {
          userId: user.id,
          sortOrder: count,
          startTime: parsed.data.allDay ? null : parsed.data.startTime ?? "06:30",
          endTime: parsed.data.allDay ? null : parsed.data.endTime ?? "15:00",
          breakMinutes: parsed.data.breakMinutes ?? 30,
          allDay: parsed.data.allDay ?? false,
          color: parsed.data.color ?? "#E8A87C",
          description: parsed.data.description ?? "",
          showCodeInImage: parsed.data.showCodeInImage ?? false,
          code: parsed.data.code,
          name: parsed.data.name,
        },
      });
      return created;
    } catch {
      return reply.code(409).send({ error: "Dieser Code existiert bereits" });
    }
  });

  app.patch("/api/shift-types/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const parsed = typeSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const existing = await prisma.shiftType.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return reply.code(404).send({ error: "Nicht gefunden" });
    return prisma.shiftType.update({ where: { id }, data: parsed.data });
  });

  app.delete("/api/shift-types/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    await prisma.shift.deleteMany({ where: { shiftTypeId: id, userId: user.id } });
    await prisma.shiftType.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });

  app.post("/api/shift-types/:id/preview-prompt", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const t = await prisma.shiftType.findFirst({ where: { id, userId: user.id } });
    if (!t) return reply.code(404).send({ error: "Nicht gefunden" });
    return { prompt: buildIllustrationPrompt(t) };
  });

  app.post("/api/shift-types/preview-prompt", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = typeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { prompt: buildIllustrationPrompt(parsed.data) };
  });

  app.post("/api/shift-types/:id/generate-image", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const t = await prisma.shiftType.findFirst({ where: { id, userId: user.id } });
    if (!t) return reply.code(404).send({ error: "Nicht gefunden" });
    try {
      const { path, prompt } = await generateShiftIllustration(id, t);
      const updated = await prisma.shiftType.update({
        where: { id },
        data: { imagePath: path },
      });
      return { ...updated, prompt };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bildgenerierung fehlgeschlagen";
      return reply.code(500).send({ error: message });
    }
  });
}
