import type { ComponentType } from "react";

export type ThemeId = "light" | "dark" | (string & {});

export type ThemeComponents = {
  HeaderBrand?: ComponentType;
};

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  isDark: boolean;
  components?: ThemeComponents;
}

