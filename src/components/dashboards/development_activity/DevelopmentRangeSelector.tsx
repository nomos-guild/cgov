import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setSelectedRange } from "@/store/developmentSlice";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { DevelopmentRange } from "@/types/development";

const RANGES: { value: DevelopmentRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

export function DevelopmentRangeSelector() {
  const dispatch = useAppDispatch();
  const selectedRange = useAppSelector((state) => state.development.selectedRange);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const isGame = activeTheme.id === "game";

  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5 text-xs"
      style={{
        borderColor: isGame ? "rgba(255,255,255,0.1)" : isDark ? "rgba(11,209,162,0.2)" : undefined,
        backgroundColor: isGame ? "rgba(0,0,0,0.3)" : isDark ? "hsl(230,16%,12%)" : undefined,
      }}
    >
      {RANGES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => dispatch(setSelectedRange(value))}
          className={cn(
            "px-2 py-1 rounded-sm transition-colors font-medium",
            selectedRange === value
              ? isGame
                ? "bg-white/10 text-white"
                : isDark
                  ? "bg-[#0bd1a2]/10 text-[#0bd1a2]"
                  : "bg-gray-100 text-black shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
