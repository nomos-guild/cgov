import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

type KoiosVoterRole = "ConstitutionalCommittee" | "DRep" | "SPO";
type KoiosVoteChoice = "Yes" | "No" | "Abstain";

type KoiosProposalVote = {
  vote_tx_hash: string;
  block_time: number;
  epoch_no?: number;
  voter_role: KoiosVoterRole;
  voter_id: string;
  proposal_id?: string;
  voter_hex?: string;
  voter_has_script?: boolean;
  vote: KoiosVoteChoice;
  meta_url: string | null;
  meta_hash: string | null;
  meta_json?: unknown;
  [key: string]: unknown;
};

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_VOTES_ENDPOINT = `${KOIOS_BASE_URL}/vote_list`;
const KOIOS_PAGE_LIMIT = 250;
const KOIOS_MAX_PAGES = 40;

function getKoiosHeaders(): HeadersInit {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.KOIOS_API_KEY;
  if (key && key.trim().length > 0) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  } else {
    // Warn if API key is not set - it's recommended for higher rate limits
    console.warn("KOIOS_API_KEY not set - requests may be rate limited");
  }
  return headers;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseStringParam(value: string | string[] | undefined): string | undefined {
  const raw = firstString(value);
  return raw?.trim() || undefined;
}

function parseBooleanParam(value: string | string[] | undefined, fallback = false): boolean {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return fallback;
}

function parseIntParam(value: string | string[] | undefined, fallback: number, min?: number, max?: number): number {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  let v = n;
  if (typeof min === "number") v = Math.max(min, v);
  if (typeof max === "number") v = Math.min(max, v);
  return v;
}

function parseOptionalIntParam(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
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

      // Retry on 429 (rate limit) or 5xx upstream errors
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

async function fetchKoiosVotesPage(
  proposalId: string,
  offset: number,
  limit: number,
  epochFrom?: number,
  epochTo?: number
): Promise<KoiosProposalVote[]> {
  const url = new URL(KOIOS_VOTES_ENDPOINT);
  // Horizontal filtering: restrict to this proposal and optional epoch range
  url.searchParams.set("proposal_id", `eq.${proposalId}`);
  if (epochFrom !== undefined) {
    url.searchParams.append("epoch_no", `gte.${epochFrom}`);
  }
  if (epochTo !== undefined) {
    url.searchParams.append("epoch_no", `lte.${epochTo}`);
  }
  // Vertical filtering: only fetch columns we actually need
  url.searchParams.set(
    "select",
    "vote_tx_hash,block_time,epoch_no,voter_role,voter_id,proposal_id,vote,meta_url,meta_hash,meta_json"
  );
  // Stable ordering to make pagination deterministic
  url.searchParams.set("order", "block_time.asc");
  // Pagination to avoid large payloads / timeouts
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));

  const res = await fetchWithRetry(
    url.toString(),
    {
      method: "GET",
      headers: getKoiosHeaders(),
    },
    { retries: 5 }
  );
  if (!res.ok) {
    throw new Error(`Koios vote_list ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("Unexpected Koios proposal_votes response shape");
  }
  return data as KoiosProposalVote[];
}

async function fetchKoiosVotes(
  proposalId: string,
  epochFrom?: number,
  epochTo?: number
): Promise<KoiosProposalVote[]> {
  const all: KoiosProposalVote[] = [];
  let offset = 0;
  const limit = KOIOS_PAGE_LIMIT;

  for (let page = 0; page < KOIOS_MAX_PAGES; page++) {
    const pageData = await fetchKoiosVotesPage(proposalId, offset, limit, epochFrom, epochTo);
    all.push(...pageData);
    if (pageData.length < limit) {
      break;
    }
    offset += limit;
    // Gentle pacing between pages to respect upstream limits
    await sleep(75);
  }

  return all;
}

async function upsertVotesForProposal(
  governanceActionId: number,
  proposalId: string,
  epochFrom?: number,
  epochTo?: number
) {
  const votes = await fetchKoiosVotes(proposalId, epochFrom, epochTo);

  let createdDrep = 0;
  let createdSpo = 0;
  let createdCc = 0;

  for (const v of votes) {
    // Basic validation
    if (!v || typeof v.voter_role !== "string" || !v.voter_id || typeof v.vote !== "string") continue;
    const votedAt = Number.isFinite(v.block_time) ? new Date(v.block_time * 1000) : new Date();
    const vote = v.vote as "Yes" | "No" | "Abstain";
    const voteTxHash = v.vote_tx_hash;
    const epochNo = Number.isFinite(v.epoch_no ?? NaN) ? v.epoch_no! : null;
    const anchorUrl = v.meta_url ?? undefined;
    const anchorHash = v.meta_hash ?? undefined;
    const metaJson = v.meta_json ?? undefined;

    if (v.voter_role === "DRep") {
      // Composite unique: governanceActionId + drepId
      await prisma.drepVote.upsert({
        where: {
          governanceActionId_drepId: {
            governanceActionId,
            drepId: v.voter_id,
          },
        },
        update: {
          // In case upstream metadata changed, keep these refreshed
          vote,
          voteTxHash,
          epochNo: epochNo ?? undefined,
          anchorUrl: anchorUrl ?? undefined,
          anchorHash: anchorHash ?? undefined,
          metaJson,
          votedAt,
        },
        create: {
          governanceActionId,
          drepId: v.voter_id,
          vote,
          voteTxHash,
          epochNo: epochNo ?? undefined,
          anchorUrl: anchorUrl ?? undefined,
          anchorHash: anchorHash ?? undefined,
          metaJson,
          votedAt,
        },
      });
      createdDrep++;
      continue;
    }

    if (v.voter_role === "SPO") {
      await prisma.spoVote.upsert({
        where: {
          governanceActionId_poolId: {
            governanceActionId,
            poolId: v.voter_id,
          },
        },
        update: {
          vote,
          voteTxHash,
          epochNo: epochNo ?? undefined,
          anchorUrl: anchorUrl ?? undefined,
          anchorHash: anchorHash ?? undefined,
          metaJson,
          votedAt,
        },
        create: {
          governanceActionId,
          poolId: v.voter_id,
          vote,
          voteTxHash,
          epochNo: epochNo ?? undefined,
          anchorUrl: anchorUrl ?? undefined,
          anchorHash: anchorHash ?? undefined,
          metaJson,
          votedAt,
        },
      });
      createdSpo++;
      continue;
    }

    if (v.voter_role === "ConstitutionalCommittee") {
      await prisma.ccVote.upsert({
        where: {
          governanceActionId_memberId: {
            governanceActionId,
            memberId: v.voter_id,
          },
        },
        update: {
          vote,
          voteTxHash,
          epochNo: epochNo ?? undefined,
          anchorUrl: anchorUrl ?? undefined,
          anchorHash: anchorHash ?? undefined,
          metaJson,
          votedAt,
        },
        create: {
          governanceActionId,
          memberId: v.voter_id,
          vote,
          voteTxHash,
          epochNo: epochNo ?? undefined,
          anchorUrl: anchorUrl ?? undefined,
          anchorHash: anchorHash ?? undefined,
          metaJson,
          votedAt,
        },
      });
      createdCc++;
      continue;
    }
  }

  return { createdDrep, createdSpo, createdCc, totalFetched: votes.length };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Optional scoping:
  // - proposal_id: sync only that proposal
  // - limit: max proposals to process this run
  // - offset: offset into proposals list
  // - dry_run: fetch/count but do not write
  // - epoch_from / epoch_to: inclusive epoch range filter for Koios vote_list
  const proposalIdParam =
    parseStringParam(req.query.proposal_id) ?? parseStringParam(req.query._proposal_id);
  const limit = parseIntParam(req.query.limit, 200, 1, 500);
  const offset = parseIntParam(req.query.offset, 0, 0);
  const dryRun = parseBooleanParam(req.query.dry_run, false);
  const epochFrom = parseOptionalIntParam(req.query.epoch_from);
  const epochTo = parseOptionalIntParam(req.query.epoch_to);

  if (epochFrom !== undefined && epochTo !== undefined && epochFrom > epochTo) {
    return res.status(400).json({
      error: "Invalid epoch range: epoch_from must be <= epoch_to",
    });
  }

  try {
    // Determine target proposals from DB
    const proposals = await prisma.governanceAction.findMany({
      where: proposalIdParam ? { proposalId: proposalIdParam } : undefined,
      select: { id: true, proposalId: true },
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
    });

    if (proposals.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        processedProposals: 0,
        createdDrep: 0,
        createdSpo: 0,
        createdCc: 0,
        totalFetched: 0,
      });
    }

    let createdDrep = 0;
    let createdSpo = 0;
    let createdCc = 0;
    let totalFetched = 0;

    for (const p of proposals) {
      if (!p.proposalId) continue;
      if (dryRun) {
        const votes = await fetchKoiosVotes(p.proposalId, epochFrom, epochTo);
        totalFetched += votes.length;
      } else {
        const result = await upsertVotesForProposal(p.id, p.proposalId, epochFrom, epochTo);
        createdDrep += result.createdDrep;
        createdSpo += result.createdSpo;
        createdCc += result.createdCc;
        totalFetched += result.totalFetched;
        // gentle pacing to respect upstream limits
        await sleep(75);
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      processedProposals: proposals.length,
      createdDrep,
      createdSpo,
      createdCc,
      totalFetched,
      dryRun,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isAbort = error instanceof Error && (error.name === "AbortError" || message.includes("aborted"));
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Upstream request timed out" : "Internal Server Error",
      detail: message,
    });
  }
}


