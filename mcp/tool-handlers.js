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
  const snToolsPath = path.join(SN_TOOLS_PATH, 'src', 'sn-unified-tracer.js');
  const module = await import(snToolsPath);
  UnifiedTracer = module.UnifiedTracer;
} catch (error) {
  console.error('Failed to load sn-tools UnifiedTracer:', error.message);
  console.error(`Tried path: ${SN_TOOLS_PATH}`);
  console.error('Set SN_TOOLS_PATH environment variable or ensure sn-tools is at the default location.');
  process.exit(1);
}

// Import UnifiedCache from sn-tools (CommonJS module)
let UnifiedCache;
try {
  // Use createRequire for CommonJS interop
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const cachePath = path.join(SN_TOOLS_PATH, 'src', 'sn-context-cache.js');
  const cacheModule = require(cachePath);
  UnifiedCache = cacheModule.UnifiedCache;
} catch (error) {
  console.error('Failed to load sn-tools UnifiedCache:', error.message);
  // Non-fatal - unified cache tools will be unavailable but legacy tools still work
  UnifiedCache = null;
}

// ============================================================================
// SINGLETON CACHE MANAGER (Issue #2 Fix)
// Ensures all handlers share a single cache instance to avoid redundant disk I/O
// ============================================================================
class CacheManager {
  constructor() {
    this.unifiedCache = null;
    this.initPromise = null;
    this.lastLoadTime = null;
    this.stats = {
      hits: 0,
      misses: 0,
      loadCount: 0,
      totalLoadTimeMs: 0
    };
  }

  /**
   * Get the singleton UnifiedCache instance
   * Thread-safe through promise caching
   */
  async getCache() {
    // Return cached instance if available and loaded
    if (this.unifiedCache && this.unifiedCache.loaded) {
      this.stats.hits++;
      return this.unifiedCache;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.stats.misses++;
    this.initPromise = this._initializeCache();

    try {
      const cache = await this.initPromise;
      return cache;
    } finally {
      this.initPromise = null;
    }
  }

  async _initializeCache() {
    if (!UnifiedCache) {
      console.error('[CacheManager] UnifiedCache class not available');
      return null;
    }

    const startTime = Date.now();

    try {
      this.unifiedCache = new UnifiedCache({ rootPath: SN_TOOLS_PATH });
      await this.unifiedCache.initialize();

      const loadTime = Date.now() - startTime;
      this.lastLoadTime = new Date();
      this.stats.loadCount++;
      this.stats.totalLoadTimeMs += loadTime;

      console.error(`[CacheManager] Cache loaded in ${loadTime}ms (load #${this.stats.loadCount})`);

      return this.unifiedCache;
    } catch (error) {
      console.error('[CacheManager] Failed to initialize cache:', error.message);
      this.unifiedCache = null;
      return null;
    }
  }

  /**
   * Force reload the cache (useful after cache rebuild)
   */
  async reload() {
    this.unifiedCache = null;
    this.initPromise = null;
    return this.getCache();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheLoaded: this.unifiedCache?.loaded || false,
      lastLoadTime: this.lastLoadTime,
      avgLoadTimeMs: this.stats.loadCount > 0
        ? Math.round(this.stats.totalLoadTimeMs / this.stats.loadCount)
        : 0,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1) + '%'
        : 'N/A'
    };
  }
}

// Module-level singleton instance
const cacheManager = new CacheManager();

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
 * Handler for query_execution_context tool
 * Returns what happens when you create/update/delete a record
 * Now uses UnifiedCache for enhanced context including CRUD summaries and rollback strategies
 */
export class QueryExecutionContextHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { table_name, operation = 'insert', include_crud_summary = true } = params;

      if (!table_name) {
        throw new Error('table_name is required. Provide a ServiceNow table name like "incident" or "x_cadso_work_campaign".');
      }

      // Validate operation
      const validOps = ['insert', 'update', 'delete'];
      if (!validOps.includes(operation)) {
        throw new Error(`Invalid operation: ${operation}. Must be one of: ${validOps.join(', ')}`);
      }

      // Try unified cache first (preferred) - uses singleton
      const unifiedCache = await cacheManager.getCache();
      if (unifiedCache && unifiedCache.loaded) {
        const context = unifiedCache.getContext('table', table_name, { operation });

        if (context) {
          const result = {
            success: true,
            table: table_name,
            operation: operation,
            execution_context: context.executionContext || {},
            summary: {
              total_business_rules: context.executionContext?.businessRules?.length || 0,
              before_rules: context.executionContext?.phases?.before?.length || 0,
              after_rules: context.executionContext?.phases?.after?.length || 0,
              async_rules: context.executionContext?.phases?.async?.length || 0,
              risk_level: context.executionContext?.riskLevel || 'UNKNOWN'
            },
            metadata: {
              source: 'unified_cache',
              timestamp: new Date().toISOString()
            }
          };

          // Include CRUD summary if requested (pre-formatted markdown)
          if (include_crud_summary && context.crudSummary) {
            result.crud_summary = context.crudSummary;
          }

          // Include rollback strategy
          if (context.rollbackStrategy) {
            result.rollback_strategy = context.rollbackStrategy;
          }

          return result;
        }
      }

      // Fallback to legacy execution chains
      const cachePath = path.join(SN_TOOLS_PATH, 'ai-context-cache', 'execution-chains', `${table_name}.${operation}.json`);

      try {
        const fs = await import('fs/promises');
        const data = await fs.readFile(cachePath, 'utf8');
        const context = JSON.parse(data);

        // Return structured execution context
        return {
          success: true,
          table: table_name,
          operation: operation,
          execution_context: {
            business_rules: context.businessRules || [],
            phases: context.phases || {},
            fields_auto_set: context.fieldsAutoSet || [],
            tables_affected: context.tablesAffected || [],
            script_includes_involved: context.scriptIncludesInvolved || [],
            risk_level: context.riskLevel || 'UNKNOWN'
          },
          summary: {
            total_business_rules: (context.businessRules || []).length,
            before_rules: (context.phases?.before || []).length,
            after_rules: (context.phases?.after || []).length,
            async_rules: (context.phases?.async || []).length,
            fields_modified: (context.fieldsAutoSet || []).length,
            cascading_tables: (context.tablesAffected || []).length,
            scripts_called: (context.scriptIncludesInvolved || []).length
          },
          metadata: {
            source: 'legacy_execution_chains',
            cache_file: cachePath,
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        if (error.code === 'ENOENT') {
          return {
            success: false,
            table: table_name,
            operation: operation,
            error: `No execution context cached for ${table_name}.${operation}`,
            suggestion: 'Run "npm run unified-build" to build the unified cache, or "npm run cache-build" for legacy execution chains',
            available_operations: 'Check cache/unified-agent-cache.json or ai-context-cache/execution-chains/ for available tables'
          };
        }
        throw error;
      }
    }, 'query_execution_context');
  }
}

/**
 * Handler for refresh_dependency_cache tool
 */
export class RefreshDependencyCacheHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { rebuild_execution_chains = true, full_scan = false } = params;

      const { spawn } = await import('child_process');
      const results = {
        success: true,
        operations: [],
        errors: []
      };

      // Rebuild execution chains if requested
      if (rebuild_execution_chains) {
        try {
          const buildResult = await new Promise((resolve, reject) => {
            const proc = spawn('npm', ['run', 'cache-build'], {
              cwd: SN_TOOLS_PATH,
              shell: true
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data; });
            proc.stderr.on('data', (data) => { stderr += data; });

            proc.on('close', (code) => {
              if (code === 0) {
                resolve({ success: true, output: stdout });
              } else {
                reject(new Error(`cache-build failed with code ${code}: ${stderr}`));
              }
            });

            proc.on('error', reject);

            // Timeout after 60 seconds
            setTimeout(() => reject(new Error('cache-build timed out after 60s')), 60000);
          });

          results.operations.push({
            operation: 'rebuild_execution_chains',
            success: true,
            message: 'Execution chains rebuilt successfully'
          });
        } catch (error) {
          results.errors.push({
            operation: 'rebuild_execution_chains',
            error: error.message
          });
          results.success = false;
        }
      }

      // Count execution chains
      try {
        const fs = await import('fs/promises');
        const chainsDir = path.join(SN_TOOLS_PATH, 'ai-context-cache', 'execution-chains');
        const files = await fs.readdir(chainsDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        results.execution_chains_count = jsonFiles.length;
      } catch (error) {
        results.execution_chains_count = 'unknown';
      }

      return {
        success: results.success,
        message: results.success
          ? `Cache refresh completed. ${results.execution_chains_count} execution chains available.`
          : `Cache refresh had errors: ${results.errors.map(e => e.error).join('; ')}`,
        operations: results.operations,
        errors: results.errors,
        execution_chains_count: results.execution_chains_count,
        timestamp: new Date().toISOString()
      };
    }, 'refresh_dependency_cache');
  }
}

/**
 * Handler for query_unified_context tool
 * Single unified query for all context types
 */
export class QueryUnifiedContextHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { entity_type, entity_name, operation } = params;

      if (!entity_type) {
        throw new Error('entity_type is required. Valid types: table, script_include, api, component');
      }
      if (!entity_name) {
        throw new Error('entity_name is required. Provide the name of the entity to query.');
      }

      const validTypes = ['table', 'script_include', 'api', 'component'];
      if (!validTypes.includes(entity_type)) {
        throw new Error(`Invalid entity_type: ${entity_type}. Must be one of: ${validTypes.join(', ')}`);
      }

      // Uses singleton cache manager
      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache || !unifiedCache.loaded) {
        return {
          success: false,
          error: 'Unified cache not available. Run "npm run unified-build" to build it.',
          suggestion: 'Build the unified cache first using: cd tools/sn-tools/ServiceNow-Tools && npm run unified-build'
        };
      }

      const context = unifiedCache.getContext(entity_type, entity_name, { operation });

      if (!context) {
        return {
          success: false,
          entity_type,
          entity_name,
          error: `No context found for ${entity_type} "${entity_name}"`,
          suggestion: `Check if ${entity_name} exists in the codebase and rebuild cache if needed`
        };
      }

      return {
        success: true,
        entity_type,
        entity_name,
        context,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_unified_context');
  }
}

/**
 * Handler for query_crud_summary tool
 * Returns pre-formatted CRUD summary markdown
 */
export class QueryCrudSummaryHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { entity_type, entity_name } = params;

      if (!entity_type) {
        throw new Error('entity_type is required. Valid types: table, script_include');
      }
      if (!entity_name) {
        throw new Error('entity_name is required. Provide the name of the entity.');
      }

      const validTypes = ['table', 'script_include'];
      if (!validTypes.includes(entity_type)) {
        throw new Error(`Invalid entity_type: ${entity_type}. Must be one of: ${validTypes.join(', ')}`);
      }

      // Uses singleton cache manager
      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache || !unifiedCache.loaded) {
        return {
          success: false,
          error: 'Unified cache not available. Run "npm run unified-build" to build it.'
        };
      }

      const summary = unifiedCache.getCrudSummary(entity_type, entity_name);

      if (!summary) {
        return {
          success: false,
          entity_type,
          entity_name,
          error: `No CRUD summary found for ${entity_type} "${entity_name}"`
        };
      }

      return {
        success: true,
        entity_type,
        entity_name,
        crud_summary: summary,
        metadata: {
          source: 'unified_cache',
          format: 'markdown',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_crud_summary');
  }
}

/**
 * Handler for query_table_relationships tool
 * Returns cross-table relationships and cascading patterns
 */
export class QueryTableRelationshipsHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { table_name } = params;

      if (!table_name) {
        throw new Error('table_name is required. Provide a ServiceNow table name.');
      }

      // Uses singleton cache manager
      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache || !unifiedCache.loaded) {
        return {
          success: false,
          error: 'Unified cache not available. Run "npm run unified-build" to build it.'
        };
      }

      const relationships = unifiedCache.getTableRelationships(table_name);

      if (!relationships) {
        return {
          success: false,
          table_name,
          error: `No relationships found for table "${table_name}"`
        };
      }

      return {
        success: true,
        table_name,
        relationships,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_table_relationships');
  }
}

/**
 * Handler for query_impact_template tool
 * Returns impact assessment templates for change planning
 */
export class QueryImpactTemplateHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { entity_type } = params;

      if (!entity_type) {
        throw new Error('entity_type is required. Valid types: table, script_include, api, component');
      }

      const validTypes = ['table', 'script_include', 'api', 'component'];
      if (!validTypes.includes(entity_type)) {
        throw new Error(`Invalid entity_type: ${entity_type}. Must be one of: ${validTypes.join(', ')}`);
      }

      // Uses singleton cache manager
      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache || !unifiedCache.loaded) {
        return {
          success: false,
          error: 'Unified cache not available. Run "npm run unified-build" to build it.'
        };
      }

      const template = unifiedCache.getImpactTemplate(entity_type);

      if (!template) {
        return {
          success: false,
          entity_type,
          error: `No impact template found for entity type "${entity_type}"`
        };
      }

      return {
        success: true,
        entity_type,
        impact_template: template,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_impact_template');
  }
}

/**
 * Handler for query_reverse_dependencies tool
 * Returns "what uses this" information
 */
export class QueryReverseDependenciesHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { entity_type, entity_name } = params;

      if (!entity_type) {
        throw new Error('entity_type is required. Valid types: table, script_include, api');
      }
      if (!entity_name) {
        throw new Error('entity_name is required. Provide the name of the entity.');
      }

      const validTypes = ['table', 'script_include', 'api'];
      if (!validTypes.includes(entity_type)) {
        throw new Error(`Invalid entity_type: ${entity_type}. Must be one of: ${validTypes.join(', ')}`);
      }

      // Uses singleton cache manager
      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache || !unifiedCache.loaded) {
        return {
          success: false,
          error: 'Unified cache not available. Run "npm run unified-build" to build it.'
        };
      }

      const dependencies = unifiedCache.getReverseDependencies(entity_type, entity_name);

      if (!dependencies || dependencies.length === 0) {
        return {
          success: true,
          entity_type,
          entity_name,
          reverse_dependencies: [],
          message: `No reverse dependencies found for ${entity_type} "${entity_name}" - it may not be used by other entities`
        };
      }

      return {
        success: true,
        entity_type,
        entity_name,
        reverse_dependencies: dependencies,
        count: dependencies.length,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_reverse_dependencies');
  }
}

/**
 * Handler for get_cache_stats tool
 * Returns cache manager statistics for monitoring
 */
export class GetCacheStatsHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const stats = cacheManager.getStats();

      return {
        success: true,
        cache_stats: stats,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    }, 'get_cache_stats');
  }
}

// ============================================================================
// FLOW DESIGNER TOOL HANDLERS
// Query and analyze ServiceNow Flow Designer flows
// ============================================================================

/**
 * Handler for query_flow tool
 * Returns details about a specific flow
 */
export class QueryFlowHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { flow_identifier } = params;

      if (!flow_identifier) {
        return {
          success: false,
          error: 'flow_identifier is required'
        };
      }

      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache) {
        return {
          success: false,
          error: 'Unified cache not available'
        };
      }

      const flow = unifiedCache.getFlow(flow_identifier);

      return {
        success: true,
        ...flow,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_flow');
  }
}

/**
 * Handler for query_flows_for_table tool
 * Returns all flows that affect a specific table
 */
export class QueryFlowsForTableHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { table_name } = params;

      if (!table_name) {
        return {
          success: false,
          error: 'table_name is required'
        };
      }

      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache) {
        return {
          success: false,
          error: 'Unified cache not available'
        };
      }

      const flows = unifiedCache.getFlowsForTable(table_name);

      return {
        success: true,
        ...flows,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_flows_for_table');
  }
}

/**
 * Handler for query_flow_impact tool
 * Returns flow impact preview for a table operation
 */
export class QueryFlowImpactHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { table_name, operation = 'insert' } = params;

      if (!table_name) {
        return {
          success: false,
          error: 'table_name is required'
        };
      }

      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache) {
        return {
          success: false,
          error: 'Unified cache not available'
        };
      }

      const impact = unifiedCache.getFlowImpactPreview(table_name, operation);

      return {
        success: true,
        ...impact,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_flow_impact');
  }
}

/**
 * Handler for search_flows tool
 * Searches flows by name, description, or application
 */
export class SearchFlowsHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const { query } = params;

      if (!query) {
        return {
          success: false,
          error: 'query is required'
        };
      }

      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache) {
        return {
          success: false,
          error: 'Unified cache not available'
        };
      }

      const results = unifiedCache.searchFlows(query);

      return {
        success: true,
        ...results,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'search_flows');
  }
}

/**
 * Handler for query_flow_statistics tool
 * Returns overall flow statistics
 */
export class QueryFlowStatisticsHandler extends ToolHandler {
  async handle(params) {
    return this.execute(async () => {
      const unifiedCache = await cacheManager.getCache();
      if (!unifiedCache) {
        return {
          success: false,
          error: 'Unified cache not available'
        };
      }

      const statistics = unifiedCache.getFlowStatistics();

      return {
        success: true,
        statistics,
        metadata: {
          source: 'unified_cache',
          timestamp: new Date().toISOString()
        }
      };
    }, 'query_flow_statistics');
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
  'refresh_dependency_cache': new RefreshDependencyCacheHandler(),
  'query_execution_context': new QueryExecutionContextHandler(),
  // New unified cache tools
  'query_unified_context': new QueryUnifiedContextHandler(),
  'query_crud_summary': new QueryCrudSummaryHandler(),
  'query_table_relationships': new QueryTableRelationshipsHandler(),
  'query_impact_template': new QueryImpactTemplateHandler(),
  'query_reverse_dependencies': new QueryReverseDependenciesHandler(),
  'get_cache_stats': new GetCacheStatsHandler(),
  // Flow Designer tools
  'query_flow': new QueryFlowHandler(),
  'query_flows_for_table': new QueryFlowsForTableHandler(),
  'query_flow_impact': new QueryFlowImpactHandler(),
  'search_flows': new SearchFlowsHandler(),
  'query_flow_statistics': new QueryFlowStatisticsHandler()
};

// Export cache manager for external access (e.g., reload after cache rebuild)
export { cacheManager };

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
