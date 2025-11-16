import type { NextApiRequest, NextApiResponse } from "next";
import type { 
  CertificateInfo,
  VotingProcedure,
  ProposalProcedure
} from "@/lib/koios-governance-sync";

type KoiosTransaction = {
  tx_hash: string;
  block_hash: string;
  block_height: number;
  epoch_no: number;
  epoch_slot: number;
  abs_slot: number;
  tx_timestamp: number;
  tx_block_index: number;
  tx_size: number;
  total_output: string;
  fee: string;
  treasury_donation: string;
  deposit: string;
  invalid_before: string | null;
  invalid_after: string | null;
  collateral_inputs: unknown[];
  collateral_output: unknown;
  reference_inputs: unknown[];
  inputs: unknown[];
  outputs: unknown[];
  withdrawals: unknown[];
  assets_minted: unknown[];
  metadata: unknown[];
  certificates: Array<{
    type: string;
    index: number;
    info: CertificateInfo;
  }>;
  voting_procedures?: Array<VotingProcedure & {
    gov_action_proposal_id?: {
      tx_hash: string;
      index: number;
    };
  }>;
  proposal_procedures?: Array<ProposalProcedure & {
    index?: number;
  }>;
  native_scripts: unknown[];
  plutus_contracts: unknown[];
};

// Koios returns one object per transaction
type KoiosBlockTxsItem = {
  block_hash: string;
  tx_hash: string;
  [key: string]: unknown;
};

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_TX_INFO_ENDPOINT = `${KOIOS_BASE_URL}/tx_info`;
const KOIOS_BLOCK_TXS_ENDPOINT = `${KOIOS_BASE_URL}/block_txs`;

function getKoiosHeaders(): HeadersInit {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.KOIOS_API_KEY;
  if (key && key.trim().length > 0) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  }
  return headers;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(
  value: string | string[] | undefined,
  fallback: number,
  min?: number,
  max?: number
): number {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  let v = n;
  if (typeof min === "number") v = Math.max(min, v);
  if (typeof max === "number") v = Math.min(max, v);
  return v;
}

function parseStringParam(value: string | string[] | undefined): string | undefined {
  const raw = firstString(value);
  return raw?.trim() || undefined;
}

function parseArrayParam(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const limit = parseIntParam(req.query.limit, 50, 1, 100);
  const offset = parseIntParam(req.query.offset, 0, 0);
  
  // Support both query params and POST body for tx_hashes
  let txHashes: string[] = [];
  
  if (req.method === "POST") {
    const body = req.body as unknown;
    if (body && typeof body === "object") {
      const hashes = (body as { _tx_hashes?: unknown })._tx_hashes;
      if (Array.isArray(hashes)) {
        txHashes = hashes
          .map((h) => (typeof h === "string" ? h.trim() : ""))
          .filter(Boolean);
      }
    }
  }
  
  // Also check query params
  const queryHashes = parseArrayParam(req.query.tx_hashes);
  if (queryHashes.length > 0) {
    txHashes = [...txHashes, ...queryHashes];
  }

  // Support fetching by block hash
  const blockHash = parseStringParam(req.query.block_hash);
  const blockHashes = parseArrayParam(req.query.block_hashes);

  // If block hash(es) provided, fetch tx hashes from those blocks first
  if (blockHash || blockHashes.length > 0) {
    const blocksToFetch = blockHash ? [blockHash] : blockHashes;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const koiosResponse = await fetch(KOIOS_BLOCK_TXS_ENDPOINT, {
        method: "POST",
        headers: {
          ...getKoiosHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ _block_hashes: blocksToFetch }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!koiosResponse.ok) {
        return res.status(502).json({
          error: "Upstream error from Koios (block_txs)",
          status: koiosResponse.status,
        });
      }

      const blockTxs = (await koiosResponse.json()) as KoiosBlockTxsItem[];
      
      // Collect all tx hashes from blocks (Koios returns one object per tx)
      for (const item of blockTxs) {
        if (item.tx_hash) {
          txHashes.push(item.tx_hash);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isAbort = error instanceof Error && (error.name === "AbortError" || message.includes("aborted"));
      return res.status(isAbort ? 504 : 500).json({
        error: isAbort ? "Upstream request timed out (block_txs)" : "Internal Server Error",
        detail: message,
      });
    }
  }

  if (txHashes.length === 0) {
    return res.status(400).json({
      error: "No transaction hashes provided",
      hint: "Provide tx_hashes in query params or POST body, or provide block_hash/block_hashes",
    });
  }

  // Remove duplicates
  const uniqueTxHashes = Array.from(new Set(txHashes));
  
  // Apply pagination
  const paginatedHashes = uniqueTxHashes.slice(offset, offset + limit);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000); // Longer timeout for tx_info

    const koiosResponse = await fetch(KOIOS_TX_INFO_ENDPOINT, {
      method: "POST",
      headers: {
        ...getKoiosHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ 
        _tx_hashes: paginatedHashes,
        _certs: true,
        _governance: true,
        _inputs: true,
        _outputs: true
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!koiosResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios (tx_info)",
        status: koiosResponse.status,
      });
    }

    const transactions = (await koiosResponse.json()) as KoiosTransaction[];

    res.setHeader("X-Total-Count", String(uniqueTxHashes.length));
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({
      total: uniqueTxHashes.length,
      count: transactions.length,
      offset,
      limit,
      data: transactions,
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

