import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const uploadsRoot = resolve(here, "../../uploads");
const thumbsDir = resolve(uploadsRoot, "thumbs");

/** Center-crop to a square and box-filter downscale; keeps us free of native deps. */
function downscale(src: PNG, size: number) {
  const out = new PNG({ width: size, height: size });
  const side = Math.min(src.width, src.height);
  const ox = Math.floor((src.width - side) / 2);
  const oy = Math.floor((src.height - side) / 2);
  const step = side / size;
  for (let y = 0; y < size; y++) {
    const y0 = oy + Math.floor(y * step);
    const y1 = Math.max(y0 + 1, oy + Math.floor((y + 1) * step));
    for (let x = 0; x < size; x++) {
      const x0 = ox + Math.floor(x * step);
      const x1 = Math.max(x0 + 1, ox + Math.floor((x + 1) * step));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4;
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          a += src.data[i + 3];
          n++;
        }
      }
      const o = (y * size + x) * 4;
      out.data[o] = r / n;
      out.data[o + 1] = g / n;
      out.data[o + 2] = b / n;
      out.data[o + 3] = a / n;
    }
  }
  return out;
}

/**
 * Returns the public path of a square thumbnail for an uploaded illustration,
 * rendering it on first use. Falls back to the original on any failure.
 */
export async function thumbPath(imagePath: string | null | undefined, size: number) {
  if (!imagePath || !imagePath.startsWith("/uploads/") || !imagePath.endsWith(".png")) {
    return imagePath ?? null;
  }
  const source = resolve(uploadsRoot, imagePath.slice("/uploads/".length));
  if (!source.startsWith(uploadsRoot) || !existsSync(source)) return imagePath;

  const name = `${basename(source, ".png")}-${size}.png`;
  const target = resolve(thumbsDir, name);
  try {
    const version = Math.floor((await stat(source)).mtimeMs);
    // The version query lets clients that cache by URL notice regenerated illustrations.
    const publicPath = `/uploads/thumbs/${name}?v=${version}`;
    if (existsSync(target) && (await stat(target)).mtimeMs >= version) {
      return publicPath;
    }
    await mkdir(thumbsDir, { recursive: true });
    const png = PNG.sync.read(await readFile(source));
    await writeFile(target, PNG.sync.write(downscale(png, size)));
    return publicPath;
  } catch {
    return imagePath;
  }
}
