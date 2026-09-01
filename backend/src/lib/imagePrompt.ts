export type PromptInput = {
  code: string;
  name: string;
  description?: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  showCodeInImage?: boolean;
};

const IDENTITY = `CHARACTER — the first attached image is Valentyna’s portrait. Every new picture must be HER, translated into clay, not a new woman and not a photo.

Keep from the portrait:
- the same wide joyful smile and bright teeth
- dark brown eyes that smile with her
- thin arched brows, full cheeks, peach blush
- honey / light-brown shoulder-length hair, tucked behind the ears
- the same friendly, open face

Sculpt that likeness in clay. Do not age her, slim her, change her haircut, or make her photoreal.`;

const STYLE = `ART STYLE — match the second attached image (the cozy clay-3D Frei illustration).

Premium 3D claymorphism, like a high-end app icon:
- smooth matte plasticine / clay, chunky rounded forms, no sharp edges
- thick sculpted hair, toy-like clothes with soft folds, gentle studio light
- warm cozy palette, soft shadows, octane-quality lighting but clay materials
- square composition, face large and readable, half-body or close portrait
- no watermark, no UI chrome, no photoreal skin, no Pixar caricature, no anime

The result should look as polished and tactile as that Frei picture.`;

const BADGE = `On work scenes she wears a small rectangular name badge on the blouse or apron. Two centered lines only: first line "Kantonspital Uri", second line "Valentyna".`;

const JOB = `She works in Gästebetreuung at Kantonspital Uri: restaurant/cafeteria service AND tray delivery to patient rooms (Zimmerservice). NOT a nurse or clinician. No scrubs, stethoscope, medical cross, hospital bed close-up, IV or clinical tools. Uniform: cream/white blouse, colored apron matching the mood. ${BADGE} Her face stays the hero of the frame even when she holds a tray.`;

function timeOfDayHint(start?: string | null, allDay?: boolean) {
  if (allDay) {
    return "off-duty, not at the hospital: cozy home clothes like a chunky knit, leisure lighting, relaxed expression — same clay quality as the Frei reference";
  }
  const h = Number((start ?? "08:00").slice(0, 2));
  if (h >= 5 && h < 11) {
    return "DEFAULT SCENE if the user did not specify otherwise: breakfast in the Speisesaal. Strong cool-gold sunrise through large windows, steam from coffee, high-energy wide-awake expression, peach-gold light. Distinct morning mood — not lunch, not evening.";
  }
  if (h >= 11 && h < 14) {
    return "DEFAULT SCENE if the user did not specify otherwise: busy lunch Speisesaal, many tables, clatter, bright overhead noon light, slightly flushed from the rush, professional smile. Distinct midday mood.";
  }
  if (h >= 14 && h < 18) {
    return "DEFAULT SCENE if the user did not specify otherwise: afternoon ZIMMERSERVICE — walking a quiet hospital corridor with a covered meal tray toward a patient room door, soft indoor daylight, calmer expression. Not the restaurant.";
  }
  if (h >= 18 && h < 22) {
    return "DEFAULT SCENE if the user did not specify otherwise: evening tray delivery INTO a patient room, overbed table, warm amber lamp light, dusk in the window, kinder tired smile. Not the busy lunch hall.";
  }
  return "DEFAULT SCENE if the user did not specify otherwise: late-night last round in a dim corridor, blue moonlight, stacked empty cups, sleepy gentle smile, very quiet. Not daytime restaurant.";
}

export function buildIllustrationPrompt(input: PromptInput) {
  const setting = timeOfDayHint(input.startTime, input.allDay);
  const userScene = input.description?.trim();
  const extra = userScene
    ? `USER SCENE DIRECTION (highest priority — override the default location, lighting and props): ${userScene}. Change the environment to match these words. If they mention Zimmer, Station, Gang or Lieferung, show room/corridor delivery, not the restaurant. If they mention Speisesaal or Restaurant, show the dining room.`
    : "No extra user scene text — follow the default scene for this time of day.";
  const hours =
    input.allDay || !input.startTime
      ? "all-day / off-duty"
      : `${input.startTime}–${input.endTime ?? ""}`;
  const code = input.allDay
    ? "Do not include any text, letters, numbers, logos, name badges or watermarks in the image."
    : input.showCodeInImage
      ? `Integrate the shift code "${input.code}" as large soft clay letters in the background, decorative, readable, not a sticker or UI label. The only other text in the image is the name badge.`
      : `The only text in the image is the name badge with exactly two lines: "Kantonspital Uri" and "Valentyna". No other letters, numbers, logos or watermarks.`;

  return [
    IDENTITY,
    STYLE,
    input.allDay
      ? "Off-duty scene: no work uniform and no name badge. Same Valentyna as in the portrait, in the Frei clay-3D look."
      : JOB,
    `Shift "${input.code}" (${input.name}), ${hours}.`,
    `Mood and setting: ${setting}.`,
    extra,
    "Always keep her face clearly visible in the foreground.",
    code,
  ]
    .filter(Boolean)
    .join("\n\n");
}
