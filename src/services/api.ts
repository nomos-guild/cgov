/**
 * API Service
 * Handles all API calls to the backend for governance data
 *
 * All calls go through Next.js API routes which handle authentication
 * server-side, keeping any backend API keys secure.
 */

import { API_ENDPOINTS } from "@/config/api";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  OverviewSummary,
  VoteRecord,
  NCLYearData,
  NCLDisplayData,
  ProposalReferenceObject,
} from "@/types/governance";
import type {
  DevelopmentOverview,
  DevelopmentActivity,
  DevelopmentRepos,
  DevelopmentContributors,
  DevelopmentHealth,
  DevelopmentStars,
  DevelopmentLanguages,
  NetworkGraphData,
  DevelopmentRecent,
} from "@/types/development";
import type { DRepStats } from "@/types/drep";

/**
 * Generic fetch wrapper with error handling.
 *
 * NOTE: We only ever call our own Next.js API routes here. Those routes are
 * responsible for talking to the upstream Cgov API and adding any required
 * authentication (API keys, etc.) on the server side, so no secrets are
 * exposed in the browser.
 */
async function fetchApi<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    // Handle rate limiting (429) with a user-friendly message
    if (response.status === 429) {
      throw new Error(
        "Too many requests. Please wait a moment and try again."
      );
    }

    // Try to extract a meaningful error message
    const contentType = response.headers.get("content-type") || "";
    let errorMessage = response.statusText;

    if (contentType.includes("application/json")) {
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.error || errorJson.message || response.statusText;
      } catch {
        // Ignore JSON parse errors, use statusText
      }
    } else {
      // For HTML responses (like Cloudflare error pages), don't include the raw HTML
      const errorText = await response.text();
      // Check if it's an HTML page (Cloudflare error, etc.)
      if (errorText.includes("<!doctype html>") || errorText.includes("<html")) {
        errorMessage = `Request failed (${response.status}). Please try again later.`;
      } else if (errorText.length < 200) {
        // Only include short text responses
        errorMessage = errorText || response.statusText;
      }
    }

    throw new Error(errorMessage);
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
// Known NCL targets (in ADA) – fallback when backend returns 0
const NCL_TARGETS_ADA: Record<number, number> = {
  2025: 350_000_000,
  2026: 350_000_000,
};

function transformNCLData(data: NCLYearData): NCLDisplayData {
  const currentAda = lovelaceToAda(data.currentValue);
  let targetAda = lovelaceToAda(data.targetValue);
  if (targetAda === 0 && NCL_TARGETS_ADA[data.year]) {
    targetAda = NCL_TARGETS_ADA[data.year];
  }
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
  // Derive txHash from hash when backend doesn't send it explicitly.
  // The upstream API typically encodes the transaction hash and certificate
  // index together in the `hash` field as `txHash:certIndex` (or `txHash#certIndex`).
  // We still prefer an explicit txHash field from the API when present.
  const derivedTxHash =
    action.txHash ||
    (action.hash
      ? action.hash.split(/[:#]/)[0] // supports both "txHash:certIndex" and "txHash#certIndex"
      : undefined);

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
    txHash: derivedTxHash,
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

    // Raw voting power values (passed through for advanced UI use)
    rawVotingPowerValues: action.rawVotingPowerValues,

    // Vote breakdown by delegation status (extracted from nested drep/spo objects)
    drepBreakdown: (action.drep as { breakdown?: typeof action.drepBreakdown })?.breakdown ?? action.drepBreakdown,
    spoBreakdown: (action.spo as { breakdown?: typeof action.spoBreakdown })?.breakdown ?? action.spoBreakdown,

    // Governance action type code for vote calculation logic
    governanceActionType: action.governanceActionType ?? action.type,

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

  // Normalise references coming from the upstream API so that the rest of the
  // app can treat them as structured objects with uri/label/type fields.
  const normalisedReferences: ProposalReferenceObject[] | undefined =
    Array.isArray(detail.references)
      ? (detail.references as Array<string | ProposalReferenceObject>)
          .map((ref) => {
            if (!ref) return null;

            // Simple string → treat as both uri and label.
            if (typeof ref === "string") {
              const value = ref.trim();
              if (!value) return null;
              return {
                uri: value,
                label: value,
              } as ProposalReferenceObject;
            }

            if (typeof ref === "object") {
              const raw = ref as ProposalReferenceObject;

              const uri =
                raw.uri ||
                // Some schemas might use different keys; keep this defensive.
                (raw as Record<string, unknown>).url?.toString?.() ||
                (raw as Record<string, unknown>).href?.toString?.();

              const label =
                raw.label && typeof raw.label === "string"
                  ? raw.label
                  : typeof uri === "string"
                  ? uri
                  : undefined;

              // Map upstream "@type" to our "type" field when present.
              const upstreamType = (raw as Record<string, unknown>)["@type"];
              const type =
                typeof raw.type === "string"
                  ? raw.type
                  : typeof upstreamType === "string"
                  ? upstreamType
                  : undefined;

              if (!uri && !label) {
                return null;
              }

              const normalised: ProposalReferenceObject = {
                ...raw,
                uri: typeof uri === "string" ? uri : undefined,
                label,
              };

              if (type) {
                normalised.type = type;
              }

              return normalised;
            }

            return null;
          })
          .filter(
            (value): value is ProposalReferenceObject => value !== null
          )
      : undefined;

  return {
    ...base,
    description: detail.description,
    rationale: detail.rationale,
    references: normalisedReferences,
    votes: detail.votes?.map(transformVoteRecord) ?? [],
    ccVotes: detail.ccVotes?.map(transformVoteRecord) ?? [],
  };
}

/**
 * Transform API vote record to frontend format
 */
function transformVoteRecord(vote: VoteRecord): VoteRecord {
  // Prefer explicit ADA value when provided; otherwise derive it from
  // the raw lovelace votingPower string from the API.
  const votingPowerAda =
    vote.votingPowerAda !== undefined
      ? vote.votingPowerAda
      : lovelaceToAdaNumber(vote.votingPower);

  return {
    voterType: vote.voterType,
    voterId: vote.voterId,
    voterName: vote.voterName,
    drepId: vote.voterId || vote.drepId, // For backwards compatibility
    drepName: vote.voterName || vote.voterId || vote.drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda,
    anchorUrl: vote.anchorUrl,
    anchorHash: vote.anchorHash,
    rationale: vote.rationale,
    votedAt: vote.votedAt,
    txHash: vote.txHash,
  };
}

// ─── Development Activity API ──────────────────────────────────────────────

export async function fetchDevOverview(range: string): Promise<DevelopmentOverview> {
  return fetchApi<DevelopmentOverview>(API_ENDPOINTS.devOverview(range));
}

export async function fetchDevActivity(range: string): Promise<DevelopmentActivity> {
  return fetchApi<DevelopmentActivity>(API_ENDPOINTS.devActivity(range));
}

export async function fetchDevRepos(range: string): Promise<DevelopmentRepos> {
  return fetchApi<DevelopmentRepos>(API_ENDPOINTS.devRepos(range));
}

export async function fetchDevContributors(range: string): Promise<DevelopmentContributors> {
  return fetchApi<DevelopmentContributors>(API_ENDPOINTS.devContributors(range));
}

export async function fetchDevHealth(range: string): Promise<DevelopmentHealth> {
  return fetchApi<DevelopmentHealth>(API_ENDPOINTS.devHealth(range));
}

export async function fetchDevStars(range: string): Promise<DevelopmentStars> {
  return fetchApi<DevelopmentStars>(API_ENDPOINTS.devStars(range));
}

export async function fetchDevLanguages(): Promise<DevelopmentLanguages> {
  return fetchApi<DevelopmentLanguages>(API_ENDPOINTS.devLanguages);
}

export async function fetchDevNetwork(): Promise<NetworkGraphData> {
  return fetchApi<NetworkGraphData>(API_ENDPOINTS.devNetwork);
}

export async function fetchDevRecent(): Promise<DevelopmentRecent> {
  return fetchApi<DevelopmentRecent>(API_ENDPOINTS.devRecent);
}

// =============================================================================
// DRep API Functions
// =============================================================================

/** Raw API response for DRep stats (before transformation) */
interface DRepStatsApiResponse {
  totalDReps: number;
  totalDelegatedLovelace: string;
  totalDelegatedAda: string;
  totalVotesCast: number;
  activeDReps: number;
}

/**
 * Fetch aggregate DRep statistics
 * Returns: Total DReps, delegated ADA, votes cast, active DReps
 */
export async function fetchDRepStats(): Promise<DRepStats> {
  const data = await fetchApi<DRepStatsApiResponse>(API_ENDPOINTS.drepStats);

  // Transform API response - convert string ADA to number
  return {
    totalDReps: data.totalDReps,
    totalDelegatedLovelace: data.totalDelegatedLovelace,
    totalDelegatedAda: parseFloat(data.totalDelegatedAda) || 0,
    totalVotesCast: data.totalVotesCast,
    activeDReps: data.activeDReps,
  };
}
