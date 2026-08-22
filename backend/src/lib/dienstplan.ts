import { PDFiumLibrary } from "@hyzyla/pdfium";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PNG } from "pngjs";

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

function classify(data: Uint8Array, w: number, h: number): { code: string | null; label: string; confidence: "high" | "low" } {
  let n = 0;
  let reds = 0;
  let greens = 0;
  let blues = 0;
  let centerDark = 0;
  let centerN = 0;
  const x0 = Math.floor(w * 0.28);
  const x1 = Math.ceil(w * 0.72);
  const y0 = Math.floor(h * 0.22);
  const y1 = Math.ceil(h * 0.78);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      n += 1;
      if (r > 180 && g < 90 && b < 90) reds += 1;
      else if (g > r + 20 && g > b + 15 && g > 80) greens += 1;
      else if (b > r + 25 && b > g + 10 && b > 90) blues += 1;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        centerN += 1;
        if ((r + g + b) / 3 < 140) centerDark += 1;
      }
    }
  }
  const rp = reds / Math.max(1, n);
  const gp = greens / Math.max(1, n);
  const bp = blues / Math.max(1, n);
  const cd = centerN ? centerDark / centerN : 0;
  if (gp > 0.06) return { code: "Ferien", label: "Ferien (Palme)", confidence: "high" };
  if (cd < 0.08 && bp < 0.08 && rp < 0.15) {
    return { code: "Frei", label: "Frei (Punkt oder X)", confidence: "high" };
  }
  if (bp >= 0.12 && rp < 0.1) return { code: "F", label: "F", confidence: "high" };
  return { code: null, label: "ungeklärt — bitte zuordnen", confidence: "low" };
}

function cropThumb(src: Uint8Array, srcW: number, sx: number, sy: number, w: number, h: number) {
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
  return { pixels: png.data, dataUrl: `data:image/png;base64,${PNG.sync.write(png).toString("base64")}` };
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
  const data = Uint8Array.from(opts.pdf);
  const doc = await getDocument({ data: Uint8Array.from(opts.pdf), verbosity: 0, isEvalSupported: false }).promise;
  const maxDays = daysInMonth(opts.month);
  let monthHint: string | null = null;
  let found: { pageNo: number; name: string; nameY: number; pageW: number; pageH: number; days: { day: number; x: number }[] } | null = null;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
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
    const uniq = new Map<number, number>();
    for (const it of items) {
      if (!/^(0?[1-9]|[12]\d|3[01])$/.test(it.str) || it.y <= name.y + 20) continue;
      const day = Number(it.str);
      if (day >= 1 && day <= 31 && !uniq.has(day)) uniq.set(day, it.x);
    }
    const days = [...uniq.entries()]
      .map(([day, x]) => ({ day, x }))
      .sort((a, b) => a.x - b.x);
    if (days.length >= 20) {
      found = { pageNo: i, name: name.str, nameY: name.y, pageW: viewport.width, pageH: viewport.height, days };
      break;
    }
  }
  if (!found) {
    throw new Error(`Keine Zeile für „${opts.person}“ gefunden.`);
  }

  const scale = 3;
  const lib = await pdfium();
  const pdfDoc = await lib.loadDocument(Uint8Array.from(opts.pdf));
  const rendered = await pdfDoc.getPage(found.pageNo - 1).render({ scale, render: "bitmap" });
  const bitmap = rendered.data;
  const imgW = rendered.width;
  const imgH = rendered.height;

  const extracted: ExtractedDay[] = [];
  const half = 7;
  const yTop = found.nameY + 4;
  const yBot = found.nameY - 14;
  for (const col of found.days) {
    if (col.day > maxDays) continue;
    const left = Math.max(0, Math.round((col.x - half) * scale));
    const top = Math.max(0, Math.round(imgH - yTop * scale));
    const w = Math.min(imgW - left, Math.max(8, Math.round(14 * scale)));
    const h = Math.min(imgH - top, Math.max(8, Math.round((yTop - yBot) * scale)));
    const { pixels, dataUrl } = cropThumb(bitmap, imgW, left, top, w, h);
    const guess = classify(pixels, w, h);
    extracted.push({
      day: col.day,
      date: `${opts.month}-${String(col.day).padStart(2, "0")}`,
      code: guess.code,
      label: guess.label,
      confidence: guess.confidence,
      thumb: dataUrl,
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
