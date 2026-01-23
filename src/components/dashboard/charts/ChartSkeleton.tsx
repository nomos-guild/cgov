import { cn } from "@/lib/utils";

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
        className
      )}
    >
      <div className="animate-pulse">
        <div className="h-5 w-32 bg-muted rounded mb-4" />
        <div className="h-[200px] bg-muted rounded" />
      </div>
    </div>
  );
}
