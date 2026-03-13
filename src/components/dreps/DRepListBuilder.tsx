import { useState, useMemo, useRef } from "react";
import { X, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { EnrichedDRep } from "@/components/dreps/DRepPickerResults";


interface DRepGroup {
  id: string;
  name: string;
  selectedIds: Set<string>;
}

interface DRepListBuilderProps {
  dreps: EnrichedDRep[];
  totalVotingPower: number;
}

function formatVotingPower(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

const MAX_SEARCH_RESULTS = 80;
const MAX_GROUPS = 5;

function calcGroupMetrics(group: DRepGroup, dreps: EnrichedDRep[], totalVotingPower: number) {
  const selected = dreps.filter((d) => group.selectedIds.has(d.drepId));
  const totalDelegators = selected.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0);
  const totalAda = selected.reduce((sum, d) => sum + d.votingPowerAda, 0);
  const powerPct = totalVotingPower > 0 ? (totalAda / totalVotingPower) * 100 : 0;
  return { count: selected.length, totalDelegators, totalAda, powerPct, selected };
}

export default function DRepListBuilder({ dreps, totalVotingPower }: DRepListBuilderProps) {
  const t = useTranslations("drep");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const groupCounterRef = useRef(2);
  const [groups, setGroups] = useState<DRepGroup[]>(() => [
    { id: "g-0", name: t("listBuilderGroupName", { n: 1 }), selectedIds: new Set() },
  ]);
  const [activeGroupId, setActiveGroupId] = useState("g-0");
  const [search, setSearch] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [hoveredSlice, setHoveredSlice] = useState<{ name: string; value: number } | null>(null);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? groups[0],
    [groups, activeGroupId]
  );

  // ── Group operations ─────────────────────────────────────────────────────
  const addGroup = () => {
    if (groups.length >= MAX_GROUPS) return;
    const id = `g-${Date.now()}`;
    const name = t("listBuilderGroupName", { n: groupCounterRef.current++ });
    const newGroup: DRepGroup = { id, name, selectedIds: new Set() };
    setGroups((prev) => [...prev, newGroup]);
    setActiveGroupId(id);
  };

  const removeGroup = (id: string) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== id);
      if (activeGroupId === id) setActiveGroupId(next[0]?.id ?? "");
      return next;
    });
  };

  const startRename = (group: DRepGroup) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const commitRename = () => {
    if (!editingGroupId) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === editingGroupId ? { ...g, name: editingName.trim() || g.name } : g
      )
    );
    setEditingGroupId(null);
  };

  const resetAll = () => {
    groupCounterRef.current = 2;
    const initial: DRepGroup = { id: "g-0", name: t("listBuilderGroupName", { n: 1 }), selectedIds: new Set() };
    setGroups([initial]);
    setActiveGroupId("g-0");
    setSearch("");
    setEditingGroupId(null);
  };

  const toggleInGroup = (drepId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroupId) return g;
        const next = new Set(g.selectedIds);
        if (next.has(drepId)) next.delete(drepId);
        else next.add(drepId);
        return { ...g, selectedIds: next };
      })
    );
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!search.trim()) return dreps.slice(0, MAX_SEARCH_RESULTS);
    const q = search.toLowerCase();
    return dreps
      .filter((d) => {
        const name = (d.name ?? "anonymous").toLowerCase();
        return name.includes(q) || d.drepId.toLowerCase().includes(q);
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }, [dreps, search]);

  const comparisonData = useMemo(
    () => groups.map((g) => ({ group: g, ...calcGroupMetrics(g, dreps, totalVotingPower) })),
    [groups, dreps, totalVotingPower]
  );

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const dragRef = useRef<{ drepId: string; fromGroupId: string } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // ── Theme classes ─────────────────────────────────────────────────────────
  const cardClass = isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : isGame
    ? "game-detail-card rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent shadow-none";

  const titleCardClass = isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] px-4 sm:px-6 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : isGame
    ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] px-4 sm:px-6 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent px-4 sm:px-6 py-3 shadow-none";

  const dividerClass = isLight
    ? "border-black/8"
    : isGame
    ? "border-white/10"
    : "border-[#0bd1a2]/20";

  const inputClass = isLight
    ? "rounded-lg border border-black/10 bg-white text-black placeholder-black/40 text-xs px-3 py-2 w-full outline-none focus:border-black/30"
    : isGame
    ? "rounded-[2px] border border-white/20 bg-white/5 text-white placeholder-white/30 text-xs px-3 py-2 w-full outline-none focus:border-white/40"
    : "rounded-none border border-[#0bd1a2] bg-[#0bd1a2]/5 text-[#0bd1a2] placeholder-[#0bd1a2]/50 text-xs px-3 py-2 w-full outline-none focus:bg-[#0bd1a2]/10";

  const labelClass = cn(
    "text-[10px]",
    isGame ? "text-white/50" : isLight ? "text-black/40" : "text-[#0bd1a2]/50"
  );

  const metricLabelClass = cn(
    "text-[10px]",
    isGame ? "text-white/70" : isLight ? "text-black/60" : "text-[#0bd1a2]/70"
  );

  const accentClass = isGame ? "text-white" : isLight ? "text-black" : "text-[#0bd1a2]";

  // Donut chart slice colors — opacity steps of the single theme accent
  const chartColors = isGame
    ? ["rgba(255,255,255,1)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0.48)", "rgba(255,255,255,0.3)", "rgba(255,255,255,0.16)"]
    : isLight
    ? ["rgba(15,23,42,0.85)", "rgba(15,23,42,0.62)", "rgba(15,23,42,0.42)", "rgba(15,23,42,0.26)", "rgba(15,23,42,0.14)"]
    : ["rgba(11,209,162,1)", "rgba(11,209,162,0.7)", "rgba(11,209,162,0.48)", "rgba(11,209,162,0.3)", "rgba(11,209,162,0.16)"];

  const rowHoverClass = isLight
    ? "hover:bg-black/5 rounded-lg"
    : isGame
    ? "hover:bg-white/8 rounded-[2px]"
    : "hover:bg-[#0bd1a2]/5";

  const scrollbarClass = isGame
    ? "[&::-webkit-scrollbar-thumb]:bg-white/25"
    : "[&::-webkit-scrollbar-thumb]:bg-black/15";

  const selectedBtnClass = isGame
    ? "bg-white text-black"
    : isLight
    ? "bg-black text-white"
    : "bg-[#0bd1a2] text-black";

  const unselectedBtnClass = isGame
    ? "border border-white/25 text-white/30"
    : isLight
    ? "border border-black/15 text-black/25"
    : "border border-[#0bd1a2]/30 text-[#0bd1a2]/30";

  const removeCardBtnClass = isGame
    ? "bg-white/10 hover:bg-white/20 text-white"
    : isLight
    ? "bg-black/8 hover:bg-black/16 text-black"
    : "bg-[#0bd1a2]/10 hover:bg-[#0bd1a2]/20 text-[#0bd1a2]";

  // Tab styling — fully explicit per theme, no dark: prefix to avoid CSS ordering issues
  const tabBase = isGame
    ? "game-tab-btn text-[10px] sm:text-xs"
    : isLight
    ? cn(
        "rounded-full border border-white/8 bg-white text-black px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide whitespace-nowrap",
        "transform-gpu transition-all duration-200",
        "shadow-[0_12px_30px_rgba(15,23,42,0.25)] hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)]"
      )
    : cn(
        "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide whitespace-nowrap btn-neon",
        "transition-all duration-200 hover:bg-[#0bd1a2] hover:text-black"
      );

  const tabActive = isGame
    ? "game-tab-btn-active"
    : isLight
    ? "bg-black text-white border-black"
    : "rounded-none border border-[#0bd1a2] bg-[#0bd1a2] text-black px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-200";

  const tabRenameInputClass = isLight
    ? "rounded-full border border-black/20 bg-white text-black text-[10px] font-semibold uppercase tracking-wide px-2 py-1 outline-none w-20"
    : isGame
    ? "rounded-[2px] border border-white/30 bg-white/10 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-1 outline-none w-20"
    : "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] text-[10px] font-semibold uppercase tracking-wide px-2 py-1 outline-none w-20";

  const addGroupBtnClass = cn(tabBase, "flex items-center gap-1");


  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Title card with group tabs */}
      <div className={titleCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn("text-xs font-semibold uppercase tracking-widest", accentClass)}>
            {t("listBuilderTitle")}
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            {groups.map((group) => {
              const isActive = group.id === activeGroupId;
              return (
                <div key={group.id} className="flex items-center gap-1">
                  {editingGroupId === group.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingGroupId(null);
                      }}
                      className={tabRenameInputClass}
                    />
                  ) : (
                    <button
                      onClick={() => {
                        if (isActive) startRename(group);
                        else setActiveGroupId(group.id);
                      }}
                      title={isActive ? "Click to rename" : undefined}
                      className={
                        isActive
                          ? isGame ? cn(tabBase, tabActive)
                            : isLight ? cn(tabBase, tabActive)
                            : tabActive  // nerd: standalone to prevent btn-neon from overriding bg
                          : tabBase
                      }
                    >
                      {group.name}
                    </button>
                  )}
                  {groups.length > 1 && (
                    <button
                      onClick={() => removeGroup(group.id)}
                      className={cn(
                        "w-4 h-4 flex items-center justify-center rounded-full transition-opacity opacity-40 hover:opacity-100",
                        isGame ? "text-white hover:bg-white/10" : isLight ? "text-black hover:bg-black/8" : "text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                      )}
                    >
                      <X className="h-2 w-2" />
                    </button>
                  )}
                </div>
              );
            })}

            {groups.length < MAX_GROUPS && (
              <button onClick={addGroup} className={addGroupBtnClass}>
                <Plus className="h-3 w-3" />
                {t("listBuilderAddGroup")}
              </button>
            )}

            {(groups.length > 1 || comparisonData.some((d) => d.count > 0)) && (
              <button onClick={resetAll} className={tabBase}>
                {t("listBuilderReset")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main section: search panel + DRep grid */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Left column: search card + metrics card */}
        <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-4">

            {/* Donut chart card */}
          {(() => {
            const totalPct = comparisonData.reduce((sum, d) => sum + d.powerPct, 0);
            const hasAny = comparisonData.some((d) => d.count > 0);
            const restPct = Math.max(0, 100 - totalPct);

            const pieData = [
              ...comparisonData.map((d, i) => ({
                name: d.group.name,
                value: d.powerPct,
                color: chartColors[i % chartColors.length],
                isEmpty: d.count === 0,
              })),
              { name: "Rest", value: restPct, color: isGame ? "#ffffff18" : isLight ? "#00000012" : "#0bd1a218", isEmpty: false },
            ];

            return (
              <div className={cn(cardClass, "p-4")}>
                <div className={cn("text-[10px] font-semibold uppercase tracking-widest mb-3", labelClass)}>
                  {t("listBuilderPowerPct")}
                </div>

                {/* Chart — always rendered so card height never changes */}
                <div className="relative mx-auto" style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        dataKey="value"
                        strokeWidth={0}
                        onMouseEnter={(data) => {
                          if (data.name !== "Rest") setHoveredSlice({ name: data.name, value: data.value });
                        }}
                        onMouseLeave={() => setHoveredSlice(null)}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label — shows hovered slice or combined total */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {hasAny ? (
                      hoveredSlice ? (
                        <>
                          <span className={cn("text-[11px] font-bold tabular-nums leading-none text-center px-2 truncate w-full text-center", accentClass)}>
                            {hoveredSlice.value.toFixed(1)}%
                          </span>
                          <span className={cn("text-[8px] mt-0.5 truncate w-full text-center px-2 leading-tight", labelClass)}>
                            {hoveredSlice.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={cn("text-[13px] font-bold tabular-nums leading-none", accentClass)}>
                            {Math.min(totalPct, 100).toFixed(1)}%
                          </span>
                          <span className={cn("text-[9px] mt-0.5", labelClass)}>combined</span>
                        </>
                      )
                    ) : null}
                  </div>
                </div>

                {/* Legend — fixed height for MAX_GROUPS rows so card never resizes */}
                <div className="mt-3 flex flex-col gap-1.5" style={{ minHeight: `${MAX_GROUPS * 16 + (MAX_GROUPS - 1) * 6}px` }}>
                  {comparisonData.map((d, i) => (
                    <div key={d.group.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: chartColors[i % chartColors.length], opacity: d.count > 0 ? 1 : 0.3 }}
                        />
                        <span className={cn("text-[10px] truncate max-w-[120px]", d.count > 0 ? accentClass : labelClass)}>
                          {d.group.name}
                        </span>
                      </div>
                      <span className={cn("text-[10px] tabular-nums font-medium", d.count > 0 ? accentClass : labelClass)}>
                        {d.count > 0 ? `${d.powerPct.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Search + list */}
          <div className={cn("flex flex-col overflow-hidden", cardClass)}>
            <div className={cn("p-4 border-b", dividerClass)}>
              <div className="relative">
                <Search className={cn("absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3", isGame ? "text-white/40" : isLight ? "text-black/30" : "text-[#0bd1a2]/40")} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("listBuilderSearch")}
                  className={cn(inputClass, "pl-7")}
                />
              </div>
            </div>

            <div className={cn(
              "overflow-y-auto max-h-[260px] py-1",
              "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full",
              scrollbarClass
            )}>
              {searchResults.length === 0 ? (
                <div className={cn("text-center py-8 text-xs", isGame ? "text-white/40" : "text-muted-foreground")}>
                  {t("listBuilderNoDrepsFound")}
                </div>
              ) : (
                searchResults.map((drep) => {
                  const isSelected = activeGroup.selectedIds.has(drep.drepId);
                  const memberGroups = groups
                    .map((g, i) => ({ g, i }))
                    .filter(({ g }) => g.selectedIds.has(drep.drepId));

                  return (
                    <button
                      key={drep.drepId}
                      onClick={() => toggleInGroup(drep.drepId)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 transition-colors text-left",
                        rowHoverClass
                      )}
                    >
                      <span
                        className={cn(
                          "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-colors",
                          isSelected ? selectedBtnClass : unselectedBtnClass
                        )}
                      >
                        {isSelected ? <X className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-[11px] font-medium truncate", accentClass)}>
                          {drep.name ?? "Anonymous"}
                        </div>
                        <div className={cn("text-[10px]", isGame ? "text-white/40" : isLight ? "text-black/35" : "text-[#0bd1a2]/45")}>
                          {formatVotingPower(drep.votingPowerAda)} ₳
                          {drep.delegatorCount != null && (
                            <> · {drep.delegatorCount.toLocaleString()} del</>
                          )}
                        </div>
                      </div>
                      {memberGroups.length > 0 && (
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 max-w-[80px]">
                          {memberGroups.map(({ g }) => (
                            <span
                              key={g.id}
                              className={cn(
                                "text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                                isGame
                                  ? "bg-white/10 text-white/60"
                                  : isLight
                                  ? "bg-black/8 text-black/50"
                                  : "bg-[#0bd1a2]/10 text-[#0bd1a2]/60"
                              )}
                            >
                              {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right: one column per group */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex w-full gap-3 pl-6 pt-2 pb-10" style={{ minWidth: `${groups.length * 200 + 24}px` }}>
            {comparisonData.map(({ group, selected, powerPct, count, totalDelegators, totalAda }) => {
              const hasGroupSelection = count > 0;
              const isDragTarget = dragOverGroupId === group.id;

              const colHeaderClass = isGame ? "game-detail-card" : isLight ? "border border-black/8 bg-black/[0.025]" : "border border-[#0bd1a2] bg-transparent";

              const dropHandlers = {
                onDragOver: (e: React.DragEvent) => {
                  if (!dragRef.current || dragRef.current.fromGroupId === group.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverGroupId(group.id);
                },
                onDragLeave: (e: React.DragEvent) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverGroupId(null);
                  }
                },
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault();
                  setDragOverGroupId(null);
                  if (!dragRef.current) return;
                  const { drepId, fromGroupId } = dragRef.current;
                  dragRef.current = null;
                  if (fromGroupId === group.id) return;
                  setGroups((prev) =>
                    prev.map((g) => {
                      if (g.id === fromGroupId) {
                        const next = new Set(g.selectedIds);
                        next.delete(drepId);
                        return { ...g, selectedIds: next };
                      }
                      if (g.id === group.id) {
                        const next = new Set(g.selectedIds);
                        next.add(drepId);
                        return { ...g, selectedIds: next };
                      }
                      return g;
                    })
                  );
                },
              };

              return (
                <div
                  key={group.id}
                  className={cn(
                    "flex-1 min-w-[180px] flex flex-col gap-2 rounded-xl transition-colors duration-150",
                    isDragTarget && (isGame ? "bg-white/5" : isLight ? "bg-black/4" : "bg-[#0bd1a2]/5")
                  )}
                  {...dropHandlers}
                >
                  {/* Column header + metrics merged */}
                  <button
                    onClick={() => setActiveGroupId(group.id)}
                    className={cn(
                      "w-full text-left px-3 py-3 transition-colors duration-150",
                      isLight ? "rounded-xl" : isGame ? "rounded-[2px]" : "rounded-none",
                      colHeaderClass
                    )}
                  >
                    {/* Group name */}
                    <div className={cn("text-[11px] font-semibold truncate mb-3", accentClass)}>
                      {group.name}
                    </div>

                    {/* Metrics rows */}
                    <div className="grid gap-x-2 gap-y-0.5" style={{ gridTemplateColumns: "max-content max-content" }}>
                      {[
                        { label: t("listBuilderDelegators"), value: hasGroupSelection ? totalDelegators.toLocaleString() : "—" },
                        { label: t("listBuilderDelegated"), value: hasGroupSelection ? `${formatVotingPower(totalAda)} ₳` : "—" },
                        { label: t("listBuilderPowerPct"), value: hasGroupSelection ? `${powerPct.toFixed(2)}%` : "—" },
                      ].map(({ label, value }) => (
                        <>
                          <span key={label + "_l"} className={metricLabelClass}>{label}</span>
                          <span key={label + "_v"} className={cn(
                            "text-[11px] font-bold tabular-nums",
                            hasGroupSelection
                              ? accentClass
                              : isGame ? "text-white/20" : isLight ? "text-black/15" : "text-[#0bd1a2]/20"
                          )}>{value}</span>
                        </>
                      ))}
                    </div>
                  </button>

                  {/* DRep cards stacked */}
                  {selected.length === 0 ? (
                    <div className={cn(
                      "min-h-[80px] flex items-center justify-center border transition-colors duration-150",
                      isLight ? "rounded-xl" : isGame ? "rounded-[2px]" : "rounded-none",
                      isDragTarget
                        ? isGame ? "border-white/30 border-dashed" : isLight ? "border-black/20 border-dashed" : "border-[#0bd1a2]/40 border-dashed"
                        : isLight ? "border-black/6" : isGame ? "border-white/8" : "border-[#0bd1a2]/15"
                    )}>
                      <span className={cn("text-[10px]", isGame ? "text-white/25" : isLight ? "text-black/20" : "text-[#0bd1a2]/25")}>
                        {isDragTarget ? "Drop here" : "Empty"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selected.map((drep) => (
                        <div
                          key={drep.drepId}
                          draggable
                          onDragStart={(e) => {
                            dragRef.current = { drepId: drep.drepId, fromGroupId: group.id };
                            e.dataTransfer.effectAllowed = "move";
                            // Canvas ghost — scales with devicePixelRatio for crisp HiDPI rendering
                            const text = drep.name ?? "Anonymous";
                            const dpr = window.devicePixelRatio || 1;
                            const font = "600 11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
                            const padX = 12;
                            const h = 26;
                            const canvas = document.createElement("canvas");
                            const ctx = canvas.getContext("2d")!;
                            ctx.font = font;
                            const w = ctx.measureText(text).width + padX * 2;
                            canvas.width = Math.ceil(w * dpr);
                            canvas.height = Math.ceil(h * dpr);
                            canvas.style.width = `${w}px`;
                            canvas.style.height = `${h}px`;
                            ctx.scale(dpr, dpr);
                            const bg = isGame ? "#1a1a1a" : isLight ? "#ffffff" : "#000000";
                            const fg = isGame ? "#ffffff" : isLight ? "#000000" : "#0bd1a2";
                            const stroke = isGame ? "rgba(255,255,255,0.2)" : isLight ? "rgba(0,0,0,0.12)" : "#0bd1a2";
                            const r = isLight ? 8 : isGame ? 2 : 0;
                            ctx.beginPath();
                            if (r > 0 && ctx.roundRect) ctx.roundRect(0.5, 0.5, w - 1, h - 1, r);
                            else ctx.rect(0.5, 0.5, w - 1, h - 1);
                            ctx.fillStyle = bg;
                            ctx.fill();
                            ctx.strokeStyle = stroke;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                            ctx.font = font;
                            ctx.fillStyle = fg;
                            ctx.fillText(text, padX, h / 2 + 4);
                            e.dataTransfer.setDragImage(canvas, w / 2, h / 2);
                          }}
                          onDragEnd={() => {
                            dragRef.current = null;
                            setDragOverGroupId(null);
                          }}
                          className={cn(cardClass, "p-3 relative group/card cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity")}
                        >
                          <button
                            onClick={() => {
                              setActiveGroupId(group.id);
                              setGroups((prev) =>
                                prev.map((g) => {
                                  if (g.id !== group.id) return g;
                                  const next = new Set(g.selectedIds);
                                  next.delete(drep.drepId);
                                  return { ...g, selectedIds: next };
                                })
                              );
                            }}
                            className={cn(
                              "absolute top-2 right-2 w-4 h-4 flex items-center justify-center rounded-full",
                              "opacity-0 group-hover/card:opacity-100 transition-opacity",
                              removeCardBtnClass
                            )}
                          >
                            <X className="h-2 w-2" />
                          </button>

                          <div className={cn("text-[10px] font-semibold truncate pr-5 mb-2", accentClass)}>
                            {drep.name ?? "Anonymous"}
                          </div>

                          <div className="grid gap-x-2 gap-y-0.5" style={{ gridTemplateColumns: "max-content max-content" }}>
                            {[
                              { label: t("listBuilderDelegated"), value: `${formatVotingPower(drep.votingPowerAda)} ₳` },
                              { label: t("listBuilderDelegators"), value: drep.delegatorCount?.toLocaleString() ?? "—" },
                              { label: t("listBuilderPowerPct"), value: `${totalVotingPower > 0 ? ((drep.votingPowerAda / totalVotingPower) * 100).toFixed(2) : "0.00"}%` },
                            ].map(({ label, value }) => (
                              <>
                                <span key={label + "_l"} className={metricLabelClass}>{label}</span>
                                <span key={label + "_v"} className={cn("text-[10px] font-medium tabular-nums", accentClass)}>{value}</span>
                              </>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
