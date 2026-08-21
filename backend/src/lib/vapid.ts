import webpush from "web-push";
import { prisma } from "../db.js";
import { env } from "../env.js";

const PUBLIC = "vapidPublic";
const PRIVATE = "vapidPrivate";

export type VapidPair = { publicKey: string; privateKey: string };

export async function getVapidKeys(): Promise<VapidPair> {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  }
  const rows = await prisma.appMeta.findMany({
    where: { key: { in: [PUBLIC, PRIVATE] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (map[PUBLIC] && map[PRIVATE]) {
    return { publicKey: map[PUBLIC], privateKey: map[PRIVATE] };
  }
  const generated = webpush.generateVAPIDKeys();
  await prisma.appMeta.upsert({
    where: { key: PUBLIC },
    update: { value: generated.publicKey },
    create: { key: PUBLIC, value: generated.publicKey },
  });
  await prisma.appMeta.upsert({
    where: { key: PRIVATE },
    update: { value: generated.privateKey },
    create: { key: PRIVATE, value: generated.privateKey },
  });
  return generated;
}

export async function configureWebPush() {
  const keys = await getVapidKeys();
  const subject = env.APP_URL.startsWith("https")
    ? env.APP_URL
    : "mailto:valentyna@valentoys.ch";
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return keys;
}
