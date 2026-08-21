import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { shiftTypeRoutes } from "./routes/shiftTypes.js";
import { shiftRoutes } from "./routes/shifts.js";

const here = dirname(fileURLToPath(import.meta.url));
const uploadsRoot = resolve(here, "../uploads");
const frontendDist = resolve(here, "../../frontend/dist");

await mkdir(uploadsRoot, { recursive: true });
await mkdir(resolve(here, "../data"), { recursive: true });

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.APP_URL,
  credentials: true,
});
await app.register(cookie);

await app.register(staticFiles, {
  root: uploadsRoot,
  prefix: "/uploads/",
  decorateReply: false,
});

await app.register(authRoutes);
await app.register(shiftTypeRoutes);
await app.register(shiftRoutes);

app.get("/api/health", async () => ({ ok: true }));

if (existsSync(frontendDist)) {
  await app.register(staticFiles, {
    root: frontendDist,
    prefix: "/",
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith("/api/") || req.raw.url?.startsWith("/uploads/")) {
      return reply.code(404).send({ error: "Nicht gefunden" });
    }
    return reply.sendFile("index.html");
  });
}

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
