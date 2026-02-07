import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function TrendIndicator({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return <Minus className="w-3 h-3 text-muted-foreground" />;
  const isUp = pct > 0;
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-medium", isUp ? "text-emerald-500" : "text-red-500")}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}
