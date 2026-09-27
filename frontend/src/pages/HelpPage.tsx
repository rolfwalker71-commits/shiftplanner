import { useChrome } from "../hooks/useChrome";
import { panelClass } from "../lib/platform";

const cards = [
  {
    title: "Schichtarten selbst definieren",
    text: "Code (F2, S1, N…), Start, Ende und Pause sind frei. Netto-Stunden rechnet die App.",
  },
  {
    title: "Auf den Kalender ziehen",
    text: "Am Computer: Schichtart auf einen Tag ziehen. Handy: unter Einteilen die Art antippen, dann den Tag. Woche wischen. Löschen mit ×.",
  },
  {
    title: "Kalender-Sync (CalDAV oder Google)",
    text: "Sofort beim Ablegen, Verschieben oder Löschen — wenn ein Kalenderkonto verbunden und ein Zielkalender gewählt ist. CalDAV funktioniert mit iCloud, Infomaniak, Nextcloud, Fastmail, mailbox.org und anderen; dort hängt das Clay-Bild als Link am Event. Bei Google kommt es als Drive-Anhang mit.",
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
    title: "Handy und PWA",
    text: "Unten: Tag, Woche, Monat, Einteilen, Konto. Woche wischen, unter Einteilen Schicht antippen, Konto für Import und Kalender. Zum Home-Bildschirm hinzufügen.",
  },
  {
    title: "Widgets für iPhone und iPad",
    text: "Unter Einstellungen › Widgets Grösse und Layout wählen, Skript kopieren und in der App Scriptable einfügen. Danach auf dem Home- oder Sperrbildschirm ein Scriptable-Widget hinzufügen. Änderungen in der App gelten sofort.",
  },
  {
    title: "Nachtdienst",
    text: "Endet die Zeit vor dem Start (z. B. 22:00–06:00), legt der Sync das Event über Mitternacht.",
  },
  {
    title: "Dienstplan einlesen",
    text: "Unter Konto die PDF hochladen und den Monat wählen. Jeder Tag erscheint mit dem erkannten Zeichen. Punkte und X sind frei, die Palme ist Ferien. Falsch gelesenes korrigierst du im Dropdown. Ein erneuter Import ersetzt den ganzen Monat.",
  },
];

export function HelpPage() {
  const chrome = useChrome();
  return (
    <div>
      <h1 className="mb-1 text-[1.25rem] font-semibold">Hilfe & Tipps</h1>
      <p className="mb-4 text-[0.875rem] text-muted">
        Kurztour für die Planung im Spital-Service.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <article key={c.title} className={`p-4 ${panelClass(chrome)}`}>
            <h2 className="text-[1rem] font-semibold leading-snug">{c.title}</h2>
            <p className="mt-2 text-[0.875rem] leading-snug text-muted">{c.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
