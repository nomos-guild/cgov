import type { GetServerSideProps } from "next";
import {
  fetchGovernanceActionsServer,
  fetchAllDRepsServer,
} from "@/lib/serverFetch";
import { getFundedEntityIds } from "@/lib/treasuryEntities";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  buildLocaleUrl,
} from "@/lib/seo";

const STATIC_PATHS = [
  "/",
  "/governance",
  "/adadev",
  "/drep",
  "/drep/charts",
  "/drep/picker",
  "/treasury",
  "/treasury/entities",
] as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlEntry(path: string): string {
  const canonical = buildLocaleUrl(path, DEFAULT_LOCALE);
  const alternates = SUPPORTED_LOCALES.map(
    (locale) =>
      `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(
        buildLocaleUrl(path, locale)
      )}" />`
  ).join("\n");
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
    canonical
  )}" />`;
  return [
    "  <url>",
    `    <loc>${escapeXml(canonical)}</loc>`,
    alternates,
    xDefault,
    "  </url>",
  ].join("\n");
}

async function buildSitemap(): Promise<string> {
  const dynamicPaths: string[] = [];

  const [actions, dreps] = await Promise.all([
    fetchGovernanceActionsServer(),
    fetchAllDRepsServer(),
  ]);

  for (const action of actions) {
    if (action.hash) {
      dynamicPaths.push(`/governance/${encodeURIComponent(action.hash)}`);
    }
  }
  for (const drep of dreps) {
    if (drep.drepId) {
      dynamicPaths.push(`/drep/${encodeURIComponent(drep.drepId)}`);
    }
  }
  for (const entityId of getFundedEntityIds()) {
    dynamicPaths.push(`/treasury/${encodeURIComponent(entityId)}`);
  }

  const allPaths = [...STATIC_PATHS, ...dynamicPaths];
  const entries = allPaths.map(buildUrlEntry).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>`;
}

function Sitemap() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  try {
    const xml = await buildSitemap();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.write(xml);
    res.end();
  } catch (error) {
    console.error("Failed to build sitemap:", error);
    res.statusCode = 500;
    res.end();
  }

  return { props: {} };
};

export default Sitemap;
