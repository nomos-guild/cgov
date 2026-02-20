# Analytics API Routes Reference

This document summarizes the analytics API routes used by the test panel and `analyticsApi` service.

## Base Pattern

- Method: `GET`
- Base path: `/api/analytics/*`
- Query serialization behavior:
  - Array params (`status`, `governanceActionType`) are sent as comma-separated values.
  - `undefined` and `null` params are omitted.

## Complete Response Examples

If a field is optional in the type, this example may still include it for completeness.

### `votingTurnout`

- Route: `/api/analytics/voting-turnout`
- Query params: `page`, `pageSize`, `epochStart`, `epochEnd`, `status`, `governanceActionType`, `proposalId`
- Response type: `GetVotingTurnoutResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "governanceActionType": "TreasuryWithdrawals",
      "submissionEpoch": 520,
      "status": "ratified",
      "drepTurnoutPct": 61.2,
      "spoTurnoutPct": 72.5,
      "drepActiveYesVotePower": "1200000000",
      "drepActiveNoVotePower": "600000000",
      "drepActiveAbstainVotePower": "100000000",
      "drepTotalVotePower": "3100000000",
      "spoActiveYesVotePower": "2100000000",
      "spoActiveNoVotePower": "700000000",
      "spoActiveAbstainVotePower": "50000000",
      "spoTotalVotePower": "3950000000",
      "drepAlwaysAbstainVotePower": "180000000",
      "drepAlwaysNoConfidencePower": "90000000",
      "drepInactiveVotePower": "230000000",
      "drepNotVotedPower": "900000000",
      "drepParticipatingPct": 73.5,
      "spoAlwaysAbstainVotePower": "170000000",
      "spoAlwaysNoConfidencePower": "90000000",
      "spoNotVotedPower": "840000000",
      "spoParticipatingPct": 78.7
    }
  ],
  "aggregateDrepTurnoutPct": 60.1,
  "aggregateDrepParticipatingPct": 72.3,
  "aggregateSpoTurnoutPct": 71.2,
  "aggregateSpoParticipatingPct": 77.8,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `stakeParticipation`

- Route: `/api/analytics/stake-participation`
- Query params: `proposalId`
- Response type: `GetStakeParticipationResponse`

```json
{
  "proposalId": "abc123#0",
  "stats": {
    "participatingDelegators": 120300,
    "totalDelegators": 245000,
    "participationRatePct": 49.1,
    "participatingAmount": "2700000000000",
    "totalAmount": "5200000000000",
    "breakdown": {
      "actual": {
        "participatingDelegators": 109000,
        "totalDelegators": 220000,
        "participationRatePct": 49.5,
        "participatingAmount": "2500000000000",
        "totalAmount": "4900000000000",
        "delegatorSharePct": 89.8,
        "amountSharePct": 94.2
      },
      "alwaysAbstain": {
        "participatingDelegators": 8300,
        "totalDelegators": 16000,
        "participationRatePct": 51.9,
        "participatingAmount": "120000000000",
        "totalAmount": "210000000000",
        "delegatorSharePct": 6.5,
        "amountSharePct": 4
      },
      "alwaysNoConfidence": {
        "participatingDelegators": 3000,
        "totalDelegators": 9000,
        "participationRatePct": 33.3,
        "participatingAmount": "80000000000",
        "totalAmount": "90000000000",
        "delegatorSharePct": 3.7,
        "amountSharePct": 1.8
      }
    }
  }
}
```

### `delegationRate`

- Route: `/api/analytics/delegation-rate`
- Query params: `epochStart`, `epochEnd`, `limit`
- Response type: `GetDelegationRateResponse`

```json
{
  "epochs": [
    {
      "epoch": 520,
      "delegatedDrepPower": "5400000000000",
      "totalPoolVotePower": "7600000000000",
      "circulation": "35600000000000",
      "delegationRatePct": 71.05,
      "spoDelegationRatePct": 21.35,
      "startTime": "2026-01-01T21:44:51.000Z",
      "endTime": "2026-01-06T21:44:51.000Z"
    }
  ]
}
```

### `delegationDistribution`

- Route: `/api/analytics/delegation-distribution`
- Query params: `drepId`
- Response type: `GetDelegationDistributionResponse`

```json
{
  "bands": [
    {
      "band": "1k-10k ADA",
      "minLovelace": "1000000000",
      "maxLovelace": "10000000000",
      "stakeAddressCount": 15722,
      "totalAmountLovelace": "58100000000000",
      "totalAmountAda": "58100000",
      "stakeAddressSharePct": 34.2,
      "amountSharePct": 18.7
    }
  ],
  "totalStakeAddresses": 45980,
  "totalAmountLovelace": "310500000000000",
  "totalAmountAda": "310500000"
}
```

### `newDelegationRate`

- Route: `/api/analytics/new-delegation-rate`
- Query params: `epochStart`, `epochEnd`, `limit`
- Response type: `GetNewDelegationRateResponse`

```json
{
  "epochs": [
    {
      "epoch": 520,
      "newDelegators": 5320,
      "totalDelegators": 245000,
      "newDelegationRatePct": 2.17
    }
  ]
}
```

### `inactiveAda`

- Route: `/api/analytics/inactive-ada`
- Query params: `view`, `proposalId`, `epochStart`, `epochEnd`, `limit`
- Response type: `GetInactiveAdaResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "submissionEpoch": 520,
      "drepInactiveVotePower": "230000000",
      "drepTotalVotePower": "3100000000",
      "inactivePct": 7.42,
      "drepAlwaysAbstainVotePower": "180000000",
      "drepAlwaysNoConfidencePower": "90000000"
    }
  ]
}
```

### `giniCoefficient`

- Route: `/api/analytics/gini-coefficient`
- Query params: `activeOnly`
- Response type: `GetGiniCoefficientResponse`

```json
{
  "gini": 0.842,
  "drepCount": 1184,
  "stats": {
    "minVotingPower": "1000000",
    "maxVotingPower": "120000000000",
    "medianVotingPower": "74000000",
    "p90VotingPower": "2300000000",
    "totalVotingPower": "5400000000000"
  }
}
```

### `drepActivityRate`

- Route: `/api/analytics/drep-activity-rate`
- Query params: `page`, `pageSize`, `epochStart`, `epochEnd`, `status`, `drepId`, `activeOnly`, `sortBy`, `sortOrder`
- Response type: `GetDRepActivityRateResponse`

```json
{
  "dreps": [
    {
      "drepId": "drep1xyz",
      "name": "StakeWithUs",
      "registrationEpoch": 495,
      "proposalsVoted": 52,
      "totalVotesCast": 59,
      "totalProposals": 66,
      "totalProposalsSinceRegistration": 58,
      "activityRatePct": 89.66,
      "activityRateAllTimePct": 78.79
    }
  ],
  "aggregateActivityRatePct": 61.3,
  "aggregateActivityRateAllTimePct": 54.7,
  "filter": {
    "epochStart": 500,
    "epochEnd": 520,
    "statuses": ["ratified", "enacted"],
    "activeOnly": true
  },
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 1184, "totalPages": 48 }
}
```

### `drepRationaleRate`

- Route: `/api/analytics/drep-rationale-rate`
- Query params: `page`, `pageSize`, `drepId`, `activeOnly`, `sortBy`, `sortOrder`
- Response type: `GetDRepRationaleRateResponse`

```json
{
  "dreps": [
    {
      "drepId": "drep1xyz",
      "name": "StakeWithUs",
      "votesWithRationale": 44,
      "totalVotes": 59,
      "rationaleRatePct": 74.58
    }
  ],
  "aggregateRationaleRatePct": 46.22,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 1184, "totalPages": 48 }
}
```

### `drepCorrelation`

- Route: `/api/analytics/drep-correlation`
- Query params: `drepId1`, `drepId2`, `topN`, `minSharedProposals`
- Response type: `GetDRepCorrelationResponse`

```json
{
  "overview": {
    "mode": "all",
    "topN": 20,
    "minSharedProposals": 5,
    "drepCount": 1184,
    "totalVoteRows": 89241,
    "totalPairsEvaluated": 700336,
    "pairsMeetingMinSharedProposals": 91224,
    "pairsWithCorrelation": 89992,
    "pairsWithDivergence": 33212,
    "returnedTopCorrelated": 20,
    "returnedTopDivergent": 20,
    "mostCorrelated": {
      "drepId1": "drep1aaa",
      "drepId2": "drep1bbb",
      "drepName1": "DRep A",
      "drepName2": "DRep B",
      "sharedProposals": 19,
      "agreementPct": 100,
      "correlation": 1
    },
    "mostDivergent": {
      "drepId1": "drep1ccc",
      "drepId2": "drep1ddd",
      "drepName1": "DRep C",
      "drepName2": "DRep D",
      "sharedProposals": 12,
      "agreementPct": 8.33,
      "correlation": -0.91
    }
  },
  "topCorrelated": [
    {
      "drepId1": "drep1aaa",
      "drepId2": "drep1bbb",
      "drepName1": "DRep A",
      "drepName2": "DRep B",
      "sharedProposals": 19,
      "agreementPct": 100,
      "correlation": 1
    }
  ],
  "topDivergent": [
    {
      "drepId1": "drep1ccc",
      "drepId2": "drep1ddd",
      "drepName1": "DRep C",
      "drepName2": "DRep D",
      "sharedProposals": 12,
      "agreementPct": 8.33,
      "correlation": -0.91
    }
  ],
  "pairCorrelation": {
    "drepId1": "drep1xyz",
    "drepId2": "drep1uvw",
    "drepName1": "DRep X",
    "drepName2": "DRep U",
    "sharedProposals": 10,
    "agreementPct": 70,
    "correlation": 0.33
  }
}
```

### `drepLifecycleRate`

- Route: `/api/analytics/drep-lifecycle-rate`
- Query params: `epochStart`, `epochEnd`, `limit`
- Response type: `GetDRepLifecycleRateResponse`

```json
{
  "epochs": [
    {
      "epoch": 520,
      "registrations": 46,
      "deregistrations": 7,
      "updates": 31
    }
  ],
  "totals": {
    "registrations": 1204,
    "deregistrations": 138,
    "updates": 529
  }
}
```

### `spoSilentStake`

- Route: `/api/analytics/spo-silent-stake`
- Query params: `page`, `pageSize`, `epochStart`, `epochEnd`, `status`, `proposalId`
- Response type: `GetSpoSilentStakeResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "governanceActionType": "TreasuryWithdrawals",
      "submissionEpoch": 520,
      "spoNoVotePower": "900000000",
      "spoTotalVotePower": "3950000000",
      "silentPct": 22.78,
      "pureNotVotedPower": "640000000",
      "defaultStancePower": "260000000",
      "alwaysAbstainPower": "170000000",
      "alwaysNoConfidencePower": "90000000",
      "pureNotVotedPct": 16.2,
      "defaultStancePct": 6.58
    }
  ],
  "aggregateSilentPct": 21.9,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `spoDefaultStance`

- Route: `/api/analytics/spo-default-stance`
- Query params: `page`, `pageSize`, `epochStart`, `epochEnd`, `status`, `proposalId`
- Response type: `GetSpoDefaultStanceResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "spoAlwaysAbstainVotePower": "170000000",
      "spoAlwaysNoConfidencePower": "90000000",
      "combinedDefaultStancePower": "260000000",
      "spoTotalVotePower": "3950000000",
      "alwaysAbstainPct": 4.3,
      "alwaysNoConfidencePct": 2.28,
      "combinedDefaultStancePct": 6.58
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `entityConcentration`

- Route: `/api/analytics/entity-concentration`
- Query params: `limit`
- Response type: `GetEntityConcentrationResponse`

```json
{
  "entities": [
    {
      "poolGroup": "Entity A",
      "totalVotingPower": "980000000000",
      "totalVotingPowerAda": "980000",
      "totalVotesCast": 450,
      "poolCount": 12,
      "sharePct": 18.12
    }
  ],
  "hhi": 1275.2,
  "top5SharePct": 56.8,
  "top10SharePct": 73.1,
  "totalVotingPower": "5400000000000",
  "totalEntities": 83
}
```

### `voteDivergence`

- Route: `/api/analytics/vote-divergence`
- Query params: `page`, `pageSize`, `epochStart`, `epochEnd`, `status`, `proposalId`
- Response type: `GetVoteDivergenceResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "drepYesPct": 56.2,
      "drepNoPct": 31.1,
      "drepAbstainPct": 12.7,
      "spoYesPct": 70.2,
      "spoNoPct": 24.6,
      "spoAbstainPct": 5.2,
      "divergenceScore": 19.8
    }
  ],
  "averageDivergence": 14.1,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `actionVolume`

- Route: `/api/analytics/action-volume`
- Query params: `epochStart`, `epochEnd`, `limit`
- Response type: `GetActionVolumeResponse`

```json
{
  "epochs": [
    {
      "epoch": 520,
      "total": 12,
      "byType": {
        "TreasuryWithdrawals": 4,
        "NoConfidence": 1,
        "HardForkInitiation": 2,
        "ProtocolParameterChange": 5
      }
    }
  ],
  "totalProposals": 140,
  "byType": {
    "TreasuryWithdrawals": 42,
    "NoConfidence": 8
  },
  "byStatus": {
    "ratified": 38,
    "enacted": 21,
    "expired": 14
  },
  "byAuthor": {
    "Interim Constitutional Committee": 12,
    "Input Output Global": 9
  }
}
```

### `contentionRate`

- Route: `/api/analytics/contention-rate`
- Query params: `page`, `pageSize`, `epochStart`, `epochEnd`, `status`, `governanceActionType`, `proposalId`, `contentiousOnly`
- Response type: `GetContentionRateResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "governanceActionType": "TreasuryWithdrawals",
      "submissionEpoch": 520,
      "drepYesPct": 56.2,
      "drepNoPct": 31.1,
      "spoYesPct": 70.2,
      "spoNoPct": 24.6,
      "isContentious": true,
      "contentionScore": 82.5,
      "drepRatificationYesPct": 59.4,
      "drepRatificationNoPct": 30.3,
      "spoRatificationYesPct": 72.1,
      "spoRatificationNoPct": 23.7,
      "drepThreshold": 0.5,
      "spoThreshold": 0.5,
      "drepDistanceFromThreshold": 0.094,
      "spoDistanceFromThreshold": 0.221
    }
  ],
  "contentionRatePct": 28.6,
  "contentiousCount": 40,
  "totalProposals": 140,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `treasuryRate`

- Route: `/api/analytics/treasury-rate`
- Query params: `epochStart`, `epochEnd`, `limit`
- Response type: `GetTreasuryRateResponse`

```json
{
  "epochs": [
    {
      "epoch": 520,
      "treasury": "14500000000000",
      "circulation": "35600000000000",
      "treasuryRatePct": 40.73,
      "startTime": "2026-01-01T21:44:51.000Z",
      "endTime": "2026-01-06T21:44:51.000Z"
    }
  ]
}
```

### `timeToEnactment`

- Route: `/api/analytics/time-to-enactment`
- Query params: `page`, `pageSize`, `status`, `governanceActionType`, `proposalId`, `enactedOnly`
- Response type: `GetTimeToEnactmentResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "governanceActionType": "TreasuryWithdrawals",
      "status": "enacted",
      "submissionEpoch": 515,
      "ratifiedEpoch": 517,
      "enactedEpoch": 518,
      "submissionToRatifiedEpochs": 2,
      "submissionToEnactedEpochs": 3,
      "submissionToEnactedDays": 15
    }
  ],
  "stats": {
    "medianEpochsToEnactment": 3,
    "p90EpochsToEnactment": 6,
    "medianDaysToEnactment": 15,
    "p90DaysToEnactment": 30
  },
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 59, "totalPages": 3 }
}
```

### `complianceStatus`

- Route: `/api/analytics/compliance-status`
- Query params: `page`, `pageSize`, `status`, `proposalId`
- Response type: `GetComplianceStatusResponse`

```json
{
  "overview": {
    "eligibleMembers": 7,
    "totalProposals": 140,
    "ccApprovedCounts": {
      "approved": 49,
      "rejected": 36,
      "pending": 55
    },
    "constitutionalStatusCounts": {
      "constitutional": 45,
      "unconstitutional": 25,
      "pending": 60,
      "committeeTooSmall": 10
    }
  },
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "status": "ratified",
      "ccApproved": true,
      "constitutionalStatus": "Constitutional",
      "ccYesVotes": 5,
      "ccNoVotes": 1,
      "ccAbstainVotes": 0,
      "ccNotVoted": 1,
      "eligibleMembers": 7
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `ccTimeToDecision`

- Route: `/api/analytics/cc-time-to-decision`
- Query params: `page`, `pageSize`, `status`, `proposalId`
- Response type: `GetCCTimeToDecisionResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "submissionEpoch": 520,
      "firstCcVoteAt": "2026-01-03T10:00:00.000Z",
      "lastCcVoteAt": "2026-01-04T18:30:00.000Z",
      "hoursToFirstVote": 36.2,
      "daysToFirstVote": 1.51,
      "hoursToLastVote": 68.7,
      "daysToLastVote": 2.86
    }
  ],
  "stats": {
    "medianHoursToVote": 28.3,
    "medianDaysToVote": 1.18,
    "p90HoursToVote": 120.5,
    "p90DaysToVote": 5.02,
    "medianHoursToLastVote": 57.9,
    "medianDaysToLastVote": 2.41,
    "p90HoursToLastVote": 186.2,
    "p90DaysToLastVote": 7.76
  },
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `ccParticipation`

- Route: `/api/analytics/cc-participation`
- Query params: `status`
- Response type: `GetCCParticipationResponse`

```json
{
  "members": [
    {
      "ccId": "cc_hot_1xyz",
      "memberName": "CC Member A",
      "isEligible": true,
      "dbStatus": "active",
      "proposalsVoted": 55,
      "totalProposals": 140,
      "activeWindowProposalsVoted": 52,
      "activeWindowTotalProposals": 60,
      "participationRatePct": 86.67,
      "participationRatePctGlobal": 39.29,
      "firstVoteAt": "2025-11-10T09:00:00.000Z",
      "firstVoteProposalId": "a1#0",
      "firstVoteProposalTitle": "First vote proposal",
      "firstVoteProposalSubmissionEpoch": 500,
      "firstVoteProposalStatus": "enacted",
      "lastVoteAt": "2026-02-01T14:35:00.000Z",
      "lastVoteProposalId": "z9#1",
      "lastVoteProposalTitle": "Most recent vote proposal",
      "lastVoteProposalSubmissionEpoch": 520,
      "lastVoteProposalStatus": "ratified"
    }
  ],
  "aggregateParticipationPct": 74.4,
  "eligibleMembers": 7,
  "eligibleCcIds": ["cc_hot_1xyz"],
  "totalProposals": 140
}
```

### `ccAbstainRate`

- Route: `/api/analytics/cc-abstain-rate`
- Query params: `page`, `pageSize`, `status`, `proposalId`
- Response type: `GetCCAbstainRateResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "abstainVotes": 1,
      "totalVotes": 7,
      "abstainRatePct": 14.29
    }
  ],
  "aggregateAbstainRatePct": 9.8,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `ccAgreementRate`

- Route: `/api/analytics/cc-agreement-rate`
- Query params: `page`, `pageSize`, `status`, `proposalId`
- Response type: `GetCCAgreementRateResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "majorityVote": "yes",
      "matchingVotes": 6,
      "totalVotes": 7,
      "agreementRatePct": 85.71
    }
  ],
  "aggregateAgreementRatePct": 78.3,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

### `infoAvailability`

- Route: `/api/analytics/info-availability`
- Query params: `page`, `pageSize`, `status`, `proposalId`
- Response type: `GetInfoAvailabilityResponse`

```json
{
  "proposals": [
    {
      "proposalId": "abc123#0",
      "title": "Treasury withdrawal",
      "hasTitle": true,
      "hasDescription": true,
      "hasRationale": false,
      "hasMetadata": true,
      "completenessScore": 75
    }
  ],
  "votes": {
    "votesWithInfo": 300,
    "totalVotes": 900,
    "infoRatePct": 33.33
  },
  "aggregateProposalCompletenessPct": 68.5,
  "pagination": { "page": 1, "pageSize": 25, "totalItems": 140, "totalPages": 6 }
}
```

