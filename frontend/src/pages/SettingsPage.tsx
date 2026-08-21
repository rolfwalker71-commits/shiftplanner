import { useEffect, useState } from "react";
import { api } from "../api";
import type { Status } from "../types";

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

  useEffect(() => {
    api
      .calendars()
      .then((r) => {
        setCals(r.items);
        if (r.selectedCalendarId) setSelected(r.selectedCalendarId);
      })
      .catch(() => setCals([]));
  }, []);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-[1.25rem] font-semibold">Einstellungen</h1>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="font-medium">Google-Konto</h2>
        <p className="mt-1 text-[0.875rem] text-muted">
          {status.user?.googleConnected
            ? `Verbunden als ${status.user.email}`
            : status.googleConfigured
              ? "Noch nicht mit Google verbunden."
              : "Google OAuth ist nicht konfiguriert. Du kannst lokal planen; Events werden nicht synchronisiert."}
        </p>
        {status.googleConfigured && !status.user?.googleConnected ? (
          <a href="/api/auth/google" className="mt-3 inline-flex h-11 items-center rounded-full bg-navy px-4 text-white">
            Mit Google verbinden
          </a>
        ) : null}
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="font-medium">Zielkalender</h2>
        <p className="mt-1 text-[0.875rem] text-muted">
          Neue und verschobene Schichten werden in diesem Kalender aktualisiert.
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
          className="mt-3 h-11 rounded-full bg-navy px-4 text-white disabled:opacity-50"
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
