import { FONT_OPTIONS, type AppSettings, type Theme } from "./types";
import { isValidHex, normalizeHex, readableOn, shiftLightness } from "./utils";

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

export function fontStack(label: string): string {
  return FONT_OPTIONS.find((f) => f.label === label)?.stack ?? FONT_OPTIONS[0].stack;
}

export function applyAccent(hex: string) {
  const color = isValidHex(hex) ? normalizeHex(hex) : "#7c5cff";
  const root = document.documentElement;
  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-fg", readableOn(color));
  root.style.setProperty(
    "--accent-hover",
    shiftLightness(color, resolveTheme(currentTheme) === "dark" ? 0.14 : -0.1),
  );
}

let currentTheme: Theme = "dark";

export function applyTheme(theme: Theme) {
  currentTheme = theme;
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}

export function applyFont(label: string) {
  document.documentElement.style.setProperty("--app-font", fontStack(label));
}

export function applySettings(settings: AppSettings) {
  applyTheme(settings.theme);
  applyAccent(settings.accent_color);
  applyFont(settings.font);
}

/** Keeps `theme: "system"` honest when the OS switches appearance. */
export function watchSystemTheme(getTheme: () => Theme, getAccent: () => string) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getTheme() === "system") {
      applyTheme("system");
      applyAccent(getAccent());
    }
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
