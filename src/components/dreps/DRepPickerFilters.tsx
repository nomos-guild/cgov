import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { DualRangeSlider } from "@/components/ui/dual-range-slider";

interface Preset {
  label: string;
  range: [number, number];
}

interface FilterConfig {
  label: string;
  description: string;
  value: [number, number];
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  onCommit: (value: [number, number]) => void;
  presets: Preset[];
}

interface DRepPickerFiltersProps {
  filters: FilterConfig[];
  matchCount: number;
  totalCount: number;
  onReset: () => void;
}

export default function DRepPickerFilters({
  filters,
  matchCount,
  totalCount,
  onReset,
}: DRepPickerFiltersProps) {
  const t = useTranslations("drep");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const cardClass = isLight
    ? "rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-elevation-2"
    : isGame
    ? "game-detail-card rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-5 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-5 shadow-none";

  const labelClass = isGame
    ? "text-white font-semibold text-xs"
    : isLight
    ? "text-black font-semibold text-xs"
    : "text-[#0bd1a2] font-semibold text-xs";

  const rangeTextClass = isGame
    ? "text-white/70 text-2xs tabular-nums"
    : isLight
    ? "text-black/60 text-2xs tabular-nums"
    : "text-[#0bd1a2]/70 text-2xs tabular-nums";

  return (
    <div className={cardClass}>
      {/* Header */}
      <div className="mb-4">
        <h3 className={`text-sm font-bold ${isGame ? "text-white" : isLight ? "text-black" : "text-[#0bd1a2]"}`}>
          {t("pickerTitle")}
        </h3>
        <p className={`mt-1 text-2xs leading-relaxed ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
          {t("pickerDescription")}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-5">
        {filters.map((filter) => {
          // Check which preset is active (exact match)
          const activePresetIdx = filter.presets.findIndex(
            (p) => p.range[0] === filter.value[0] && p.range[1] === filter.value[1]
          );

          return (
            <div key={filter.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <span className={labelClass}>{filter.label}</span>
                  <span className="relative inline-block group">
                    <Info className={cn(
                      "inline h-3 w-3 cursor-help",
                      isGame ? "text-white/40" : isLight ? "text-black/30" : "text-[#0bd1a2]/50"
                    )} />
                    <span className={cn(
                      "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 rounded px-2.5 py-1.5 text-2xs font-normal leading-snug opacity-0 transition-opacity group-hover:opacity-100 z-50 text-center",
                      isGame
                        ? "bg-black/90 text-white border border-white/20"
                        : isLight
                        ? "bg-foreground text-background shadow-lg"
                        : "bg-black text-[#0bd1a2] border border-[#0bd1a2]"
                    )}>
                      {filter.description}
                    </span>
                  </span>
                </div>
                <span className={rangeTextClass}>
                  {filter.formatValue(filter.value[0])} – {filter.formatValue(filter.value[1])}
                </span>
              </div>

              {/* Preset chips */}
              <div className="flex gap-1.5 mb-3">
                {filter.presets.map((preset, idx) => {
                  const isActive = idx === activePresetIdx;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => filter.onCommit(preset.range)}
                      className={`text-3xs font-semibold uppercase tracking-wider px-2 py-0.5 transition-all duration-150 ${
                        isLight
                          ? isActive
                            ? "rounded-full bg-black text-white"
                            : "rounded-full border border-black/15 text-black/50 hover:border-black/40 hover:text-black/80"
                          : isGame
                          ? isActive
                            ? "rounded-[2px] border border-white/50 text-white/90"
                            : "rounded-[2px] border border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"
                          : isActive
                            ? "rounded-none bg-[#0bd1a2] text-black"
                            : "rounded-none border border-[#0bd1a2]/30 text-[#0bd1a2]/50 hover:border-[#0bd1a2]/60 hover:text-[#0bd1a2]/80"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <DualRangeSlider
                className={isGame ? "game-picker-slider" : ""}
                value={filter.value}
                min={filter.min}
                max={filter.max}
                step={filter.step}
                onValueCommit={(val) => filter.onCommit(val as [number, number])}
                onValueChange={(val) => filter.onCommit(val as [number, number])}
              />
            </div>
          );
        })}
      </div>

      {/* Footer: match count + reset */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-current/10">
        <span className={`text-xs font-semibold ${isGame ? "text-white" : isLight ? "text-black" : "text-[#0bd1a2]"}`}>
          {matchCount} <span className={isGame ? "text-white/50 font-normal" : "text-muted-foreground font-normal"}>/ {totalCount}</span>
        </span>
        <button
          onClick={onReset}
          className={`text-2xs font-semibold uppercase tracking-wide px-3 py-1.5 transition-all duration-200 ${
            isLight
              ? "rounded-full border border-black/20 text-black/60 hover:bg-black hover:text-white"
              : isGame
              ? "rounded-[2px] border border-white/20 text-white/60 hover:border-[#0bd1a2] hover:text-[#0bd1a2]"
              : "rounded-none border border-[#0bd1a2]/50 text-[#0bd1a2]/70 hover:border-[#0bd1a2] hover:text-[#0bd1a2]"
          }`}
        >
          {t("resetFilters")}
        </button>
      </div>
    </div>
  );
}
