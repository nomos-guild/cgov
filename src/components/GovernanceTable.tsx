import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoteProgress } from "@/components/ui/vote-progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  setSelectedTypes,
  setSelectedStatuses,
  STATUS_OPTIONS,
} from "@/store/governanceSlice";
import type {
  GovernanceAction,
  ProposalType,
  ProposalStatus,
} from "@/types/governance";
import { PROPOSAL_TYPES } from "@/types/governance";
import { ChevronDown, Search } from "lucide-react";
import {
  parseNumeric,
  deriveAbstainValue,
  deriveCcAbstainCount,
} from "@/lib/voteMath";
// import { VoteButtons } from "@/components/governance/VoteButtons";

const TYPE_LABELS: Record<ProposalType, string> = {
  NoConfidence: "Motion of No-Confidence",
  UpdateCommittee: "Update Committee / Terms",
  NewConstitution: "Constitution Update",
  HardForkInitiation: "Hard Fork Initiation",
  ParameterChange: "Protocol Parameter Change",
  Treasury: "Treasury Withdrawal",
  InfoAction: "Info Action",
};

const SHOWCASE_ORDER: ProposalType[] = [
  "NoConfidence",
  "UpdateCommittee",
  "NewConstitution",
  "HardForkInitiation",
  "ParameterChange",
  "Treasury",
  "InfoAction",
];

/**
 * Map API type labels (e.g. "Update Committee", "Info Action") to the
 * internal ProposalType keys used by filters and eligibility logic.
 */
function mapTypeLabelToProposalType(typeLabel: string): ProposalType | null {
  const normalized = typeLabel.trim().toLowerCase();

  switch (normalized) {
    case "no confidence":
      return "NoConfidence";
    case "update committee":
      return "UpdateCommittee";
    case "new constitution":
      return "NewConstitution";
    case "hard fork initiation":
      return "HardForkInitiation";
    case "protocol parameter change":
      return "ParameterChange";
    case "treasury withdrawals":
    case "treasury withdrawal":
      return "Treasury";
    case "info action":
      return "InfoAction";
    default:
      return null;
  }
}

const STATUS_LABELS: Record<ProposalStatus, string> = {
  Active: "Active",
  Ratified: "Ratified",
  Enacted: "Enacted",
  Expired: "Expired",
  Closed: "Closed",
};

function getStatusColor(status: GovernanceAction["status"]): string {
  return status === "Active" ? "text-foreground" : "text-foreground/60";
}

function getTypeLabel(type: GovernanceAction["type"]): string {
  // Prefer mapping from API label → internal key → display label
  const mapped = mapTypeLabelToProposalType(type as string);
  if (mapped && mapped in TYPE_LABELS) {
    return TYPE_LABELS[mapped];
  }

  // Fallback: if we already have an internal key, use that
  if (type in TYPE_LABELS) {
    return TYPE_LABELS[type as ProposalType];
  }

  // Last resort: show whatever the backend sent
  return type;
}

export function GovernanceTable() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((state) => state.governance.actions);
  const selectedTypes =
    useAppSelector((state) => state.governance.filters?.selectedTypes) ??
    PROPOSAL_TYPES;
  const selectedStatuses =
    useAppSelector((state) => state.governance.filters?.selectedStatuses) ??
    STATUS_OPTIONS;
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const isAllSelected = selectedTypes.length === PROPOSAL_TYPES.length;
  const isAllStatusesSelected =
    selectedStatuses.length === STATUS_OPTIONS.length;

  useEffect(() => {
    if (!isFilterMenuOpen && !isStatusMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setIsFilterMenuOpen(false);
      }
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target as Node)
      ) {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterMenuOpen, isStatusMenuOpen]);

  const handleToggleFilterMenu = useCallback(() => {
    setIsFilterMenuOpen((prev) => !prev);
    setIsStatusMenuOpen(false);
  }, []);

  const handleToggleStatusMenu = useCallback(() => {
    setIsStatusMenuOpen((prev) => !prev);
    setIsFilterMenuOpen(false);
  }, []);

  const handleTriggerPointerDown = useCallback(
    (event: React.PointerEvent, toggle: () => void) => {
      event.preventDefault(); // avoid focus jumps that feel laggy
      toggle();
    },
    []
  );

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent, toggle: () => void) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape") {
        setIsFilterMenuOpen(false);
        setIsStatusMenuOpen(false);
      }
    },
    []
  );

  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => {
      // Sort by submission epoch (newest first)
      // Higher epoch number = newer proposal
      const epochA = a.submissionEpoch ?? 0;
      const epochB = b.submissionEpoch ?? 0;
      
      // Primary sort: submission epoch descending (newest first)
      if (epochA !== epochB) {
        return epochB - epochA;
      }
      
      // Secondary sort: if same submission epoch, sort by expiry epoch descending
      return (b.expiryEpoch ?? 0) - (a.expiryEpoch ?? 0);
    });
  }, [actions]);

  const filteredActions = useMemo(() => {
    if (!sortedActions.length) return [];
    const selectionSet = new Set(selectedTypes);
    const statusSet = new Set<string>(selectedStatuses);

    const applySearch = (list: GovernanceAction[]) => {
      if (!searchQuery.trim()) return list;
      const q = searchQuery.toLowerCase();
      return list.filter((action) => action.title.toLowerCase().includes(q));
    };

    // Filter by status first.
    // When all statuses are selected (default), don't filter by status so that
    // any new/unknown statuses from the API (e.g. "Enacted", "Closed") are still shown.
    const statusFiltered =
      isAllStatusesSelected || selectedStatuses.length === 0
        ? sortedActions
        : sortedActions.filter((action) => statusSet.has(action.status));

    // Then filter by proposal type.
    // When all types are selected, include unknown / new types as well.
    const typeFiltered = statusFiltered.filter((action) => {
      const actionType = mapTypeLabelToProposalType(action.type as string);
      if (!actionType || !SHOWCASE_ORDER.includes(actionType)) {
        return selectionSet.size === PROPOSAL_TYPES.length;
      }
      return selectionSet.has(actionType);
    });

    // Finally, apply search over the remaining list.
    // This returns *all* matching proposals (no per-type limiting).
    return applySearch(typeFiltered);
  }, [
    sortedActions,
    selectedTypes,
    selectedStatuses,
    searchQuery,
    isAllStatusesSelected,
  ]);

  const handleToggleType = (type: ProposalType) => {
    const isChecked = selectedTypes.includes(type);
    const nextSelection = isChecked
      ? selectedTypes.filter((item) => item !== type)
      : [...selectedTypes, type];
    dispatch(setSelectedTypes(nextSelection));
  };

  const handleSelectAll = () => {
    dispatch(setSelectedTypes(PROPOSAL_TYPES));
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      handleSelectAll();
    } else {
      dispatch(setSelectedTypes([]));
    }
  };

  const handleToggleStatus = (status: ProposalStatus) => {
    const isChecked = selectedStatuses.includes(status);
    const nextSelection = isChecked
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status];
    dispatch(setSelectedStatuses(nextSelection));
  };

  const handleSelectAllStatuses = () => {
    dispatch(setSelectedStatuses(STATUS_OPTIONS));
  };

  const handleToggleAllStatuses = (checked: boolean) => {
    if (checked) {
      handleSelectAllStatuses();
    } else {
      dispatch(setSelectedStatuses([]));
    }
  };

  const handleRowClick = (hash: string) => {
    router.push(`/governance/${hash}`);
  };

  return (
    <div className="space-y-6">
      <div className="border-white/8 rounded-2xl border bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative max-w-md flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground z-10" />
            <Input
              placeholder="Search by proposal title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 filter-input"
            />
          </div>
          <div className="relative" ref={filterMenuRef}>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-h-0 px-3 py-2 text-sm btn-neon rounded-2xl hover:bg-black hover:text-white transition-none dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:rounded-none"
              aria-haspopup="true"
              aria-expanded={isFilterMenuOpen}
              onPointerDown={(e) =>
                handleTriggerPointerDown(e, handleToggleFilterMenu)
              }
              onKeyDown={(e) => handleTriggerKeyDown(e, handleToggleFilterMenu)}
            >
              Filter action types
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isFilterMenuOpen ? "rotate-180" : ""}`}
              />
            </Button>
            {isFilterMenuOpen ? (
              <div className="border-white/8 absolute left-0 z-20 mt-2 w-64 rounded-2xl border bg-[#faf9f6] p-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-black dark:shadow-none">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-transparent dark:text-[#0bd1a2]">
                  <span>Action Types</span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-primary hover:underline dark:text-[#0bd1a2]"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                      checked={isAllSelected}
                      onChange={(e) => handleToggleAll(e.target.checked)}
                    />
                    <span className="font-semibold text-foreground dark:text-[#0bd1a2]">All</span>
                  </label>
                  {SHOWCASE_ORDER.map((type) => {
                    const checked = selectedTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                          checked={checked}
                          onChange={() => handleToggleType(type)}
                        />
                        <span className="text-foreground dark:text-[#0bd1a2]">
                          {TYPE_LABELS[type]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative" ref={statusMenuRef}>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-h-0 px-3 py-2 text-sm btn-neon rounded-2xl hover:bg-black hover:text-white transition-none dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:rounded-none"
              aria-haspopup="true"
              aria-expanded={isStatusMenuOpen}
              onPointerDown={(e) =>
                handleTriggerPointerDown(e, handleToggleStatusMenu)
              }
              onKeyDown={(e) => handleTriggerKeyDown(e, handleToggleStatusMenu)}
            >
              Filter by status
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isStatusMenuOpen ? "rotate-180" : ""}`}
              />
            </Button>
            {isStatusMenuOpen ? (
              <div className="border-white/8 absolute left-0 z-20 mt-2 w-64 rounded-2xl border bg-[#faf9f6] p-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-black dark:shadow-none">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-transparent dark:text-[#0bd1a2]">
                  <span>Status</span>
                  <button
                    type="button"
                    onClick={handleSelectAllStatuses}
                    className="text-xs font-semibold text-primary hover:underline dark:text-[#0bd1a2]"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                      checked={isAllStatusesSelected}
                      onChange={(e) =>
                        handleToggleAllStatuses(e.target.checked)
                      }
                    />
                    <span className="font-semibold text-foreground dark:text-[#0bd1a2]">All</span>
                  </label>
                  {STATUS_OPTIONS.map((status) => {
                    const checked = selectedStatuses.includes(status);
                    return (
                      <label
                        key={status}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                          checked={checked}
                          onChange={() => handleToggleStatus(status)}
                        />
                        <span className="text-foreground dark:text-[#0bd1a2]">
                          {STATUS_LABELS[status]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {filteredActions.length === 0 ? (
        <div className="border-white/8 rounded-2xl border bg-[#faf9f6] p-12 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
          <p className="text-center text-muted-foreground">
            No governance actions found
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-[#faf9f6] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="proposal-header-row hover:bg-transparent">
                <TableHead className="w-[30px] px-0 text-center h-10 py-2">DRep</TableHead>
                <TableHead className="w-[30px] px-0 text-center h-10 py-2">SPO</TableHead>
                <TableHead className="w-[30px] px-0 text-center h-10 py-2">CC</TableHead>
                <TableHead className="border-l border-border/50 pl-4 h-10 py-2">Proposal Title</TableHead>
                <TableHead className="w-[180px] h-10 py-2">Action Type</TableHead>
                <TableHead className="w-[120px] h-10 py-2">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActions.map((action, index) => {
                const isFirstRow = index === 0;
                // Always show donuts when we have data, even if a role
                // isn't formally eligible for this proposal type.
                // Eligibility is used in other parts of the UI.
                const drepInfo = action.drep;
                const spoThreshold = action.threshold?.spoThreshold;
                const spoInfo =
                  spoThreshold !== null && spoThreshold !== undefined
                    ? action.spo
                    : undefined;
                const ccInfo = action.cc;

                const drepYesPercent = drepInfo?.yesPercent ?? 0;
                const drepNoPercent = drepInfo?.noPercent ?? 0;
                const drepAbstainPercent =
                  drepInfo?.abstainPercent ??
                  Math.max(0, 100 - drepYesPercent - drepNoPercent);
                const drepYesAda = parseNumeric(drepInfo?.yesAda);
                const drepNoAda = parseNumeric(drepInfo?.noAda);
                const drepAbstainAda = deriveAbstainValue(
                  drepYesAda,
                  drepYesPercent,
                  drepNoAda,
                  drepNoPercent,
                  drepInfo?.abstainPercent
                );

                const spoYesPercent = spoInfo?.yesPercent ?? 0;
                const spoNoPercent = spoInfo?.noPercent ?? 0;
                const spoAbstainPercent =
                  spoInfo?.abstainPercent ??
                  Math.max(0, 100 - spoYesPercent - spoNoPercent);
                const spoYesAda = parseNumeric(spoInfo?.yesAda);
                const spoNoAda = parseNumeric(spoInfo?.noAda);
                const spoAbstainAda = deriveAbstainValue(
                  spoYesAda,
                  spoYesPercent,
                  spoNoAda,
                  spoNoPercent,
                  spoAbstainPercent
                );

                const ccYesPercent = ccInfo?.yesPercent ?? 0;
                const ccNoPercent = ccInfo?.noPercent ?? 0;
                const ccAbstainPercent =
                  ccInfo?.abstainPercent ??
                  Math.max(0, 100 - ccYesPercent - ccNoPercent);
                const ccYesCount = ccInfo?.yesCount;
                const ccNoCount = ccInfo?.noCount;
                const ccAbstainCount =
                  ccInfo?.abstainCount ??
                  deriveCcAbstainCount(
                    ccYesCount,
                    ccNoCount,
                    ccYesPercent,
                    ccNoPercent,
                    ccAbstainPercent
                  );

                return (
                  <TableRow
                    key={action.proposalId ?? action.hash}
                    className={`proposal-row cursor-pointer transition-transform duration-300 ease-out transform-gpu hover:scale-[1.01] hover:bg-transparent dark:border-[#0bd1a2] dark:border-b ${
                      isFirstRow ? "first-row" : ""
                    }`}
                    onClick={() => handleRowClick(action.hash)}
                  >
                    <TableCell className="py-1 px-0">
                      {drepInfo ? (
                        <div
                          className="flex justify-center -mr-4"
                          style={{ overflow: "visible" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <VoteProgress
                            title="DRep"
                            titlePosition="center"
                            yesPercent={drepYesPercent}
                            noPercent={drepNoPercent}
                            abstainPercent={drepAbstainPercent}
                            yesValue={drepYesAda}
                            noValue={drepNoAda}
                            abstainValue={drepAbstainAda}
                            valueUnit="ada"
                            className="origin-center scale-[0.6]"
                            style={{ padding: "8px 10px 10px" }}
                            showTooltip={false}
                            animate={false}
                            interactive={false}
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-1 px-0">
                      {spoInfo ? (
                        <div
                          className="flex justify-center -mx-4"
                          style={{ overflow: "visible" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <VoteProgress
                            title="SPO"
                            titlePosition="center"
                            yesPercent={spoYesPercent}
                            noPercent={spoNoPercent || 0}
                            abstainPercent={spoAbstainPercent}
                            yesValue={spoYesAda}
                            noValue={spoNoAda}
                            abstainValue={spoAbstainAda}
                            valueUnit="ada"
                            className="origin-center scale-[0.6]"
                            style={{ padding: "8px 10px 10px" }}
                            showTooltip={false}
                            animate={false}
                            interactive={false}
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-1 px-0">
                      {ccInfo ? (
                        <div
                          className="flex justify-center -ml-4"
                          style={{ overflow: "visible" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <VoteProgress
                            title="CC"
                            titlePosition="center"
                            yesPercent={ccYesPercent}
                            noPercent={ccNoPercent || 0}
                            abstainPercent={ccAbstainPercent}
                            yesValue={ccYesCount}
                            noValue={ccNoCount}
                            abstainValue={ccAbstainCount}
                            valueUnit="count"
                            className="origin-center scale-[0.6]"
                            style={{ padding: "8px 10px 10px" }}
                            showTooltip={false}
                            animate={false}
                            interactive={false}
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-1 border-l border-border/50 pl-4">
                      <h3 className="text-base font-semibold dark:text-[#0bd1a2]">{action.title}</h3>
                    </TableCell>
                    <TableCell className="py-1">
                      <span className="text-xs uppercase tracking-wide font-semibold text-foreground dark:text-[#0bd1a2]">
                        {getTypeLabel(action.type)}
                      </span>
                    </TableCell>
                    <TableCell className="py-1">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide dark:text-[#0bd1a2]">
                        {action.status === "Active" && (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                          </span>
                        )}
                        <span className={getStatusColor(action.status)}>
                          {action.status}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
