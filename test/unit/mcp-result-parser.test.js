#!/usr/bin/env node

/**
 * Unit tests for MCP Result Parser
 *
 * Tests the parsing of MCP tool usage patterns from conversation history
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  McpResultParser,
  McpCallType,
  McpAvoidanceReason
} from '../lib/mcp-result-parser.js';

describe('McpResultParser', () => {
  let parser;

  beforeEach(() => {
    parser = new McpResultParser({ verbose: false });
  });

  describe('extractMcpToolCalls', () => {
    it('should detect MCP tool names with parameters in response', () => {
      const turn = {
        turn: 1,
        response: `I'll use the trace_component_impact tool with parameters:
        \`\`\`json
        {
          "component_name": "WorkCampaignBoard"
        }
        \`\`\`
        The result shows...`
      };

      const calls = parser.extractMcpToolCalls(turn, 1);
      assert.ok(calls.length > 0, 'Should detect tool call');
      assert.ok(calls.some(c => c.toolName === 'trace_component_impact'), 'Should identify correct tool');
    });

    it('should detect _trace metadata in responses', () => {
      const turn = {
        turn: 1,
        response: JSON.stringify({
          success: true,
          data: { apis: [] },
          _trace: {
            id: 'trace-123',
            executionTimeMs: 150,
            timestamp: '2024-01-01T00:00:00Z'
          }
        })
      };

      const calls = parser.extractMcpToolCalls(turn, 1);
      assert.ok(calls.some(c => c.traceId === 'trace-123'), 'Should extract trace ID');
      assert.ok(calls.some(c => c.executionTimeMs === 150), 'Should extract execution time');
    });

    it('should detect [MCPTrace] log entries', () => {
      const turn = {
        turn: 1,
        response: `[MCPTrace] START trace-abc123 | Tool: trace_component_impact
        Processing...
        [MCPTrace] COMPLETE trace-abc123 | 200ms | 15.5KB`
      };

      const calls = parser.extractMcpToolCalls(turn, 1);
      assert.ok(calls.some(c => c.source === 'mcp_trace_log'), 'Should detect trace log');
      assert.ok(calls.some(c => c.toolName === 'trace_component_impact'), 'Should extract tool name');
    });
  });

  describe('extractBashCommands', () => {
    it('should detect npm run sn-tools commands', () => {
      const turn = {
        turn: 1,
        response: `Let me run the trace command:
        \`\`\`bash
        $ cd tools/sn-tools/ServiceNow-Tools && npm run trace-impact -- WorkCampaignBoard
        \`\`\`
        The output shows...`
      };

      const commands = parser.extractBashCommands(turn, 1);
      assert.ok(commands.length > 0, 'Should detect bash command');
      assert.ok(commands.some(c => c.type === McpCallType.BASH_FALLBACK), 'Should be marked as fallback');
    });

    it('should detect inline npm run mentions', () => {
      const turn = {
        turn: 1,
        response: 'I am executing: npm run trace-lineage -- ComponentX component'
      };

      const commands = parser.extractBashCommands(turn, 1);
      assert.ok(commands.length > 0, 'Should detect inline command');
    });
  });

  describe('extractManualInvestigations', () => {
    it('should detect grep commands', () => {
      const turn = {
        turn: 1,
        response: `Let me search manually:
        \`\`\`bash
        grep -r "WorkCampaign" --include="*.js" .
        \`\`\``
      };

      const investigations = parser.extractManualInvestigations(turn, 1);
      assert.ok(investigations.length > 0, 'Should detect grep');
      assert.ok(investigations.some(i => i.type === McpCallType.MANUAL_GREP));
    });

    it('should detect find commands', () => {
      const turn = {
        turn: 1,
        response: 'Running find . -name "*.api" to locate API files'
      };

      const investigations = parser.extractManualInvestigations(turn, 1);
      assert.ok(investigations.length > 0, 'Should detect find command');
    });
  });

  describe('extractConfidenceLevels', () => {
    it('should extract JSON confidence metadata', () => {
      const turn = {
        turn: 1,
        response: JSON.stringify({
          data: {
            metadata: {
              confidence: {
                level: 'HIGH',
                score: 0.95
              }
            }
          }
        })
      };

      const confidences = parser.extractConfidenceLevels(turn, 1);
      assert.ok(confidences.some(c => c.level === 'HIGH'), 'Should extract HIGH confidence');
      assert.ok(confidences.some(c => c.score === 0.95), 'Should extract score');
    });

    it('should extract textual confidence mentions', () => {
      const turn = {
        turn: 1,
        response: 'The tool returned confidence level: LOW. I will perform manual investigation.'
      };

      const confidences = parser.extractConfidenceLevels(turn, 1);
      assert.ok(confidences.some(c => c.level === 'LOW'), 'Should detect LOW confidence');
    });

    it('should extract trustworthy flag', () => {
      const turn = {
        turn: 1,
        response: '{"interpretation": {"trustworthy": false, "message": "Cache is stale"}}'
      };

      const confidences = parser.extractConfidenceLevels(turn, 1);
      assert.ok(confidences.some(c => c.trustworthy === false), 'Should detect untrustworthy');
    });
  });

  describe('detectMcpConfigLoaded', () => {
    it('should detect MCP config loaded', () => {
      const turn = {
        response: '[agent] MCP config: /path/to/mcp-config.json loaded successfully'
      };

      const loaded = parser.detectMcpConfigLoaded(turn);
      assert.strictEqual(loaded, true);
    });

    it('should detect MCP config not found', () => {
      const turn = {
        response: '[agent] No MCP config found (optional)'
      };

      const loaded = parser.detectMcpConfigLoaded(turn);
      assert.strictEqual(loaded, false);
    });
  });

  describe('parseConversation', () => {
    it('should analyze complete conversation with MCP tool usage', () => {
      const conversation = [
        {
          turn: 1,
          response: `Using trace_component_impact with parameters {"component_name": "Test"}
          Result: {"success": true, "_trace": {"id": "t1", "executionTimeMs": 100}}`
        },
        {
          turn: 2,
          response: 'The analysis shows the component connects to 3 APIs.'
        }
      ];

      const analysis = parser.parseConversation(conversation);

      assert.strictEqual(analysis.summary.totalTurns, 2);
      assert.ok(analysis.summary.mcpToolCallsDetected > 0, 'Should detect MCP calls');
      assert.strictEqual(analysis.summary.primaryMethod, McpCallType.MCP_TOOL);
    });

    it('should identify bash fallback as primary method when no MCP', () => {
      const conversation = [
        {
          turn: 1,
          response: `\`\`\`bash
          cd tools/sn-tools/ServiceNow-Tools && npm run trace-impact -- Test
          \`\`\``
        }
      ];

      const analysis = parser.parseConversation(conversation);

      assert.ok(analysis.summary.bashFallbacksDetected > 0);
      assert.strictEqual(analysis.summary.primaryMethod, McpCallType.BASH_FALLBACK);
    });

    it('should identify avoidance reasons when no tools used', () => {
      const conversation = [
        {
          turn: 1,
          response: 'I analyzed the component and found some dependencies.'
        }
      ];

      const analysis = parser.parseConversation(conversation);

      assert.strictEqual(analysis.summary.primaryMethod, McpCallType.NONE);
      assert.ok(analysis.failureAnalysis.avoidanceReasons.length > 0);
      assert.ok(
        analysis.failureAnalysis.avoidanceReasons.some(
          r => r.reason === McpAvoidanceReason.PROMPT_MISUNDERSTOOD
        )
      );
    });

    it('should detect MCP not loaded avoidance reason', () => {
      const conversation = [
        {
          turn: 1,
          response: 'No MCP config found (optional). Let me use bash commands instead.'
        },
        {
          turn: 2,
          response: `\`\`\`bash
          npm run trace-impact -- Test
          \`\`\``
        }
      ];

      const analysis = parser.parseConversation(conversation);

      assert.strictEqual(analysis.failureAnalysis.mcpConfigLoaded, false);
    });

    it('should generate recommendations', () => {
      const conversation = [
        {
          turn: 1,
          response: 'No MCP config found. The analysis shows LOW confidence results.'
        }
      ];

      const analysis = parser.parseConversation(conversation);

      assert.ok(analysis.recommendations.length > 0);
      assert.ok(analysis.recommendations.some(r => r.category === 'configuration'));
    });
  });

  describe('generateSummaryText', () => {
    it('should generate readable summary', () => {
      const conversation = [
        {
          turn: 1,
          response: 'Using trace_component_impact tool with {"component_name": "Test"}'
        }
      ];

      const analysis = parser.parseConversation(conversation);
      const summary = parser.generateSummaryText(analysis);

      assert.ok(summary.includes('MCP Tool Usage Analysis'));
      assert.ok(summary.includes('Primary method'));
      assert.ok(typeof summary === 'string');
    });
  });

  describe('extractDecisionPoints', () => {
    it('should detect decision to use MCP tool', () => {
      const turn = {
        turn: 1,
        response: 'I am using the MCP tool trace_component_impact because it provides accurate dependency data.'
      };

      const decisions = parser.extractDecisionPoints(turn, 1);
      assert.ok(decisions.some(d => d.decision === 'use_mcp_tool'));
    });

    it('should detect low confidence action decision', () => {
      const turn = {
        turn: 1,
        response: 'The confidence is LOW so I will perform manual investigation as suggested.'
      };

      const decisions = parser.extractDecisionPoints(turn, 1);
      assert.ok(decisions.some(d => d.decision === 'low_confidence_action'));
    });
  });
});

describe('McpResultParser Edge Cases', () => {
  let parser;

  beforeEach(() => {
    parser = new McpResultParser({ verbose: false });
  });

  it('should handle empty conversation', () => {
    const analysis = parser.parseConversation([]);

    assert.strictEqual(analysis.summary.totalTurns, 0);
    assert.strictEqual(analysis.summary.primaryMethod, McpCallType.NONE);
  });

  it('should handle null/undefined responses', () => {
    const conversation = [
      { turn: 1, response: null },
      { turn: 2, response: undefined },
      { turn: 3 }
    ];

    const analysis = parser.parseConversation(conversation);
    assert.strictEqual(analysis.summary.totalTurns, 3);
  });

  it('should handle nested response objects', () => {
    const conversation = [
      {
        turn: 1,
        response: {
          response: 'Using trace_component_impact with parameters...'
        }
      }
    ];

    const analysis = parser.parseConversation(conversation);
    assert.ok(analysis.summary.mcpToolCallsDetected > 0);
  });

  it('should handle very large responses', () => {
    const largeContent = 'x'.repeat(100000);
    const conversation = [
      {
        turn: 1,
        // Tool name with parameters - this ensures it gets detected
        response: `Using trace_component_impact with parameters {"component_name": "Test"} ${largeContent}`
      }
    ];

    const analysis = parser.parseConversation(conversation);
    // Should process without crashing, and detect the tool call
    assert.ok(analysis.summary.mcpToolCallsDetected > 0, 'Should detect tool call in large response');
  });

  it('should deduplicate tool calls from same turn', () => {
    const conversation = [
      {
        turn: 1,
        response: `Using trace_component_impact with parameters {"component_name": "Test"}.
        The trace_component_impact result shows the component connects to APIs.`
      }
    ];

    const analysis = parser.parseConversation(conversation);
    // Should not count the same tool twice from content mentions
    const uniqueTools = analysis.summary.mcpToolsUsed;
    assert.strictEqual(new Set(uniqueTools).size, uniqueTools.length);
  });
});
