import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Status } from "../types";
import { disablePush, enablePush, pushSupported } from "../lib/push";
import { readChromePref, writeChromePref, type ChromePref } from "../lib/chrome";
import { useChrome } from "../hooks/useChrome";

const looks: { value: ChromePref; label: string }[] = [
  { value: "auto", label: "Automatisch" },
  { value: "ios", label: "Liquid Glass" },
  { value: "android", label: "Material" },
  { value: "desktop", label: "Fluent" },
];

export function SettingsPage({
  status,
  onChange,
}: {
  status: Status;
  onChange: () => void;
}) {
  const [cals, setCals] = useState<{ id: string; summary: string }[]>([]);
  const [selected, setSelected] = useState(status.user?.selectedCalendarId ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [look, setLook] = useState<ChromePref>(() => readChromePref());
  useChrome();

  useEffect(() => {
    api
      .calendars()
      .then((r) => {
        setCals(r.items);
        if (r.selectedCalendarId) setSelected(r.selectedCalendarId);
      })
      .catch(() => setCals([]));
    api
      .pushStatus()
      .then((s) => setPushOn(s.subscribed))
      .catch(() => setPushOn(false));
  }, []);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-[1.25rem] font-semibold">Einstellungen</h1>
      <section className="surface rounded-2xl p-4">
        <h2 className="font-medium">Darstellung</h2>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted">
          Automatisch: Liquid Glass auf iPhone und iPad, sonst Material bzw. Fluent. Hell und dunkel folgen dem System.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1 sm:grid-cols-4" role="radiogroup" aria-label="Darstellung">
          {looks.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={look === l.value}
              className={`h-10 rounded-xl px-2 text-[0.8125rem] ${look === l.value ? "seg-on" : "text-muted"}`}
              onClick={() => {
                writeChromePref(l.value);
                setLook(l.value);
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>
      <section className="surface rounded-2xl p-4">
        <h2 className="font-medium">Widgets</h2>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted">
          Nächste Schicht, Woche oder Monat auf dem Home- und Sperrbildschirm von iPhone und iPad – über Scriptable.
        </p>
        <Link to="/app/widgets" className="btn-primary mt-3 inline-flex h-11 items-center rounded-full px-4">
          Widgets einrichten
        </Link>
      </section>
      <section className="surface rounded-2xl p-4">
        <h2 className="font-medium">Erinnerung am Vortag</h2>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted">
          Am Tag vor der Schicht um 18:00 Uhr kommt eine Nachricht mit Bild und Arbeitszeit.
          Auf dem iPhone zuerst zum Home-Bildschirm hinzufügen.
        </p>
        {!pushSupported() ? (
          <p className="mt-3 text-[0.875rem] leading-snug text-muted">
            Dieser Browser kann keine Push-Nachrichten.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-full btn-primary px-4 disabled:opacity-50"
              disabled={pushBusy}
              onClick={async () => {
                setPushBusy(true);
                setPushError(null);
                try {
                  if (pushOn) {
                    await disablePush();
                    setPushOn(false);
                    setMsg("Erinnerungen aus");
                  } else {
                    await enablePush();
                    setPushOn(true);
                    setMsg("Erinnerungen an");
                  }
                } catch (err) {
                  setPushError(err instanceof Error ? err.message : "Fehler");
                } finally {
                  setPushBusy(false);
                }
              }}
            >
              {pushOn ? "Erinnerungen aus" : "Erinnerungen aktivieren"}
            </button>
            {pushOn ? (
              <button
                type="button"
                className="inline-flex h-11 items-center rounded-full btn-secondary px-4 disabled:opacity-50"
                disabled={pushBusy}
                onClick={async () => {
                  setPushBusy(true);
                  setPushError(null);
                  try {
                    await api.pushTest();
                    setMsg("Probe gesendet");
                  } catch (err) {
                    setPushError(err instanceof Error ? err.message : "Fehler");
                  } finally {
                    setPushBusy(false);
                  }
                }}
              >
                Probe senden
              </button>
            ) : null}
          </div>
        )}
        {pushError ? (
          <p className="mt-2 text-[0.8125rem] leading-snug text-ink" role="alert">
            {pushError}
          </p>
        ) : null}
        {msg ? <p className="mt-2 text-[0.8125rem] leading-snug text-muted">{msg}</p> : null}
      </section>
      <section className="surface rounded-2xl p-4">
        <h2 className="font-medium">Dienstplan einlesen</h2>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted">
          Monats-PDF hochladen, jeden erkannten Tag prüfen und dann übernehmen.
        </p>
        <Link to="/app/import" className="mt-3 inline-flex h-11 items-center rounded-full btn-primary px-4">
          Zum Import
        </Link>
      </section>
      <section className="surface rounded-2xl p-4">
        <h2 className="font-medium">Google-Konto</h2>
        <p className="mt-1 text-[0.875rem] text-muted">
          {status.user?.googleConnected
            ? `Verbunden als ${status.user.email}. Wenn das Bild nicht am Event hängt: erneut „Mit Google verbinden“, damit der Drive-Anhang erlaubt ist.`
            : status.googleConfigured
              ? "Noch nicht mit Google verbunden."
              : "Google OAuth ist nicht konfiguriert. Du kannst lokal planen; Events werden nicht synchronisiert."}
        </p>
        {status.googleConfigured ? (
          <a href="/api/auth/google" className="mt-3 inline-flex h-11 items-center rounded-full btn-primary px-4">
            {status.user?.googleConnected ? "Google-Rechte aktualisieren" : "Mit Google verbinden"}
          </a>
        ) : null}
      </section>
      <section className="surface rounded-2xl p-4">
        <h2 className="font-medium">Zielkalender</h2>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted">
          Neue und verschobene Schichten werden sofort in diesem Kalender angelegt oder verschoben.
          Gelöschte Schichten verschwinden dort ebenfalls. Das Clay-Bild hängt Google als Anhang
          am Event — in der Monatsansicht kann Google keine eigenen Kachelbilder zeigen.
        </p>
        <select
          className="mt-3 h-11 w-full rounded-xl bg-canvas px-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={!cals.length}
        >
          <option value="">Kein Kalender</option>
          {cals.map((c) => (
            <option key={c.id} value={c.id}>
              {c.summary}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="mt-3 h-11 rounded-full btn-primary px-4 disabled:opacity-50"
          disabled={!selected}
          onClick={async () => {
            await api.saveSettings({ selectedCalendarId: selected });
            setMsg("Gespeichert");
            onChange();
          }}
        >
          Speichern
        </button>
        {msg ? <p className="mt-2 text-[0.8125rem] text-muted">{msg}</p> : null}
      </section>
    </div>
  );
}
