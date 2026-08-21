import type { Status } from "../types";
import { api } from "../api";

export function LoginPage({
  status,
  onLogin,
}: {
  status: Status;
  onLogin: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-line">
        <img src="/logo.svg" alt="" className="mb-4 size-12 rounded-2xl" />
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Schichtklar</h1>
        <p className="mt-2 text-[0.95rem] leading-snug text-muted">
          Persönliche Schichtplanung mit Google Kalender — Gästebetreuung, Service und
          Restaurant im Spital.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {status.googleConfigured ? (
            <a
              href="/api/auth/google"
              className="flex h-11 items-center justify-center rounded-full bg-navy text-white"
            >
              Mit Google anmelden
            </a>
          ) : null}
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
        <p className="mt-4 text-[0.75rem] text-muted">Self-hosted · PWA · Google Workspace</p>
      </div>
    </div>
  );
}
