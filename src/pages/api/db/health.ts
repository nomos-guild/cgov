import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	try {
		// Simple heartbeat: fetch server timestamp from DB
		const now = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW()`;
		return res.status(200).json({
			status: "ok",
			time: now?.[0]?.now ?? null,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return res.status(500).json({ status: "error", error: message });
	}
}


