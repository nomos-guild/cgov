# cgov: Architecture Decisions

Recommendations for extending the existing cgov codebase.

## Current Stack (Already Implemented)

✅ Next.js 15.0.3 + React 18 + TypeScript 5
✅ Next.js Pages Router
✅ Redux Toolkit (state management)
✅ Radix UI + Tailwind CSS (shadcn/ui components)
✅ date-fns
✅ lucide-react
✅ Mesh SDK (Cardano integration)

## Needed Implementations

### 1. Data Fetching: Next.js API Routes + Backend

Replace mock data with Next.js API routes and backend integration.

```typescript
// src/pages/api/governance/actions.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { type, status } = req.query;

  try {
    // Fetch from backend or blockchain
    const actions = await fetchGovernanceActions({ type, status });
    res.status(200).json(actions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
}

// Client-side data fetching in pages
export async function getServerSideProps() {
  const res = await fetch(`${process.env.API_BASE_URL}/governance/actions`);
  const actions = await res.json();

  return {
    props: { actions }
  };
}
```

### 2. Blockchain Integration: Mesh SDK + Blockfrost

Use Mesh SDK (already installed) for Cardano blockchain integration.

```typescript
// src/lib/cardano.ts
import { BlockfrostProvider } from '@meshsdk/core';

const blockfrostApiKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || '';
const network = process.env.NEXT_PUBLIC_NETWORK || 'preprod';

export const provider = new BlockfrostProvider(blockfrostApiKey);

export async function fetchGovernanceActions() {
  // Use Mesh SDK to interact with Cardano blockchain
  // Implementation depends on specific governance queries needed
}

// src/pages/api/governance/actions.ts
import { provider } from '@/lib/cardano';

export default async function handler(req, res) {
  const cached = await db.governanceActions.findCached();
  if (cached) return res.json(cached);

  const actions = await fetchGovernanceActions();
  await db.governanceActions.upsert(actions);
  res.json(actions);
}
```

**Provider**: Blockfrost via Mesh SDK (50 req/s free)

### 3. IPFS Integration: Gateway Conversion

```typescript
// src/lib/ipfs.ts
const GATEWAYS = ["https://ipfs.io/ipfs/", "https://cloudflare-ipfs.com/ipfs/"];

export const ipfsToHttp = (ipfsUrl: string): string => {
  if (!ipfsUrl.startsWith("ipfs://")) return ipfsUrl;
  return ipfsUrl.replace("ipfs://", GATEWAYS[0]);
};

export const fetchFromIpfs = async (ipfsUrl: string): Promise<string> => {
  for (const gateway of GATEWAYS) {
    try {
      const httpUrl = ipfsUrl.replace("ipfs://", gateway);
      const res = await fetch(httpUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return await res.text();
    } catch (error) {
      continue;
    }
  }
  throw new Error("All IPFS gateways failed");
};
```

### 4. Date Handling: Cardano Epochs

```typescript
// src/lib/cardanoTime.ts
import { addDays, format, formatDistanceToNow } from "date-fns";

const SHELLEY_START = new Date("2020-07-29T21:44:51Z");
const EPOCH_LENGTH_DAYS = 5;

export const epochToDate = (epoch: number): Date =>
  addDays(SHELLEY_START, epoch * EPOCH_LENGTH_DAYS);

export const formatEpoch = (epoch: number): string =>
  format(epochToDate(epoch), "MMM d, yyyy");

export const epochTimeUntil = (epoch: number): string =>
  formatDistanceToNow(epochToDate(epoch), { addSuffix: true });
```

### 5. Number Formatting: ADA Amounts

```typescript
// src/lib/format.ts
export const formatAda = (ada: number | string, compact = false): string => {
  const num = typeof ada === "string" ? parseFloat(ada) : ada;

  if (compact && num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M ₳`;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(num);

  return `${formatted} ₳`;
};

export const formatPercent = (percent: number): string =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    style: "percent",
  }).format(percent / 100);
```

### 6. Markdown Rendering

```bash
npm install react-markdown remark-gfm
```

```typescript
// src/components/Markdown.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Markdown = ({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: (props) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
      p: (props) => <p className="mb-4 leading-7" {...props} />,
      a: (props) => (
        <a
          className="text-primary hover:underline"
          target="_blank"
          {...props}
        />
      ),
    }}>
    {content}
  </ReactMarkdown>
);
```

### 7. Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">
            {this.state.error?.message}
          </p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 8. Testing

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});

// src/test/setup.ts
import "@testing-library/jest-dom";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

### 9. Code Splitting

Next.js automatically handles code splitting for pages. For component-level code splitting:

```typescript
// src/pages/index.tsx
import dynamic from 'next/dynamic';

const GovernanceTable = dynamic(() => import('@/components/GovernanceTable'), {
  loading: () => <div>Loading...</div>,
  ssr: false, // Disable SSR for this component if needed
});

export default function Home() {
  return (
    <div>
      <GovernanceTable />
    </div>
  );
}
```

### 10. Environment Config

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_BLOCKFROST_API_KEY=your_key_here
NEXT_PUBLIC_NETWORK=preprod
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/

# Server-only variables (no NEXT_PUBLIC prefix)
DATABASE_URL=postgresql://user:pass@localhost:5432/cgov
BLOCKFROST_API_KEY=your_key_here
```

```typescript
// src/config/env.ts
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api",
  blockfrostApiKey: process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || "",
  network: process.env.NEXT_PUBLIC_NETWORK || "preprod",
  ipfsGateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs/",
} as const;
```

## Implementation Roadmap

### Phase 1: Foundation

1. Environment config
2. Utility functions (epoch, formatting, IPFS)
3. Error boundaries
4. Lazy route loading

### Phase 2: Backend

5. Next.js API routes setup
6. Mesh SDK + Blockfrost integration
7. PostgreSQL setup
8. Data fetching with getServerSideProps/getStaticProps

### Phase 3: Features

9. Replace mock data with API
10. Markdown rendering
11. IPFS fetching
12. Tests
