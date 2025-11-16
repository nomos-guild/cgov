import type { NextApiRequest, NextApiResponse } from "next";
import type { CertificateInfo, GovernanceCertificate } from "@/lib/koios-governance-sync";

type Certificate = {
  index: number;
  type: string;
  info: CertificateInfo;
};

type KoiosTransaction = {
  tx_hash: string;
  block_hash: string;
  block_height: number;
  epoch_no: number;
  abs_slot: number;
  tx_timestamp: number;
  certificates: Certificate[];
};

type CertificateWithContext = GovernanceCertificate;

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

function parseArrayParam(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseStringParam(value: string | string[] | undefined): string | undefined {
  const raw = firstString(value);
  return raw?.trim() || undefined;
}

// All certificate types in Conway era
const ALL_CERT_TYPES = new Set([
  "committee_hot_auth",
  "committee_cold_resign",
  "drep_registration",
  "drep_retire",
  "drep_update",
  "pool_delegation",
  "pool_update",
  "stake_deregistration",
  "stake_registration",
  "treasury_MIR",
  "vote_delegation",
]);

function isGovernanceCertificate(cert: Certificate): boolean {
  const certType = (cert.type?.toLowerCase() || "").trim();
  
  // If no cert type, skip
  if (!certType) {
    return false;
  }
  
  // Check exact matches first
  if (ALL_CERT_TYPES.has(certType)) {
    return true;
  }
  
  // Check if cert type contains any of our known types
  for (const knownType of ALL_CERT_TYPES) {
    if (certType.includes(knownType.toLowerCase())) {
      return true;
    }
  }
  
  // Include any cert that mentions governance-related keywords
  const governanceKeywords = [
    "stake",
    "pool",
    "drep",
    "vote",
    "deleg",
    "committee",
    "constitutional",
  ];
  
  for (const keyword of governanceKeywords) {
    if (certType.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const limit = parseIntParam(req.query.limit, 100, 1, 500);
  const offset = parseIntParam(req.query.offset, 0, 0);
  const certTypes = parseArrayParam(req.query.cert_type);
  const governanceOnly = req.query.governance_only === "true" || req.query.governance_only === "1";

  // Get block hashes from query or body
  let blockHashes: string[] = [];
  const queryBlockHashes = parseArrayParam(req.query.block_hashes);
  const singleBlockHash = parseStringParam(req.query.block_hash);
  
  if (singleBlockHash) {
    blockHashes.push(singleBlockHash);
  }
  if (queryBlockHashes.length > 0) {
    blockHashes.push(...queryBlockHashes);
  }

  if (req.method === "POST") {
    const body = req.body as unknown;
    if (body && typeof body === "object") {
      const hashes = (body as { _block_hashes?: unknown })._block_hashes;
      if (Array.isArray(hashes)) {
        const cleaned = hashes
          .map((h) => (typeof h === "string" ? h.trim() : ""))
          .filter(Boolean);
        blockHashes.push(...cleaned);
      }
    }
  }

  // Remove duplicates
  blockHashes = Array.from(new Set(blockHashes));

  if (blockHashes.length === 0) {
    return res.status(400).json({
      error: "No block hashes provided",
      hint: "Provide block_hash or block_hashes in query params or POST body with _block_hashes",
    });
  }

  try {
    // Step 1: Get all tx hashes from the blocks
    const controller1 = new AbortController();
    const timeout1 = setTimeout(() => controller1.abort(), 30_000);

    const blockTxsResponse = await fetch(KOIOS_BLOCK_TXS_ENDPOINT, {
      method: "POST",
      headers: {
        ...getKoiosHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ _block_hashes: blockHashes }),
      signal: controller1.signal,
    });
    clearTimeout(timeout1);

    if (!blockTxsResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios (block_txs)",
        status: blockTxsResponse.status,
      });
    }

    // Koios returns one object per transaction
    const blockTxs = (await blockTxsResponse.json()) as Array<{
      block_hash: string;
      tx_hash: string;
      [key: string]: unknown;
    }>;

    // Collect all tx hashes (Koios returns one object per tx)
    const allTxHashes: string[] = [];
    for (const item of blockTxs) {
      if (item.tx_hash) {
        allTxHashes.push(item.tx_hash);
      }
    }

    if (allTxHashes.length === 0) {
      return res.status(200).json({
        total: 0,
        count: 0,
        offset,
        limit,
        data: [],
      });
    }

    // Step 2: Fetch transaction info with certificates
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 60_000);

    const txInfoResponse = await fetch(KOIOS_TX_INFO_ENDPOINT, {
      method: "POST",
      headers: {
        ...getKoiosHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ 
        _tx_hashes: allTxHashes,
        _certs: true,
        _governance: true
      }),
      signal: controller2.signal,
    });
    clearTimeout(timeout2);

    if (!txInfoResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios (tx_info)",
        status: txInfoResponse.status,
      });
    }

    const transactions = (await txInfoResponse.json()) as KoiosTransaction[];

    // Step 3: Extract and filter certificates
    const allCertificates: CertificateWithContext[] = [];

    for (const tx of transactions) {
      if (!Array.isArray(tx.certificates) || tx.certificates.length === 0) {
        continue;
      }

      for (const cert of tx.certificates) {
        // Apply governance filter
        if (governanceOnly && !isGovernanceCertificate(cert)) {
          continue;
        }

        // Apply cert type filter
        if (certTypes.length > 0) {
          const certType = cert.type?.toLowerCase() || "";
          const matches = certTypes.some((filter) =>
            certType.includes(filter.toLowerCase())
          );
          if (!matches) continue;
        }

        // Add transaction and block context to certificate
        allCertificates.push({
          type: cert.type,
          index: cert.index,
          info: cert.info,
          tx_hash: tx.tx_hash,
          block_hash: tx.block_hash,
          block_height: tx.block_height,
          block_time: tx.tx_timestamp, // Use tx_timestamp as block_time
          epoch_no: tx.epoch_no,
          abs_slot: tx.abs_slot,
          tx_timestamp: tx.tx_timestamp,
        });
      }
    }

    // Step 4: Apply pagination
    const total = allCertificates.length;
    const paginated = allCertificates.slice(offset, offset + limit);

    res.setHeader("X-Total-Count", String(total));
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({
      total,
      count: paginated.length,
      offset,
      limit,
      data: paginated,
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
