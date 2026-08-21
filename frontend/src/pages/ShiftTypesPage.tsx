import { useEffect, useState } from "react";
import { Sparkles, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import type { ShiftType } from "../types";
import { TypeMeta } from "../components/ShiftChip";
import { TimeField } from "../components/TimeField";

const COLORS = ["#E8A87C", "#E8B4B8", "#C4B5E8", "#8FA8D8", "#7DCEA0", "#E8D48A", "#C5CCD6"];

const emptyForm = (): Partial<ShiftType> => ({
  code: "",
  name: "",
  startTime: "06:30",
  endTime: "15:00",
  breakMinutes: 30,
  allDay: false,
  color: COLORS[0],
  description: "",
  showCodeInImage: false,
});

export function ShiftTypesPage() {
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [editing, setEditing] = useState<Partial<ShiftType> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);

  async function reload() {
    setTypes(await api.shiftTypes());
  }
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);

  async function save() {
    if (!editing?.code || !editing.name) {
      setError("Code und Bezeichnung sind Pflicht");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        code: editing.code,
        name: editing.name,
        startTime: editing.allDay ? null : editing.startTime,
        endTime: editing.allDay ? null : editing.endTime,
        breakMinutes: Number(editing.breakMinutes ?? 0),
        allDay: Boolean(editing.allDay),
        color: editing.color,
        description: editing.description ?? "",
        showCodeInImage: Boolean(editing.showCodeInImage),
      };
      const saved = editing.id
        ? await api.updateType(editing.id, body)
        : await api.createType(body);
      setEditing(saved);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!editing?.code || !editing.name) {
      setError("Code und Bezeichnung sind Pflicht");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        code: editing.code,
        name: editing.name,
        startTime: editing.allDay ? null : editing.startTime,
        endTime: editing.allDay ? null : editing.endTime,
        breakMinutes: Number(editing.breakMinutes ?? 0),
        allDay: Boolean(editing.allDay),
        color: editing.color,
        description: editing.description ?? "",
        showCodeInImage: Boolean(editing.showCodeInImage),
      };
      const saved = editing.id
        ? await api.updateType(editing.id, body)
        : await api.createType(body);
      const updated = await api.generateImage(saved.id);
      setEditing(updated);
      setPrompt(updated.prompt);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "KI-Bild fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function showPrompt() {
    if (!editing?.code || !editing.name) return;
    const { prompt: p } = await api.previewPrompt({
      code: editing.code,
      name: editing.name,
      startTime: editing.startTime,
      endTime: editing.endTime,
      allDay: editing.allDay,
      description: editing.description,
      showCodeInImage: editing.showCodeInImage,
      breakMinutes: editing.breakMinutes ?? 0,
      color: editing.color ?? COLORS[0],
    });
    setPrompt(p);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.25rem] font-semibold">Schichtarten</h1>
          <p className="text-[0.875rem] text-muted">Codes, Zeiten und Pause selbst festlegen. Das Clay-3D-Bild kommt danach.</p>
        </div>
        <button
          type="button"
          className="flex h-11 items-center gap-2 rounded-full bg-navy px-4 text-white"
          onClick={() => {
            setEditing(emptyForm());
            setPrompt(null);
          }}
        >
          <Plus className="size-4" /> Neue Schichtart
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((t) => (
          <article key={t.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
            <div className="aspect-square bg-canvas">
              {t.imagePath ? (
                <img src={t.imagePath} alt={t.code} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-muted">Noch kein Bild</div>
              )}
            </div>
            <div className="p-3">
              <h2 className="text-[1.05rem] font-semibold">{t.code}</h2>
              <p className="text-[0.875rem]">{t.name}</p>
              <TypeMeta type={t} />
              <div className="mt-3 flex gap-2">
                <button type="button" className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl ring-1 ring-line" onClick={() => { setEditing(t); setPrompt(null); }}>
                  <Pencil className="size-4" /> Bearbeiten
                </button>
                <button type="button" className="grid size-11 place-items-center rounded-xl ring-1 ring-line" onClick={async () => { await api.deleteType(t.id); await reload(); }} aria-label="Löschen">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
          <div className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-[1.15rem] font-semibold">{editing.id ? "Schichtart bearbeiten" : "Neue Schichtart"}</h2>
              <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-canvas" onClick={() => setEditing(null)} aria-label="Schliessen">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <label className="text-[0.8125rem]">
                  Kurztitel (frei)
                  <input className="mt-1 h-11 w-full rounded-xl bg-canvas px-3" value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="z. B. F2, S1, N" />
                </label>
                <label className="text-[0.8125rem]">
                  Bezeichnung
                  <input className="mt-1 h-11 w-full rounded-xl bg-canvas px-3" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Frühdienst 2" />
                </label>
                <label className="flex h-11 items-center gap-2 text-[0.875rem]">
                  <input type="checkbox" checked={Boolean(editing.allDay)} onChange={(e) => setEditing({ ...editing, allDay: e.target.checked })} />
                  Ganztägig
                </label>
                {!editing.allDay && (
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[0.8125rem]">
                      Start
                      <TimeField
                        value={editing.startTime ?? "06:30"}
                        onChange={(startTime) => setEditing({ ...editing, startTime })}
                      />
                    </label>
                    <label className="text-[0.8125rem]">
                      Ende
                      <TimeField
                        value={editing.endTime ?? "15:00"}
                        onChange={(endTime) => setEditing({ ...editing, endTime })}
                      />
                    </label>
                    <label className="text-[0.8125rem]">
                      Pause (Min)
                      <input type="number" min={0} max={240} className="mt-1 h-11 w-full rounded-xl bg-canvas px-2" value={editing.breakMinutes ?? 0} onChange={(e) => setEditing({ ...editing, breakMinutes: Number(e.target.value) })} />
                    </label>
                  </div>
                )}
                <fieldset>
                  <legend className="text-[0.8125rem]">Farbe</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button key={c} type="button" className={`size-8 rounded-full ring-2 ${editing.color === c ? "ring-navy" : "ring-transparent"}`} style={{ background: c }} onClick={() => setEditing({ ...editing, color: c })} aria-label={c} />
                    ))}
                  </div>
                </fieldset>
                <label className="text-[0.8125rem]">
                  Bildbeschreibung — Szene und Stimmung
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-xl bg-canvas px-3 py-2 leading-snug"
                    value={editing.description ?? ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="z. B. Tablett ins Patientenzimmer, Abendlicht · voller Speisesaal, Mittagsandrang · Kaffee auf der Station"
                  />
                  <span className="mt-1 block text-[0.75rem] leading-snug text-muted">
                    Das steuert Ort und Licht, nicht nur das Tablett. Ohne Text nimmt die KI eine Standard-Szene zur Startzeit: Morgen Speisesaal, Nachmittag Gang/Zimmer, Abend Zimmerservice.
                  </span>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-[0.875rem]">
                  <input type="checkbox" checked={Boolean(editing.showCodeInImage)} onChange={(e) => setEditing({ ...editing, showCodeInImage: e.target.checked })} />
                  Schichtcode im KI-Bild anzeigen
                </label>
              </div>
              <div>
                <div className="aspect-square overflow-hidden rounded-2xl bg-canvas ring-1 ring-line">
                  {editing.imagePath ? (
                    <img src={editing.imagePath} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center p-6 text-center text-[0.875rem] text-muted">
                      Erst speichern, dann Illustration erzeugen. Clay-3D nur hier — Gästebetreuung, nicht Pflege.
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-navy px-4 text-white disabled:opacity-50" disabled={busy} onClick={generate}>
                    <Sparkles className="size-4" /> Illustration erzeugen
                  </button>
                  <button type="button" className="h-11 rounded-full px-4 ring-1 ring-line" onClick={showPrompt}>
                    Prompt
                  </button>
                </div>
                {prompt ? (
                  <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-3 text-[0.7rem] leading-snug text-muted">
                    {prompt}
                  </pre>
                ) : null}
              </div>
            </div>
            {error ? <p className="mt-3 text-[0.875rem] text-red-700">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="h-11 rounded-full px-4" onClick={() => setEditing(null)}>Abbrechen</button>
              <button type="button" className="h-11 rounded-full bg-navy px-5 text-white disabled:opacity-50" disabled={busy} onClick={save}>Speichern</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
