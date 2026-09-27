import type { Shift, ShiftType, User } from "@prisma/client";
import { prisma } from "../db.js";
import { deleteCalendarEvent, listCalendars, upsertCalendarEvent } from "./google.js";
import { deleteCaldavEvent, listCaldavCalendars, upsertCaldavEvent } from "./caldav.js";

export type CalendarProvider = "google" | "caldav";

export function activeProvider(user: User): CalendarProvider | null {
  if (user.calendarProvider === "caldav" && user.caldavPassword) return "caldav";
  if (user.calendarProvider === "google" && user.googleRefreshToken) return "google";
  if (!user.calendarProvider && user.googleRefreshToken) return "google";
  if (!user.calendarProvider && user.caldavPassword) return "caldav";
  return null;
}

export function selectedCalendar(user: User) {
  const provider = activeProvider(user);
  if (provider === "caldav") return user.caldavCalendarUrl;
  if (provider === "google") return user.selectedCalendarId;
  return null;
}

export async function listProviderCalendars(user: User) {
  const provider = activeProvider(user);
  if (provider === "caldav") return listCaldavCalendars(user);
  if (provider === "google") return listCalendars(user);
  return [];
}

type EventRefs = Pick<Shift, "googleEventId" | "caldavEventUrl">;

/**
 * Writes the shift to the active calendar provider. An event left behind in the
 * other provider (e.g. after moving from Google to CalDAV) is removed on the way.
 */
export async function syncShiftEvent(
  user: User,
  type: ShiftType,
  date: string,
  existing?: EventRefs | null,
): Promise<EventRefs> {
  const provider = activeProvider(user);
  let googleEventId = existing?.googleEventId ?? null;
  let caldavEventUrl = existing?.caldavEventUrl ?? null;

  if (provider === "caldav") {
    if (googleEventId) {
      await deleteCalendarEvent(user, googleEventId);
      googleEventId = null;
    }
    caldavEventUrl = await upsertCaldavEvent({
      user,
      eventUrl: caldavEventUrl,
      input: {
        date,
        code: type.code,
        name: type.name,
        startTime: type.startTime,
        endTime: type.endTime,
        allDay: type.allDay,
        description: type.description,
        imagePath: type.imagePath,
      },
    });
    return { googleEventId, caldavEventUrl };
  }

  if (provider === "google") {
    if (caldavEventUrl) {
      await deleteCaldavEvent(user, caldavEventUrl);
      caldavEventUrl = null;
    }
    const { eventId, driveFileId } = await upsertCalendarEvent({
      user,
      eventId: googleEventId,
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
    return { googleEventId: eventId ?? googleEventId, caldavEventUrl };
  }

  return { googleEventId, caldavEventUrl };
}

export async function removeShiftEvent(user: User, shift: EventRefs) {
  await deleteCalendarEvent(user, shift.googleEventId);
  await deleteCaldavEvent(user, shift.caldavEventUrl);
}

/** Pushes every shift from `from` onwards into the active calendar, e.g. after switching provider. */
export async function resyncShifts(user: User, from: string) {
  const shifts = await prisma.shift.findMany({
    where: { userId: user.id, date: { gte: from } },
    include: { shiftType: true },
    orderBy: { date: "asc" },
  });
  let synced = 0;
  for (const shift of shifts) {
    const refs = await syncShiftEvent(user, shift.shiftType, shift.date, shift);
    await prisma.shift.update({ where: { id: shift.id }, data: refs });
    if (refs.googleEventId || refs.caldavEventUrl) synced += 1;
  }
  return { total: shifts.length, synced };
}
