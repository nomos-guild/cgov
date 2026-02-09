# SPO Percentage Bug Investigation

**Investigation Date:** January 2025
**Status:** Backend Bug Confirmed
**Affected Proposal:** Add Constitutional Committee Member - Christina (`eb8ef28ca80dbd9ced6f577f013bdfc64897d1f4e326beb37a50fb6b62c38ccd%3A0`)

---

## Summary

The frontend displays **675.9%** under the SPO approval progress when it should never exceed 100%. Investigation confirmed this is a **backend API bug**, not a frontend issue.

| Aspect | Finding |
|--------|---------|
| Displayed Value | 675.9% |
| Expected Value | ~20.77% |
| Bug Location | Backend API |
| Frontend Status | Working correctly (pass-through) |

---

## Investigation Findings

### 1. Frontend Pass-Through Behavior

The frontend does NOT calculate SPO percentages - it directly displays the value received from the backend API.

**Evidence from `src/services/api.ts:231`:**
```typescript
spoYesPercent: action.spo?.yesPercent,
```

**Evidence from `src/components/GovernanceTable.tsx:583-589`:**
```typescript
const thresholdPercent = action.threshold?.spoThreshold != null
  ? action.threshold.spoThreshold * 100
  : 51;
const currentPercent = action.spoYesPercent ?? 0;
// Rendered as:
{currentPercent.toFixed(1)}% / {thresholdPercent.toFixed(1)}%
```

**Confirmed by `docs/voting-calculation-audit.md:286-299`:**
> "Percentages are **received from the backend**, not calculated on frontend"

### 2. API Response Contains Incorrect Value

The API response itself contains the erroneous percentage:

```json
{
  "spo": {
    "yesPercent": 675.93,
    "noPercent": 0,
    "abstainPercent": 96.93,
    "yesLovelace": "4444732625944988",
    "noLovelace": "0"
  }
}
```

The `yesPercent: 675.93` value is already incorrect when returned by the API.

---

## Technical Analysis

### Correct Calculation

Using the values from the API response:

| Field | Value |
|-------|-------|
| `spo.yesLovelace` | 4,444,732,625,944,988 |
| `spo_total_vote_power` | 21,405,491,557,393,012 |

**Correct Formula:**
```
yesPercent = (yesLovelace / total_vote_power) * 100
           = (4,444,732,625,944,988 / 21,405,491,557,393,012) * 100
           = 20.77%
```

**Actual API Response:** 675.93%

**Error Factor:** The API returns a value approximately **32.5x higher** than the correct calculation.

### Data Inconsistency

The SPO breakdown values in the API response sum to more than the declared total:

| Category | Lovelace |
|----------|----------|
| activeYes | 4,444,732,625,944,988 |
| activeNo | 0 |
| activeAbstain | 1,387,893,115,553,512 |
| alwaysAbstain | 0 |
| alwaysNoConfidence | 0 |
| notVoted | 19,447,422,815,889,712 |
| **Sum** | **25,280,048,557,388,212** |
| `spo_total_vote_power` | 21,405,491,557,393,012 |

The breakdown sum exceeds `spo_total_vote_power` by approximately **18%**, indicating a data integrity issue in the backend.

---

## Code References

| File | Line(s) | Description |
|------|---------|-------------|
| `src/services/api.ts` | 231 | API transformation passes through `spo.yesPercent` unchanged |
| `src/components/GovernanceTable.tsx` | 583-589 | Display component shows `spoYesPercent` as-is |
| `src/types/governance.ts` | 103-108 | Type definition for `spoYesPercent?: number` (no validation) |
| `src/pages/api/overview/proposals.ts` | - | Proxy route passes data through without transformation |
| `docs/voting-calculation-audit.md` | 286-299 | Audit confirms percentages come from backend |

---

## Conclusion

### Root Cause

The bug is in the **backend API service** that calculates `spo.yesPercent`. The backend is either:
1. Using an incorrect denominator in the percentage calculation
2. Applying an incorrect multiplier
3. Has corrupted or inconsistent data for SPO voting power

### Frontend Verification

The cgov frontend is working correctly:
- It receives the percentage from the API
- It displays the percentage as-is
- No frontend multiplication or calculation occurs
- This is the intended design per the voting calculation audit

### Recommendation

The fix must be applied to the backend API service (not in this repository). The backend team should:
1. Review the SPO percentage calculation logic
2. Investigate the data inconsistency where breakdown values exceed total vote power
3. Ensure the formula used is: `yesPercent = (yesLovelace / spo_total_vote_power) * 100`

---

## Related Documentation

- [voting-calculation-audit.md](voting-calculation-audit.md) - Frontend implementation audit
- [03-architecture-decisions.md](03-architecture-decisions.md) - Data flow architecture
- [voting-stuff.md](voting-stuff.md) - API and type reference
