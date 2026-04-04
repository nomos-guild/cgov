import { useMemo } from "react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import Head from "next/head";
import { useTranslations } from "next-intl";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";
import { GovernanceStats } from "@/components/GovernanceStats";
import { useGovernanceDataLoader, type InitialGovernanceData } from "@/hooks/useGovernanceData";
import { fetchAllGovernanceData } from "@/lib/serverFetch";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { FadeIn } from "@/components/ui/fade-in";
import ProposalPageLayout from "@/components/governance/ProposalPageLayout";
import { useAppSelector } from "@/store/hooks";

type IntlMessages = typeof import("@/messages/en.json");

interface AnalyticsProps {
  initialData: InitialGovernanceData;
  messages: IntlMessages;
}

export default function Analytics({ initialData }: InferGetStaticPropsType<typeof getStaticProps>) {
  const t = useTranslations();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isDarkTheme = activeTheme.isDark;

  const { isLoading, error, hasData, refresh } = useGovernanceDataLoader(initialData);
  const showLoadingSpinner = isLoading && !hasData && !error;

  const { treasuryHistory } = useAppSelector((state) => state.governance);

  // Compute per-epoch earnings from treasury history
  const earningsHistory = useMemo(() => {
    if (treasuryHistory.length < 2) return [];
    const history: Array<{ epoch: number; earningsAda: number }> = [];
    for (let i = 1; i < treasuryHistory.length; i++) {
      history.push({
        epoch: treasuryHistory[i].epoch,
        earningsAda: treasuryHistory[i].treasuryAda - treasuryHistory[i - 1].treasuryAda,
      });
    }
    return history;
  }, [treasuryHistory]);

  const strokeColor = isDarkTheme ? "#0bd1a2" : "#000000";
  const axisColor = isDarkTheme ? "rgba(11, 209, 162, 0.5)" : "rgba(0, 0, 0, 0.35)";
  const gridColor = isDarkTheme ? "rgba(11, 209, 162, 0.08)" : "rgba(0, 0, 0, 0.06)";

  const formatAdaValue = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
    return value.toLocaleString();
  };

  const formatSpentValue = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toLocaleString();
  };

  const formatAxisAda = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return `${value}`;
  };

  const cardClass = "rounded-2xl border border-border bg-card p-4 sm:p-5 md:p-6 shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none";

  return (
    <>
      <Head>
        <title>{t("meta.homeTitle")}</title>
        <meta name="description" content={t("meta.homeDescription")} />
      </Head>
      <div className="min-h-screen bg-background overflow-visible">
        <div className="container mx-auto px-3 pt-8 pb-4 sm:px-4 sm:pt-10 sm:pb-6 md:px-6 md:pt-12 md:pb-8 overflow-visible">
          <FadeIn delay={0} duration={400} distance={12}>
            <div className="mb-6 sm:mb-8 md:mb-10 text-left">
              <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-foreground">
                {t("landing.title")}
              </h1>
            </div>
          </FadeIn>

          {error && (
            <Card className="p-4 sm:p-6 mb-4 sm:mb-6 border-destructive bg-destructive/10">
              <div className="text-center">
                <p className="text-destructive font-medium mb-2 text-sm sm:text-base">
                  {t("errors.failedToLoadData")}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={refresh}
                  className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  {t("common.retry")}
                </button>
              </div>
            </Card>
          )}

          {showLoadingSpinner && (
            isGame ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-24">
                <GameLoader />
              </div>
            ) : (
              <Card className="p-6 sm:p-8 md:p-12 mb-4 sm:mb-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-primary mb-3 sm:mb-4"></div>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {t("errors.loadingGovernanceData")}
                  </p>
                </div>
              </Card>
            )
          )}

          {(hasData || (!isLoading && !error)) && !showLoadingSpinner && (
            <>
              <FadeIn delay={120} duration={500} distance={18} className="relative z-20">
                <GovernanceStats />
              </FadeIn>
              <ProposalPageLayout>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  {/* Treasury Balance Over Time */}
                  <div className={cardClass}>
                    <h3 className={`text-sm sm:text-base font-semibold mb-4 ${isDarkTheme ? "text-[#0bd1a2]" : "text-black"}`}>
                      {t("stats.treasury")}
                    </h3>
                    {treasuryHistory.length > 1 ? (
                      <div className="w-full h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={treasuryHistory} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                            <defs>
                              <linearGradient id="treasuryFillLg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
                                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis
                              dataKey="epoch"
                              tick={{ fontSize: 11, fill: axisColor }}
                              tickLine={false}
                              axisLine={{ stroke: axisColor, strokeWidth: 0.5 }}
                              interval="preserveStartEnd"
                              tickCount={7}
                            />
                            <YAxis
                              tickFormatter={formatAxisAda}
                              tick={{ fontSize: 11, fill: axisColor }}
                              tickLine={false}
                              axisLine={false}
                              width={50}
                            />
                            <Area
                              type="monotone"
                              dataKey="treasuryAda"
                              stroke={strokeColor}
                              strokeWidth={2}
                              fill="url(#treasuryFillLg)"
                              dot={false}
                              isAnimationActive={false}
                            />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null;
                                const { epoch, treasuryAda: val } = payload[0].payload as { epoch: number; treasuryAda: number };
                                return (
                                  <div className={`px-3 py-2 rounded text-xs shadow-lg ${isDarkTheme ? "bg-black/90 text-[#0bd1a2] border border-[#0bd1a2]/30" : "bg-white text-black border border-gray-200"}`}>
                                    <div className="font-medium">Epoch {epoch}</div>
                                    <div>₳ {formatAdaValue(val)}</div>
                                  </div>
                                );
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
                    )}
                  </div>

                  {/* Earnings Per Epoch */}
                  <div className={cardClass}>
                    <h3 className={`text-sm sm:text-base font-semibold mb-4 ${isDarkTheme ? "text-[#0bd1a2]" : "text-black"}`}>
                      {t("stats.epochEarnings")}
                    </h3>
                    {earningsHistory.length > 1 ? (
                      <div className="w-full h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={earningsHistory} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis
                              dataKey="epoch"
                              tick={{ fontSize: 11, fill: axisColor }}
                              tickLine={false}
                              axisLine={{ stroke: axisColor, strokeWidth: 0.5 }}
                              interval="preserveStartEnd"
                              tickCount={7}
                            />
                            <YAxis
                              tickFormatter={formatAxisAda}
                              tick={{ fontSize: 11, fill: axisColor }}
                              tickLine={false}
                              axisLine={false}
                              width={50}
                            />
                            <Bar
                              dataKey="earningsAda"
                              isAnimationActive={false}
                              fill={strokeColor}
                              opacity={0.6}
                              radius={[2, 2, 0, 0]}
                            />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null;
                                const { epoch, earningsAda } = payload[0].payload as { epoch: number; earningsAda: number };
                                return (
                                  <div className={`px-3 py-2 rounded text-xs shadow-lg ${isDarkTheme ? "bg-black/90 text-[#0bd1a2] border border-[#0bd1a2]/30" : "bg-white text-black border border-gray-200"}`}>
                                    <div className="font-medium">Epoch {epoch}</div>
                                    <div className={earningsAda < 0 ? "text-red-500" : ""}>
                                      {earningsAda < 0 ? "-" : "+"}₳ {formatSpentValue(Math.abs(earningsAda))}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
                    )}
                  </div>
                </div>
              </ProposalPageLayout>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<AnalyticsProps> = async ({ locale }) => {
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
    console.error("Failed to fetch data for analytics ISR:", error);
    return {
      props: {
        messages,
        initialData: { actions: [], overview: null, nclData: [] },
      },
      revalidate: 30,
    };
  }
};
