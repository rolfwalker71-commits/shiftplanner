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

export type WidgetSettings = {
  title: string;
  small: "next" | "today" | "countdown";
  medium: "twoDays" | "week";
  large: "week" | "twoWeeks" | "month";
  extraLarge: "week" | "month";
  showImages: boolean;
  showTimes: boolean;
  showHours: boolean;
  showFree: boolean;
  theme: "auto" | "light" | "dark";
};

export type WidgetShift = {
  code: string;
  name: string;
  color: string;
  allDay: boolean;
  start: string | null;
  end: string | null;
  breakMinutes: number;
  hours: number;
  image: string | null;
  thumb: string | null;
};

export type WidgetPayload = {
  settings: WidgetSettings;
  today: string;
  days: { date: string; shift: WidgetShift | null }[];
};
