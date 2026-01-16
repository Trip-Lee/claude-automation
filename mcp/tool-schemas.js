/**
 * MCP Tool Schemas for ServiceNow Tools
 *
 * Defines the tool schemas that Claude can invoke via MCP protocol.
 * Each tool corresponds to a capability in sn-tools.
 */

/**
 * Tool schema for tracing component impact forward
 */
export const TRACE_COMPONENT_IMPACT = {
  name: 'trace_component_impact',
  description: 'Trace a ServiceNow UI component forward to discover which APIs, Script Includes, and database tables it depends on. Returns enhanced results with confidence scoring and suggested next actions.',
  inputSchema: {
    type: 'object',
    properties: {
      component_name: {
        type: 'string',
        description: 'Name of the UI component to trace (e.g., "WorkCampaignBoard", "IncidentList")'
      }
    },
    required: ['component_name']
  }
};

/**
 * Tool schema for tracing table dependencies backward
 */
export const TRACE_TABLE_DEPENDENCIES = {
  name: 'trace_table_dependencies',
  description: 'Trace a ServiceNow database table backward to discover which Script Includes, APIs, and UI components depend on it. Useful for impact analysis before making table changes.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'Name of the table to trace (e.g., "x_cadso_work_campaign", "incident")'
      }
    },
    required: ['table_name']
  }
};

/**
 * Tool schema for getting full lineage
 */
export const TRACE_FULL_LINEAGE = {
  name: 'trace_full_lineage',
  description: 'Get complete bidirectional lineage for any ServiceNow entity (component, API, script, or table). Shows both forward dependencies (what it uses) and backward dependencies (what uses it).',
  inputSchema: {
    type: 'object',
    properties: {
      entity_name: {
        type: 'string',
        description: 'Name of the entity to trace'
      },
      entity_type: {
        type: 'string',
        enum: ['component', 'api', 'script', 'table'],
        description: 'Type of the entity being traced'
      }
    },
    required: ['entity_name', 'entity_type']
  }
};

/**
 * Tool schema for validating change impact
 */
export const VALIDATE_CHANGE_IMPACT = {
  name: 'validate_change_impact',
  description: 'Validate the impact of a proposed change to a ServiceNow component, API, script, or table. Returns warnings, errors, affected components, and risk assessment.',
  inputSchema: {
    type: 'object',
    properties: {
      change_type: {
        type: 'string',
        enum: ['component', 'api', 'script', 'table'],
        description: 'Type of entity being changed'
      },
      target: {
        type: 'string',
        description: 'Name of the entity being changed'
      },
      operation: {
        type: 'string',
        enum: ['modify', 'delete', 'create'],
        description: 'Type of operation being performed',
        default: 'modify'
      },
      description: {
        type: 'string',
        description: 'Optional description of the change being made'
      }
    },
    required: ['change_type', 'target']
  }
};

/**
 * Tool schema for querying table schema
 */
export const QUERY_TABLE_SCHEMA = {
  name: 'query_table_schema',
  description: 'Get detailed schema information for a ServiceNow table including fields, data types, relationships, and reference fields.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'Name of the table to query'
      }
    },
    required: ['table_name']
  }
};

/**
 * Tool schema for analyzing script CRUD operations
 */
export const ANALYZE_SCRIPT_CRUD = {
  name: 'analyze_script_crud',
  description: 'Analyze a Script Include to determine which database tables it accesses and what CRUD operations (Create, Read, Update, Delete) it performs on each table.',
  inputSchema: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: 'Name of the Script Include to analyze'
      }
    },
    required: ['script_name']
  }
};

/**
 * Tool schema for refreshing dependency cache
 */
export const REFRESH_DEPENDENCY_CACHE = {
  name: 'refresh_dependency_cache',
  description: 'Refresh the ServiceNow dependency cache to ensure tracing operations use the latest data. Run this if cache is stale (>72 hours old) or after making significant changes to ServiceNow.',
  inputSchema: {
    type: 'object',
    properties: {
      full_scan: {
        type: 'boolean',
        description: 'Whether to perform a full scan (true) or incremental update (false)',
        default: false
      }
    }
  }
};

/**
 * Tool schema for querying execution context
 * Returns what happens when you create/update/delete a record
 */
export const QUERY_EXECUTION_CONTEXT = {
  name: 'query_execution_context',
  description: 'Query what happens when you create, update, or delete a record on a ServiceNow table. Returns Business Rules that fire (in order), fields that are auto-set, cascading records created, Script Includes called, and risk level. Use this BEFORE creating or modifying records to understand side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'Name of the table (e.g., "incident", "x_cadso_work_campaign")'
      },
      operation: {
        type: 'string',
        enum: ['insert', 'update', 'delete'],
        description: 'The operation to simulate',
        default: 'insert'
      }
    },
    required: ['table_name']
  }
};

/**
 * Tool schema for querying unified context
 * Single interface for all context types from the unified cache
 */
export const QUERY_UNIFIED_CONTEXT = {
  name: 'query_unified_context',
  description: 'Query the unified cache for full context about any ServiceNow entity. Returns pre-computed CRUD summaries, dependency diagrams, execution context, and rollback strategies in a single query. Use this as your primary context source before making changes.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['table', 'script_include', 'api', 'component'],
        description: 'Type of entity to query'
      },
      entity_name: {
        type: 'string',
        description: 'Name of the entity (e.g., "x_cadso_work_campaign", "CampaignUtils")'
      },
      operation: {
        type: 'string',
        enum: ['insert', 'update', 'delete'],
        description: 'Optional: specific operation for table context (insert, update, delete)'
      }
    },
    required: ['entity_type', 'entity_name']
  }
};

/**
 * Tool schema for querying CRUD summaries
 * Returns pre-formatted markdown tables
 */
export const QUERY_CRUD_SUMMARY = {
  name: 'query_crud_summary',
  description: 'Get a pre-formatted CRUD summary for a table or script include. Returns markdown tables showing Create, Read, Update, Delete operations, business rules, and risk levels. Perfect for including in responses to users.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['table', 'script_include'],
        description: 'Type of entity to get CRUD summary for'
      },
      entity_name: {
        type: 'string',
        description: 'Name of the entity'
      }
    },
    required: ['entity_type', 'entity_name']
  }
};

/**
 * Tool schema for querying table relationships
 * Returns cross-table dependencies and cascading patterns
 */
export const QUERY_TABLE_RELATIONSHIPS = {
  name: 'query_table_relationships',
  description: 'Get cross-table relationships for a ServiceNow table. Shows parent tables, child tables, reference fields, and cascading patterns. Essential for understanding impact of table changes.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'Name of the table to query relationships for'
      }
    },
    required: ['table_name']
  }
};

/**
 * Tool schema for querying impact templates
 * Returns checklists for change planning
 */
export const QUERY_IMPACT_TEMPLATE = {
  name: 'query_impact_template',
  description: 'Get an impact assessment template for a specific entity type. Returns a checklist of considerations for change planning, including rollback strategies, testing requirements, and deployment notes.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['table', 'script_include', 'api', 'component'],
        description: 'Type of entity to get impact template for'
      }
    },
    required: ['entity_type']
  }
};

/**
 * Tool schema for querying reverse dependencies
 * Returns "what uses this" information
 */
export const QUERY_REVERSE_DEPENDENCIES = {
  name: 'query_reverse_dependencies',
  description: 'Find what entities depend on a given table, script include, or API. Returns a list of dependent entities that would be affected by changes. Critical for impact analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['table', 'script_include', 'api'],
        description: 'Type of entity to find dependencies for'
      },
      entity_name: {
        type: 'string',
        description: 'Name of the entity'
      }
    },
    required: ['entity_type', 'entity_name']
  }
};

/**
 * Tool schema for querying flow details
 * Returns flow metadata, triggers, table operations
 */
export const QUERY_FLOW = {
  name: 'query_flow',
  description: 'Get details about a ServiceNow Flow Designer flow or subflow. Returns flow metadata, triggers, table operations, and script include dependencies.',
  inputSchema: {
    type: 'object',
    properties: {
      flow_identifier: {
        type: 'string',
        description: 'Flow name or sys_id to query'
      }
    },
    required: ['flow_identifier']
  }
};

/**
 * Tool schema for querying flows that affect a table
 */
export const QUERY_FLOWS_FOR_TABLE = {
  name: 'query_flows_for_table',
  description: 'Find all Flow Designer flows that affect a specific table. Returns flows that trigger on table operations or reference the table in their steps.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'Name of the table to find flows for'
      }
    },
    required: ['table_name']
  }
};

/**
 * Tool schema for flow impact preview
 * Shows which flows will trigger for a table operation
 */
export const QUERY_FLOW_IMPACT = {
  name: 'query_flow_impact',
  description: 'Get flow impact preview for a table operation. Shows which flows will trigger, their conditions, and risk assessment. Use this BEFORE creating or modifying records to understand flow side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'Name of the table'
      },
      operation: {
        type: 'string',
        enum: ['insert', 'update', 'delete'],
        description: 'The operation to check impact for',
        default: 'insert'
      }
    },
    required: ['table_name']
  }
};

/**
 * Tool schema for searching flows
 */
export const SEARCH_FLOWS = {
  name: 'search_flows',
  description: 'Search for Flow Designer flows by name, description, or application. Returns matching flows with their metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (flow name, description, or application)'
      }
    },
    required: ['query']
  }
};

/**
 * Tool schema for flow statistics
 */
export const QUERY_FLOW_STATISTICS = {
  name: 'query_flow_statistics',
  description: 'Get overall statistics about Flow Designer flows in the instance. Returns counts by type, application, and tables affected.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

/**
 * All available tool schemas
 */
export const ALL_TOOLS = [
  TRACE_COMPONENT_IMPACT,
  TRACE_TABLE_DEPENDENCIES,
  TRACE_FULL_LINEAGE,
  VALIDATE_CHANGE_IMPACT,
  QUERY_TABLE_SCHEMA,
  ANALYZE_SCRIPT_CRUD,
  REFRESH_DEPENDENCY_CACHE,
  QUERY_EXECUTION_CONTEXT,
  // New unified cache tools
  QUERY_UNIFIED_CONTEXT,
  QUERY_CRUD_SUMMARY,
  QUERY_TABLE_RELATIONSHIPS,
  QUERY_IMPACT_TEMPLATE,
  QUERY_REVERSE_DEPENDENCIES,
  // Flow Designer tools
  QUERY_FLOW,
  QUERY_FLOWS_FOR_TABLE,
  QUERY_FLOW_IMPACT,
  SEARCH_FLOWS,
  QUERY_FLOW_STATISTICS
];

/**
 * Get tool schema by name
 */
export function getToolSchema(name) {
  return ALL_TOOLS.find(tool => tool.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames() {
  return ALL_TOOLS.map(tool => tool.name);
}
