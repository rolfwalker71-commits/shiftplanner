import { PDFiumLibrary } from "@hyzyla/pdfium";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import OpenAI from "openai";
import { PNG } from "pngjs";
import { env, openaiConfigured } from "../env.js";

export type ExtractedDay = {
  day: number;
  date: string;
  code: string | null;
  label: string;
  confidence: "high" | "low";
  thumb: string;
};

export type ExtractedPlan = {
  person: string;
  monthHint: string | null;
  days: ExtractedDay[];
};

type TextItem = { str: string; x: number; y: number };
type DayCol = { day: number; x: number; left: number; right: number };

let pdfiumLib: Promise<PDFiumLibrary> | null = null;
function pdfium() {
  pdfiumLib ??= PDFiumLibrary.init();
  return pdfiumLib;
}

function tokens(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3);
}

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function columnBounds(days: { day: number; x: number }[]): DayCol[] {
  return days.map((d, i) => {
    const prev = days[i - 1];
    const next = days[i + 1];
    const gap = next ? next.x - d.x : prev ? d.x - prev.x : 16;
    const left = prev ? (prev.x + d.x) / 2 : d.x - gap * 0.15;
    const right = next ? (d.x + next.x) / 2 : d.x + gap * 0.85;
    return { day: d.day, x: d.x, left, right };
  });
}

function cropPng(src: Uint8Array, srcW: number, sx: number, sy: number, w: number, h: number) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((sy + y) * srcW + (sx + x)) * 4;
      const di = (y * w + x) * 4;
      png.data[di] = src[si] ?? 255;
      png.data[di + 1] = src[si + 1] ?? 255;
      png.data[di + 2] = src[si + 2] ?? 255;
      png.data[di + 3] = src[si + 3] ?? 255;
    }
  }
  return png;
}

function scalePng(src: PNG, factor: number) {
  const out = new PNG({ width: src.width * factor, height: src.height * factor });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const sx = Math.floor(x / factor);
      const sy = Math.floor(y / factor);
      const si = (sy * src.width + sx) * 4;
      const di = (y * out.width + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function toDataUrl(png: PNG) {
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

function fillWhite(png: PNG) {
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255;
    png.data[i + 1] = 255;
    png.data[i + 2] = 255;
    png.data[i + 3] = 255;
  }
}

function blit(src: PNG, dest: PNG, dx: number, dy: number) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      const di = ((dy + y) * dest.width + (dx + x)) * 4;
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = src.data[si + 3];
    }
  }
}

function stackPng(top: PNG, bottom: PNG) {
  const w = Math.max(top.width, bottom.width);
  const out = new PNG({ width: w, height: top.height + 10 + bottom.height });
  fillWhite(out);
  blit(top, out, 0, 0);
  blit(bottom, out, 0, top.height + 10);
  return out;
}

function cropBand(
  bitmap: Uint8Array,
  imgW: number,
  imgH: number,
  scale: number,
  x0: number,
  x1: number,
  yTop: number,
  yBot: number,
) {
  const left = Math.max(0, Math.round(x0 * scale));
  const right = Math.min(imgW, Math.round(x1 * scale));
  const top = Math.max(0, Math.round(imgH - yTop * scale));
  const h = Math.min(imgH - top, Math.max(8, Math.round((yTop - yBot) * scale)));
  const w = Math.max(8, right - left);
  return cropPng(bitmap, imgW, left, top, w, h);
}

function normalizeCode(raw: string | null | undefined): { code: string | null; label: string } {
  if (!raw) return { code: null, label: "ungeklärt — bitte zuordnen" };
  const t = raw.trim();
  if (/^(frei|free|off|x|punkt|dot|•|●|\.|…)$/i.test(t)) return { code: "Frei", label: "Frei" };
  if (/^(ferien|urlaub|palme|palm|u)$/i.test(t)) return { code: "Ferien", label: "Ferien" };
  const compact = t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{1,3}\d{0,2}$/.test(compact)) return { code: compact, label: compact };
  return { code: t, label: t };
}

async function readCodesWithVision(weeks: { days: number[]; image: PNG }[]) {
  if (!openaiConfigured) return null;
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `Du liest einen POLYPOINT-Dienstplan. Jedes Bild ist EINE Kalenderwoche:
oben die Tageszahlen, darunter GENAU EINE Mitarbeiter-Zeile (keine anderen Namen).

${weeks.map((w, i) => `Bild ${i + 1}: Tage ${w.days.join(", ")} von links nach rechts.`).join("\n")}

Jede Zelle einzeln lesen. Mehrere Punkte nacheinander = mehrere freie Tage.
Schreibe für Punkt oder X immer genau Frei, niemals einen Punkt.
- grauer Punkt oder braunes/rotes X = Frei
- grüne Palme = Ferien
- Codes wörtlich: F, F2, F3, F4, S1, S2, S3, S4, T, N, U
Genau so viele Einträge wie Tage im jeweiligen Bild.

Nur JSON: {"days":[{"day":1,"code":"F4"},{"day":2,"code":"S4"}]}`,
    },
  ];
  for (const week of weeks) {
    content.push({
      type: "image_url",
      image_url: { url: toDataUrl(week.image), detail: "high" },
    });
  }
  const res = await client.chat.completions.create({
    model: env.OPENAI_VISION_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content }],
  });
  const text = res.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(text) as { days?: { day?: number; code?: string }[] };
  const map = new Map<number, string>();
  for (const row of parsed.days ?? []) {
    if (typeof row.day === "number" && row.code) map.set(row.day, row.code);
  }
  return map;
}

async function pageTexts(page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>>) {
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const raw of content.items) {
    if (!("str" in raw) || !raw.str.trim()) continue;
    const t = raw.transform;
    items.push({ str: raw.str.trim(), x: t[4], y: t[5] });
  }
  return items;
}

export async function extractDienstplan(opts: {
  pdf: Buffer;
  month: string;
  person: string;
}): Promise<ExtractedPlan> {
  const wanted = tokens(opts.person);
  if (!wanted.length) throw new Error("Bitte einen Namen angeben.");
  const doc = await getDocument({ data: Uint8Array.from(opts.pdf), verbosity: 0, isEvalSupported: false }).promise;
  const maxDays = daysInMonth(opts.month);
  let monthHint: string | null = null;
  let found: {
    pageNo: number;
    name: string;
    nameY: number;
    dateY: number;
    days: { day: number; x: number }[];
  } | null = null;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const items = await pageTexts(page);
    const header = items.map((it) => it.str).join(" ");
    const monthMatch = header.match(/(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+20\d{2}/i);
    if (monthMatch) monthHint = monthMatch[0];

    const names = items.filter((it) => {
      const low = it.str.toLowerCase();
      return wanted.every((t) => low.includes(t));
    });
    if (!names.length) continue;
    const name = names[0];
    const uniq = new Map<number, { x: number; y: number }>();
    for (const it of items) {
      if (!/^(0?[1-9]|[12]\d|3[01])$/.test(it.str) || it.y <= name.y + 20) continue;
      const day = Number(it.str);
      if (day >= 1 && day <= 31 && !uniq.has(day)) uniq.set(day, { x: it.x, y: it.y });
    }
    const days = [...uniq.entries()]
      .map(([day, pos]) => ({ day, x: pos.x, y: pos.y }))
      .sort((a, b) => a.x - b.x);
    if (days.length >= 20) {
      found = {
        pageNo: i,
        name: name.str,
        nameY: name.y,
        dateY: days[0]?.y ?? name.y + 100,
        days: days.map(({ day, x }) => ({ day, x })),
      };
      break;
    }
  }
  if (!found) {
    throw new Error(`Keine Zeile für „${opts.person}“ gefunden.`);
  }

  const scale = 4;
  const lib = await pdfium();
  const pdfDoc = await lib.loadDocument(Uint8Array.from(opts.pdf));
  const rendered = await pdfDoc.getPage(found.pageNo - 1).render({ scale, render: "bitmap" });
  const bitmap = rendered.data;
  const imgW = rendered.width;
  const imgH = rendered.height;

  const cols = columnBounds(found.days.filter((d) => d.day <= maxDays));
  const headerYTop = found.dateY + 16;
  const headerYBot = found.dateY - 8;
  const rowYTop = found.nameY + 8;
  const rowYBot = found.nameY - 16;

  const [year, monthNum] = opts.month.split("-").map(Number);
  const weekChunks: DayCol[][] = [];
  let chunk: DayCol[] = [];
  for (const col of cols) {
    const weekday = new Date(Date.UTC(year, monthNum - 1, col.day)).getUTCDay();
    if (chunk.length && weekday === 1) {
      weekChunks.push(chunk);
      chunk = [];
    }
    chunk.push(col);
  }
  if (chunk.length) weekChunks.push(chunk);

  const weekImages = weekChunks.map((week) => {
    const x0 = week[0].left - 2;
    const x1 = week[week.length - 1].right + 2;
    const header = cropBand(bitmap, imgW, imgH, scale, x0, x1, headerYTop, headerYBot);
    const row = cropBand(bitmap, imgW, imgH, scale, x0, x1, rowYTop, rowYBot);
    return { days: week.map((c) => c.day), image: stackPng(header, row) };
  });

  let vision: Map<number, string> | null = null;
  try {
    vision = await readCodesWithVision(weekImages);
  } catch {
    vision = null;
  }

  const cellTopPdf = rowYTop;
  const cellBotPdf = rowYBot;
  const extracted: ExtractedDay[] = [];
  for (const col of cols) {
    const left = Math.max(0, Math.round(col.left * scale));
    const right = Math.min(imgW, Math.round(col.right * scale));
    const top = Math.max(0, Math.round(imgH - cellTopPdf * scale));
    const w = Math.max(12, right - left);
    const h = Math.min(imgH - top, Math.max(12, Math.round((cellTopPdf - cellBotPdf) * scale)));
    const cell = cropPng(bitmap, imgW, left, top, w, h);
    const thumb = toDataUrl(scalePng(cell, 2));
    const read = normalizeCode(vision?.get(col.day) ?? null);
    extracted.push({
      day: col.day,
      date: `${opts.month}-${String(col.day).padStart(2, "0")}`,
      code: read.code,
      label: vision ? read.label : `${read.label} (ohne Bild-KI)`,
      confidence: read.code ? "high" : "low",
      thumb,
    });
  }
  return { person: found.name, monthHint, days: extracted };
}

export function matchShiftType<T extends { id: string; code: string; name: string }>(
  code: string | null,
  types: T[],
): T | null {
  if (!code) return null;
  const key = code.trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    frei: ["frei", "dienstfrei", "x", "punkt"],
    ferien: ["ferien", "urlaub", "u", "palme"],
  };
  const exact = types.find((t) => t.code.trim().toLowerCase() === key);
  if (exact) return exact;
  for (const [canon, names] of Object.entries(aliases)) {
    if (names.includes(key) || key === canon) {
      const hit = types.find((t) => {
        const c = t.code.trim().toLowerCase();
        const n = t.name.trim().toLowerCase();
        return names.includes(c) || names.includes(n) || c === canon || n === canon;
      });
      if (hit) return hit;
    }
  }
  return types.find((t) => t.name.trim().toLowerCase() === key) ?? null;
}
