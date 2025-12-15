import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const baseBadgeClasses =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default:
    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive:
    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
  outline: "text-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClass = badgeVariantClasses[variant] ?? badgeVariantClasses.default;

  return (
    <div
      className={cn(baseBadgeClasses, variantClass, className)}
      {...props}
    />
  );
}

export { Badge };
