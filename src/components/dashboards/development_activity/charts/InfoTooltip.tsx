import {
  Tooltip, TooltipTrigger, TooltipContent,
} from "@/components/ui/tooltip";
import { METRIC_DESCRIPTIONS } from "./metricDescriptions";

interface InfoTooltipProps {
  metricKey: string;
  children: React.ReactNode;
}

export function InfoTooltip({ metricKey, children }: InfoTooltipProps) {
  const info = METRIC_DESCRIPTIONS[metricKey];
  if (!info) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{children}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] p-3 leading-relaxed">
        <p className="text-xs">{info.description}</p>
        {info.formula && (
          <p className="mt-1.5 text-[10px] font-mono opacity-70 border-t border-current/10 pt-1.5">
            {info.formula}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
