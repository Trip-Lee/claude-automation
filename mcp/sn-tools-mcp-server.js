#!/usr/bin/env node

/**
 * MCP Server for ServiceNow Tools
 *
 * Implements the Model Context Protocol (MCP) to expose sn-tools capabilities
 * as native tools that Claude can invoke directly.
 *
 * Protocol: JSON-RPC 2.0 over stdio
 * Transport: Standard input/output (stdio)
 *
 * Usage:
 *   node sn-tools-mcp-server.js
 *
 * Or configure in Claude Code settings:
 *   {
 *     "mcpServers": {
 *       "sn-tools": {
 *         "command": "node",
 *         "args": ["/path/to/mcp/sn-tools-mcp-server.js"]
 *       }
 *     }
 *   }
 */

import { createInterface } from 'readline';
import { ALL_TOOLS } from './tool-schemas.js';
import { executeTool } from './tool-handlers.js';
import { getTraceLogger } from './mcp-trace-logger.js';

/**
 * MCP Server Implementation
 */
class MCPServer {
  constructor() {
    this.serverInfo = {
      name: 'sn-tools',
      version: '1.1.0',
      description: 'ServiceNow dependency tracing and impact analysis tools'
    };

    this.capabilities = {
      tools: {
        listChanged: false
      }
    };

    this.initialized = false;
    this.clientInfo = null;

    // Initialize trace logger for comprehensive MCP tool call tracking
    this.traceLogger = getTraceLogger({
      sessionId: `mcp-${Date.now()}`,
      verbose: true,
      logDir: process.env.MCP_TRACE_LOG_DIR || null,
      autoSave: !!process.env.MCP_TRACE_AUTO_SAVE
    });
  }

  /**
   * Start the MCP server
   */
  async start() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    // Buffer for handling multi-line JSON
    let buffer = '';

    rl.on('line', async (line) => {
      buffer += line;

      // Try to parse the buffer as JSON
      try {
        const request = JSON.parse(buffer);
        buffer = ''; // Clear buffer on successful parse

        const response = await this.handleRequest(request);
        if (response) {
          this.sendResponse(response);
        }
      } catch (error) {
        // If JSON is incomplete, continue buffering
        if (error instanceof SyntaxError && error.message.includes('Unexpected end')) {
          return; // Wait for more input
        }

        // If it's a different error, send error response
        buffer = '';
        this.sendError(null, -32700, 'Parse error', error.message);
      }
    });

    rl.on('close', () => {
      this.shutdown();
    });

    // Log server start to stderr (not stdout which is used for protocol)
    console.error('MCP sn-tools server started');
    console.error(`Server: ${this.serverInfo.name} v${this.serverInfo.version}`);
    console.error('Waiting for requests...');
  }

  /**
   * Handle incoming JSON-RPC request
   */
  async handleRequest(request) {
    const { id, method, params } = request;

    // Log request to stderr
    console.error(`Received request: ${method} (id: ${id})`);

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id, params);

        case 'initialized':
          // Notification from client - no response needed
          console.error('Client initialized notification received');
          return null;

        case 'tools/list':
          return this.handleToolsList(id);

        case 'tools/call':
          return await this.handleToolCall(id, params);

        case 'ping':
          return this.handlePing(id);

        default:
          return this.sendError(id, -32601, 'Method not found', `Unknown method: ${method}`);
      }
    } catch (error) {
      console.error(`Error handling request ${method}:`, error);
      return this.sendError(id, -32603, 'Internal error', error.message);
    }
  }

  /**
   * Handle initialize request
   */
  handleInitialize(id, params) {
    console.error('Handling initialize request');
    console.error('Client info:', JSON.stringify(params?.clientInfo || {}, null, 2));

    this.clientInfo = params?.clientInfo;
    this.initialized = true;

    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: this.serverInfo,
        capabilities: this.capabilities
      }
    };
  }

  /**
   * Handle tools/list request
   */
  handleToolsList(id) {
    console.error(`Returning ${ALL_TOOLS.length} tools`);

    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: ALL_TOOLS.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    };
  }

  /**
   * Handle tools/call request
   */
  async handleToolCall(id, params) {
    if (!this.initialized) {
      return this.sendError(id, -32002, 'Server not initialized', 'Must call initialize first');
    }

    const { name, arguments: toolArgs } = params;
    const startTime = Date.now();

    // Start trace for this tool call
    const trace = this.traceLogger.startTrace(name, toolArgs);

    console.error(`Executing tool: ${name}`);
    console.error('Arguments:', JSON.stringify(toolArgs, null, 2));

    try {
      // Execute the tool using our handler
      const result = await executeTool(name, toolArgs);
      const executionTime = Date.now() - startTime;

      // Complete trace with result
      this.traceLogger.completeTrace(trace, result, executionTime);

      console.error(`Tool ${name} execution completed`);
      console.error('Success:', result.success);

      // Add trace metadata to result for downstream analysis
      const enhancedResult = {
        ...result,
        _trace: {
          id: trace.id,
          executionTimeMs: executionTime,
          timestamp: trace.timestamp
        }
      };

      // Return tool result
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(enhancedResult, null, 2)
            }
          ],
          isError: !result.success
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failed trace
      this.traceLogger.failTrace(trace, error, executionTime);

      console.error(`Tool ${name} execution failed:`, error);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  message: error.message,
                  code: 'EXECUTION_ERROR',
                  stack: error.stack
                },
                data: null,
                _trace: {
                  id: trace.id,
                  executionTimeMs: executionTime,
                  timestamp: trace.timestamp,
                  failed: true
                }
              }, null, 2)
            }
          ],
          isError: true
        }
      };
    }
  }

  /**
   * Handle ping request (for health checks)
   */
  handlePing(id) {
    // Include trace metrics in ping response
    const traceMetrics = this.traceLogger.getAggregateMetrics();

    return {
      jsonrpc: '2.0',
      id,
      result: {
        status: 'ok',
        serverInfo: this.serverInfo,
        uptime: process.uptime(),
        traceMetrics: {
          totalCalls: traceMetrics.totalCalls,
          successRate: traceMetrics.successRate || 0,
          avgExecutionTimeMs: traceMetrics.avgExecutionTimeMs || 0,
          truncationRate: traceMetrics.truncationRate || 0
        }
      }
    };
  }

  /**
   * Send JSON-RPC response to stdout
   */
  sendResponse(response) {
    const responseStr = JSON.stringify(response);
    console.log(responseStr);
    console.error('Response sent');
  }

  /**
   * Send JSON-RPC error response
   */
  sendError(id, code, message, data = null) {
    const error = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data
      }
    };

    console.error(`Sending error: ${code} - ${message}`);
    return error;
  }

  /**
   * Shutdown the server
   */
  async shutdown() {
    console.error('MCP server shutting down');

    // Export trace report before shutdown
    const report = this.traceLogger.generateReport();
    console.error('\n=== MCP Trace Summary ===');
    console.error(`Total calls: ${report.summary.totalCalls}`);
    console.error(`Success rate: ${report.summary.successRate}`);
    console.error(`Avg execution time: ${report.summary.avgExecutionTime}`);
    console.error(`Truncation rate: ${report.summary.truncationRate}`);

    // Log per-tool breakdown
    if (Object.keys(report.byTool).length > 0) {
      console.error('\nPer-tool breakdown:');
      for (const [tool, metrics] of Object.entries(report.byTool)) {
        console.error(`  ${tool}: ${metrics.calls} calls, avg ${metrics.avgTimeMs}ms, ${metrics.avgSizeKB}KB`);
      }
    }

    // Save traces if log directory is configured
    if (this.traceLogger.logDir) {
      try {
        const savedPath = await this.traceLogger.saveToFile();
        console.error(`\nTraces saved to: ${savedPath}`);
      } catch (error) {
        console.error(`Failed to save traces: ${error.message}`);
      }
    }

    console.error('========================\n');
    process.exit(0);
  }
}

/**
 * Main entry point
 */
async function main() {
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
  });

  // Create and start server
  const server = new MCPServer();
  await server.start();
}

// Start the server
main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
