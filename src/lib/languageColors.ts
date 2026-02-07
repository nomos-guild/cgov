const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Haskell: "#5e5086",
  Rust: "#dea584",
  Python: "#3572A5",
  Go: "#00ADD8",
  Nix: "#7e7eff",
  Plutus: "#8b2252",
  Java: "#b07219",
  "C#": "#178600",
  C: "#555555",
  "C++": "#f34b7d",
  Solidity: "#AA6746",
  Shell: "#89e051",
  Dart: "#00B4AB",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Lua: "#000080",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Dockerfile: "#384d54",
  Markdown: "#083fa1",
};

const DEFAULT_COLOR = "#8b8b8b";

export function getLanguageColor(language: string | null | undefined): string {
  if (!language) return DEFAULT_COLOR;
  return LANGUAGE_COLORS[language] ?? DEFAULT_COLOR;
}
