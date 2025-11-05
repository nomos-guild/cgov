# cgov: Database Schema

**Note:** This is a proposed database schema for future backend implementation. The current application uses mock data stored in `src/data/mockData.ts`.

Based on TypeScript interfaces from the cgov codebase.

## Entity Relationships

```text
governance_actions (1) ──< (N) drep_votes
governance_actions (1) ──< (N) spo_votes
governance_actions (1) ──< (1) vote_statistics
```

## Tables

### governance_actions

```sql
CREATE TABLE governance_actions (
  id SERIAL PRIMARY KEY,
  hash VARCHAR(128) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,

  submission_epoch INTEGER NOT NULL,
  expiry_epoch INTEGER NOT NULL,

  description TEXT,
  rationale TEXT,
  anchor_url VARCHAR(500),
  anchor_hash VARCHAR(128),

  constitutionality VARCHAR(50),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_status CHECK (status IN ('Active', 'Ratified', 'Expired', 'Approved', 'Not approved'))
);

CREATE INDEX idx_ga_status ON governance_actions(status);
CREATE INDEX idx_ga_type ON governance_actions(type);
CREATE INDEX idx_ga_hash ON governance_actions(hash);
CREATE INDEX idx_ga_type_status ON governance_actions(type, status);
```

### drep_votes

```sql
CREATE TABLE drep_votes (
  id SERIAL PRIMARY KEY,
  governance_action_id INTEGER NOT NULL REFERENCES governance_actions(id) ON DELETE CASCADE,

  drep_id VARCHAR(128) NOT NULL,
  drep_name VARCHAR(200),
  vote VARCHAR(20) NOT NULL,
  voting_power_ada DECIMAL(20, 6) NOT NULL,

  anchor_url VARCHAR(500),
  anchor_hash VARCHAR(128),

  voted_at TIMESTAMP NOT NULL,

  CONSTRAINT chk_vote CHECK (vote IN ('Yes', 'No', 'Abstain')),
  CONSTRAINT uq_drep_vote UNIQUE(governance_action_id, drep_id)
);

CREATE INDEX idx_dv_action ON drep_votes(governance_action_id);
CREATE INDEX idx_dv_drep_id ON drep_votes(drep_id);
CREATE INDEX idx_dv_vote ON drep_votes(vote);
```

### spo_votes

```sql
CREATE TABLE spo_votes (
  id SERIAL PRIMARY KEY,
  governance_action_id INTEGER NOT NULL REFERENCES governance_actions(id) ON DELETE CASCADE,

  pool_id VARCHAR(128) NOT NULL,
  pool_name VARCHAR(200),
  vote VARCHAR(20) NOT NULL,
  voting_power_ada DECIMAL(20, 6) NOT NULL,

  anchor_url VARCHAR(500),
  anchor_hash VARCHAR(128),

  voted_at TIMESTAMP NOT NULL,

  CONSTRAINT chk_spo_vote CHECK (vote IN ('Yes', 'No', 'Abstain')),
  CONSTRAINT uq_spo_vote UNIQUE(governance_action_id, pool_id)
);

CREATE INDEX idx_sv_action ON spo_votes(governance_action_id);
CREATE INDEX idx_sv_pool_id ON spo_votes(pool_id);
```

### vote_statistics

Aggregated statistics per action.

```sql
CREATE TABLE vote_statistics (
  governance_action_id INTEGER PRIMARY KEY REFERENCES governance_actions(id) ON DELETE CASCADE,

  drep_yes_percent DECIMAL(5, 2),
  drep_no_percent DECIMAL(5, 2),
  drep_yes_ada DECIMAL(20, 6),
  drep_no_ada DECIMAL(20, 6),

  spo_yes_percent DECIMAL(5, 2),
  spo_no_percent DECIMAL(5, 2),
  spo_yes_ada DECIMAL(20, 6),
  spo_no_ada DECIMAL(20, 6),

  total_yes INTEGER DEFAULT 0,
  total_no INTEGER DEFAULT 0,
  total_abstain INTEGER DEFAULT 0,

  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Common Queries

### Get active actions with stats

```sql
SELECT ga.*, vs.*
FROM governance_actions ga
LEFT JOIN vote_statistics vs ON ga.id = vs.governance_action_id
WHERE ga.status = 'Active'
ORDER BY ga.submission_epoch DESC;
```

### Get action by hash with votes

```sql
SELECT
  ga.*,
  json_agg(json_build_object(
    'drepId', dv.drep_id,
    'vote', dv.vote,
    'votingPower', dv.voting_power_ada,
    'votedAt', dv.voted_at
  )) AS votes
FROM governance_actions ga
LEFT JOIN drep_votes dv ON ga.id = dv.governance_action_id
WHERE ga.hash = $1
GROUP BY ga.id;
```

### Search votes with filters

```sql
SELECT *
FROM drep_votes
WHERE governance_action_id = $1
  AND ($2 IS NULL OR vote = $2)
  AND ($3 IS NULL OR drep_name ILIKE '%' || $3 || '%')
ORDER BY voting_power_ada DESC
LIMIT $4 OFFSET $5;
```
