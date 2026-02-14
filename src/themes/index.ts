import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { gameTheme } from "./game";
import { neuralTheme } from "./neural";
import type { ThemeDefinition, ThemeId, ThemeComponents } from "./types";

export const themes: ThemeDefinition[] = [lightTheme, darkTheme, gameTheme, neuralTheme];

const themeMap = new Map<ThemeId, ThemeDefinition>(
  themes.map((theme) => [theme.id, theme])
);

export const DEFAULT_THEME_ID: ThemeId = "light";

export function getThemeDefinition(themeId: ThemeId): ThemeDefinition {
  return themeMap.get(themeId) ?? themeMap.get(DEFAULT_THEME_ID)!;
}

export function getNextThemeId(current: ThemeId): ThemeId {
  const index = themes.findIndex((theme) => theme.id === current);
  const next = themes[(index + 1) % themes.length];
  return next?.id ?? DEFAULT_THEME_ID;
}

export type { ThemeDefinition, ThemeId, ThemeComponents };

