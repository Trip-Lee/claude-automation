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
 * All available tool schemas
 */
export const ALL_TOOLS = [
  TRACE_COMPONENT_IMPACT,
  TRACE_TABLE_DEPENDENCIES,
  TRACE_FULL_LINEAGE,
  VALIDATE_CHANGE_IMPACT,
  QUERY_TABLE_SCHEMA,
  ANALYZE_SCRIPT_CRUD,
  REFRESH_DEPENDENCY_CACHE
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
