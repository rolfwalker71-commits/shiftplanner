const cards = [
  {
    title: "Schichtarten selbst definieren",
    text: "Code (F2, S1, N…), Start, Ende und Pause sind frei. Netto-Stunden rechnet die App.",
  },
  {
    title: "Auf den Kalender ziehen",
    text: "Schichtart aus der Leiste auf einen Tag legen. Bestehende Schichten zwischen Tagen verschieben. Optionstaste = duplizieren.",
  },
  {
    title: "Google Kalender",
    text: "Nach dem Verbinden erscheint jedes Ablegen oder Verschieben sofort im gewählten Workspace-Kalender.",
  },
  {
    title: "KI-Illustration",
    text: "Clay-3D nur für die Schichtbilder, Gesicht laut Referenzfoto. Der Code im Hintergrund ist optional.",
  },
  {
    title: "Szene und Stimmung",
    text: "Die Bildbeschreibung steuert Ort und Licht: z. B. „Tablett ins Zimmer, Abendlicht“ oder „voller Speisesaal“. Ohne Text: Morgen Speisesaal, Nachmittag Gang/Zimmer, Abend Zimmerservice.",
  },
  {
    title: "PWA",
    text: "Zum Home-Bildschirm hinzufügen. Der Kalender bleibt als App nutzbar.",
  },
  {
    title: "Nachtdienst",
    text: "Endet die Zeit vor dem Start (z. B. 22:00–06:00), legt der Sync das Event über Mitternacht.",
  },
];

export function HelpPage() {
  return (
    <div>
      <h1 className="mb-1 text-[1.25rem] font-semibold">Hilfe & Tipps</h1>
      <p className="mb-4 text-[0.875rem] text-muted">
        Kurztour für die Planung im Spital-Service.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <article key={c.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
            <h2 className="text-[1rem] font-semibold leading-snug">{c.title}</h2>
            <p className="mt-2 text-[0.875rem] leading-snug text-muted">{c.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
