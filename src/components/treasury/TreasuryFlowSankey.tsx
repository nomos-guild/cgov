import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import {
  sankey,
  sankeyJustify,
  sankeyLinkHorizontal,
  type SankeyNodeMinimal,
  type SankeyLinkMinimal,
} from "d3-sankey";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import {
  PROPOSAL_ENTITY_MAP,
  SUPPORTED_YEARS,
  getTreasuryEntity,
  type TreasuryYear,
} from "@/lib/treasuryEntities";
import { cn } from "@/lib/utils";

type NodeKind = "treasury" | "entity" | "proposal";

interface ChartNode extends SankeyNodeMinimal<ChartNode, ChartLink> {
  nodeId: string;
  kind: NodeKind;
  label: string;
  hash?: string;
  status?: string;
  adaTotal: number;
  /** For proposal nodes: the nodeId of their parent entity, used to cascade
   *  the hover effect from entity → its proposals. */
  parentEntityId?: string;
}

interface ChartLink extends SankeyLinkMinimal<ChartNode, ChartLink> {
  variant: "approved" | "rejected";
  value: number;
}

type FilterMode = "approved" | "all";

const APPROVED_STATUSES = new Set(["Enacted", "Ratified"]);
const REJECTED_STATUSES = new Set(["Expired", "Closed"]);

const CHART_WIDTH = 1400;
const CHART_HEIGHT = 1400;
const MARGIN = { top: 16, right: 440, bottom: 16, left: 110 };
const NODE_WIDTH = 6;
const NODE_PADDING = 24;

// Heights are drawn using sqrt(ADA) so one ₳70M lane can't dwarf thirty
// sub-₳5M lanes. Tooltip values remain the real ADA figure.
const visualValue = (ada: number) => Math.sqrt(Math.max(ada, 0));

// Uniform size for every ADA budget pill so entity and proposal chips line up.
const ADA_BOX_WIDTH = 72;
const BOX_HEIGHT = 22;

function formatAda(value: number): string {
  if (value >= 1_000_000_000) return `₳${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `₳${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `₳${(value / 1_000).toFixed(1)}K`;
  return `₳${value.toFixed(0)}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function cleanProposalTitle(title: string): string {
  // Strip common "Withdraw ₳X for " / "Loan ₳X to " prefixes so the label
  // surfaces what actually differs between proposals.
  return title.replace(/^(?:Withdraw|Loan)\s+\S+\s+(?:for|to)\s+/i, "").trim();
}

// Cardano Shelley era started at epoch 208 on 2020-07-29 21:44:51 UTC with
// 5-day epochs. This lets us map a submissionEpoch to a calendar year without
// needing the backend to expose startTime per epoch.
const SHELLEY_EPOCH = 208;
const SHELLEY_EPOCH_START_MS = Date.UTC(2020, 6, 29, 21, 44, 51);
const EPOCH_LENGTH_MS = 5 * 24 * 60 * 60 * 1000;
function epochToYear(epoch: number): TreasuryYear | null {
  if (!Number.isFinite(epoch) || epoch < SHELLEY_EPOCH) return null;
  const ms = SHELLEY_EPOCH_START_MS + (epoch - SHELLEY_EPOCH) * EPOCH_LENGTH_MS;
  const year = new Date(ms).getUTCFullYear();
  return (SUPPORTED_YEARS as readonly number[]).includes(year)
    ? (year as TreasuryYear)
    : null;
}

const UNKNOWN_ENTITY_ID = "unknown";

export function TreasuryFlowSankey() {
  const t = useTranslations("treasury");
  const router = useRouter();
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const actions = useAppSelector((s) => s.governance.actions);

  const [mode, setMode] = useState<FilterMode>("approved");
  const [year, setYear] = useState<TreasuryYear | "all">(2025);
  const [hover, setHover] = useState<
    | { kind: "node"; nodeId: string }
    | { kind: "link"; index: number }
    | null
  >(null);

  const approvedColor = isDark ? "#0bd1a2" : "#16a34a";
  const rejectedColor = isDark ? "#f87171" : "#dc2626";
  const textColor = isDark ? "#e2e8f0" : "#0f172a";
  const mutedTextColor = isDark ? "rgba(226,232,240,0.6)" : "rgba(15,23,42,0.55)";

  const layout = useMemo(() => {
    const activeYears: TreasuryYear[] =
      year === "all" ? [...SUPPORTED_YEARS] : [year];
    const activeYearSet = new Set<TreasuryYear>(activeYears);
    const combinedMap: Record<string, (typeof PROPOSAL_ENTITY_MAP)[TreasuryYear][string]> = {};
    for (const y of activeYears) Object.assign(combinedMap, PROPOSAL_ENTITY_MAP[y]);

    // Drive the chart from live `actions`, not from the static map. That way
    // a newly enacted/expired Treasury Withdrawal appears automatically — it
    // just lands in "Unclassified" until a human curates it into the map.
    const filteredEntries = actions
      .map((action) => {
        if (action.type !== "Treasury Withdrawals") return null;
        const proposalYear = epochToYear(action.submissionEpoch);
        if (!proposalYear || !activeYearSet.has(proposalYear)) return null;
        const amountAda = action.withdrawalAmount
          ? Number(action.withdrawalAmount) / 1_000_000
          : 0;
        if (amountAda <= 0) return null;
        const isApproved = APPROVED_STATUSES.has(action.status);
        const isRejected = REJECTED_STATUSES.has(action.status);
        if (!isApproved && !isRejected) return null;
        if (mode === "approved" && !isApproved) return null;
        const proposalId = action.proposalId ?? action.hash;
        const mapping = action.proposalId
          ? combinedMap[action.proposalId]
          : undefined;
        return {
          proposalId,
          entityId: mapping?.entityId ?? UNKNOWN_ENTITY_ID,
          amountAda,
          variant: isApproved ? ("approved" as const) : ("rejected" as const),
          action,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (filteredEntries.length === 0) {
      return { nodes: [] as ChartNode[], links: [] as ChartLink[], total: 0 };
    }

    const entityTotals = new Map<string, number>();
    const entityVisualTotals = new Map<string, number>();
    for (const e of filteredEntries) {
      entityTotals.set(e.entityId, (entityTotals.get(e.entityId) ?? 0) + e.amountAda);
      entityVisualTotals.set(
        e.entityId,
        (entityVisualTotals.get(e.entityId) ?? 0) + visualValue(e.amountAda)
      );
    }
    const sortedEntities = [...entityTotals.entries()].sort((a, b) => b[1] - a[1]);
    const totalAda = sortedEntities.reduce((s, [, v]) => s + v, 0);

    const nodes: ChartNode[] = [];

    const pushNode = (node: Omit<ChartNode, keyof SankeyNodeMinimal<ChartNode, ChartLink>>) => {
      nodes.push(node as ChartNode);
    };

    const treasuryKey = String(year);
    const treasuryLabel = year === "all" ? "All" : String(year);
    pushNode({
      nodeId: `treasury:${treasuryKey}`,
      kind: "treasury",
      label: treasuryLabel,
      adaTotal: totalAda,
    });

    for (const [entityId, total] of sortedEntities) {
      pushNode({
        nodeId: `entity:${entityId}`,
        kind: "entity",
        label: getTreasuryEntity(entityId).label,
        adaTotal: total,
      });
    }

    const sortedProposals = [...filteredEntries].sort((a, b) => {
      const entityOrder =
        sortedEntities.findIndex(([id]) => id === a.entityId) -
        sortedEntities.findIndex(([id]) => id === b.entityId);
      if (entityOrder !== 0) return entityOrder;
      return b.amountAda - a.amountAda;
    });

    for (const p of sortedProposals) {
      pushNode({
        nodeId: `proposal:${p.proposalId}`,
        kind: "proposal",
        label: cleanProposalTitle(
          p.action.title || p.proposalId.slice(0, 12)
        ),
        hash: p.action.hash,
        status: p.action.status,
        adaTotal: p.amountAda,
        parentEntityId: `entity:${p.entityId}`,
      });
    }

    const links: ChartLink[] = [];

    for (const [entityId] of sortedEntities) {
      links.push({
        source: `treasury:${treasuryKey}`,
        target: `entity:${entityId}`,
        value: entityVisualTotals.get(entityId) ?? 0,
        variant: sortedProposals.some(
          (p) => p.entityId === entityId && p.variant === "approved"
        )
          ? "approved"
          : "rejected",
      });
    }

    for (const p of sortedProposals) {
      links.push({
        source: `entity:${p.entityId}`,
        target: `proposal:${p.proposalId}`,
        value: visualValue(p.amountAda),
        variant: p.variant,
      });
    }

    const sankeyGen = sankey<ChartNode, ChartLink>()
      .nodeId((d) => d.nodeId)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyJustify)
      // Respect our insertion order (entity by total desc, proposals grouped
      // under their entity) instead of letting d3-sankey re-shuffle columns
      // to minimise link crossings — that was pulling small proposals away
      // from their entity block. Also pin link order so each outgoing ribbon
      // exits its source at the same rank as the target proposal appears in
      // the next column (biggest → topmost, etc).
      .nodeSort(null)
      .linkSort((a, b) => {
        const ai = (a.target as ChartNode).index ?? 0;
        const bi = (b.target as ChartNode).index ?? 0;
        return ai - bi;
      })
      .extent([
        [MARGIN.left, MARGIN.top],
        [CHART_WIDTH - MARGIN.right, CHART_HEIGHT - MARGIN.bottom],
      ]);

    const graph = sankeyGen({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    });

    // d3-sankey top-aligns each column within the extent. Centre each column
    // independently so short columns (e.g. the single Treasury node) sit in
    // the middle and links fan both upward and downward.
    const extentTop = MARGIN.top;
    const extentBottom = CHART_HEIGHT - MARGIN.bottom;
    const columnCentre = (extentTop + extentBottom) / 2;
    const columnOffsets = new Map<number, number>();
    const columnBounds = new Map<number, { min: number; max: number }>();
    for (const n of graph.nodes) {
      if (n.x0 == null || n.y0 == null || n.y1 == null) continue;
      const b = columnBounds.get(n.x0);
      if (!b) columnBounds.set(n.x0, { min: n.y0, max: n.y1 });
      else {
        b.min = Math.min(b.min, n.y0);
        b.max = Math.max(b.max, n.y1);
      }
    }
    for (const [x, b] of columnBounds) {
      columnOffsets.set(x, columnCentre - (b.min + b.max) / 2);
    }
    for (const n of graph.nodes) {
      if (n.x0 == null) continue;
      const off = columnOffsets.get(n.x0) ?? 0;
      if (n.y0 != null) n.y0 += off;
      if (n.y1 != null) n.y1 += off;
    }
    for (const l of graph.links) {
      const src = l.source as ChartNode;
      const tgt = l.target as ChartNode;
      const srcOff = src.x0 != null ? columnOffsets.get(src.x0) ?? 0 : 0;
      const tgtOff = tgt.x0 != null ? columnOffsets.get(tgt.x0) ?? 0 : 0;
      if (l.y0 != null) l.y0 += srcOff;
      if (l.y1 != null) l.y1 += tgtOff;
    }

    return {
      nodes: graph.nodes as ChartNode[],
      links: graph.links as ChartLink[],
      total: totalAda,
    };
  }, [actions, mode, year]);

  const linkPath = sankeyLinkHorizontal<ChartNode, ChartLink>();

  const colorForLink = (l: ChartLink) =>
    l.variant === "approved" ? approvedColor : rejectedColor;

  const toggleButtonBase =
    "px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors";

  const handleProposalClick = (n: ChartNode) => {
    if (n.kind !== "proposal" || !n.hash) return;
    router.push(`/governance/${n.hash}`);
  };

  // Hovering a Treasury → Entity ribbon behaves like hovering the entity
  // itself, so the entity's full cascade (all its proposal ribbons + proposal
  // button glow/grow) fires rather than just one isolated link highlight.
  const onLinkHover = (l: ChartLink, i: number) => {
    const src = l.source as ChartNode;
    const tgt = l.target as ChartNode;
    if (src.kind === "treasury" && tgt.kind === "entity") {
      setHover({ kind: "node", nodeId: tgt.nodeId });
    } else {
      setHover({ kind: "link", index: i });
    }
  };

  const isLinkHighlighted = (l: ChartLink, i: number): boolean => {
    if (!hover) return false;
    if (hover.kind === "link") return hover.index === i;
    const src = l.source as ChartNode;
    const tgt = l.target as ChartNode;
    return src.nodeId === hover.nodeId || tgt.nodeId === hover.nodeId;
  };

  const onLeave = () => setHover(null);

  if (layout.nodes.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground",
          "dark:rounded-none dark:border-[#0bd1a2] dark:bg-background"
        )}
      >
        {t("flowChartTitle")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 sm:p-5 md:p-6 shadow-elevation-2",
        "dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3
            className={cn(
              "text-sm sm:text-base font-semibold",
              isDark ? "text-[#0bd1a2]" : "text-black"
            )}
          >
            {t("flowChartTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {formatAda(layout.total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <div
            role="tablist"
            aria-label="Select year"
            className="inline-flex rounded-md border border-border overflow-hidden"
          >
            {[...SUPPORTED_YEARS, "all" as const].map((y) => (
              <button
                key={y}
                type="button"
                role="tab"
                aria-selected={year === y}
                onClick={() => setYear(y)}
                className={cn(
                  toggleButtonBase,
                  year === y
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {y === "all" ? "All" : y}
              </button>
            ))}
          </div>
          <div
            role="tablist"
            aria-label="Filter approved or including rejected"
            className="inline-flex rounded-md border border-border overflow-hidden"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "approved"}
              onClick={() => setMode("approved")}
              className={cn(
                toggleButtonBase,
                mode === "approved"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t("flowApprovedOnly")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "all"}
              onClick={() => setMode("all")}
              className={cn(
                toggleButtonBase,
                mode === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t("flowIncludingRejected")}
            </button>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-visible">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMinYMin meet"
          className="w-full h-auto"
          onMouseLeave={onLeave}
        >
          {/* Links are split into two isolated-opacity groups so that
              overlapping strokes do not accumulate alpha (two 35% strokes
              would otherwise composite to ~58% in the overlap region). Each
              path inside a group is rendered at solid 100%; the desired
              translucency is applied once at the group level. */}
          <g style={{ opacity: 0.35 }}>
            {layout.links.map((l, i) =>
              isLinkHighlighted(l, i) ? null : (
                <path
                  key={i}
                  d={linkPath(l) ?? undefined}
                  fill="none"
                  stroke={colorForLink(l)}
                  strokeOpacity={1}
                  strokeWidth={Math.max(1, l.width ?? 0)}
                  onMouseEnter={() => onLinkHover(l, i)}
                  onMouseLeave={onLeave}
                  style={{ cursor: "default" }}
                />
              )
            )}
          </g>
          <g style={{ opacity: 0.85 }}>
            {layout.links.map((l, i) =>
              isLinkHighlighted(l, i) ? (
                <path
                  key={i}
                  d={linkPath(l) ?? undefined}
                  fill="none"
                  stroke={colorForLink(l)}
                  strokeOpacity={1}
                  strokeWidth={Math.max(1, l.width ?? 0)}
                  onMouseEnter={() => onLinkHover(l, i)}
                  onMouseLeave={onLeave}
                  style={{ cursor: "default" }}
                />
              ) : null
            )}
          </g>
          <g>
            {layout.nodes.map((n) => {
              const x = n.x0 ?? 0;
              const y = n.y0 ?? 0;
              const w = (n.x1 ?? 0) - x;
              const h = (n.y1 ?? 0) - y;
              const isProposal = n.kind === "proposal";
              const labelOnRight = n.kind !== "treasury";
              const labelX = labelOnRight ? x + w + 6 : x - 6;
              const maxLabelChars = n.kind === "proposal" ? 48 : 28;
              return (
                <g
                  key={n.nodeId}
                  onMouseEnter={() => setHover({ kind: "node", nodeId: n.nodeId })}
                  onMouseLeave={onLeave}
                  onClick={() => handleProposalClick(n)}
                  style={{ cursor: isProposal ? "pointer" : "default" }}
                >
                  {n.kind === "entity" ? (() => {
                    const label = truncate(n.label, maxLabelChars);
                    const ada = formatAda(n.adaTotal);
                    const boxHeight = BOX_HEIGHT;
                    const adaWidth = ADA_BOX_WIDTH;
                    const labelWidth = label.length * 6.5 + 14;
                    const adaX = x + w + 4;
                    const labelBoxX = adaX + adaWidth + 4;
                    const centerY = y + h / 2;
                    const boxFill = isDark
                      ? "rgba(0,0,0,0.85)"
                      : "rgba(255,255,255,0.94)";
                    const boxStroke = isDark
                      ? "rgba(11,209,162,0.25)"
                      : "rgba(15,23,42,0.1)";
                    return (
                      <>
                        <rect
                          x={adaX}
                          y={centerY - boxHeight / 2}
                          width={adaWidth}
                          height={boxHeight}
                          rx={4}
                          fill={boxFill}
                          stroke={boxStroke}
                          strokeWidth={0.75}
                        />
                        <text
                          x={adaX + adaWidth / 2}
                          y={centerY}
                          dy="0.35em"
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={500}
                          fill={mutedTextColor}
                          style={{ pointerEvents: "none" }}
                        >
                          {ada}
                        </text>
                        <rect
                          x={labelBoxX}
                          y={centerY - boxHeight / 2}
                          width={labelWidth}
                          height={boxHeight}
                          rx={4}
                          fill={boxFill}
                          stroke={boxStroke}
                          strokeWidth={0.75}
                        />
                        <text
                          x={labelBoxX + 7}
                          y={centerY}
                          dy="0.35em"
                          textAnchor="start"
                          fontSize={11}
                          fontWeight={500}
                          fill={textColor}
                          style={{ pointerEvents: "none" }}
                        >
                          {label}
                        </text>
                      </>
                    );
                  })() : n.kind === "proposal" ? (() => {
                    const label = truncate(n.label, maxLabelChars);
                    const ada = formatAda(n.adaTotal);
                    const boxHeight = BOX_HEIGHT;
                    const adaWidth = ADA_BOX_WIDTH;
                    const labelWidth = label.length * 6.5 + 14;
                    const adaX = x + w + 4;
                    const labelBoxX = adaX + adaWidth + 4;
                    const centerY = y + h / 2;
                    const isHovered =
                      hover?.kind === "node" &&
                      (hover.nodeId === n.nodeId ||
                        hover.nodeId === n.parentEntityId);
                    const boxFill = isDark
                      ? "rgba(0,0,0,0.85)"
                      : "rgba(255,255,255,0.94)";
                    const boxStroke = isDark
                      ? "rgba(11,209,162,0.25)"
                      : "rgba(15,23,42,0.1)";
                    const glowColor = isDark
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(15,23,42,0.22)";
                    // CSS `transform` on SVG treats numbers as CSS pixels, so
                    // a manual translate-scale-translate pivot misaligns every
                    // button except the one near the SVG origin. Letting the
                    // browser compute the pivot via `transform-box: fill-box`
                    // + `transform-origin: center` scales each group about
                    // its own bounding-box centre.
                    const groupStyle = {
                      transform: isHovered ? "scale(1.05)" : undefined,
                      transformBox: "fill-box" as const,
                      transformOrigin: "center" as const,
                      filter: isHovered
                        ? `drop-shadow(0 0 8px ${glowColor})`
                        : undefined,
                      transition: "transform 140ms ease, filter 140ms ease",
                    };
                    return (
                      <g style={groupStyle}>
                        <rect
                          x={adaX}
                          y={centerY - boxHeight / 2}
                          width={adaWidth}
                          height={boxHeight}
                          rx={4}
                          fill={boxFill}
                          stroke={boxStroke}
                          strokeWidth={0.75}
                        />
                        <text
                          x={adaX + adaWidth / 2}
                          y={centerY}
                          dy="0.35em"
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={500}
                          fill={mutedTextColor}
                          style={{ pointerEvents: "none" }}
                        >
                          {ada}
                        </text>
                        <rect
                          x={labelBoxX}
                          y={centerY - boxHeight / 2}
                          width={labelWidth}
                          height={boxHeight}
                          rx={4}
                          fill={boxFill}
                          stroke={boxStroke}
                          strokeWidth={0.75}
                        />
                        <text
                          x={labelBoxX + 7}
                          y={centerY}
                          dy="0.35em"
                          textAnchor="start"
                          fontSize={11}
                          fontWeight={500}
                          fill={textColor}
                          style={{ pointerEvents: "none" }}
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })() : (() => {
                    // Treasury node — "2025" label box stacked over the total-spend pill.
                    const centerY = y + h / 2;
                    const labelBoxY = centerY - BOX_HEIGHT - 2;
                    const pillY = centerY + 2;
                    const pillX = labelX - ADA_BOX_WIDTH;
                    const boxFill = isDark
                      ? "rgba(0,0,0,0.85)"
                      : "rgba(255,255,255,0.94)";
                    const boxStroke = isDark
                      ? "rgba(11,209,162,0.25)"
                      : "rgba(15,23,42,0.1)";
                    return (
                      <>
                        <rect
                          x={pillX}
                          y={labelBoxY}
                          width={ADA_BOX_WIDTH}
                          height={BOX_HEIGHT}
                          rx={4}
                          fill={boxFill}
                          stroke={boxStroke}
                          strokeWidth={0.75}
                        />
                        <text
                          x={pillX + ADA_BOX_WIDTH / 2}
                          y={labelBoxY + BOX_HEIGHT / 2}
                          dy="0.35em"
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={600}
                          fill={textColor}
                          style={{ pointerEvents: "none" }}
                        >
                          {truncate(n.label, maxLabelChars)}
                        </text>
                        <rect
                          x={pillX}
                          y={pillY}
                          width={ADA_BOX_WIDTH}
                          height={BOX_HEIGHT}
                          rx={4}
                          fill={boxFill}
                          stroke={boxStroke}
                          strokeWidth={0.75}
                        />
                        <text
                          x={pillX + ADA_BOX_WIDTH / 2}
                          y={pillY + BOX_HEIGHT / 2}
                          dy="0.35em"
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={500}
                          fill={mutedTextColor}
                          style={{ pointerEvents: "none" }}
                        >
                          {formatAda(n.adaTotal)}
                        </text>
                      </>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
