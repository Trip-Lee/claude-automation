/**
 * MCP Tool Handlers for ServiceNow Tools
 *
 * Implements the actual execution logic for each MCP tool.
 * Calls into sn-tools and returns enhanced results.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support configurable sn-tools path via environment variable
const SN_TOOLS_PATH = process.env.SN_TOOLS_PATH || path.join(__dirname, '..', 'tools', 'sn-tools', 'ServiceNow-Tools');

// Import UnifiedTracer from sn-tools
let UnifiedTracer;
try {
  const snToolsPath = path.join(SN_TOOLS_PATH, 'sn-unified-tracer.js');
  const module = await import(snToolsPath);
  UnifiedTracer = module.UnifiedTracer;
} catch (error) {
  console.error('Failed to load sn-tools UnifiedTracer:', error.message);
  console.error(`Tried path: ${SN_TOOLS_PATH}`);
  console.error('Set SN_TOOLS_PATH environment variable or ensure sn-tools is at the default location.');
  process.exit(1);
}

/**
 * Base handler class with common functionality
 */
class ToolHandler {
  constructor() {
    this.tracer = null;
    // Progressive context building configuration
    this.maxResponseSize = 50000; // 50KB default limit
    this.summaryThreshold = 30000; // Start summarizing above 30KB
  }

  /**
   * Get or create tracer instance
   */
  async getTracer() {
    if (!this.tracer) {
      this.tracer = new UnifiedTracer({ verbose: false });
      await this.tracer.ensureLoaded();
    }
    return this.tracer;
  }

  /**
   * Progressive Context Building - Truncate large responses with summaries
   * @param {Object} result - The result to potentially truncate
   * @param {string} toolName - Name of the tool for logging
   * @returns {Object} - Original or truncated result
   */
  applyProgressiveContext(result, toolName) {
    const stringified = JSON.stringify(result, null, 2);
    const sizeChars = stringified.length;
    const sizeKB = (sizeChars / 1024).toFixed(2);

    // Context size monitoring
    console.error(`[MCP Metrics] Tool: ${toolName}`);
    console.error(`[MCP Metrics] Response size: ${sizeChars} chars (${sizeKB} KB)`);

    // Under threshold - return full result
    if (sizeChars <= this.summaryThreshold) {
      console.error(`[MCP Metrics] ✓ Within limits, returning full response`);
      return result;
    }

    // Above summary threshold - create progressive summary
    console.error(`[MCP Metrics] ⚠️  Large response, applying progressive context building`);

    // Build summary based on result structure
    const summary = this.buildSummary(result, toolName);

    // Calculate truncation ratio
    const truncationRatio = (sizeChars / this.maxResponseSize).toFixed(2);

    console.error(`[MCP Metrics] Truncation ratio: ${truncationRatio}x (${sizeChars} → ~${this.maxResponseSize} chars)`);

    return {
      ...summary,
      _context_management: {
        original_size_chars: sizeChars,
        original_size_kb: parseFloat(sizeKB),
        truncated: true,
        truncation_ratio: parseFloat(truncationRatio),
        threshold_kb: this.summaryThreshold / 1024,
        max_size_kb: this.maxResponseSize / 1024,
        message: `Response truncated for context efficiency. Full data available via targeted queries.`
      }
    };
  }

  /**
   * Build intelligent summary of large result
   * @param {Object} result - Full result object
   * @param {string} toolName - Tool name for context
   * @returns {Object} - Summarized result
   */
  buildSummary(result, toolName) {
    const summary = {
      tool: toolName,
      summary: {
        apis_count: result.apis?.length || 0,
        scripts_count: result.scripts?.length || 0,
        tables_count: result.tables?.length || 0,
        components_count: result.components?.length || 0
      },
      key_findings: {},
      metadata: result.metadata || null // Always preserve metadata
    };

    // Include top 5 of each type for context
    if (result.apis?.length > 0) {
      summary.key_findings.top_apis = result.apis.slice(0, 5).map(api => ({
        name: api.name || api,
        method: api.method,
        endpoint: api.endpoint
      }));
      if (result.apis.length > 5) {
        summary.key_findings.additional_apis = result.apis.length - 5;
      }
    }

    if (result.scripts?.length > 0) {
      summary.key_findings.top_scripts = result.scripts.slice(0, 5).map(script => ({
        name: script.name || script,
        type: script.type
      }));
      if (result.scripts.length > 5) {
        summary.key_findings.additional_scripts = result.scripts.length - 5;
      }
    }

    if (result.tables?.length > 0) {
      summary.key_findings.top_tables = result.tables.slice(0, 5).map(table => ({
        name: table.name || table,
        operations: table.crud || table.operations
      }));
      if (result.tables.length > 5) {
        summary.key_findings.additional_tables = result.tables.length - 5;
      }
    }

    // Add drill-down recommendations
    summary.recommendations = [
      'For full API details, use: trace_full_lineage with entity_type="api"',
      'For specific table analysis, use: query_table_schema',
      'For script CRUD operations, use: analyze_script_crud',
      'Consider breaking down analysis into smaller queries'
    ];

    return summary;
  }

  /**
   * Wrap result with success/error structure
   */
  wrapResult(result, error = null, toolName = 'unknown') {
    if (error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code || 'EXECUTION_ERROR',
          details: error.details || null
        },
        data: null
      };
    }

    // Apply progressive context building
    const processedResult = this.applyProgressiveContext(result, toolName);

    return {
      success: true,
      error: null,
      data: processedResult
    };
  }

  /**
   * Handle tool execution with error handling
   */
  async execute(handler, toolName = 'unknown') {
    const startTime = Date.now();

    try {
      const result = await handler();
      const duration = Date.now() - startTime;

      console.error(`[MCP Metrics] Execution time: ${duration}ms`);

      return this.wrapResult(result, null, toolName);
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error('[MCP Metrics] Tool execution error:', error);
      console.error(`[MCP Metrics] Failed after: ${duration}ms`);

      return this.wrapResult(null, error, toolName);
    }
  }
}

/**
 * Handler for trace_component_impact tool
 */
export class TraceComponentImpactHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { component_name } = params;

      if (!component_name) {
        throw new Error('component_name is required');
      }

      const tracer = await this.getTracer();
      const result = await tracer.traceForward(component_name);
      const enhanced = tracer.enhanceWithAIContext(result);

      return enhanced;
    }, 'trace_component_impact');
  }
}

/**
 * Handler for trace_table_dependencies tool
 */
export class TraceTableDependenciesHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { table_name } = params;

      if (!table_name) {
        throw new Error('table_name is required');
      }

      const tracer = await this.getTracer();
      const result = await tracer.traceBackward(table_name);
      const enhanced = tracer.enhanceWithAIContext(result);

      return enhanced;
    }, 'trace_table_dependencies');
  }
}

/**
 * Handler for trace_full_lineage tool
 */
export class TraceFullLineageHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { entity_name, entity_type } = params;

      if (!entity_name) {
        throw new Error('entity_name is required');
      }
      if (!entity_type) {
        throw new Error('entity_type is required');
      }

      const validTypes = ['component', 'api', 'script', 'table'];
      if (!validTypes.includes(entity_type)) {
        throw new Error(`entity_type must be one of: ${validTypes.join(', ')}`);
      }

      const tracer = await this.getTracer();
      const result = await tracer.getFullLineage(entity_name, entity_type);

      // Enhance both forward and backward results if they exist
      if (result.forward) {
        result.forward = tracer.enhanceWithAIContext(result.forward);
      }
      if (result.backward) {
        result.backward = tracer.enhanceWithAIContext(result.backward);
      }

      return result;
    }, 'trace_full_lineage');
  }
}

/**
 * Handler for validate_change_impact tool
 */
export class ValidateChangeImpactHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { change_type, target, operation = 'modify', description } = params;

      if (!change_type) {
        throw new Error('change_type is required');
      }
      if (!target) {
        throw new Error('target is required');
      }

      const tracer = await this.getTracer();
      // validateChange takes (entityType, entityName, description) not an object
      const result = await tracer.validateChange(change_type, target, description || '');

      // Add operation context to the result
      if (result.data) {
        result.data.operation = operation;
      }
      return result;
    }, 'validate_change_impact');
  }
}

/**
 * Handler for query_table_schema tool
 */
export class QueryTableSchemaHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { table_name } = params;

      if (!table_name) {
        throw new Error('table_name is required');
      }

      const tracer = await this.getTracer();

      // Use schema graph to get table schema
      if (tracer.schemaGraph) {
        const schema = await tracer.schemaGraph.getTableSchema(table_name);
        return {
          table: table_name,
          schema: schema,
          success: true
        };
      } else {
        throw new Error('Schema graph not available');
      }
    }, 'query_table_schema');
  }
}

/**
 * Handler for analyze_script_crud tool
 */
export class AnalyzeScriptCrudHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { script_name } = params;

      if (!script_name) {
        throw new Error('script_name is required. Provide a ServiceNow Script Include name like "WorkItemManager" or "CampaignUtils".');
      }

      const tracer = await this.getTracer();
      // Use the query method with 'script-crud' subcommand
      const result = await tracer.query('script-crud', script_name);

      if (!result.success) {
        throw new Error(result.error || `Script Include "${script_name}" not found`);
      }

      return {
        script: script_name,
        crud_operations: result.data.crud_operations || {},
        tables: result.data.tables || [],
        dependencies: result.data.dependencies || {},
        api_name: result.data.api_name,
        success: true
      };
    }, 'analyze_script_crud');
  }
}

/**
 * Handler for refresh_dependency_cache tool
 */
export class RefreshDependencyCacheHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { full_scan = false } = params;

      // This would need to be implemented in sn-tools
      // For now, return a message indicating manual refresh needed
      return {
        success: false,
        message: 'Cache refresh must be performed manually using: npm run refresh-cache',
        command: 'npm run refresh-cache',
        recommendation: 'Run this command from tools/sn-tools/ServiceNow-Tools directory'
      };
    }, 'refresh_dependency_cache');
  }
}

/**
 * Tool handler registry
 */
export const TOOL_HANDLERS = {
  'trace_component_impact': new TraceComponentImpactHandler(),
  'trace_table_dependencies': new TraceTableDependenciesHandler(),
  'trace_full_lineage': new TraceFullLineageHandler(),
  'validate_change_impact': new ValidateChangeImpactHandler(),
  'query_table_schema': new QueryTableSchemaHandler(),
  'analyze_script_crud': new AnalyzeScriptCrudHandler(),
  'refresh_dependency_cache': new RefreshDependencyCacheHandler()
};

/**
 * Execute a tool by name
 */
export async function executeTool(toolName, params) {
  const handler = TOOL_HANDLERS[toolName];

  if (!handler) {
    return {
      success: false,
      error: {
        message: `Unknown tool: ${toolName}`,
        code: 'UNKNOWN_TOOL',
        availableTools: Object.keys(TOOL_HANDLERS)
      },
      data: null
    };
  }

  return await handler.handle(params);
}
