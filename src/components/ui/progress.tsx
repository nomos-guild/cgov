import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
  variant?: "default" | "yes" | "no";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, variant = "default", ...props }, ref) => {
    const indicatorColorClass = 
      variant === "yes" 
        ? "progress-yes" 
        : variant === "no" 
        ? "progress-no" 
        : "bg-foreground/80";

    return (
      <div
        ref={ref}
        className={cn("glass-progress relative h-2 w-full overflow-hidden rounded-full bg-secondary/40 border border-border/30", className)}
        {...props}>
        <div
          className={cn(`glass-progress h-full w-full flex-1 ${indicatorColorClass} backdrop-blur-sm transition-all`, indicatorClassName)}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
