# cgov: Database Schema

**Note:** This document describes the data models used by the cgov application. The frontend receives data from a backend API; these schemas represent the logical data structure.

Based on TypeScript interfaces from `src/types/governance.ts`.

## Entity Relationships

```text
governance_actions (1) ──< (N) drep_votes
governance_actions (1) ──< (N) spo_votes
governance_actions (1) ──< (N) cc_votes
governance_actions (1) ──< (1) vote_statistics
governance_actions (1) ──< (1) vote_breakdown_drep
governance_actions (1) ──< (1) vote_breakdown_spo
governance_actions (1) ──< (1) voting_thresholds
```

## Tables

### governance_actions

Core governance action/proposal data.

```sql
CREATE TABLE governance_actions (
  id SERIAL PRIMARY KEY,

  -- Identifiers
  hash VARCHAR(128) UNIQUE NOT NULL,        -- txHash:certIndex format for routing
  proposal_id VARCHAR(128),                  -- gov_action bech32 format
  tx_hash VARCHAR(64),                       -- Transaction hash only

  -- Content
  title VARCHAR(500) NOT NULL,
  type VARCHAR(100) NOT NULL,                -- "Info Action", "Treasury Withdrawals", etc.
  status VARCHAR(50) NOT NULL,
  constitutionality VARCHAR(50),

  -- Detailed content (for detail pages)
  description TEXT,
  rationale TEXT,

  -- Epoch information
  submission_epoch INTEGER NOT NULL,
  expiry_epoch INTEGER NOT NULL,

  -- Governance action type code for vote calculations
  governance_action_type VARCHAR(50),        -- "NO_CONFIDENCE", "HARD_FORK_INITIATION", "OTHER"

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_status CHECK (status IN ('Active', 'Ratified', 'Enacted', 'Expired', 'Closed')),
  CONSTRAINT chk_type CHECK (type IN (
    'Info Action',
    'Treasury Withdrawals',
    'New Constitution',
    'Hard Fork Initiation',
    'Protocol Parameter Change',
    'No Confidence',
    'Update Committee'
  ))
);

CREATE INDEX idx_ga_status ON governance_actions(status);
CREATE INDEX idx_ga_type ON governance_actions(type);
CREATE INDEX idx_ga_hash ON governance_actions(hash);
CREATE INDEX idx_ga_proposal_id ON governance_actions(proposal_id);
CREATE INDEX idx_ga_type_status ON governance_actions(type, status);
CREATE INDEX idx_ga_submission_epoch ON governance_actions(submission_epoch);
```

### drep_votes

Individual DRep vote records.

```sql
CREATE TABLE drep_votes (
  id SERIAL PRIMARY KEY,
  governance_action_id INTEGER NOT NULL REFERENCES governance_actions(id) ON DELETE CASCADE,

  -- Voter identification
  voter_id VARCHAR(128) NOT NULL,            -- DRep ID (credential)
  voter_name VARCHAR(200),                   -- Display name if available

  -- Vote data
  vote VARCHAR(20) NOT NULL,
  voting_power VARCHAR(30) NOT NULL,         -- Lovelace as string (for BigInt precision)
  voting_power_ada DECIMAL(20, 6) NOT NULL,  -- Converted ADA for display

  -- Rationale/anchor
  anchor_url VARCHAR(500),
  anchor_hash VARCHAR(128),
  rationale TEXT,                            -- Resolved rationale text (plain or CIP-100/CIP-136)

  -- Metadata
  voted_at TIMESTAMP NOT NULL,
  tx_hash VARCHAR(64),                       -- Vote transaction hash

  CONSTRAINT chk_vote CHECK (vote IN ('Yes', 'No', 'Abstain')),
  CONSTRAINT uq_drep_vote UNIQUE(governance_action_id, voter_id)
);

CREATE INDEX idx_dv_action ON drep_votes(governance_action_id);
CREATE INDEX idx_dv_voter_id ON drep_votes(voter_id);
CREATE INDEX idx_dv_vote ON drep_votes(vote);
CREATE INDEX idx_dv_voting_power ON drep_votes(voting_power_ada DESC);
```

### spo_votes

Individual SPO (Stake Pool Operator) vote records.

```sql
CREATE TABLE spo_votes (
  id SERIAL PRIMARY KEY,
  governance_action_id INTEGER NOT NULL REFERENCES governance_actions(id) ON DELETE CASCADE,

  -- Voter identification
  voter_id VARCHAR(128) NOT NULL,            -- Pool ID
  voter_name VARCHAR(200),                   -- Pool ticker/name

  -- Vote data
  vote VARCHAR(20) NOT NULL,
  voting_power VARCHAR(30) NOT NULL,         -- Lovelace as string
  voting_power_ada DECIMAL(20, 6) NOT NULL,  -- Converted ADA

  -- Rationale/anchor
  anchor_url VARCHAR(500),
  anchor_hash VARCHAR(128),
  rationale TEXT,

  -- Metadata
  voted_at TIMESTAMP NOT NULL,
  tx_hash VARCHAR(64),

  CONSTRAINT chk_spo_vote CHECK (vote IN ('Yes', 'No', 'Abstain')),
  CONSTRAINT uq_spo_vote UNIQUE(governance_action_id, voter_id)
);

CREATE INDEX idx_sv_action ON spo_votes(governance_action_id);
CREATE INDEX idx_sv_voter_id ON spo_votes(voter_id);
CREATE INDEX idx_sv_vote ON spo_votes(vote);
```

### cc_votes

Individual Constitutional Committee vote records.

```sql
CREATE TABLE cc_votes (
  id SERIAL PRIMARY KEY,
  governance_action_id INTEGER NOT NULL REFERENCES governance_actions(id) ON DELETE CASCADE,

  -- Voter identification
  voter_id VARCHAR(128) NOT NULL,            -- CC member credential/script hash
  voter_name VARCHAR(200),                   -- Display name if available

  -- Vote data (CC votes are count-based, not stake-weighted)
  vote VARCHAR(20) NOT NULL,

  -- Rationale/anchor
  anchor_url VARCHAR(500),
  anchor_hash VARCHAR(128),
  rationale TEXT,

  -- Metadata
  voted_at TIMESTAMP NOT NULL,
  tx_hash VARCHAR(64),

  CONSTRAINT chk_cc_vote CHECK (vote IN ('Yes', 'No', 'Abstain')),
  CONSTRAINT uq_cc_vote UNIQUE(governance_action_id, voter_id)
);

CREATE INDEX idx_cv_action ON cc_votes(governance_action_id);
CREATE INDEX idx_cv_voter_id ON cc_votes(voter_id);
CREATE INDEX idx_cv_vote ON cc_votes(vote);
```

### vote_statistics

Aggregated voting statistics per action.

```sql
CREATE TABLE vote_statistics (
  governance_action_id INTEGER PRIMARY KEY REFERENCES governance_actions(id) ON DELETE CASCADE,

  -- DRep statistics (ADA-weighted)
  drep_yes_percent DECIMAL(5, 2),
  drep_no_percent DECIMAL(5, 2),
  drep_abstain_percent DECIMAL(5, 2),
  drep_yes_ada DECIMAL(20, 6),
  drep_no_ada DECIMAL(20, 6),
  drep_abstain_ada DECIMAL(20, 6),

  -- SPO statistics (ADA-weighted)
  spo_yes_percent DECIMAL(5, 2),
  spo_no_percent DECIMAL(5, 2),
  spo_abstain_percent DECIMAL(5, 2),
  spo_yes_ada DECIMAL(20, 6),
  spo_no_ada DECIMAL(20, 6),
  spo_abstain_ada DECIMAL(20, 6),

  -- CC statistics (count-based)
  cc_yes_percent DECIMAL(5, 2),
  cc_no_percent DECIMAL(5, 2),
  cc_abstain_percent DECIMAL(5, 2),
  cc_yes_count INTEGER DEFAULT 0,
  cc_no_count INTEGER DEFAULT 0,
  cc_abstain_count INTEGER DEFAULT 0,
  cc_not_voted_count INTEGER DEFAULT 0,

  -- Vote totals (counts across all voter types)
  total_yes INTEGER DEFAULT 0,
  total_no INTEGER DEFAULT 0,
  total_abstain INTEGER DEFAULT 0,

  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### vote_breakdown_drep

Detailed DRep vote breakdown by delegation status.

```sql
CREATE TABLE vote_breakdown_drep (
  governance_action_id INTEGER PRIMARY KEY REFERENCES governance_actions(id) ON DELETE CASCADE,

  -- Active votes (explicitly cast)
  active_yes VARCHAR(30) NOT NULL DEFAULT '0',           -- Lovelace string
  active_no VARCHAR(30) NOT NULL DEFAULT '0',
  active_abstain VARCHAR(30) NOT NULL DEFAULT '0',

  -- Pre-defined delegation options
  always_abstain VARCHAR(30) NOT NULL DEFAULT '0',       -- Delegated to "Abstain"
  always_no_confidence VARCHAR(30) NOT NULL DEFAULT '0', -- Delegated to "No Confidence"

  -- Other categories
  inactive VARCHAR(30) NOT NULL DEFAULT '0',             -- Inactive DReps
  not_voted VARCHAR(30) NOT NULL DEFAULT '0',            -- Active but haven't voted

  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### vote_breakdown_spo

Detailed SPO vote breakdown by delegation status.

```sql
CREATE TABLE vote_breakdown_spo (
  governance_action_id INTEGER PRIMARY KEY REFERENCES governance_actions(id) ON DELETE CASCADE,

  -- Active votes (explicitly cast)
  active_yes VARCHAR(30) NOT NULL DEFAULT '0',
  active_no VARCHAR(30) NOT NULL DEFAULT '0',
  active_abstain VARCHAR(30) NOT NULL DEFAULT '0',

  -- Pre-defined delegation options
  always_abstain VARCHAR(30) NOT NULL DEFAULT '0',
  always_no_confidence VARCHAR(30) NOT NULL DEFAULT '0',

  -- Note: SPOs don't have "inactive" category
  not_voted VARCHAR(30) NOT NULL DEFAULT '0',

  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### voting_thresholds

Per-action voting thresholds (provided by protocol).

```sql
CREATE TABLE voting_thresholds (
  governance_action_id INTEGER PRIMARY KEY REFERENCES governance_actions(id) ON DELETE CASCADE,

  -- Thresholds (null means voter type doesn't participate)
  cc_threshold DECIMAL(5, 4),                -- e.g., 0.6667 for 2/3
  drep_threshold DECIMAL(5, 4),              -- e.g., 0.67 for 67%
  spo_threshold DECIMAL(5, 4),               -- e.g., 0.51 for 51%

  -- Pass/fail status
  cc_passing BOOLEAN,
  drep_passing BOOLEAN,
  spo_passing BOOLEAN,

  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ncl_data

Net Change Limit tracking for treasury withdrawals.

```sql
CREATE TABLE ncl_data (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  current_value VARCHAR(30) NOT NULL,        -- Lovelace string
  target_value VARCHAR(30) NOT NULL,         -- Lovelace string
  epoch INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ncl_year ON ncl_data(year);
```

### proposal_references

References/links from proposal metadata.

```sql
CREATE TABLE proposal_references (
  id SERIAL PRIMARY KEY,
  governance_action_id INTEGER NOT NULL REFERENCES governance_actions(id) ON DELETE CASCADE,

  uri VARCHAR(1000),
  label VARCHAR(500),
  type VARCHAR(100),                         -- e.g., "Other", "Constitution"

  CONSTRAINT uq_ref UNIQUE(governance_action_id, uri)
);

CREATE INDEX idx_pr_action ON proposal_references(governance_action_id);
```

## Common Queries

### Get active actions with full statistics

```sql
SELECT
  ga.*,
  vs.*,
  vt.cc_threshold, vt.drep_threshold, vt.spo_threshold,
  vt.cc_passing, vt.drep_passing, vt.spo_passing
FROM governance_actions ga
LEFT JOIN vote_statistics vs ON ga.id = vs.governance_action_id
LEFT JOIN voting_thresholds vt ON ga.id = vt.governance_action_id
WHERE ga.status = 'Active'
ORDER BY ga.submission_epoch DESC;
```

### Get action by hash with vote breakdowns

```sql
SELECT
  ga.*,
  vs.*,
  vbd.active_yes as drep_active_yes,
  vbd.active_no as drep_active_no,
  vbd.always_no_confidence as drep_always_no_confidence,
  vbd.inactive as drep_inactive,
  vbd.not_voted as drep_not_voted,
  vbs.active_yes as spo_active_yes,
  vbs.active_no as spo_active_no,
  vbs.always_no_confidence as spo_always_no_confidence,
  vbs.not_voted as spo_not_voted
FROM governance_actions ga
LEFT JOIN vote_statistics vs ON ga.id = vs.governance_action_id
LEFT JOIN vote_breakdown_drep vbd ON ga.id = vbd.governance_action_id
LEFT JOIN vote_breakdown_spo vbs ON ga.id = vbs.governance_action_id
WHERE ga.hash = $1;
```

### Get votes for action with filters

```sql
-- DRep votes
SELECT
  'DRep' as voter_type,
  voter_id, voter_name, vote,
  voting_power, voting_power_ada,
  anchor_url, anchor_hash, rationale,
  voted_at, tx_hash
FROM drep_votes
WHERE governance_action_id = $1
  AND ($2 IS NULL OR vote = $2)
  AND ($3 IS NULL OR voter_name ILIKE '%' || $3 || '%' OR voter_id ILIKE '%' || $3 || '%')
ORDER BY voting_power_ada DESC
LIMIT $4 OFFSET $5;

-- Combined votes from all voter types
SELECT * FROM (
  SELECT 'DRep' as voter_type, voter_id, voter_name, vote, voting_power_ada, voted_at
  FROM drep_votes WHERE governance_action_id = $1
  UNION ALL
  SELECT 'SPO' as voter_type, voter_id, voter_name, vote, voting_power_ada, voted_at
  FROM spo_votes WHERE governance_action_id = $1
  UNION ALL
  SELECT 'CC' as voter_type, voter_id, voter_name, vote, NULL as voting_power_ada, voted_at
  FROM cc_votes WHERE governance_action_id = $1
) combined
WHERE ($2 IS NULL OR vote = $2)
ORDER BY voted_at DESC;
```

### Get overview summary

```sql
SELECT
  COUNT(*) as total_proposals,
  COUNT(*) FILTER (WHERE status = 'Active') as active_proposals,
  COUNT(*) FILTER (WHERE status = 'Ratified') as ratified_proposals,
  COUNT(*) FILTER (WHERE status = 'Enacted') as enacted_proposals,
  COUNT(*) FILTER (WHERE status = 'Expired') as expired_proposals,
  COUNT(*) FILTER (WHERE status = 'Closed') as closed_proposals
FROM governance_actions;
```

### Get NCL data for display

```sql
SELECT
  year,
  current_value,
  target_value,
  (CAST(current_value AS DECIMAL) / 1000000) as current_value_ada,
  (CAST(target_value AS DECIMAL) / 1000000) as target_value_ada,
  CASE
    WHEN CAST(target_value AS DECIMAL) > 0
    THEN (CAST(current_value AS DECIMAL) / CAST(target_value AS DECIMAL)) * 100
    ELSE 0
  END as percent_used,
  epoch,
  updated_at
FROM ncl_data
ORDER BY year DESC;
```

## Data Type Notes

### Lovelace vs ADA

- **Lovelace**: Stored as VARCHAR(30) strings for BigInt precision (1 ADA = 1,000,000 lovelace)
- **ADA**: Stored as DECIMAL(20, 6) for display purposes
- Frontend converts lovelace to ADA: `ada = parseInt(lovelace) / 1_000_000`

### Percentages

- Stored as DECIMAL(5, 2) for display (e.g., 67.50 for 67.5%)
- Thresholds stored as DECIMAL(5, 4) as decimals (e.g., 0.6700 for 67%)

### Null Values

- `threshold.*Threshold = null` means that voter type doesn't participate for this action type
- `votingStatus.*Passing = null` means threshold check not applicable

## Related Documentation

- [voting-stuff.md](voting-stuff.md) - TypeScript type definitions
- [../sources/cardano-governance-reference.md](../sources/cardano-governance-reference.md) - CIP-1694 governance rules
