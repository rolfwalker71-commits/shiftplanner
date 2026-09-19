/**
 * Scriptable (iOS) widget script. Settings live on the server, so the script only
 * carries the base URL and the personal token. The script body avoids template
 * literals so it can sit inside String.raw untouched.
 */
export function buildWidgetScript(base: string, token: string) {
  return SCRIPT.replace("__BASE__", JSON.stringify(base.replace(/\/$/, ""))).replace(
    "__TOKEN__",
    JSON.stringify(token),
  );
}

const SCRIPT = String.raw`// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: calendar-alt;

// Arbeitsplan – Widget
// Aussehen und Inhalt stellst du in der App ein: Einstellungen › Widgets.
// Änderungen dort gelten sofort, das Skript musst du nicht neu kopieren.
//
// Optionaler Widget-Parameter (Widget lange drücken › Widget bearbeiten › Parameter):
//   klein:  next · today · countdown
//   mittel: twoDays · week
//   gross:  week · twoWeeks · month
//   extra gross (iPad): week · month

const BASE = __BASE__;
const TOKEN = __TOKEN__;

const fm = FileManager.local();
const dir = fm.joinPath(fm.cacheDirectory(), "arbeitsplan-widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
const dataFile = fm.joinPath(dir, "data.json");

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WD1 = ["S", "M", "D", "M", "D", "F", "S"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const INK = new Color("#1D1D1F");

// ---------- data ----------

async function loadData() {
  try {
    const req = new Request(BASE + "/api/widget/data?token=" + encodeURIComponent(TOKEN));
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    const status = req.response ? req.response.statusCode : 200;
    if (status >= 400 || !data || !data.days) {
      throw new Error(data && data.error ? data.error : "Server antwortet mit " + status);
    }
    fm.writeString(dataFile, JSON.stringify(data));
    return { data: data, offline: false };
  } catch (e) {
    if (fm.fileExists(dataFile)) {
      return { data: JSON.parse(fm.readString(dataFile)), offline: true, error: String(e.message || e) };
    }
    return { data: null, offline: true, error: String(e.message || e) };
  }
}

async function image(path) {
  if (!path) return null;
  const url = /^https?:/i.test(path) ? path : BASE + path;
  const file = fm.joinPath(dir, url.replace(/[^a-z0-9]/gi, "_").slice(-120));
  if (fm.fileExists(file)) return fm.readImage(file);
  try {
    const img = await new Request(url).loadImage();
    fm.writeImage(file, img);
    return img;
  } catch (e) {
    return null;
  }
}

// ---------- dates ----------

function pad(n) { return (n < 10 ? "0" : "") + n; }
function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parse(s) { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
function toMin(t) { const p = t.split(":").map(Number); return p[0] * 60 + p[1]; }
function dayDiff(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }

function relLabel(date, today) {
  const diff = dayDiff(today, date);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  const d = parse(date);
  return WD[d.getDay()] + " " + d.getDate() + ".";
}

function isoWeek(date) {
  const d = parse(date);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

function mondayOf(date) {
  const d = parse(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

function addDays(date, n) { const d = parse(date); d.setDate(d.getDate() + n); return ymd(d); }

// ---------- shifts ----------

function visible(shift) {
  if (!shift) return null;
  if (shift.allDay && !S.showFree) return null;
  return shift;
}

function timeText(s) {
  if (!s) return "";
  if (s.allDay || !s.start || !s.end) return "ganztags";
  return s.start + "–" + s.end;
}

function hoursText(h) {
  return (Math.round(h * 10) / 10).toString().replace(".", ",") + " Std.";
}

function dayAt(date) {
  for (const d of DATA.days) if (d.date === date) return d;
  return { date: date, shift: null };
}

// Next working shift that has not ended yet.
function nextWork(now) {
  const today = ymd(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const d of DATA.days) {
    if (d.date < today || !d.shift || d.shift.allDay || !d.shift.start) continue;
    if (d.date === today && d.shift.end) {
      let s = toMin(d.shift.start), e = toMin(d.shift.end);
      if (e <= s) e += 1440;
      if (mins >= e) continue;
    }
    return d;
  }
  return null;
}

function countdown(day, now) {
  const start = parse(day.date);
  const sm = toMin(day.shift.start);
  start.setHours(Math.floor(sm / 60), sm % 60, 0, 0);
  const diff = Math.round((start - now) / 60000);
  if (diff <= 0) return "läuft";
  if (diff < 60) return "in " + diff + " Min.";
  if (diff < 24 * 60) return "in " + Math.round(diff / 60) + " Std.";
  const days = dayDiff(ymd(now), day.date);
  return "in " + days + (days === 1 ? " Tag" : " Tagen");
}

// ---------- look ----------

let S = {};
let DATA = null;
let C = {};

function dyn(light, dark, alpha) {
  const a = alpha === undefined ? 1 : alpha;
  if (S.theme === "light") return new Color(light, a);
  if (S.theme === "dark") return new Color(dark, a);
  return Color.dynamic(new Color(light, a), new Color(dark, a));
}

function setupColors() {
  C = {
    bg: dyn("#F2F4F8", "#0F1117"),
    card: dyn("#FFFFFF", "#1C1F28"),
    ink: dyn("#1D1D1F", "#F5F5F7"),
    muted: dyn("#6E6E73", "#9C9CA3"),
    accent: dyn("#007AFF", "#0A84FF"),
    today: dyn("#007AFF", "#0A84FF", 0.14),
  };
}

// Widget sizes in points. iPad sizes follow the portrait screen width of each model.
function widgetSize(family) {
  const sw = Device.screenSize().width, sh = Device.screenSize().height;
  const w = Math.min(sw, sh), h = Math.max(sw, sh);
  let t;
  if (Device.isPad()) {
    // [small, medium width, large side, extraLarge width]
    if (w >= 1024) t = [170, 379, 379, 795];       // iPad Pro 12.9"/13"
    else if (w >= 820) t = [155, 342, 342, 715];   // iPad Pro 11", Air 10.9"/11", iPad 10.9"
    else if (w >= 810) t = [146, 320, 320, 673];   // iPad 10.2"
    else t = [141, 305, 305, 634];                 // iPad mini, 9.7"
    return {
      small: [t[0], t[0]],
      medium: [t[1], t[0]],
      large: [t[2], t[2]],
      extraLarge: [t[3], t[2]],
    }[family];
  }
  if (w >= 428) t = [170, 364, 170, 382];
  else if (w >= 414) t = [169, 360, 169, 379];
  else if (w >= 390) t = [158, 338, 158, 354];
  else if (w >= 375 && h >= 812) t = [155, 329, 155, 345];
  else if (w >= 375) t = [148, 321, 148, 324];
  else t = [141, 292, 141, 311];
  return { small: [t[0], t[0]], medium: [t[1], t[2]], large: [t[1], t[3]] }[family];
}

function text(stack, value, font, color, opts) {
  const t = stack.addText(value);
  t.font = font;
  t.textColor = color;
  t.lineLimit = (opts && opts.lines) || 1;
  if (opts && opts.min) t.minimumScaleFactor = opts.min;
  if (opts && opts.opacity) t.textOpacity = opts.opacity;
  if (opts && opts.center) t.centerAlignText();
  return t;
}

function codePill(stack, shift, fontSize) {
  const pill = stack.addStack();
  pill.backgroundColor = new Color(shift.color);
  pill.cornerRadius = fontSize;
  pill.setPadding(2, 7, 2, 7);
  text(pill, shift.code, Font.boldSystemFont(fontSize), INK, { min: 0.6 });
  return pill;
}

async function avatar(stack, shift, size) {
  const img = S.showImages && shift ? await image(shift.thumb) : null;
  if (img) {
    const i = stack.addImage(img);
    i.imageSize = new Size(size, size);
    i.cornerRadius = size / 2;
    return;
  }
  const box = stack.addStack();
  box.size = new Size(size, size);
  box.cornerRadius = size / 2;
  box.centerAlignContent();
  if (shift) {
    box.backgroundColor = new Color(shift.color);
    text(box, shift.code, Font.boldSystemFont(size * 0.34), INK, { min: 0.5 });
  } else {
    box.backgroundColor = dyn("#E5E7EC", "#262A35");
    text(box, "–", Font.mediumSystemFont(size * 0.36), C.muted);
  }
}

function header(w, right) {
  const row = w.addStack();
  row.centerAlignContent();
  text(row, S.title || "Arbeitsplan", Font.boldSystemFont(13), C.ink);
  row.addSpacer();
  if (right) text(row, right, Font.mediumSystemFont(11), C.muted);
  return row;
}

// ---------- small ----------

async function heroTile(stack, day, label, emptyTitle, emptyText) {
  const shift = day ? visible(day.shift) : null;
  const img = shift && S.showImages ? await image(shift.image) : null;
  if (img) stack.backgroundImage = img;
  else stack.backgroundColor = shift ? new Color(shift.color) : C.card;

  if (!shift) {
    stack.setPadding(12, 12, 12, 12);
    stack.layoutVertically();
    text(stack, label.toUpperCase(), Font.semiboldSystemFont(10), C.muted);
    stack.addSpacer(4);
    text(stack, emptyTitle, Font.boldSystemFont(22), C.ink);
    stack.addSpacer();
    if (emptyText) text(stack, emptyText, Font.mediumSystemFont(11), C.muted, { lines: 2 });
    return;
  }

  stack.layoutVertically();
  stack.setPadding(8, 8, 8, 8);
  stack.addSpacer();
  const box = stack.addStack();
  box.layoutVertically();
  box.cornerRadius = 12;
  box.setPadding(5, 9, 6, 9);
  box.backgroundColor = img ? new Color("#000000", 0.4) : new Color("#FFFFFF", 0.4);
  const fg = img ? Color.white() : INK;
  const top = box.addStack();
  text(top, label.toUpperCase(), Font.semiboldSystemFont(9), fg, { opacity: 0.85 });
  top.addSpacer();
  const row = box.addStack();
  row.centerAlignContent();
  text(row, shift.code, Font.heavySystemFont(20), fg, { min: 0.6 });
  row.addSpacer();
  if (S.showTimes) text(box, timeText(shift), Font.semiboldSystemFont(11), fg, { min: 0.7 });
}

async function smallNext(w, now) {
  const day = nextWork(now);
  w.setPadding(0, 0, 0, 0);
  const tile = w.addStack();
  tile.size = new Size(SIZE[0], SIZE[1]);
  await heroTile(tile, day, day ? relLabel(day.date, ymd(now)) : "Nächste Schicht", "Frei", "Keine Schicht in den nächsten Wochen");
}

async function smallToday(w, now) {
  const today = dayAt(ymd(now));
  const next = nextWork(now);
  w.setPadding(0, 0, 0, 0);
  const tile = w.addStack();
  tile.size = new Size(SIZE[0], SIZE[1]);
  const hint = next ? "Nächste: " + relLabel(next.date, ymd(now)) + " · " + next.shift.code : "";
  await heroTile(tile, today, "Heute", "Frei", hint);
}

async function smallCountdown(w, now) {
  const day = nextWork(now);
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);
  const top = w.addStack();
  top.centerAlignContent();
  await avatar(top, day ? day.shift : null, 40);
  top.addSpacer();
  if (day) codePill(top, day.shift, 13);
  w.addSpacer();
  if (!day) {
    text(w, "Frei", Font.boldSystemFont(24), C.ink);
    text(w, "Keine Schicht geplant", Font.mediumSystemFont(11), C.muted);
    return;
  }
  const cd = countdown(day, now);
  text(w, cd, Font.boldRoundedSystemFont(26), cd === "läuft" ? C.accent : C.ink, { min: 0.6 });
  text(w, relLabel(day.date, ymd(now)) + (S.showTimes ? " · " + timeText(day.shift) : ""), Font.semiboldSystemFont(11), C.muted, { min: 0.7 });
  text(w, day.shift.name, Font.mediumSystemFont(11), C.muted, { min: 0.7 });
}

// ---------- medium ----------

async function mediumTwoDays(w, now) {
  const today = ymd(now);
  w.setPadding(10, 10, 10, 10);
  const row = w.addStack();
  const tileW = Math.floor((SIZE[0] - 20 - 8) / 2);
  const tileH = SIZE[1] - 20;
  const labels = ["Heute", "Morgen"];
  for (let i = 0; i < 2; i++) {
    const tile = row.addStack();
    tile.size = new Size(tileW, tileH);
    tile.cornerRadius = 16;
    await heroTile(tile, dayAt(addDays(today, i)), labels[i], "Frei", "");
    if (i === 0) row.addSpacer(8);
  }
}

async function weekColumns(w, start, today, colW, thumb) {
  const row = w.addStack();
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const shift = visible(dayAt(date).shift);
    const col = row.addStack();
    col.layoutVertically();
    col.size = new Size(colW, 0);
    col.setPadding(4, 0, 4, 0);
    if (date === today) { col.backgroundColor = C.today; col.cornerRadius = 12; }
    const d = parse(date);
    const head = col.addStack();
    head.addSpacer();
    text(head, WD[d.getDay()] + " " + d.getDate(), Font.semiboldSystemFont(10), date === today ? C.accent : C.muted, { min: 0.7 });
    head.addSpacer();
    col.addSpacer(4);
    const mid = col.addStack();
    mid.addSpacer();
    await avatar(mid, shift, thumb);
    mid.addSpacer();
    col.addSpacer(4);
    const foot = col.addStack();
    foot.addSpacer();
    text(foot, shift ? shift.code : "frei", Font.boldSystemFont(11), shift ? C.ink : C.muted, { min: 0.6 });
    foot.addSpacer();
    if (S.showTimes && shift && !shift.allDay && thumb >= 36) {
      const t = col.addStack();
      t.addSpacer();
      text(t, shift.start, Font.mediumSystemFont(9), C.muted, { min: 0.6 });
      t.addSpacer();
    }
  }
}

function weekHours(start) {
  let h = 0;
  for (let i = 0; i < 7; i++) {
    const s = dayAt(addDays(start, i)).shift;
    if (s) h += s.hours || 0;
  }
  return h;
}

async function mediumWeek(w, now) {
  const today = ymd(now);
  const start = mondayOf(today);
  w.backgroundColor = C.bg;
  w.setPadding(12, 10, 10, 10);
  let right = "KW " + isoWeek(today);
  if (S.showHours) right += " · " + hoursText(weekHours(start));
  header(w, right);
  w.addSpacer();
  await weekColumns(w, start, today, Math.floor((SIZE[0] - 20) / 7), 34);
}

// ---------- large ----------

async function largeWeek(w, now) {
  const today = ymd(now);
  const start = mondayOf(today);
  w.backgroundColor = C.bg;
  w.setPadding(14, 12, 12, 12);
  let right = "KW " + isoWeek(today);
  if (S.showHours) right += " · " + hoursText(weekHours(start));
  header(w, right);
  w.addSpacer(8);
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const shift = visible(dayAt(date).shift);
    const row = w.addStack();
    row.centerAlignContent();
    row.setPadding(3, 6, 3, 8);
    row.cornerRadius = 12;
    if (date === today) row.backgroundColor = C.today;
    await avatar(row, shift, 36);
    row.addSpacer(10);
    const mid = row.addStack();
    mid.layoutVertically();
    const d = parse(date);
    text(mid, WD[d.getDay()] + " " + d.getDate() + "." + (date === today ? "  Heute" : ""), Font.boldSystemFont(13), date === today ? C.accent : C.ink);
    text(mid, shift ? shift.name : "frei", Font.mediumSystemFont(11), C.muted);
    row.addSpacer();
    const right = row.addStack();
    right.layoutVertically();
    if (shift) {
      const p = right.addStack();
      p.addSpacer();
      codePill(p, shift, 12);
      if (S.showTimes) {
        const t = right.addStack();
        t.addSpacer();
        text(t, timeText(shift), Font.mediumSystemFont(10), C.muted);
      }
    }
    if (i < 6) w.addSpacer(3);
  }
  w.addSpacer();
}

async function largeTwoWeeks(w, now) {
  const today = ymd(now);
  const start = mondayOf(today);
  w.backgroundColor = C.bg;
  w.setPadding(14, 10, 12, 10);
  const colW = Math.floor((SIZE[0] - 20) / 7);
  header(w, S.showHours ? hoursText(weekHours(start) + weekHours(addDays(start, 7))) : "");
  for (let k = 0; k < 2; k++) {
    const ws = addDays(start, 7 * k);
    w.addSpacer(k === 0 ? 8 : 10);
    const label = w.addStack();
    label.setPadding(0, 4, 0, 0);
    text(label, "KW " + isoWeek(ws) + (k === 0 ? " · diese Woche" : " · nächste Woche"), Font.semiboldSystemFont(11), C.muted);
    w.addSpacer(4);
    await weekColumns(w, ws, today, colW, 38);
  }
  w.addSpacer();
}

async function largeMonth(w, now) {
  const today = ymd(now);
  const first = today.slice(0, 8) + "01";
  const d0 = parse(first);
  w.backgroundColor = C.bg;
  w.setPadding(14, 10, 10, 10);
  header(w, MONTHS[d0.getMonth()] + " " + d0.getFullYear());
  w.addSpacer(8);
  const colW = Math.floor((SIZE[0] - 20) / 7);
  const head = w.addStack();
  for (let i = 0; i < 7; i++) {
    const c = head.addStack();
    c.size = new Size(colW, 14);
    text(c, WD1[(i + 1) % 7], Font.semiboldSystemFont(10), C.muted);
  }
  const start = mondayOf(first);
  const month = first.slice(0, 7);
  let weeks = 0;
  while (addDays(start, weeks * 7).slice(0, 7) <= month && weeks < 6) weeks++;
  const cellH = Math.floor((SIZE[1] - 14 - 10 - 20 - 8 - 14) / weeks) - 2;
  for (let r = 0; r < weeks; r++) {
    w.addSpacer(2);
    const row = w.addStack();
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, r * 7 + i);
      const inMonth = date.slice(0, 7) === month;
      const shift = inMonth ? visible(dayAt(date).shift) : null;
      const cell = row.addStack();
      cell.size = new Size(colW - 2, cellH);
      cell.layoutVertically();
      cell.cornerRadius = 8;
      cell.setPadding(2, 0, 2, 0);
      if (date === today) cell.backgroundColor = C.today;
      const n = cell.addStack();
      n.addSpacer();
      text(n, String(parse(date).getDate()), Font.semiboldSystemFont(10), date === today ? C.accent : C.muted, { opacity: inMonth ? 1 : 0.35 });
      n.addSpacer();
      cell.addSpacer(2);
      if (shift) {
        const p = cell.addStack();
        p.addSpacer();
        codePill(p, shift, 10);
        p.addSpacer();
      }
      cell.addSpacer();
      if (i < 6) row.addSpacer(2);
    }
  }
  w.addSpacer();
}

// ---------- extra large (iPad) ----------

async function extraLargeWeek(w, now) {
  const today = ymd(now);
  const start = mondayOf(today);
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);
  let right = "KW " + isoWeek(today);
  if (S.showHours) right += " · " + hoursText(weekHours(start));
  header(w, right);
  w.addSpacer(10);
  const gap = 8;
  const tileW = Math.floor((SIZE[0] - 28 - gap * 6) / 7);
  const tileH = SIZE[1] - 28 - 16 - 10 - 18;
  const heads = w.addStack();
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const d = parse(date);
    const c = heads.addStack();
    c.size = new Size(tileW, 16);
    text(c, WD[d.getDay()] + " " + d.getDate() + "." + (date === today ? " · Heute" : ""), Font.semiboldSystemFont(11), date === today ? C.accent : C.muted, { min: 0.7 });
    if (i < 6) heads.addSpacer(gap);
  }
  w.addSpacer(4);
  const row = w.addStack();
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const tile = row.addStack();
    tile.size = new Size(tileW, tileH);
    tile.cornerRadius = 16;
    if (date === today) { tile.borderColor = C.accent; tile.borderWidth = 3; }
    const shift = visible(dayAt(date).shift);
    const img = shift && S.showImages ? await image(shift.image) : null;
    if (img) tile.backgroundImage = img;
    else tile.backgroundColor = shift ? new Color(shift.color) : C.card;
    tile.layoutVertically();
    tile.setPadding(6, 6, 6, 6);
    tile.addSpacer();
    const box = tile.addStack();
    box.layoutVertically();
    box.cornerRadius = 10;
    box.setPadding(4, 7, 5, 7);
    const fg = img ? Color.white() : shift ? INK : C.muted;
    if (shift) box.backgroundColor = img ? new Color("#000000", 0.4) : new Color("#FFFFFF", 0.4);
    const top = box.addStack();
    text(top, shift ? shift.code : "frei", Font.heavySystemFont(16), fg, { min: 0.6 });
    top.addSpacer();
    if (shift && S.showTimes) text(box, timeText(shift), Font.semiboldSystemFont(10), fg, { min: 0.6 });
    if (i < 6) row.addSpacer(gap);
  }
}

async function extraLargeMonth(w, now) {
  const today = ymd(now);
  const first = today.slice(0, 8) + "01";
  const d0 = parse(first);
  const start = mondayOf(first);
  const month = first.slice(0, 7);
  let weeks = 0;
  while (addDays(start, weeks * 7).slice(0, 7) <= month && weeks < 6) weeks++;
  let hours = 0;
  for (const d of DATA.days) if (d.date.slice(0, 7) === month && d.shift) hours += d.shift.hours || 0;

  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 12, 14);
  header(w, MONTHS[d0.getMonth()] + " " + d0.getFullYear() + (S.showHours ? " · " + hoursText(hours) : ""));
  w.addSpacer(6);
  const gap = 4;
  const colW = Math.floor((SIZE[0] - 28 - gap * 6) / 7);
  const head = w.addStack();
  for (let i = 0; i < 7; i++) {
    const c = head.addStack();
    c.size = new Size(colW, 14);
    text(c, WD[(i + 1) % 7], Font.semiboldSystemFont(10), C.muted);
    if (i < 6) head.addSpacer(gap);
  }
  const cellH = Math.floor((SIZE[1] - 26 - 16 - 6 - 14) / weeks) - gap;
  const thumb = Math.max(18, Math.min(cellH - 8, 40));
  for (let r = 0; r < weeks; r++) {
    w.addSpacer(gap);
    const row = w.addStack();
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, r * 7 + i);
      const inMonth = date.slice(0, 7) === month;
      const shift = inMonth ? visible(dayAt(date).shift) : null;
      const cell = row.addStack();
      cell.size = new Size(colW, cellH);
      cell.cornerRadius = 10;
      cell.centerAlignContent();
      cell.setPadding(0, 6, 0, 6);
      cell.backgroundColor = date === today ? C.today : inMonth ? C.card : C.bg;
      const left = cell.addStack();
      left.layoutVertically();
      text(left, String(parse(date).getDate()), Font.semiboldSystemFont(11), date === today ? C.accent : C.ink, { opacity: inMonth ? 1 : 0.3 });
      if (shift) text(left, shift.code, Font.heavySystemFont(12), C.ink, { min: 0.6 });
      cell.addSpacer();
      if (shift) await avatar(cell, shift, thumb);
      if (i < 6) row.addSpacer(gap);
    }
  }
}

// ---------- lock screen ----------

function lockScreen(w, family, now) {
  const day = nextWork(now);
  const today = ymd(now);
  if (family === "accessoryInline") {
    text(w, day ? day.shift.code + " " + relLabel(day.date, today).toLowerCase() + (day.shift.start ? " " + day.shift.start : "") : "Keine Schicht", Font.semiboldSystemFont(12), Color.white());
    return;
  }
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const top = w.addStack();
    top.addSpacer();
    text(top, day ? (dayDiff(today, day.date) === 0 ? "HEUTE" : WD[parse(day.date).getDay()].toUpperCase()) : "FREI", Font.semiboldSystemFont(9), Color.white(), { min: 0.6 });
    top.addSpacer();
    const mid = w.addStack();
    mid.addSpacer();
    text(mid, day ? day.shift.code : "–", Font.heavySystemFont(18), Color.white(), { min: 0.5 });
    mid.addSpacer();
    if (day && day.shift.start) {
      const b = w.addStack();
      b.addSpacer();
      text(b, day.shift.start, Font.mediumSystemFont(9), Color.white(), { min: 0.6 });
      b.addSpacer();
    }
    return;
  }
  // accessoryRectangular
  if (!day) {
    text(w, "Keine Schicht", Font.boldSystemFont(14), Color.white());
    text(w, "in den nächsten Wochen", Font.mediumSystemFont(12), Color.white(), { opacity: 0.7 });
    return;
  }
  text(w, relLabel(day.date, today) + " · " + day.shift.code, Font.heavySystemFont(15), Color.white(), { min: 0.7 });
  text(w, timeText(day.shift) + " · " + countdown(day, now), Font.semiboldSystemFont(12), Color.white(), { min: 0.7 });
  text(w, day.shift.name, Font.mediumSystemFont(12), Color.white(), { opacity: 0.7, min: 0.7 });
}

// ---------- main ----------

const LAYOUTS = {
  small: { next: smallNext, today: smallToday, countdown: smallCountdown },
  medium: { twoDays: mediumTwoDays, week: mediumWeek },
  large: { week: largeWeek, twoWeeks: largeTwoWeeks, month: largeMonth },
  extraLarge: { week: extraLargeWeek, month: extraLargeMonth },
};

let SIZE = [158, 158];

async function build(family) {
  const w = new ListWidget();
  const loaded = await loadData();
  DATA = loaded.data;
  S = (DATA && DATA.settings) || {};
  setupColors();
  const now = new Date();
  w.refreshAfterDate = new Date(now.getTime() + 30 * 60 * 1000);

  if (!DATA) {
    w.backgroundColor = C.bg;
    w.setPadding(14, 14, 14, 14);
    text(w, "Arbeitsplan", Font.boldSystemFont(14), C.ink);
    w.addSpacer(6);
    text(w, "Keine Verbindung. Ist der Link noch gültig? Sonst in der App unter Einstellungen › Widgets das Skript neu kopieren.", Font.mediumSystemFont(11), C.muted, { lines: 5 });
    return w;
  }
  w.url = BASE + (DATA.openUrl || "/app/heute");

  if (family.indexOf("accessory") === 0) {
    lockScreen(w, family, now);
    return w;
  }

  SIZE = widgetSize(family) || SIZE;
  const options = LAYOUTS[family] || LAYOUTS.small;
  const param = (args.widgetParameter || "").trim();
  const chosen = options[param] ? param : S[family];
  const render = options[chosen] || options[Object.keys(options)[0]];
  await render(w, now);
  return w;
}

let family = config.widgetFamily;
if (!family) {
  const a = new Alert();
  a.title = "Vorschau";
  a.addAction("Klein");
  a.addAction("Mittel");
  a.addAction("Gross");
  if (Device.isPad()) a.addAction("Extra gross");
  a.addCancelAction("Abbrechen");
  const pick = await a.presentSheet();
  family = ["small", "medium", "large", "extraLarge"][pick];
}

if (family) {
  const widget = await build(family);
  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else if (family === "small") {
    await widget.presentSmall();
  } else if (family === "medium") {
    await widget.presentMedium();
  } else if (family === "large") {
    await widget.presentLarge();
  } else {
    await widget.presentExtraLarge();
  }
}
Script.complete();
`;
