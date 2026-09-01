import { useEffect, useState } from "react";
import { applyChrome, resolveChrome, type Chrome } from "../lib/chrome";

export function useChrome() {
  const [chrome, setChrome] = useState<Chrome>(() =>
    typeof window === "undefined" ? "android" : resolveChrome("auto", window.innerWidth),
  );

  useEffect(() => {
    const sync = () => {
      const next = resolveChrome("auto", window.innerWidth);
      setChrome(next);
      applyChrome(next);
    };
    sync();
    const mq = window.matchMedia("(min-width: 1024px)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return chrome;
}
