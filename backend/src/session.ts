import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";
import { prisma } from "./db.js";

const COOKIE = "schichtklar_session";

function sign(value: string) {
  const mac = createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function verify(token: string | undefined) {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const value = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

export function setSession(reply: FastifyReply, userId: string) {
  reply.setCookie(COOKIE, sign(userId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_URL.startsWith("https"),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: "/" });
}

export async function getUser(req: FastifyRequest) {
  const userId = verify(req.cookies[COOKIE]);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const user = await getUser(req);
  if (!user) {
    reply.code(401).send({ error: "Nicht angemeldet" });
    return null;
  }
  return user;
}
