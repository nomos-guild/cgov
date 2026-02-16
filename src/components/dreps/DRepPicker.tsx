import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";

import type { DRepSummary } from "@/types/drep";
import { useTheme } from "@/lib/theme";
import { useAllDReps, useDRepRationaleStats, useDRepVoteChanges } from "@/hooks/useDRepData";
import DRepPickerFilters from "@/components/dreps/DRepPickerFilters";
import DRepPickerResults from "@/components/dreps/DRepPickerResults";
import type { EnrichedDRep } from "@/components/dreps/DRepPickerResults";

interface DRepPickerProps {
  initialDreps?: DRepSummary[];
}

function formatVotingPower(value: number, decimals: number = 1): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(decimals)}K`;
  return value.toLocaleString();
}

// Quadratic scale: slider position ↔ actual value
// Gives much more resolution in lower ranges where most DReps cluster
const SCALE_STEPS = 1000;

function toActual(pos: number, max: number): number {
  const t = pos / SCALE_STEPS;
  return max * t * t;
}

function toPos(fraction: number): number {
  return Math.round(SCALE_STEPS * Math.sqrt(Math.max(0, Math.min(1, fraction))));
}


export default function DRepPicker({ initialDreps }: DRepPickerProps) {
  const t = useTranslations("drep");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  // Data hooks — rationaleStats & voteChanges fetched client-side only (too slow for ISR)
  const { dreps: allDreps, isLoading: loadingDreps } = useAllDReps({}, initialDreps);
  const { dreps: rationaleStats, isLoading: loadingRationale } = useDRepRationaleStats();
  const { dreps: voteChangeStats, isLoading: loadingChanges } = useDRepVoteChanges();

  const isLoading = loadingDreps || loadingRationale || loadingChanges;

  // Enrich DRep data by joining the 3 sources
  const enrichedDreps = useMemo(() => {
    if (!allDreps.length) return [];

    const rationaleMap = new Map<string, { rationalesProvided: number; participationPercent: number; totalVotesCast: number }>();
    for (const r of rationaleStats) {
      rationaleMap.set(r.drepId, {
        rationalesProvided: r.rationalesProvided,
        participationPercent: r.proposalParticipationPercent,
        totalVotesCast: r.totalVotesCast,
      });
    }

    const voteChangeMap = new Map<string, { uniqueProposals: number; voteChanges: number }>();
    for (const v of voteChangeStats) {
      voteChangeMap.set(v.drepId, { uniqueProposals: v.uniqueProposals, voteChanges: v.voteChanges });
    }

    return allDreps.map((d): EnrichedDRep => {
      const rationale = rationaleMap.get(d.drepId);
      const changes = voteChangeMap.get(d.drepId);
      const votes = rationale?.totalVotesCast ?? d.totalVotesCast;

      return {
        drepId: d.drepId,
        name: d.name,
        iconUrl: d.iconUrl ?? null,
        votingPowerAda: d.votingPowerAda,
        delegatorCount: d.delegatorCount,
        totalVotesCast: d.totalVotesCast,
        activityPercent: rationale?.participationPercent ?? 0,
        rationalePercent: votes > 0 && rationale
          ? (rationale.rationalesProvided / votes) * 100
          : 0,
        flexibilityPercent: changes && changes.uniqueProposals > 0
          ? (changes.voteChanges / changes.uniqueProposals) * 100
          : 0,
      };
    });
  }, [allDreps, rationaleStats, voteChangeStats]);

  // Compute bounds + percentile breakpoints from data
  const bounds = useMemo(() => {
    if (!enrichedDreps.length) return { maxDelegators: 1, maxVotingPower: 1 };

    let maxDel = 1;
    let maxVP = 1;
    for (const d of enrichedDreps) {
      const del = d.delegatorCount ?? 0;
      if (del > maxDel) maxDel = del;
      if (d.votingPowerAda > maxVP) maxVP = d.votingPowerAda;
    }

    return { maxDelegators: maxDel, maxVotingPower: maxVP };
  }, [enrichedDreps]);

  // Slider state — percentage sliders are linear, delegators/VP use quadratic scale positions
  const [votingActivity, setVotingActivity] = useState<[number, number]>([0, 100]);
  const [rationales, setRationales] = useState<[number, number]>([0, 100]);
  const [delegatorsPos, setDelegatorsPos] = useState<[number, number]>([0, SCALE_STEPS]);
  const [votingPowerPos, setVotingPowerPos] = useState<[number, number]>([0, SCALE_STEPS]);

  // Convert quadratic slider positions to actual values for filtering
  const delMin = toActual(delegatorsPos[0], bounds.maxDelegators);
  const delMax = toActual(delegatorsPos[1], bounds.maxDelegators);
  const vpMin = toActual(votingPowerPos[0], bounds.maxVotingPower);
  const vpMax = toActual(votingPowerPos[1], bounds.maxVotingPower);

  // Filter enriched DReps
  const filteredDreps = useMemo(() => {
    return enrichedDreps.filter((d) => {
      if (d.activityPercent < votingActivity[0] || d.activityPercent > votingActivity[1]) return false;
      if (d.rationalePercent < rationales[0] || d.rationalePercent > rationales[1]) return false;
      const del = d.delegatorCount ?? 0;
      if (del < delMin || del > delMax) return false;
      if (d.votingPowerAda < vpMin || d.votingPowerAda > vpMax) return false;
      return true;
    });
  }, [enrichedDreps, votingActivity, rationales, delMin, delMax, vpMin, vpMax]);

  const totalVotingPower = useMemo(
    () => enrichedDreps.reduce((sum, d) => sum + d.votingPowerAda, 0),
    [enrichedDreps]
  );

  const handleReset = () => {
    setVotingActivity([0, 100]);
    setRationales([0, 100]);
    setDelegatorsPos([0, SCALE_STEPS]);
    setVotingPowerPos([0, SCALE_STEPS]);
  };

  // Build filter configs
  // Percentage sliders: linear 0-100
  // Delegators/VP sliders: quadratic 0-SCALE_STEPS, formatValue converts to actual
  const pctFormat = (v: number) => `${v}%`;
  const delFormat = (pos: number) => Math.round(toActual(pos, bounds.maxDelegators)).toLocaleString();
  const vpFormat = (pos: number) => `${formatVotingPower(toActual(pos, bounds.maxVotingPower))} ₳`;

  // Percentile-based presets — divides the DRep population into thirds
  const low = t("presetLow");
  const med = t("presetMedium");
  const high = t("presetHigh");

  const actPresets = [
    { label: low, range: [0, 30] as [number, number] },
    { label: med, range: [30, 60] as [number, number] },
    { label: high, range: [60, 100] as [number, number] },
  ];
  const ratPresets = [
    { label: low, range: [0, 20] as [number, number] },
    { label: med, range: [20, 50] as [number, number] },
    { label: high, range: [50, 100] as [number, number] },
  ];
  // Fixed presets for delegators: 1-100, 100-1000, 1000+
  const maxDel = bounds.maxDelegators;
  const delPresets = [
    { label: low, range: [toPos(1 / maxDel), toPos(100 / maxDel)] as [number, number] },
    { label: med, range: [toPos(100 / maxDel), toPos(1000 / maxDel)] as [number, number] },
    { label: high, range: [toPos(1000 / maxDel), SCALE_STEPS] as [number, number] },
  ];
  // Fixed presets for voting power: 100-1M, 1M-50M, 50M+
  const maxVP = bounds.maxVotingPower;
  const vpPresets = [
    { label: low, range: [toPos(100 / maxVP), toPos(1_000_000 / maxVP)] as [number, number] },
    { label: med, range: [toPos(1_000_000 / maxVP), toPos(50_000_000 / maxVP)] as [number, number] },
    { label: high, range: [toPos(50_000_000 / maxVP), SCALE_STEPS] as [number, number] },
  ];

  const filters = [
    {
      label: t("filterVotingActivity"),
      description: t("filterVotingActivityDesc"),
      value: votingActivity,
      min: 0, max: 100, step: 1,
      formatValue: pctFormat,
      onCommit: setVotingActivity,
      presets: actPresets,
    },
    {
      label: t("filterRationales"),
      description: t("filterRationalesDesc"),
      value: rationales,
      min: 0, max: 100, step: 1,
      formatValue: pctFormat,
      onCommit: setRationales,
      presets: ratPresets,
    },
    {
      label: t("filterDelegators"),
      description: t("filterDelegatorsDesc"),
      value: delegatorsPos,
      min: 0, max: SCALE_STEPS, step: 1,
      formatValue: delFormat,
      onCommit: setDelegatorsPos,
      presets: delPresets,
    },
    {
      label: t("filterVotingPower"),
      description: t("filterVotingPowerDesc"),
      value: votingPowerPos,
      min: 0, max: SCALE_STEPS, step: 1,
      formatValue: vpFormat,
      onCommit: setVotingPowerPos,
      presets: vpPresets,
    },
  ];

  if (isLoading) {
    return (
      <div className={`text-center py-16 text-xs ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
        {t("loadingPickerData")}
      </div>
    );
  }

  const chartCardClass = isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : isGame
    ? "game-detail-card rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent shadow-none";

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-4">
      {/* Left column: chart + filters */}
      <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-4">
        {/* Chart card */}
        <div className={`${chartCardClass} p-4 sm:p-6 min-h-[280px] flex items-center justify-center`}>
          <img
            src={isLight ? "/images/Cardano-RGB_Logo-Icon-Black.svg" : "/images/Cardano-RGB_Logo-Icon-White.svg"}
            alt="Cardano"
            className={`w-36 h-36 ${isLight ? "opacity-15" : isGame ? "opacity-10" : "opacity-15"}`}
          />
        </div>

        {/* Filters */}
        <DRepPickerFilters
          filters={filters}
          matchCount={filteredDreps.length}
          totalCount={enrichedDreps.length}
          onReset={handleReset}
        />
      </div>

      {/* Results — relative wrapper so absolute child doesn't affect row height */}
      <div className="flex-1 min-w-0 relative">
        <div className="absolute inset-0">
          <DRepPickerResults dreps={filteredDreps} totalVotingPower={totalVotingPower} />
        </div>
      </div>
    </div>
  );
}
