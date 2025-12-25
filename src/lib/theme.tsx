import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_THEME_ID,
  getNextThemeId,
  getThemeDefinition,
  themes,
  type ThemeDefinition,
  type ThemeId,
  type ThemeComponents,
} from "@/themes";

const STORAGE_KEY = "theme";

interface ThemeContextType {
  theme: ThemeId;
  resolvedTheme: "light" | "dark";
  components: ThemeComponents;
  activeTheme: ThemeDefinition;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(themeId: ThemeId) {
  if (typeof document === "undefined") return;
  const theme = getThemeDefinition(themeId);
  document.documentElement.setAttribute("data-theme", theme.id);
  document.documentElement.classList.toggle("dark", theme.isDark);
  document.documentElement.style.setProperty(
    "color-scheme",
    theme.isDark ? "dark" : "light"
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme =
      typeof localStorage !== "undefined"
        ? (localStorage.getItem(STORAGE_KEY) as ThemeId | null)
        : null;
    const hasSaved = savedTheme && themes.some((t) => t.id === savedTheme);
    const initialTheme = hasSaved ? (savedTheme as ThemeId) : DEFAULT_THEME_ID;

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
    setThemeState(getThemeDefinition(newTheme).id);
  };

  const toggleTheme = () => {
    setTheme(getNextThemeId(theme));
  };

  const activeTheme = getThemeDefinition(theme);
  const resolvedTheme: "light" | "dark" = activeTheme.isDark ? "dark" : "light";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        components: activeTheme.components ?? {},
        activeTheme,
        setTheme,
        toggleTheme,
        themes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return { 
      theme: DEFAULT_THEME_ID,
      resolvedTheme: "light" as const,
      components: {},
      activeTheme: getThemeDefinition(DEFAULT_THEME_ID),
      setTheme: () => {},
      toggleTheme: () => {},
      themes,
    };
  }
  return context;
}

