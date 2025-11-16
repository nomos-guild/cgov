import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get initial theme from localStorage or default to light
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    const initialTheme = savedTheme || "light";
    setThemeState(initialTheme);

    // Apply initial theme
    const resolvedTheme = initialTheme === "system" ? getSystemTheme() : initialTheme;
    applyTheme(resolvedTheme);
    
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
    applyTheme(resolvedTheme);

    // Listen for OS preference changes when theme is set to "system"
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? "dark" : "light";
        applyTheme(newTheme);
      };

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      } 
      // Fallback for older browsers
      else if (mediaQuery.addListener) {
        const legacyHandler = () => {
          const newTheme = mediaQuery.matches ? "dark" : "light";
          applyTheme(newTheme);
        };
        mediaQuery.addListener(legacyHandler);
        return () => mediaQuery.removeListener(legacyHandler);
      }
    }
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (newTheme === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", newTheme);
    }
  };

  const toggleTheme = () => {
    const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
    const newTheme = resolvedTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return { 
      theme: "light" as Theme, 
      resolvedTheme: "light" as "light" | "dark",
      setTheme: () => {},
      toggleTheme: () => {} 
    };
  }
  return context;
}

