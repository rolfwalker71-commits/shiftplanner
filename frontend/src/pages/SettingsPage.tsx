import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { CalendarProvider, Status } from "../types";
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
  const [calMsg, setCalMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const provider = status.user?.calendarProvider ?? null;
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [look, setLook] = useState<ChromePref>(() => readChromePref());
  useChrome();

  useEffect(() => {
    setCals([]);
    setSelected(status.user?.selectedCalendarId ?? "");
    api
      .calendars()
      .then((r) => {
        setCals(r.items);
        setSelected(r.selectedCalendarId ?? "");
      })
      .catch(() => setCals([]));
  }, [provider, status.user?.caldavUsername, status.user?.caldavServerUrl]);

  useEffect(() => {
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
      <CalendarAccountSection status={status} onChange={onChange} />
      <section className="surface rounded-2xl p-4">
        <h2 className="font-medium">Zielkalender</h2>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted">
          Neue und verschobene Schichten werden sofort in diesem Kalender angelegt oder verschoben.
          Gelöschte Schichten verschwinden dort ebenfalls.{" "}
          {provider === "caldav"
            ? "Das Clay-Bild hängt als Link am Event."
            : "Das Clay-Bild hängt Google als Anhang am Event — in der Monatsansicht kann Google keine eigenen Kachelbilder zeigen."}
        </p>
        <select
          className="mt-3 h-11 w-full rounded-xl bg-canvas px-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={!cals.length}
        >
          <option value="">{provider ? "Kein Kalender" : "Zuerst ein Kalenderkonto verbinden"}</option>
          {cals.map((c) => (
            <option key={c.id} value={c.id}>
              {c.summary}
            </option>
          ))}
        </select>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-11 rounded-full btn-primary px-4 disabled:opacity-50"
            disabled={!selected}
            onClick={async () => {
              await api.saveSettings({ selectedCalendarId: selected });
              setCalMsg("Gespeichert");
              onChange();
            }}
          >
            Speichern
          </button>
          <button
            type="button"
            className="h-11 rounded-full btn-secondary px-4 disabled:opacity-50"
            disabled={!status.user?.selectedCalendarId || syncing}
            onClick={async () => {
              setSyncing(true);
              setCalMsg(null);
              try {
                const r = await api.resyncCalendar();
                setCalMsg(
                  r.total === 0
                    ? "Keine kommenden Schichten"
                    : `${r.synced} von ${r.total} kommenden Schichten im Kalender`,
                );
              } catch (err) {
                setCalMsg(err instanceof Error ? err.message : "Fehler");
              } finally {
                setSyncing(false);
              }
            }}
          >
            {syncing ? "Überträgt …" : "Kommende Schichten übertragen"}
          </button>
        </div>
        <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
          Nach einem Wechsel des Kontos oder Kalenders: legt alle Schichten ab heute im gewählten Kalender an.
        </p>
        {calMsg ? <p className="mt-2 text-[0.8125rem] text-muted">{calMsg}</p> : null}
      </section>
    </div>
  );
}

function hostOf(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function CalendarAccountSection({ status, onChange }: { status: Status; onChange: () => void }) {
  const user = status.user;
  const provider = user?.calendarProvider ?? null;
  const [editing, setEditing] = useState(!user?.caldavConnected);
  const [serverUrl, setServerUrl] = useState(user?.caldavServerUrl ?? status.caldavServerUrl ?? "");
  const [username, setUsername] = useState(user?.caldavUsername ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const both = Boolean(user?.caldavConnected && user?.googleConnected);
  const showGoogle = status.googleConfigured || user?.googleConnected;

  useEffect(() => {
    setEditing(!user?.caldavConnected);
  }, [user?.caldavConnected]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await action();
      setMsg(done);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const providers: { value: CalendarProvider; label: string }[] = [
    { value: "caldav", label: "CalDAV" },
    { value: "google", label: "Google" },
  ];

  return (
    <section className="surface rounded-2xl p-4">
      <h2 className="font-medium">Kalenderkonto</h2>
      <p className="mt-1 text-[0.875rem] leading-snug text-muted">
        CalDAV funktioniert mit Hetzner Webhosting, iCloud, Nextcloud, Infomaniak, Fastmail und anderen.
        Bei Hetzner E-Mail-Adresse und Postfach-Passwort, bei iCloud ein App-Passwort.
      </p>

      {both ? (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1" role="radiogroup" aria-label="Schichten synchronisieren mit">
          {providers.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={provider === p.value}
              disabled={busy}
              className={`h-10 rounded-xl px-2 text-[0.8125rem] ${provider === p.value ? "seg-on" : "text-muted"}`}
              onClick={() =>
                provider === p.value
                  ? undefined
                  : run(() => api.saveSettings({ calendarProvider: p.value }), `Sync mit ${p.label}`)
              }
            >
              Sync mit {p.label}
            </button>
          ))}
        </div>
      ) : null}

      <h3 className="mt-4 text-[0.9375rem] font-medium">CalDAV</h3>
      {user?.caldavConnected && !editing ? (
        <>
          <p className="mt-1 text-[0.875rem] leading-snug text-muted">
            Verbunden als {user.caldavUsername} · {hostOf(user.caldavServerUrl)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-11 items-center rounded-full btn-secondary px-4" onClick={() => setEditing(true)}>
              Zugang ändern
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-full btn-secondary px-4 disabled:opacity-50"
              disabled={busy}
              onClick={() => run(() => api.caldavDisconnect(), "CalDAV getrennt")}
            >
              Trennen
            </button>
          </div>
        </>
      ) : (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.caldavConnect({ serverUrl: serverUrl.trim(), username: username.trim(), password });
              setPassword("");
            }, "CalDAV verbunden — jetzt den Zielkalender wählen");
          }}
        >
          <label className="text-[0.8125rem]">
            Server-Adresse
            <input
              className="mt-1 h-11 w-full rounded-xl bg-canvas px-3"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://webmail.your-server.de"
              required
            />
          </label>
          <p className="text-[0.75rem] leading-snug text-muted">
            Hetzner Webhosting: webmail.your-server.de · iCloud: caldav.icloud.com · Nextcloud: https://host/remote.php/dav
          </p>
          <label className="text-[0.8125rem]">
            Benutzername
            <input
              className="mt-1 h-11 w-full rounded-xl bg-canvas px-3"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="text-[0.8125rem]">
            Passwort
            <input
              className="mt-1 h-11 w-full rounded-xl bg-canvas px-3"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-full btn-primary px-4 disabled:opacity-50"
              disabled={busy || !serverUrl.trim() || !username.trim() || !password}
            >
              {busy ? "Prüft …" : "Verbinden"}
            </button>
            {user?.caldavConnected ? (
              <button type="button" className="inline-flex h-11 items-center rounded-full btn-secondary px-4" onClick={() => setEditing(false)}>
                Abbrechen
              </button>
            ) : null}
          </div>
        </form>
      )}

      {showGoogle ? (
        <>
          <h3 className="mt-4 text-[0.9375rem] font-medium">Google</h3>
          <p className="mt-1 text-[0.875rem] leading-snug text-muted">
            {user?.googleConnected
              ? `Verbunden als ${user.email}. Wenn das Bild nicht am Event hängt: erneut „Mit Google verbinden“, damit der Drive-Anhang erlaubt ist.`
              : "Noch nicht mit Google verbunden."}
          </p>
          {status.googleConfigured ? (
            <a href="/api/auth/google" className="mt-3 inline-flex h-11 items-center rounded-full btn-secondary px-4">
              {user?.googleConnected ? "Google-Rechte aktualisieren" : "Mit Google verbinden"}
            </a>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p className="mt-2 text-[0.8125rem] leading-snug text-ink" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mt-2 text-[0.8125rem] leading-snug text-muted">{msg}</p> : null}
    </section>
  );
}
