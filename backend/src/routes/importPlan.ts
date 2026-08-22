import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser } from "../session.js";
import { extractDienstplan, matchShiftType } from "../lib/dienstplan.js";
import { placeShift } from "../lib/placeShift.js";

const ALL_DAY = new Set(["frei", "ferien", "urlaub", "u"]);

export async function importPlanRoutes(app: FastifyInstance) {
  app.post("/api/import/preview", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parts = req.parts();
    let month = "";
    let person = user.name ?? "";
    let pdf: Buffer | null = null;
    for await (const part of parts) {
      if (part.type === "file") {
        pdf = await part.toBuffer();
      } else if (part.fieldname === "month") {
        month = String(part.value);
      } else if (part.fieldname === "person") {
        person = String(part.value);
      }
    }
    if (!pdf?.length) return reply.code(400).send({ error: "Bitte eine PDF-Datei wählen." });
    if (!/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: "Monat fehlt." });
    try {
      const extracted = await extractDienstplan({ pdf, month, person });
      const types = await prisma.shiftType.findMany({
        where: { userId: user.id },
        orderBy: { sortOrder: "asc" },
      });
      const days = extracted.days.map((d) => {
        const type = matchShiftType(d.code, types);
        return {
          ...d,
          shiftTypeId: type?.id ?? null,
          matched: Boolean(type),
        };
      });
      const missing = [...new Set(days.filter((d) => d.code && !d.matched).map((d) => d.code))] as string[];
      return {
        person: extracted.person,
        monthHint: extracted.monthHint,
        month,
        days,
        missing,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Einlesen fehlgeschlagen";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/api/import/ensure-types", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = z.object({ codes: z.array(z.string().trim().min(1).max(16)).max(30) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Ungültige Codes" });
    const existing = await prisma.shiftType.findMany({ where: { userId: user.id } });
    let order = existing.length;
    const created = [];
    for (const code of parsed.data.codes) {
      const hit = matchShiftType(code, existing);
      if (hit) continue;
      const allDay = ALL_DAY.has(code.toLowerCase());
      const row = await prisma.shiftType.create({
        data: {
          userId: user.id,
          code,
          name: code,
          allDay,
          startTime: allDay ? null : "06:30",
          endTime: allDay ? null : "15:00",
          breakMinutes: allDay ? 0 : 30,
          color: allDay ? "#E8D48A" : "#C5CCD6",
          sortOrder: order,
        },
      });
      existing.push(row);
      created.push(row);
      order += 1;
    }
    return { created, types: await prisma.shiftType.findMany({ where: { userId: user.id }, orderBy: { sortOrder: "asc" } }) };
  });

  app.post("/api/import/commit", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = z
      .object({
        days: z
          .array(
            z.object({
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              shiftTypeId: z.string().min(1),
            }),
          )
          .min(1)
          .max(40),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Keine Tage zum Import." });
    const imported = [];
    for (const day of parsed.data.days) {
      const row = await placeShift(user, day.shiftTypeId, day.date);
      if (row) imported.push({ date: row.date, code: row.shiftType.code });
    }
    return { ok: true, count: imported.length, imported };
  });
}
