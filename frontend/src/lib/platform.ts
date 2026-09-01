import type { Chrome } from "./chrome";

export function listTileClass(chrome: Chrome, selected = false) {
  if (chrome === "desktop") {
    return selected
      ? "rounded-md bg-primary/10 ring-1 ring-border"
      : "rounded-md bg-card ring-1 ring-border";
  }
  return selected ? "rounded-3xl bg-secondary text-primary" : "rounded-3xl bg-card";
}

export function dockBarClass(chrome: Chrome) {
  if (chrome === "desktop") return "hidden";
  return "fixed inset-x-0 bottom-0 z-30 bg-[var(--app-surface)] lg:hidden";
}

export function panelClass(chrome: Chrome) {
  if (chrome === "desktop") {
    return "rounded-md bg-card/80 ring-1 ring-border backdrop-blur-[1.25rem]";
  }
  return "rounded-3xl bg-card";
}

export function iconBtnClass(chrome: Chrome) {
  if (chrome === "desktop") {
    return "grid size-11 place-items-center rounded-md text-foreground hover:bg-primary/10";
  }
  return "grid size-12 place-items-center rounded-full text-foreground";
}

export function coverRadius(chrome: Chrome) {
  return chrome === "desktop" ? "rounded-sm" : "rounded-2xl";
}
