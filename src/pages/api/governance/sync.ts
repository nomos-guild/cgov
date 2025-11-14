import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

// Cardano mainnet constants
// Epoch duration: 5 days = 432,000 seconds
// Genesis timestamp: 2017-09-23T21:44:51Z = 1506203091 (UNIX seconds)
const EPOCH_SECONDS = 432_000;
const MAINNET_GENESIS_UNIX = 1_506_203_091;

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_PROPOSALS_ENDPOINT = `${KOIOS_BASE_URL}/proposal_list`;
const KOIOS_VOTES_ENDPOINT = `${KOIOS_BASE_URL}/proposal_votes`;

function getKoiosHeaders(): HeadersInit {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.KOIOS_API_KEY;
  if (key && key.trim().length > 0) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  }
  return headers;
}

// 5 minute cooldown by default
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

type KoiosProposalType =
  | "ParameterChange"
  | "HardForkInitiation"
  | "TreasuryWithdrawals"
  | "NoConfidence"
  | "NewCommittee"
  | "NewConstitution"
  | "InfoAction";

type KoiosProposal = {
  block_time: number; // UNIX seconds
  proposal_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  proposal_type: KoiosProposalType;
  [key: string]: unknown;
};

type KoiosVoterRole = "ConstitutionalCommittee" | "DRep" | "SPO";
type KoiosVoteChoice = "Yes" | "No" | "Abstain";
type KoiosProposalVote = {
  block_time: number;
  voter_role: KoiosVoterRole;
  voter_id: string;
  vote: KoiosVoteChoice;
  meta_url: string | null;
  meta_hash: string | null;
  [key: string]: unknown;
};

function epochFromUnixSeconds(unixSeconds: number): number {
  const delta = unixSeconds - MAINNET_GENESIS_UNIX;
  return Math.floor(delta / EPOCH_SECONDS);
}

function epochStartUnix(epochNo: number): number {
  return MAINNET_GENESIS_UNIX + epochNo * EPOCH_SECONDS;
}

function mapKoiosTypeToUiType(t: KoiosProposalType): string {
  switch (t) {
    case "InfoAction":
      return "Info";
    case "TreasuryWithdrawals":
      return "Treasury";
    case "NewConstitution":
      return "Constitution";
    default:
      // Keep the original for storage/visibility, UI may treat as "Info" or "All"
      return t;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number }
): Promise<Response> {
  const retries = opts?.retries ?? 5;
  const baseDelayMs = opts?.baseDelayMs ?? 750;
  const maxDelayMs = opts?.maxDelayMs ?? 10_000;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      // Retry on 429 or 5xx
      if ((res.status === 429 || (res.status >= 500 && res.status < 600)) && attempt < retries) {
        attempt++;
        const delay = Math.min(
          maxDelayMs,
          Math.round(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200)
        );
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      const isAbort =
        err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
      if (isAbort && attempt < retries) {
        attempt++;
        const delay = Math.min(
          maxDelayMs,
          Math.round(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200)
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function getCooldownLastUpdated(): Promise<Date | undefined> {
  const [latestAction, latestStats] = await Promise.all([
    prisma.governanceAction.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.voteStatistics.findFirst({
      orderBy: { lastUpdated: "desc" },
      select: { lastUpdated: true },
    }),
  ]);
  const dates: Date[] = [];
  if (latestAction?.updatedAt) dates.push(latestAction.updatedAt);
  if (latestStats?.lastUpdated) dates.push(latestStats.lastUpdated);
  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

async function getSinceEpoch(): Promise<number> {
  const latest = await prisma.governanceAction.findFirst({
    orderBy: { submissionEpoch: "desc" },
    select: { submissionEpoch: true },
  });
  return latest?.submissionEpoch ?? 0;
}

async function fetchNewProposalsSince(epochNo: number): Promise<KoiosProposal[]> {
  // Fetch all proposals and filter locally by block_time to avoid relying on Koios query params
  const res = await fetchWithRetry(
    KOIOS_PROPOSALS_ENDPOINT,
    { method: "GET", headers: getKoiosHeaders() },
    { retries: 5 }
  );
  if (!res.ok) {
    throw new Error(`Koios proposal_list error: ${res.status}`);
  }
  const proposals = (await res.json()) as KoiosProposal[];
  const sinceUnix = epochStartUnix(epochNo);
  // Only accept well-known/allowed types, and newer than or equal to since
  const allowed: ReadonlySet<KoiosProposalType> = new Set<KoiosProposalType>([
    "ParameterChange",
    "HardForkInitiation",
    "TreasuryWithdrawals",
    "NoConfidence",
    "NewCommittee",
    "NewConstitution",
    "InfoAction",
  ]);
  return proposals.filter(
    (p) =>
      typeof p.block_time === "number" &&
      p.block_time >= sinceUnix &&
      allowed.has(p.proposal_type as KoiosProposalType)
  );
}

async function upsertProposal(p: KoiosProposal) {
  const submissionEpoch = epochFromUnixSeconds(p.block_time);
  const expiryEpoch = submissionEpoch + 6; // heuristic fallback
  const uiType = mapKoiosTypeToUiType(p.proposal_type);

  // Ensure unique by proposalId
  const existing = await prisma.governanceAction.findUnique({
    where: { proposalId: p.proposal_id },
    select: { id: true, title: true },
  });
  if (existing) {
    // noop, but do a light touch update to bump updatedAt for cooldown usefulness
    await prisma.governanceAction.update({
      where: { id: existing.id },
      data: { title: existing.title }, // write same value to bump updatedAt
    });
    return { created: false, id: existing.id };
  }

  const title = `${uiType} action ${p.proposal_id.slice(0, 12)}`;
  const created = await prisma.governanceAction.create({
    data: {
      proposalId: p.proposal_id,
      txHash: p.proposal_tx_hash,
      title,
      type: uiType,
      status: "Active",
      submissionEpoch,
      expiryEpoch,
      constitutionality: "Constitutional",
      references: p as unknown as object,
    },
    select: { id: true },
  });
  return { created: true, id: created.id };
}

type VoteTally = {
  yes: number;
  no: number;
  abstain: number;
  total: number;
};

function tallyVotes(votes: KoiosProposalVote[], role?: KoiosVoterRole): VoteTally {
  const filtered = role ? votes.filter((v) => v.voter_role === role) : votes;
  let yes = 0;
  let no = 0;
  let abstain = 0;
  for (const v of filtered) {
    if (v.vote === "Yes") yes++;
    else if (v.vote === "No") no++;
    else if (v.vote === "Abstain") abstain++;
  }
  const total = yes + no + abstain;
  return { yes, no, abstain, total };
}

function pct(part: number, total: number): number | null {
  if (!total) return null;
  return (part / total) * 100;
}

function nullIfZero(n?: number | null): number | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n === 0) return null;
  return n;
}

// --- Voting power helpers (Koios) ---
const KOIOS_DREP_VP_HISTORY = `${KOIOS_BASE_URL}/drep_voting_power_history`;
const KOIOS_POOL_VP_HISTORY = `${KOIOS_BASE_URL}/pool_voting_power_history`;

type DrepVpRecord = {
  epoch_no?: number | string;
  drep_id?: string;
  voting_power?: number | string; // typically lovelace
  voting_power_lovelace?: number | string;
  voting_power_ada?: number | string;
  [key: string]: unknown;
};

type PoolVpRecord = {
  epoch_no?: number | string;
  pool_bech32?: string;
  voting_power?: number | string; // typically lovelace
  voting_power_lovelace?: number | string;
  voting_power_ada?: number | string;
  [key: string]: unknown;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function extractAdaFromRecord(
  rec: Record<string, unknown> & { voting_power?: unknown; voting_power_lovelace?: unknown; voting_power_ada?: unknown }
): number | undefined {
  // Prefer explicit ADA if present
  const ada = toNumber(rec.voting_power_ada);
  if (typeof ada === "number") return ada;
  // Next try lovelace
  const lovelace = toNumber(rec.voting_power_lovelace) ?? toNumber(rec.voting_power);
  if (typeof lovelace === "number") return lovelace / 1_000_000;
  return undefined;
}

const drepVpCache = new Map<string, number>();
const poolVpCache = new Map<string, number>();

async function getDrepVotingPowerAda(drepId: string, epochNo: number): Promise<number | undefined> {
  const key = `${drepId}|${epochNo}`;
  if (drepVpCache.has(key)) return drepVpCache.get(key);
  const url = new URL(KOIOS_DREP_VP_HISTORY);
  url.searchParams.set("_drep_id", drepId);
  url.searchParams.set("_epoch_no", String(epochNo));
  const res = await fetchWithRetry(url.toString(), { method: "GET", headers: getKoiosHeaders() });
  if (!res.ok) return undefined;
  const data = (await res.json()) as DrepVpRecord[] | DrepVpRecord | unknown;
  let ada: number | undefined;
  if (Array.isArray(data)) {
    if (data.length > 0) ada = extractAdaFromRecord(data[0] as Record<string, unknown>);
  } else if (data && typeof data === "object") {
    ada = extractAdaFromRecord(data as Record<string, unknown>);
  }
  if (typeof ada === "number") drepVpCache.set(key, ada);
  return ada;
}

async function getPoolVotingPowerAda(poolBech32: string, epochNo: number): Promise<number | undefined> {
  const key = `${poolBech32}|${epochNo}`;
  if (poolVpCache.has(key)) return poolVpCache.get(key);
  const url = new URL(KOIOS_POOL_VP_HISTORY);
  url.searchParams.set("_pool_bech32", poolBech32);
  url.searchParams.set("_epoch_no", String(epochNo));
  const res = await fetchWithRetry(url.toString(), { method: "GET", headers: getKoiosHeaders() });
  if (!res.ok) return undefined;
  const data = (await res.json()) as PoolVpRecord[] | PoolVpRecord | unknown;
  let ada: number | undefined;
  if (Array.isArray(data)) {
    if (data.length > 0) ada = extractAdaFromRecord(data[0] as Record<string, unknown>);
  } else if (data && typeof data === "object") {
    ada = extractAdaFromRecord(data as Record<string, unknown>);
  }
  if (typeof ada === "number") poolVpCache.set(key, ada);
  return ada;
}

async function refreshActiveVotes(opts?: {
  maxActions?: number;
  maxVotesPerAction?: number;
  maxVpLookups?: number;
}): Promise<number> {
  const maxActions = typeof opts?.maxActions === "number" ? opts.maxActions : 2;
  const maxVotesPerAction =
    typeof opts?.maxVotesPerAction === "number" ? opts.maxVotesPerAction : 25;
  const maxVpLookups = typeof opts?.maxVpLookups === "number" ? opts.maxVpLookups : 25;

  const active = await prisma.governanceAction.findMany({
    where: { status: "Active" },
    select: { id: true, proposalId: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: Math.max(0, maxActions),
  });
  if (active.length === 0 || maxActions === 0) return 0;

  let updated = 0;
  for (const a of active) {
    const url = new URL(KOIOS_VOTES_ENDPOINT);
    url.searchParams.set("_proposal_id", a.proposalId);

    const res = await fetchWithRetry(
      url.toString(),
      { method: "GET", headers: getKoiosHeaders() },
      { retries: 5 }
    );
    if (!res.ok) {
      // skip this one; continue with others
      await sleep(250);
      continue;
    }
    const votes = ((await res.json()) as KoiosProposalVote[]).slice().sort((x, y) => {
      const ax = typeof x.block_time === "number" ? x.block_time : 0;
      const ay = typeof y.block_time === "number" ? y.block_time : 0;
      return ax - ay;
    });

    const all = tallyVotes(votes);
    const drep = tallyVotes(votes, "DRep");
    const spo = tallyVotes(votes, "SPO");
    const cc = tallyVotes(votes, "ConstitutionalCommittee");

    // Load existing votes for this action to avoid redundant work
    const [existingDrep, existingSpo, existingCc] = await Promise.all([
      prisma.drepVote.findMany({
        where: { governanceActionId: a.id },
        select: { drepId: true, vote: true, votingPowerAda: true, votedAt: true },
      }),
      prisma.spoVote.findMany({
        where: { governanceActionId: a.id },
        select: { poolId: true, vote: true, votingPowerAda: true, votedAt: true },
      }),
      prisma.ccVote.findMany({
        where: { governanceActionId: a.id },
        select: { memberId: true, vote: true, votedAt: true },
      }),
    ]);
    const drepMap = new Map(
      existingDrep.map((v) => [v.drepId, { vote: v.vote, votingPowerAda: v.votingPowerAda, votedAt: v.votedAt }])
    );
    const spoMap = new Map(
      existingSpo.map((v) => [v.poolId, { vote: v.vote, votingPowerAda: v.votingPowerAda, votedAt: v.votedAt }])
    );
    const ccMap = new Map(existingCc.map((v) => [v.memberId, { vote: v.vote, votedAt: v.votedAt }]));

    // --- Persist a limited number of individual votes and compute ADA-weighted sums via DB aggregation later ---
    let processedForAction = 0;
    let vpLookupsUsed = 0;

    for (const v of votes) {
      if (processedForAction >= maxVotesPerAction) break;
      const votedAt = new Date((v.block_time ?? 0) * 1000);
      const epochNo = typeof v.block_time === "number" ? epochFromUnixSeconds(v.block_time) : undefined;
      if (v.voter_role === "DRep") {
        const existing = drepMap.get(v.voter_id);
        // Skip if identical and we already have VP
        if (
          existing &&
          existing.vote === v.vote &&
          existing.votedAt?.getTime() === votedAt.getTime() &&
          typeof existing.votingPowerAda === "number"
        ) {
          continue;
        }
        let votingPowerAda: number | undefined = undefined;
        if (typeof epochNo === "number" && vpLookupsUsed < maxVpLookups) {
          votingPowerAda = await getDrepVotingPowerAda(v.voter_id, epochNo);
          vpLookupsUsed++;
          // Gentle pacing with upstream
          await sleep(40);
        }
        // Upsert DRep vote
        await prisma.drepVote.upsert({
          where: {
            governanceActionId_drepId: {
              governanceActionId: a.id,
              drepId: v.voter_id,
            },
          },
          update: {
            vote: v.vote,
            votingPowerAda: typeof votingPowerAda === "number" ? votingPowerAda : undefined,
            anchorUrl: v.meta_url ?? undefined,
            anchorHash: v.meta_hash ?? undefined,
            votedAt,
          },
          create: {
            governanceActionId: a.id,
            drepId: v.voter_id,
            vote: v.vote,
            votingPowerAda: typeof votingPowerAda === "number" ? votingPowerAda : 0,
            anchorUrl: v.meta_url ?? undefined,
            anchorHash: v.meta_hash ?? undefined,
            votedAt,
          },
        });
        processedForAction++;
      } else if (v.voter_role === "SPO") {
        const existing = spoMap.get(v.voter_id);
        if (
          existing &&
          existing.vote === v.vote &&
          existing.votedAt?.getTime() === votedAt.getTime() &&
          typeof existing.votingPowerAda === "number"
        ) {
          continue;
        }
        let votingPowerAda: number | undefined = undefined;
        if (typeof epochNo === "number" && vpLookupsUsed < maxVpLookups) {
          votingPowerAda = await getPoolVotingPowerAda(v.voter_id, epochNo);
          vpLookupsUsed++;
          await sleep(40);
        }
        await prisma.spoVote.upsert({
          where: {
            governanceActionId_poolId: {
              governanceActionId: a.id,
              poolId: v.voter_id,
            },
          },
          update: {
            vote: v.vote,
            votingPowerAda: typeof votingPowerAda === "number" ? votingPowerAda : undefined,
            anchorUrl: v.meta_url ?? undefined,
            anchorHash: v.meta_hash ?? undefined,
            votedAt,
          },
          create: {
            governanceActionId: a.id,
            poolId: v.voter_id,
            vote: v.vote,
            votingPowerAda: typeof votingPowerAda === "number" ? votingPowerAda : 0,
            anchorUrl: v.meta_url ?? undefined,
            anchorHash: v.meta_hash ?? undefined,
            votedAt,
          },
        });
        processedForAction++;
      } else if (v.voter_role === "ConstitutionalCommittee") {
        const existing = ccMap.get(v.voter_id);
        if (existing && existing.vote === v.vote && existing.votedAt?.getTime() === votedAt.getTime()) {
          continue;
        }
        await prisma.ccVote.upsert({
          where: {
            governanceActionId_memberId: {
              governanceActionId: a.id,
              memberId: v.voter_id,
            },
          },
          update: {
            vote: v.vote,
            anchorUrl: v.meta_url ?? undefined,
            anchorHash: v.meta_hash ?? undefined,
            votedAt,
          },
          create: {
            governanceActionId: a.id,
            memberId: v.voter_id,
            vote: v.vote,
            anchorUrl: v.meta_url ?? undefined,
            anchorHash: v.meta_hash ?? undefined,
            votedAt,
          },
        });
        processedForAction++;
      }
    }

    // Aggregate ADA-weighted sums from DB so stats reflect total work done so far
    const [drepYesAgg, drepNoAgg, spoYesAgg, spoNoAgg] = await Promise.all([
      prisma.drepVote.aggregate({
        where: { governanceActionId: a.id, vote: "Yes" },
        _sum: { votingPowerAda: true },
      }),
      prisma.drepVote.aggregate({
        where: { governanceActionId: a.id, vote: "No" },
        _sum: { votingPowerAda: true },
      }),
      prisma.spoVote.aggregate({
        where: { governanceActionId: a.id, vote: "Yes" },
        _sum: { votingPowerAda: true },
      }),
      prisma.spoVote.aggregate({
        where: { governanceActionId: a.id, vote: "No" },
        _sum: { votingPowerAda: true },
      }),
    ]);
    const drepYesAdaSum = Number(drepYesAgg._sum.votingPowerAda ?? 0);
    const drepNoAdaSum = Number(drepNoAgg._sum.votingPowerAda ?? 0);
    const spoYesAdaSum = Number(spoYesAgg._sum.votingPowerAda ?? 0);
    const spoNoAdaSum = Number(spoNoAgg._sum.votingPowerAda ?? 0);

    // Persist in VoteStatistics (count-based percentages + ADA-weighted sums)
    await prisma.voteStatistics.upsert({
      where: { governanceActionId: a.id },
      update: {
        drepYesPercent: drep.total ? pct(drep.yes, drep.total) : null,
        drepNoPercent: drep.total ? pct(drep.no, drep.total) : null,
        drepYesAda: nullIfZero(drepYesAdaSum),
        drepNoAda: nullIfZero(drepNoAdaSum),

        spoYesPercent: spo.total ? pct(spo.yes, spo.total) : null,
        spoNoPercent: spo.total ? pct(spo.no, spo.total) : null,
        spoYesAda: nullIfZero(spoYesAdaSum),
        spoNoAda: nullIfZero(spoNoAdaSum),

        ccYesPercent: cc.total ? pct(cc.yes, cc.total) : null,
        ccNoPercent: cc.total ? pct(cc.no, cc.total) : null,
        ccYesCount: cc.yes,
        ccNoCount: cc.no,

        totalYes: all.yes,
        totalNo: all.no,
        totalAbstain: all.abstain,
        lastUpdated: new Date(),
      },
      create: {
        governanceActionId: a.id,
        drepYesPercent: drep.total ? pct(drep.yes, drep.total) : null,
        drepNoPercent: drep.total ? pct(drep.no, drep.total) : null,
        drepYesAda: nullIfZero(drepYesAdaSum),
        drepNoAda: nullIfZero(drepNoAdaSum),

        spoYesPercent: spo.total ? pct(spo.yes, spo.total) : null,
        spoNoPercent: spo.total ? pct(spo.no, spo.total) : null,
        spoYesAda: nullIfZero(spoYesAdaSum),
        spoNoAda: nullIfZero(spoNoAdaSum),

        ccYesPercent: cc.total ? pct(cc.yes, cc.total) : null,
        ccNoPercent: cc.total ? pct(cc.no, cc.total) : null,
        ccYesCount: cc.yes,
        ccNoCount: cc.no,

        totalYes: all.yes,
        totalNo: all.no,
        totalAbstain: all.abstain,
        lastUpdated: new Date(),
      },
    });

    updated++;
    // be gentle with upstream
    await sleep(150);
  }
  return updated;
}

function parseBool(value: string | string[] | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return undefined;
}

function parseIntParam(
  value: string | string[] | undefined,
  fallback: number,
  min?: number,
  max?: number
): number {
  if (value === undefined) return fallback;
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  let v = n;
  if (typeof min === "number") v = Math.max(min, v);
  if (typeof max === "number") v = Math.min(max, v);
  return v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const force = parseBool(req.query.force) ?? false;
  const cooldownMs = parseIntParam(req.query.cooldown_ms, DEFAULT_COOLDOWN_MS, 0, 24 * 60 * 60 * 1000);

  try {
    // cooldown check
    const lastUpdated = await getCooldownLastUpdated();
    if (!force && lastUpdated) {
      const age = Date.now() - lastUpdated.getTime();
      if (age < cooldownMs) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
          skipped: true,
          reason: "cooldown",
          cooldown_ms: cooldownMs,
          age_ms: age,
          lastUpdated: lastUpdated.toISOString(),
        });
      }
    }

    // work-limiting params (keep small defaults to be gentle)
    const maxNewProposals = parseIntParam(req.query.max_new_proposals, 5, 0, 100);
    const maxActions = parseIntParam(req.query.max_actions, 2, 0, 100);
    const maxVotesPerAction = parseIntParam(req.query.max_votes_per_action, 25, 0, 2000);
    const maxVpLookups = parseIntParam(req.query.max_vp_lookups, 25, 0, 2000);

    // discover new proposals
    const sinceEpoch = await getSinceEpoch();
    const newProposalsAll = await fetchNewProposalsSince(sinceEpoch);
    const newProposals = newProposalsAll
      .slice()
      .sort((a, b) => (a.block_time ?? 0) - (b.block_time ?? 0))
      .slice(0, Math.max(0, maxNewProposals));

    let createdCount = 0;
    for (const p of newProposals) {
      const result = await upsertProposal(p);
      if (result.created) createdCount++;
      await sleep(100); // spread out inserts
    }

    // refresh votes for active actions
    const updatedVotes = await refreshActiveVotes({
      maxActions,
      maxVotesPerAction,
      maxVpLookups,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      skipped: false,
      createdProposals: createdCount,
      updatedActiveActions: updatedVotes,
      sinceEpoch,
      now: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal Server Error", detail: message });
  }
}


