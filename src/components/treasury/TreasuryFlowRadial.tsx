import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRowLink } from "@/hooks/useRowLink";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import { hierarchy, cluster, type HierarchyLink, type HierarchyNode } from "d3-hierarchy";
import { linkRadial } from "d3-shape";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import { Maximize2, X } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import {
  getFundedEntityIds,
  getTreasuryEntity,
  resolveProposalEntity,
  SUPPORTED_YEARS,
  type TreasuryYear,
} from "@/lib/treasuryEntities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────

type LinkVariant = "approved" | "active" | "rejected";
type FilterMode = "approved" | "active" | "rejected" | "all";
type YearMode = TreasuryYear | "all";
type NodeKind = "treasury" | "entity" | "proposal";

interface ProposalDatum {
  proposalId: string;
  hash: string;
  title: string;
  status: string;
  amountAda: number;
  variant: LinkVariant;
}

interface RadialNodeData {
  kind: NodeKind;
  id: string;
  label: string;
  ada: number;
  /** Only set for proposal leaves. */
  variant?: LinkVariant;
  /** Only set for proposal leaves — used to navigate to /governance/{hash}. */
  hash?: string;
  /** Only set for proposal leaves — submission year, rendered as a tag. */
  year?: TreasuryYear;
  /** Only set for entity nodes — used to navigate to /treasury/{entityId}. */
  entityId?: string;
  children?: RadialNodeData[];
}

// ── Constants ───────────────────────────────────────────────────────────

const APPROVED_STATUSES = new Set(["Enacted", "Ratified"]);
const REJECTED_STATUSES = new Set(["Expired", "Closed"]);

// SVG layout — square viewport centred on (0, 0). Outer leaf ring sits at
// `LEAF_RADIUS`; the rest of the SVG canvas reserves space for the
// outermost proposal labels which extend further than LEAF_RADIUS.
// A smaller VIEW_SIZE relative to LEAF_RADIUS makes everything appear
// physically larger on screen since the SVG fills its container.
const VIEW_SIZE = 1750;
const LEAF_RADIUS = 440;
const CANVAS_HALF = VIEW_SIZE / 2;

// Pill geometry — heuristic character widths since we don't measure text
// at render time. Slightly generous so wide glyphs (W, M) don't overflow.
const CHAR_W_ENTITY = 8.5;
const CHAR_W_PROPOSAL = 7.4;
const PILL_H_ENTITY = 25;
const PILL_H_PROPOSAL = 23;
const PILL_RADIUS = 4;
const PILL_GAP = 4;
const PILL_OFFSET = 6;
const ENTITY_LABEL_MAX = 22;
const PROPOSAL_LABEL_MAX = 28;

// Centre node visuals + the radius at which root → entity links originate.
// Without this offset every root link would converge on the same point at
// (0, 0), which looks like a starburst pinch. Starting them on the
// perimeter of the centre disc spreads the origin out around a small ring.
const CENTER_RADIUS = 68;
const ROOT_LINK_SOURCE_RADIUS = CENTER_RADIUS + 2;

// ── Helpers ─────────────────────────────────────────────────────────────

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

function sumAda(proposals: ProposalDatum[]): number {
  return proposals.reduce((s, p) => s + p.amountAda, 0);
}

/**
 * Walk descendants of an internal node and return the first variant in the
 * priority order approved → active → rejected. Used to colour the link from
 * a parent (year, entity) since the parent itself has no native variant —
 * the colour reflects whatever positive activity the subtree contains.
 */
function dominantVariantFromLeaves(
  node: HierarchyNode<RadialNodeData>
): LinkVariant {
  if (node.data.kind === "proposal" && node.data.variant) {
    return node.data.variant;
  }
  const leaves = node.leaves();
  if (leaves.some((l) => l.data.variant === "approved")) return "approved";
  if (leaves.some((l) => l.data.variant === "active")) return "active";
  return "rejected";
}

// ── Component ───────────────────────────────────────────────────────────

export function TreasuryFlowRadial() {
  const t = useTranslations("treasury");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const rowLink = useRowLink();
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const isGame = activeTheme.id === "game";
  const actions = useAppSelector((s) => s.governance.actions);

  const [mode, setMode] = useState<FilterMode>("all");
  const [yearMode, setYearMode] = useState<YearMode>("all");
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Pan/zoom transform applied to the chart content. Wheel always zooms
  // (centred on the cursor); drag-pan only kicks in once the user has
  // zoomed in (k > 1), so at default scale the existing click-on-empty-svg
  // → close-panel behaviour still works.
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoomTransform, setZoomTransform] = useState<ZoomTransform>(zoomIdentity);
  const zoomTransformRef = useRef<ZoomTransform>(zoomIdentity);
  zoomTransformRef.current = zoomTransform;
  // Defer clearing hover by a few frames so moving between sibling pills
  // (e.g. proposal A → proposal B under the same entity) doesn't reset the
  // shared parent's highlight in between. The pending clear is cancelled by
  // the next mouseenter.
  const hoverClearTimer = useRef<number | null>(null);
  const cancelHoverClear = () => {
    if (hoverClearTimer.current !== null) {
      window.clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
  };
  const setHover = (id: string) => {
    cancelHoverClear();
    setHoverId(id);
  };
  const queueHoverClear = () => {
    cancelHoverClear();
    hoverClearTimer.current = window.setTimeout(() => {
      setHoverId(null);
      hoverClearTimer.current = null;
    }, 500);
  };
  useEffect(() => () => cancelHoverClear(), []);
  // One panel at a time — clicking an entity vs a proposal swaps the card
  // contents but reuses the same portalled side-panel chrome.
  const [selection, setSelection] = useState<
    | { kind: "entity"; entityId: string }
    | { kind: "proposal"; hash: string }
    | null
  >(null);
  // Drives the slide-in animation. Set to true on a microtask after the
  // panel mounts so the browser sees the offscreen → onscreen transform
  // change rather than rendering it onscreen immediately.
  const [panelOpen, setPanelOpen] = useState(false);
  // SSR guard for the portal.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);

  // Attach d3-zoom to the SVG. Wheel events always trigger zoom; mousedown
  // (drag-pan) is gated to k > 1 so the existing click-on-empty-svg
  // close-panel behaviour is preserved at the default scale.
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .filter((event) => {
        if (event.type === "wheel") return !event.ctrlKey;
        if (event.type === "mousedown") {
          // Only allow drag-pan after the user has zoomed in.
          return zoomTransformRef.current.k > 1;
        }
        // Allow touch gestures (pinch-zoom) regardless.
        return event.type.startsWith("touch");
      })
      .on("zoom", (event) => {
        setZoomTransform(event.transform);
      })
      .on("end", (event) => {
        // When the user zooms back out to the minimum scale, snap the pan
        // offset back to the centre too — otherwise repeated zoom-in/out
        // cycles drift the view, forcing the user to re-centre manually
        // before they can see the whole chart again.
        if (
          event.transform.k <= 1.001 &&
          (event.transform.x !== 0 || event.transform.y !== 0)
        ) {
          select(svgEl)
            .transition()
            .duration(220)
            .call(behavior.transform, zoomIdentity);
        }
      });
    zoomBehaviorRef.current = behavior;
    const sel = select(svgEl);
    sel.call(behavior);
    return () => {
      sel.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  const resetZoom = () => {
    const svgEl = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svgEl || !behavior) return;
    // Canonical d3-zoom reset: drive the transform through the behavior's
    // own .transform() on a transition selection so the "zoom" callback
    // fires and React state stays in sync.
    select(svgEl).transition().duration(280).call(behavior.transform, zoomIdentity);
  };

  // Ref for the side panel — clicks inside the panel itself shouldn't
  // dismiss it. Other "keep open" surfaces (clickable nodes, toggle group)
  // are tagged with the `data-chart-keep-open` attribute and detected via
  // `closest()` below, so a click on empty SVG space *does* close the panel.
  const panelRef = useRef<HTMLElement>(null);

  // Close the side panel when the user clicks anywhere except the panel
  // itself or a tagged interactive surface. Use mousedown so the close
  // happens before any other click handler downstream gets a chance to
  // react.
  useEffect(() => {
    if (!selection) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest?.("[data-chart-keep-open]")) return;
      setSelection(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selection]);

  useEffect(() => {
    if (selection) {
      const id = requestAnimationFrame(() => setPanelOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setPanelOpen(false);
  }, [selection]);

  // Allow Escape to dismiss the side panel; matches the click-outside backdrop.
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  const approvedColor = isDark ? "#0bd1a2" : "#16a34a";
  const activeColor = isDark ? "#fbbf24" : "#d97706";
  const rejectedColor = isDark ? "#f87171" : "#dc2626";
  const textColor = isDark ? "#e2e8f0" : "#0f172a";
  const mutedTextColor = isDark
    ? "rgba(226,232,240,0.6)"
    : "rgba(15,23,42,0.55)";
  const pillFill = isGame
    ? "rgba(12,12,12,0.85)"
    : isDark
    ? "rgba(0,0,0,0.85)"
    : "rgba(255,255,255,0.94)";
  const pillStroke = isGame
    ? "rgba(255,255,255,0.18)"
    : isDark
    ? "rgba(11,209,162,0.25)"
    : "rgba(15,23,42,0.1)";

  const fundedEntitySet = useMemo(() => new Set(getFundedEntityIds()), []);

  // ── Tree construction ────────────────────────────────────────────────
  const tree = useMemo<RadialNodeData | null>(() => {
    // Bucket proposals by entity directly — year is just metadata on each
    // proposal now, so an entity that funded across multiple years still
    // appears once in the chart.
    const entityBuckets = new Map<
      string,
      Array<ProposalDatum & { year: TreasuryYear }>
    >();

    for (const action of actions) {
      const resolved = resolveProposalEntity(action);
      if (!resolved || resolved.year == null) continue;
      if (yearMode !== "all" && resolved.year !== yearMode) continue;

      const amountAda = action.withdrawalAmount
        ? Number(action.withdrawalAmount) / 1_000_000
        : 0;
      if (amountAda <= 0) continue;

      const isApproved = APPROVED_STATUSES.has(action.status);
      const isActive = action.status === "Active";
      const isRejected = REJECTED_STATUSES.has(action.status);
      if (!isApproved && !isActive && !isRejected) continue;
      if (mode === "approved" && !isApproved) continue;
      if (mode === "active" && !isActive) continue;
      if (mode === "rejected" && !isRejected) continue;

      const variant: LinkVariant = isApproved
        ? "approved"
        : isActive
        ? "active"
        : "rejected";

      const proposal = {
        proposalId: action.proposalId ?? action.hash,
        hash: action.hash,
        title: action.title,
        status: action.status,
        amountAda,
        variant,
        year: resolved.year,
      };

      let list = entityBuckets.get(resolved.entityId);
      if (!list) {
        list = [];
        entityBuckets.set(resolved.entityId, list);
      }
      list.push(proposal);
    }

    if (entityBuckets.size === 0) return null;

    const entityChildren: RadialNodeData[] = [...entityBuckets.entries()]
      .map(([entityId, proposals]) => {
        const total = sumAda(proposals);
        const proposalChildren: RadialNodeData[] = [...proposals]
          // Newest year first, then largest ADA within a year.
          .sort((a, b) => b.year - a.year || b.amountAda - a.amountAda)
          .map((p) => ({
            kind: "proposal" as const,
            id: `proposal:${p.proposalId}`,
            label: cleanProposalTitle(p.title || p.proposalId.slice(0, 12)),
            ada: p.amountAda,
            variant: p.variant,
            hash: p.hash,
            year: p.year,
          }));
        return {
          kind: "entity" as const,
          id: `entity:${entityId}`,
          label: getTreasuryEntity(entityId).label,
          entityId,
          ada: total,
          children: proposalChildren,
        };
      })
      .sort((a, b) => b.ada - a.ada);

    const total = entityChildren.reduce((s, e) => s + e.ada, 0);
    return {
      kind: "treasury",
      id: "treasury",
      label: "Treasury",
      ada: total,
      children: entityChildren,
    };
  }, [actions, mode, yearMode]);

  // Spent vs requested totals for the centre label and the header subtitle.
  // Computed independently of the chart's status / year filter modes so the
  // user always sees the full picture.
  //   spent       — approved & paid out (Enacted / Ratified)
  //   spentByYear — same, broken down by submission year
  //   requested   — only currently live (Active) proposals; rejected
  //                 proposals are neither spent nor still being requested,
  //                 so they're excluded.
  const treasuryTotals = useMemo(() => {
    const spentByYear = new Map<TreasuryYear, number>();
    let spent = 0;
    let requested = 0;
    for (const action of actions) {
      const resolved = resolveProposalEntity(action);
      if (!resolved || resolved.year == null) continue;
      const amountAda = action.withdrawalAmount
        ? Number(action.withdrawalAmount) / 1_000_000
        : 0;
      if (amountAda <= 0) continue;
      if (APPROVED_STATUSES.has(action.status)) {
        spent += amountAda;
        spentByYear.set(
          resolved.year,
          (spentByYear.get(resolved.year) ?? 0) + amountAda
        );
      } else if (action.status === "Active") {
        requested += amountAda;
      }
    }
    return { spent, spentByYear, requested };
  }, [actions]);

  // ── Layout ───────────────────────────────────────────────────────────
  const layout = useMemo(() => {
    if (!tree) return null;
    const hier = hierarchy<RadialNodeData>(tree);
    cluster<RadialNodeData>().size([2 * Math.PI, LEAF_RADIUS])(hier);
    return hier;
  }, [tree]);

  // Custom link generator: takes a {source, target} pair of plain polar
  // points so we can override the source radius for root links (otherwise
  // linkRadial would pull them all to (0, 0)).
  const linkGenerator = useMemo(
    () =>
      linkRadial<
        { source: { x: number; y: number }; target: { x: number; y: number } },
        { x: number; y: number }
      >()
        .source((l) => l.source)
        .target((l) => l.target)
        .angle((p) => p.x)
        .radius((p) => p.y),
    []
  );

  const linkPathFor = (link: HierarchyLink<RadialNodeData>): string | null => {
    const src = link.source;
    const tgt = link.target;
    const targetX = tgt.x ?? 0;
    const targetY = tgt.y ?? 0;
    // For root → entity links, lift the source onto the perimeter of the
    // centre circle at the entity's angle so the bundle spreads visually
    // instead of pinching at (0, 0).
    const sourcePoint =
      src.depth === 0
        ? { x: targetX, y: ROOT_LINK_SOURCE_RADIUS }
        : { x: src.x ?? 0, y: src.y ?? 0 };
    return linkGenerator({
      source: sourcePoint,
      target: { x: targetX, y: targetY },
    });
  };

  // ── Hover cascade ────────────────────────────────────────────────────
  // Look up the hovered node once so we can derive both the path-to-root
  // (for upward cascade) and the subtree (for downward cascade).
  const hoveredNode = useMemo(() => {
    if (!hoverId || !layout) return null;
    return layout.descendants().find((n) => n.data.id === hoverId) ?? null;
  }, [hoverId, layout]);

  // Path from the hovered node up to the root, inclusive. Used to light
  // every edge along that path and to emphasize the ancestor entity when
  // one of its proposals is hovered.
  const hoveredAncestorIds = useMemo(() => {
    if (!hoveredNode) return null;
    return new Set(hoveredNode.ancestors().map((a) => a.data.id));
  }, [hoveredNode]);

  // Subtree of the hovered node, inclusive. Used so hovering a parent (an
  // entity, or the root) cascades emphasis down to all descendants.
  const hoveredDescendantIds = useMemo(() => {
    if (!hoveredNode) return null;
    return new Set(hoveredNode.descendants().map((d) => d.data.id));
  }, [hoveredNode]);

  const isNodeEmphasized = (nodeId: string): boolean => {
    if (!hoverId) return false;
    return (
      (hoveredAncestorIds?.has(nodeId) ?? false) ||
      (hoveredDescendantIds?.has(nodeId) ?? false)
    );
  };

  // When an entity is hovered, every link inside its subtree lights up
  // (downward cascade). When a proposal is hovered, every link on the path
  // up to the root also lights up (upward cascade — its entity edge and the
  // root → entity edge).
  const isLinkHighlighted = (
    link: HierarchyLink<RadialNodeData>
  ): boolean => {
    if (!hoverId) return false;
    const src = link.source;
    const tgt = link.target;
    if (tgt.data.id === hoverId || src.data.id === hoverId) return true;
    // Downward: hovered node is an ancestor of either endpoint.
    const ancestorIds = new Set([
      ...src.ancestors().map((a) => a.data.id),
      ...tgt.ancestors().map((a) => a.data.id),
    ]);
    if (ancestorIds.has(hoverId)) return true;
    // Upward: this edge sits on the path from the hovered node to the root.
    if (hoveredAncestorIds) {
      return (
        hoveredAncestorIds.has(src.data.id) &&
        hoveredAncestorIds.has(tgt.data.id)
      );
    }
    return false;
  };

  const colorForVariant = (v: LinkVariant) =>
    v === "approved"
      ? approvedColor
      : v === "active"
      ? activeColor
      : rejectedColor;

  // ── Click handlers ───────────────────────────────────────────────────
  const handleNodeClick = (d: HierarchyNode<RadialNodeData>) => {
    if (d.data.kind === "proposal" && d.data.hash) {
      // Surface a preview in the side panel instead of navigating away —
      // user can dig into the full /governance/{hash} page from the
      // panel's primary action when they choose to.
      setSelection({ kind: "proposal", hash: d.data.hash });
      return;
    }
    if (d.data.kind === "entity" && d.data.entityId) {
      if (fundedEntitySet.has(d.data.entityId)) {
        setSelection({ kind: "entity", entityId: d.data.entityId });
      }
    }
  };

  const isClickable = (d: HierarchyNode<RadialNodeData>) =>
    d.data.kind === "proposal" ||
    (d.data.kind === "entity" &&
      !!d.data.entityId &&
      fundedEntitySet.has(d.data.entityId));

  // Aggregated data for the side panel — derived independently of `mode` so
  // the panel always shows the full picture for an entity (approved + active
  // + rejected) even when the chart is filtered to "Approved only".
  const selectedEntityId =
    selection?.kind === "entity" ? selection.entityId : null;
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    let approvedAda = 0;
    let pendingAda = 0;
    let rejectedAda = 0;
    const proposals: Array<{
      proposalId: string;
      hash: string;
      title: string;
      status: string;
      amountAda: number;
      variant: LinkVariant;
      year: TreasuryYear;
    }> = [];

    for (const action of actions) {
      const resolved = resolveProposalEntity(action);
      if (!resolved || resolved.entityId !== selectedEntityId) continue;
      if (resolved.year == null) continue;

      const amountAda = action.withdrawalAmount
        ? Number(action.withdrawalAmount) / 1_000_000
        : 0;
      if (amountAda <= 0) continue;

      const isApproved = APPROVED_STATUSES.has(action.status);
      const isActive = action.status === "Active";
      const isRejected = REJECTED_STATUSES.has(action.status);
      if (!isApproved && !isActive && !isRejected) continue;

      if (isApproved) approvedAda += amountAda;
      else if (isActive) pendingAda += amountAda;
      else rejectedAda += amountAda;

      const variant: LinkVariant = isApproved
        ? "approved"
        : isActive
        ? "active"
        : "rejected";

      proposals.push({
        proposalId: action.proposalId ?? action.hash,
        hash: action.hash,
        title: action.title,
        status: action.status,
        amountAda,
        variant,
        year: resolved.year,
      });
    }

    proposals.sort(
      (a, b) => b.year - a.year || b.amountAda - a.amountAda
    );

    return {
      entity: getTreasuryEntity(selectedEntityId),
      approvedAda,
      pendingAda,
      rejectedAda,
      requestedAda: approvedAda + pendingAda + rejectedAda,
      proposalsCount: proposals.length,
      proposals,
    };
  }, [selectedEntityId, actions]);

  // Proposal preview for the side panel.
  const selectedProposalHash =
    selection?.kind === "proposal" ? selection.hash : null;
  const selectedProposal = useMemo(() => {
    if (!selectedProposalHash) return null;
    const action = actions.find((a) => a.hash === selectedProposalHash);
    if (!action) return null;
    const resolved = resolveProposalEntity(action);
    const amountAda = action.withdrawalAmount
      ? Number(action.withdrawalAmount) / 1_000_000
      : 0;
    const isApproved = APPROVED_STATUSES.has(action.status);
    const isActive = action.status === "Active";
    const isRejected = REJECTED_STATUSES.has(action.status);
    const variant: LinkVariant = isApproved
      ? "approved"
      : isActive
      ? "active"
      : isRejected
      ? "rejected"
      : "active";
    const entity = resolved
      ? getTreasuryEntity(resolved.entityId)
      : null;
    return {
      action,
      title: cleanProposalTitle(action.title || action.hash.slice(0, 12)),
      amountAda,
      variant,
      year: resolved?.year ?? null,
      entity,
      isFundedEntity: entity ? fundedEntitySet.has(entity.entityId) : false,
    };
  }, [selectedProposalHash, actions, fundedEntitySet]);

  // ── Toggle UI helpers ────────────────────────────────────────────────
  const toggleButtonBase =
    "px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors";

  const toggleGroupClass = cn(
    "inline-flex border overflow-hidden",
    isGame
      ? "rounded-none border-white/30"
      : isDark
      ? "rounded-none border-[#0bd1a2]"
      : "rounded-md border-border"
  );

  const toggleClass = (active: boolean) =>
    cn(
      toggleButtonBase,
      isGame
        ? active
          ? "bg-white/15 text-white"
          : "bg-transparent text-white/60 hover:text-white hover:bg-white/10"
        : isDark
        ? active
          ? "bg-[#0bd1a2] text-black"
          : "bg-transparent text-[#0bd1a2]/60 hover:text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
        : active
        ? "bg-primary text-primary-foreground"
        : "bg-transparent text-muted-foreground hover:text-foreground"
    );

  // ── Render ───────────────────────────────────────────────────────────
  if (!layout || !tree) {
    // Distinguish "truly empty" (no actions loaded yet) from "filtered to
    // nothing" (the user picked a status/year combination with no matches).
    // The latter gets a friendlier message + a reset button.
    const isFilteredEmpty =
      actions.length > 0 && (mode !== "all" || yearMode !== "all");
    const filtersAreReset = mode === "all" && yearMode === "all";
    return (
      <div
        className={cn(
          "p-6 text-sm",
          isGame
            ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] text-white/70 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
            : isDark
            ? "rounded-none border border-[#0bd1a2] bg-background text-[#0bd1a2]/70"
            : "rounded-2xl border border-border bg-card text-muted-foreground"
        )}
      >
        <h3
          className={cn(
            "text-sm sm:text-base font-semibold mb-2",
            isDark ? "text-[#0bd1a2]" : "text-black"
          )}
        >
          {t("flowChartTitle")}
        </h3>
        <p>{isFilteredEmpty ? t("flowEmptyFiltered") : t("flowChartTitle")}</p>
        {isFilteredEmpty && !filtersAreReset && (
          <button
            type="button"
            onClick={() => {
              setMode("all");
              setYearMode("all");
            }}
            className={cn(
              "mt-3 px-3 py-1.5 text-xs sm:text-sm font-medium",
              isGame
                ? "rounded-none border border-white/30 text-white hover:bg-white/10"
                : isDark
                ? "rounded-none border border-[#0bd1a2] text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                : "rounded-md border border-border text-foreground hover:bg-secondary"
            )}
          >
            {t("flowResetFilters")}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
    <div
      className={cn(
        "p-4 sm:p-5 md:p-6",
        isGame
          ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
          : isDark
          ? "rounded-none border border-[#0bd1a2] bg-background"
          : "rounded-2xl border border-border bg-card shadow-elevation-2"
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
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {SUPPORTED_YEARS.map((year) => (
              <span key={year}>
                {year}{" "}
                <span className="font-medium text-foreground/80">
                  {formatAda(treasuryTotals.spentByYear.get(year) ?? 0)}
                </span>
              </span>
            ))}
            <span>
              {t("requestedLabel")}{" "}
              <span className="font-medium text-foreground/80">
                {formatAda(treasuryTotals.requested)}
              </span>
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <div
            role="tablist"
            aria-label="Filter by proposal status"
            data-chart-keep-open
            className={toggleGroupClass}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "approved"}
              onClick={() => setMode("approved")}
              className={toggleClass(mode === "approved")}
            >
              {t("flowApprovedOnly")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "active"}
              onClick={() => setMode("active")}
              className={toggleClass(mode === "active")}
            >
              {t("flowRequestingOnly")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "rejected"}
              onClick={() => setMode("rejected")}
              className={toggleClass(mode === "rejected")}
            >
              {t("flowRejectedOnly")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "all"}
              onClick={() => setMode("all")}
              className={toggleClass(mode === "all")}
            >
              {t("flowIncludingRejected")}
            </button>
          </div>
          <div
            role="tablist"
            aria-label="Filter by year"
            data-chart-keep-open
            className={toggleGroupClass}
          >
            {SUPPORTED_YEARS.map((year) => (
              <button
                key={year}
                type="button"
                role="tab"
                aria-selected={yearMode === year}
                onClick={() => setYearMode(year)}
                className={toggleClass(yearMode === year)}
              >
                {year}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={yearMode === "all"}
              onClick={() => setYearMode("all")}
              className={toggleClass(yearMode === "all")}
            >
              {t("flowYearsAll")}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden relative">
        {/* Reset-zoom button — only visible once the user has zoomed in. */}
        {zoomTransform.k > 1.001 && (
          <button
            type="button"
            onClick={resetZoom}
            data-chart-keep-open
            aria-label={tCommon("reset")}
            title={tCommon("reset")}
            className={cn(
              "absolute top-2 right-2 z-10 inline-flex items-center justify-center h-8 w-8 transition-colors",
              isGame
                ? "rounded-none border border-white/30 bg-black/60 text-white hover:bg-white/10"
                : isDark
                ? "rounded-none border border-[#0bd1a2] bg-background/80 text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                : "rounded-md border border-border bg-card text-foreground hover:bg-secondary"
            )}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
        <svg
          ref={svgRef}
          viewBox={`-${CANVAS_HALF} -${CANVAS_HALF} ${VIEW_SIZE} ${VIEW_SIZE}`}
          // Fill the card's full width so zoomed content can use the whole
          // available area. h-auto keeps the square aspect from the
          // viewBox, giving a chart that's as tall as the card is wide.
          className="w-full h-auto block"
          role="img"
          aria-label="Treasury flow radial chart"
          style={{
            cursor: zoomTransform.k > 1 ? "grab" : "default",
            touchAction: "none",
          }}
        >
          {/* Single zoom/pan group wrapping all chart content. d3-zoom
              writes the matrix transform here on each wheel/drag event. */}
          <g transform={zoomTransform.toString()}>
          {/* Links — purely visual; opacity/width still react to node hover
              via isLinkHighlighted, but the paths themselves don't capture
              pointer events so cursoring over an edge doesn't trigger any
              highlight. */}
          <g fill="none" style={{ pointerEvents: "none" }}>
            {layout.links().map((link) => {
              const highlighted = isLinkHighlighted(link);
              const v = dominantVariantFromLeaves(link.target);
              const path = linkPathFor(link) ?? undefined;
              // Carry the active "flow" all the way back to the treasury:
              // any edge whose subtree contains an active proposal gets the
              // traveling impulse overlay, even if its dominant variant is
              // approved (so the base edge stays green for mixed entities).
              const hasActiveDescendant = link.target
                .leaves()
                .some((l) => l.data.variant === "active");
              const showImpulse = !highlighted && hasActiveDescendant;
              // Stable key — survives filter changes that reorder links so
              // React reconciles paths instead of remounting them.
              const linkKey = `${link.source.data.id}->${link.target.data.id}`;
              return (
                <g key={linkKey}>
                  <path
                    d={path}
                    stroke={colorForVariant(v)}
                    strokeOpacity={highlighted ? 0.95 : 0.3}
                    strokeWidth={highlighted ? 3.2 : 1.8}
                    className={
                      !highlighted && v === "active"
                        ? "treasury-edge-pulse"
                        : undefined
                    }
                    style={{
                      transition:
                        "stroke-opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), stroke-width 280ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                  {showImpulse && (() => {
                    // Per-edge timing variation — duration spread 4.0s–7.3s
                    // and a negative delay so each edge starts mid-cycle
                    // at a different phase. Keeps the swarm looking organic
                    // instead of marching in lockstep. Seed is derived from
                    // the link's stable IDs (not the array index) so the
                    // phase doesn't jump when filters reorder the links.
                    let seed = 0;
                    for (let k = 0; k < linkKey.length; k++) {
                      seed = (seed * 31 + linkKey.charCodeAt(k)) | 0;
                    }
                    const seedAbs = Math.abs(seed);
                    const impulseStyle = {
                      animationDuration: `${(4.0 + ((seedAbs * 53) % 11) * 0.3).toFixed(2)}s`,
                      animationDelay: `-${((seedAbs * 37) % 19) * 0.3}s`,
                    };
                    // Stack three layers — wide soft halo, mid glow, bright
                    // thin core — to fake a gradient falloff. The round
                    // caps + decreasing stroke widths make the impulse fade
                    // softly along the path direction at both ends instead
                    // of cutting off sharply.
                    const sharedProps = {
                      d: path,
                      stroke: activeColor,
                      strokeLinecap: "round" as const,
                      pathLength: 100,
                      strokeDasharray: "3 30",
                      className: "treasury-edge-impulse",
                      style: impulseStyle,
                    };
                    return (
                      <>
                        <path {...sharedProps} strokeWidth={7} strokeOpacity={0.18} />
                        <path {...sharedProps} strokeWidth={4} strokeOpacity={0.45} />
                        <path {...sharedProps} strokeWidth={2} strokeOpacity={0.95} />
                      </>
                    );
                  })()}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {layout.descendants().map((d) => {
              const angleDeg = ((d.x ?? 0) * 180) / Math.PI - 90;
              const flip = (d.x ?? 0) >= Math.PI;
              const clickable = isClickable(d);
              const cursor = clickable ? "pointer" : "default";

              if (d.data.kind === "treasury") {
                return (
                  <g
                    key={d.data.id}
                    onMouseEnter={() => setHover(d.data.id)}
                    onMouseLeave={queueHoverClear}
                  >
                    <circle
                      r={CENTER_RADIUS}
                      fill={isGame ? "#0a0a0a" : isDark ? "#0a1f1a" : "#ffffff"}
                      stroke={isDark ? "#0bd1a2" : "none"}
                      strokeWidth={isDark ? 1.5 : 0}
                      // Light theme drops the heavy black border in favour
                      // of the same soft drop-shadow used on light-mode
                      // cards (matches shadow-elevation-2 vibe).
                      style={
                        isDark
                          ? undefined
                          : { filter: "drop-shadow(0 6px 18px rgba(15,23,42,0.18))" }
                      }
                    />
                    {/* Spent — approved & paid out */}
                    <text
                      y={-25}
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={13}
                      fontWeight={500}
                      fill={mutedTextColor}
                      style={{ userSelect: "none" }}
                    >
                      {t("spentLabel")}
                    </text>
                    <text
                      y={-9}
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={15}
                      fontWeight={700}
                      fill={textColor}
                      style={{ userSelect: "none" }}
                    >
                      {formatAda(treasuryTotals.spent)}
                    </text>
                    {/* Requested — currently live (Active) proposals */}
                    <text
                      y={13}
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={13}
                      fontWeight={500}
                      fill={mutedTextColor}
                      style={{ userSelect: "none" }}
                    >
                      {t("requestedLabel")}
                    </text>
                    <text
                      y={29}
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={15}
                      fontWeight={700}
                      fill={mutedTextColor}
                      style={{ userSelect: "none" }}
                    >
                      {formatAda(treasuryTotals.requested)}
                    </text>
                  </g>
                );
              }

              const nodeTransform = `rotate(${angleDeg}) translate(${d.y ?? 0},0)`;

              if (d.data.kind === "entity") {
                // Order from inner (closer to centre) → outer:
                //   ADA pill, title pill.
                const labelText = truncate(d.data.label, ENTITY_LABEL_MAX);
                const adaText = formatAda(d.data.ada);
                const titleW = labelText.length * CHAR_W_ENTITY + 14;
                const adaW = adaText.length * CHAR_W_ENTITY + 12;
                const adaX = flip
                  ? -(PILL_OFFSET + adaW)
                  : PILL_OFFSET;
                const titleX = flip
                  ? -(PILL_OFFSET + adaW + PILL_GAP + titleW)
                  : PILL_OFFSET + adaW + PILL_GAP;
                const emphasized = isNodeEmphasized(d.data.id);
                const scaleFactor = emphasized ? 1.12 : 1;
                return (
                  <g
                    key={d.data.id}
                    transform={nodeTransform}
                    onMouseEnter={() => setHover(d.data.id)}
                    onMouseLeave={queueHoverClear}
                    onClick={() => handleNodeClick(d)}
                    style={{ cursor }}
                    {...(clickable ? { "data-chart-keep-open": "" } : {})}
                  >
                    <g
                      transform={`rotate(${flip ? 180 : 0}) scale(${scaleFactor})`}
                      style={{
                        transition:
                          "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    >
                      {/* Invisible hit-area spanning both pills + the gap.
                          Without this, the gap between sibling pills is a
                          hole in the group's hit region — moving the cursor
                          across it triggers mouseleave/enter in a loop while
                          the scale animation oscillates. */}
                      <rect
                        x={flip ? -(PILL_OFFSET + adaW + PILL_GAP + titleW) : PILL_OFFSET}
                        y={-PILL_H_ENTITY / 2 - 2}
                        width={adaW + PILL_GAP + titleW}
                        height={PILL_H_ENTITY + 4}
                        fill="transparent"
                        pointerEvents="all"
                      />
                      <circle r={3.5} fill={mutedTextColor} />
                      {/* ADA pill — innermost */}
                      <rect
                        x={adaX}
                        y={-PILL_H_ENTITY / 2}
                        width={adaW}
                        height={PILL_H_ENTITY}
                        rx={PILL_RADIUS}
                        fill={pillFill}
                        stroke={pillStroke}
                        strokeWidth={0.75}
                      />
                      <text
                        x={adaX + adaW / 2}
                        dy="0.35em"
                        textAnchor="middle"
                        fontSize={13}
                        fontWeight={500}
                        fill={mutedTextColor}
                        style={{ userSelect: "none" }}
                      >
                        {adaText}
                      </text>
                      {/* Title pill — outer */}
                      <rect
                        x={titleX}
                        y={-PILL_H_ENTITY / 2}
                        width={titleW}
                        height={PILL_H_ENTITY}
                        rx={PILL_RADIUS}
                        fill={pillFill}
                        stroke={pillStroke}
                        strokeWidth={1}
                      />
                      <text
                        x={titleX + titleW / 2}
                        dy="0.35em"
                        textAnchor="middle"
                        fontSize={15}
                        fontWeight={600}
                        fill={textColor}
                        style={{ userSelect: "none" }}
                      >
                        {labelText}
                      </text>
                    </g>
                  </g>
                );
              }

              // proposal leaf
              // Order from inner (closer to centre) → outer:
              //   ADA pill, title pill, year pill.
              const labelText = truncate(d.data.label, PROPOSAL_LABEL_MAX);
              const adaText = formatAda(d.data.ada);
              const variant = d.data.variant ?? "approved";
              const variantColor = colorForVariant(variant);
              const yearTag = d.data.year != null ? String(d.data.year) : null;
              const titleW = labelText.length * CHAR_W_PROPOSAL + 14;
              const adaW = adaText.length * CHAR_W_PROPOSAL + 12;
              const yearW = yearTag ? yearTag.length * CHAR_W_PROPOSAL + 12 : 0;
              const adaX = flip
                ? -(PILL_OFFSET + adaW)
                : PILL_OFFSET;
              const titleX = flip
                ? -(PILL_OFFSET + adaW + PILL_GAP + titleW)
                : PILL_OFFSET + adaW + PILL_GAP;
              const yearX = yearTag
                ? flip
                  ? -(PILL_OFFSET + adaW + PILL_GAP + titleW + PILL_GAP + yearW)
                  : PILL_OFFSET + adaW + PILL_GAP + titleW + PILL_GAP
                : 0;
              // Grow when this proposal is on either side of the hover
              // cascade — i.e. the proposal itself, its parent entity, or
              // the root is hovered (downward), or it sits on the path of a
              // hovered descendant (upward, if proposals ever gain children).
              const emphasized = isNodeEmphasized(d.data.id);
              const scaleFactor = emphasized ? 1.18 : 1;
              return (
                <g
                  key={d.data.id}
                  transform={nodeTransform}
                  onMouseEnter={() => setHover(d.data.id)}
                  onMouseLeave={queueHoverClear}
                  onClick={() => handleNodeClick(d)}
                  style={{ cursor }}
                  data-chart-keep-open=""
                >
                  <g
                    transform={`rotate(${flip ? 180 : 0}) scale(${scaleFactor})`}
                    style={{
                      transition:
                        "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    {/* Invisible hit-area spanning ada + title (+ optional
                        year) pills and the gaps between them — see entity
                        node for the rationale. */}
                    {(() => {
                      const totalW =
                        adaW + PILL_GAP + titleW + (yearTag ? PILL_GAP + yearW : 0);
                      const hitX = flip
                        ? -(PILL_OFFSET + totalW)
                        : PILL_OFFSET;
                      return (
                        <rect
                          x={hitX}
                          y={-PILL_H_PROPOSAL / 2 - 2}
                          width={totalW}
                          height={PILL_H_PROPOSAL + 4}
                          fill="transparent"
                          pointerEvents="all"
                        />
                      );
                    })()}
                    <circle r={2.5} fill={variantColor} />
                    {/* ADA pill — innermost */}
                    <rect
                      x={adaX}
                      y={-PILL_H_PROPOSAL / 2}
                      width={adaW}
                      height={PILL_H_PROPOSAL}
                      rx={PILL_RADIUS}
                      fill={pillFill}
                      stroke={pillStroke}
                      strokeWidth={0.75}
                    />
                    <text
                      x={adaX + adaW / 2}
                      dy="0.35em"
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={500}
                      fill={mutedTextColor}
                      style={{ userSelect: "none" }}
                    >
                      {adaText}
                    </text>
                    {/* Pulsing halo behind the title pill for active
                        proposals — same rhythm as treasury-edge-pulse so
                        the box "breathes" in sync with its incoming edge.
                        Suppressed on hover so the emphasised state stays
                        clean. */}
                    {variant === "active" && !emphasized && (
                      <rect
                        x={titleX - 3}
                        y={-PILL_H_PROPOSAL / 2 - 3}
                        width={titleW + 6}
                        height={PILL_H_PROPOSAL + 6}
                        rx={PILL_RADIUS + 2}
                        fill="none"
                        stroke={activeColor}
                        strokeWidth={2}
                        pointerEvents="none"
                        className="treasury-box-pulse"
                      />
                    )}
                    {/* Title pill — middle, variant-coloured stroke for
                        status legibility at the outer ring */}
                    <rect
                      x={titleX}
                      y={-PILL_H_PROPOSAL / 2}
                      width={titleW}
                      height={PILL_H_PROPOSAL}
                      rx={PILL_RADIUS}
                      fill={pillFill}
                      stroke={variantColor}
                      strokeOpacity={0.55}
                      strokeWidth={1}
                    />
                    <text
                      x={titleX + titleW / 2}
                      dy="0.35em"
                      textAnchor="middle"
                      fontSize={12}
                      fill={textColor}
                      style={{ userSelect: "none" }}
                    >
                      {labelText}
                    </text>
                    {/* Year pill — outermost */}
                    {yearTag && (
                      <>
                        <rect
                          x={yearX}
                          y={-PILL_H_PROPOSAL / 2}
                          width={yearW}
                          height={PILL_H_PROPOSAL}
                          rx={PILL_RADIUS}
                          fill={pillFill}
                          stroke={pillStroke}
                          strokeWidth={0.75}
                        />
                        <text
                          x={yearX + yearW / 2}
                          dy="0.35em"
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={600}
                          fill={mutedTextColor}
                          style={{ userSelect: "none" }}
                        >
                          {yearTag}
                        </text>
                      </>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundColor: approvedColor }}
          />
          {t("profile.approved")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundColor: activeColor }}
          />
          {t("profile.pending")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundColor: rejectedColor }}
          />
          {t("profile.rejected")}
        </span>
      </div>
    </div>

    {/* Side panel — portalled to <body> so it escapes any transform context
        from FadeIn/animation ancestors. Mounted only when something is
        selected, so it never leaves a ghost element intercepting wheel
        events on the page. */}
    {portalReady && selection && (selectedEntity || selectedProposal) && createPortal(
      // Render the panel directly — no full-viewport wrapper. A wrapping
      // `fixed inset-0` div (even with pointer-events: none) was eating
      // wheel events on some browsers, blocking page scroll behind the
      // panel. Sticking just the panel in fixed position keeps the rest
      // of the viewport untouched.
      <aside
        ref={panelRef}
        aria-label="Selection details"
        className={cn(
          "fixed right-0 top-14 sm:top-16 bottom-20 w-[420px] max-w-[92vw] z-50 shadow-2xl transition-transform duration-300",
          isGame
            ? "bg-[#0a0a0a] border-l border-white/15"
            : isDark
            ? "bg-background border-l border-[#0bd1a2]/40"
            : "bg-card border-l border-border",
          panelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
      <div
        className="h-full overflow-y-auto"
        style={{ overscrollBehavior: "contain" }}
      >
        {selectedEntity && (
          <div className="p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h2
                  className={cn(
                    "text-lg sm:text-xl font-bold landing-title truncate",
                    isGame
                      ? "text-white"
                      : isDark
                      ? "text-[#0bd1a2]"
                      : "text-foreground"
                  )}
                >
                  {selectedEntity.entity.label}
                </h2>
                {selectedEntity.entity.description && (
                  <p
                    className={cn(
                      "text-xs sm:text-sm mt-1.5",
                      isGame
                        ? "text-white/65"
                        : isDark
                        ? "text-[#0bd1a2]/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {selectedEntity.entity.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label={tCommon("close")}
                className={cn(
                  "shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  isGame
                    ? "text-white/70 hover:bg-white/10 hover:text-white"
                    : isDark
                    ? "text-[#0bd1a2]/70 hover:bg-[#0bd1a2]/10 hover:text-[#0bd1a2]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: t("profile.totalReceived"), value: formatAda(selectedEntity.approvedAda) },
                { label: t("profile.pending"), value: formatAda(selectedEntity.pendingAda) },
                { label: t("profile.totalRequested"), value: formatAda(selectedEntity.requestedAda) },
                { label: t("profile.proposalsCount"), value: String(selectedEntity.proposalsCount) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className={cn(
                    "rounded-md border p-3",
                    isGame
                      ? "border-white/10 bg-white/[0.03]"
                      : isDark
                      ? "border-[#0bd1a2]/30 bg-[#0bd1a2]/5"
                      : "border-border bg-secondary/50"
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] uppercase tracking-wide font-medium",
                      isGame
                        ? "text-white/50"
                        : isDark
                        ? "text-[#0bd1a2]/60"
                        : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </p>
                  <p
                    className={cn(
                      "text-base sm:text-lg font-semibold mt-0.5",
                      isGame
                        ? "text-white"
                        : isDark
                        ? "text-[#0bd1a2]"
                        : "text-foreground"
                    )}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Profile button */}
            <Button
              asChild
              className={cn(
                "w-full mb-5",
                isGame
                  ? "game-nav-btn"
                  : isDark
                  ? "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] hover:bg-[#0bd1a2] hover:text-black"
                  : "bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              <Link href={`/treasury/${selectedEntityId}`}>
                {tCommon("profile")}
              </Link>
            </Button>

            {/* Proposals list */}
            <h3
              className={cn(
                "text-sm font-semibold mb-2",
                isGame
                  ? "text-white"
                  : isDark
                  ? "text-[#0bd1a2]"
                  : "text-foreground"
              )}
            >
              {t("profile.proposalsTitle")}
            </h3>
            {selectedEntity.proposals.length === 0 ? (
              <p
                className={cn(
                  "text-sm",
                  isGame
                    ? "text-white/60"
                    : isDark
                    ? "text-[#0bd1a2]/60"
                    : "text-muted-foreground"
                )}
              >
                {t("profile.noProposals")}
              </p>
            ) : (
              <ul
                className={cn(
                  "divide-y",
                  isGame
                    ? "divide-white/10"
                    : isDark
                    ? "divide-[#0bd1a2]/30"
                    : "divide-border"
                )}
              >
                {selectedEntity.proposals.map((p) => {
                  const tone =
                    p.variant === "approved"
                      ? approvedColor
                      : p.variant === "active"
                      ? activeColor
                      : rejectedColor;
                  return (
                    <li
                      key={p.proposalId}
                      {...rowLink(`/governance/${p.hash}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(`/governance/${p.hash}`);
                      }}
                      role="link"
                      tabIndex={0}
                      className={cn(
                        "py-2.5 cursor-pointer transition-colors",
                        isGame
                          ? "hover:bg-white/5"
                          : isDark
                          ? "hover:bg-[#0bd1a2]/5"
                          : "hover:bg-secondary/40"
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            isGame
                              ? "text-white"
                              : isDark
                              ? "text-[#0bd1a2]"
                              : "text-foreground"
                          )}
                        >
                          <Link href={`/governance/${p.hash}`} className="hover:underline">
                            {cleanProposalTitle(p.title)}
                          </Link>
                        </p>
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: tone }}
                          aria-label={p.status}
                        />
                      </div>
                      <div
                        className={cn(
                          "flex items-baseline justify-between gap-2 text-xs mt-0.5",
                          isGame
                            ? "text-white/60"
                            : isDark
                            ? "text-[#0bd1a2]/60"
                            : "text-muted-foreground"
                        )}
                      >
                        <span>{p.year}</span>
                        <span className="font-mono">{formatAda(p.amountAda)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {selectedProposal && (
          <div className="p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium mb-2 px-2 py-0.5 rounded-md border",
                    selectedProposal.variant === "approved"
                      ? isGame
                        ? "border-[#00ff66]/30 text-[#00ff66] bg-[#00ff66]/10"
                        : isDark
                        ? "border-[#0bd1a2]/40 text-[#0bd1a2] bg-[#0bd1a2]/10"
                        : "border-emerald-500/30 text-emerald-700 bg-emerald-500/10"
                      : selectedProposal.variant === "active"
                      ? isGame
                        ? "border-[#fbbf24]/30 text-[#fbbf24] bg-[#fbbf24]/10"
                        : "border-amber-500/40 text-amber-700 bg-amber-500/10"
                      : isGame
                      ? "border-[#ff8a8a]/30 text-[#ff8a8a] bg-[#ff8a8a]/10"
                      : isDark
                      ? "border-red-400/40 text-red-400 bg-red-900/30"
                      : "border-red-500/30 text-red-700 bg-red-500/10"
                  )}
                >
                  {tStatus(selectedProposal.action.status)}
                </div>
                <h2
                  className={cn(
                    "text-base sm:text-lg font-bold leading-snug",
                    isGame
                      ? "text-white"
                      : isDark
                      ? "text-[#0bd1a2]"
                      : "text-foreground"
                  )}
                >
                  {selectedProposal.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label={tCommon("close")}
                className={cn(
                  "shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  isGame
                    ? "text-white/70 hover:bg-white/10 hover:text-white"
                    : isDark
                    ? "text-[#0bd1a2]/70 hover:bg-[#0bd1a2]/10 hover:text-[#0bd1a2]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Amount — large hero-ish display */}
            <div
              className={cn(
                "rounded-md border p-4 mb-4",
                isGame
                  ? "border-white/10 bg-white/[0.03]"
                  : isDark
                  ? "border-[#0bd1a2]/30 bg-[#0bd1a2]/5"
                  : "border-border bg-secondary/50"
              )}
            >
              <p
                className={cn(
                  "text-[10px] uppercase tracking-wide font-medium",
                  isGame
                    ? "text-white/50"
                    : isDark
                    ? "text-[#0bd1a2]/60"
                    : "text-muted-foreground"
                )}
              >
                {t("profile.amount")}
              </p>
              <p
                className={cn(
                  "text-2xl font-bold mt-1 font-mono",
                  isGame
                    ? "text-white"
                    : isDark
                    ? "text-[#0bd1a2]"
                    : "text-foreground"
                )}
              >
                {formatAda(selectedProposal.amountAda)}
              </p>
            </div>

            {/* Meta rows */}
            <dl
              className={cn(
                "text-sm divide-y mb-5",
                isGame
                  ? "divide-white/10"
                  : isDark
                  ? "divide-[#0bd1a2]/30"
                  : "divide-border"
              )}
            >
              {selectedProposal.year != null && (
                <div className="flex items-baseline justify-between py-2.5">
                  <dt
                    className={cn(
                      isGame
                        ? "text-white/60"
                        : isDark
                        ? "text-[#0bd1a2]/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {t("profile.year")}
                  </dt>
                  <dd
                    className={cn(
                      "font-mono",
                      isGame
                        ? "text-white"
                        : isDark
                        ? "text-[#0bd1a2]"
                        : "text-foreground"
                    )}
                  >
                    {selectedProposal.year}
                  </dd>
                </div>
              )}
              {selectedProposal.entity && (
                <div className="flex items-baseline justify-between py-2.5 gap-3">
                  <dt
                    className={cn(
                      "shrink-0",
                      isGame
                        ? "text-white/60"
                        : isDark
                        ? "text-[#0bd1a2]/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {tCommon("profile")}
                  </dt>
                  {selectedProposal.isFundedEntity ? (
                    <button
                      type="button"
                      onClick={() =>
                        selectedProposal.entity &&
                        setSelection({
                          kind: "entity",
                          entityId: selectedProposal.entity.entityId,
                        })
                      }
                      className={cn(
                        "font-medium truncate underline-offset-2 hover:underline",
                        isGame
                          ? "text-[#00ff66]"
                          : isDark
                          ? "text-[#0bd1a2]"
                          : "text-foreground"
                      )}
                    >
                      {selectedProposal.entity.label}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        "font-medium truncate",
                        isGame
                          ? "text-white"
                          : isDark
                          ? "text-[#0bd1a2]"
                          : "text-foreground"
                      )}
                    >
                      {selectedProposal.entity.label}
                    </span>
                  )}
                </div>
              )}
            </dl>

            {/* View Proposal button */}
            <Button
              asChild
              className={cn(
                "w-full",
                isGame
                  ? "game-nav-btn"
                  : isDark
                  ? "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] hover:bg-[#0bd1a2] hover:text-black"
                  : "bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              <Link href={`/governance/${selectedProposal.action.hash}`}>
                {t("profile.viewProposal")}
              </Link>
            </Button>
          </div>
        )}
      </div>
      </aside>,
      document.body
    )}
    </>
  );
}
