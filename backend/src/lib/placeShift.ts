import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { deleteCalendarEvent, upsertCalendarEvent } from "./google.js";
import { notifyShiftIfDue } from "./reminders.js";

export async function placeShift(user: User, shiftTypeId: string, date: string) {
  const type = await prisma.shiftType.findFirst({
    where: { id: shiftTypeId, userId: user.id },
  });
  if (!type) return null;

  const existing = await prisma.shift.findMany({
    where: { userId: user.id, date },
  });
  for (const shift of existing) {
    await deleteCalendarEvent(user, shift.googleEventId);
    await prisma.shiftReminder.deleteMany({ where: { shiftId: shift.id } });
    await prisma.shift.delete({ where: { id: shift.id } });
  }

  const { eventId, driveFileId } = await upsertCalendarEvent({
    user,
    date,
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
      date,
      googleEventId: eventId,
    },
    include: { shiftType: true },
  });
  notifyShiftIfDue(created.id).catch(() => undefined);
  return created;
}
