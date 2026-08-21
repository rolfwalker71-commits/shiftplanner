export type ShiftType = {
  id: string;
  code: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  allDay: boolean;
  color: string;
  description: string;
  showCodeInImage: boolean;
  imagePath: string | null;
  sortOrder: number;
};

export type Shift = {
  id: string;
  date: string;
  googleEventId: string | null;
  shiftTypeId: string;
  shiftType: ShiftType;
};

export type Status = {
  demoMode: boolean;
  googleConfigured: boolean;
  openaiConfigured: boolean;
  user: {
    id: string;
    email: string;
    name: string | null;
    selectedCalendarId: string | null;
    timezone: string;
    googleConnected: boolean;
  } | null;
};
