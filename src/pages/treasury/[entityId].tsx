import { useEffect, useMemo } from "react";
import type { GetStaticProps, GetStaticPaths, InferGetStaticPropsType } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import { SeoHead } from "@/components/SeoHead";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { useTheme } from "@/lib/theme";
import { useGovernanceActions, type InitialGovernanceData } from "@/hooks/useGovernanceData";
import { fetchAllGovernanceData } from "@/lib/serverFetch";
import {
  TREASURY_ENTITIES,
  getFundedEntityIds,
  getTreasuryEntity,
  resolveProposalEntity,
  type TreasuryEntity,
  type TreasuryYear,
} from "@/lib/treasuryEntities";
import { formatNumber } from "@/lib/drepFormatters";
import { cn } from "@/lib/utils";
import type { GovernanceAction } from "@/types/governance";

type IntlMessages = typeof import("@/messages/en.json");

const APPROVED_STATUSES = new Set<GovernanceAction["status"]>(["Enacted", "Ratified"]);
const REJECTED_STATUSES = new Set<GovernanceAction["status"]>(["Expired", "Closed"]);

interface EntityProfilePageProps {
  messages: IntlMessages;
  entity: TreasuryEntity;
  initialData: InitialGovernanceData;
}

function formatAda(value: number): string {
  if (value >= 1_000_000_000) return `₳${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `₳${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `₳${(value / 1_000).toFixed(1)}K`;
  return `₳${value.toFixed(0)}`;
}

function lovelaceToAda(lovelace: string | null | undefined): number {
  if (!lovelace) return 0;
  const ada = Number(lovelace) / 1_000_000;
  return Number.isFinite(ada) ? ada : 0;
}

function classifyStatus(status: GovernanceAction["status"]): "approved" | "rejected" | "active" {
  if (APPROVED_STATUSES.has(status)) return "approved";
  if (REJECTED_STATUSES.has(status)) return "rejected";
  return "active";
}

interface YearTotals {
  year: TreasuryYear;
  approvedAda: number;
  pendingAda: number;
  rejectedAda: number;
}

export default function EntityProfilePage({
  entity,
  initialData,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter();
  const t = useTranslations("treasury.profile");
  const tStatus = useTranslations("status");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const { actions, refresh } = useGovernanceActions(initialData?.actions);

  // Force one revalidation on mount — the SWR hook skips the initial fetch
  // when fallbackData is provided, so without this nudge the page would
  // forever show whatever snapshot ISR baked in at build time. Active
  // proposals submitted after that snapshot would never appear.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Resolve every action's entity once, so we can look up year-by-proposal
  // without reapplying the heuristic in the year breakdown loop.
  const entityActionsWithMeta = useMemo(() => {
    return actions
      .map((a) => ({ action: a, resolved: resolveProposalEntity(a) }))
      .filter((x) => x.resolved?.entityId === entity.entityId)
      .sort((a, b) => (b.action.submissionEpoch ?? 0) - (a.action.submissionEpoch ?? 0));
  }, [actions, entity.entityId]);

  const entityActions = useMemo(
    () => entityActionsWithMeta.map((x) => x.action),
    [entityActionsWithMeta]
  );

  const stats = useMemo(() => {
    let approvedAda = 0;
    let pendingAda = 0;
    let requestedAda = 0;
    const yearMap = new Map<TreasuryYear, YearTotals>();
    for (const { action, resolved } of entityActionsWithMeta) {
      const ada = lovelaceToAda(action.withdrawalAmount);
      requestedAda += ada;
      const cls = classifyStatus(action.status);
      if (cls === "approved") approvedAda += ada;
      else if (cls === "active") pendingAda += ada;

      const year = resolved?.year;
      if (year != null) {
        const entry = yearMap.get(year) ?? { year, approvedAda: 0, pendingAda: 0, rejectedAda: 0 };
        if (cls === "approved") entry.approvedAda += ada;
        else if (cls === "active") entry.pendingAda += ada;
        else if (cls === "rejected") entry.rejectedAda += ada;
        yearMap.set(year, entry);
      }
    }
    const yearBreakdown = [...yearMap.values()].sort((a, b) => a.year - b.year);
    return {
      approvedAda,
      pendingAda,
      requestedAda,
      proposalsCount: entityActions.length,
      yearBreakdown,
    };
  }, [entityActionsWithMeta, entityActions.length]);

  const cardClass = isGame
    ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-6 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : isLight
    ? "rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-elevation-2"
    : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-6 shadow-none";

  const statCardClass = isLight
    ? "rounded-2xl border border-border bg-card p-4 shadow-elevation-2"
    : isGame
    ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.35)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent p-4 shadow-none";

  const statLabelClass = isGame
    ? "text-sm text-white/70"
    : isLight
    ? "text-sm text-muted-foreground"
    : "text-sm text-[#0bd1a2]";
  const statValueClass = isGame
    ? "text-2xl font-bold text-white"
    : isLight
    ? "text-2xl font-bold"
    : "text-2xl font-bold text-[#0bd1a2]";

  return (
    <>
      <SeoHead
        title={t("pageTitle", { name: entity.label })}
        description={t("pageDescription", { name: entity.label })}
        type="article"
      />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 pt-8 pb-28 sm:px-4 sm:pt-10 sm:pb-36 md:px-6 md:pt-12 md:pb-44">
          <FadeIn delay={0} duration={400} distance={12}>
            <Link href="/treasury">
              <Button
                variant="default"
                className={cn(
                  "mb-4",
                  isGame
                    ? "game-nav-btn"
                    : isLight
                    ? "bg-white text-black shadow-elevation-2 hover:bg-black hover:text-white"
                    : "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] shadow-none hover:bg-[#0bd1a2] hover:text-black"
                )}
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t("backToTreasury")}
              </Button>
            </Link>
          </FadeIn>

          {/* Header card */}
          <FadeIn delay={80} duration={500} distance={16}>
            <Card className={cn(cardClass, "mb-6")}>
              <div className="flex items-start gap-4">
                {entity.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entity.iconUrl}
                    alt={entity.label}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={cn(
                    "w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0",
                    isGame
                      ? "bg-white/10 text-white"
                      : isLight
                      ? "bg-primary/10 text-primary"
                      : "border border-[#0bd1a2] bg-transparent text-[#0bd1a2]"
                  )}>
                    {entity.label.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className={cn(
                    "landing-title text-2xl sm:text-3xl md:text-4xl font-bold mb-1",
                    isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                  )}>
                    {entity.label}
                  </h1>
                  {entity.description && (
                    <p className={cn(
                      "text-sm sm:text-base mt-2",
                      isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"
                    )}>
                      {entity.description}
                    </p>
                  )}
                  {entity.website && (
                    <a
                      href={entity.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1 mt-2 text-xs sm:text-sm underline-offset-2 hover:underline",
                        isGame ? "text-[#00ff66]" : isLight ? "text-primary" : "text-[#0bd1a2]"
                      )}
                    >
                      {t("website")}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          </FadeIn>

          {/* Stat cards */}
          <FadeIn delay={160} duration={500} distance={18}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className={statCardClass}>
                <p className={statLabelClass}>{t("totalReceived")}</p>
                <p className={statValueClass}>{formatAda(stats.approvedAda)}</p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>{t("pending")}</p>
                <p className={statValueClass}>{formatAda(stats.pendingAda)}</p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>{t("totalRequested")}</p>
                <p className={statValueClass}>{formatAda(stats.requestedAda)}</p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>{t("proposalsCount")}</p>
                <p className={statValueClass}>{formatNumber(stats.proposalsCount)}</p>
              </div>
            </div>
          </FadeIn>

          {/* By year + Proposals list */}
          <FadeIn delay={240} duration={500} distance={18}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Year breakdown */}
              <Card className={cn(cardClass, "lg:col-span-1")}>
                <h2 className={cn(
                  "text-base sm:text-lg font-semibold mb-4",
                  isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                )}>
                  {t("byYearTitle")}
                </h2>
                {stats.yearBreakdown.length === 0 ? (
                  <p className={cn(
                    "text-sm",
                    isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                  )}>
                    {t("noProposals")}
                  </p>
                ) : (
                  <YearBreakdownTable
                    rows={stats.yearBreakdown}
                    isGame={isGame}
                    isLight={isLight}
                    yearLabel={t("year")}
                    approvedLabel={t("approved")}
                    pendingLabel={t("pending")}
                    rejectedLabel={t("rejected")}
                  />
                )}
              </Card>

              {/* Proposals list */}
              <Card className={cn(cardClass, "lg:col-span-2")}>
                <h2 className={cn(
                  "text-base sm:text-lg font-semibold mb-4",
                  isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                )}>
                  {t("proposalsTitle")}
                </h2>
                {entityActions.length === 0 ? (
                  <p className={cn(
                    "text-sm",
                    isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                  )}>
                    {t("noProposals")}
                  </p>
                ) : (
                  <ul className={cn(
                    "divide-y",
                    isGame ? "divide-white/10" : isLight ? "divide-border" : "divide-[#0bd1a2]/30"
                  )}>
                    {entityActionsWithMeta.map(({ action: a, resolved }) => {
                      const ada = lovelaceToAda(a.withdrawalAmount);
                      const cls = classifyStatus(a.status);
                      const year = resolved?.year;
                      return (
                        <li
                          key={a.proposalId ?? a.hash}
                          className={cn(
                            "py-3 cursor-pointer transition-colors",
                            isGame
                              ? "hover:bg-white/5"
                              : isLight
                              ? "hover:bg-secondary/40"
                              : "hover:bg-[#0bd1a2]/5"
                          )}
                          onClick={() => router.push(`/governance/${a.hash}`)}
                          role="link"
                          tabIndex={0}
                          aria-label={t("viewProposal")}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                "text-sm font-medium truncate",
                                isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                              )}>
                                {a.title}
                              </p>
                              <p className={cn(
                                "text-xs mt-0.5",
                                isGame ? "text-white/50" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                              )}>
                                {year ?? "—"}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={cn(
                                "text-sm font-mono",
                                isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                              )}>
                                {formatAda(ada)}
                              </span>
                              <StatusPill status={a.status} cls={cls} isGame={isGame} isLight={isLight} label={tStatus(a.status)} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </FadeIn>
        </div>
      </div>
    </>
  );
}

interface YearBreakdownTableProps {
  rows: YearTotals[];
  isGame: boolean;
  isLight: boolean;
  yearLabel: string;
  approvedLabel: string;
  pendingLabel: string;
  rejectedLabel: string;
}

function YearBreakdownTable({ rows, isGame, isLight, yearLabel, approvedLabel, pendingLabel, rejectedLabel }: YearBreakdownTableProps) {
  const headerClass = cn(
    "py-2 text-xs font-medium uppercase tracking-wide",
    isGame ? "text-white/50" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
  );
  const cellClass = cn(
    "py-2.5 text-sm",
    isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
  );
  const rowBorderClass = cn(
    "border-b",
    isGame ? "border-white/10" : isLight ? "border-black/5" : "border-[#0bd1a2]/20"
  );
  return (
    <table className="w-full">
      <thead>
        <tr className={rowBorderClass}>
          <th className={cn(headerClass, "text-left")}>{yearLabel}</th>
          <th className={cn(headerClass, "text-right")}>{approvedLabel}</th>
          <th className={cn(headerClass, "text-right")}>{pendingLabel}</th>
          <th className={cn(headerClass, "text-right")}>{rejectedLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.year} className={i < rows.length - 1 ? rowBorderClass : undefined}>
            <td className={cellClass}>{r.year}</td>
            <td className={cn(cellClass, "text-right font-mono")}>
              {r.approvedAda > 0 ? formatAda(r.approvedAda) : "—"}
            </td>
            <td className={cn(cellClass, "text-right font-mono")}>
              {r.pendingAda > 0 ? formatAda(r.pendingAda) : "—"}
            </td>
            <td className={cn(cellClass, "text-right font-mono")}>
              {r.rejectedAda > 0 ? formatAda(r.rejectedAda) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface StatusPillProps {
  status: GovernanceAction["status"];
  cls: "approved" | "rejected" | "active";
  isGame: boolean;
  isLight: boolean;
  label: string;
}

function StatusPill({ cls, isGame, isLight, label }: StatusPillProps) {
  const tone =
    cls === "approved"
      ? isGame
        ? "bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/25"
        : isLight
        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
        : "bg-[#0bd1a2]/15 text-[#0bd1a2] border-[#0bd1a2]/25"
      : cls === "rejected"
      ? isGame
        ? "bg-[#ff3333]/10 text-[#ff8a8a] border-[#ff3333]/25"
        : isLight
        ? "bg-red-500/10 text-red-700 border-red-500/30"
        : "bg-red-900/30 text-red-400 border-red-400/25"
      : isGame
      ? "bg-white/10 text-white/70 border-white/15"
      : isLight
      ? "bg-secondary text-muted-foreground border-border"
      : "bg-[#0bd1a2]/5 text-[#0bd1a2]/70 border-[#0bd1a2]/20";
  return (
    <span className={cn(
      "inline-block text-xs px-2 py-0.5 border whitespace-nowrap",
      isGame ? "rounded-[2px]" : "rounded-md",
      tone
    )}>
      {label}
    </span>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = getFundedEntityIds().map((entityId) => ({ params: { entityId } }));
  return { paths, fallback: "blocking" };
};

export const getStaticProps: GetStaticProps<EntityProfilePageProps> = async ({
  params,
  locale,
}) => {
  const entityId = typeof params?.entityId === "string" ? params.entityId : "";
  // Reject "unknown" and any unmapped entityId — these aren't real profiles.
  if (!entityId || !TREASURY_ENTITIES[entityId] || !getFundedEntityIds().includes(entityId)) {
    return { notFound: true };
  }
  const entity = getTreasuryEntity(entityId);
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  try {
    const { actions, overview, nclData, treasuryAda } = await fetchAllGovernanceData();
    return {
      props: {
        messages,
        entity,
        initialData: { actions, overview, nclData, treasuryAda },
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error(`Failed to fetch data for treasury entity ${entityId}:`, error);
    return {
      props: {
        messages,
        entity,
        initialData: { actions: [], overview: null, nclData: [] },
      },
      revalidate: 30,
    };
  }
};
