# DRep Vote Submission & Sync — Frontend Integration

**Status: IMPLEMENTED** (PRs #64, #66, Feb 2026)

## Context

The DRep on-chain voting feature was built on the `add-ga-voting` branch and integrated into the main frontend:
- `VoteOnProposal` — full voting UI + post-submission polling on the detail page
- `VoteButtons` — compact voting for the governance table
- Backend sync-on-read is fully implemented in cgov-api

**Important implementation note:** Mesh SDK requires runtime `import()` gated by `window.crypto?.subtle` check. `next/dynamic` with `ssr: false` alone is NOT sufficient — the chunk still crashes client-side on HTTP (non-localhost). See `LazyVoteOnProposal` in `[hash].tsx` and `LazyWalletButton` in `Header.tsx`. This reduced `_app.js` bundle from 2.72 MB to 84 KB.

Refer to the backend plan at `cgov-api/docs/vote-submission-and-sync-flow.md` for the full end-to-end flow diagram.

---

## Overview

```
User clicks Yes/No/Abstain
  → VoteOnProposal builds MeshJS vote tx
  → User signs with wallet
  → Tx submitted to blockchain
  → Frontend polls GET /api/proposal/:id every 20s
  → Backend sync-on-read checks Koios for new votes
  → Vote count increases → Frontend shows "Vote synced!"
```

---

## Change 1: Add VoteOnProposal to Proposal Detail Page

**File:** `src/pages/governance/[hash].tsx`

**What:** Import and render `VoteOnProposal` in the right sidebar column, before the "Time Until Expiry" card (line 1925).

### Steps

1. **Add import** (after existing component imports, ~line 24):
   ```tsx
   import { VoteOnProposal } from "@/components/governance";
   ```

2. **Derive props from `selectedAction`** (inside the component body):
   ```tsx
   // selectedAction.hash is in "txHash:certIndex" format (e.g., "abc123:0")
   const [voteTxHash, voteCertIndexStr] = (selectedAction?.hash || "").split(/[:#]/);
   const voteCertIndex = parseInt(voteCertIndexStr, 10) || 0;
   ```

3. **Render VoteOnProposal** inside the right column `<div className="space-y-6">` (line 1924), before the Time Until Expiry card:
   ```tsx
   {selectedAction && voteTxHash && (
     <VoteOnProposal
       txHash={voteTxHash}
       certIndex={voteCertIndex}
       proposalTitle={selectedAction.title}
       status={selectedAction.status}
       proposalId={selectedAction.proposalId || selectedAction.hash}
     />
   )}
   ```

### How Polling Works (no additional code needed)

- `VoteOnProposal` dispatches `loadGovernanceActionDetail(proposalId)` every 20s after vote submission
- This hits `GET /api/proposal/{id}` → triggers backend sync-on-read
- Redux `selectedAction` updates with fresh data
- `useEffect` in `VoteOnProposal` detects vote count increase → stops polling, shows "Vote synced!"
- SWR's `dedupingInterval: 60000` prevents competition with the 20s polling
- The Redux pending reducer does NOT clear `selectedAction`, maintaining stale-while-revalidate and preventing VoteOnProposal from unmounting mid-poll

---

## Change 2 (Optional): Uncomment VoteButtons in Governance Table

**File:** `src/components/GovernanceTable.tsx`

**What:** Uncomment the `VoteButtons` import on line 39 to enable compact vote buttons in the proposal table for Active proposals.

### Steps

1. **Uncomment line 39:**
   ```tsx
   import { VoteButtons } from "@/components/governance/VoteButtons";
   ```

2. **Add VoteButtons to table rows** for Active proposals (in the default view table body). `VoteButtons` uses `e.stopPropagation()` internally to prevent row click navigation when clicking vote buttons.

> **Note:** `VoteButtons` does NOT include polling — it only submits the transaction and shows a success message with an AdaStat link. Vote sync happens when the user navigates to the detail page.

---

## Component Reference

### VoteOnProposal (detail page — full experience)

**Props:**
```ts
interface VoteOnProposalProps {
  txHash: string;       // Proposal transaction hash
  certIndex: number;    // Certificate index within the transaction
  proposalTitle: string;
  status: string;       // "Active" enables voting
  proposalId: string;   // Used for polling (loadGovernanceActionDetail)
}
```

**Behavior:**
- Shows "Cast Your Vote" card with Yes/No/Abstain buttons
- If wallet not connected: shows "Connect your wallet" prompt with `ConnectWalletButton`
- If proposal not active: shows "Voting is no longer available"
- On vote click: opens confirmation dialog with optional Rationale URL field
- On confirm: builds MeshJS vote transaction → signs → submits → starts polling
- Polling: 20s intervals, max 15 polls (5 min timeout)
- Sync detection: watches `selectedAction.votes.length` from Redux; when it exceeds count at submission time, sets `isSynced = true`
- Shows "Vote synced!" with green checkmark when complete

### VoteButtons (table — compact)

**Props:**
```ts
interface VoteButtonsProps {
  txHash: string;
  certIndex: number;
  proposalTitle: string;
  status: string;
  compact?: boolean;    // defaults to false
}
```

**Behavior:**
- Only renders for Active proposals when wallet is connected
- Shows compact Yes/No/Abstain buttons inline
- On vote: opens confirmation dialog → builds/signs/submits transaction
- Shows success with AdaStat link — no polling

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/governance/[hash].tsx` | Add import + render `VoteOnProposal` in right sidebar |
| `src/components/GovernanceTable.tsx` | Uncomment `VoteButtons` import (optional) |

## Files NOT Modified (already complete)

| File | Status |
|------|--------|
| `src/components/governance/VoteOnProposal.tsx` | Built — full voting + polling |
| `src/components/governance/VoteButtons.tsx` | Built — compact vote buttons |
| `src/components/governance/index.ts` | Barrel exports both components |
| `src/store/governanceSlice.ts` | `loadGovernanceActionDetail` thunk exists |
| `src/hooks/useGovernanceData.ts` | SWR hook with Redux sync exists |
| `src/services/api.ts` | `fetchGovernanceActionDetail()` exists |
| `src/pages/api/proposal/[id].ts` | Proxy route exists |

---

## Verification Steps

1. Run `npm run dev` (frontend) and `npm run dev` (backend/cgov-api)
2. Run `npm run build` to confirm no TypeScript errors
3. Connect a DRep-registered wallet (Eternl/Lace on mainnet)
4. Navigate to an Active proposal at `/governance/{hash}`
5. Verify "Cast Your Vote" card appears in right sidebar above "Time Until Expiry"
6. Test without wallet: should show "Connect your wallet" prompt
7. Test with wallet: should show Yes/No/Abstain buttons
8. Test vote submission: Click vote → Confirm → Sign in wallet → Submit
9. Verify polling: "Syncing your vote..." appears with poll counter
10. Verify sync detection: After ~20-60s, "Vote synced!" appears
11. Governance table (if Change 2 done): Compact vote buttons visible for Active proposals
