import type { NextApiRequest, NextApiResponse } from "next";
import { syncGovernanceFromSlot } from "@/lib/koios-governance-sync";
import type { GovernanceChanges } from "@/lib/koios-governance-sync";

/**
 * API endpoint: Get all governance changes starting from slot X.
 * Returns certificates, votes, and proposals with full timing information.
 */

function parseNumberParam(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntParam(
  value: string | string[] | undefined,
  fallback: number,
  min?: number,
  max?: number
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return fallback;
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

  const fromSlot = parseNumberParam(req.query.from_slot);
  const toSlot = parseNumberParam(req.query.to_slot);
  const maxBlocks = parseIntParam(req.query.max_blocks, 500, 1, 1000);

  if (fromSlot === undefined) {
    return res.status(400).json({
      error: "Missing required parameter: from_slot",
      hint: "Provide ?from_slot=<absolute_slot_number>",
    });
  }

  if (toSlot !== undefined && fromSlot > toSlot) {
    return res.status(400).json({
      error: "Invalid range: from_slot must be <= to_slot",
    });
  }

  try {
    // Call the core sync function
    const result: GovernanceChanges = await syncGovernanceFromSlot({
      fromSlot,
      toSlot,
      maxBlocks,
    });

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isAbort = error instanceof Error && (error.name === "AbortError" || message.includes("aborted"));
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Upstream request timed out" : "Internal Server Error",
      detail: message,
    });
  }
}
