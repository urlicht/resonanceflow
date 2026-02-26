import { useTheme } from "../theme/ThemeProvider";
import type { ThemePreference } from "../theme/theme";

const OPTIONS: ThemePreference[] = ["auto", "light", "dark"];
const LABELS: Record<ThemePreference, string> = {
  auto: "Auto",
  light: "Light",
  dark: "Dark",
};

export function ThemeToggle(): JSX.Element {
  const { preference, setPreference } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Theme Selection">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={option === preference ? "theme-option active" : "theme-option"}
          onClick={() => setPreference(option)}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
