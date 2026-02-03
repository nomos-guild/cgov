---
name: add-api-route
version: 1.1.0
created: 2026-02-02
last-evolved: 2026-02-03
evolution-count: 1
feedback-count: 0
description: Create Next.js API routes for backend proxies or third-party API integrations with caching and error handling.
argument-hint: [routePath] [backendEndpoint]
allowed-tools: Read, Edit, Write, Glob
---

# Add API Route

Create a new Next.js API route that proxies to the backend with proper authentication and error handling.

## Arguments

- `$0` - Route path relative to pages/api (e.g., `voters/stats` creates `pages/api/voters/stats.ts`)
- `$1` - Backend endpoint path (e.g., `/api/voters/statistics`)

## Instructions

### Step 1: Create API Route

Create file at `src/pages/api/${$0}.ts` (or `src/pages/api/${$0}/index.ts` for directory routes):

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await callApi({
      endpoint: "${$1}",
      method: "GET",
    });

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("${$0} API error:", error);
    return res.status(500).json({ error: "Failed to fetch data" });
  }
}
```

### Step 2: For Dynamic Routes

If the route has parameters (e.g., `voters/[id].ts`):

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID parameter" });
  }

  try {
    const response = await callApi({
      endpoint: `/api/voters/${id}`,
      method: "GET",
    });

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Voter detail API error:", error);
    return res.status(500).json({ error: "Failed to fetch voter data" });
  }
}
```

### Step 3: Add Service Function (Optional)

If this data will be used by components, add a service function in `src/services/api.ts`:

```typescript
export async function fetch${PascalCaseName}(): Promise<${TypeName}> {
  return fetchApi<${TypeName}>("/api/${$0}");
}
```

### Cache Header Guidelines

Adjust `s-maxage` based on data freshness needs:
- **60s** - Standard for most governance data
- **300s** - For slowly changing data (NCL, historical)
- **10s** - For frequently updated data (live votes)

## File Structure Examples

| Route | Creates |
|-------|---------|
| `voters` | `src/pages/api/voters.ts` |
| `voters/stats` | `src/pages/api/voters/stats.ts` |
| `voters/[id]` | `src/pages/api/voters/[id].ts` |
| `proposals/[hash]/votes` | `src/pages/api/proposals/[hash]/votes.ts` |

## After Creation

1. Test the endpoint with `curl http://localhost:3000/api/${$0}`
2. Check backend connectivity
3. Verify caching headers in browser DevTools

---

## Third-Party API Integration (Alternative Pattern)

For routes that call external APIs (not the backend), use this pattern with server-side caching:

### Step 1: Create Route with In-Memory Cache

```typescript
import type { NextApiRequest, NextApiResponse } from "next";

const EXTERNAL_API_URL = "https://api.example.com/v1/endpoint";

// Server-side cache (shared across all users on same instance)
const serverCache = new Map<string, string>();

// Track in-flight requests to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<string>>();

// Simple hash for cache keys
function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return String(Math.abs(hash));
}

// Limit cache size to prevent memory issues
function pruneCache() {
  if (serverCache.size > 1000) {
    const keysToDelete = Array.from(serverCache.keys()).slice(0, 200);
    keysToDelete.forEach(key => serverCache.delete(key));
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.EXTERNAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Service not configured" });
  }

  const { input } = req.body;
  const cacheKey = hashKey(input);

  // Check server cache first
  const cached = serverCache.get(cacheKey);
  if (cached) {
    return res.status(200).json({ result: cached, cached: true });
  }

  // Check if there's already an in-flight request for this input
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    try {
      const result = await inFlight;
      return res.status(200).json({ result, cached: true });
    } catch {
      return res.status(500).json({ error: "Request failed" });
    }
  }

  // Create API call promise and track it
  const apiPromise = callExternalAPI(input, apiKey);
  inFlightRequests.set(cacheKey, apiPromise);

  try {
    const result = await apiPromise;

    // Cache the result
    serverCache.set(cacheKey, result);
    pruneCache();

    // Clean up in-flight tracker
    inFlightRequests.delete(cacheKey);

    return res.status(200).json({ result });
  } catch (error) {
    inFlightRequests.delete(cacheKey);
    console.error("External API error:", error);
    return res.status(500).json({ error: "Service error" });
  }
}

async function callExternalAPI(input: string, apiKey: string): Promise<string> {
  const response = await fetch(EXTERNAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}
```

### Key Benefits of This Pattern

| Feature | Benefit |
|---------|---------|
| Server-side cache | All users share same cache (1 API call per unique input) |
| In-flight deduplication | Parallel requests for same input share one API call |
| Cache pruning | Prevents memory issues on long-running servers |
| Env var for API key | Keeps secrets server-side |

### When to Use This Pattern

- External translation APIs (DeepL, Google Translate)
- AI/ML inference APIs
- Rate-limited third-party services
- Any API where multiple users might request the same data
