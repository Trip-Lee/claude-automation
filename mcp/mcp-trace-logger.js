/**
 * MCP Trace Logger
 *
 * Comprehensive logging system for MCP tool calls that captures:
 * - Tool invocations with timestamps and parameters
 * - Response sizes and truncation events
 * - Execution timing and performance metrics
 * - Agent decision context (when available)
 * - Full audit trail for debugging and analysis
 *
 * Priority 1: MCP Tool Call Tracing Implementation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * Trace entry structure for a single MCP tool call
 */
class TraceEntry {
  constructor(toolName, params) {
    this.id = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date().toISOString();
    this.timestampMs = Date.now();
    this.toolName = toolName;
    this.params = this.sanitizeParams(params);
    this.status = 'pending';
    this.response = null;
    this.metrics = {
      executionTimeMs: 0,
      responseSizeChars: 0,
      responseSizeKB: 0,
      truncated: false,
      truncationRatio: null
    };
    this.context = {
      confidence: null,
      suggestions: [],
      aiContext: null
    };
    this.error = null;
  }

  /**
   * Sanitize params to remove sensitive data
   */
  sanitizeParams(params) {
    if (!params) return {};

    const sanitized = { ...params };
    // Remove any potential secrets
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  /**
   * Mark trace as completed with response data
   */
  complete(response, executionTimeMs) {
    this.status = 'completed';
    this.metrics.executionTimeMs = executionTimeMs;

    // Calculate response size
    const responseStr = JSON.stringify(response);
    this.metrics.responseSizeChars = responseStr.length;
    this.metrics.responseSizeKB = parseFloat((responseStr.length / 1024).toFixed(2));

    // Check for truncation
    if (response?._context_management?.truncated) {
      this.metrics.truncated = true;
      this.metrics.truncationRatio = response._context_management.truncation_ratio;
      this.metrics.originalSizeKB = response._context_management.original_size_kb;
    }

    // Extract AI context if available
    if (response?.data?._aiContext) {
      this.context.confidence = response.data._aiContext.confidence;
      this.context.suggestions = response.data._aiContext.suggestions || [];
      this.context.aiContext = response.data._aiContext;
    }

    // Store summarized response (not full data to keep logs manageable)
    this.response = this.summarizeResponse(response);
  }

  /**
   * Mark trace as failed
   */
  fail(error, executionTimeMs) {
    this.status = 'failed';
    this.metrics.executionTimeMs = executionTimeMs;
    this.error = {
      message: error.message || String(error),
      code: error.code || 'UNKNOWN_ERROR',
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    };
  }

  /**
   * Create a summarized version of the response for logging
   */
  summarizeResponse(response) {
    if (!response) return null;

    const summary = {
      success: response.success,
      hasData: !!response.data,
      dataType: response.data ? typeof response.data : null
    };

    // Include counts if available
    if (response.data) {
      if (response.data.apis) summary.apisCount = response.data.apis.length;
      if (response.data.scripts) summary.scriptsCount = response.data.scripts.length;
      if (response.data.tables) summary.tablesCount = response.data.tables.length;
      if (response.data.components) summary.componentsCount = response.data.components.length;
      if (response.data.summary) summary.summary = response.data.summary;
    }

    return summary;
  }

  /**
   * Export trace entry for analysis
   */
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      timestampMs: this.timestampMs,
      toolName: this.toolName,
      params: this.params,
      status: this.status,
      response: this.response,
      metrics: this.metrics,
      context: this.context,
      error: this.error
    };
  }
}

/**
 * MCP Trace Logger - Main class for logging and analyzing MCP tool calls
 */
export class MCPTraceLogger extends EventEmitter {
  constructor(options = {}) {
    super();

    this.traces = [];
    this.sessionId = options.sessionId || `session-${Date.now()}`;
    this.maxTraces = options.maxTraces || 1000;
    this.logDir = options.logDir || null;
    this.verbose = options.verbose !== false;
    this.autoSave = options.autoSave || false;
    this.autoSaveInterval = options.autoSaveInterval || 60000; // 1 minute

    // Aggregate metrics
    this.aggregateMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalExecutionTimeMs: 0,
      totalResponseSizeKB: 0,
      truncatedResponses: 0,
      byTool: {}
    };

    // Start auto-save if enabled
    if (this.autoSave && this.logDir) {
      this._startAutoSave();
    }
  }

  /**
   * Start a new trace for a tool call
   */
  startTrace(toolName, params) {
    const trace = new TraceEntry(toolName, params);
    this.traces.push(trace);

    // Emit event for real-time monitoring
    this.emit('traceStart', trace);

    if (this.verbose) {
      console.error(`[MCPTrace] START ${trace.id} | Tool: ${toolName}`);
      console.error(`[MCPTrace] Params: ${JSON.stringify(params, null, 2)}`);
    }

    // Trim old traces if over limit
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }

    return trace;
  }

  /**
   * Complete a trace with response data
   */
  completeTrace(trace, response, executionTimeMs) {
    trace.complete(response, executionTimeMs);
    this._updateAggregateMetrics(trace);

    // Emit event for real-time monitoring
    this.emit('traceComplete', trace);

    if (this.verbose) {
      console.error(`[MCPTrace] COMPLETE ${trace.id} | ${executionTimeMs}ms | ${trace.metrics.responseSizeKB}KB`);
      if (trace.metrics.truncated) {
        console.error(`[MCPTrace] TRUNCATED: ${trace.metrics.truncationRatio}x reduction`);
      }
      if (trace.context.confidence) {
        console.error(`[MCPTrace] Confidence: ${trace.context.confidence}`);
      }
    }

    return trace;
  }

  /**
   * Mark a trace as failed
   */
  failTrace(trace, error, executionTimeMs) {
    trace.fail(error, executionTimeMs);
    this._updateAggregateMetrics(trace);

    // Emit event for real-time monitoring
    this.emit('traceFailed', trace);

    if (this.verbose) {
      console.error(`[MCPTrace] FAILED ${trace.id} | ${executionTimeMs}ms | ${error.message}`);
    }

    return trace;
  }

  /**
   * Update aggregate metrics after a trace completes
   */
  _updateAggregateMetrics(trace) {
    this.aggregateMetrics.totalCalls++;

    if (trace.status === 'completed') {
      this.aggregateMetrics.successfulCalls++;
    } else if (trace.status === 'failed') {
      this.aggregateMetrics.failedCalls++;
    }

    this.aggregateMetrics.totalExecutionTimeMs += trace.metrics.executionTimeMs;
    this.aggregateMetrics.totalResponseSizeKB += trace.metrics.responseSizeKB;

    if (trace.metrics.truncated) {
      this.aggregateMetrics.truncatedResponses++;
    }

    // Update per-tool metrics
    if (!this.aggregateMetrics.byTool[trace.toolName]) {
      this.aggregateMetrics.byTool[trace.toolName] = {
        calls: 0,
        successful: 0,
        failed: 0,
        totalTimeMs: 0,
        totalSizeKB: 0,
        truncated: 0,
        avgTimeMs: 0,
        avgSizeKB: 0
      };
    }

    const toolMetrics = this.aggregateMetrics.byTool[trace.toolName];
    toolMetrics.calls++;
    if (trace.status === 'completed') toolMetrics.successful++;
    if (trace.status === 'failed') toolMetrics.failed++;
    toolMetrics.totalTimeMs += trace.metrics.executionTimeMs;
    toolMetrics.totalSizeKB += trace.metrics.responseSizeKB;
    if (trace.metrics.truncated) toolMetrics.truncated++;
    toolMetrics.avgTimeMs = Math.round(toolMetrics.totalTimeMs / toolMetrics.calls);
    toolMetrics.avgSizeKB = parseFloat((toolMetrics.totalSizeKB / toolMetrics.calls).toFixed(2));
  }

  /**
   * Get all traces for a specific tool
   */
  getTracesByTool(toolName) {
    return this.traces.filter(t => t.toolName === toolName);
  }

  /**
   * Get failed traces
   */
  getFailedTraces() {
    return this.traces.filter(t => t.status === 'failed');
  }

  /**
   * Get truncated traces
   */
  getTruncatedTraces() {
    return this.traces.filter(t => t.metrics.truncated);
  }

  /**
   * Get traces within a time range
   */
  getTracesByTimeRange(startMs, endMs) {
    return this.traces.filter(t =>
      t.timestampMs >= startMs && t.timestampMs <= endMs
    );
  }

  /**
   * Get aggregate metrics
   */
  getAggregateMetrics() {
    const metrics = { ...this.aggregateMetrics };

    // Calculate averages
    if (metrics.totalCalls > 0) {
      metrics.avgExecutionTimeMs = Math.round(metrics.totalExecutionTimeMs / metrics.totalCalls);
      metrics.avgResponseSizeKB = parseFloat((metrics.totalResponseSizeKB / metrics.totalCalls).toFixed(2));
      metrics.successRate = parseFloat(((metrics.successfulCalls / metrics.totalCalls) * 100).toFixed(1));
      metrics.truncationRate = parseFloat(((metrics.truncatedResponses / metrics.totalCalls) * 100).toFixed(1));
    }

    return metrics;
  }

  /**
   * Generate a detailed report of all traces
   */
  generateReport() {
    const metrics = this.getAggregateMetrics();

    return {
      sessionId: this.sessionId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalCalls: metrics.totalCalls,
        successRate: `${metrics.successRate || 0}%`,
        avgExecutionTime: `${metrics.avgExecutionTimeMs || 0}ms`,
        avgResponseSize: `${metrics.avgResponseSizeKB || 0}KB`,
        truncationRate: `${metrics.truncationRate || 0}%`
      },
      byTool: metrics.byTool,
      recentTraces: this.traces.slice(-20).map(t => t.toJSON()),
      failedTraces: this.getFailedTraces().map(t => t.toJSON()),
      truncatedTraces: this.getTruncatedTraces().slice(-10).map(t => t.toJSON())
    };
  }

  /**
   * Export all traces to JSON
   */
  exportTraces() {
    return {
      sessionId: this.sessionId,
      exportedAt: new Date().toISOString(),
      traceCount: this.traces.length,
      aggregateMetrics: this.getAggregateMetrics(),
      traces: this.traces.map(t => t.toJSON())
    };
  }

  /**
   * Save traces to file
   */
  async saveToFile(filePath = null) {
    const targetPath = filePath || path.join(
      this.logDir || process.cwd(),
      `mcp-traces-${this.sessionId}.json`
    );

    const data = this.exportTraces();
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2));

    if (this.verbose) {
      console.error(`[MCPTrace] Saved ${this.traces.length} traces to ${targetPath}`);
    }

    return targetPath;
  }

  /**
   * Load traces from file
   */
  async loadFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Reconstruct trace entries
    this.sessionId = data.sessionId;
    this.traces = data.traces.map(t => {
      const trace = new TraceEntry(t.toolName, t.params);
      Object.assign(trace, t);
      return trace;
    });

    // Recalculate aggregate metrics
    this.aggregateMetrics = data.aggregateMetrics || this._recalculateAggregates();

    if (this.verbose) {
      console.error(`[MCPTrace] Loaded ${this.traces.length} traces from ${filePath}`);
    }

    return this;
  }

  /**
   * Recalculate aggregate metrics from traces
   */
  _recalculateAggregates() {
    this.aggregateMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalExecutionTimeMs: 0,
      totalResponseSizeKB: 0,
      truncatedResponses: 0,
      byTool: {}
    };

    for (const trace of this.traces) {
      this._updateAggregateMetrics(trace);
    }

    return this.aggregateMetrics;
  }

  /**
   * Start auto-save timer
   */
  _startAutoSave() {
    this._autoSaveTimer = setInterval(async () => {
      if (this.traces.length > 0) {
        try {
          await this.saveToFile();
        } catch (error) {
          console.error('[MCPTrace] Auto-save failed:', error.message);
        }
      }
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }

  /**
   * Clear all traces
   */
  clear() {
    this.traces = [];
    this.aggregateMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalExecutionTimeMs: 0,
      totalResponseSizeKB: 0,
      truncatedResponses: 0,
      byTool: {}
    };
  }
}

// Singleton instance for global access
let globalLogger = null;

/**
 * Get or create global trace logger instance
 */
export function getTraceLogger(options = {}) {
  if (!globalLogger) {
    globalLogger = new MCPTraceLogger(options);
  }
  return globalLogger;
}

/**
 * Reset global trace logger (for testing)
 */
export function resetTraceLogger() {
  if (globalLogger) {
    globalLogger.stopAutoSave();
    globalLogger.clear();
  }
  globalLogger = null;
}

export default MCPTraceLogger;
