# cgov Project MCP Server

Model Context Protocol (MCP) server that exposes cgov project knowledge for AI coding assistants. This server helps AI understand the codebase structure, patterns, conventions, and domain-specific logic.

## Purpose

While the `mcp-governance` server provides Cardano governance protocol knowledge (CIP-1694, Conway Ledger spec), this `mcp-cgov` server provides **project-specific** knowledge:

- Project structure and file organization
- TypeScript types and interfaces
- Component patterns and conventions
- API architecture and data flow
- Vote calculation logic specific to this codebase
- Coding conventions and style guidelines

## Installation

```bash
cd mcp-cgov
npm install
npm run build
```

## Configuration

Add to `.mcp.json` in project root:

```json
{
  "mcpServers": {
    "cgov-project": {
      "command": "node",
      "args": ["mcp-cgov/dist/index.js"]
    }
  }
}
```

## Available Tools

### Project Overview
- `get_project_overview` - High-level project info, tech stack, features
- `get_file_structure` - Directory structure with descriptions
- `search_project_knowledge` - Keyword search across all knowledge

### Type Information
- `get_type_info` - Get interface/type details (GovernanceAction, VoteRecord, etc.)
- `get_enum_values` - Get enum/union type values (ProposalStatus, VoterType, etc.)

### Governance Logic
- `get_voter_eligibility` - Which voters can vote on which action types
- `check_can_vote` - Check if specific voter type can vote on action type
- `get_vote_calculation_rules` - Vote calculation formulas by voter/action type

### Architecture
- `get_api_architecture` - API data flow, endpoints, transformations
- `get_data_conventions` - Lovelace/ADA conversion, ID formats, etc.
- `get_component_info` - React component patterns and props

### Development Guidance
- `get_coding_conventions` - TypeScript, React, naming conventions
- `get_task_guidance` - Step-by-step guides for common tasks
- `get_theming_info` - Theme system information

## Available Resources

| URI | Description |
|-----|-------------|
| `cgov://overview` | Project overview |
| `cgov://types` | All type definitions |
| `cgov://file-structure` | File/directory structure |
| `cgov://voter-eligibility` | Voter eligibility matrix |
| `cgov://vote-calculation` | Vote calculation rules |
| `cgov://api-architecture` | API architecture |
| `cgov://components` | Component patterns |
| `cgov://conventions` | Coding conventions |
| `cgov://data-conventions` | Data format conventions |
| `cgov://complete` | All knowledge combined |

## Example Usage

```typescript
// Check if SPO can vote on Treasury Withdrawals
check_can_vote({ voterType: "SPO", actionType: "Treasury Withdrawals" })
// Returns: { canVote: false, explanation: "SPO CANNOT vote on Treasury Withdrawals actions" }

// Get vote calculation for DRep on NoConfidence
get_vote_calculation_rules({ voterType: "DRep", actionType: "NO_CONFIDENCE" })
// Returns: { yes: "activeYes + alwaysNoConfidence", no: "activeNo + notVoted", ... }

// Search for "lovelace"
search_project_knowledge({ query: "lovelace" })
// Returns: Matching paths and values across all knowledge
```

## Complementary Servers

This server complements `mcp-governance` which provides:
- CIP-1694 governance protocol rules
- Conway Ledger specification details
- Voting thresholds and requirements
- Protocol parameter groups

Use both servers together for comprehensive governance development support.
