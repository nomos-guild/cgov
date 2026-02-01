---
name: add-api-route
description: Create a new Next.js API route with authentication, error handling, and caching. Use when adding backend proxy endpoints.
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
