import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Status } from "../types";
import { api } from "../api";
import { useChrome } from "../hooks/useChrome";
import { panelClass } from "../lib/platform";

const errors: Record<string, string> = {
  oauth:
    "Die Google-Anmeldung ist fehlgeschlagen. Prüfe in der Google Cloud Console, ob die Redirect-URI zur aktuellen Adresse passt.",
  forbidden: "Dieses Konto ist nicht freigegeben.",
};

function serverHost(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function LoginPage({
  status,
  onLogin,
}: {
  status: Status;
  onLogin: () => void;
}) {
  const [params] = useSearchParams();
  const error = errors[params.get("error") ?? ""];
  const chrome = useChrome();
  const round = chrome === "desktop" ? "rounded-md" : "rounded-full";
  const field = chrome === "desktop" ? "rounded-md" : "rounded-xl";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [caldavError, setCaldavError] = useState<string | null>(null);
  const host = serverHost(status.caldavServerUrl);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className={`w-full max-w-md p-8 ${panelClass(chrome)}`}>
        <img src="/logo.png" alt="" className="mb-4 size-12" />
        <h1 className="text-[1.875rem] font-bold leading-snug tracking-tight">Arbeitsplan</h1>
        <p className="mt-2 text-[0.95rem] leading-snug text-muted">
          Persönliche Schichtplanung mit Kalender-Sync — Gästebetreuung, Service und
          Restaurant im Spital.
        </p>
        {error || caldavError ? (
          <p className="mt-4 rounded-xl bg-canvas px-3 py-2 text-[0.875rem] leading-snug text-ink" role="alert">
            {caldavError ?? error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          {status.caldavLoginConfigured ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setCaldavError(null);
                try {
                  await api.caldavLogin(username.trim(), password);
                  onLogin();
                } catch (err) {
                  setCaldavError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="text-[0.8125rem]">
                Benutzername
                <input
                  className={`mt-1 h-11 w-full ${field} bg-canvas px-3`}
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="name@beispiel.ch"
                  required
                />
              </label>
              <label className="text-[0.8125rem]">
                App-Passwort
                <input
                  className={`mt-1 h-11 w-full ${field} bg-canvas px-3`}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className={`btn-primary flex h-12 items-center justify-center ${round} disabled:opacity-50`}
                disabled={busy || !username.trim() || !password}
              >
                {busy ? "Anmelden …" : host ? `Mit Kalenderkonto anmelden (${host})` : "Mit Kalenderkonto anmelden"}
              </button>
            </form>
          ) : null}
          {status.googleConfigured ? (
            <a
              href="/api/auth/google"
              className={`flex h-12 items-center justify-center ${round} ${
                status.caldavLoginConfigured ? "btn-secondary" : "btn-primary"
              }`}
            >
              Mit Google anmelden
            </a>
          ) : null}
          {!status.googleConfigured && !status.caldavLoginConfigured && !status.demoMode ? (
            <p className="text-[0.875rem] leading-snug text-muted">
              Noch keine Anmeldung eingerichtet (CALDAV_SERVER_URL oder Google OAuth).
            </p>
          ) : null}
          {status.demoMode ? (
            <button
              type="button"
              className={`flex h-12 items-center justify-center ${round} ${
                chrome === "android" ? "bg-secondary text-primary" : "btn-secondary"
              }`}
              onClick={async () => {
                await api.demoLogin();
                onLogin();
              }}
            >
              Lokal starten
            </button>
          ) : null}
        </div>
        <p className="mt-4 text-[0.75rem] leading-snug text-muted">
          Self-hosted · PWA · nur freigegebene Konten
        </p>
      </div>
    </div>
  );
}
