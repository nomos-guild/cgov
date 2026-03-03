import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getCurrentEpoch, epochToTimestamp } from "@/lib/epochUtils";
import type { GovernanceActionDetail } from "@/types/governance";

export function ProposalExpiryCard({
  action,
  isInfoAction,
  submittedAt,
}: {
  action: GovernanceActionDetail;
  isInfoAction: boolean;
  submittedAt: number | null;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tExpiry = useTranslations("expiry");
  const tProposal = useTranslations("proposal");

  const now = Date.now();
  const currentEpoch = getCurrentEpoch();
  const submissionEpoch = action.submissionEpoch > 0
    ? action.submissionEpoch
    : currentEpoch;

  const expiryEpoch = action.expiryEpoch > 0
    ? action.expiryEpoch
    : submissionEpoch + 6;

  const submissionTimestamp = epochToTimestamp(submissionEpoch);
  const expiryTimestamp = epochToTimestamp(expiryEpoch);

  const timeRemaining = Math.max(0, expiryTimestamp - now);
  const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));

  const totalEpochs = expiryEpoch - submissionEpoch;
  const epochsElapsed = currentEpoch - submissionEpoch;
  const progressPercent = totalEpochs > 0
    ? Math.min(100, Math.max(0, (epochsElapsed / totalEpochs) * 100))
    : 0;

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: tProposal("govActionType"),
      value: action.type,
    },
    {
      label: tProposal("status"),
      value: action.status,
    },
    {
      label: tProposal("constitutionality"),
      value: isInfoAction ? (
        <div className="flex items-center gap-1.5">
          <span className={isGame ? "text-white/60" : "text-muted-foreground dark:text-[#0bd1a2]/60"}>
            {tProposal("notApplicable")}
          </span>
          <div className="group relative">
            <Info
              className={cn(
                "h-3.5 w-3.5 cursor-help",
                isGame ? "text-white/50" : "text-muted-foreground/60 dark:text-[#0bd1a2]/60"
              )}
            />
            <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-48 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:block">
              {tProposal("infoActionTooltip")}
            </div>
          </div>
        </div>
      ) : action.constitutionality ? (
        action.status === "Active" && action.constitutionality.toLowerCase() !== "constitutional"
          ? tProposal("pending")
          : action.constitutionality
      ) : null,
    },
    {
      label: tExpiry("submissionDate"),
      value: new Date(submittedAt ?? submissionTimestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    },
    {
      label: tExpiry("epochBoundary"),
      value: new Date(expiryTimestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    },
    {
      label: tExpiry("submissionEpoch"),
      value: submissionEpoch,
    },
    {
      label: tExpiry("validUntilEpoch"),
      value: (action.expiryEpoch > 0 ? action.expiryEpoch : submissionEpoch + 6) - 1,
    },
  ];

  return (
    <Card className={cn("p-6", isGame && "game-detail-card")}>
      <div className="flex items-center justify-between mb-4">
        <label className={cn(
          "text-sm font-semibold",
          isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
        )}>
          {tExpiry("timeUntilExpiry")}
        </label>
        <div className={cn(
          "text-base font-semibold",
          isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
        )}>
          {daysRemaining > 0 ? (
            <>
              {daysRemaining}{" "}
              {daysRemaining === 1 ? tExpiry("day") : tExpiry("days")}
            </>
          ) : (
            <span className={isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"}>
              {tExpiry("expired")}
            </span>
          )}
        </div>
      </div>
      <Progress
        value={progressPercent}
        className={cn(
          "h-3",
          isGame
            ? "rounded-full bg-white/20"
            : "rounded-full bg-secondary dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none"
        )}
        indicatorClassName={isGame ? "bg-white/50" : "bg-black dark:bg-[#0bd1a2]"}
      />

      <div className="mt-4 pt-3 border-t border-border/50">
        <table className="text-xs w-full">
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={cn(
                  i < rows.length - 1 && "border-b",
                  isGame ? "border-white/10" : "border-border/30"
                )}
              >
                <td className={cn(
                  "py-2 pr-4",
                  isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                )}>
                  {row.label}
                </td>
                <td className={cn(
                  "py-2 font-semibold whitespace-nowrap",
                  isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                )}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
