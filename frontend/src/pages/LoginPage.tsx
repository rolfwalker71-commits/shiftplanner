import { useSearchParams } from "react-router-dom";
import type { Status } from "../types";
import { api } from "../api";

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

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-line">
        <img src="/logo.png" alt="" className="mb-4 size-12" />
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Arbeitsplan</h1>
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
              className="flex h-11 items-center justify-center rounded-full bg-navy text-white"
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
              className="flex h-11 items-center justify-center rounded-full bg-white ring-1 ring-line"
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
