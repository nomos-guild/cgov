# Cardano Governance MCP Server

A Model Context Protocol (MCP) server providing Cardano Conway-era governance rules and specifications for AI agents.

## Overview

This MCP server exposes comprehensive knowledge about Cardano's on-chain governance system, extracted from the formal Conway Ledger specification. It enables AI agents to accurately answer questions about governance rules, voting thresholds, and protocol parameters.

## Source

All governance rules are extracted from:
- **Document:** "Formal Specification of the Cardano Ledger for the Conway era"
- **Authors:** Andre Knispel, William DeMeo, Joosep Jääger, Carlos Tomé Cortiñas (IOHK)
- **Reference:** `docs/conway-ledger.pdf`

## Available Tools

| Tool | Description |
|------|-------------|
| `get_governance_action_info` | Get detailed info about a governance action type |
| `get_voter_eligibility` | Check which voter types can vote on an action |
| `get_voting_thresholds` | Get required thresholds for an action |
| `get_all_eligibility_matrix` | Complete voter eligibility matrix |
| `get_all_thresholds` | All voting thresholds |
| `get_protocol_parameter_groups` | Protocol parameter groups and thresholds |
| `get_drep_delegation_rules` | AlwaysAbstain/AlwaysNoConfidence rules |
| `get_vote_calculation_formula` | Vote calculation formulas |
| `get_ratification_rules` | Ratification and enactment rules |
| `get_cc_rules` | Constitutional Committee rules |
| `get_epoch_info` | Epoch timing constants |
| `get_governance_lifecycle` | Governance action lifecycle |
| `can_voter_vote` | Check if a voter type can vote on an action |
| `get_threshold_symbol` | Info about threshold symbols (P1-P6, Q1-Q5) |
| `search_governance_rules` | Search governance rules by keyword |

## Available Resources

| URI | Description |
|-----|-------------|
| `governance://rules/complete` | All governance rules in one document |
| `governance://eligibility-matrix` | Voter eligibility matrix |
| `governance://thresholds` | Voting thresholds |
| `governance://parameter-groups` | Protocol parameter groups |

## Usage

### With Claude Code

The server is configured in `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "cardano-governance": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "./mcp-governance"
    }
  }
}
```

### Standalone

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build and run
npm run build
npm start
```

## Governance Action Types

| Type | Description |
|------|-------------|
| `NoConfidence` | Motion to declare no confidence in CC |
| `UpdateCommittee` | Add/remove CC members or change quorum |
| `NewConstitution` | Propose a new constitution |
| `TriggerHF` | Trigger a hard fork |
| `ChangePParams` | Change protocol parameters |
| `TreasuryWdrl` | Withdraw from treasury |
| `Info` | Informational action (no on-chain effect) |

## Voter Eligibility Matrix

| Action Type | CC | DRep | SPO |
|-------------|:--:|:----:|:---:|
| NoConfidence | - | 67% | 51% |
| UpdateCommittee | - | 67%/60%* | 51% |
| NewConstitution | 2/3 | 75% | - |
| TriggerHF | 2/3 | 60% | 51% |
| ChangePParams | 2/3 | 67%/75%** | - |
| TreasuryWdrl | 2/3 | 67% | - |
| Info | 100% | 100% | 100% |

\* 60% when CC is in no-confidence state
\** 75% for governance group parameters

## Example Queries

```typescript
// Check if DReps can vote on Hard Forks
await mcp.callTool("can_voter_vote", {
  voterType: "DRep",
  actionType: "TriggerHF"
});
// Result: { canVote: true, threshold: "60.0%" }

// Get all thresholds
await mcp.callTool("get_all_thresholds", {});

// Search for treasury-related rules
await mcp.callTool("search_governance_rules", {
  query: "treasury"
});
```

## License

Apache-2.0
