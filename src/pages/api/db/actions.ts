import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

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

function parseStringParam(value: string | string[] | undefined): string | undefined {
	if (value === undefined) return undefined;
	const raw = Array.isArray(value) ? value[0] : value;
	return raw.trim() || undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	const limit = parseIntParam(req.query.limit, 50, 1, 500);
	const offset = parseIntParam(req.query.offset, 0, 0);
	const status = parseStringParam(req.query.status);
	const type = parseStringParam(req.query.type);
	const search = parseStringParam(req.query.search);

	try {
		const where = {
			...(status ? { status } : {}),
			...(type ? { type } : {}),
			...(search
				? {
						OR: [
							{ title: { contains: search, mode: "insensitive" as const } },
							{ proposalId: { contains: search, mode: "insensitive" as const } },
							{ txHash: { contains: search, mode: "insensitive" as const } },
						],
				  }
				: {}),
		};

		const [total, data] = await Promise.all([
			prisma.governanceAction.count({ where }),
			prisma.governanceAction.findMany({
				where,
				orderBy: { submissionEpoch: "desc" },
				skip: offset,
				take: limit,
				include: {
					statistics: true,
				},
			}),
		]);

		res.setHeader("X-Total-Count", String(total));
		res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
		return res.status(200).json({
			total,
			count: data.length,
			offset,
			limit,
			data,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return res.status(500).json({ error: "Internal Server Error", detail: message });
	}
}


