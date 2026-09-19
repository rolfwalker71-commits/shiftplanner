import { useEffect, useSyncExternalStore } from "react";
import { applyChrome, CHROME_EVENT, LG, readChromePref, resolveChrome, type Chrome } from "../lib/chrome";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(`(min-width: ${LG}px)`);
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  dark.addEventListener("change", onChange);
  window.addEventListener(CHROME_EVENT, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    dark.removeEventListener("change", onChange);
    window.removeEventListener(CHROME_EVENT, onChange);
  };
}

/** Visual language: Liquid Glass (ios), Material You (android) or Fluent (desktop). */
export function useChrome(): Chrome {
  const chrome = useSyncExternalStore(
    subscribe,
    () => resolveChrome(readChromePref(), window.innerWidth),
    () => "android" as Chrome,
  );
  useEffect(() => applyChrome(chrome), [chrome]);
  return chrome;
}

/** Layout: wide screens get the top navigation and the drag-and-drop calendar. */
export function useWide() {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth >= LG,
    () => false,
  );
}
