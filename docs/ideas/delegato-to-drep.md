# Delegate to DRep — Full Implementation Spec

## Overview

Add a feature allowing normal ADA holders to connect their wallet and delegate voting power to DReps directly through cgov. The on-chain delegation transaction is built and signed entirely on the **frontend** via MeshSDK + CIP-30 wallet. The **backend** provides a lookup endpoint so the frontend can display the user's current delegation.

---

# BACKEND (cgov-api)

> Repo: https://github.com/nomos-guild/cgov-api
> Local path: `w:\Coding\Nomos\cgov-api`
> **This section is the handoff spec for the backend agent.**

## What already exists

- **`StakeDelegationState`** table — maps `stakeAddress → drepId + amount + delegatedEpoch` (populated by existing cron job)
- **`Drep`** table — has all DRep details (name, votingPower, iconUrl, etc.)
- **Delegation sync service** (`src/services/ingestion/delegation-sync.service.ts`) — keeps delegation tables up-to-date via Koios API
- **No endpoint exists** to query a user's delegation by stake address

## New endpoint: `GET /dreps/my-delegation?stakeAddress=<stake_address>`

Returns the user's current DRep delegation from the `StakeDelegationState` table, enriched with DRep name/icon.

### Response shape

```json
{
  "stakeAddress": "stake1...",
  "delegatedTo": {
    "drepId": "drep1abc...",
    "name": "Some DRep",
    "iconUrl": "https://..."
  },
  "amount": "1234567890",
  "delegatedEpoch": 534
}
```

If not found → `"delegatedTo": null`.

### Files to create/modify

| File | Action | Description |
|------|--------|-------------|
| `src/controllers/drep/getMyDelegation.ts` | **Create** | Controller: validates stakeAddress, queries StakeDelegationState with Drep include, returns formatted response |
| `src/controllers/drep/index.ts` | **Modify** | Export new getMyDelegation |
| `src/routes/drep.route.ts` | **Modify** | Add `router.get("/my-delegation", ...)` **before** `/:drepId` route + OpenAPI JSDoc |
| `src/responses/drep.response.ts` | **Modify** | Add `GetMyDelegationResponse` type |

No database migrations needed.

---

# FRONTEND (cgov)

> Repo: https://github.com/nomos-guild/cgov
> Local path: `w:\Coding\Nomos\cgov`
> **This section is the handoff spec for the frontend agent.**

## Existing infrastructure to reuse

### Wallet connection (already working)
- **`MeshProviderWrapper`** (`src/components/providers/MeshProviderWrapper.tsx`) — wraps app with MeshProvider
- **`ConnectWalletButton`** (`src/components/wallet/ConnectWalletButton.tsx`) — handles connect/disconnect, shows wallet icon + address
- **`ConnectWalletModal`** (`src/components/wallet/ConnectWalletModal.tsx`) — CIP-30 wallet detection, connection UI
- **`useWallet()`** hook from `@meshsdk/react` — provides `connected`, `wallet`, `name`

### Transaction building reference (VoteOnProposal)
- **`VoteOnProposal`** (`src/components/governance/VoteOnProposal.tsx`) — exact pattern to follow for the delegation component. Uses `MeshTxBuilder`, wallet signing, error handling, success state.

### API proxy pattern
- **`callApi()`** (`src/utils/apiHelper.ts`) — server-side API helper that adds X-API-Key header
- All frontend API calls go through Next.js API routes at `src/pages/api/` → proxied to backend
- Example: `src/pages/api/dreps/[drepId]/index.ts` shows the standard pattern

### DRep profile page
- **`[drepId].tsx`** (`src/pages/drep/[drepId].tsx`) — DRep profile page where the delegate button will live
- Profile card starts at ~line 948, stats table at ~line 1009, "Additional Information" section at ~line 1122

### UI components
- `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription` from `@/components/ui/dialog`
- `Button` from `@/components/ui/button`
- `Card` from `@/components/ui/card`
- Icons: `Loader2`, `CheckCircle`, `AlertCircle` from `lucide-react`

### Theme system
- `useTheme()` from `@/lib/theme` — returns `activeTheme` with `.id` of `"light"`, `"dark"`, or `"game"`
- `cn()` from `@/lib/utils` — Tailwind class merging utility
- All components must style for 3 themes (see VoteOnProposal.tsx for pattern)

### i18n
- `useTranslations()` from `next-intl`
- 7 locale files in `src/messages/`: en, de, fr, es, pt, ja, zh

### Dependencies already installed
- `@meshsdk/core` 1.9.0-beta.87
- `@meshsdk/react` 1.9.0-beta.87
- `MeshTxBuilder` from `@meshsdk/core`

## Files to create/modify

### 1. API proxy route — `src/pages/api/dreps/my-delegation.ts` (NEW)

Proxies to backend `GET /dreps/my-delegation?stakeAddress=...`. Follow the same pattern as `src/pages/api/dreps/[drepId]/index.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { stakeAddress } = req.query;
    if (!stakeAddress || typeof stakeAddress !== "string") {
      return res.status(400).json({ error: "stakeAddress is required" });
    }
    const response = await callApi({
      endpoint: `/dreps/my-delegation?stakeAddress=${encodeURIComponent(stakeAddress)}`,
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("My delegation API error:", error);
    return res.status(500).json({ error: "Failed to fetch delegation status" });
  }
}
```

### 2. SWR hook — `src/hooks/useDRepData.ts` (MODIFY)

Add a `useMyDelegation` hook:

```typescript
export function useMyDelegation(stakeAddress: string | null) {
  const { data, error, isLoading } = useSWR(
    stakeAddress ? `/api/dreps/my-delegation?stakeAddress=${encodeURIComponent(stakeAddress)}` : null,
    fetcher
  );
  return { delegation: data ?? null, isLoading, error };
}
```

### 3. DelegateToDRep component — `src/components/dreps/DelegateToDRep.tsx` (NEW)

**Props:** `{ drepId: string, drepName: string | null }`

**Core behavior:**

1. **Not connected** → Show "Connect your wallet to delegate" + `<ConnectWalletButton />`

2. **Connected** → Get stake address via `wallet.getRewardAddresses()`, then:
   - Call `useMyDelegation(stakeAddress)` to show current delegation
   - Display "Currently delegated to: X" or "Not yet delegated to a DRep"
   - Show "Delegate to this DRep" button

3. **On click** → Open confirmation Dialog with:
   - DRep name + ID summary
   - Three delegation target options (radio-style, default: This DRep):
     - **This DRep** (`{ dRepId: string }`)
     - **Always Abstain** (`{ alwaysAbstain: null }`) — "Your voting power will be marked but not counted"
     - **Always No Confidence** (`{ alwaysNoConfidence: null }`) — "Counts as a 'No' vote by default"
   - "This will create an on-chain transaction" note
   - Confirm / Cancel buttons

4. **On confirm** → Build and submit transaction:

```typescript
const utxos = await wallet.getUtxos();
const changeAddress = await wallet.getChangeAddress();
const rewardAddresses = await wallet.getRewardAddresses();
const stakeAddress = rewardAddresses[0];

// MeshSDK DRep type: { dRepId: string } | { alwaysAbstain: null } | { alwaysNoConfidence: null }
const drep = selectedOption === 'abstain'
  ? { alwaysAbstain: null as null }
  : selectedOption === 'noConfidence'
  ? { alwaysNoConfidence: null as null }
  : { dRepId: drepId };

const txBuilder = new MeshTxBuilder({ verbose: true });
await txBuilder
  .voteDelegationCertificate(drep, stakeAddress)
  .selectUtxosFrom(utxos)
  .changeAddress(changeAddress)
  .complete();

const signedTx = await wallet.signTx(txBuilder.txHex);
const txHash = await wallet.submitTx(signedTx);
```

5. **Success** → Show checkmark + tx hash + "Your delegation will take effect in the next epoch"

6. **Error handling** → Same pattern as VoteOnProposal:
   - User declined wallet signing → close modal silently
   - Other errors → display in red error box

**Styling:** Must support all 3 themes (light/dark/game). Follow the patterns in VoteOnProposal.tsx for theme-conditional classes.

### 4. Mount in DRep profile — `src/pages/drep/[drepId].tsx` (MODIFY)

**IMPORTANT:** Since `DelegateToDRep` uses MeshSDK (`MeshTxBuilder`, `useWallet`), it **must** use the same Web Crypto guard + runtime `import()` pattern as `LazyVoteOnProposal` in `[hash].tsx`. Without this, the page crashes on HTTP environments where Web Crypto is unavailable. `next/dynamic` with `ssr: false` is NOT sufficient — the chunk still crashes client-side.

- Add a `LazyDelegateToDRep` wrapper function (same pattern as `LazyVoteOnProposal` at lines 285-298 of `[hash].tsx`):

```typescript
function LazyDelegateToDRep(props: { drepId: string; drepName: string | null }) {
  const [Comp, setComp] = useState<ComponentType<typeof props> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window.crypto && window.crypto.subtle)) return;
    import("@/components/dreps/DelegateToDRep")
      .then((mod) => setComp(() => mod.DelegateToDRep))
      .catch(() => {});
  }, []);
  if (!Comp) return null;
  return <Comp {...props} />;
}
```

- Place `<LazyDelegateToDRep drepId={drepIdStr} drepName={drep?.name ?? null} />` inside the profile card after the "Additional Information" section (~line 1160)

### 5. i18n translations — `src/messages/*.json` (MODIFY all 7 files)

Add `"delegation"` subsection under the existing `"drep"` key (NOT as a top-level key, for consistency with existing `"drep" > "profile"` pattern). Access via `useTranslations("drep.delegation")`.

English gets real strings, others get English placeholders:

```json
"drep": {
  "profile": { ... },
  "delegation": {
    "delegateToDRep": "Delegate to this DRep",
    "connectWalletToDelegate": "Connect your wallet to delegate your voting power.",
    "currentlyDelegatedTo": "Currently delegated to",
    "notYetDelegated": "Not yet delegated to a DRep",
    "confirmDelegation": "Confirm Delegation",
    "aboutToDelegate": "You are about to delegate your voting power.",
    "delegationTarget": "Delegation Target",
    "thisDRep": "This DRep",
    "alwaysAbstain": "Always Abstain",
    "alwaysAbstainDesc": "Your voting power will be marked but not counted in any vote.",
    "alwaysNoConfidence": "Always No Confidence",
    "alwaysNoConfidenceDesc": "Your voting power will count as a \"No\" vote on confidence motions.",
    "delegationSubmitted": "Delegation Submitted!",
    "delegationSubmittedDesc": "Your delegation has been submitted to the blockchain. It will take effect in the next epoch.",
    "onChainNote": "This will create an on-chain transaction. You will be asked to sign with your wallet.",
    "confirm": "Confirm Delegation",
    "cancel": "Cancel",
    "submitting": "Submitting...",
    "close": "Close",
    "viewOnAdaStat": "View on AdaStat",
    "failedToDelegate": "Failed to submit delegation",
    "noStakeAddress": "Could not get your stake address. Please ensure your wallet has a registered stake key."
  }
}
```

---

## Verification

### Backend
1. `npm run dev` in cgov-api
2. `curl "http://localhost:3000/dreps/my-delegation?stakeAddress=stake1..."` → returns delegation or null
3. `curl "http://localhost:3000/dreps/my-delegation"` → returns 400

### Frontend
1. `npm run dev` in cgov
2. Go to any DRep profile page
3. Without wallet → "Connect wallet to delegate" + ConnectWalletButton
4. Connect wallet → shows current delegation status + "Delegate" button
5. Click delegate → modal with 3 options (This DRep / Abstain / No Confidence)
6. Confirm → wallet prompt → success or error
7. Test all 3 themes (light/dark/game)
