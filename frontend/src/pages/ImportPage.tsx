import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { api, type ImportPreview } from "../api";
import type { ShiftType, Status } from "../types";
import { listDayLabel } from "../lib/dates";

function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ImportPage() {
  const { status } = useOutletContext<{ status: Status }>();
  const [month, setMonth] = useState(defaultMonth);
  const [person, setPerson] = useState(status.user?.name || "Valentyna Landis");
  const [file, setFile] = useState<File | null>(null);
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api.shiftTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  const assigned = useMemo(
    () => (preview?.days ?? []).filter((d) => picks[d.date]).length,
    [preview, picks],
  );

  async function readPlan() {
    if (!file) {
      setError("Bitte zuerst die PDF wählen.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const data = await api.previewImport(file, month, person);
      setPreview(data);
      const next: Record<string, string> = {};
      for (const day of data.days) {
        if (day.shiftTypeId) next[day.date] = day.shiftTypeId;
      }
      setPicks(next);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Einlesen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function createMissing() {
    if (!preview?.missing.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.ensureImportTypes(preview.missing);
      setTypes(res.types);
      setPicks((cur) => {
        const next = { ...cur };
        for (const day of preview.days) {
          if (next[day.date] || !day.code) continue;
          const hit = res.types.find((t) => t.code.toLowerCase() === day.code!.toLowerCase());
          if (hit) next[day.date] = hit.id;
        }
        return next;
      });
      setPreview({ ...preview, missing: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    const days = preview.days
      .map((d) => ({ date: d.date, shiftTypeId: picks[d.date] }))
      .filter((d) => d.shiftTypeId);
    if (!days.length) {
      setError("Kein Tag ist einer Schichtart zugeordnet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.commitImport(days);
      setDone(`${res.count} Tage übernommen. Alle bisherigen Schichten in diesem Monat wurden ersetzt.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-[1.25rem] font-bold leading-snug">Dienstplan einlesen</h1>
      <p className="text-[0.875rem] leading-snug text-muted">
        PDF vom Monatsanfang hochladen. Die ganze Zeile wird per Bild-KI gelesen
        (S2, S4, F2, Punkt = frei, Palme = Ferien). Danach siehst du jeden Tag
        mit einem größeren Ausschnitt. Falsch gelesenes korrigierst du im Dropdown.
        Ein erneuter Import ersetzt den ganzen Monat — nichts bleibt doppelt.
      </p>

      <section className="surface rounded-2xl p-4">
        <label className="block text-[0.875rem] font-medium">
          Monat
          <input
            type="month"
            className="mt-1 h-11 w-full rounded-xl bg-canvas px-3"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-[0.875rem] font-medium">
          Name im Plan
          <input
            className="mt-1 h-11 w-full rounded-xl bg-canvas px-3"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-[0.875rem] font-medium">
          PDF
          <input
            type="file"
            accept="application/pdf"
            className="mt-1 w-full text-[0.875rem]"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-full btn-primary px-4 disabled:opacity-50"
          disabled={busy}
          onClick={readPlan}
        >
          <Upload className="size-4" />
          {busy ? "Liest…" : "Plan lesen"}
        </button>
      </section>

      {error ? <p className="text-[0.875rem] leading-snug text-red-600 dark:text-red-400">{error}</p> : null}
      {done ? <p className="text-[0.875rem] leading-snug text-muted">{done}</p> : null}

      {preview ? (
        <>
          <p className="text-[0.875rem] leading-snug text-muted">
            Zeile <strong>{preview.person}</strong>
            {preview.monthHint ? ` · Kopf: ${preview.monthHint}` : ""}.
            {" "}{assigned} von {preview.days.length} Tagen zugeordnet.
          </p>

          {preview.missing.length ? (
            <div className="surface rounded-2xl p-4">
              <p className="text-[0.875rem] leading-snug">
                Diese Codes gibt es lokal noch nicht: <strong>{preview.missing.join(", ")}</strong>
              </p>
              <button
                type="button"
                className="mt-3 h-11 rounded-full btn-secondary px-4 disabled:opacity-50"
                disabled={busy}
                onClick={createMissing}
              >
                Fehlende Codes anlegen
              </button>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {preview.days.map((day) => (
              <li key={day.date} className="flex items-center gap-3 surface rounded-2xl p-3">
                <img
                  src={day.thumb}
                  alt={day.label}
                  className="h-16 w-[4.5rem] shrink-0 rounded-lg bg-canvas object-contain ring-1 ring-line"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{listDayLabel(day.date)}</p>
                  <p className="text-[0.8125rem] leading-snug text-muted">
                    erkannt: {day.code ?? "—"} · {day.label}
                  </p>
                  <select
                    className="mt-1 h-11 w-full rounded-xl bg-canvas px-3"
                    value={picks[day.date] ?? ""}
                    onChange={(e) => setPicks((cur) => ({ ...cur, [day.date]: e.target.value }))}
                    aria-label={`Schichtart für ${listDayLabel(day.date)}`}
                  >
                    <option value="">Nicht importieren</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="h-11 rounded-full btn-primary px-4 disabled:opacity-50"
            disabled={busy || assigned === 0}
            onClick={commit}
          >
            {assigned} Tage so importieren
          </button>
        </>
      ) : null}
    </div>
  );
}
