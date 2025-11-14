import type { NextApiRequest, NextApiResponse } from "next";

type KoiosVoterRole = "ConstitutionalCommittee" | "DRep" | "SPO";
type KoiosVoteChoice = "Yes" | "No" | "Abstain";

type KoiosProposalVote = {
  block_time: number;
  voter_role: KoiosVoterRole;
  voter_id: string;
  voter_hex: string;
  voter_has_script: boolean;
  vote: KoiosVoteChoice;
  meta_url: string | null;
  meta_hash: string | null;
  [key: string]: unknown;
};

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
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

const ALLOWED_ROLES: ReadonlySet<KoiosVoterRole> = new Set<KoiosVoterRole>([
  "ConstitutionalCommittee",
  "DRep",
  "SPO",
]);

const ALLOWED_VOTES: ReadonlySet<KoiosVoteChoice> = new Set<KoiosVoteChoice>([
  "Yes",
  "No",
  "Abstain",
]);

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseStringParam(value: string | string[] | undefined): string | undefined {
  const raw = firstString(value);
  return raw?.trim() || undefined;
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

function parseNumberParam(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseRoleParam(value: string | string[] | undefined): KoiosVoterRole | undefined {
  const raw = parseStringParam(value);
  if (!raw) return undefined;
  return ALLOWED_ROLES.has(raw as KoiosVoterRole) ? (raw as KoiosVoterRole) : undefined;
}

function parseVoteParam(value: string | string[] | undefined): KoiosVoteChoice | undefined {
  const raw = parseStringParam(value);
  if (!raw) return undefined;
  return ALLOWED_VOTES.has(raw as KoiosVoteChoice) ? (raw as KoiosVoteChoice) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Accept `proposal_id` (preferred) or `_proposal_id` (Koios style) as input
  const proposalId = parseStringParam(req.query.proposal_id) ?? parseStringParam(req.query._proposal_id);
  const voterRole = parseRoleParam(req.query.voter_role);
  const voteChoice = parseVoteParam(req.query.vote);
  const since = parseNumberParam(req.query.since);
  const until = parseNumberParam(req.query.until);
  const limit = parseIntParam(req.query.limit, 100, 1, 1000);
  const offset = parseIntParam(req.query.offset, 0, 0);

  if (!proposalId) {
    return res.status(400).json({
      error: "Missing required parameter: proposal_id",
      hint: "Provide ?proposal_id=gov_action... (CIP-129 bech32). `_proposal_id` alias is also accepted.",
    });
  }
  if (since !== undefined && until !== undefined && since > until) {
    return res.status(400).json({ error: "Invalid range: since must be <= until" });
  }

  try {
    const url = new URL(KOIOS_VOTES_ENDPOINT);
    // Koios expects `_proposal_id`
    url.searchParams.set("_proposal_id", proposalId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const koiosResponse = await fetch(url.toString(), {
      method: "GET",
      headers: getKoiosHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!koiosResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios",
        status: koiosResponse.status,
      });
    }

    const votes = (await koiosResponse.json()) as KoiosProposalVote[];
    let filtered = votes;

    if (voterRole) {
      filtered = filtered.filter((v) => v.voter_role === voterRole);
    }
    if (voteChoice) {
      filtered = filtered.filter((v) => v.vote === voteChoice);
    }
    if (since !== undefined) {
      filtered = filtered.filter((v) => typeof v.block_time === "number" && v.block_time >= since);
    }
    if (until !== undefined) {
      filtered = filtered.filter((v) => typeof v.block_time === "number" && v.block_time <= until);
    }

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);

    res.setHeader("X-Total-Count", String(total));
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      total,
      count: page.length,
      offset,
      limit,
      data: page,
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


