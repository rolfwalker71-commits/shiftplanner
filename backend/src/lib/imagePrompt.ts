export type PromptInput = {
  code: string;
  name: string;
  description?: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  showCodeInImage?: boolean;
};

const IDENTITY = `CHARACTER — the attached portrait is Valentyna. Copy her FACE GEOMETRY exactly. This is a likeness job, not a cute mascot.

From the portrait, keep:
- an adult oval face, natural width, visible jaw and chin — NOT a circle
- normal cheek volume like the photo — NOT swollen, puffy, bloated, chipmunk, or baby-fat
- the same wide smile and teeth, but do not inflate the cheeks around it
- dark brown eyes, thin arched brows, hair tucked behind the ears
- honey / light-brown shoulder-length hair

Forbidden: oversized head, balloon cheeks, spherical skull, toddler proportions, extra-wide grin that stretches the face. If clay style and likeness conflict, LIKENESS WINS.`;

const STYLE = `ART STYLE — cozy premium 3D claymorphism like a polished app illustration (matte plasticine, soft studio light, warm palette).

Apply chunky rounded clay ONLY to clothes, furniture, props and hair strands.
Do NOT apply chunky/round stylization to her skull, cheeks, nose or jaw.
No photoreal skin, no glossy plastic face, no Pixar caricature, no anime.
Square composition, face large and readable, half-body. No watermark, no UI chrome.`;

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
      ? "Off-duty scene: no work uniform and no name badge. Same facial proportions as the portrait, clay materials only."
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
