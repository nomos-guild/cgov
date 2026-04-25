import type { GetStaticProps, InferGetStaticPropsType } from "next";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { SeoHead } from "@/components/SeoHead";
import TreasuryPageLayout from "@/components/treasury/TreasuryPageLayout";
import { type InitialGovernanceData } from "@/hooks/useGovernanceData";
import { fetchAllGovernanceData } from "@/lib/serverFetch";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";

// Lazy-load the Sankey to keep d3-sankey + chart layout code out of the
// initial bundle — matches the pattern used for other heavy charts in
// dashboards/{governance,development_activity}/charts/index.tsx.
const TreasuryFlowSankey = dynamic(
  () =>
    import("@/components/treasury/TreasuryFlowSankey").then(
      (mod) => mod.TreasuryFlowSankey
    ),
  { loading: () => <ChartSkeleton />, ssr: false }
);

type IntlMessages = typeof import("@/messages/en.json");

interface TreasuryProps {
  initialData: InitialGovernanceData;
  messages: IntlMessages;
}

export default function Treasury({ initialData }: InferGetStaticPropsType<typeof getStaticProps>) {
  const t = useTranslations();

  return (
    <>
      <SeoHead
        title={t("meta.homeTitle")}
        description={t("meta.homeDescription")}
      />
      <TreasuryPageLayout initialData={initialData}>
        <TreasuryFlowSankey />
      </TreasuryPageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<TreasuryProps> = async ({ locale }) => {
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
    console.error("Failed to fetch data for treasury ISR:", error);
    return {
      props: {
        messages,
        initialData: { actions: [], overview: null, nclData: [] },
      },
      revalidate: 30,
    };
  }
};
