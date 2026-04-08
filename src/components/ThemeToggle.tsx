import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { theme, themes, setTheme, resolvedTheme, activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  // Set data attribute on body when dropdown is open (for game theme)
  useEffect(() => {
    if (isGame) {
      document.body.setAttribute("data-theme-dropdown-open", isOpen ? "true" : "false");
    }
    return () => {
      document.body.removeAttribute("data-theme-dropdown-open");
    };
  }, [isOpen, isGame]);
  const selectItemClass = isGame
    ? "dropdown-item text-sm font-semibold"
    : "rounded-none data-[highlighted]:bg-black/10 data-[highlighted]:text-foreground data-[state=checked]:bg-black data-[state=checked]:text-white dark:data-[highlighted]:bg-[#0bd1a2]/15 dark:data-[highlighted]:text-[#0bd1a2] dark:data-[state=checked]:bg-[#0bd1a2] dark:data-[state=checked]:text-black";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 w-10 rounded-full border border-border bg-muted/30" />
    );
  }

  const currentIcon =
    resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
    );

  return (
    <div className="[&_button>svg.shrink-0]:hidden">
      <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)} onOpenChange={setIsOpen}>
        <SelectTrigger
          aria-label="Select theme"
          className={
            isGame
              ? "game-nav-btn nav-link styled-button h-10 w-10 px-2 min-w-0 justify-center"
              : "h-10 w-10 justify-center rounded-full border-input bg-background/80 text-foreground shadow-soft btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]"
          }
        >
          <div className="flex items-center justify-center">
            {currentIcon}
          </div>
        </SelectTrigger>
        <SelectContent
          align="end"
          className={
            isGame
              ? "game-select-content w-[200px]"
              : "w-[200px] rounded-none dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2]"
          }
        >
          {themes.map((option, index) => (
            <SelectItem
              key={option.id}
              value={option.id}
              className={selectItemClass}
              style={isGame ? { ["--delay" as string]: `${index * 40}ms` } : undefined}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
