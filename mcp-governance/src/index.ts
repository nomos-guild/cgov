#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  GOVERNANCE_ACTION_TYPES,
  VOTER_ELIGIBILITY,
  VOTING_THRESHOLDS,
  THRESHOLD_SYMBOLS,
  PROTOCOL_PARAMETER_GROUPS,
  DREP_PREDEFINED_DELEGATIONS,
  VOTE_CALCULATION,
  RATIFICATION_REQUIREMENTS,
  GOVERNANCE_ACTION_LIFECYCLE,
  EPOCH_CONSTANTS,
  CC_RULES,
  CURRENCY_UNITS,
  type GovernanceActionType,
  type VoterType,
} from "./knowledge/governance-rules.js";

const server = new Server(
  {
    name: "cardano-governance-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// =============================================================================
// TOOL HANDLERS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_governance_action_info",
        description: "Get detailed information about a specific governance action type including description, effects, and voting requirements",
        inputSchema: {
          type: "object",
          properties: {
            actionType: {
              type: "string",
              enum: ["NoConfidence", "UpdateCommittee", "NewConstitution", "TriggerHF", "ChangePParams", "TreasuryWdrl", "Info"],
              description: "The governance action type to query"
            }
          },
          required: ["actionType"]
        }
      },
      {
        name: "get_voter_eligibility",
        description: "Check which voter types (CC, DRep, SPO) can vote on a specific governance action type",
        inputSchema: {
          type: "object",
          properties: {
            actionType: {
              type: "string",
              enum: ["NoConfidence", "UpdateCommittee", "NewConstitution", "TriggerHF", "ChangePParams", "TreasuryWdrl", "Info"],
              description: "The governance action type"
            }
          },
          required: ["actionType"]
        }
      },
      {
        name: "get_voting_thresholds",
        description: "Get the voting thresholds required for a governance action to pass",
        inputSchema: {
          type: "object",
          properties: {
            actionType: {
              type: "string",
              enum: ["NoConfidence", "UpdateCommittee", "NewConstitution", "TriggerHF", "ChangePParams", "TreasuryWdrl", "Info"],
              description: "The governance action type"
            }
          },
          required: ["actionType"]
        }
      },
      {
        name: "get_all_eligibility_matrix",
        description: "Get the complete voter eligibility matrix for all governance action types",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_all_thresholds",
        description: "Get all voting thresholds for all governance action types",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_protocol_parameter_groups",
        description: "Get information about protocol parameter groups and their respective DRep thresholds",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              enum: ["network", "economic", "technical", "governance", "security", "all"],
              description: "The parameter group to query, or 'all' for all groups"
            }
          },
          required: ["group"]
        }
      },
      {
        name: "get_drep_delegation_rules",
        description: "Get rules for predefined DRep delegations (AlwaysAbstain, AlwaysNoConfidence)",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_vote_calculation_formula",
        description: "Get the vote calculation formula for a specific voter type",
        inputSchema: {
          type: "object",
          properties: {
            voterType: {
              type: "string",
              enum: ["DRep", "SPO", "CC"],
              description: "The voter type"
            }
          },
          required: ["voterType"]
        }
      },
      {
        name: "get_ratification_rules",
        description: "Get rules for governance action ratification and enactment",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_cc_rules",
        description: "Get Constitutional Committee (CC) rules including quorum, term limits, and states",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_epoch_info",
        description: "Get Cardano epoch timing constants and important epoch milestones",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_governance_lifecycle",
        description: "Get the lifecycle states and timing for governance actions",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "can_voter_vote",
        description: "Check if a specific voter type can vote on a specific action type",
        inputSchema: {
          type: "object",
          properties: {
            voterType: {
              type: "string",
              enum: ["CC", "DRep", "SPO"],
              description: "The voter type"
            },
            actionType: {
              type: "string",
              enum: ["NoConfidence", "UpdateCommittee", "NewConstitution", "TriggerHF", "ChangePParams", "TreasuryWdrl", "Info"],
              description: "The governance action type"
            }
          },
          required: ["voterType", "actionType"]
        }
      },
      {
        name: "get_threshold_symbol",
        description: "Get information about a specific threshold symbol (P1-P6, Q1-Q5)",
        inputSchema: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              enum: ["P1", "P2a", "P2b", "P3", "P4", "P5a", "P5b", "P5c", "P5d", "P6", "Q1", "Q2a", "Q2b", "Q4", "Q5"],
              description: "The threshold symbol from the Conway specification"
            }
          },
          required: ["symbol"]
        }
      },
      {
        name: "search_governance_rules",
        description: "Search governance rules by keyword (e.g., 'hard fork', 'treasury', 'threshold')",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_currency_units",
        description: "Get information about Cardano currency units (lovelace/ADA) and conversion rules. IMPORTANT: All on-chain values are in lovelace, not ADA. 1 ADA = 1,000,000 lovelace.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_governance_action_info": {
      const actionType = args?.actionType as GovernanceActionType;
      const info = GOVERNANCE_ACTION_TYPES[actionType];
      const eligibility = VOTER_ELIGIBILITY[actionType];
      const thresholds = VOTING_THRESHOLDS[actionType];

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            actionType,
            ...info,
            eligibility: {
              CC: eligibility.CC,
              DRep: eligibility.DRep,
              SPO: eligibility.SPO
            },
            thresholds: {
              CC: thresholds.ccThreshold ? `${(thresholds.ccThreshold * 100).toFixed(1)}%` : "N/A",
              DRep: thresholds.drepThreshold ? `${(thresholds.drepThreshold * 100).toFixed(1)}%` : "N/A",
              SPO: thresholds.spoThreshold ? `${(thresholds.spoThreshold * 100).toFixed(1)}%` : "N/A",
              notes: thresholds.notes
            }
          }, null, 2)
        }]
      };
    }

    case "get_voter_eligibility": {
      const actionType = args?.actionType as GovernanceActionType;
      const eligibility = VOTER_ELIGIBILITY[actionType];

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            actionType,
            eligibility,
            summary: Object.entries(eligibility)
              .filter(([_, canVote]) => canVote)
              .map(([voter]) => voter)
              .join(", ") + " can vote on this action type"
          }, null, 2)
        }]
      };
    }

    case "get_voting_thresholds": {
      const actionType = args?.actionType as GovernanceActionType;
      const thresholds = VOTING_THRESHOLDS[actionType];

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            actionType,
            thresholds: {
              CC: thresholds.ccThreshold !== null ? `${(thresholds.ccThreshold * 100).toFixed(2)}%` : "Does not vote",
              DRep: thresholds.drepThreshold !== null ? `${(thresholds.drepThreshold * 100).toFixed(2)}%` : "Does not vote",
              SPO: thresholds.spoThreshold !== null ? `${(thresholds.spoThreshold * 100).toFixed(2)}%` : "Does not vote"
            },
            notes: thresholds.notes || null
          }, null, 2)
        }]
      };
    }

    case "get_all_eligibility_matrix": {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            description: "Voter eligibility matrix per Conway Ledger specification (Fig. 42)",
            matrix: VOTER_ELIGIBILITY
          }, null, 2)
        }]
      };
    }

    case "get_all_thresholds": {
      const formatted = Object.entries(VOTING_THRESHOLDS).reduce((acc, [action, thresholds]) => {
        acc[action] = {
          CC: thresholds.ccThreshold !== null ? `${(thresholds.ccThreshold * 100).toFixed(1)}%` : null,
          DRep: thresholds.drepThreshold !== null ? `${(thresholds.drepThreshold * 100).toFixed(1)}%` : null,
          SPO: thresholds.spoThreshold !== null ? `${(thresholds.spoThreshold * 100).toFixed(1)}%` : null,
          notes: thresholds.notes
        };
        return acc;
      }, {} as Record<string, any>);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            description: "Voting thresholds per Conway Ledger specification",
            thresholds: formatted,
            thresholdSymbols: THRESHOLD_SYMBOLS
          }, null, 2)
        }]
      };
    }

    case "get_protocol_parameter_groups": {
      const group = args?.group as string;

      if (group === "all") {
        return {
          content: [{
            type: "text",
            text: JSON.stringify(PROTOCOL_PARAMETER_GROUPS, null, 2)
          }]
        };
      }

      const groupInfo = PROTOCOL_PARAMETER_GROUPS[group as keyof typeof PROTOCOL_PARAMETER_GROUPS];
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ group, ...groupInfo }, null, 2)
        }]
      };
    }

    case "get_drep_delegation_rules": {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            description: "Predefined DRep delegation options",
            delegations: DREP_PREDEFINED_DELEGATIONS,
            voteImpact: {
              NoConfidence: {
                alwaysAbstain: "Excluded from calculation",
                alwaysNoConfidence: "Counts as YES"
              },
              otherActions: {
                alwaysAbstain: "Excluded from calculation",
                alwaysNoConfidence: "Counts as NO"
              }
            }
          }, null, 2)
        }]
      };
    }

    case "get_vote_calculation_formula": {
      const voterType = args?.voterType as string;
      const formulaKey = voterType === "DRep" ? "drepVoteRatio"
                       : voterType === "SPO" ? "spoVoteRatio"
                       : "ccVoteRatio";
      const thresholdKey = voterType.toLowerCase() as "drep" | "spo" | "cc";

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            voterType,
            ...VOTE_CALCULATION[formulaKey as keyof typeof VOTE_CALCULATION],
            thresholdProgressFormula: VOTE_CALCULATION.thresholdProgress.formulas[thresholdKey],
            criticalNote: VOTE_CALCULATION.thresholdProgress.critical,
            commonMistakes: VOTE_CALCULATION.commonMistakes
          }, null, 2)
        }]
      };
    }

    case "get_ratification_rules": {
      return {
        content: [{
          type: "text",
          text: JSON.stringify(RATIFICATION_REQUIREMENTS, null, 2)
        }]
      };
    }

    case "get_cc_rules": {
      return {
        content: [{
          type: "text",
          text: JSON.stringify(CC_RULES, null, 2)
        }]
      };
    }

    case "get_epoch_info": {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ...EPOCH_CONSTANTS,
            currentEpochFormula: "Math.floor((Date.now() - shelleyStartTime) / epochDurationMs) + shelleyStartEpoch"
          }, null, 2)
        }]
      };
    }

    case "get_governance_lifecycle": {
      return {
        content: [{
          type: "text",
          text: JSON.stringify(GOVERNANCE_ACTION_LIFECYCLE, null, 2)
        }]
      };
    }

    case "can_voter_vote": {
      const voterType = args?.voterType as VoterType;
      const actionType = args?.actionType as GovernanceActionType;
      const canVote = VOTER_ELIGIBILITY[actionType][voterType];
      const threshold = voterType === "CC" ? VOTING_THRESHOLDS[actionType].ccThreshold
                      : voterType === "DRep" ? VOTING_THRESHOLDS[actionType].drepThreshold
                      : VOTING_THRESHOLDS[actionType].spoThreshold;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            voterType,
            actionType,
            canVote,
            threshold: threshold !== null ? `${(threshold * 100).toFixed(1)}%` : "N/A",
            explanation: canVote
              ? `${voterType} CAN vote on ${actionType} actions with a threshold of ${threshold !== null ? (threshold * 100).toFixed(1) + '%' : 'N/A'}`
              : `${voterType} CANNOT vote on ${actionType} actions`
          }, null, 2)
        }]
      };
    }

    case "get_threshold_symbol": {
      const symbol = args?.symbol as keyof typeof THRESHOLD_SYMBOLS;
      const info = THRESHOLD_SYMBOLS[symbol];

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            symbol,
            ...info,
            valueFormatted: `${(info.value * 100).toFixed(0)}%`
          }, null, 2)
        }]
      };
    }

    case "search_governance_rules": {
      const query = (args?.query as string).toLowerCase();
      const results: any[] = [];

      // Search action types
      for (const [action, info] of Object.entries(GOVERNANCE_ACTION_TYPES)) {
        if (action.toLowerCase().includes(query) ||
            info.description.toLowerCase().includes(query) ||
            info.effect.toLowerCase().includes(query)) {
          results.push({
            type: "governance_action",
            name: action,
            match: info.description
          });
        }
      }

      // Search parameter groups
      for (const [group, info] of Object.entries(PROTOCOL_PARAMETER_GROUPS)) {
        if (group.toLowerCase().includes(query) ||
            info.description.toLowerCase().includes(query) ||
            info.parameters.some(p => p.toLowerCase().includes(query))) {
          results.push({
            type: "parameter_group",
            name: group,
            match: info.description
          });
        }
      }

      // Search threshold symbols
      for (const [symbol, info] of Object.entries(THRESHOLD_SYMBOLS)) {
        if (symbol.toLowerCase().includes(query) ||
            info.name.toLowerCase().includes(query) ||
            info.description.toLowerCase().includes(query)) {
          results.push({
            type: "threshold",
            symbol,
            match: `${info.name}: ${info.description}`
          });
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            query,
            resultCount: results.length,
            results
          }, null, 2)
        }]
      };
    }

    case "get_currency_units": {
      return {
        content: [{
          type: "text",
          text: JSON.stringify(CURRENCY_UNITS, null, 2)
        }]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// =============================================================================
// RESOURCE HANDLERS
// =============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "governance://rules/complete",
        name: "Complete Governance Rules",
        description: "All Conway-era governance rules in one document",
        mimeType: "application/json"
      },
      {
        uri: "governance://eligibility-matrix",
        name: "Voter Eligibility Matrix",
        description: "Which voter types can vote on which actions",
        mimeType: "application/json"
      },
      {
        uri: "governance://thresholds",
        name: "Voting Thresholds",
        description: "Required voting thresholds for all action types",
        mimeType: "application/json"
      },
      {
        uri: "governance://parameter-groups",
        name: "Protocol Parameter Groups",
        description: "Protocol parameter groups and their thresholds",
        mimeType: "application/json"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "governance://rules/complete":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            actionTypes: GOVERNANCE_ACTION_TYPES,
            voterEligibility: VOTER_ELIGIBILITY,
            votingThresholds: VOTING_THRESHOLDS,
            thresholdSymbols: THRESHOLD_SYMBOLS,
            parameterGroups: PROTOCOL_PARAMETER_GROUPS,
            drepDelegations: DREP_PREDEFINED_DELEGATIONS,
            voteCalculation: VOTE_CALCULATION,
            ratificationRequirements: RATIFICATION_REQUIREMENTS,
            lifecycle: GOVERNANCE_ACTION_LIFECYCLE,
            epochConstants: EPOCH_CONSTANTS,
            ccRules: CC_RULES
          }, null, 2)
        }]
      };

    case "governance://eligibility-matrix":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(VOTER_ELIGIBILITY, null, 2)
        }]
      };

    case "governance://thresholds":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            thresholds: VOTING_THRESHOLDS,
            symbols: THRESHOLD_SYMBOLS
          }, null, 2)
        }]
      };

    case "governance://parameter-groups":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(PROTOCOL_PARAMETER_GROUPS, null, 2)
        }]
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cardano Governance MCP Server running on stdio");
}

main().catch(console.error);
