import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getCurrentEpoch, epochToTimestamp } from "@/lib/epochUtils";
import { formatCompactNumber } from "@/lib/drepFormatters";
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

  const currentEpoch = getCurrentEpoch();
  const submissionEpoch = action.submissionEpoch > 0
    ? action.submissionEpoch
    : currentEpoch;

  const expiryEpoch = action.expiryEpoch > 0
    ? action.expiryEpoch
    : submissionEpoch + 6;

  const submissionTimestamp = epochToTimestamp(submissionEpoch);
  const expiryTimestamp = epochToTimestamp(expiryEpoch);

  const totalEpochs = expiryEpoch - submissionEpoch;
  const epochsElapsed = currentEpoch - submissionEpoch;
  const progressPercent = totalEpochs > 0
    ? Math.min(100, Math.max(0, (epochsElapsed / totalEpochs) * 100))
    : 0;

  // Live countdown
  const [timeRemaining, setTimeRemaining] = useState(Math.max(0, expiryTimestamp - Date.now()));

  useEffect(() => {
    if (timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining(Math.max(0, expiryTimestamp - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiryTimestamp, timeRemaining]);

  const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);

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
            <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-56 max-w-[75vw] rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:block text-wrap">
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
    ...(action.withdrawalAmount ? [{
      label: tProposal("budget"),
      value: (
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold leading-none border",
            isGame
              ? "rounded-none bg-[rgba(20,20,20,0.7)] text-white/70 border-white/15"
              : "rounded border-gray-300 bg-gray-100 text-gray-700 dark:border-[#0bd1a2]/30 dark:bg-[#0bd1a2]/10 dark:text-[#0bd1a2]"
          )}
        >
          ₳{formatCompactNumber(Number(BigInt(action.withdrawalAmount) / BigInt(1_000_000)))}
        </span>
      ),
    }] : []),
    {
      label: tExpiry("submission"),
      value: `${new Date(submittedAt ?? submissionTimestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} / Epoch ${submissionEpoch}`,
    },
    {
      label: tExpiry("epochBoundary"),  // "Voting End Deadline"
      value: `${new Date(expiryTimestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} / Epoch ${(action.expiryEpoch > 0 ? action.expiryEpoch : submissionEpoch + 6) - 1}`,
    },
  ];

  const content = (
    <>
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
          {timeRemaining > 0 ? (
            <span className="tabular-nums">
              {days}d {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s
            </span>
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

      <div className={cn(
        "mt-4 pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs",
        rows.length > 5 ? "lg:grid-cols-6" : "lg:grid-cols-5"
      )}>
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 py-1">
            <span className={cn(
              isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
            )}>
              {row.label}
            </span>
            <span className={cn(
              "font-semibold",
              isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
            )}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </>
  );

  return content;
}

/** Standalone card variant (wraps content in a Card) */
export function ProposalExpiryCardStandalone(props: {
  action: GovernanceActionDetail;
  isInfoAction: boolean;
  submittedAt: number | null;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  return (
    <Card className={cn("p-6", isGame && "game-detail-card")}>
      <ProposalExpiryCard {...props} />
    </Card>
  );
}
