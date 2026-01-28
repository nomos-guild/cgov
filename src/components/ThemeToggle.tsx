import { useEffect, useState, useRef } from "react";
import { Moon, Sun, Gamepad2 } from "lucide-react";
import { useTheme } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const BRIGHTNESS_KEY = "app-brightness";
const DEFAULT_BRIGHTNESS = 100;

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showBrightness, setShowBrightness] = useState(false);
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS);
  const brightnessRef = useRef<HTMLDivElement>(null);
  const sunButtonRef = useRef<HTMLButtonElement>(null);
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
    // Load saved brightness
    const saved = localStorage.getItem(BRIGHTNESS_KEY);
    if (saved) {
      const value = parseInt(saved, 10);
      setBrightness(value);
      applyBrightness(value);
    }
  }, []);

  const applyBrightness = (value: number) => {
    // Main dim overlay
    let overlay = document.getElementById("brightness-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "brightness-overlay";
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
        transition: background-color 0.3s ease;
      `;
      document.body.appendChild(overlay);
    }

    // Cloud-like vignette using SVG filter
    let vignetteContainer = document.getElementById("brightness-vignette");
    if (!vignetteContainer) {
      vignetteContainer = document.createElement("div");
      vignetteContainer.id = "brightness-vignette";
      vignetteContainer.innerHTML = `
        <svg width="100%" height="100%" style="position:fixed;inset:0;pointer-events:none;z-index:9998;">
          <defs>
            <filter id="cloud-filter" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="4" seed="5" result="noise"/>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="60" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <linearGradient id="left-shadow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:black;stop-opacity:var(--vignette-opacity, 0)"/>
              <stop offset="100%" style="stop-color:black;stop-opacity:0"/>
            </linearGradient>
            <linearGradient id="right-shadow" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" style="stop-color:black;stop-opacity:var(--vignette-opacity, 0)"/>
              <stop offset="100%" style="stop-color:black;stop-opacity:0"/>
            </linearGradient>
          </defs>
          <rect id="left-cloud" x="-10%" y="-10%" width="45%" height="120%" fill="url(#left-shadow)" filter="url(#cloud-filter)"/>
          <rect id="right-cloud" x="65%" y="-10%" width="45%" height="120%" fill="url(#right-shadow)" filter="url(#cloud-filter)"/>
        </svg>
      `;
      document.body.appendChild(vignetteContainer);
    }

    // Set CSS variable for dim intensity (0 = normal, 1 = fully dimmed)
    const dimIntensity = value < 100 ? (100 - value) / 50 : 0; // Max at 50% brightness
    const clampedIntensity = Math.min(dimIntensity, 1);
    document.documentElement.style.setProperty("--dim-intensity", String(clampedIntensity));
    document.documentElement.style.setProperty("--vignette-opacity", String(clampedIntensity * 0.8));

    if (value < 100) {
      const opacity = (100 - value) / 100;
      overlay.style.background = `rgba(0, 0, 0, ${opacity})`;
      vignetteContainer.style.opacity = "1";
    } else if (value > 100) {
      const opacity = (value - 100) / 100;
      overlay.style.background = `rgba(255, 255, 255, ${opacity * 0.5})`;
      vignetteContainer.style.opacity = "0";
    } else {
      overlay.style.background = "transparent";
      vignetteContainer.style.opacity = "0";
    }
  };

  // Apply brightness when it changes
  useEffect(() => {
    if (!mounted) return;
    applyBrightness(brightness);
    localStorage.setItem(BRIGHTNESS_KEY, String(brightness));
  }, [brightness, mounted]);

  // Close brightness popover when clicking outside
  useEffect(() => {
    if (!showBrightness) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        brightnessRef.current &&
        !brightnessRef.current.contains(e.target as Node) &&
        sunButtonRef.current &&
        !sunButtonRef.current.contains(e.target as Node)
      ) {
        setShowBrightness(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBrightness]);

  if (!mounted) {
    return (
      <div className="h-10 w-[170px] rounded-md border border-border bg-muted/30" />
    );
  }

  const currentIcon =
    resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
    );

  const handleSunClick = () => {
    setShowBrightness(!showBrightness);
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBrightness(parseInt(e.target.value, 10));
  };

  return (
    <div className="flex items-center gap-2">
      {!isGame && resolvedTheme === "light" && (
        <div className="relative">
          <Button
            ref={sunButtonRef}
            variant="ghost"
            size="icon"
            onClick={handleSunClick}
            className="h-10 w-10 rounded-full border border-input bg-background/80 shadow-soft btn-neon hover:bg-black hover:text-white"
            aria-label="Adjust brightness"
          >
            <Sun className="h-4 w-4" />
          </Button>
          {showBrightness && (
            <div
              ref={brightnessRef}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-background border border-input rounded-lg shadow-lg z-50 min-w-[200px]"
            >
              <div className="flex items-center gap-3">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={handleBrightnessChange}
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-foreground"
                />
                <span className="text-sm text-muted-foreground w-10 text-right">{brightness}%</span>
              </div>
            </div>
          )}
        </div>
      )}
      <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)} onOpenChange={setIsOpen}>
        <SelectTrigger
          aria-label="Select theme"
          className={
            isGame
              ? "game-nav-btn nav-link styled-button h-10 px-4 min-w-[170px]"
              : "h-10 w-[180px] justify-between rounded-full border-input bg-background/80 text-foreground shadow-soft btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]"
          }
        >
          <div className="flex items-center gap-2">
            {isGame ? currentIcon : (resolvedTheme === "dark" && <Moon className="h-4 w-4" />)}
            <SelectValue placeholder="Theme" />
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
        {themes.map((option, index) => {
          const icon =
            option.id === "dark" ? <Moon className="h-4 w-4" /> :
            option.id === "game" ? <Gamepad2 className="h-4 w-4" /> :
            null;
          return (
            <SelectItem
              key={option.id}
              value={option.id}
              className={selectItemClass}
              style={isGame ? { ["--delay" as string]: `${index * 40}ms` } : undefined}
            >
              <span className="flex items-center gap-2">
                {icon}
                {option.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
    </div>
  );
}

