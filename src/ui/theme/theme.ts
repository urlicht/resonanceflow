export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "hrv-trainer-theme";

export function isThemePreference(value: string): value is ThemePreference {
  return value === "auto" || value === "light" || value === "dark";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}
