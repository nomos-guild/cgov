import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export const config = {
	runtime: "nodejs",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	try {
		// Prefer an unsafe raw to bypass binding if driver/env has issues with template tags
		const rows = (await prisma.$queryRawUnsafe(
			"SELECT 1 AS one"
		)) as Array<{ one: number }>;
		return res.status(200).json({
			status: "ok",
			ok: rows?.[0]?.one === 1,
		});
	} catch (error: unknown) {
		// Fallback to a trivial ORM call to confirm Prisma client loads and DB is reachable
		try {
			await prisma.governanceAction.count();
			return res.status(200).json({ status: "ok", ok: true, mode: "fallback-count" });
		} catch {
			// ignore and report original error
		}
		const message = error instanceof Error ? error.message : "Unknown error";
		return res.status(500).json({ status: "error", error: message });
	}
}


