/**
 * Server-side data fetching for ISR/SSG
 * These functions fetch directly from the backend API for use in getStaticProps/getServerSideProps
 */

import type {
  GovernanceAction,
  GovernanceActionDetail,
  ProposalSurveyResponse,
  ProposalSurveyTallyResponse,
  VoteRecord,
  ProposalReferenceObject,
  OverviewSummary,
  NCLYearData,
  NCLDisplayData,
} from "@/types/governance";
import { normalizeProposalSurveyResponse } from "@/lib/surveyMetadata";

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
// Known NCL targets (in ADA) – fallback when backend returns 0
const NCL_TARGETS_ADA: Record<number, number> = {
  2025: 350_000_000,
  2026: 350_000_000,
};

function transformNCLData(data: NCLYearData): NCLDisplayData {
  const currentAda = lovelaceToAdaNumber(data.currentValue);
  let targetAda = lovelaceToAdaNumber(data.targetValue);
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
    withdrawalAmount: action.withdrawalAmount ?? null,
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
 * Transform a vote record (lovelace → ADA for votingPower)
 */
function transformVoteRecord(vote: VoteRecord): VoteRecord {
  const votingPowerAda =
    vote.votingPowerAda !== undefined
      ? vote.votingPowerAda
      : lovelaceToAdaNumber(vote.votingPower);

  return {
    voterType: vote.voterType,
    voterId: vote.voterId,
    voterName: vote.voterName,
    drepId: vote.voterId || vote.drepId,
    drepName: vote.voterName || vote.voterId || vote.drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda,
    anchorUrl: vote.anchorUrl,
    anchorHash: vote.anchorHash,
    rationale: vote.rationale,
    votedAt: vote.votedAt,
    txHash: vote.txHash,
    isPendingConfirmation: vote.isPendingConfirmation === true || vote.votingPower == null,
  };
}

/**
 * Normalise references from the upstream API to a consistent shape
 */
function normaliseReferences(
  references: unknown[] | undefined
): ProposalReferenceObject[] | undefined {
  if (!Array.isArray(references)) return undefined;

  return (references as Array<string | ProposalReferenceObject>)
    .map((ref) => {
      if (!ref) return null;

      if (typeof ref === "string") {
        const value = ref.trim();
        if (!value) return null;
        return { uri: value, label: value } as ProposalReferenceObject;
      }

      if (typeof ref === "object") {
        const raw = ref as ProposalReferenceObject;
        const uri =
          raw.uri ||
          (raw as Record<string, unknown>).url?.toString?.() ||
          (raw as Record<string, unknown>).href?.toString?.();
        const label =
          raw.label && typeof raw.label === "string"
            ? raw.label
            : typeof uri === "string"
            ? uri
            : undefined;
        const upstreamType = (raw as Record<string, unknown>)["@type"];
        const type =
          typeof raw.type === "string"
            ? raw.type
            : typeof upstreamType === "string"
            ? upstreamType
            : undefined;

        if (!uri && !label) return null;

        const normalised: ProposalReferenceObject = {
          ...raw,
          uri: typeof uri === "string" ? uri : undefined,
          label,
        };
        if (type) normalised.type = type;
        return normalised;
      }

      return null;
    })
    .filter((v): v is ProposalReferenceObject => v !== null);
}

/**
 * Transform governance action detail for frontend
 */
function transformGovernanceActionDetail(
  detail: GovernanceActionDetail
): GovernanceActionDetail {
  const base = transformGovernanceAction(detail);

  return {
    ...base,
    description: detail.description,
    rationale: detail.rationale,
    references: normaliseReferences(detail.references as unknown[]),
    votes: detail.votes?.map(transformVoteRecord) ?? [],
    ccVotes: detail.ccVotes?.map(transformVoteRecord) ?? [],
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
 *
 * ISR/SSG path: returns backend data with fallback targets only.
 * The client-side SWR fetch goes through /api/overview/ncl which
 * augments 2026 NCL with direct DB calculation.
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
 * Server-side fetch for governance action detail
 */
export async function fetchGovernanceActionDetailServer(
  proposalId: string
): Promise<GovernanceActionDetail | null> {
  try {
    const data = await fetchBackend<GovernanceActionDetail>(
      `/proposal/${encodeURIComponent(proposalId)}`
    );

    const transformed = transformGovernanceActionDetail(data);
    return sanitizeForJson(transformed);
  } catch (error) {
    console.error("Failed to fetch proposal detail server-side:", error);
    return null;
  }
}

export async function fetchProposalSurveyServer(
  proposalId: string
): Promise<ProposalSurveyResponse | null> {
  try {
    const survey = await fetchBackend<ProposalSurveyResponse>(
      `/proposal/${encodeURIComponent(proposalId)}/survey`
    );
    return normalizeProposalSurveyResponse(survey);
  } catch (error) {
    console.error("Failed to fetch proposal survey server-side:", error);
    return null;
  }
}

export async function fetchProposalSurveyTallyServer(
  proposalId: string
): Promise<ProposalSurveyTallyResponse | null> {
  try {
    return await fetchBackend<ProposalSurveyTallyResponse>(
      `/proposal/${encodeURIComponent(proposalId)}/survey-tally`
    );
  } catch (error) {
    console.error("Failed to fetch proposal survey tally server-side:", error);
    return null;
  }
}

/**
 * Server-side fetch for treasury balance
 */
export async function fetchTreasuryServer(): Promise<number | null> {
  try {
    const data = await fetchBackend<{ epochs: Array<{ treasury: string | null }> }>(
      "/analytics/treasury-rate?limit=1"
    );
    const treasuryLovelace = data?.epochs?.[0]?.treasury;
    if (!treasuryLovelace) return null;
    const ada = Number(treasuryLovelace) / 1_000_000;
    return Number.isFinite(ada) ? ada : null;
  } catch (error) {
    console.error("Failed to fetch treasury server-side:", error);
    return null;
  }
}

/**
 * Fetch all governance data for ISR
 */
export async function fetchAllGovernanceData() {
  const [actions, overview, nclData, treasuryAda] = await Promise.all([
    fetchGovernanceActionsServer(),
    fetchOverviewSummaryServer(),
    fetchNCLDataServer(),
    fetchTreasuryServer(),
  ]);

  return { actions, overview, nclData, treasuryAda };
}

// ── DRep server-side fetching ──────────────────────────────────────

/** Matches DRepStatsApiResponse in hooks/useDRepData.ts */
export interface DRepStatsServerResponse {
  totalDReps: number;
  totalDelegatedLovelace: string;
  totalDelegatedAda: string;
  totalVotesCast: number;
  activeDReps: number;
}

/** Matches DRepListApiResponse in hooks/useDRepData.ts */
interface DRepListServerResponse {
  dreps: Array<{
    drepId: string;
    name: string | null;
    iconUrl: string | null;
    votingPower: string;
    votingPowerAda: string;
    totalVotesCast: number;
    delegatorCount?: number | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Raw DRep item from the server (serializable for ISR props) */
export type DRepServerItem = DRepListServerResponse["dreps"][0];

/**
 * Server-side fetch for DRep statistics
 */
export async function fetchDRepStatsServer(): Promise<DRepStatsServerResponse | null> {
  try {
    return await fetchBackend<DRepStatsServerResponse>("/dreps/stats");
  } catch (error) {
    console.error("Failed to fetch DRep stats server-side:", error);
    return null;
  }
}

/**
 * Server-side fetch for ALL DReps (auto-paginates).
 * Returns raw API items (not yet transformed to DRepSummary).
 */
export async function fetchAllDRepsServer(): Promise<DRepServerItem[]> {
  try {
    const params = "page=1&pageSize=100&sortBy=votingPower&sortOrder=desc";
    const firstPage = await fetchBackend<DRepListServerResponse>(`/dreps?${params}`);
    const accumulated = [...firstPage.dreps];
    const { totalPages } = firstPage.pagination;

    if (totalPages > 1) {
      const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const results = await Promise.all(
        remaining.map((pg) =>
          fetchBackend<DRepListServerResponse>(
            `/dreps?page=${pg}&pageSize=100&sortBy=votingPower&sortOrder=desc`
          )
        )
      );
      for (const result of results) {
        accumulated.push(...result.dreps);
      }
    }

    return sanitizeForJson(accumulated);
  } catch (error) {
    console.error("Failed to fetch all DReps server-side:", error);
    return [];
  }
}

// ── DRep engagement stats (backend aggregated) ────────────────────

/** Shape returned by fetchDRepRationaleStatsServer */
export interface DRepRationaleStatItem {
  drepId: string;
  totalVotesCast: number;
  rationalesProvided: number;
  proposalParticipationPercent: number;
  uniqueProposals: number;
  voteChanges: number;
}

/**
 * Server-side fetch for backend-aggregated DRep engagement stats.
 */
export async function fetchDRepRationaleStatsServer(): Promise<DRepRationaleStatItem[]> {
  try {
    const response = await fetchBackend<{ dreps: DRepRationaleStatItem[] }>(
      "/dreps/engagement-stats"
    );
    return sanitizeForJson(response.dreps ?? []);
  } catch (error) {
    console.error("Failed to fetch DRep rationale stats server-side:", error);
    return [];
  }
}


// ──────────────────────────────────────────────────────────────────────
// DRep profile page — server-side fetches for ISR
// ──────────────────────────────────────────────────────────────────────

/** Raw API shape returned by GET /dreps/:id */
export interface DRepDetailServerResponse {
  drepId: string;
  name: string | null;
  iconUrl: string | null;
  paymentAddr: string | null;
  votingPower: string;
  votingPowerAda: string;
  totalVotesCast: number;
  voteBreakdown: { yes: number; no: number; abstain: number };
  rationalesProvided: number;
  proposalParticipationPercent: number;
  delegatorCount: number | null;
  registeredEpoch: number | null;
  registeredDate: string | null;
}

/**
 * Fetch a single DRep's detail, server-side.
 */
export async function fetchDRepDetailServer(
  drepId: string
): Promise<DRepDetailServerResponse | null> {
  try {
    return await fetchBackend<DRepDetailServerResponse>(
      `/dreps/${encodeURIComponent(drepId)}`
    );
  } catch (error) {
    console.error("Failed to fetch DRep detail server-side:", error);
    return null;
  }
}

/** Raw vote record as returned by the backend */
interface DRepVoteServerItem {
  proposalId: string;
  proposalTitle: string;
  proposalType: string | null;
  vote: string;
  votingPower: string | null;
  votingPowerAda?: string;
  rationale: string | null;
  anchorUrl: string | null;
  votedAt: string | null;
  txHash: string;
}

interface DRepVotesServerResponse {
  drepId: string;
  votes: DRepVoteServerItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

function normalizeVoteServer(raw: string): "Yes" | "No" | "Abstain" {
  const upper = raw.toUpperCase();
  if (upper === "YES") return "Yes";
  if (upper === "NO") return "No";
  return "Abstain";
}

function formatProposalTypeServer(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Transform a raw vote record to frontend shape */
function transformVoteRecordServer(vote: DRepVoteServerItem) {
  const votingPowerAda = vote.votingPowerAda
    ? parseFloat(vote.votingPowerAda) || 0
    : vote.votingPower
      ? Number(vote.votingPower) / 1_000_000
      : 0;

  return {
    proposalId: vote.proposalId,
    proposalTitle: vote.proposalTitle,
    proposalType: formatProposalTypeServer(vote.proposalType),
    vote: normalizeVoteServer(vote.vote),
    votingPower: vote.votingPower,
    votingPowerAda,
    rationale: vote.rationale,
    anchorUrl: vote.anchorUrl,
    votedAt: vote.votedAt,
    txHash: vote.txHash,
  };
}

/**
 * Fetch ALL votes for a DRep (auto-paginates) and deduplicate by proposalId.
 * Returns transformed, ready-to-use vote records.
 */
export async function fetchDRepAllVotesServer(
  drepId: string
): Promise<ReturnType<typeof transformVoteRecordServer>[]> {
  try {
    const encodedId = encodeURIComponent(drepId);
    const pageSize = 100;

    const firstPage = await fetchBackend<DRepVotesServerResponse>(
      `/dreps/${encodedId}/votes?page=1&pageSize=${pageSize}`
    );
    const accumulated = [...firstPage.votes];
    const { totalPages } = firstPage.pagination;

    if (totalPages > 1) {
      const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const pages = await Promise.all(
        remaining.map((pg) =>
          fetchBackend<DRepVotesServerResponse>(
            `/dreps/${encodedId}/votes?page=${pg}&pageSize=${pageSize}`
          )
        )
      );
      for (const page of pages) accumulated.push(...page.votes);
    }

    // Deduplicate by proposalId — keep only the latest vote per proposal
    const seen = new Map<string, DRepVoteServerItem>();
    for (const vote of accumulated) {
      const existing = seen.get(vote.proposalId);
      if (
        !existing ||
        (vote.votedAt && (!existing.votedAt || vote.votedAt > existing.votedAt))
      ) {
        seen.set(vote.proposalId, vote);
      }
    }

    return Array.from(seen.values()).map(transformVoteRecordServer);
  } catch (error) {
    console.error("Failed to fetch DRep votes server-side:", error);
    return [];
  }
}

/** Raw history response shape */
interface DRepHistoryServerResponse {
  drepId: string;
  history: Array<{
    epoch: number;
    date: string | null;
    delegatorCount: number;
    votingPower: string;
    votingPowerAda: string;
  }>;
}

/**
 * Fetch per-epoch delegation history for a single DRep, server-side.
 */
export async function fetchDRepHistoryServer(
  drepId: string
): Promise<DRepHistoryServerResponse | null> {
  try {
    return await fetchBackend<DRepHistoryServerResponse>(
      `/dreps/${encodeURIComponent(drepId)}/history`
    );
  } catch (error) {
    console.error("Failed to fetch DRep history server-side:", error);
    return null;
  }
}
