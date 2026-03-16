import { useTranslations } from "next-intl";
import type { TooltipPayload } from "recharts";
import { cn } from "@/lib/utils";
import { formatAdaValue } from "@/lib/formatters";
import type { TimelinePoint, VoteColorSet } from "@/lib/voteColors";

export function VoteTrendTooltip({
  active,
  payload,
  showPower,
  colors,
  isGame,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  showPower: boolean;
  colors: VoteColorSet;
  isGame: boolean;
}) {
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");

  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as TimelinePoint | undefined;
  if (!point) {
    return null;
  }

  const rows = [
    {
      label: tVoting("yes"),
      value: showPower
        ? formatAdaValue(point.yesPower)
        : `${point.yesCount.toLocaleString()} ${tProposal("votes")}`,
        color: colors.yes,
      border: "transparent",
    },
    {
      label: tVoting("no"),
      value: showPower
        ? formatAdaValue(point.noPower)
        : `${point.noCount.toLocaleString()} ${tProposal("votes")}`,
        color: colors.no,
      border: "transparent",
    },
    {
      label: tVoting("abstain"),
      value: showPower
        ? formatAdaValue(point.abstainPower)
        : `${point.abstainCount.toLocaleString()} ${tProposal("votes")}`,
        color: colors.abstain,
      border: "rgba(148, 163, 184, 0.85)",
    },
  ];

  return (
    <div className={cn(
      "rounded-md bg-background/95 px-3 py-2 text-xs shadow-md",
      !isGame && "border"
    )}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {point.label}
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{ backgroundColor: row.color, borderColor: row.border }}
              />
              <span className="font-semibold text-foreground">
                {row.label}
              </span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
