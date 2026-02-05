import { useState, useCallback } from "react";
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
import {
  ANALYTICS_ENDPOINTS,
  type AnalyticsEndpointKey,
} from "@/services/analyticsApi";

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

export function AnalyticsTestPanel() {
  const [selectedEndpoint, setSelectedEndpoint] =
    useState<AnalyticsEndpointKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const handleFetch = useCallback(async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const endpoint = ANALYTICS_ENDPOINTS[selectedEndpoint];
      const result = await endpoint.fetch();
      setData(result);
      setLastFetched(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [selectedEndpoint]);

  const selectedInfo = selectedEndpoint
    ? ANALYTICS_ENDPOINTS[selectedEndpoint]
    : null;

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
            disabled={!selectedEndpoint || loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Loading..." : "Fetch Data"}
          </Button>
        </div>

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
