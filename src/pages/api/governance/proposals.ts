import type { NextApiRequest, NextApiResponse } from "next";

type KoiosProposalType =
  | "ParameterChange"
  | "HardForkInitiation"
  | "TreasuryWithdrawals"
  | "NoConfidence"
  | "NewCommittee"
  | "NewConstitution"
  | "InfoAction";

type KoiosProposal = {
  block_time: number;
  proposal_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  proposal_type: KoiosProposalType;
  // Koios returns many additional optional fields; we keep them but don't type exhaustively here.
  [key: string]: unknown;
};

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_PROPOSALS_ENDPOINT = `${KOIOS_BASE_URL}/proposal_list`;

function getKoiosHeaders(): HeadersInit {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.KOIOS_API_KEY;
  if (key && key.trim().length > 0) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  }
  return headers;
}

const ALLOWED_TYPES: ReadonlySet<KoiosProposalType> = new Set<KoiosProposalType>([
  "ParameterChange",
  "HardForkInitiation",
  "TreasuryWithdrawals",
  "NoConfidence",
  "NewCommittee",
  "NewConstitution",
  "InfoAction",
]);

function parseIntParam(value: string | string[] | undefined, fallback: number, min?: number, max?: number): number {
  if (value === undefined) return fallback;
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  let v = n;
  if (typeof min === "number") v = Math.max(min, v);
  if (typeof max === "number") v = Math.min(max, v);
  return v;
}

function parseNumberParam(value: string | string[] | undefined): number | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseStringParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.trim() || undefined;
}

function parseTypesParam(value: string | string[] | undefined): ReadonlySet<KoiosProposalType> | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value.join(",") : value;
  const parts = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean) as KoiosProposalType[];
  if (parts.length === 0) return undefined;
  const valid = parts.filter((p) => ALLOWED_TYPES.has(p));
  return valid.length ? new Set(valid) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const limit = parseIntParam(req.query.limit, 50, 1, 500);
  const offset = parseIntParam(req.query.offset, 0, 0);
  const since = parseNumberParam(req.query.since); // UNIX seconds (block_time)
  const until = parseNumberParam(req.query.until); // UNIX seconds (block_time)
  const id = parseStringParam(req.query.id); // exact match on proposal_id
  const txHash = parseStringParam(req.query.tx_hash); // exact match on proposal_tx_hash
  const types = parseTypesParam(req.query.type);

  // Basic semantic validation
  if (since !== undefined && until !== undefined && since > until) {
    return res.status(400).json({ error: "Invalid range: since must be <= until" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const koiosResponse = await fetch(KOIOS_PROPOSALS_ENDPOINT, {
      method: "GET",
      headers: getKoiosHeaders(),
      signal: controller.signal,
      // Next.js/node will handle gzip automatically
    });
    clearTimeout(timeout);

    if (!koiosResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios",
        status: koiosResponse.status,
      });
    }

    const proposals = (await koiosResponse.json()) as KoiosProposal[];
    let filtered = proposals;

    if (types && types.size > 0) {
      filtered = filtered.filter((p) => types.has(p.proposal_type));
    }
    if (id) {
      filtered = filtered.filter((p) => p.proposal_id === id);
    }
    if (txHash) {
      filtered = filtered.filter((p) => p.proposal_tx_hash === txHash);
    }
    if (since !== undefined) {
      filtered = filtered.filter((p) => typeof p.block_time === "number" && p.block_time >= since);
    }
    if (until !== undefined) {
      filtered = filtered.filter((p) => typeof p.block_time === "number" && p.block_time <= until);
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


