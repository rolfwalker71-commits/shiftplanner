import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, RotateCcw } from "lucide-react";
import { api } from "../api";
import type { WidgetPayload, WidgetSettings } from "../types";
import { WidgetPreview, type WidgetFamily } from "../components/WidgetPreview";

type SizeTab = "small" | "medium" | "large" | "extraLarge" | "lock";

const TABS: { value: SizeTab; label: string }[] = [
  { value: "small", label: "Klein" },
  { value: "medium", label: "Mittel" },
  { value: "large", label: "Gross" },
  { value: "extraLarge", label: "iPad" },
  { value: "lock", label: "Sperre" },
];

const STYLES: {
  [K in "small" | "medium" | "large" | "extraLarge"]: { value: WidgetSettings[K]; label: string; hint: string }[];
} = {
  small: [
    { value: "next", label: "Nächste Schicht", hint: "Clay-Bild vollflächig mit Code und Zeit der nächsten Arbeitsschicht." },
    { value: "today", label: "Heute", hint: "Was heute ansteht – auch Frei oder Urlaub – mit Hinweis auf die nächste Schicht." },
    { value: "countdown", label: "Countdown", hint: "Wie lange bis zur nächsten Schicht, z. B. „in 14 Std.“" },
  ],
  medium: [
    { value: "twoDays", label: "Heute & Morgen", hint: "Zwei Bildkacheln nebeneinander." },
    { value: "week", label: "Woche", hint: "Sieben Tage als Leiste mit Bild und Code, Stunden der Woche oben rechts." },
  ],
  large: [
    { value: "week", label: "Woche", hint: "Sieben Zeilen mit Bild, Bezeichnung und Arbeitszeit." },
    { value: "twoWeeks", label: "2 Wochen", hint: "Diese und nächste Woche als zwei Bildleisten." },
    { value: "month", label: "Monat", hint: "Kalenderraster des Monats mit farbigen Codes." },
  ],
  extraLarge: [
    { value: "week", label: "Woche", hint: "Nur iPad: sieben grosse Bildkacheln nebeneinander." },
    { value: "month", label: "Monat", hint: "Nur iPad: Monatsraster mit Bildern und Monatsstunden." },
  ],
};

const LOCK_FAMILIES: { family: WidgetFamily; label: string }[] = [
  { family: "accessoryRectangular", label: "Rechteckig" },
  { family: "accessoryCircular", label: "Rund" },
  { family: "accessoryInline", label: "Über der Uhrzeit" },
];

function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section>
      {title ? (
        <h2 className="mb-1.5 px-4 text-[0.75rem] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      ) : null}
      <div className="surface overflow-hidden rounded-2xl">{children}</div>
      {footer ? <p className="mt-1.5 px-4 text-[0.75rem] leading-snug text-muted">{footer}</p> : null}
    </section>
  );
}

function Row({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <div className={`mx-4 flex min-h-12 items-center gap-3 py-2 ${last ? "" : "border-b border-line"}`}>{children}</div>
  );
}

function Toggle({ label, checked, onChange, last }: { label: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <Row last={last}>
      <span className="flex-1 text-[0.95rem]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#34c759]" : "bg-canvas"}`}
      >
        <span
          className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-[left] ${
            checked ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </button>
    </Row>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-canvas p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 flex-1 rounded-[0.6rem] px-1.5 text-[0.8125rem] leading-tight ${
            value === o.value ? "seg-on" : "text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function copyWithTextarea(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Kopieren nicht möglich – unter „Skript anzeigen“ markieren und kopieren");
}

async function copyText(text: string) {
  // navigator.clipboard needs a secure context (https); plain http on the LAN uses the textarea path.
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall back below */
    }
  }
  copyWithTextarea(text);
}

export function WidgetsPage() {
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [data, setData] = useState<WidgetPayload | null>(null);
  const [tab, setTab] = useState<SizeTab>("small");
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const saveTimer = useRef<number | undefined>(undefined);

  async function loadScript() {
    // Fetched up front: iOS only allows clipboard writes directly inside the tap.
    setScript(await api.widgetScript(window.location.origin));
  }

  useEffect(() => {
    api.widgetSettings().then((r) => {
      setSettings(r.settings);
      setTitle(r.settings.title);
    });
    api.widgetPreview().then(setData).catch(() => setData(null));
    loadScript().catch((err) => setMsg(err.message));
  }, []);

  function update(patch: Partial<WidgetSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.saveWidgetSettings(next).catch((err) => setMsg(err.message));
    }, 250);
  }

  if (!settings) return <p className="text-muted">Laden…</p>;

  const styleKey = tab === "lock" ? null : tab;
  const styles = styleKey ? STYLES[styleKey] : null;
  const current = styleKey ? styles!.find((s) => s.value === settings[styleKey]) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 pb-6">
      <div>
        <h1 className="text-[1.5rem] font-bold leading-tight">Widgets</h1>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted">
          Schichten auf dem Home- und Sperrbildschirm von iPhone und iPad – über die kostenlose App Scriptable.
          Alles hier gilt sofort, ohne das Skript neu einzufügen.
        </p>
      </div>

      <section>
        <div className="mb-3 overflow-x-auto hide-scrollbar">
          <Segmented value={tab} options={TABS} onChange={setTab} label="Widget-Grösse" />
        </div>
        <div
          className="relative overflow-hidden rounded-[1.75rem] px-4 py-7"
          style={{
            background:
              tab === "lock"
                ? "radial-gradient(28rem 18rem at 0% 0%, #2b4f9c, transparent 60%), radial-gradient(26rem 18rem at 100% 40%, #7a3b6b, transparent 60%), #141826"
                : "radial-gradient(28rem 18rem at 0% 0%, #7fb0ff, transparent 60%), radial-gradient(26rem 18rem at 100% 30%, #f5b99a, transparent 60%), radial-gradient(28rem 18rem at 40% 110%, #b89cf0, transparent 60%), #c9d4ee",
          }}
        >
          {data ? (
            tab === "lock" ? (
              <div className="flex flex-col items-center gap-5">
                {LOCK_FAMILIES.map((l) => (
                  <div key={l.family} className="flex flex-col items-center gap-1.5">
                    <WidgetPreview family={l.family} data={data} settings={settings} />
                    <span className="text-[0.7rem] font-semibold text-white/85">{l.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <WidgetPreview family={tab} data={data} settings={settings} />
            )
          ) : (
            <p className="text-center text-white">Vorschau nicht verfügbar</p>
          )}
        </div>
        {styles && styleKey ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <Segmented
              value={settings[styleKey] as string}
              options={styles.map((s) => ({ value: s.value as string, label: s.label }))}
              onChange={(v) => update({ [styleKey]: v } as Partial<WidgetSettings>)}
              label="Layout"
            />
            <p className="px-1 text-[0.8125rem] leading-snug text-muted">{current?.hint}</p>
          </div>
        ) : (
          <p className="mt-3 px-1 text-[0.8125rem] leading-snug text-muted">
            Sperrbildschirm: Das Widget passt sich der Form an und zeigt immer die nächste Arbeitsschicht mit Countdown.
          </p>
        )}
      </section>

      <Group title="Name">
        <Row last>
          <input
            className="h-10 w-full bg-transparent text-[0.95rem] outline-none"
            value={title}
            maxLength={30}
            placeholder="Arbeitsplan"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== settings.title && update({ title })}
            aria-label="Name im Widget"
          />
        </Row>
      </Group>

      <Group title="Inhalt">
        <Toggle label="Schichtbilder" checked={settings.showImages} onChange={(v) => update({ showImages: v })} />
        <Toggle label="Arbeitszeiten" checked={settings.showTimes} onChange={(v) => update({ showTimes: v })} />
        <Toggle label="Stunden-Summe" checked={settings.showHours} onChange={(v) => update({ showHours: v })} />
        <Toggle label="Frei & Urlaub anzeigen" checked={settings.showFree} onChange={(v) => update({ showFree: v })} last />
      </Group>

      <Group title="Erscheinung" footer="Automatisch folgt dem Hell- oder Dunkelmodus des Geräts.">
        <div className="p-2">
          <Segmented
            value={settings.theme}
            options={[
              { value: "auto", label: "Automatisch" },
              { value: "light", label: "Hell" },
              { value: "dark", label: "Dunkel" },
            ]}
            onChange={(theme) => update({ theme })}
            label="Erscheinung"
          />
        </div>
      </Group>

      <Group title="Einrichten">
        <ol className="flex flex-col gap-2.5 px-4 py-3 text-[0.875rem] leading-snug">
          <li><strong>1.</strong> Scriptable aus dem App Store laden (kostenlos).</li>
          <li><strong>2.</strong> „Skript kopieren“ tippen, in Scriptable mit <strong>+</strong> ein neues Skript anlegen und einfügen. Oben den Namen auf „Arbeitsplan“ setzen.</li>
          <li><strong>3.</strong> Auf dem Home-Bildschirm lange drücken › <strong>+</strong> › Scriptable › Grösse wählen. Widget antippen, bei „Script“ Arbeitsplan wählen.</li>
          <li><strong>4.</strong> Optional bei „Parameter“ ein anderes Layout pro Widget: <code className="text-[0.8rem]">next</code>, <code className="text-[0.8rem]">today</code>, <code className="text-[0.8rem]">countdown</code>, <code className="text-[0.8rem]">twoDays</code>, <code className="text-[0.8rem]">week</code>, <code className="text-[0.8rem]">twoWeeks</code>, <code className="text-[0.8rem]">month</code>.</li>
        </ol>
      </Group>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn-primary flex h-12 items-center justify-center gap-2 rounded-full disabled:opacity-50"
          disabled={!script}
          onClick={() => {
            if (!script) return;
            copyText(script)
              .then(() => {
                setCopied(true);
                setMsg(null);
                window.setTimeout(() => setCopied(false), 2500);
              })
              .catch((err) => setMsg(err.message));
          }}
        >
          {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
          {copied ? "Kopiert" : "Skript kopieren"}
        </button>
        <a href="scriptable:///add" className="btn-secondary flex h-12 items-center justify-center gap-2 rounded-full font-semibold text-primary">
          <ExternalLink className="size-4" /> Scriptable öffnen
        </a>
        {msg ? <p className="px-1 text-[0.8125rem] text-red-600 dark:text-red-400" role="alert">{msg}</p> : null}
        {script ? (
          <details className="px-1 text-[0.8125rem] text-muted">
            <summary className="cursor-pointer py-2">Skript anzeigen</summary>
            <textarea
              readOnly
              value={script}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 h-48 w-full rounded-xl bg-canvas p-3 font-mono text-[0.7rem] leading-snug text-ink"
              aria-label="Skript"
            />
          </details>
        ) : null}
      </div>

      <Group
        title="Sicherheit"
        footer="Das Skript enthält einen persönlichen Link. Neu erzeugen, wenn du es jemandem gegeben hast – danach das Skript neu kopieren."
      >
        <button
          type="button"
          className="mx-4 flex min-h-12 w-[calc(100%-2rem)] items-center gap-2 text-left text-[0.95rem] text-red-600 dark:text-red-400"
          onClick={async () => {
            if (!window.confirm("Link neu erzeugen? Bestehende Widgets zeigen danach nichts mehr, bis das Skript neu kopiert ist.")) return;
            await api.rotateWidgetToken();
            await loadScript();
            setMsg(null);
          }}
        >
          <RotateCcw className="size-4" /> Link neu erzeugen
        </button>
      </Group>
    </div>
  );
}
