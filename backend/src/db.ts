import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../data");
mkdirSync(dataDir, { recursive: true });

export const prisma = new PrismaClient();
