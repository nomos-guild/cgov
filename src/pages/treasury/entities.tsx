import { useEffect, useMemo } from "react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { useTranslations } from "next-intl";
import TreasuryPageLayout from "@/components/treasury/TreasuryPageLayout";
import {
  useGovernanceActions,
  type InitialGovernanceData,
} from "@/hooks/useGovernanceData";
import { fetchAllGovernanceData } from "@/lib/serverFetch";
import { useTheme } from "@/lib/theme";
import {
  UNCLASSIFIED_ENTITY_ID,
  getTreasuryEntity,
  resolveProposalEntity,
  type TreasuryEntity,
} from "@/lib/treasuryEntities";
import { formatNumber } from "@/lib/drepFormatters";
import { cn } from "@/lib/utils";
import type { GovernanceAction } from "@/types/governance";

type IntlMessages = typeof import("@/messages/en.json");

const APPROVED_STATUSES = new Set<GovernanceAction["status"]>(["Enacted", "Ratified"]);

interface EntitiesPageProps {
  messages: IntlMessages;
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

interface EntityRow {
  entity: TreasuryEntity;
  approvedAda: number;
  pendingAda: number;
  requestedAda: number;
  proposalsCount: number;
}

export default function FundedEntitiesPage({
  initialData,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const t = useTranslations("treasury");
  const tProfile = useTranslations("treasury.profile");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const { actions, refresh } = useGovernanceActions(initialData?.actions);

  // Force one revalidation on mount — the SWR hook skips the initial fetch
  // when fallbackData is provided, so without this nudge the cards would
  // forever show whatever snapshot ISR baked in at build time.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows: EntityRow[] = useMemo(() => {
    const acc = new Map<
      string,
      {
        approvedAda: number;
        pendingAda: number;
        requestedAda: number;
        proposalsCount: number;
      }
    >();

    for (const action of actions) {
      const resolved = resolveProposalEntity(action);
      if (!resolved || resolved.entityId === UNCLASSIFIED_ENTITY_ID) continue;

      const ada = lovelaceToAda(action.withdrawalAmount);
      const entry =
        acc.get(resolved.entityId) ?? {
          approvedAda: 0,
          pendingAda: 0,
          requestedAda: 0,
          proposalsCount: 0,
        };
      entry.requestedAda += ada;
      if (APPROVED_STATUSES.has(action.status)) entry.approvedAda += ada;
      else if (action.status === "Active") entry.pendingAda += ada;
      entry.proposalsCount += 1;
      acc.set(resolved.entityId, entry);
    }

    const built: EntityRow[] = [];
    for (const [entityId, agg] of acc.entries()) {
      built.push({
        entity: getTreasuryEntity(entityId),
        approvedAda: agg.approvedAda,
        pendingAda: agg.pendingAda,
        requestedAda: agg.requestedAda,
        proposalsCount: agg.proposalsCount,
      });
    }
    // Sort: largest approved + pending first (so entities with big pending
    // requests don't sink to the bottom while their proposal is in voting).
    // Ties broken by proposals count, then label.
    built.sort((a, b) => {
      const aActive = a.approvedAda + a.pendingAda;
      const bActive = b.approvedAda + b.pendingAda;
      if (bActive !== aActive) return bActive - aActive;
      if (b.proposalsCount !== a.proposalsCount) return b.proposalsCount - a.proposalsCount;
      return a.entity.label.localeCompare(b.entity.label);
    });
    return built;
  }, [actions]);

  const cardClass = isGame
    ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-5 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)] hover:bg-[rgba(20,20,20,0.6)]"
    : isLight
    ? "rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-elevation-2 hover:shadow-elevation-3 hover:border-foreground/20"
    : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-5 shadow-none hover:bg-[#0bd1a2]/5";

  return (
    <>
      <Head>
        <title>{t("tabFundedEntities")}</title>
        <meta name="description" content={t("entitiesIntro")} />
      </Head>
      <TreasuryPageLayout initialData={initialData}>
        <div className={cn(
          "mb-4 text-sm",
          isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"
        )}>
          {t("entitiesIntro")}
        </div>

        {rows.length === 0 ? (
          <p className={cn(
            "text-sm",
            isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
          )}>
            {t("noFundedEntities")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {rows.map((row) => (
              <Link
                key={row.entity.entityId}
                href={`/treasury/${row.entity.entityId}`}
                className={cn(
                  "block transition-all duration-normal cursor-pointer",
                  cardClass
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  {row.entity.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.entity.iconUrl}
                      alt={row.entity.label}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <h3 className={cn(
                    "text-sm sm:text-base font-semibold truncate",
                    isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                  )}>
                    {row.entity.label}
                  </h3>
                </div>

                <dl className={cn(
                  "space-y-1.5 text-xs sm:text-sm",
                  isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"
                )}>
                  <div className="flex items-baseline justify-between">
                    <dt>{tProfile("totalReceived")}</dt>
                    <dd className={cn(
                      "font-mono font-semibold",
                      isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                    )}>
                      {formatAda(row.approvedAda)}
                    </dd>
                  </div>
                  {row.pendingAda > 0 && (
                    <div className="flex items-baseline justify-between">
                      <dt>{tProfile("pending")}</dt>
                      <dd className={cn(
                        "font-mono",
                        isGame ? "text-[#fbbf24]" : isLight ? "text-amber-700" : "text-[#fbbf24]"
                      )}>
                        {formatAda(row.pendingAda)}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <dt>{tProfile("proposalsCount")}</dt>
                    <dd className={cn(
                      "font-mono",
                      isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                    )}>
                      {formatNumber(row.proposalsCount)}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </TreasuryPageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<EntitiesPageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  try {
    const { actions, overview, nclData, treasuryAda } = await fetchAllGovernanceData();
    return {
      props: {
        messages,
        initialData: { actions, overview, nclData, treasuryAda },
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error("Failed to fetch data for funded entities ISR:", error);
    return {
      props: {
        messages,
        initialData: { actions: [], overview: null, nclData: [] },
      },
      revalidate: 30,
    };
  }
};
