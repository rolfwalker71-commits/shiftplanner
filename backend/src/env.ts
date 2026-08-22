import { z } from "zod";

const schema = z.object({
  APP_URL: z.string().default("http://localhost:5173"),
  API_PORT: z.coerce.number().default(3001),
  SESSION_SECRET: z.string().min(16).default("dev-only-change-me-please!!"),
  DEMO_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  DATABASE_URL: z.string().default("file:../data/schichtklar.db"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default("http://localhost:3001/api/auth/google/callback"),
  ALLOWED_EMAILS: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-1"),
  OPENAI_VISION_MODEL: z.string().default("gpt-4o"),
  TZ: z.string().default("Europe/Zurich"),
  NOTIFY_HOUR: z.coerce.number().int().min(0).max(23).default(18),
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
});

export const env = schema.parse(process.env);

export const googleConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);
export const openaiConfigured = Boolean(env.OPENAI_API_KEY);

export const allowedEmails = env.ALLOWED_EMAILS.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isEmailAllowed(email: string) {
  if (allowedEmails.length === 0) return true;
  return allowedEmails.includes(email.trim().toLowerCase());
}
