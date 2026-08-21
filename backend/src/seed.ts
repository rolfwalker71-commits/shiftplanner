import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db.js";
import { generateShiftIllustration } from "./lib/images.js";

const defaults = [
  {
    code: "F2",
    name: "Frühdienst 2",
    startTime: "06:30",
    endTime: "15:00",
    breakMinutes: 30,
    allDay: false,
    color: "#E8A87C",
    description:
      "Frühstücksservice im Spital-Restaurant: Kaffee, Gipfeli, Tabletts an die Tische.",
    showCodeInImage: true,
  },
  {
    code: "S1",
    name: "Spätdienst",
    startTime: "14:00",
    endTime: "22:00",
    breakMinutes: 30,
    allDay: false,
    color: "#C4B5E8",
    description: "Abendessen im Speisesaal, Teller service, gedeckte Tische.",
    showCodeInImage: true,
  },
  {
    code: "N",
    name: "Nachtdienst",
    startTime: "22:00",
    endTime: "06:00",
    breakMinutes: 30,
    allDay: false,
    color: "#8FA8D8",
    description: "Restaurant schliessen, Tassen stapeln, ruhiger Spätbetrieb.",
    showCodeInImage: true,
  },
  {
    code: "U",
    name: "Urlaub",
    startTime: null,
    endTime: null,
    breakMinutes: 0,
    allDay: true,
    color: "#7DCEA0",
    description: "Ferien, nicht im Dienst.",
    showCodeInImage: false,
  },
  {
    code: "Frei",
    name: "dienstfrei",
    startTime: null,
    endTime: null,
    breakMinutes: 0,
    allDay: true,
    color: "#E8D48A",
    description: "Freier Tag zu Hause.",
    showCodeInImage: false,
  },
];

const here = dirname(fileURLToPath(import.meta.url));
await mkdir(resolve(here, "../data"), { recursive: true });

const user = await prisma.user.upsert({
  where: { email: "demo@local" },
  update: {},
  create: { email: "demo@local", name: "Lokal" },
});

let order = 0;
for (const d of defaults) {
  const existing = await prisma.shiftType.findFirst({
    where: { userId: user.id, code: d.code },
  });
  const type =
    existing ??
    (await prisma.shiftType.create({
      data: { ...d, userId: user.id, sortOrder: order },
    }));
  order += 1;
  if (!type.imagePath) {
    try {
      const { path } = await generateShiftIllustration(type.id, type);
      await prisma.shiftType.update({
        where: { id: type.id },
        data: { imagePath: path },
      });
    } catch (err) {
      console.warn("Kein Bild für", type.code, err);
    }
  }
}

console.log("Seed fertig für", user.email);
await prisma.$disconnect();
