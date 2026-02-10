import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import { getLanguageColor } from "@/lib/languageColors";
import type { ChartProps } from "@/types/dashboard";
import type { GraphNode, GraphEdge, RepoMeta, DevMeta, OrgMeta } from "@/types/development";
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  type SimulationNodeDatum, type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { scaleSqrt } from "d3-scale";
import { polygonHull } from "d3-polygon";
import { line, curveCatmullRomClosed } from "d3-shape";
import { Maximize2, Minimize2, Search, X, ExternalLink, Star, GitFork } from "lucide-react";
import { useDashboard } from "@/components/dashboards/shared";
import type { ChartId, ChartLayout } from "@/types/dashboard";
import { DEFAULT_CHART_LAYOUTS } from "@/types/dashboard";

// ─── Simulation types ──────────────────────────────────────────────────────
interface SimNode extends SimulationNodeDatum, GraphNode {}
interface SimLink extends SimulationLinkDatum<SimNode> { weight: number }

// ─── Helpers ────────────────────────────────────────────────────────────────
function isRepoMeta(node: GraphNode): node is GraphNode & { meta: RepoMeta } {
  return node.type === "repo" && !!node.meta;
}
function isDevMeta(node: GraphNode): node is GraphNode & { meta: DevMeta } {
  return node.type === "developer" && !!node.meta;
}
function isOrgMeta(node: GraphNode): node is GraphNode & { meta: OrgMeta } {
  return node.type === "org" && !!node.meta;
}

function isRecentlyActive(node: GraphNode): boolean {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  if (isRepoMeta(node) && node.meta.lastActivityAt) return new Date(node.meta.lastActivityAt).getTime() > cutoff;
  if (isDevMeta(node) && node.meta.lastSeenAt) return new Date(node.meta.lastSeenAt).getTime() > cutoff;
  return false;
}

function getGitHubUrl(node: GraphNode): string {
  const id = node.id.replace(/^(org|repo|dev):/, "");
  if (node.type === "org") return `https://github.com/${id}`;
  if (node.type === "repo") return `https://github.com/${id}`;
  return `https://github.com/${id}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function hullPath(points: [number, number][], pad: number): string {
  const hull = polygonHull(points);
  if (!hull || hull.length < 3) return "";
  const expanded = hull.map(([x, y]) => {
    const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
    const dx = x - cx, dy = y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [x + (dx / len) * pad, y + (dy / len) * pad] as [number, number];
  });
  const gen = line<[number, number]>().x((d) => d[0]).y((d) => d[1]).curve(curveCatmullRomClosed);
  return gen(expanded) ?? "";
}

// ─── Info panel ─────────────────────────────────────────────────────────────
function PanelSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <div className={cn("border-t pt-3 mt-3", isDark ? "border-white/10" : "border-gray-100")}>
      <p className="font-semibold text-[11px] uppercase tracking-wide mb-2 opacity-60">{title}</p>
      {children}
    </div>
  );
}

function NodeInfoPanel({
  node, edges, nodes, onClose, onSelectNode, isDark,
}: {
  node: GraphNode; edges: GraphEdge[]; nodes: GraphNode[];
  onClose: () => void; onSelectNode: (n: GraphNode) => void; isDark: boolean;
}) {
  // Build weighted connections
  const connectionWeights = new Map<string, number>();
  edges.forEach((e) => {
    if (e.source === node.id) connectionWeights.set(e.target, (connectionWeights.get(e.target) ?? 0) + e.weight);
    if (e.target === node.id) connectionWeights.set(e.source, (connectionWeights.get(e.source) ?? 0) + e.weight);
  });
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const connected = Array.from(connectionWeights.entries())
    .map(([id, weight]) => ({ node: nodeMap.get(id)!, weight }))
    .filter((c) => c.node)
    .sort((a, b) => b.weight - a.weight);

  const connectedByType = (type: string) => connected.filter((c) => c.node.type === type);
  const fullId = node.id.replace(/^(org|repo|dev):/, "");

  const clickableItem = (n: GraphNode, extra?: string) => (
    <button
      key={n.id}
      onClick={() => onSelectNode(n)}
      className={cn(
        "flex items-center justify-between w-full text-left px-2 py-1 rounded transition-colors text-xs",
        isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
      )}
    >
      <span className="truncate">{n.label}</span>
      {extra && <span className="text-[10px] opacity-50 flex-shrink-0 ml-2">{extra}</span>}
    </button>
  );

  return (
    <div className={cn(
      "w-[320px] h-full overflow-y-auto border-l p-4 flex-shrink-0",
      isDark ? "bg-[#131320] border-[#0bd1a2]/20 text-[#0bd1a2]" : "bg-white border-gray-200 text-gray-900"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {isDevMeta(node) && node.meta.avatarUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={node.meta.avatarUrl} alt={node.label} className="w-14 h-14 rounded-full mb-2 border-2 border-current/20" />
          )}
          <h4 className="font-bold text-base truncate">{node.label}</h4>
          <p className="text-[11px] opacity-50 truncate">{fullId}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted/20 flex-shrink-0 mt-1"><X className="w-4 h-4" /></button>
      </div>

      {/* Type badge + status badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-medium",
          node.type === "org" ? "bg-blue-500/15 text-blue-400" :
          node.type === "repo" ? "bg-green-500/15 text-green-400" :
          "bg-purple-500/15 text-purple-400"
        )}>
          {node.type === "org" ? "Organization" : node.type === "repo" ? "Repository" : "Developer"}
        </span>
        {isDevMeta(node) && node.meta.isBridge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">Bridge</span>
        )}
        {isDevMeta(node) && (
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
            node.meta.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/15 text-gray-400"
          )}>{node.meta.isActive ? "Active" : "Inactive"}</span>
        )}
        {isRepoMeta(node) && node.meta.isArchived && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 font-medium">Archived</span>
        )}
        {isRepoMeta(node) && isRecentlyActive(node) && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Active</span>
        )}
      </div>

      {/* ─── Repo details ─── */}
      {isRepoMeta(node) && (
        <>
          {node.meta.description && (
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{node.meta.description}</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs mb-1">
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Stars</p>
              <p className="font-semibold flex items-center gap-1"><Star className="w-3 h-3" />{node.meta.stars.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Forks</p>
              <p className="font-semibold flex items-center gap-1"><GitFork className="w-3 h-3" />{node.meta.forks.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Commits</p>
              <p className="font-semibold">{node.meta.commitCount.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Sync tier</p>
              <p className="font-semibold capitalize">{node.meta.syncTier}</p>
            </div>
          </div>
          {node.meta.language && (
            <div className="flex items-center gap-1.5 text-xs mt-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getLanguageColor(node.meta.language) }} />
              <span className="font-medium">{node.meta.language}</span>
            </div>
          )}
          <p className="text-[11px] opacity-50 mt-2">Last activity: {formatDate(node.meta.lastActivityAt)}</p>

          {connectedByType("developer").length > 0 && (
            <PanelSection title={`Contributors (${connectedByType("developer").length})`} isDark={isDark}>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {connectedByType("developer").map((c) => clickableItem(c.node, `${c.weight} events`))}
              </div>
            </PanelSection>
          )}
          {connectedByType("org").length > 0 && (
            <PanelSection title="Organization" isDark={isDark}>
              {connectedByType("org").map((c) => clickableItem(c.node))}
            </PanelSection>
          )}
        </>
      )}

      {/* ─── Developer details ─── */}
      {isDevMeta(node) && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs mb-1">
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Commits</p>
              <p className="font-semibold">{node.meta.totalCommits.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Pull requests</p>
              <p className="font-semibold">{node.meta.totalPRs.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Repositories</p>
              <p className="font-semibold">{node.meta.repoCount}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Organizations</p>
              <p className="font-semibold">{node.meta.orgCount}</p>
            </div>
          </div>
          <p className="text-[11px] opacity-50 mt-2">Last seen: {formatDate(node.meta.lastSeenAt)}</p>

          {connectedByType("repo").length > 0 && (
            <PanelSection title={`Repos (${connectedByType("repo").length})`} isDark={isDark}>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {connectedByType("repo").map((c) => {
                  const lang = isRepoMeta(c.node) ? c.node.meta.language : null;
                  return (
                    <button
                      key={c.node.id}
                      onClick={() => onSelectNode(c.node)}
                      className={cn(
                        "flex items-center gap-1.5 w-full text-left px-2 py-1 rounded transition-colors text-xs",
                        isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                      )}
                    >
                      {lang && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getLanguageColor(lang) }} />}
                      <span className="truncate">{c.node.label}</span>
                      <span className="text-[10px] opacity-50 flex-shrink-0 ml-auto">{c.weight} events</span>
                    </button>
                  );
                })}
              </div>
            </PanelSection>
          )}
          {connectedByType("org").length > 0 && (
            <PanelSection title={`Orgs (${connectedByType("org").length})`} isDark={isDark}>
              <div className="space-y-0.5">
                {connectedByType("org").map((c) => clickableItem(c.node))}
              </div>
            </PanelSection>
          )}
        </>
      )}

      {/* ─── Org details ─── */}
      {isOrgMeta(node) && (() => {
        const connRepos = connectedByType("repo");
        const connDevs = connectedByType("developer");
        const totalStars = connRepos.reduce((s, c) => s + (isRepoMeta(c.node) ? c.node.meta.stars : 0), 0);
        const totalForks = connRepos.reduce((s, c) => s + (isRepoMeta(c.node) ? c.node.meta.forks : 0), 0);
        const activeDevs = connDevs.filter((c) => isDevMeta(c.node) && c.node.meta.isActive).length;
        const topLangs = new Map<string, number>();
        connRepos.forEach((c) => { if (isRepoMeta(c.node) && c.node.meta.language) topLangs.set(c.node.meta.language, (topLangs.get(c.node.meta.language) ?? 0) + 1); });
        const topLanguage = [...topLangs.entries()].sort((a, b) => b[1] - a[1])[0];
        return (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs mb-1">
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Stars</p>
              <p className="font-semibold flex items-center gap-1"><Star className="w-3 h-3" />{totalStars.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Forks</p>
              <p className="font-semibold flex items-center gap-1"><GitFork className="w-3 h-3" />{totalForks.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Repositories</p>
              <p className="font-semibold">{node.meta.repoCount}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Total commits</p>
              <p className="font-semibold">{node.meta.commitCount.toLocaleString()}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Active devs</p>
              <p className="font-semibold">{activeDevs} / {connDevs.length}</p>
            </div>
            <div className={cn("rounded-lg p-2", isDark ? "bg-white/5" : "bg-gray-50")}>
              <p className="text-[10px] opacity-50">Top language</p>
              <p className="font-semibold flex items-center gap-1">
                {topLanguage ? (
                  <><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getLanguageColor(topLanguage[0]) }} />{topLanguage[0]}</>
                ) : "—"}
              </p>
            </div>
          </div>

          {connectedByType("repo").length > 0 && (
            <PanelSection title={`Repos (${connectedByType("repo").length})`} isDark={isDark}>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {connectedByType("repo").map((c) => {
                  const lang = isRepoMeta(c.node) ? c.node.meta.language : null;
                  const stars = isRepoMeta(c.node) ? c.node.meta.stars : 0;
                  return (
                    <button
                      key={c.node.id}
                      onClick={() => onSelectNode(c.node)}
                      className={cn(
                        "flex items-center gap-1.5 w-full text-left px-2 py-1 rounded transition-colors text-xs",
                        isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                      )}
                    >
                      {lang && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getLanguageColor(lang) }} />}
                      <span className="truncate">{c.node.label}</span>
                      {stars > 0 && (
                        <span className="text-[10px] opacity-50 flex-shrink-0 ml-auto flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" />{stars}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </PanelSection>
          )}
          {connectedByType("developer").length > 0 && (
            <PanelSection title={`Developers (${connectedByType("developer").length})`} isDark={isDark}>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {connectedByType("developer").map((c) => clickableItem(c.node, `${c.weight} events`))}
              </div>
            </PanelSection>
          )}
        </>
        );
      })()}

      {/* GitHub link */}
      <a
        href={getGitHubUrl(node)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center justify-center gap-2 mt-4 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full",
          isDark ? "bg-[#0bd1a2]/10 hover:bg-[#0bd1a2]/20 border border-[#0bd1a2]/20" : "bg-gray-100 hover:bg-gray-200 border border-gray-200"
        )}
      >
        <ExternalLink className="w-3.5 h-3.5" /> Open on GitHub
      </a>
    </div>
  );
}

// ─── Tooltip ────────────────────────────────────────────────────────────────
function GraphTooltip({
  node, x, y, isDark,
}: { node: GraphNode; x: number; y: number; isDark: boolean }) {
  const chartColors = getChartColors(isDark ? "dark" : "light");
  const fullId = node.id.replace(/^(org|repo|dev):/, "");
  const active = isRecentlyActive(node);

  return (
    <div
      className="fixed z-[10000] pointer-events-none rounded-lg shadow-xl px-3 py-2.5 text-xs max-w-[300px]"
      style={{
        left: x + 14, top: y - 10,
        backgroundColor: chartColors.tooltipBg,
        border: `1px solid ${chartColors.tooltipBorder}`,
        color: chartColors.tooltipText,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <p className="font-bold text-[13px]">{node.label}</p>
        {active && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" title="Active in last 14 days" />}
      </div>
      <p className="text-[10px] opacity-40 mb-1.5">{fullId}</p>

      {isRepoMeta(node) && (
        <div className="space-y-1">
          {node.meta.description && <p className="text-[11px] opacity-70 leading-snug line-clamp-2">{node.meta.description}</p>}
          <div className="flex items-center gap-3 text-[11px]">
            {node.meta.language && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getLanguageColor(node.meta.language) }} />
                {node.meta.language}
              </span>
            )}
            <span className="flex items-center gap-1"><Star className="w-3 h-3" />{node.meta.stars.toLocaleString()}</span>
            <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{node.meta.forks.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] opacity-70">
            <span>{node.meta.commitCount.toLocaleString()} commits</span>
            <span>Tier: {node.meta.syncTier}</span>
            {node.meta.isArchived && <span className="text-amber-400">Archived</span>}
          </div>
          <p className="text-[10px] opacity-50">Last activity: {formatDate(node.meta.lastActivityAt)}</p>
        </div>
      )}

      {isDevMeta(node) && (
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-[11px]">
            <span>{node.meta.totalCommits.toLocaleString()} commits</span>
            <span>{node.meta.totalPRs.toLocaleString()} PRs</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] opacity-70">
            <span>{node.meta.repoCount} repos</span>
            <span>{node.meta.orgCount} orgs</span>
            <span>{node.meta.isActive ? "Active" : "Inactive"}</span>
          </div>
          {node.meta.isBridge && (
            <p className="text-amber-400 font-medium text-[11px]">Cross-org bridge developer</p>
          )}
          <p className="text-[10px] opacity-50">Last seen: {formatDate(node.meta.lastSeenAt)}</p>
        </div>
      )}

      {isOrgMeta(node) && (
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-[11px]">
            <span>{node.meta.repoCount} repositories</span>
            <span>{node.meta.commitCount.toLocaleString()} commits</span>
          </div>
          <p className="text-[11px] opacity-70">Activity score: {node.size.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────
const CHART_ID: ChartId = "ecosystem-network";
const EXPANDED_HEIGHT = 900;
const EXPANDED_WIDTH = 1180;
const EXPAND_BACKUP_KEY = "ecosystem-network-pre-expand-layouts";

// ─── Main component ─────────────────────────────────────────────────────────
export function EcosystemNetworkGraph({ isLoading, className }: ChartProps) {
  const network = useAppSelector((state) => state.development.network);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";
  const isDark = activeTheme.isDark;
  const { getLayout, updateLayout, config } = useDashboard();

  const svgRef = useRef<SVGSVGElement>(null);
  const expandedSvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const expandedContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const settledNodesRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const savedLayoutsRef = useRef<Map<ChartId, ChartLayout> | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  // Restore layouts if component mounts with stale expanded dimensions (page refresh / tab switch)
  useEffect(() => {
    const backup = localStorage.getItem(EXPAND_BACKUP_KEY);
    if (backup) {
      try {
        const entries: [ChartId, ChartLayout][] = JSON.parse(backup);
        entries.forEach(([id, layout]) => updateLayout(id, layout));
      } catch { /* corrupt data, ignore */ }
      localStorage.removeItem(EXPAND_BACKUP_KEY);
    } else {
      const layout = getLayout(CHART_ID);
      if (layout.width >= EXPANDED_WIDTH) {
        const def = DEFAULT_CHART_LAYOUTS[CHART_ID];
        if (def) updateLayout(CHART_ID, def);
      }
    }
    return () => {
      if (savedLayoutsRef.current) {
        savedLayoutsRef.current.forEach((l, id) => updateLayout(id, l));
        savedLayoutsRef.current = null;
        localStorage.removeItem(EXPAND_BACKUP_KEY);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expand: save all layouts, resize self to full width, push overlapping widgets down
  const handleExpand = useCallback(() => {
    // Snapshot all layouts before any mutations
    const saved = new Map<ChartId, ChartLayout>();
    config.visibleCharts.forEach((id) => {
      saved.set(id as ChartId, { ...getLayout(id as ChartId) });
    });
    savedLayoutsRef.current = saved;
    localStorage.setItem(EXPAND_BACKUP_KEY, JSON.stringify(Array.from(saved.entries())));

    const my = saved.get(CHART_ID)!;
    const myOrigBottom = my.y + my.height;
    const expandedBottom = my.y + EXPANDED_HEIGHT;
    const gap = 20;

    // Expand to full width, keep same y
    updateLayout(CHART_ID, { x: 0, width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT });

    // Push same-row widgets (any widget vertically overlapping) below expanded area
    let tallestSameRow = 0;
    config.visibleCharts.forEach((id) => {
      if (id === CHART_ID) return;
      const layout = saved.get(id as ChartId)!;
      const overlapsOriginal = layout.y < myOrigBottom && (layout.y + layout.height) > my.y;
      if (overlapsOriginal) {
        updateLayout(id as ChartId, { y: expandedBottom + gap });
        if (layout.height > tallestSameRow) tallestSameRow = layout.height;
      }
    });

    // Shift below widgets to account for expansion + displaced same-row widgets
    const sameRowSpace = tallestSameRow > 0 ? tallestSameRow + gap : 0;
    const totalShift = (EXPANDED_HEIGHT - my.height) + sameRowSpace;
    config.visibleCharts.forEach((id) => {
      if (id === CHART_ID) return;
      const layout = saved.get(id as ChartId)!;
      if (layout.y >= myOrigBottom) {
        updateLayout(id as ChartId, { y: layout.y + totalShift });
      }
    });

    setIsExpanded(true);
    setTimeout(() => {
      wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 450);
  }, [getLayout, updateLayout, config.visibleCharts]);

  // Collapse: restore all saved layouts exactly
  const handleCollapse = useCallback(() => {
    if (savedLayoutsRef.current) {
      savedLayoutsRef.current.forEach((layout, id) => {
        updateLayout(id, layout);
      });
      savedLayoutsRef.current = null;
      localStorage.removeItem(EXPAND_BACKUP_KEY);
    }
    setIsExpanded(false);
    setSelectedNode(null);
    setSearchQuery("");
  }, [updateLayout]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTypes, setFilterTypes] = useState({ org: true, repo: true, developer: true });
  const [searchOpen, setSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !network?.nodes) return [];
    const q = searchQuery.toLowerCase();
    return network.nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, network]);

  const zoomToNode = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setSearchQuery("");
    setSearchOpen(false);
    if (!zoomRef.current || !expandedContainerRef.current) return;
    const pos = settledNodesRef.current.get(node.id);
    if (!pos) return;
    const { width, height } = expandedContainerRef.current.getBoundingClientRect();
    const scale = 2;
    const tx = width / 2 - pos.x * scale;
    const ty = height / 2 - pos.y * scale;
    const svg = select(expandedSvgRef.current!);
    svg.transition().duration(500)
      .call(zoomRef.current!.transform, zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  // Compute radius scales from current data
  const radiusScales = useMemo(() => {
    if (!network?.nodes?.length) return null;
    const getCommits = (n: GraphNode) => {
      if (isOrgMeta(n)) return n.meta.commitCount;
      if (isRepoMeta(n)) return n.meta.commitCount;
      if (isDevMeta(n)) return n.meta.totalCommits;
      return n.size;
    };
    const orgs = network.nodes.filter((n) => n.type === "org");
    const repos = network.nodes.filter((n) => n.type === "repo");
    const devs = network.nodes.filter((n) => n.type === "developer");

    const extent = (arr: GraphNode[]) => {
      const vals = arr.map(getCommits);
      return [Math.min(...vals, 0), Math.max(...vals, 1)] as [number, number];
    };

    return {
      org: scaleSqrt().domain(extent(orgs)).range([14, 28]).clamp(true),
      repo: scaleSqrt().domain(extent(repos)).range([4, 14]).clamp(true),
      developer: scaleSqrt().domain(extent(devs)).range([3, 10]).clamp(true),
    };
  }, [network]);

  const getRadius = useCallback((node: GraphNode): number => {
    if (!radiusScales) return 5;
    const s = radiusScales[node.type];
    if (!s) return 5;
    if (isOrgMeta(node)) return s(node.meta.commitCount);
    if (isRepoMeta(node)) return s(node.meta.commitCount);
    if (isDevMeta(node)) return s(node.meta.totalCommits);
    return s(node.size);
  }, [radiusScales]);

  // Color for node types
  const typeColor = useCallback((type: string) => {
    if (type === "org") return chartColors.palette[0];
    if (type === "repo") return chartColors.palette[2] || chartColors.primary;
    return chartColors.palette[4] || chartColors.primaryMuted;
  }, [chartColors]);

  // ─── Render function ──────────────────────────────────────────────────────
  const renderGraph = useCallback(
    (svgEl: SVGSVGElement, nodes: GraphNode[], edges: GraphEdge[], width: number, height: number, interactive: boolean) => {
      const svg = select(svgEl);
      svg.selectAll("*").remove();
      if (!nodes.length) return;

      const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
      const simLinks: SimLink[] = edges
        .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
        .map((e) => ({ source: nodeMap.get(e.source)!, target: nodeMap.get(e.target)!, weight: e.weight }));

      // Defs
      const defs = svg.append("defs");

      // Animated glow for active nodes
      const glowFilter = defs.append("filter").attr("id", "active-glow")
        .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
      glowFilter.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "4").attr("result", "blur");
      glowFilter.append("feColorMatrix").attr("in", "blur").attr("type", "matrix")
        .attr("values", "0 0 0 0 0.2  0 0 0 0 0.9  0 0 0 0 0.6  0 0 0 0.6 0").attr("result", "glow");
      const glowMerge = glowFilter.append("feMerge");
      glowMerge.append("feMergeNode").attr("in", "glow");
      glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

      // Layers
      const g = svg.append("g");
      const hullLayer = g.append("g").attr("class", "layer-hulls");
      const edgeLayer = g.append("g").attr("class", "layer-edges");
      const nodeLayer = g.append("g").attr("class", "layer-nodes");
      const labelLayer = g.append("g").attr("class", "layer-labels");

      // Zoom
      if (interactive) {
        const zoomBehavior = zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.2, 5])
          .on("zoom", (event) => { g.attr("transform", event.transform); });
        svg.call(zoomBehavior).call(zoomBehavior.transform, zoomIdentity);
        zoomRef.current = zoomBehavior;
      }

      // Edges
      const linkGroup = edgeLayer.selectAll("line").data(simLinks).join("line")
        .attr("stroke", chartColors.primaryMuted)
        .attr("stroke-opacity", 0.3)
        .attr("stroke-width", (d) => Math.max(0.5, Math.min(3, d.weight / 10)));

      // Nodes
      const nodeGroup = nodeLayer.selectAll<SVGGElement, SimNode>("g.node")
        .data(simNodes).join("g").attr("class", "node");

      // Invisible hit-area circle — covers all outer rings so there's no hover gap
      nodeGroup.append("circle")
        .attr("r", (d) => getRadius(d) + 6)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .attr("pointer-events", "all");

      // Base circle
      nodeGroup.append("circle")
        .attr("r", (d) => getRadius(d))
        .attr("fill", (d) => typeColor(d.type))
        .attr("stroke", chartColors.tooltipBg)
        .attr("stroke-width", (d) => isDevMeta(d) && d.meta.isBridge ? 2 : 1)
        .attr("filter", (d) => isRecentlyActive(d) ? "url(#active-glow)" : "none");

      // Bridge dev double ring
      nodeGroup.filter((d) => isDevMeta(d) && d.meta.isBridge)
        .append("circle")
        .attr("r", (d) => getRadius(d) + 3)
        .attr("fill", "none")
        .attr("stroke", chartColors.palette[0])
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,2")
        .attr("opacity", 0.6);

      // Language ring for repos
      nodeGroup.filter((d) => d.type === "repo")
        .append("circle")
        .attr("r", (d) => getRadius(d) + 2)
        .attr("fill", "none")
        .attr("stroke", (d) => isRepoMeta(d) ? getLanguageColor(d.meta.language) : "#888")
        .attr("stroke-width", 2)
        .attr("opacity", 0.7);

      // Active indicator ring (green pulsing outline for nodes active in last 14 days)
      nodeGroup.filter((d) => isRecentlyActive(d))
        .append("circle")
        .attr("class", "active-ring")
        .attr("r", (d) => getRadius(d) + (d.type === "repo" ? 5 : 4))
        .attr("fill", "none")
        .attr("stroke", "#34d399")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.5);

      // Avatars (expanded only)
      if (interactive) {
        const avatarNodes = simNodes.filter((d) => isDevMeta(d) && d.meta.avatarUrl);
        avatarNodes.forEach((d) => {
          const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
          defs.append("clipPath").attr("id", clipId)
            .append("circle").attr("r", getRadius(d));
        });
        nodeGroup.filter((d) => isDevMeta(d) && !!d.meta.avatarUrl)
          .append("image")
          .attr("href", (d) => (d.meta as DevMeta).avatarUrl!)
          .attr("width", (d) => getRadius(d) * 2)
          .attr("height", (d) => getRadius(d) * 2)
          .attr("x", (d) => -getRadius(d))
          .attr("y", (d) => -getRadius(d))
          .attr("clip-path", (d) => `url(#clip-${d.id.replace(/[^a-zA-Z0-9]/g, "-")})`)
          .attr("preserveAspectRatio", "xMidYMid slice");
      }

      // Labels
      const showLabel = (d: SimNode) => {
        if (d.type === "org") return true;
        if (interactive) {
          if (isDevMeta(d) && d.meta.isBridge) return true;
          if (getRadius(d) > 8) return true;
        }
        return false;
      };

      labelLayer.selectAll("text").data(simNodes.filter(showLabel)).join("text")
        .text((d) => d.label)
        .attr("font-size", (d) => d.type === "org" ? 11 : d.type === "repo" ? 9 : 8)
        .attr("font-weight", (d) => d.type === "org" ? "bold" : "normal")
        .attr("fill", chartColors.axisText)
        .attr("text-anchor", "middle")
        .attr("dy", (d) => d.type === "org" ? -(getRadius(d) + 6) : getRadius(d) + 12)
        .attr("pointer-events", "none");

      // Hulls
      const orgNodes = new Map<string, SimNode[]>();
      simNodes.forEach((n) => {
        if (n.type !== "org") {
          const ownerEdge = simLinks.find(
            (l) => (l.target as SimNode).id === n.id && (l.source as SimNode).type === "org"
              || (l.source as SimNode).id === n.id && (l.target as SimNode).type === "org"
          );
          if (ownerEdge) {
            const org = ((ownerEdge.source as SimNode).type === "org" ? ownerEdge.source : ownerEdge.target) as SimNode;
            const key = org.id;
            if (!orgNodes.has(key)) orgNodes.set(key, [org]);
            orgNodes.get(key)!.push(n);
          }
        }
      });
      // Org repos connected through repo→org edges
      simNodes.forEach((n) => {
        if (n.type === "repo") {
          const orgEdge = simLinks.find(
            (l) => ((l.source as SimNode).id === n.id && (l.target as SimNode).type === "org")
              || ((l.target as SimNode).id === n.id && (l.source as SimNode).type === "org")
          );
          if (orgEdge) {
            const org = ((orgEdge.source as SimNode).type === "org" ? orgEdge.source : orgEdge.target) as SimNode;
            if (!orgNodes.has(org.id)) orgNodes.set(org.id, [org]);
            if (!orgNodes.get(org.id)!.includes(n)) orgNodes.get(org.id)!.push(n);
          }
        }
      });

      const hullPaths = hullLayer.selectAll("path")
        .data(Array.from(orgNodes.entries()).filter(([, ns]) => ns.length >= 3))
        .join("path")
        .attr("fill", chartColors.primary)
        .attr("fill-opacity", 0.03)
        .attr("stroke", chartColors.primaryMuted)
        .attr("stroke-opacity", interactive ? 0.15 : 0.08)
        .attr("stroke-width", 1);

      // Interaction (expanded only)
      if (interactive) {
        nodeGroup.style("cursor", "pointer")
          .on("mouseenter", (event, d) => {
            setTooltip({ node: d, x: event.clientX, y: event.clientY });
            // Highlight connected
            const connected = new Set<string>([d.id]);
            simLinks.forEach((l) => {
              if ((l.source as SimNode).id === d.id) connected.add((l.target as SimNode).id);
              if ((l.target as SimNode).id === d.id) connected.add((l.source as SimNode).id);
            });
            nodeGroup.attr("opacity", (n) => connected.has(n.id) ? 1 : 0.15);
            linkGroup.attr("opacity", (l) =>
              (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? 0.8 : 0.05
            );
            labelLayer.selectAll("text").attr("opacity", (n: unknown) => connected.has((n as SimNode).id) ? 1 : 0.1);
          })
          .on("mousemove", (event) => {
            setTooltip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : null);
          })
          .on("mouseleave", () => {
            setTooltip(null);
            nodeGroup.attr("opacity", 1);
            linkGroup.attr("opacity", 0.3);
            labelLayer.selectAll("text").attr("opacity", 1);
          })
          .on("click", (_event, d) => {
            setSelectedNode((prev) => prev?.id === d.id ? null : d);
          })
          .on("dblclick", (_event, d) => {
            window.open(getGitHubUrl(d), "_blank", "noopener,noreferrer");
          });

        // Click empty canvas to deselect
        svg.on("click", (event) => {
          if (event.target === svgEl) setSelectedNode(null);
        });
      }

      // Simulation
      const simulation = forceSimulation(simNodes)
        .force("link", forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(50))
        .force("charge", forceManyBody().strength(-80))
        .force("center", forceCenter(width / 2, height / 2))
        .force("collide", forceCollide<SimNode>().radius((d) => getRadius(d) + 4));

      const updatePositions = () => {
        linkGroup
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);
        nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        labelLayer.selectAll("text").attr("x", (d: unknown) => (d as SimNode).x ?? 0).attr("y", (d: unknown) => (d as SimNode).y ?? 0);

        // Update hulls
        hullPaths.attr("d", (d) => {
          const pts = d[1].map((n) => [n.x ?? 0, n.y ?? 0] as [number, number]);
          return hullPath(pts, 20);
        });
      };

      // Pre-settle
      simulation.stop();
      for (let i = 0; i < 200; i++) simulation.tick();
      updatePositions();

      // Store settled positions for search zoom
      if (interactive) {
        const posMap = new Map<string, { x: number; y: number }>();
        simNodes.forEach((n) => posMap.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 }));
        settledNodesRef.current = posMap;
      }

      if (!interactive) {
        // Auto-fit viewBox for compact
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        simNodes.forEach((n) => {
          const r = getRadius(n);
          minX = Math.min(minX, (n.x ?? 0) - r);
          minY = Math.min(minY, (n.y ?? 0) - r);
          maxX = Math.max(maxX, (n.x ?? 0) + r);
          maxY = Math.max(maxY, (n.y ?? 0) + r);
        });
        const pad = 30;
        svg.attr("viewBox", `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`);
      }

      // Drag restart (expanded only)
      if (interactive) {
        let dragTarget: SimNode | null = null;
        nodeGroup.on("mousedown.drag", function (event, d) {
          if (event.button !== 0) return;
          event.stopPropagation();
          dragTarget = d;
          d.fx = d.x;
          d.fy = d.y;
          simulation.alpha(0.3).restart();

          const onMove = (e: MouseEvent) => {
            if (!dragTarget) return;
            const svgPt = svgEl.createSVGPoint();
            svgPt.x = e.clientX;
            svgPt.y = e.clientY;
            const ctm = g.node()?.getScreenCTM()?.inverse();
            if (ctm) {
              const pt = svgPt.matrixTransform(ctm);
              dragTarget.fx = pt.x;
              dragTarget.fy = pt.y;
            }
          };
          const onUp = () => {
            if (dragTarget) {
              dragTarget.fx = null;
              dragTarget.fy = null;
              dragTarget = null;
            }
            simulation.alpha(0.1).restart();
            setTimeout(() => simulation.stop(), 500);
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        });

        simulation.on("tick", updatePositions);
      }

      return () => { simulation.stop(); };
    },
    [chartColors, getRadius, typeColor]
  );

  // Compact render
  useEffect(() => {
    if (isExpanded) return;
    if (!svgRef.current || !containerRef.current || !network?.nodes?.length) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    return renderGraph(svgRef.current, network.nodes, network.edges, width, height, false);
  }, [network, isExpanded, renderGraph]);

  // Expanded render — defer one frame so the container has its final layout dimensions
  useEffect(() => {
    if (!isExpanded) return;
    if (!expandedSvgRef.current || !expandedContainerRef.current || !network?.nodes?.length) return;
    let graphCleanup: (() => void) | void;
    const frameId = requestAnimationFrame(() => {
      if (!expandedSvgRef.current || !expandedContainerRef.current) return;
      const rect = expandedContainerRef.current.getBoundingClientRect();
      graphCleanup = renderGraph(expandedSvgRef.current, network.nodes, network.edges, rect.width, rect.height, true);
    });
    return () => {
      cancelAnimationFrame(frameId);
      if (typeof graphCleanup === "function") graphCleanup();
    };
  }, [network, isExpanded, renderGraph]);

  // Search: highlight matching nodes + zoom to first match
  useEffect(() => {
    if (!isExpanded || !expandedSvgRef.current || !searchQuery) return;
    const svgEl = expandedSvgRef.current;
    const svg = select(svgEl);
    const q = searchQuery.toLowerCase();
    let firstMatchId: string | null = null;

    svg.selectAll<SVGGElement, SimNode>("g.node").attr("opacity", (d) => {
      const match = d.label.toLowerCase().includes(q)
        || d.id.toLowerCase().includes(q)
        || (isRepoMeta(d) && d.meta.description?.toLowerCase().includes(q));
      if (match && !firstMatchId) firstMatchId = d.id;
      return match ? 1 : 0.1;
    });
    svg.selectAll<SVGLineElement, SimLink>("line").attr("opacity", 0.05);

    // Zoom to first match
    if (firstMatchId && zoomRef.current && expandedContainerRef.current) {
      const pos = settledNodesRef.current.get(firstMatchId);
      if (pos) {
        const { width, height } = expandedContainerRef.current.getBoundingClientRect();
        const scale = 2;
        const tx = width / 2 - pos.x * scale;
        const ty = height / 2 - pos.y * scale;
        svg.transition().duration(500)
          .call(zoomRef.current.transform, zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    return () => {
      svg.selectAll("g.node").attr("opacity", 1);
      svg.selectAll("line").attr("opacity", 0.3);
    };
  }, [searchQuery, isExpanded]);

  // Filter: toggle visibility
  useEffect(() => {
    if (!isExpanded || !expandedSvgRef.current) return;
    const svg = select(expandedSvgRef.current);
    svg.selectAll<SVGGElement, SimNode>("g.node").attr("opacity", (d) => {
      if (!filterTypes[d.type]) return 0.05;
      return 1;
    });
    svg.selectAll<SVGLineElement, SimLink>("line").attr("opacity", (d) => {
      const s = d.source as SimNode, t = d.target as SimNode;
      if (!filterTypes[s.type] || !filterTypes[t.type]) return 0.02;
      return 0.3;
    });
  }, [filterTypes, isExpanded]);

  // Escape or click-outside to close
  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedNode) setSelectedNode(null);
        else handleCollapse();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        handleCollapse();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isExpanded, selectedNode, handleCollapse]);

  if (isLoading && !network?.nodes?.length) return <ChartSkeleton className={className} />;

  // ─── Expanded inline view ───────────────────────────────────────────────
  if (isExpanded) {
    return (
      <div ref={wrapperRef} className={cn("flex flex-col h-full w-full", chartCardClassName, isGame && chartCardGameClassName, className)}>
        {/* Toolbar */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 border-b flex-shrink-0 flex-wrap",
          isDark ? "border-white/10" : "border-gray-100"
        )}>
          <h3 className="text-sm font-semibold dark:text-[#0bd1a2] mr-2">Ecosystem Network</h3>

          {/* Search */}
          <div className="relative flex-1 max-w-xs min-w-[160px]">
            <div className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md",
              isDark ? "bg-white/5 border border-white/10" : "bg-gray-100 border border-gray-200"
            )}>
              <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                placeholder="Search..."
                className="bg-transparent outline-none text-xs w-full"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}><X className="w-3 h-3 text-muted-foreground" /></button>
              )}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className={cn(
                "absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto",
                isDark ? "bg-[#1a1a2e] border border-white/10" : "bg-white border border-gray-200"
              )}>
                {searchResults.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => zoomToNode(n)}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs transition-colors",
                      isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: typeColor(n.type) }}
                    />
                    <span className="truncate flex-1">{n.label}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0",
                      n.type === "org" ? "bg-blue-500/15 text-blue-400" :
                      n.type === "repo" ? "bg-green-500/15 text-green-400" :
                      "bg-purple-500/15 text-purple-400"
                    )}>
                      {n.type === "developer" ? "Dev" : n.type.charAt(0).toUpperCase() + n.type.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type filters */}
          <div className="flex items-center gap-1">
            {(["org", "repo", "developer"] as const).map((t) => {
              const color = typeColor(t);
              return (
                <button
                  key={t}
                  onClick={() => setFilterTypes((p) => ({ ...p, [t]: !p[t] }))}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1.5",
                    !filterTypes[t] && (isDark ? "opacity-30" : "opacity-40"),
                  )}
                  style={{
                    backgroundColor: filterTypes[t] ? `${color}20` : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    color: filterTypes[t] ? color : undefined,
                  }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  {t === "developer" ? "Dev" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>

        </div>

        {/* Graph + info panel */}
        <div className="flex flex-1 min-h-0">
          <div ref={expandedContainerRef} className="flex-1 min-h-0">
            <svg ref={expandedSvgRef} width="100%" height="100%" />
          </div>
          {selectedNode && network && (
            <NodeInfoPanel
              node={selectedNode}
              edges={network.edges}
              nodes={network.nodes}
              onClose={() => setSelectedNode(null)}
              onSelectNode={(n) => setSelectedNode(n)}
              isDark={isDark}
            />
          )}
        </div>

        <div className="flex justify-end px-3 py-1 flex-shrink-0">
          <button
            onClick={handleCollapse}
            className="p-1 rounded hover:bg-muted dark:hover:bg-white/10 transition-colors"
          >
            <Minimize2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {tooltip && createPortal(
          <GraphTooltip node={tooltip.node} x={tooltip.x} y={tooltip.y} isDark={isDark} />,
          document.body
        )}
      </div>
    );
  }

  // ─── Compact preview ──────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold dark:text-[#0bd1a2] mb-2">Ecosystem Network</h3>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 cursor-pointer"
        onClick={handleExpand}
      >
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
      <div className="flex items-center justify-between mt-1">
        <p
          className="text-xs text-muted-foreground cursor-pointer"
          onClick={handleExpand}
        >
          {network?.nodes?.length ?? 0} nodes · Click to expand
        </p>
        <button
          onClick={handleExpand}
          className="p-1 rounded hover:bg-muted dark:hover:bg-white/10 transition-colors"
        >
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
