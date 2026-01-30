/**
 * Server-side data fetching for ISR/SSG
 * These functions fetch directly from the backend API for use in getStaticProps/getServerSideProps
 */

import type {
  GovernanceAction,
  OverviewSummary,
  NCLYearData,
  NCLDisplayData,
} from "@/types/governance";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:3001";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || "";

/**
 * Fetch from backend API with authentication
 */
async function fetchBackend<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(BACKEND_API_KEY && { "X-API-Key": BACKEND_API_KEY }),
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Convert lovelace string to ADA number
 */
function lovelaceToAdaNumber(lovelace: string | undefined): number {
  if (!lovelace) return 0;
  const adaValue = Number(lovelace) / 1_000_000;
  return Number.isFinite(adaValue) ? adaValue : 0;
}

/**
 * Transform NCL data to display format
 */
function transformNCLData(data: NCLYearData): NCLDisplayData {
  const currentAda = lovelaceToAdaNumber(data.currentValue);
  const targetAda = lovelaceToAdaNumber(data.targetValue);
  const percentUsed = targetAda > 0 ? (currentAda / targetAda) * 100 : 0;

  return {
    year: data.year,
    currentValueAda: currentAda,
    targetValueAda: targetAda,
    percentUsed,
    epoch: data.epoch,
    updatedAt: data.updatedAt,
  };
}

/**
 * Transform governance action for frontend
 */
function transformGovernanceAction(action: GovernanceAction): GovernanceAction {
  const derivedTxHash =
    action.txHash ||
    (action.hash ? action.hash.split(/[:#]/)[0] : undefined);

  const drepYesAda = lovelaceToAdaNumber(action.drep?.yesLovelace);
  const drepNoAda = lovelaceToAdaNumber(action.drep?.noLovelace);
  const drepAbstainAda = lovelaceToAdaNumber(action.drep?.abstainLovelace);

  const spoYesAda = action.spo ? lovelaceToAdaNumber(action.spo.yesLovelace) : undefined;
  const spoNoAda = action.spo ? lovelaceToAdaNumber(action.spo.noLovelace) : undefined;
  const spoAbstainAda = action.spo ? lovelaceToAdaNumber(action.spo.abstainLovelace) : undefined;

  return {
    hash: action.hash,
    proposalId: action.proposalId,
    txHash: derivedTxHash,
    title: action.title || "Untitled Proposal",
    type: action.type,
    status: action.status,
    constitutionality: action.constitutionality || "Unspecified",
    drepYesPercent: action.drep?.yesPercent ?? 0,
    drepNoPercent: action.drep?.noPercent ?? 0,
    drepAbstainPercent: action.drep?.abstainPercent ?? 0,
    drepYesAda,
    drepNoAda,
    drepAbstainAda,
    spoYesPercent: action.spo?.yesPercent,
    spoNoPercent: action.spo?.noPercent,
    spoAbstainPercent: action.spo?.abstainPercent,
    spoYesAda,
    spoNoAda,
    spoAbstainAda,
    ccYesPercent: action.cc?.yesPercent,
    ccNoPercent: action.cc?.noPercent,
    ccAbstainPercent: action.cc?.abstainPercent,
    ccYesCount: action.cc?.yesCount,
    ccNoCount: action.cc?.noCount,
    ccAbstainCount: action.cc?.abstainCount,
    totalYes: action.totalYes ?? 0,
    totalNo: action.totalNo ?? 0,
    totalAbstain: action.totalAbstain ?? 0,
    submissionEpoch: action.submissionEpoch ?? 0,
    expiryEpoch: action.expiryEpoch ?? 0,
    threshold: action.threshold,
    votingStatus: action.votingStatus,
    rawVotingPowerValues: action.rawVotingPowerValues,
    drepBreakdown: (action.drep as { breakdown?: typeof action.drepBreakdown })?.breakdown ?? action.drepBreakdown,
    spoBreakdown: (action.spo as { breakdown?: typeof action.spoBreakdown })?.breakdown ?? action.spoBreakdown,
    governanceActionType: action.governanceActionType ?? action.type,
    drep: action.drep ? { ...action.drep, yesAda: drepYesAda, noAda: drepNoAda, abstainAda: drepAbstainAda } : undefined,
    spo: action.spo ? { ...action.spo, yesAda: spoYesAda, noAda: spoNoAda, abstainAda: spoAbstainAda } : undefined,
    cc: action.cc,
  };
}

/**
 * Remove undefined values from object (JSON serialization requirement)
 */
function sanitizeForJson<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Server-side fetch for governance actions
 */
export async function fetchGovernanceActionsServer(): Promise<GovernanceAction[]> {
  try {
    const data = await fetchBackend<GovernanceAction[]>("/overview/proposals");
    const transformed = data.map(transformGovernanceAction);
    // Sanitize to remove undefined values for JSON serialization
    return sanitizeForJson(transformed);
  } catch (error) {
    console.error("Failed to fetch governance actions server-side:", error);
    return [];
  }
}

/**
 * Server-side fetch for overview summary
 */
export async function fetchOverviewSummaryServer(): Promise<OverviewSummary | null> {
  try {
    return await fetchBackend<OverviewSummary>("/overview");
  } catch (error) {
    console.error("Failed to fetch overview server-side:", error);
    return null;
  }
}

/**
 * Server-side fetch for NCL data
 */
export async function fetchNCLDataServer(): Promise<NCLDisplayData[]> {
  try {
    const data = await fetchBackend<NCLYearData[]>("/overview/ncl");
    return data.map(transformNCLData);
  } catch (error) {
    console.error("Failed to fetch NCL data server-side:", error);
    return [];
  }
}

/**
 * Fetch all governance data for ISR
 */
export async function fetchAllGovernanceData() {
  const [actions, overview, nclData] = await Promise.all([
    fetchGovernanceActionsServer(),
    fetchOverviewSummaryServer(),
    fetchNCLDataServer(),
  ]);

  return { actions, overview, nclData };
}
