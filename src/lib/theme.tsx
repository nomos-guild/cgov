import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ThemeId = "light" | "dark";

type ThemeOption = {
  id: ThemeId;
  label: string;
  isDark: boolean;
};

const THEME_PRESETS: ThemeOption[] = [
  { id: "light", label: "Light", isDark: false },
  { id: "dark", label: "Nerd", isDark: true },
];

const DEFAULT_THEME: ThemeId = "light";
const STORAGE_KEY = "theme";
const themeMap = THEME_PRESETS.reduce(
  (acc, theme) => ({ ...acc, [theme.id]: theme }),
  {} as Record<ThemeId, ThemeOption>
);

interface ThemeContextType {
  theme: ThemeId;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  themes: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(themeId: ThemeId) {
  if (typeof document === "undefined") return;
  const theme = themeMap[themeId] ?? themeMap[DEFAULT_THEME];

  document.documentElement.setAttribute("data-theme", theme.id);
  document.documentElement.classList.toggle("dark", theme.isDark);
  document.documentElement.style.setProperty(
    "color-scheme",
    theme.isDark ? "dark" : "light"
  );
  }

function getNextTheme(current: ThemeId): ThemeId {
  const index = THEME_PRESETS.findIndex((preset) => preset.id === current);
  const next = THEME_PRESETS[(index + 1) % THEME_PRESETS.length];
  return next?.id ?? DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme =
      typeof localStorage !== "undefined"
        ? (localStorage.getItem(STORAGE_KEY) as ThemeId | null)
        : null;
    const initialTheme = savedTheme && themeMap[savedTheme] ? savedTheme : DEFAULT_THEME;

    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    applyTheme(theme);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme, mounted]);

  const setTheme = (newTheme: ThemeId) => {
    if (!themeMap[newTheme]) {
      setThemeState(DEFAULT_THEME);
      return;
    }
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(getNextTheme(theme));
  };

  const resolvedTheme: "light" | "dark" =
    themeMap[theme]?.isDark ?? false ? "dark" : "light";

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme, themes: THEME_PRESETS }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return { 
      theme: DEFAULT_THEME,
      resolvedTheme: "light" as const,
      setTheme: () => {},
      toggleTheme: () => {},
      themes: THEME_PRESETS,
    };
  }
  return context;
}

