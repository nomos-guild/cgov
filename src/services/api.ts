/**
 * API Service
 * Handles all API calls to the backend for governance data
 */

import { API_ENDPOINTS, API_KEY } from "@/config/api";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  OverviewSummary,
  VoteRecord,
  NCLYearData,
  NCLDisplayData,
} from "@/types/governance";

/**
 * Generic fetch wrapper with error handling and API key authentication
 */
async function fetchApi<T>(url: string): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add API key header if configured
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API Error (${response.status}): ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch overview summary statistics
 * Returns: proposal counts by status
 */
export async function fetchOverviewSummary(): Promise<OverviewSummary> {
  return fetchApi<OverviewSummary>(API_ENDPOINTS.overview);
}

/**
 * Convert lovelace string to ADA number
 * 1 ADA = 1,000,000 lovelace
 */
function lovelaceToAda(lovelace: string): number {
  return Number(lovelace) / 1_000_000;
}

/**
 * Transform NCL API response to display format (lovelace to ADA)
 */
function transformNCLData(data: NCLYearData): NCLDisplayData {
  const currentAda = lovelaceToAda(data.currentValue);
  const targetAda = lovelaceToAda(data.targetValue);
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
 * Fetch NCL data for all years
 * Returns: Array of NCL data with values in ADA
 */
export async function fetchNCLData(): Promise<NCLDisplayData[]> {
  const data = await fetchApi<NCLYearData[]>(API_ENDPOINTS.ncl);
  return data.map(transformNCLData);
}

/**
 * Fetch NCL data for the current year
 * Returns: NCL data for current year with values in ADA, or null if not found
 */
export async function fetchCurrentYearNCL(): Promise<NCLDisplayData | null> {
  const currentYear = new Date().getFullYear();
  try {
    const data = await fetchApi<NCLYearData>(API_ENDPOINTS.nclByYear(currentYear));
    return transformNCLData(data);
  } catch (error) {
    console.error(`Failed to fetch NCL data for year ${currentYear}:`, error);
    return null;
  }
}

/**
 * Fetch all governance actions for the dashboard
 * Returns: Array of governance actions with voting tallies
 */
export async function fetchGovernanceActions(): Promise<GovernanceAction[]> {
  const data = await fetchApi<GovernanceAction[]>(API_ENDPOINTS.proposals);

  // Dev-only logging of raw API payload (pre-transform)
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[API] /proposals raw response", data);
  }

  // Transform API response to match frontend expected format
  return data.map(transformGovernanceAction);
}

/**
 * Fetch detailed governance action by ID
 * @param proposalId - Can be numeric ID, txHash, or txHash:certIndex
 * Returns: Full governance action detail with vote records
 */
export async function fetchGovernanceActionDetail(
  proposalId: string
): Promise<GovernanceActionDetail | null> {
  try {
    const data = await fetchApi<GovernanceActionDetail>(
      API_ENDPOINTS.proposalDetail(proposalId)
    );

    // Dev-only logging of raw detail payload (pre-transform)
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[API] /proposal detail raw response", {
        proposalId,
        data,
      });
    }

    return transformGovernanceActionDetail(data);
  } catch (error) {
    console.error(`Failed to fetch proposal ${proposalId}:`, error);
    return null;
  }
}

/**
 * Convert lovelace string to ADA number (divide by 1,000,000).
 * Returns 0 for missing or invalid values.
 */
function lovelaceToAdaNumber(lovelace: string | undefined): number {
  if (!lovelace) return 0;
  const adaValue = Number(lovelace) / 1_000_000;
  return Number.isFinite(adaValue) ? adaValue : 0;
}

/**
 * Transform API governance action to frontend format
 * Maps API field names to frontend expected format
 * Converts lovelace values to ADA for display
 */
function transformGovernanceAction(action: GovernanceAction): GovernanceAction {
  // Convert lovelace to ADA numbers for DRep
  const drepYesAda = lovelaceToAdaNumber(action.drep?.yesLovelace);
  const drepNoAda = lovelaceToAdaNumber(action.drep?.noLovelace);
  const drepAbstainAda = lovelaceToAdaNumber(action.drep?.abstainLovelace);

  // Convert lovelace to ADA numbers for SPO
  const spoYesAda = action.spo
    ? lovelaceToAdaNumber(action.spo.yesLovelace)
    : undefined;
  const spoNoAda = action.spo
    ? lovelaceToAdaNumber(action.spo.noLovelace)
    : undefined;
  const spoAbstainAda = action.spo
    ? lovelaceToAdaNumber(action.spo.abstainLovelace)
    : undefined;

  return {
    // Keep original hash (txHash:certIndex format) for voting transactions
    // Use proposalId for display/routing (gov_action bech32 format)
    hash: action.hash,
    proposalId: action.proposalId,
    txHash: action.txHash,
    title: action.title || "Untitled Proposal",
    type: action.type,
    status: action.status,
    constitutionality: action.constitutionality || "Unspecified",

    // DRep voting data (required)
    drepYesPercent: action.drep?.yesPercent ?? 0,
    drepNoPercent: action.drep?.noPercent ?? 0,
    drepAbstainPercent: action.drep?.abstainPercent ?? 0,
    drepYesAda,
    drepNoAda,
    drepAbstainAda,

    // SPO voting data (optional)
    spoYesPercent: action.spo?.yesPercent,
    spoNoPercent: action.spo?.noPercent,
    spoAbstainPercent: action.spo?.abstainPercent,
    spoYesAda,
    spoNoAda,
    spoAbstainAda,

    // CC voting data (optional)
    ccYesPercent: action.cc?.yesPercent,
    ccNoPercent: action.cc?.noPercent,
    ccAbstainPercent: action.cc?.abstainPercent,
    ccYesCount: action.cc?.yesCount,
    ccNoCount: action.cc?.noCount,
    ccAbstainCount: action.cc?.abstainCount,

    // Vote totals
    totalYes: action.totalYes ?? 0,
    totalNo: action.totalNo ?? 0,
    totalAbstain: action.totalAbstain ?? 0,

    // Epoch data
    submissionEpoch: action.submissionEpoch ?? 0,
    expiryEpoch: action.expiryEpoch ?? 0,

    // Thresholds and voting status (passed through from backend when present)
    threshold: action.threshold,
    votingStatus: action.votingStatus,

    // Pass through raw API data, augmenting with ADA values
    drep: action.drep
      ? {
          ...action.drep,
          yesAda: drepYesAda,
          noAda: drepNoAda,
          abstainAda: drepAbstainAda,
        }
      : undefined,
    spo: action.spo
      ? {
          ...action.spo,
          yesAda: spoYesAda,
          noAda: spoNoAda,
          abstainAda: spoAbstainAda,
        }
      : undefined,
    cc: action.cc,
  };
}

/**
 * Transform API governance action detail to frontend format
 */
function transformGovernanceActionDetail(
  detail: GovernanceActionDetail
): GovernanceActionDetail {
  const base = transformGovernanceAction(detail);

  return {
    ...base,
    description: detail.description,
    rationale: detail.rationale,
    votes: detail.votes?.map(transformVoteRecord) ?? [],
    ccVotes: detail.ccVotes?.map(transformVoteRecord) ?? [],
  };
}

/**
 * Transform API vote record to frontend format
 */
function transformVoteRecord(vote: VoteRecord): VoteRecord {
  return {
    voterType: vote.voterType,
    voterId: vote.voterId,
    voterName: vote.voterName,
    drepId: vote.voterId || vote.drepId, // For backwards compatibility
    drepName: vote.voterName || vote.voterId || vote.drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda: vote.votingPowerAda ?? 0,
    anchorUrl: vote.anchorUrl,
    anchorHash: vote.anchorHash,
    votedAt: vote.votedAt,
  };
}
