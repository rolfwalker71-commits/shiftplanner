import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "./api";
import type { Status } from "./types";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ShiftTypesPage } from "./pages/ShiftTypesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";
import { DayViewPage } from "./pages/DayViewPage";
import { WeekViewPage } from "./pages/WeekViewPage";
import { PlanPage } from "./pages/PlanPage";
import { MonthListPage } from "./pages/MonthListPage";
import { MorePage } from "./pages/MorePage";
import { ImportPage } from "./pages/ImportPage";
import { useChrome } from "./hooks/useChrome";

function HomeEntry() {
  const chrome = useChrome();
  return chrome === "desktop" ? <CalendarPage /> : <Navigate to="/app/woche" replace />;
}

export default function App() {
  useChrome();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted">
        Laden…
      </div>
    );
  }

  const authed = Boolean(status.user);

  return (
    <Routes>
      <Route
        path="/"
        element={authed ? <Navigate to="/app" replace /> : <LoginPage status={status} onLogin={() => api.status().then(setStatus)} />}
      />
      <Route
        path="/app"
        element={authed ? <Layout status={status} onLogout={async () => { await api.logout(); setStatus(await api.status()); }} /> : <Navigate to="/" replace />}
      >
        <Route index element={<HomeEntry />} />
        <Route path="heute" element={<DayViewPage />} />
        <Route path="woche" element={<WeekViewPage />} />
        <Route path="planen" element={<PlanPage />} />
        <Route path="monat" element={<MonthListPage />} />
        <Route path="mehr" element={<MorePage />} />
        <Route path="schichten" element={<ShiftTypesPage />} />
        <Route path="hilfe" element={<HelpPage />} />
        <Route path="einstellungen" element={<SettingsPage status={status} onChange={() => api.status().then(setStatus)} />} />
        <Route path="import" element={<ImportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
