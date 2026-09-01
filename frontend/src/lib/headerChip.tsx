import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type HeaderChipState = {
  label: string | null;
  onPrev?: () => void;
  onNext?: () => void;
};

const HeaderChipContext = createContext<{
  chip: HeaderChipState;
  setChip: (next: HeaderChipState) => void;
} | null>(null);

export function HeaderChipProvider({ children }: { children: ReactNode }) {
  const [chip, setChip] = useState<HeaderChipState>({ label: null });
  return <HeaderChipContext.Provider value={{ chip, setChip }}>{children}</HeaderChipContext.Provider>;
}

export function useHeaderChipState() {
  const ctx = useContext(HeaderChipContext);
  if (!ctx) throw new Error("HeaderChipProvider missing");
  return ctx;
}

export function useHeaderChip(label: string | null, nav?: { onPrev?: () => void; onNext?: () => void }) {
  const ctx = useContext(HeaderChipContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setChip({ label, onPrev: nav?.onPrev, onNext: nav?.onNext });
    return () => ctx.setChip({ label: null });
  }, [ctx, label, nav?.onPrev, nav?.onNext]);
}
