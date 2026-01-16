# Cardano Governance Reference (CIP-1694 / Conway Era)

This document contains essential Cardano governance information from official sources, intended for use alongside the cgov application and MCP server development.

**Sources:**
- [Cardano Developers - Governance](https://developers.cardano.org/docs/governance/cardano-governance/)
- [CIP-1694 Specification](https://cips.cardano.org/cip/CIP-1694)
- [Conway Genesis (Mainnet)](https://book.world.dev.cardano.org/environments/mainnet/conway-genesis.json)

---

## Table of Contents

1. [Overview](#overview)
2. [Governance Bodies](#governance-bodies)
3. [Governance Action Types](#governance-action-types)
4. [Voting Thresholds](#voting-thresholds)
5. [DRep System](#drep-system)
6. [Constitutional Committee](#constitutional-committee)
7. [Governance Action Lifecycle](#governance-action-lifecycle)
8. [Protocol Parameters](#protocol-parameters)
9. [Treasury Withdrawals](#treasury-withdrawals)
10. [Bootstrap Phase](#bootstrap-phase)

---

## Overview

The **Conway era** introduced decentralized governance to Cardano by implementing **CIP-1694** functionality. This marks the transition from genesis key control to a decentralized model where decision-making is accessible to all stakeholders.

Key changes:
- Eliminated genesis delegations and MIR certificates
- Rendered genesis keys obsolete
- Introduced three governance bodies with distinct roles
- Established on-chain voting and ratification processes

---

## Governance Bodies

Three distinct groups participate in Cardano governance:

### 1. Delegated Representatives (DReps)

- Community representatives who vote on governance proposals
- Any ADA holder can register as a DRep or delegate to one
- Voting power is ADA-weighted (stake-based)
- Must remain active by voting within `dRepActivity` epochs

### 2. Stake Pool Operators (SPOs)

- Network validators who secure the blockchain
- Vote on specific protocol changes (security parameters, hard forks)
- Voting power based on delegated stake to their pools

### 3. Constitutional Committee (CC)

- Elected body responsible for constitutional compliance
- Makes decisions on constitutional matters
- Vote is count-based (one member = one vote)
- Requires 2/3 quorum for approval

---

## Governance Action Types

Seven types of governance actions exist in the Conway era:

| Type | Description | On-Chain Effect |
|------|-------------|-----------------|
| **NoConfidence** | Motion to express lack of confidence in the Constitutional Committee | Puts CC in no-confidence state |
| **UpdateCommittee** | Modify CC membership, signature threshold, or terms | Updates CC configuration |
| **NewConstitution** | Change the off-chain Constitution and/or proposal policy script | Updates constitution hash |
| **TriggerHF** (Hard Fork) | Initiate non-backwards compatible network upgrade | Triggers protocol version change |
| **ChangePParams** | Update protocol parameters (excluding version changes) | Modifies protocol parameters |
| **TreasuryWdrl** | Fund movements from the treasury | Transfers ADA from treasury |
| **Info** | Informational action with no on-chain effects | Creates on-chain record only |

---

## Voting Thresholds

### Mainnet Threshold Values (Conway Genesis)

#### DRep Voting Thresholds

| Action Type | Threshold |
|-------------|-----------|
| Motion of No-Confidence | **67%** |
| Update Committee (normal state) | **67%** |
| Update Committee (no-confidence state) | **60%** |
| New Constitution / Guardrails | **75%** |
| Hard Fork Initiation | **60%** |
| Protocol Parameters - Network Group | **67%** |
| Protocol Parameters - Economic Group | **67%** |
| Protocol Parameters - Technical Group | **67%** |
| Protocol Parameters - Governance Group | **75%** |
| Treasury Withdrawal | **67%** |
| Info Action | **100%** |

#### SPO Voting Thresholds

| Action Type | Threshold |
|-------------|-----------|
| Motion of No-Confidence | **51%** |
| Update Committee (normal state) | **51%** |
| Update Committee (no-confidence state) | **51%** |
| Hard Fork Initiation | **51%** |
| Protocol Parameters - Security Group | **51%** |
| Info Action | **100%** |

#### Constitutional Committee Threshold

| All Applicable Actions | Threshold |
|------------------------|-----------|
| CC Approval | **2/3 (66.67%)** |

### Complete Voting Matrix

| Action Type | CC | DReps | SPOs |
|-------------|:---:|:-----:|:----:|
| No-confidence | — | 67% | 51% |
| Update committee (normal) | — | 67% | 51% |
| Update committee (no-confidence) | — | 60% | 51% |
| New Constitution/Guardrails | ✓ (2/3) | 75% | — |
| Hard-fork initiation | ✓ (2/3) | 60% | 51% |
| Protocol params (network) | ✓ (2/3) | 67% | — |
| Protocol params (economic) | ✓ (2/3) | 67% | — |
| Protocol params (technical) | ✓ (2/3) | 67% | — |
| Protocol params (governance) | ✓ (2/3) | 75% | — |
| Treasury withdrawal | ✓ (2/3) | 67% | — |
| Info | ✓ (2/3) | 100% | 100% |

**Note:** "—" means that voter type does not participate in voting for that action type.

### Security-Critical Parameters

These parameters require **additional SPO approval (51%)** when modified:

- `maxBlockBodySize`
- `maxTxSize`
- `maxBlockHeaderSize`
- `maxValueSize`
- `maxBlockExecutionUnits`
- `txFeePerByte`
- `txFeeFixed`
- `utxoCostPerByte`
- `govActionDeposit`
- `minFeeRefScriptCostPerByte`

---

## DRep System

### Registration

DReps register via certificates containing:
- DRep ID (credential)
- Deposit amount
- Optional anchor (URL + hash for metadata)

### Delegation

- Stake credentials delegate voting rights through vote delegation certificates
- Delegators can change delegation at any time
- Changes take effect at the next epoch boundary

### Pre-defined Voting Options

Instead of delegating to a specific DRep, ADA holders can choose:

| Option | Behavior | Voting Stake |
|--------|----------|--------------|
| **Abstain** | Stake marked as non-participating; doesn't count toward active voting stake | Excluded from ratification calculation |
| **No Confidence** | Automatically votes Yes on no-confidence motions, No on all other actions | Counts as active voting stake |

### Activity Tracking

- DReps must vote within `dRepActivity` epochs to remain active
- **Mainnet value: 20 epochs** (~100 days)
- Inactive DReps' stake is excluded from ratification calculations
- Re-activates upon casting any vote

### Voting Power Calculation

**Active Voting Stake** includes lovelace where:
1. The transaction output contains a registered stake credential
2. That credential has delegated voting rights to a registered, active DRep

The system uses the most current per-DRep stake distribution calculated at epoch boundaries.

---

## Constitutional Committee

### Structure

- Variable-sized body (minimum size enforced by protocol)
- **Mainnet minimum: 7 members**
- **Maximum term length: 146 epochs** (~2 years)
- Per-member terms allow rotation schemes

### Confidence States

| State | Description | Capabilities |
|-------|-------------|--------------|
| **Normal** | Committee is functioning normally | Can vote on all applicable actions |
| **No-Confidence** | Committee has lost confidence of voters | Cannot participate in votes; must be replaced |

### Quorum and Terms

- Committee operates with **2/3 approval threshold**
- Members have epoch-based expiration dates
- If non-expired members fall below minimum size, committee cannot ratify actions
- New committees can be elected via `UpdateCommittee` action

### Current Mainnet Committee

- 7 script hash members
- All expire at epoch 580
- Threshold: 2/3

---

## Governance Action Lifecycle

### Submission

Governance actions are submitted in transactions including:
1. The governance action itself
2. Reference to previous action (Hash Protection, if required)
3. Reference to proposal policy/guardrails script (if applicable)
4. Deposit (returned upon finalization)
5. Anchor providing contextual information

### Voting

Votes consist of:
- Choice: **Yes**, **No**, or **Abstain**
- Voter's role and credential
- Governance action ID
- Optional anchor explaining rationale

### Timeline

```
Epoch N:     Action submitted
             ↓
Epochs N+1   Voting period (up to govActionLifetime epochs)
to N+6:      Bodies cast Yes/No/Abstain votes
             ↓
Each Epoch   Ratification check at epoch boundary
Boundary:    - Snapshot: SPOs, DReps, CC, votes, stake distribution
             - DRep Pulser computes voting stake (first 4k/f slots)
             - RATIFY/ENACT rules evaluated (last 6k/f slots)
             ↓
If Ratified: Action enters enactment state
             ↓
Next Epoch:  Action is ENACTED (applied to chain state)
             ↓
If Not       Action EXPIRES after govActionLifetime epochs
Ratified:
```

### Key Timing Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `govActionLifetime` | **6 epochs** | Maximum lifespan of proposal |
| Proposal submission window | 6k/f slots before epoch end | When proposals can be submitted |
| DRep Pulser computation | First 4k/f slots of epoch | Voting stake calculation period |
| Ratification window | Last 6k/f slots of epoch | When RATIFY/ENACT rules execute |

### Hash Protection

Actions that modify chain state require references to the last enacted action of the same type:
- NoConfidence
- UpdateCommittee
- NewConstitution
- TriggerHF (Hard Fork)
- ChangePParams

This ensures the final state matches the intended state when the proposal was submitted.

---

## Protocol Parameters

### Parameter Groups

Protocol parameters are divided into four categories with distinct voting thresholds:

#### Network Group (67% DRep + CC)
- `maxBlockBodySize` - Maximum block body size
- `maxTxSize` - Maximum transaction size
- `maxBlockHeaderSize` - Maximum block header size
- `maxValueSize` - Maximum value size in outputs
- `maxBlockExecutionUnits` - Maximum execution units per block
- `maxTxExecutionUnits` - Maximum execution units per transaction
- `maxCollateralInputs` - Maximum collateral inputs

#### Economic Group (67% DRep + CC)
- `txFeePerByte` - Fee per byte of transaction
- `txFeeFixed` - Fixed transaction fee
- `utxoCostPerByte` - Cost per byte for UTXO storage
- `stakeAddressDeposit` - Deposit for stake address registration
- `stakePoolDeposit` - Deposit for stake pool registration
- `monetaryExpansion` - Monetary expansion rate
- `treasuryCut` - Treasury cut percentage
- `minPoolCost` - Minimum pool cost
- `minFeeRefScriptCostPerByte` - Minimum fee for reference scripts

#### Technical Group (67% DRep + CC)
- `poolPledgeInfluence` - Pool pledge influence factor
- `poolRetireMaxEpoch` - Maximum epochs for pool retirement
- `stakePoolTargetNum` - Target number of stake pools
- `costModels` - Plutus cost models
- `executionUnitPrices` - Execution unit prices
- `collateralPercentage` - Collateral percentage required

#### Governance Group (75% DRep + CC)
- `govActionLifetime` - Governance action lifespan
- `govActionDeposit` - Deposit for governance actions
- `dRepDeposit` - DRep registration deposit
- `dRepActivity` - DRep activity period
- `committeeMinSize` - Minimum committee size
- `committeeMaxTermLength` - Maximum committee term

### Mainnet Parameter Values

| Parameter | Value | Unit |
|-----------|-------|------|
| `govActionDeposit` | **100,000 ADA** | lovelace: 100,000,000,000 |
| `govActionLifetime` | **6 epochs** | ~30 days |
| `dRepDeposit` | **500 ADA** | lovelace: 500,000,000 |
| `dRepActivity` | **20 epochs** | ~100 days |
| `committeeMinSize` | **7 members** | count |
| `committeeMaxTermLength` | **146 epochs** | ~2 years |
| `minFeeRefScriptCostPerByte` | **15** | lovelace |

---

## Treasury Withdrawals

### Mechanism

- Submitter provides a map from stake credentials to positive lovelace amounts
- Requires Constitutional Committee (2/3) and DRep (67%) approval
- Multiple withdrawals are permissible per epoch

### Net Change Limit (NCL)

The treasury has withdrawal limits tracked per governance period:
- `currentValue` - Amount already withdrawn in current period
- `targetValue` - Maximum allowed withdrawal for the period

**Note:** NCL tracking is implemented in the cgov application but specific limits are determined by the protocol and may vary.

### Deposit Return

- Governance action deposits are returned upon action finalization
- Finalization occurs when action is either ratified or expires
- Deposit counts toward submitter's voting stake while active

---

## Bootstrap Phase

During the initial governance bootstrap phase:

### Restricted Capabilities

- CC vote alone is sufficient to change protocol parameters
- Hard forks require both CC and SPO approval
- Info actions are available
- Full DRep voting not yet required

### Phase Termination

The bootstrap phase ends when:
1. Constitutional Committee ratifies a hard fork
2. SPOs ratify the same hard fork
3. The hard fork enables full governance capabilities

After bootstrap, all governance actions require their full threshold approvals.

---

## Ratification Logic Summary

### For Each Governance Action Type

```
NoConfidence:
  PASS if: DRep_Yes >= 67% AND SPO_Yes >= 51%
  CC does NOT vote

UpdateCommittee (normal state):
  PASS if: DRep_Yes >= 67% AND SPO_Yes >= 51%
  CC does NOT vote

UpdateCommittee (no-confidence state):
  PASS if: DRep_Yes >= 60% AND SPO_Yes >= 51%
  CC does NOT vote

NewConstitution:
  PASS if: CC_Yes >= 2/3 AND DRep_Yes >= 75%
  SPO does NOT vote

HardFork:
  PASS if: CC_Yes >= 2/3 AND DRep_Yes >= 60% AND SPO_Yes >= 51%

ProtocolParams (network/economic/technical):
  PASS if: CC_Yes >= 2/3 AND DRep_Yes >= 67%
  SPO votes only on security params (51%)

ProtocolParams (governance):
  PASS if: CC_Yes >= 2/3 AND DRep_Yes >= 75%

TreasuryWithdrawal:
  PASS if: CC_Yes >= 2/3 AND DRep_Yes >= 67%
  SPO does NOT vote

Info:
  PASS if: CC_Yes >= 2/3 AND DRep_Yes >= 100% AND SPO_Yes >= 100%
  (Always passes in practice since 100% means "any votes cast")
```

### Vote Counting Formula

For DReps and SPOs (ADA-weighted):
```
Yes% = (Active_Yes_Stake) / (Active_Yes_Stake + Active_No_Stake + Applicable_Not_Voted)
```

**Note:** The exact formula varies by action type and epoch (see cgov's `voteBreakdownCalculator.ts` for implementation details).

For Constitutional Committee (count-based):
```
Yes% = (Yes_Votes) / (Total_Non_Expired_Members)
```

---

## Quick Reference Card

### Deposits
| Type | Amount |
|------|--------|
| Governance Action | 100,000 ADA |
| DRep Registration | 500 ADA |

### Timeframes
| Period | Duration |
|--------|----------|
| Governance Action Lifetime | 6 epochs (~30 days) |
| DRep Activity Period | 20 epochs (~100 days) |
| CC Max Term | 146 epochs (~2 years) |
| Epoch Duration | 5 days |

### Key Thresholds
| Voter | Common Threshold | High Threshold |
|-------|------------------|----------------|
| DRep | 67% | 75% (constitution, gov params) |
| SPO | 51% | 51% (consistent) |
| CC | 2/3 | 2/3 (consistent) |

---

## Epoch Calculations

### Cardano Epoch Reference

```
SHELLEY_START_EPOCH = 208
SHELLEY_START_TIME = 2020-07-29T21:44:51Z
EPOCH_DURATION = 5 days (432,000 seconds)

Current Epoch = SHELLEY_START_EPOCH + floor((now - SHELLEY_START_TIME) / EPOCH_DURATION)
```

### Important Epoch Milestones

| Epoch | Significance |
|-------|--------------|
| 208 | Shelley era start |
| 534 | Governance calculation rule change (cgov uses this threshold) |

---

## Related Resources

- [CIP-1694 Full Specification](https://cips.cardano.org/cip/CIP-1694)
- [Conway Genesis (Mainnet)](https://book.world.dev.cardano.org/environments/mainnet/conway-genesis.json)
- [Cardano Documentation](https://docs.cardano.org/)
- [Intersect Governance](https://www.intersectmbo.org/)
