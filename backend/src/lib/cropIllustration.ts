import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

const WHITE = 242;

function isEmpty(data: Buffer, idx: number) {
  const a = data[idx + 3];
  if (a < 20) return true;
  return data[idx] >= WHITE && data[idx + 1] >= WHITE && data[idx + 2] >= WHITE;
}

function cornersEmpty(png: PNG, inset: number) {
  const { width, height, data } = png;
  const pts = [
    [inset, inset],
    [width - 1 - inset, inset],
    [inset, height - 1 - inset],
    [width - 1 - inset, height - 1 - inset],
  ] as const;
  return pts.every(([x, y]) => isEmpty(data, (y * width + x) * 4));
}

export function cropWhiteCorners(buf: Buffer) {
  const png = PNG.sync.read(buf);
  const { width, height } = png;
  if (!cornersEmpty(png, 0)) return null;

  const max = Math.floor(Math.min(width, height) * 0.22);
  let inset = 0;
  while (inset < max && cornersEmpty(png, inset)) inset += 1;
  inset = Math.min(max, inset + 3);
  if (inset < 8) return null;

  const w = width - inset * 2;
  const h = height - inset * 2;
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, inset, inset, w, h, 0, 0);
  return PNG.sync.write(out);
}

export async function cropIllustrationFile(path: string) {
  const original = await readFile(path);
  const cropped = cropWhiteCorners(original);
  if (!cropped) return false;
  await writeFile(path, cropped);
  return true;
}
