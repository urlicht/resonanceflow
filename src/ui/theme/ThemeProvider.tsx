import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function loadInitialPreference(): ThemePreference {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved && isThemePreference(saved)) {
    return saved;
  }
  return "auto";
}

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  const [preference, setPreference] = useState<ThemePreference>(() => loadInitialPreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
      const next = preference === "auto" ? (media.matches ? "dark" : "light") : preference;
      setResolvedTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    };

    apply();

    const listener = (): void => {
      if (preference === "auto") {
        apply();
      }
    };

    media.addEventListener("change", listener);
    return () => {
      media.removeEventListener("change", listener);
    };
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference: (theme) => {
        setPreference(theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      },
    }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
