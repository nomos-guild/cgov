import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type VoteChoice = "Yes" | "No" | "Abstain";

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

function parseOptionalIntParam(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

const ZERO_DECIMAL = new Prisma.Decimal(0);
const HUNDRED_DECIMAL = new Prisma.Decimal(100);

type RoleAggregate = {
  yesAda: Prisma.Decimal;
  noAda: Prisma.Decimal;
  yesCount: number;
  noCount: number;
  abstainCount: number;
};

type CcAggregate = {
  yesCount: number;
  noCount: number;
  abstainCount: number;
};

function getOrInitRoleAggregate(map: Map<number, RoleAggregate>, governanceActionId: number): RoleAggregate {
  let agg = map.get(governanceActionId);
  if (!agg) {
    agg = {
      yesAda: ZERO_DECIMAL,
      noAda: ZERO_DECIMAL,
      yesCount: 0,
      noCount: 0,
      abstainCount: 0,
    };
    map.set(governanceActionId, agg);
  }
  return agg;
}

function getOrInitCcAggregate(map: Map<number, CcAggregate>, governanceActionId: number): CcAggregate {
  let agg = map.get(governanceActionId);
  if (!agg) {
    agg = {
      yesCount: 0,
      noCount: 0,
      abstainCount: 0,
    };
    map.set(governanceActionId, agg);
  }
  return agg;
}

function applyVoteToRoleAggregate(
  agg: RoleAggregate,
  choice: VoteChoice,
  count: number,
  adaSum: Prisma.Decimal | null
) {
  const ada = adaSum ?? ZERO_DECIMAL;
  if (choice === "Yes") {
    agg.yesCount += count;
    agg.yesAda = agg.yesAda.plus(ada);
  } else if (choice === "No") {
    agg.noCount += count;
    agg.noAda = agg.noAda.plus(ada);
  } else if (choice === "Abstain") {
    agg.abstainCount += count;
  }
}

function applyVoteToCcAggregate(agg: CcAggregate, choice: VoteChoice, count: number) {
  if (choice === "Yes") {
    agg.yesCount += count;
  } else if (choice === "No") {
    agg.noCount += count;
  } else if (choice === "Abstain") {
    agg.abstainCount += count;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const offset = parseIntParam(req.query.offset, 0, 0);
  const dryRun = parseBooleanParam(req.query.dry_run, false);
  const proposalIdParam = parseStringParam(req.query.proposal_id) ?? parseStringParam(req.query._proposal_id);
  const governanceActionIdParam = parseOptionalIntParam(req.query.governance_action_id);

  // If no explicit limit is provided, process all matching governance actions.
  const limitRaw = firstString(req.query.limit);
  const effectiveLimit =
    limitRaw === undefined ? undefined : parseIntParam(limitRaw, 50, 1, 500);

  try {
    const where: Prisma.GovernanceActionWhereInput = {};

    if (proposalIdParam) {
      where.proposalId = proposalIdParam;
    }
    if (typeof governanceActionIdParam === "number") {
      where.id = governanceActionIdParam;
    }

    const actions = await prisma.governanceAction.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      select: { id: true },
      orderBy: { id: "asc" },
      skip: offset,
      take: typeof effectiveLimit === "number" ? effectiveLimit : undefined,
    });

    if (actions.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        processedActions: 0,
        updatedStatistics: 0,
        dryRun,
      });
    }

    const actionIds = actions.map((a) => a.id);

    // Aggregate DRep votes (weighted by votingPowerAda)
    const drepGrouped = await prisma.drepVote.groupBy({
      by: ["governanceActionId", "vote"],
      where: {
        governanceActionId: { in: actionIds },
      },
      _sum: { votingPowerAda: true },
      _count: { _all: true },
    });

    const drepAggMap = new Map<number, RoleAggregate>();
    for (const row of drepGrouped) {
      const agg = getOrInitRoleAggregate(drepAggMap, row.governanceActionId);
      applyVoteToRoleAggregate(
        agg,
        row.vote as VoteChoice,
        row._count._all ?? 0,
        row._sum.votingPowerAda
      );
    }

    // Aggregate SPO votes (weighted by votingPowerAda)
    const spoGrouped = await prisma.spoVote.groupBy({
      by: ["governanceActionId", "vote"],
      where: {
        governanceActionId: { in: actionIds },
      },
      _sum: { votingPowerAda: true },
      _count: { _all: true },
    });

    const spoAggMap = new Map<number, RoleAggregate>();
    for (const row of spoGrouped) {
      const agg = getOrInitRoleAggregate(spoAggMap, row.governanceActionId);
      applyVoteToRoleAggregate(
        agg,
        row.vote as VoteChoice,
        row._count._all ?? 0,
        row._sum.votingPowerAda
      );
    }

    // Aggregate CC votes (unweighted counts)
    const ccGrouped = await prisma.ccVote.groupBy({
      by: ["governanceActionId", "vote"],
      where: {
        governanceActionId: { in: actionIds },
      },
      _count: { _all: true },
    });

    const ccAggMap = new Map<number, CcAggregate>();
    for (const row of ccGrouped) {
      const agg = getOrInitCcAggregate(ccAggMap, row.governanceActionId);
      applyVoteToCcAggregate(agg, row.vote as VoteChoice, row._count._all ?? 0);
    }

    let updatedStatistics = 0;

    const dryRunPreview: Array<{
      governanceActionId: number;
      drepYesAda?: string;
      drepNoAda?: string;
      spoYesAda?: string;
      spoNoAda?: string;
      totalYes: number;
      totalNo: number;
      totalAbstain: number;
    }> = [];

    for (const action of actions) {
      const drepAgg = drepAggMap.get(action.id);
      const spoAgg = spoAggMap.get(action.id);
      const ccAgg = ccAggMap.get(action.id);

      const drepYesAda = drepAgg?.yesAda ?? ZERO_DECIMAL;
      const drepNoAda = drepAgg?.noAda ?? ZERO_DECIMAL;
      const spoYesAda = spoAgg?.yesAda ?? ZERO_DECIMAL;
      const spoNoAda = spoAgg?.noAda ?? ZERO_DECIMAL;

      const drepTotalAda = drepYesAda.plus(drepNoAda);
      const spoTotalAda = spoYesAda.plus(spoNoAda);

      const drepYesPercent =
        drepTotalAda.greaterThan(0) && drepAgg
          ? drepYesAda.mul(HUNDRED_DECIMAL).div(drepTotalAda)
          : null;
      const drepNoPercent =
        drepTotalAda.greaterThan(0) && drepAgg
          ? drepNoAda.mul(HUNDRED_DECIMAL).div(drepTotalAda)
          : null;

      const spoYesPercent =
        spoTotalAda.greaterThan(0) && spoAgg
          ? spoYesAda.mul(HUNDRED_DECIMAL).div(spoTotalAda)
          : null;
      const spoNoPercent =
        spoTotalAda.greaterThan(0) && spoAgg
          ? spoNoAda.mul(HUNDRED_DECIMAL).div(spoTotalAda)
          : null;

      const ccTotalCount = (ccAgg?.yesCount ?? 0) + (ccAgg?.noCount ?? 0);
      const ccYesPercent =
        ccTotalCount > 0 && ccAgg
          ? new Prisma.Decimal(ccAgg.yesCount).mul(HUNDRED_DECIMAL).div(ccTotalCount)
          : null;
      const ccNoPercent =
        ccTotalCount > 0 && ccAgg
          ? new Prisma.Decimal(ccAgg.noCount).mul(HUNDRED_DECIMAL).div(ccTotalCount)
          : null;

      const drepYesCount = drepAgg?.yesCount ?? 0;
      const drepNoCount = drepAgg?.noCount ?? 0;
      const drepAbstainCount = drepAgg?.abstainCount ?? 0;

      const spoYesCount = spoAgg?.yesCount ?? 0;
      const spoNoCount = spoAgg?.noCount ?? 0;
      const spoAbstainCount = spoAgg?.abstainCount ?? 0;

      const ccYesCount = ccAgg?.yesCount ?? 0;
      const ccNoCount = ccAgg?.noCount ?? 0;
      const ccAbstainCount = ccAgg?.abstainCount ?? 0;

      const totalYes = drepYesCount + spoYesCount + ccYesCount;
      const totalNo = drepNoCount + spoNoCount + ccNoCount;
      const totalAbstain = drepAbstainCount + spoAbstainCount + ccAbstainCount;

      if (dryRun) {
        dryRunPreview.push({
          governanceActionId: action.id,
          drepYesAda: drepYesAda.toString(),
          drepNoAda: drepNoAda.toString(),
          spoYesAda: spoYesAda.toString(),
          spoNoAda: spoNoAda.toString(),
          totalYes,
          totalNo,
          totalAbstain,
        });
        continue;
      }

      await prisma.voteStatistics.upsert({
        where: { governanceActionId: action.id },
        create: {
          governanceActionId: action.id,
          drepYesPercent: drepYesPercent ?? undefined,
          drepNoPercent: drepNoPercent ?? undefined,
          drepYesAda: drepAgg ? drepYesAda : undefined,
          drepNoAda: drepAgg ? drepNoAda : undefined,
          spoYesPercent: spoYesPercent ?? undefined,
          spoNoPercent: spoNoPercent ?? undefined,
          spoYesAda: spoAgg ? spoYesAda : undefined,
          spoNoAda: spoAgg ? spoNoAda : undefined,
          ccYesPercent: ccYesPercent ?? undefined,
          ccNoPercent: ccNoPercent ?? undefined,
          ccYesCount: ccAgg ? ccAgg.yesCount : undefined,
          ccNoCount: ccAgg ? ccAgg.noCount : undefined,
          totalYes,
          totalNo,
          totalAbstain,
          lastUpdated: new Date(),
        },
        update: {
          drepYesPercent: drepYesPercent ?? undefined,
          drepNoPercent: drepNoPercent ?? undefined,
          drepYesAda: drepAgg ? drepYesAda : undefined,
          drepNoAda: drepAgg ? drepNoAda : undefined,
          spoYesPercent: spoYesPercent ?? undefined,
          spoNoPercent: spoNoPercent ?? undefined,
          spoYesAda: spoAgg ? spoYesAda : undefined,
          spoNoAda: spoAgg ? spoNoAda : undefined,
          ccYesPercent: ccYesPercent ?? undefined,
          ccNoPercent: ccNoPercent ?? undefined,
          ccYesCount: ccAgg ? ccAgg.yesCount : undefined,
          ccNoCount: ccAgg ? ccAgg.noCount : undefined,
          totalYes,
          totalNo,
          totalAbstain,
          lastUpdated: new Date(),
        },
      });
      updatedStatistics += 1;
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      processedActions: actions.length,
      updatedStatistics,
      dryRun,
      ...(dryRun ? { preview: dryRunPreview } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Internal Server Error",
      detail: message,
    });
  }
}


