import { mkdir, writeFile, copyFile, readdir } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI, { toFile } from "openai";
import { env, openaiConfigured } from "../env.js";
import { buildIllustrationPrompt, type PromptInput } from "./imagePrompt.js";
import { cropIllustrationFile } from "./cropIllustration.js";

const here = dirname(fileURLToPath(import.meta.url));
export const uploadsDir = resolve(here, "../../uploads/illustrations");
const assetsDir = resolve(here, "../../assets");
const portraitRef = resolve(assetsDir, "character-base.png");
const characterRef = resolve(assetsDir, "valentyna-clay-ref.png");

const PLACEHOLDERS: { test: (input: PromptInput) => boolean; file: string }[] = [
  { test: (i) => /urlaub|^u$/i.test(i.code) || /urlaub/i.test(i.name), file: "clay3d-U.png" },
  { test: (i) => /frei/i.test(i.code) || /frei/i.test(i.name), file: "clay3d-Frei.png" },
  { test: (i) => (i.startTime ? Number(i.startTime.slice(0, 2)) >= 22 || Number(i.startTime.slice(0, 2)) < 5 : false) || /^n/i.test(i.code), file: "clay3d-N-service.png" },
  { test: (i) => (i.startTime ? Number(i.startTime.slice(0, 2)) >= 13 : false) || /^s/i.test(i.code), file: "clay3d-S1-service.png" },
  { test: () => true, file: "clay3d-F2-service.png" },
];

async function saveImageResponse(
  dest: string,
  img: { data?: Array<{ b64_json?: string; url?: string }> },
) {
  const b64 = img.data?.[0]?.b64_json;
  const url = img.data?.[0]?.url;
  if (b64) {
    await writeFile(dest, Buffer.from(b64, "base64"));
    await cropIllustrationFile(dest);
    return;
  }
  if (url) {
    const res = await fetch(url);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    await cropIllustrationFile(dest);
    return;
  }
  throw new Error("Kein Bild von der KI erhalten");
}

async function fileFromPng(path: string, name: string) {
  return toFile(createReadStream(path), name, { type: "image/png" });
}

export async function generateShiftIllustration(id: string, input: PromptInput) {
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${id}.png`;
  const dest = resolve(uploadsDir, filename);
  const prompt = buildIllustrationPrompt(input);

  if (openaiConfigured) {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const model = env.OPENAI_IMAGE_MODEL;
    const portrait = existsSync(portraitRef)
      ? await fileFromPng(portraitRef, "valentyna-portrait.png")
      : existsSync(characterRef)
        ? await fileFromPng(characterRef, "valentyna-clay-ref.png")
        : null;
    const useReference = !model.includes("dall-e") && Boolean(portrait);

    if (useReference && portrait) {
      const img = await client.images.edit({
        model,
        image: portrait,
        prompt,
        size: "1024x1024",
        quality: "high",
        input_fidelity: "high",
      } as Parameters<OpenAI["images"]["edit"]>[0]);
      await saveImageResponse(dest, img);
    } else {
      const img = await client.images.generate({
        model,
        prompt,
        size: "1024x1024",
        n: 1,
        ...(model.includes("dall-e") ? { response_format: "b64_json" as const } : {}),
      });
      await saveImageResponse(dest, img);
    }
  } else {
    const ph = PLACEHOLDERS.find((p) => p.test(input))!.file;
    const src = resolve(assetsDir, ph);
    if (!existsSync(src)) {
      throw new Error("Kein OpenAI-Key und kein Platzhalterbild vorhanden");
    }
    await copyFile(src, dest);
    await cropIllustrationFile(dest);
  }

  return { path: `/uploads/illustrations/${filename}`, prompt };
}

export async function cropStoredIllustrations() {
  await mkdir(uploadsDir, { recursive: true });
  const files = await readdir(uploadsDir);
  for (const name of files) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    await cropIllustrationFile(resolve(uploadsDir, name)).catch(() => undefined);
  }
}
