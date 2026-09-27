import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { removeShiftEvent, syncShiftEvent } from "./calendarSync.js";
import { notifyShiftIfDue } from "./reminders.js";

export async function clearShiftsInRange(user: User, from: string, to: string) {
  const existing = await prisma.shift.findMany({
    where: { userId: user.id, date: { gte: from, lte: to } },
  });
  for (const shift of existing) {
    await removeShiftEvent(user, shift);
    await prisma.shiftReminder.deleteMany({ where: { shiftId: shift.id } });
    await prisma.shift.delete({ where: { id: shift.id } });
  }
  return existing.length;
}

export async function placeShift(user: User, shiftTypeId: string, date: string) {
  const type = await prisma.shiftType.findFirst({
    where: { id: shiftTypeId, userId: user.id },
  });
  if (!type) return null;

  await clearShiftsInRange(user, date, date);

  const refs = await syncShiftEvent(user, type, date);

  const created = await prisma.shift.create({
    data: {
      userId: user.id,
      shiftTypeId: type.id,
      date,
      ...refs,
    },
    include: { shiftType: true },
  });
  notifyShiftIfDue(created.id).catch(() => undefined);
  return created;
}
