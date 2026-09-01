export type Chrome = "android" | "desktop" | "ios";
export type ChromePref = "auto" | Chrome;

const LG = 1024;

export function resolveChrome(pref: ChromePref, width: number): Chrome {
  if (pref !== "auto") return pref;
  return width >= LG ? "desktop" : "android";
}

export function applyChrome(chrome: Chrome) {
  const root = document.documentElement;
  root.dataset.chrome = chrome;
  const theme = getComputedStyle(root).getPropertyValue("--app-bg").trim() || "#f6f7fb";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme);
}
