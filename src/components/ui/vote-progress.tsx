import * as React from "react";
import { cn } from "@/lib/utils";

interface VoteProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  yesPercent: number;
  noPercent: number;
  yesLabel?: string;
  noLabel?: string;
  yesAda?: string | number;
  noAda?: string | number;
  title?: string;
  showPercentages?: boolean;
  showAda?: boolean;
}

export const VoteProgress = React.forwardRef<HTMLDivElement, VoteProgressProps>(
  ({ className, yesPercent, noPercent, yesLabel, noLabel, yesAda, noAda, title, showPercentages = true, showAda = true, ...props }, ref) => {
    const totalPercent = yesPercent + noPercent;
    const yesWidth = totalPercent > 0 ? (yesPercent / totalPercent) * 100 : yesPercent;
    const noWidth = totalPercent > 0 ? (noPercent / totalPercent) * 100 : noPercent;

    return (
      <div ref={ref} className={cn("flex items-center gap-3", className)} {...props}>
        {title && (
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap w-24 flex-shrink-0">
            {title}
          </span>
        )}
        <div className="glass-progress relative h-3 flex-1 min-w-[100px] overflow-hidden rounded-full bg-secondary/40 border border-border/30 flex">
          {yesWidth > 0 && (
            <div
              className="progress-yes glass-progress h-full backdrop-blur-sm transition-all flex-shrink-0"
              style={{ width: `${yesWidth}%` }}
            />
          )}
          {noWidth > 0 && (
            <div
              className="progress-no glass-progress h-full backdrop-blur-sm transition-all flex-shrink-0"
              style={{ width: `${noWidth}%` }}
            />
          )}
        </div>
      </div>
    );
  }
);
VoteProgress.displayName = "VoteProgress";

