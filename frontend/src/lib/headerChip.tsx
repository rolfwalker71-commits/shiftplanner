import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
  const value = useMemo(() => ({ chip, setChip }), [chip]);
  return <HeaderChipContext.Provider value={value}>{children}</HeaderChipContext.Provider>;
}

export function useHeaderChipState() {
  const ctx = useContext(HeaderChipContext);
  if (!ctx) throw new Error("HeaderChipProvider missing");
  return ctx;
}

export function useHeaderChip(label: string | null, nav?: { onPrev?: () => void; onNext?: () => void }) {
  const setChip = useContext(HeaderChipContext)?.setChip;
  const onPrev = nav?.onPrev;
  const onNext = nav?.onNext;
  useEffect(() => {
    if (!setChip) return;
    setChip({ label, onPrev, onNext });
    return () => setChip({ label: null });
  }, [setChip, label, onPrev, onNext]);
}
