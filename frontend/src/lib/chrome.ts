export type Chrome = "android" | "desktop" | "ios";
export type ChromePref = "auto" | Chrome;

export const LG = 1024;
const PREF_KEY = "schichtklar-look";
export const CHROME_EVENT = "schichtklar-chrome";

// iPadOS reports a Mac user agent, so touch points tell the two apart.
export function isAppleTouch() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function readChromePref(): ChromePref {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === "ios" || v === "android" || v === "desktop") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function writeChromePref(pref: ChromePref) {
  try {
    if (pref === "auto") localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, pref);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHROME_EVENT));
}

export function resolveChrome(pref: ChromePref, width: number): Chrome {
  if (pref !== "auto") return pref;
  if (isAppleTouch()) return "ios";
  return width >= LG ? "desktop" : "android";
}

export function applyChrome(chrome: Chrome) {
  const root = document.documentElement;
  root.dataset.chrome = chrome;
  const theme = getComputedStyle(root).getPropertyValue("--app-bg").trim() || "#f6f7fb";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme);
}
