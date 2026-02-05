import { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  ANALYTICS_ENDPOINTS,
  type AnalyticsEndpointKey,
} from "@/services/analyticsApi";
import type { AnalyticsQueryParams } from "@/types/analytics";

type EndpointCategory = (typeof ANALYTICS_ENDPOINTS)[AnalyticsEndpointKey]["category"];

interface EndpointOption {
  key: AnalyticsEndpointKey;
  name: string;
  description: string;
  category: EndpointCategory;
}

const endpointOptions: EndpointOption[] = Object.entries(ANALYTICS_ENDPOINTS).map(
  ([key, value]) => ({
    key: key as AnalyticsEndpointKey,
    name: value.name,
    description: value.description,
    category: value.category,
  })
);

const groupedEndpoints = endpointOptions.reduce(
  (acc, endpoint) => {
    if (!acc[endpoint.category]) {
      acc[endpoint.category] = [];
    }
    acc[endpoint.category].push(endpoint);
    return acc;
  },
  {} as Record<EndpointCategory, EndpointOption[]>
);

const categoryOrder: EndpointCategory[] = [
  "Ada Holder Participation",
  "DRep Insights & Activity",
  "SPO Governance Participation",
  "Governance Action & Treasury Health",
  "Constitutional Committee Activity",
  "Tooling & UX",
];

const DEFAULT_PARAMS: AnalyticsQueryParams = {
  page: undefined,
  pageSize: undefined,
  epochStart: undefined,
  epochEnd: undefined,
  status: undefined,
  governanceActionType: undefined,
  proposalId: undefined,
  drepId: undefined,
  drepId1: undefined,
  drepId2: undefined,
  limit: undefined,
  epoch: undefined,
  view: undefined,
  activeOnly: undefined,
  sortBy: undefined,
  sortOrder: undefined,
  topN: undefined,
  minSharedProposals: undefined,
  contentiousOnly: undefined,
  enactedOnly: undefined,
};

export function AnalyticsTestPanel() {
  const [selectedEndpoint, setSelectedEndpoint] =
    useState<AnalyticsEndpointKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);
  const [params, setParams] = useState<AnalyticsQueryParams>(DEFAULT_PARAMS);

  const selectedInfo = selectedEndpoint
    ? ANALYTICS_ENDPOINTS[selectedEndpoint]
    : null;

  type AnalyticsParamKey = keyof AnalyticsQueryParams;

  const supportedParams = useMemo<readonly AnalyticsParamKey[]>(() => {
    return (selectedInfo?.supportedParams ?? []) as readonly AnalyticsParamKey[];
  }, [selectedInfo]);

  const supports = useCallback(
    (key: AnalyticsParamKey) => supportedParams.includes(key),
    [supportedParams]
  );

  const isActiveValue = useCallback((value: unknown) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }, []);

  const updateParam = useCallback(
    <K extends keyof AnalyticsQueryParams>(
      key: K,
      value: AnalyticsQueryParams[K]
    ) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const clearParams = useCallback(() => {
    setParams(DEFAULT_PARAMS);
  }, []);

  const buildParams = useCallback((): AnalyticsQueryParams | undefined => {
    if (!selectedInfo) return undefined;

    const cleanParams: AnalyticsQueryParams = {};
    for (const key of supportedParams) {
      const value = params[key];
      if (!isActiveValue(value)) continue;
      (cleanParams as Record<string, unknown>)[key] = value;
    }

    return Object.keys(cleanParams).length > 0 ? cleanParams : undefined;
  }, [params, selectedInfo, supportedParams, isActiveValue]);

  const activeParamCount = useMemo(() => {
    return supportedParams.filter((key) => isActiveValue(params[key])).length;
  }, [supportedParams, params, isActiveValue]);

  const validationErrors = useMemo(() => {
    if (!selectedEndpoint) return [] as string[];

    const errors: string[] = [];

    const validateInteger = (
      key: keyof AnalyticsQueryParams,
      label: string,
      constraints: { min?: number; max?: number } = {}
    ) => {
      if (!supports(key)) return;
      const value = params[key];
      if (!isActiveValue(value)) return;
      if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
        errors.push(`${label} must be an integer`);
        return;
      }
      if (constraints.min !== undefined && value < constraints.min) {
        errors.push(`${label} must be >= ${constraints.min}`);
      }
      if (constraints.max !== undefined && value > constraints.max) {
        errors.push(`${label} must be <= ${constraints.max}`);
      }
    };

    validateInteger("page", "Page", { min: 1 });
    validateInteger("pageSize", "Page Size", { min: 1, max: 100 });
    validateInteger("epochStart", "Epoch Start", { min: 0 });
    validateInteger("epochEnd", "Epoch End", { min: 0 });
    validateInteger("epoch", "Epoch", { min: 0 });
    validateInteger("limit", "Limit", { min: 1 });
    validateInteger("topN", "Top N", { min: 1 });
    validateInteger("minSharedProposals", "Min Shared Proposals", { min: 0 });

    if (supports("epochStart") && supports("epochEnd")) {
      const epochStart = params.epochStart;
      const epochEnd = params.epochEnd;
      if (
        typeof epochStart === "number" &&
        typeof epochEnd === "number" &&
        Number.isFinite(epochStart) &&
        Number.isFinite(epochEnd) &&
        epochStart > epochEnd
      ) {
        errors.push("Epoch Start must be <= Epoch End");
      }
    }

    if (supports("drepId1") && supports("drepId2")) {
      const drepId1 = params.drepId1;
      const drepId2 = params.drepId2;
      const has1 = typeof drepId1 === "string" && drepId1.trim().length > 0;
      const has2 = typeof drepId2 === "string" && drepId2.trim().length > 0;
      if ((has1 && !has2) || (!has1 && has2)) {
        errors.push("Provide both DRep ID 1 and DRep ID 2 (or neither)");
      }
    }

    return errors;
  }, [selectedEndpoint, params, supports, isActiveValue]);

  const handleFetch = useCallback(async () => {
    if (!selectedEndpoint) return;
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const endpoint = ANALYTICS_ENDPOINTS[selectedEndpoint];
      const fetchParams = buildParams();
      const result = await endpoint.fetch(fetchParams as never);
      setData(result);
      setLastFetched(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [selectedEndpoint, buildParams, validationErrors]);

  const canFetch = Boolean(selectedEndpoint) && !loading && validationErrors.length === 0;

  const showPagination = supports("page") || supports("pageSize");
  const showEpochRange = supports("epochStart") || supports("epochEnd");
  const showStatus = supports("status");
  const showGovernanceActionType = supports("governanceActionType");
  const showProposalId = supports("proposalId");
  const showDrepId = supports("drepId");
  const showDrepPair = supports("drepId1") || supports("drepId2");
  const showLimit = supports("limit");
  const showEpoch = supports("epoch");
  const showView = supports("view");
  const showActiveOnly = supports("activeOnly");
  const showSorting = supports("sortBy") || supports("sortOrder");
  const showTopN = supports("topN");
  const showMinSharedProposals = supports("minSharedProposals");
  const showContentiousOnly = supports("contentiousOnly");
  const showEnactedOnly = supports("enactedOnly");

  const sortByOptions = useMemo(() => {
    if (!selectedEndpoint) return null;
    switch (selectedEndpoint) {
      case "drepActivityRate":
        return [
          { value: "activityRate", label: "activityRate" },
          { value: "proposalsVoted", label: "proposalsVoted" },
          { value: "name", label: "name" },
        ] as const;
      case "drepRationaleRate":
        return [
          { value: "rationaleRate", label: "rationaleRate" },
          { value: "totalVotes", label: "totalVotes" },
          { value: "name", label: "name" },
        ] as const;
      default:
        return null;
    }
  }, [selectedEndpoint]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Analytics API Test Panel</CardTitle>
        <CardDescription>
          Select an analytics endpoint and fetch data to test the API
          integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label
              htmlFor="endpoint-select"
              className="text-sm font-medium text-foreground"
            >
              Select Endpoint
            </label>
            <Select
              value={selectedEndpoint ?? undefined}
              onValueChange={(value) =>
                setSelectedEndpoint(value as AnalyticsEndpointKey)
              }
            >
              <SelectTrigger id="endpoint-select" className="w-full">
                <SelectValue placeholder="Choose an analytics endpoint..." />
              </SelectTrigger>
              <SelectContent>
                {categoryOrder.map((category) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground">
                      {category}
                    </SelectLabel>
                    {groupedEndpoints[category]?.map((endpoint) => (
                      <SelectItem key={endpoint.key} value={endpoint.key}>
                        {endpoint.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleFetch}
            disabled={!canFetch}
            className="w-full sm:w-auto"
          >
            {loading ? "Loading..." : "Fetch Data"}
          </Button>
        </div>

        {validationErrors.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">Fix query parameters</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">
              {validationErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {selectedInfo && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm">
              <span className="font-medium">Endpoint:</span> {selectedInfo.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedInfo.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Category: {selectedInfo.category}
            </p>
          </div>
        )}

        {/* Parameters Section */}
        <div className="rounded-md border">
          <button
            type="button"
            onClick={() => setShowParams(!showParams)}
            className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              Query Parameters (Optional)
              {activeParamCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {activeParamCount}
                </span>
              )}
            </span>
            {showParams ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {showParams && (
            <div className="border-t p-4 space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearParams}
                  className="text-xs"
                >
                  Clear All
                </Button>
              </div>

              {supportedParams.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This endpoint does not accept query parameters.
                </p>
              )}

              {/* Pagination */}
              {showPagination && (
                <div className="grid grid-cols-2 gap-4">
                  {supports("page") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-page" className="text-xs">
                        Page
                      </Label>
                      <Input
                        id="param-page"
                        type="number"
                        min={1}
                        placeholder="1"
                        value={params.page ?? ""}
                        onChange={(e) =>
                          updateParam(
                            "page",
                            e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined
                          )
                        }
                      />
                    </div>
                  )}
                  {supports("pageSize") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-pageSize" className="text-xs">
                        Page Size
                      </Label>
                      <Input
                        id="param-pageSize"
                        type="number"
                        min={1}
                        max={100}
                        placeholder="20"
                        value={params.pageSize ?? ""}
                        onChange={(e) =>
                          updateParam(
                            "pageSize",
                            e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Epoch Range */}
              {showEpochRange && (
                <div className="grid grid-cols-2 gap-4">
                  {supports("epochStart") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-epochStart" className="text-xs">
                        Epoch Start
                      </Label>
                      <Input
                        id="param-epochStart"
                        type="number"
                        min={0}
                        placeholder="e.g., 500"
                        value={params.epochStart ?? ""}
                        onChange={(e) =>
                          updateParam(
                            "epochStart",
                            e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined
                          )
                        }
                      />
                    </div>
                  )}
                  {supports("epochEnd") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-epochEnd" className="text-xs">
                        Epoch End
                      </Label>
                      <Input
                        id="param-epochEnd"
                        type="number"
                        min={0}
                        placeholder="e.g., 520"
                        value={params.epochEnd ?? ""}
                        onChange={(e) =>
                          updateParam(
                            "epochEnd",
                            e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Status */}
              {showStatus && (
                <div className="space-y-2">
                  <Label htmlFor="param-status" className="text-xs">
                    Status (comma-separated)
                  </Label>
                  <Input
                    id="param-status"
                    type="text"
                    placeholder="e.g., Active,Ratified,Enacted"
                    value={params.status?.join(",") ?? ""}
                    onChange={(e) =>
                      updateParam(
                        "status",
                        e.target.value
                          ? e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : undefined
                      )
                    }
                  />
                </div>
              )}

              {/* Governance Action Type */}
              {showGovernanceActionType && (
                <div className="space-y-2">
                  <Label htmlFor="param-governanceActionType" className="text-xs">
                    Governance Action Type (comma-separated)
                  </Label>
                  <Input
                    id="param-governanceActionType"
                    type="text"
                    placeholder="e.g., HardForkInitiation,ParameterChange"
                    value={params.governanceActionType?.join(",") ?? ""}
                    onChange={(e) =>
                      updateParam(
                        "governanceActionType",
                        e.target.value
                          ? e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : undefined
                      )
                    }
                  />
                </div>
              )}

              {/* Proposal ID */}
              {showProposalId && (
                <div className="space-y-2">
                  <Label htmlFor="param-proposalId" className="text-xs">
                    Proposal ID
                  </Label>
                  <Input
                    id="param-proposalId"
                    type="text"
                    placeholder="e.g., abc123...#0"
                    value={params.proposalId ?? ""}
                    onChange={(e) =>
                      updateParam("proposalId", e.target.value || undefined)
                    }
                  />
                </div>
              )}

              {/* DRep IDs */}
              {showDrepId && (
                <div className="space-y-2">
                  <Label htmlFor="param-drepId" className="text-xs">
                    DRep ID
                  </Label>
                  <Input
                    id="param-drepId"
                    type="text"
                    placeholder="DRep ID for filtering"
                    value={params.drepId ?? ""}
                    onChange={(e) =>
                      updateParam("drepId", e.target.value || undefined)
                    }
                  />
                </div>
              )}

              {showDrepPair && (
                <div className="grid grid-cols-2 gap-4">
                  {supports("drepId1") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-drepId1" className="text-xs">
                        DRep ID 1 (for correlation)
                      </Label>
                      <Input
                        id="param-drepId1"
                        type="text"
                        placeholder="First DRep"
                        value={params.drepId1 ?? ""}
                        onChange={(e) =>
                          updateParam("drepId1", e.target.value || undefined)
                        }
                      />
                    </div>
                  )}
                  {supports("drepId2") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-drepId2" className="text-xs">
                        DRep ID 2 (for correlation)
                      </Label>
                      <Input
                        id="param-drepId2"
                        type="text"
                        placeholder="Second DRep"
                        value={params.drepId2 ?? ""}
                        onChange={(e) =>
                          updateParam("drepId2", e.target.value || undefined)
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Epoch (snapshot) */}
              {showEpoch && (
                <div className="space-y-2">
                  <Label htmlFor="param-epoch" className="text-xs">
                    Epoch
                  </Label>
                  <Input
                    id="param-epoch"
                    type="number"
                    min={0}
                    placeholder="e.g., 520"
                    value={params.epoch ?? ""}
                    onChange={(e) =>
                      updateParam(
                        "epoch",
                        e.target.value ? parseInt(e.target.value, 10) : undefined
                      )
                    }
                  />
                </div>
              )}

              {/* View */}
              {showView && (
                <div className="space-y-2">
                  <Label htmlFor="param-view" className="text-xs">
                    View
                  </Label>
                  <Select
                    value={params.view ?? "none"}
                    onValueChange={(value) =>
                      updateParam(
                        "view",
                        value === "none" ? undefined : (value as "proposals" | "epochs" | "both")
                      )
                    }
                  >
                    <SelectTrigger id="param-view">
                      <SelectValue placeholder="both" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      <SelectItem value="both">both</SelectItem>
                      <SelectItem value="proposals">proposals</SelectItem>
                      <SelectItem value="epochs">epochs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Active Only */}
              {showActiveOnly && (
                <div className="space-y-2">
                  <Label htmlFor="param-activeOnly" className="text-xs">
                    Active Only
                  </Label>
                  <Select
                    value={
                      params.activeOnly === undefined
                        ? "none"
                        : params.activeOnly
                          ? "true"
                          : "false"
                    }
                    onValueChange={(value) =>
                      updateParam(
                        "activeOnly",
                        value === "none" ? undefined : value === "true"
                      )
                    }
                  >
                    <SelectTrigger id="param-activeOnly">
                      <SelectValue placeholder="true" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sorting */}
              {showSorting && (
                <div className="grid grid-cols-2 gap-4">
                  {supports("sortBy") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-sortBy" className="text-xs">
                        Sort By
                      </Label>
                      {sortByOptions ? (
                        <Select
                          value={params.sortBy ?? "none"}
                          onValueChange={(value) =>
                            updateParam(
                              "sortBy",
                              value === "none" ? undefined : value
                            )
                          }
                        >
                          <SelectTrigger id="param-sortBy">
                            <SelectValue placeholder={sortByOptions[0].value} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Default</SelectItem>
                            {sortByOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="param-sortBy"
                          type="text"
                          placeholder="e.g., activityRate"
                          value={params.sortBy ?? ""}
                          onChange={(e) =>
                            updateParam("sortBy", e.target.value || undefined)
                          }
                        />
                      )}
                    </div>
                  )}
                  {supports("sortOrder") && (
                    <div className="space-y-2">
                      <Label htmlFor="param-sortOrder" className="text-xs">
                        Sort Order
                      </Label>
                      <Select
                        value={params.sortOrder ?? "none"}
                        onValueChange={(value) =>
                          updateParam(
                            "sortOrder",
                            value === "none" ? undefined : (value as "asc" | "desc")
                          )
                        }
                      >
                        <SelectTrigger id="param-sortOrder">
                          <SelectValue placeholder="desc" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default</SelectItem>
                          <SelectItem value="asc">asc</SelectItem>
                          <SelectItem value="desc">desc</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Correlation options */}
              {(showTopN || showMinSharedProposals) && (
                <div className="grid grid-cols-2 gap-4">
                  {showTopN && (
                    <div className="space-y-2">
                      <Label htmlFor="param-topN" className="text-xs">
                        Top N
                      </Label>
                      <Input
                        id="param-topN"
                        type="number"
                        min={1}
                        placeholder="10"
                        value={params.topN ?? ""}
                        onChange={(e) =>
                          updateParam(
                            "topN",
                            e.target.value ? parseInt(e.target.value, 10) : undefined
                          )
                        }
                      />
                    </div>
                  )}
                  {showMinSharedProposals && (
                    <div className="space-y-2">
                      <Label htmlFor="param-minSharedProposals" className="text-xs">
                        Min Shared Proposals
                      </Label>
                      <Input
                        id="param-minSharedProposals"
                        type="number"
                        min={0}
                        placeholder="3"
                        value={params.minSharedProposals ?? ""}
                        onChange={(e) =>
                          updateParam(
                            "minSharedProposals",
                            e.target.value ? parseInt(e.target.value, 10) : undefined
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Limit */}
              {showLimit && (
                <div className="space-y-2">
                  <Label htmlFor="param-limit" className="text-xs">
                    Limit
                  </Label>
                  <Input
                    id="param-limit"
                    type="number"
                    min={1}
                    placeholder="e.g., 50"
                    value={params.limit ?? ""}
                    onChange={(e) =>
                      updateParam(
                        "limit",
                        e.target.value ? parseInt(e.target.value, 10) : undefined
                      )
                    }
                  />
                </div>
              )}

              {/* Boolean flags */}
              {(showContentiousOnly || showEnactedOnly) && (
                <div className="grid grid-cols-2 gap-4">
                  {showContentiousOnly && (
                    <div className="space-y-2">
                      <Label htmlFor="param-contentiousOnly" className="text-xs">
                        Contentious Only
                      </Label>
                      <Select
                        value={
                          params.contentiousOnly === undefined
                            ? "none"
                            : params.contentiousOnly
                              ? "true"
                              : "false"
                        }
                        onValueChange={(value) =>
                          updateParam(
                            "contentiousOnly",
                            value === "none" ? undefined : value === "true"
                          )
                        }
                      >
                        <SelectTrigger id="param-contentiousOnly">
                          <SelectValue placeholder="false" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default</SelectItem>
                          <SelectItem value="true">true</SelectItem>
                          <SelectItem value="false">false</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {showEnactedOnly && (
                    <div className="space-y-2">
                      <Label htmlFor="param-enactedOnly" className="text-xs">
                        Enacted Only
                      </Label>
                      <Select
                        value={
                          params.enactedOnly === undefined
                            ? "none"
                            : params.enactedOnly
                              ? "true"
                              : "false"
                        }
                        onValueChange={(value) =>
                          updateParam(
                            "enactedOnly",
                            value === "none" ? undefined : value === "true"
                          )
                        }
                      >
                        <SelectTrigger id="param-enactedOnly">
                          <SelectValue placeholder="false" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default</SelectItem>
                          <SelectItem value="true">true</SelectItem>
                          <SelectItem value="false">false</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-destructive">
            <p className="text-sm font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {data !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Response</p>
              {lastFetched && (
                <p className="text-xs text-muted-foreground">
                  Fetched at {lastFetched}
                </p>
              )}
            </div>
            <div className="max-h-[500px] overflow-auto rounded-md bg-muted p-4">
              <pre className="text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AnalyticsTestPanel;
