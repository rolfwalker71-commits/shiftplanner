import type { Shift, ShiftType, Status } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: unknown; message?: string };
      if (typeof body.message === "string" && body.message) message = body.message;
      else if (typeof body.error === "string") message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  status: () => req<Status>("/api/auth/status"),
  demoLogin: () => req<{ ok: boolean }>("/api/auth/demo", { method: "POST" }),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  shiftTypes: () => req<ShiftType[]>("/api/shift-types"),
  createType: (body: Partial<ShiftType>) =>
    req<ShiftType>("/api/shift-types", { method: "POST", body: JSON.stringify(body) }),
  updateType: (id: string, body: Partial<ShiftType>) =>
    req<ShiftType>(`/api/shift-types/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteType: (id: string) =>
    req<{ ok: boolean }>(`/api/shift-types/${id}`, { method: "DELETE" }),
  previewPrompt: (body: Partial<ShiftType>) =>
    req<{ prompt: string }>("/api/shift-types/preview-prompt", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  generateImage: (id: string) =>
    req<ShiftType & { prompt: string }>(`/api/shift-types/${id}/generate-image`, {
      method: "POST",
    }),
  shifts: (from: string, to: string) =>
    req<Shift[]>(`/api/shifts?from=${from}&to=${to}`),
  createShift: (shiftTypeId: string, date: string) =>
    req<Shift>("/api/shifts", { method: "POST", body: JSON.stringify({ shiftTypeId, date }) }),
  moveShift: (id: string, date: string) =>
    req<Shift>(`/api/shifts/${id}`, { method: "PATCH", body: JSON.stringify({ date }) }),
  deleteShift: (id: string) => req<{ ok: boolean }>(`/api/shifts/${id}`, { method: "DELETE" }),
  calendars: () =>
    req<{ items: { id: string; summary: string; primary?: boolean }[]; selectedCalendarId: string | null }>(
      "/api/calendars",
    ),
  saveSettings: (body: { selectedCalendarId?: string; timezone?: string }) =>
    req("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
};
