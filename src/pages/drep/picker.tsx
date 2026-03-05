import { useMemo } from "react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import DRepPicker from "@/components/dreps/DRepPicker";
import DRepPageLayout from "@/components/dreps/DRepPageLayout";
import { FadeIn } from "@/components/ui/fade-in";
import {
  fetchDRepStatsServer,
  fetchAllDRepsServer,
  type DRepServerItem,
} from "@/lib/serverFetch";
import type { DRepStatsApiResponse } from "@/hooks/useDRepData";
import type { DRepSummary } from "@/types/drep";

type IntlMessages = typeof import("@/messages/en.json");

interface DRepPickerPageProps {
  messages: IntlMessages;
  initialData: {
    drepStats: DRepStatsApiResponse | null;
    allDreps: DRepServerItem[];
  };
}

function transformServerDreps(items: DRepServerItem[]): DRepSummary[] {
  return items.map((d) => ({
    drepId: d.drepId,
    name: d.name,
    iconUrl: d.iconUrl,
    votingPower: d.votingPower,
    votingPowerAda: parseFloat(d.votingPowerAda) || 0,
    totalVotesCast: d.totalVotesCast,
    delegatorCount: d.delegatorCount ?? null,
  }));
}

export default function DRepPickerPage({ initialData }: InferGetStaticPropsType<typeof getStaticProps>) {
  const initialDreps = useMemo(
    () => initialData?.allDreps?.length ? transformServerDreps(initialData.allDreps) : undefined,
    [initialData?.allDreps]
  );

  return (
    <DRepPageLayout
      initialDrepStats={initialData?.drepStats ?? null}
      initialDreps={initialDreps}
    >
      <FadeIn delay={0} duration={400} distance={16} force>
        <DRepPicker initialDreps={initialDreps} />
      </FadeIn>
    </DRepPageLayout>
  );
}

export const getStaticProps: GetStaticProps<DRepPickerPageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  try {
    const [drepStats, allDreps] = await Promise.all([
      fetchDRepStatsServer(),
      fetchAllDRepsServer(),
    ]);

    return {
      props: { messages, initialData: { drepStats, allDreps } },
      revalidate: 60,
    };
  } catch (error) {
    console.error("Failed to fetch DRep data for ISR:", error);
    return {
      props: { messages, initialData: { drepStats: null, allDreps: [] } },
      revalidate: 30,
    };
  }
};
