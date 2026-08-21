import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser } from "../session.js";
import {
  deleteCalendarEvent,
  upsertCalendarEvent,
} from "../lib/google.js";
import { notifyShiftIfDue } from "../lib/reminders.js";

const createSchema = z.object({
  shiftTypeId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function shiftRoutes(app: FastifyInstance) {
  app.get("/api/shifts", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const q = req.query as { from?: string; to?: string };
    return prisma.shift.findMany({
      where: {
        userId: user.id,
        date: {
          gte: q.from,
          lte: q.to,
        },
      },
      include: { shiftType: true },
      orderBy: { date: "asc" },
    });
  });

  app.post("/api/shifts", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const type = await prisma.shiftType.findFirst({
      where: { id: parsed.data.shiftTypeId, userId: user.id },
    });
    if (!type) return reply.code(404).send({ error: "Schichtart unbekannt" });

    const { eventId, driveFileId } = await upsertCalendarEvent({
      user,
      date: parsed.data.date,
      code: type.code,
      name: type.name,
      startTime: type.startTime,
      endTime: type.endTime,
      allDay: type.allDay,
      description: type.description,
      imagePath: type.imagePath,
      googleDriveFileId: type.googleDriveFileId,
    });
    if (driveFileId && driveFileId !== type.googleDriveFileId) {
      await prisma.shiftType.update({
        where: { id: type.id },
        data: { googleDriveFileId: driveFileId },
      });
    }

    const created = await prisma.shift.create({
      data: {
        userId: user.id,
        shiftTypeId: type.id,
        date: parsed.data.date,
        googleEventId: eventId,
      },
      include: { shiftType: true },
    });
    notifyShiftIfDue(created.id).catch(() => undefined);
    return created;
  });

  app.patch("/api/shifts/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const parsed = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const shift = await prisma.shift.findFirst({
      where: { id, userId: user.id },
      include: { shiftType: true },
    });
    if (!shift) return reply.code(404).send({ error: "Nicht gefunden" });

    const { eventId, driveFileId } = await upsertCalendarEvent({
      user,
      eventId: shift.googleEventId,
      date: parsed.data.date,
      code: shift.shiftType.code,
      name: shift.shiftType.name,
      startTime: shift.shiftType.startTime,
      endTime: shift.shiftType.endTime,
      allDay: shift.shiftType.allDay,
      description: shift.shiftType.description,
      imagePath: shift.shiftType.imagePath,
      googleDriveFileId: shift.shiftType.googleDriveFileId,
    });
    if (driveFileId && driveFileId !== shift.shiftType.googleDriveFileId) {
      await prisma.shiftType.update({
        where: { id: shift.shiftTypeId },
        data: { googleDriveFileId: driveFileId },
      });
    }

    await prisma.shiftReminder.deleteMany({ where: { shiftId: id } });
    const updated = await prisma.shift.update({
      where: { id },
      data: { date: parsed.data.date, googleEventId: eventId ?? shift.googleEventId },
      include: { shiftType: true },
    });
    notifyShiftIfDue(updated.id).catch(() => undefined);
    return updated;
  });

  app.delete("/api/shifts/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const shift = await prisma.shift.findFirst({ where: { id, userId: user.id } });
    if (!shift) return reply.code(404).send({ error: "Nicht gefunden" });
    await deleteCalendarEvent(user, shift.googleEventId);
    await prisma.shift.delete({ where: { id } });
    return { ok: true };
  });
}
