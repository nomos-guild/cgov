#!/usr/bin/env node
/**
 * cgov MCP Server
 *
 * Model Context Protocol server that exposes cgov project knowledge
 * for AI coding assistants. Provides tools and resources for understanding
 * the codebase structure, patterns, and conventions.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  PROJECT_OVERVIEW,
  FILE_STRUCTURE,
  TYPE_DEFINITIONS,
  DATA_CONVENTIONS,
  VOTER_ELIGIBILITY,
  VOTE_CALCULATION,
  API_ARCHITECTURE,
  COMPONENT_PATTERNS,
  THEMING,
  DASHBOARD,
  CODING_CONVENTIONS,
  COMMON_TASKS,
  ALL_KNOWLEDGE,
} from "./knowledge/project-knowledge.js";

// =============================================================================
// SERVER SETUP
// =============================================================================

const server = new Server(
  {
    name: "cgov-project",
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
// TOOLS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Project Overview Tools
      {
        name: "get_project_overview",
        description: "Get high-level overview of the cgov project including tech stack, features, and purpose",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_file_structure",
        description: "Get the project file structure with descriptions of each directory and key files",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Specific directory to get structure for (e.g., 'components', 'pages', 'lib'). Leave empty for full structure.",
            },
          },
          required: [],
        },
      },

      // Type Definition Tools
      {
        name: "get_type_info",
        description: "Get information about TypeScript types and interfaces used in the project",
        inputSchema: {
          type: "object",
          properties: {
            typeName: {
              type: "string",
              description: "Name of the type/interface to look up (e.g., 'GovernanceAction', 'VoteRecord', 'VoteBreakdown')",
            },
          },
          required: [],
        },
      },
      {
        name: "get_enum_values",
        description: "Get values for project enums and union types",
        inputSchema: {
          type: "object",
          properties: {
            enumName: {
              type: "string",
              enum: ["ProposalStatus", "ProposalType", "GovernanceActionType", "VoterType", "Vote", "GovernanceActionTypeCode"],
              description: "Name of the enum to get values for",
            },
          },
          required: ["enumName"],
        },
      },

      // Governance Logic Tools
      {
        name: "get_voter_eligibility",
        description: "Get voter eligibility information - which voter types can vote on which action types",
        inputSchema: {
          type: "object",
          properties: {
            actionType: {
              type: "string",
              description: "Action type to check eligibility for (e.g., 'NoConfidence', 'Treasury', 'HardForkInitiation')",
            },
          },
          required: [],
        },
      },
      {
        name: "check_can_vote",
        description: "Check if a specific voter type can vote on a specific action type",
        inputSchema: {
          type: "object",
          properties: {
            voterType: {
              type: "string",
              enum: ["DRep", "SPO", "CC"],
              description: "The voter type",
            },
            actionType: {
              type: "string",
              description: "The action type (can be label like 'Treasury Withdrawals' or code like 'Treasury')",
            },
          },
          required: ["voterType", "actionType"],
        },
      },
      {
        name: "get_vote_calculation_rules",
        description: "Get vote calculation rules for a specific voter type and action type",
        inputSchema: {
          type: "object",
          properties: {
            voterType: {
              type: "string",
              enum: ["DRep", "SPO", "CC"],
              description: "The voter type (DRep, SPO, or CC)",
            },
            actionType: {
              type: "string",
              enum: ["NO_CONFIDENCE", "HARD_FORK_INITIATION", "OTHER"],
              description: "The action type code",
            },
          },
          required: [],
        },
      },

      // Data Convention Tools
      {
        name: "get_data_conventions",
        description: "Get data conventions used in the project (lovelace/ADA conversion, ID formats, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              enum: ["lovelaceToAda", "proposalIdentifiers", "votingPower", "epochConstants", "all"],
              description: "Specific convention topic or 'all' for everything",
            },
          },
          required: [],
        },
      },

      // Architecture Tools
      {
        name: "get_api_architecture",
        description: "Get API architecture information including data flow, endpoints, and transformations",
        inputSchema: {
          type: "object",
          properties: {
            aspect: {
              type: "string",
              enum: ["dataFlow", "endpoints", "transformations", "serverSideAuth", "serviceFunctions", "all"],
              description: "Specific aspect of the API architecture",
            },
          },
          required: [],
        },
      },

      // Component Tools
      {
        name: "get_component_info",
        description: "Get information about React components and their patterns",
        inputSchema: {
          type: "object",
          properties: {
            componentName: {
              type: "string",
              description: "Name of a specific component (e.g., 'GovernanceTable', 'VotingRecords')",
            },
          },
          required: [],
        },
      },

      // Coding Convention Tools
      {
        name: "get_coding_conventions",
        description: "Get coding conventions and style guidelines for the project",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["typescript", "react", "imports", "naming", "files", "all"],
              description: "Category of conventions",
            },
          },
          required: [],
        },
      },

      // Task Guidance Tools
      {
        name: "get_task_guidance",
        description: "Get step-by-step guidance for common development tasks",
        inputSchema: {
          type: "object",
          properties: {
            task: {
              type: "string",
              enum: ["addNewComponent", "addNewApiEndpoint", "modifyVoteCalculation", "addVoterEligibility", "addNewTheme", "addNewChart"],
              description: "The task to get guidance for",
            },
          },
          required: ["task"],
        },
      },

      // Search Tool
      {
        name: "search_project_knowledge",
        description: "Search across all project knowledge by keyword",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'lovelace', 'DRep', 'threshold', 'Redux')",
            },
          },
          required: ["query"],
        },
      },

      // Theme Tool
      {
        name: "get_theming_info",
        description: "Get information about the theme system",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      // Dashboard Tool
      {
        name: "get_dashboard_info",
        description: "Get information about the customizable dashboard including layout system, charts, and persistence",
        inputSchema: {
          type: "object",
          properties: {
            aspect: {
              type: "string",
              enum: ["layoutSystem", "chartRegistry", "localStorage", "zIndexLayers", "userInteractions", "all"],
              description: "Specific aspect of the dashboard to get info about",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// =============================================================================
// TOOL HANDLERS
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_project_overview": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(PROJECT_OVERVIEW, null, 2),
          },
        ],
      };
    }

    case "get_file_structure": {
      const directory = args?.directory as string | undefined;
      if (directory && FILE_STRUCTURE.src[directory as keyof typeof FILE_STRUCTURE.src]) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { [directory]: FILE_STRUCTURE.src[directory as keyof typeof FILE_STRUCTURE.src] },
                null,
                2
              ),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(FILE_STRUCTURE, null, 2),
          },
        ],
      };
    }

    case "get_type_info": {
      const typeName = args?.typeName as string | undefined;
      if (typeName) {
        const interfaceInfo = TYPE_DEFINITIONS.interfaces[typeName as keyof typeof TYPE_DEFINITIONS.interfaces];
        const enumInfo = TYPE_DEFINITIONS.enums[typeName as keyof typeof TYPE_DEFINITIONS.enums];
        if (interfaceInfo) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ type: "interface", name: typeName, ...interfaceInfo }, null, 2),
              },
            ],
          };
        }
        if (enumInfo) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ type: "enum", name: typeName, ...enumInfo }, null, 2),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Type '${typeName}' not found`, availableTypes: {
                interfaces: Object.keys(TYPE_DEFINITIONS.interfaces),
                enums: Object.keys(TYPE_DEFINITIONS.enums),
              }}, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(TYPE_DEFINITIONS, null, 2),
          },
        ],
      };
    }

    case "get_enum_values": {
      const enumName = args?.enumName as string;
      const enumInfo = TYPE_DEFINITIONS.enums[enumName as keyof typeof TYPE_DEFINITIONS.enums];
      if (enumInfo) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ name: enumName, ...enumInfo }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Enum '${enumName}' not found`, availableEnums: Object.keys(TYPE_DEFINITIONS.enums) }, null, 2),
          },
        ],
      };
    }

    case "get_voter_eligibility": {
      const actionType = args?.actionType as string | undefined;
      if (actionType) {
        // Try direct lookup
        let eligibility = VOTER_ELIGIBILITY.matrix[actionType as keyof typeof VOTER_ELIGIBILITY.matrix];
        // Try label mapping
        if (!eligibility) {
          const mappedType = VOTER_ELIGIBILITY.labelMapping[actionType as keyof typeof VOTER_ELIGIBILITY.labelMapping];
          if (mappedType) {
            eligibility = VOTER_ELIGIBILITY.matrix[mappedType as keyof typeof VOTER_ELIGIBILITY.matrix];
          }
        }
        if (eligibility) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  actionType,
                  eligibility,
                  functions: VOTER_ELIGIBILITY.functions,
                  location: VOTER_ELIGIBILITY.location,
                }, null, 2),
              },
            ],
          };
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(VOTER_ELIGIBILITY, null, 2),
          },
        ],
      };
    }

    case "check_can_vote": {
      const voterType = args?.voterType as string;
      const actionType = args?.actionType as string;

      // Try direct lookup
      let eligibility = VOTER_ELIGIBILITY.matrix[actionType as keyof typeof VOTER_ELIGIBILITY.matrix];
      // Try label mapping
      if (!eligibility) {
        const mappedType = VOTER_ELIGIBILITY.labelMapping[actionType as keyof typeof VOTER_ELIGIBILITY.labelMapping];
        if (mappedType) {
          eligibility = VOTER_ELIGIBILITY.matrix[mappedType as keyof typeof VOTER_ELIGIBILITY.matrix];
        }
      }

      if (eligibility) {
        const canVote = eligibility[voterType as keyof typeof eligibility];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                voterType,
                actionType,
                canVote,
                explanation: canVote
                  ? `${voterType} CAN vote on ${actionType} actions`
                  : `${voterType} CANNOT vote on ${actionType} actions`,
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Unknown action type: ${actionType}`,
              availableTypes: Object.keys(VOTER_ELIGIBILITY.matrix),
              labelMapping: VOTER_ELIGIBILITY.labelMapping,
            }, null, 2),
          },
        ],
      };
    }

    case "get_vote_calculation_rules": {
      const voterType = args?.voterType as string | undefined;
      const actionType = args?.actionType as string | undefined;

      if (voterType === "DRep") {
        if (actionType === "NO_CONFIDENCE") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  voterType,
                  actionType,
                  calculation: VOTE_CALCULATION.drepCalculation.noConfidence,
                  note: "For NoConfidence actions, AlwaysNoConfidence counts as Yes",
                }, null, 2),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                voterType,
                actionType: actionType || "OTHER",
                calculation: VOTE_CALCULATION.drepCalculation.otherActions,
                note: "For non-NoConfidence actions, AlwaysNoConfidence counts as No",
              }, null, 2),
            },
          ],
        };
      }

      if (voterType === "SPO") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                voterType,
                epochThreshold: VOTE_CALCULATION.epoch534Threshold,
                preEpoch534: VOTE_CALCULATION.spoCalculation.preEpoch534,
                postEpoch534: VOTE_CALCULATION.spoCalculation.postEpoch534,
                note: "SPO calculation varies by epoch and action type",
              }, null, 2),
            },
          ],
        };
      }

      if (voterType === "CC") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                voterType,
                calculation: VOTE_CALCULATION.ccCalculation,
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(VOTE_CALCULATION, null, 2),
          },
        ],
      };
    }

    case "get_data_conventions": {
      const topic = args?.topic as string | undefined;
      if (topic && topic !== "all" && DATA_CONVENTIONS[topic as keyof typeof DATA_CONVENTIONS]) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ [topic]: DATA_CONVENTIONS[topic as keyof typeof DATA_CONVENTIONS] }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(DATA_CONVENTIONS, null, 2),
          },
        ],
      };
    }

    case "get_api_architecture": {
      const aspect = args?.aspect as string | undefined;
      if (aspect && aspect !== "all" && API_ARCHITECTURE[aspect as keyof typeof API_ARCHITECTURE]) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ [aspect]: API_ARCHITECTURE[aspect as keyof typeof API_ARCHITECTURE] }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(API_ARCHITECTURE, null, 2),
          },
        ],
      };
    }

    case "get_component_info": {
      const componentName = args?.componentName as string | undefined;
      if (componentName) {
        const customComponent = COMPONENT_PATTERNS.customComponents[componentName as keyof typeof COMPONENT_PATTERNS.customComponents];
        if (customComponent) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  name: componentName,
                  type: "custom",
                  ...customComponent,
                }, null, 2),
              },
            ],
          };
        }
        // Check if it's a UI component
        if (COMPONENT_PATTERNS.uiComponents.components.includes(componentName.toLowerCase())) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  name: componentName,
                  type: "ui",
                  location: COMPONENT_PATTERNS.uiComponents.location,
                  library: COMPONENT_PATTERNS.uiComponents.library,
                  styling: COMPONENT_PATTERNS.uiComponents.styling,
                }, null, 2),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Component '${componentName}' not found in knowledge base`,
                availableCustomComponents: Object.keys(COMPONENT_PATTERNS.customComponents),
                availableUiComponents: COMPONENT_PATTERNS.uiComponents.components,
              }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(COMPONENT_PATTERNS, null, 2),
          },
        ],
      };
    }

    case "get_coding_conventions": {
      const category = args?.category as string | undefined;
      if (category && category !== "all" && CODING_CONVENTIONS[category as keyof typeof CODING_CONVENTIONS]) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ [category]: CODING_CONVENTIONS[category as keyof typeof CODING_CONVENTIONS] }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(CODING_CONVENTIONS, null, 2),
          },
        ],
      };
    }

    case "get_task_guidance": {
      const task = args?.task as string;
      const guidance = COMMON_TASKS[task as keyof typeof COMMON_TASKS];
      if (guidance) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                task,
                ...guidance,
              }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Task '${task}' not found`,
              availableTasks: Object.keys(COMMON_TASKS),
            }, null, 2),
          },
        ],
      };
    }

    case "search_project_knowledge": {
      const query = (args?.query as string).toLowerCase();
      const results: Record<string, unknown>[] = [];

      // Helper to search recursively
      const searchObject = (obj: unknown, path: string): void => {
        if (typeof obj === "string" && obj.toLowerCase().includes(query)) {
          results.push({ path, value: obj });
        } else if (Array.isArray(obj)) {
          obj.forEach((item, index) => searchObject(item, `${path}[${index}]`));
        } else if (typeof obj === "object" && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            if (key.toLowerCase().includes(query)) {
              results.push({ path: `${path}.${key}`, value });
            }
            searchObject(value, `${path}.${key}`);
          }
        }
      };

      searchObject(ALL_KNOWLEDGE, "knowledge");

      // Limit results
      const limitedResults = results.slice(0, 20);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query,
              resultCount: results.length,
              results: limitedResults,
              truncated: results.length > 20,
            }, null, 2),
          },
        ],
      };
    }

    case "get_theming_info": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(THEMING, null, 2),
          },
        ],
      };
    }

    case "get_dashboard_info": {
      const aspect = args?.aspect as string | undefined;
      if (aspect && aspect !== "all" && DASHBOARD[aspect as keyof typeof DASHBOARD]) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ [aspect]: DASHBOARD[aspect as keyof typeof DASHBOARD] }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(DASHBOARD, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// =============================================================================
// RESOURCES
// =============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "cgov://overview",
        name: "Project Overview",
        description: "Complete project overview including tech stack and features",
        mimeType: "application/json",
      },
      {
        uri: "cgov://types",
        name: "Type Definitions",
        description: "All TypeScript type and interface definitions",
        mimeType: "application/json",
      },
      {
        uri: "cgov://file-structure",
        name: "File Structure",
        description: "Project file and directory structure",
        mimeType: "application/json",
      },
      {
        uri: "cgov://voter-eligibility",
        name: "Voter Eligibility Matrix",
        description: "Which voter types can vote on which action types",
        mimeType: "application/json",
      },
      {
        uri: "cgov://vote-calculation",
        name: "Vote Calculation Rules",
        description: "Rules for calculating vote totals by voter type and action type",
        mimeType: "application/json",
      },
      {
        uri: "cgov://api-architecture",
        name: "API Architecture",
        description: "API data flow, endpoints, and transformations",
        mimeType: "application/json",
      },
      {
        uri: "cgov://components",
        name: "Component Patterns",
        description: "React component patterns and conventions",
        mimeType: "application/json",
      },
      {
        uri: "cgov://conventions",
        name: "Coding Conventions",
        description: "Project coding conventions and style guidelines",
        mimeType: "application/json",
      },
      {
        uri: "cgov://data-conventions",
        name: "Data Conventions",
        description: "Data format conventions (lovelace/ADA, ID formats, etc.)",
        mimeType: "application/json",
      },
      {
        uri: "cgov://dashboard",
        name: "Dashboard",
        description: "Customizable dashboard with draggable/resizable charts",
        mimeType: "application/json",
      },
      {
        uri: "cgov://complete",
        name: "Complete Knowledge Base",
        description: "All project knowledge in one document",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "cgov://overview":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(PROJECT_OVERVIEW, null, 2),
          },
        ],
      };

    case "cgov://types":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(TYPE_DEFINITIONS, null, 2),
          },
        ],
      };

    case "cgov://file-structure":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(FILE_STRUCTURE, null, 2),
          },
        ],
      };

    case "cgov://voter-eligibility":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(VOTER_ELIGIBILITY, null, 2),
          },
        ],
      };

    case "cgov://vote-calculation":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(VOTE_CALCULATION, null, 2),
          },
        ],
      };

    case "cgov://api-architecture":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(API_ARCHITECTURE, null, 2),
          },
        ],
      };

    case "cgov://components":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(COMPONENT_PATTERNS, null, 2),
          },
        ],
      };

    case "cgov://conventions":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(CODING_CONVENTIONS, null, 2),
          },
        ],
      };

    case "cgov://data-conventions":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(DATA_CONVENTIONS, null, 2),
          },
        ],
      };

    case "cgov://dashboard":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(DASHBOARD, null, 2),
          },
        ],
      };

    case "cgov://complete":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(ALL_KNOWLEDGE, null, 2),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// =============================================================================
// START SERVER
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("cgov Project MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
