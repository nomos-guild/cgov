import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoteProgress } from "@/components/ui/vote-progress";
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
import { VoteButtons } from "@/components/governance/VoteButtons";

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

const STATUS_LABELS: Record<ProposalStatus, string> = {
  Active: "Active",
  Ratified: "Ratified",
  Expired: "Expired",
  "Not approved": "Rejected",
  Approved: "Approved",
};

function getStatusColor(status: GovernanceAction["status"]): string {
  return status === "Active" ? "text-foreground" : "text-foreground/60";
}

/**
 * Parse proposal hash to extract txHash and certIndex for voting
 * Supports both "txHash:certIndex" and "txHash#certIndex" formats
 */
function parseProposalHash(
  hash: string
): { txHash: string; certIndex: number } | null {
  if (!hash) return null;

  if (hash.includes(":")) {
    const [txHash, certIndexStr] = hash.split(":");
    const certIndex = parseInt(certIndexStr, 10);
    if (txHash && !Number.isNaN(certIndex)) {
      return { txHash, certIndex };
    }
  }

  if (hash.includes("#")) {
    const [txHash, certIndexStr] = hash.split("#");
    const certIndex = parseInt(certIndexStr, 10);
    if (txHash && !Number.isNaN(certIndex)) {
      return { txHash, certIndex };
    }
  }

  return null;
}

function getTypeLabel(type: GovernanceAction["type"]): string {
  if (type in TYPE_LABELS) {
    return TYPE_LABELS[type as ProposalType];
  }
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

  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => {
      const epochA = a.submissionEpoch ?? 0;
      const epochB = b.submissionEpoch ?? 0;
      if (epochA === epochB) {
        return (b.expiryEpoch ?? 0) - (a.expiryEpoch ?? 0);
      }
      return epochB - epochA;
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

    // Filter by status first
    const statusFiltered = sortedActions.filter((action) =>
      statusSet.has(action.status)
    );

    const prioritized = SHOWCASE_ORDER.filter((type) =>
      selectionSet.has(type)
    ).map((type) => statusFiltered.find((action) => action.type === type));

    const dedupedPrioritized = prioritized.filter(
      (action): action is GovernanceAction => Boolean(action)
    );

    if (dedupedPrioritized.length) {
      if (selectionSet.size === PROPOSAL_TYPES.length) {
        const extras = statusFiltered.filter(
          (action) => !SHOWCASE_ORDER.includes(action.type as ProposalType)
        );
        return applySearch([...dedupedPrioritized, ...extras]);
      }
      return applySearch(dedupedPrioritized);
    }

    const baseFiltered = statusFiltered.filter((action) => {
      const actionType = action.type as ProposalType;
      if (!SHOWCASE_ORDER.includes(actionType)) {
        return selectionSet.size === PROPOSAL_TYPES.length;
      }
      return selectionSet.has(actionType);
    });

    return applySearch(baseFiltered);
  }, [sortedActions, selectedTypes, selectedStatuses, searchQuery]);

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
      <div className="border-white/8 rounded-2xl border bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
        <div className="mb-3 text-sm font-semibold text-foreground">
          Filters
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative" ref={filterMenuRef}>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-h-0 px-3 py-2 text-sm"
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
            >
              Filter action types
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isFilterMenuOpen ? "rotate-180" : ""}`}
              />
            </Button>
            {isFilterMenuOpen ? (
              <div className="border-white/8 absolute left-0 z-20 mt-2 w-64 rounded-2xl border bg-[#faf9f6] p-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Action Types</span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground"
                      checked={isAllSelected}
                      onChange={(e) => handleToggleAll(e.target.checked)}
                    />
                    <span className="font-semibold text-foreground">All</span>
                  </label>
                  {SHOWCASE_ORDER.map((type) => {
                    const checked = selectedTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground"
                          checked={checked}
                          onChange={() => handleToggleType(type)}
                        />
                        <span className="text-foreground">
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
              className="h-9 min-h-0 px-3 py-2 text-sm"
              onClick={() => setIsStatusMenuOpen((prev) => !prev)}
            >
              Filter by status
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isStatusMenuOpen ? "rotate-180" : ""}`}
              />
            </Button>
            {isStatusMenuOpen ? (
              <div className="border-white/8 absolute left-0 z-20 mt-2 w-64 rounded-2xl border bg-[#faf9f6] p-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Status</span>
                  <button
                    type="button"
                    onClick={handleSelectAllStatuses}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground"
                      checked={isAllStatusesSelected}
                      onChange={(e) =>
                        handleToggleAllStatuses(e.target.checked)
                      }
                    />
                    <span className="font-semibold text-foreground">All</span>
                  </label>
                  {STATUS_OPTIONS.map((status) => {
                    const checked = selectedStatuses.includes(status);
                    return (
                      <label
                        key={status}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground"
                          checked={checked}
                          onChange={() => handleToggleStatus(status)}
                        />
                        <span className="text-foreground">
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

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
        <Input
          placeholder="Search by proposal title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredActions.length === 0 ? (
        <div className="border-white/8 rounded-2xl border bg-[#faf9f6] p-12 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
          <p className="text-center text-muted-foreground">
            No governance actions found
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filteredActions.map((action) => {
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
              <div
                key={action.proposalId ?? action.hash}
                className="group cursor-pointer"
                onClick={() => handleRowClick(action.hash)}
              >
                <div className="py-4 transition-transform duration-300 group-hover:scale-[1.01] sm:py-6">
                  <div className="mb-4 flex flex-col gap-6 sm:mb-6 sm:flex-row sm:items-center sm:gap-8">
                    <div
                      className="flex flex-wrap items-center gap-4 sm:gap-6"
                      style={{
                        overflow: "visible",
                        background: "transparent",
                        border: "none",
                      }}
                    >
                      {drepInfo ? (
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
                          className="origin-center scale-75"
                        />
                      ) : null}
                      {ccInfo ? (
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
                          className="origin-center scale-75"
                        />
                      ) : null}
                      {spoInfo ? (
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
                          className="origin-center scale-75"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="border-white/8 min-w-0 flex-1 rounded-2xl border bg-[#faf9f6] px-4 py-3 text-base font-semibold shadow-[0_12px_30px_rgba(15,23,42,0.25)] sm:text-lg">
                        {action.title}
                      </h3>
                      <div className="flex w-fit flex-wrap items-center gap-2">
                        <div className="border-white/8 flex w-fit flex-wrap items-center gap-2 rounded-2xl border bg-[#faf9f6] px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
                          <span className="font-semibold text-foreground">
                            {getTypeLabel(action.type)}
                          </span>
                        </div>
                        <div className="border-white/8 flex w-fit items-center gap-2 rounded-2xl border bg-[#faf9f6] px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
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
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                    <div className="space-x-4">
                      <span>Submission: Epoch {action.submissionEpoch}</span>
                      <span>Expiry: Epoch {action.expiryEpoch}</span>
                    </div>
                    {action.status === "Active" &&
                      (() => {
                        const parsed = parseProposalHash(action.hash);
                        if (!parsed) return null;
                        return (
                          <VoteButtons
                            txHash={parsed.txHash}
                            certIndex={parsed.certIndex}
                            proposalTitle={action.title}
                            status={action.status}
                            compact
                          />
                        );
                      })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
