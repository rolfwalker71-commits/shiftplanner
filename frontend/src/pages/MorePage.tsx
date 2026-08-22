import { Link, useOutletContext } from "react-router-dom";
import { ClipboardList, HelpCircle, LogOut, Settings, Upload } from "lucide-react";
import type { Status } from "../types";

export function MorePage() {
  const { onLogout } = useOutletContext<{ status: Status; onLogout: () => void }>();
  const items = [
    { to: "/app/schichten", label: "Schichtarten", text: "Codes, Zeiten und Bilder", icon: ClipboardList },
    { to: "/app/import", label: "Dienstplan einlesen", text: "Monats-PDF prüfen und importieren", icon: Upload },
    { to: "/app/hilfe", label: "Hilfe", text: "Kurztour und Tipps", icon: HelpCircle },
    { to: "/app/einstellungen", label: "Einstellungen", text: "Google, Kalender, Erinnerungen", icon: Settings },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h1 className="mb-1 text-[1.25rem] font-bold leading-snug">Mehr</h1>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line"
        >
          <item.icon className="size-5 shrink-0 text-navy" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold leading-snug">{item.label}</span>
            <span className="block text-[0.875rem] leading-snug text-muted">{item.text}</span>
          </span>
          <span className="text-[1.25rem] text-line">›</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 flex min-h-11 items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-line"
      >
        <LogOut className="size-5 shrink-0" />
        <span className="font-bold leading-snug">Abmelden</span>
      </button>
    </div>
  );
}
