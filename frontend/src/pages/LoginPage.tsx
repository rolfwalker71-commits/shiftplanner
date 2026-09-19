import { useSearchParams } from "react-router-dom";
import type { Status } from "../types";
import { api } from "../api";
import { useChrome } from "../hooks/useChrome";
import { panelClass } from "../lib/platform";

const errors: Record<string, string> = {
  oauth:
    "Die Google-Anmeldung ist fehlgeschlagen. Prüfe in der Google Cloud Console, ob die Redirect-URI zur aktuellen Adresse passt.",
  forbidden: "Dieses Google-Konto ist nicht freigegeben.",
};

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

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className={`w-full max-w-md p-8 ${panelClass(chrome)}`}>
        <img src="/logo.png" alt="" className="mb-4 size-12" />
        <h1 className="text-[1.875rem] font-bold leading-snug tracking-tight">Arbeitsplan</h1>
        <p className="mt-2 text-[0.95rem] leading-snug text-muted">
          Persönliche Schichtplanung mit Google Kalender — Gästebetreuung, Service und
          Restaurant im Spital.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl bg-canvas px-3 py-2 text-[0.875rem] leading-snug text-ink" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          {status.googleConfigured ? (
            <a
              href="/api/auth/google"
              className={`btn-primary flex h-12 items-center justify-center ${round}`}
            >
              Mit Google anmelden
            </a>
          ) : (
            <p className="text-[0.875rem] leading-snug text-muted">
              Google-Anmeldung ist noch nicht eingerichtet.
            </p>
          )}
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
          Self-hosted · PWA · nur freigegebene Google-Konten
        </p>
      </div>
    </div>
  );
}
