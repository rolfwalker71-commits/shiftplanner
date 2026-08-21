const cards = [
  {
    title: "Schichtarten selbst definieren",
    text: "Code (F2, S1, N…), Start, Ende und Pause sind frei. Netto-Stunden rechnet die App.",
  },
  {
    title: "Auf den Kalender ziehen",
    text: "Neue Schicht aus der Leiste auf einen Tag ziehen. Zum Verschieben die Schicht auf einen anderen Tag ziehen. Löschen: die ×-Taste neben dem Code (F2, Frei…). Optionstaste beim Ablegen = duplizieren.",
  },
  {
    title: "Google Kalender",
    text: "Sofort beim Ablegen, Verschieben oder Löschen — wenn Google verbunden und ein Zielkalender gewählt ist. Das Clay-Bild wird als Anhang am Event mitgeschickt. Google zeigt es nicht als Kachel im Raster, nur in den Event-Details.",
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
    title: "Erinnerung am Vortag",
    text: "Unter Einstellungen Benachrichtigungen aktivieren. Am Tag vor der Schicht um 18:00 kommt eine Nachricht mit Clay-Bild und Arbeitszeit. iPhone: App zuerst zum Home-Bildschirm hinzufügen, dann erlauben.",
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
