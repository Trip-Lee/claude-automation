/**
 * Simple Test Executor
 *
 * Lightweight test executor for running AI agent tests without
 * the full Orchestrator infrastructure (git, docker, branches, etc.)
 *
 * This is specifically designed for unit/integration testing where
 * we just want to run agents and validate outputs.
 */

import { AgentRegistry } from '../../lib/agent-registry.js';
import { registerStandardAgents } from '../../lib/standard-agents.js';
import { registerServiceNowAgents } from '../../lib/servicenow-agents.js';
import { ClaudeCodeAgent } from '../../lib/claude-code-agent.js';
import { TaskPlanner } from '../../lib/task-planner.js';
import { WorkflowExecutor } from '../../lib/workflow-executor.js';
import { getWorkflow } from '../../lib/servicenow-workflows.js';
import { StructuredTestReport, TestReportGenerator } from '../../lib/structured-test-report.js';
import { McpResultParser } from './mcp-result-parser.js';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class SimpleTestExecutor {
  constructor(options = {}) {
    this.verbose = options.verbose || false;

    // Initialize agent registry
    this.agentRegistry = new AgentRegistry();
    registerStandardAgents(this.agentRegistry);
    registerServiceNowAgents(this.agentRegistry);

    // Working directory for test outputs
    this.workingDir = options.workingDir || process.cwd();
    this.outputDir = options.outputDir || path.join(this.workingDir, 'test-outputs');

    // Initialize structured report generator
    this.reportGenerator = new TestReportGenerator({
      outputDir: this.outputDir
    });
    this.generateStructuredReports = options.generateStructuredReports !== false;

    // Initialize MCP result parser for detailed analysis
    this.mcpResultParser = new McpResultParser({
      verbose: this.verbose
    });
  }

  /**
   * Execute a test task using AI agents
   * @param {string} taskPrompt - The task to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Test execution results
   */
  async executeTask(taskPrompt, options = {}) {
    const testId = options.testId || `test-${Date.now()}`;
    const maxTurns = options.maxTurns || 10;

    if (this.verbose) {
      console.log(`\n[SimpleTestExecutor] Starting task: ${testId}`);
      console.log(`[SimpleTestExecutor] Max turns: ${maxTurns}`);
    }

    try {
      // Create output directory for this test
      const testOutputDir = path.join(this.outputDir, testId);
      await fs.mkdir(testOutputDir, { recursive: true });

      // Auto-detect complexity if not provided
      const complexity = options.complexity || this.detectComplexity(taskPrompt, options);

      if (this.verbose && !options.complexity) {
        console.log(`[SimpleTestExecutor] Auto-detected complexity: ${complexity}`);
      }

      // Check if workflow exists for this test (NEW: Fix #3)
      const workflow = getWorkflow(testId);

      if (workflow) {
        // Use workflow-based execution with conversation context
        if (this.verbose) {
          console.log(`[SimpleTestExecutor] Using workflow: ${workflow.name}`);
          console.log(`[SimpleTestExecutor] Workflow steps: ${workflow.steps.length}`);
        }

        // Determine which agent to use (from workflow or fallback)
        const agentName = await this.determineAgent(taskPrompt);

        // Create agent instance
        const agent = await this.createAgent(agentName, {
          workingDir: this.workingDir,
          outputDir: testOutputDir,
          testMode: true,
          complexity: complexity,
          timeout: options.timeout
        });

        // Execute workflow with context management
        const workflowExecutor = new WorkflowExecutor({
          verbose: this.verbose,
          workingDir: this.workingDir,
          enableCaching: true
        });

        const result = await workflowExecutor.executeWorkflow(agent, workflow, options);

        // Return in same format as runAgent
        return {
          success: result.success,
          testId,
          agentName,
          outputDir: testOutputDir,
          result: {
            response: result.success ? 'Workflow completed successfully' : result.error,
            steps: result.steps,
            stats: result.stats
          },
          artifacts: await this.collectArtifacts(testOutputDir),
          workflowUsed: true
        };

      } else {
        // Fall back to original single-prompt approach
        if (this.verbose) {
          console.log(`[SimpleTestExecutor] No workflow found for ${testId}, using standard approach`);
        }

        // Determine which agent(s) to use (using TaskPlanner)
        const agentName = await this.determineAgent(taskPrompt);

        // Create agent instance
        const agent = await this.createAgent(agentName, {
          workingDir: this.workingDir,
          outputDir: testOutputDir,
          testMode: true,
          complexity: complexity,
          timeout: options.timeout // Allow explicit timeout override
        });

        // Execute the task with progressive validation
        const result = await this.runAgent(agent, taskPrompt, {
          maxTurns,
          testId,
          outputDir: testOutputDir,
          requiredSnTools: options.requiredSnTools || [],
          expectedArtifacts: options.expectedArtifacts || []
        });

        return {
          success: true,
          testId,
          agentName,
          outputDir: testOutputDir,
          result,
          artifacts: await this.collectArtifacts(testOutputDir),
          workflowUsed: false
        };
      }

    } catch (error) {
      if (this.verbose) {
        console.error(`[SimpleTestExecutor] Task failed: ${error.message}`);
      }

      return {
        success: false,
        testId,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Auto-detect task complexity based on heuristics
   * @param {string} taskPrompt - Task description
   * @param {Object} options - Options that may indicate complexity
   * @returns {string} - Complexity level (SIMPLE, MEDIUM, COMPLEX)
   */
  detectComplexity(taskPrompt, options = {}) {
    const prompt = taskPrompt.toLowerCase();
    let complexity = 'MEDIUM'; // default

    // Check options.points if provided (test scoring)
    if (options.points) {
      if (options.points >= 80) return 'COMPLEX';
      if (options.points >= 40) return 'MEDIUM';
      return 'SIMPLE';
    }

    // Heuristic-based detection
    const complexIndicators = [
      'end-to-end',
      'complete impact',
      'comprehensive',
      'full analysis',
      'entire system',
      'multiple components',
      'integration',
      'architecture',
      'deployment',
      'rollback',
      'migration'
    ];

    const mediumIndicators = [
      'analyze',
      'trace',
      'validate',
      'create',
      'implement',
      'workflow',
      'diagram'
    ];

    const simpleIndicators = [
      'list',
      'show',
      'display',
      'get',
      'retrieve'
    ];

    // Count indicators
    const complexCount = complexIndicators.filter(ind => prompt.includes(ind)).length;
    const mediumCount = mediumIndicators.filter(ind => prompt.includes(ind)).length;
    const simpleCount = simpleIndicators.filter(ind => prompt.includes(ind)).length;

    // Check length (longer prompts tend to be more complex)
    const wordCount = prompt.split(/\s+/).length;

    if (complexCount >= 2 || wordCount > 200) {
      complexity = 'COMPLEX';
    } else if (simpleCount >= 2 && wordCount < 50) {
      complexity = 'SIMPLE';
    } else if (mediumCount >= 1 || wordCount > 100) {
      complexity = 'MEDIUM';
    }

    // Check deliverables count (more deliverables = more complex)
    const deliverablesMatch = prompt.match(/deliverables?:/gi);
    const deliverablesCount = prompt.split('\n').filter(line =>
      line.trim().match(/^-\s+\w+\/[\w_-]+\.md/)
    ).length;

    if (deliverablesCount >= 4) {
      complexity = 'COMPLEX';
    }

    return complexity;
  }

  /**
   * Determine which agent to use based on task content
   * Uses TaskPlanner's heuristic logic for intelligent agent selection
   * @param {string} taskPrompt - Task description
   * @returns {Promise<string>} - Agent name
   */
  async determineAgent(taskPrompt) {
    // Create a mock conversation object for TaskPlanner
    const mockConversation = { add: () => {} };

    const planner = new TaskPlanner(this.agentRegistry, mockConversation);

    // Use heuristic planning (fast, rule-based)
    const plan = planner.planWithHeuristics(taskPrompt);

    if (this.verbose) {
      console.log(`[SimpleTestExecutor] Task Plan:`);
      console.log(`  Type: ${plan.taskType}`);
      console.log(`  Agents: ${plan.agents.join(' → ')}`);
      console.log(`  Reasoning: ${plan.reasoning}`);
    }

    // Return the first agent from the plan
    const selectedAgent = plan.agents[0] || 'architect';

    if (this.verbose) {
      console.log(`[SimpleTestExecutor] Selected agent: ${selectedAgent}\n`);
    }

    return selectedAgent;
  }

  /**
   * Create an agent instance
   * @param {string} agentName - Name of the agent
   * @param {Object} options - Agent options
   * @returns {Promise<ClaudeCodeAgent>} - Agent instance
   */
  async createAgent(agentName, options = {}) {
    const agentConfig = this.agentRegistry.get(agentName);

    if (!agentConfig) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    // Determine timeout based on test complexity
    // Options can override via options.complexity or options.timeout
    const complexity = options.complexity || 'MEDIUM';
    const timeouts = {
      SIMPLE: 5 * 60 * 1000,   // 5 minutes
      MEDIUM: 12 * 60 * 1000,  // 12 minutes (increased from 10)
      COMPLEX: 25 * 60 * 1000  // 25 minutes for complex end-to-end tests
    };

    const timeout = options.timeout || timeouts[complexity] || timeouts.MEDIUM;

    if (this.verbose) {
      console.log(`[SimpleTestExecutor] Agent timeout: ${timeout/1000/60} minutes (${complexity})`);
    }

    // Create agent (uses Claude Code CLI, no API key needed)
    const agent = agentConfig.factory({
      workingDir: options.workingDir,
      testMode: options.testMode || false,
      verbose: this.verbose,
      timeout: timeout,
      maxRetries: 2 // Reduce retries since we have longer timeout
    });

    return agent;
  }

  /**
   * Build checkpoint reminder prompt
   * @param {number} turn - Current turn
   * @param {string} message - Main message
   * @param {Array<string>} requiredSteps - Required next steps
   * @returns {string} - Checkpoint prompt
   */
  buildCheckpointPrompt(turn, message, requiredSteps) {
    return `
🚨 CHECKPOINT (Turn ${turn}):

${message}

REQUIRED NEXT STEPS:
${requiredSteps.map((step, i) => `${i+1}. ${step}`).join('\n')}

Please complete these steps before continuing.
`;
  }

  /**
   * Validate sn-tools command execution (bash OR MCP tool equivalents)
   * @param {string} conversationContent - JSON string of conversation
   * @param {Array<string>} requiredCommands - Required command names
   * @returns {Object} - {valid, executed, missing, message}
   */
  validateSnToolsExecution(conversationContent, requiredCommands) {
    if (!requiredCommands || requiredCommands.length === 0) {
      return { valid: true, executed: [], missing: [], message: 'No commands required' };
    }

    // MCP tool equivalents mapping
    // Maps bash command names to their MCP tool equivalents
    // Actual MCP tools: trace_component_impact, trace_table_dependencies, trace_full_lineage,
    //                   validate_change_impact, query_table_schema, analyze_script_crud, refresh_dependency_cache
    const mcpEquivalents = {
      'trace-impact': ['trace_component_impact'],
      'trace-backward': ['trace_table_dependencies'],
      'trace-lineage': ['trace_full_lineage'],
      'validate-change': ['validate_change_impact'],
      'query': ['query_table_schema', 'analyze_script_crud', 'trace_table_dependencies', 'trace_component_impact'],
      'query table-schema': ['query_table_schema'],
      'query table-dependencies': ['trace_table_dependencies'],
      'query script-crud': ['analyze_script_crud'],
      'query component-impact': ['trace_component_impact']
    };

    const executed = [];
    const missing = [];

    for (const cmd of requiredCommands) {
      // Check for various command execution patterns (bash)
      const bashPatterns = [
        `npm run ${cmd}`,
        `"${cmd}"`,
        `run ${cmd}`,
        new RegExp(`${cmd}.*executed`, 'i'),
        new RegExp(`running.*${cmd}`, 'i')
      ];

      // Get equivalent MCP tools for this command
      const equivalentTools = mcpEquivalents[cmd] || [];

      let found = false;

      // Check bash patterns
      for (const pattern of bashPatterns) {
        if (typeof pattern === 'string') {
          if (conversationContent.includes(pattern)) {
            found = true;
            break;
          }
        } else {
          if (pattern.test(conversationContent)) {
            found = true;
            break;
          }
        }
      }

      // Check MCP tool equivalents
      if (!found) {
        for (const mcpTool of equivalentTools) {
          if (conversationContent.includes(mcpTool)) {
            found = true;
            break;
          }
        }
      }

      // Also check for MCP tool JSON output patterns
      if (!found) {
        const hasMcpJsonPattern = conversationContent.match(/"(component|table|entity)_name":\s*"/i) ||
                                  conversationContent.match(/"success":\s*true.*"data":/s) ||
                                  conversationContent.match(/\*\*Tool:\*\*\s*(trace_|query_|validate_)/i);
        if (hasMcpJsonPattern) {
          found = true;
        }
      }

      if (found) {
        executed.push(cmd);
      } else {
        missing.push(cmd);
      }
    }

    return {
      valid: missing.length === 0,
      executed,
      missing,
      message: missing.length > 0
        ? `Missing required commands: ${missing.join(', ')} (note: MCP tool equivalents are also accepted)`
        : `All required commands executed`
    };
  }

  /**
   * Find artifact file in multiple possible locations
   */
  async findArtifact(artifact) {
    const possiblePaths = [
      path.join(this.workingDir, artifact),
      path.join(this.workingDir, 'tools', 'sn-tools', 'ServiceNow-Tools', artifact),
      path.join(this.workingDir, 'tools', 'sn-tools', 'ServiceNow-Tools', path.basename(artifact))
    ];

    for (const filePath of possiblePaths) {
      try {
        await fs.access(filePath);
        return filePath;
      } catch {}
    }

    return null;
  }

  /**
   * Read artifact content
   */
  async readArtifact(artifact) {
    const filePath = await this.findArtifact(artifact);
    if (filePath) {
      try {
        return await fs.readFile(filePath, 'utf-8');
      } catch {}
    }
    return null;
  }

  /**
   * Run an agent on a task with progressive validation checkpoints
   * @param {ClaudeCodeAgent} agent - Agent instance
   * @param {string} taskPrompt - Task to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async runAgent(agent, taskPrompt, options = {}) {
    const maxTurns = options.maxTurns || 10;
    const outputDir = options.outputDir;
    const testId = options.testId || 'unknown';
    const requiredSnTools = options.requiredSnTools || [];
    const expectedArtifacts = options.expectedArtifacts || [];

    let turn = 0;
    let conversationHistory = [];
    let currentPrompt = taskPrompt;

    while (turn < maxTurns) {
      turn++;

      if (this.verbose) {
        console.log(`[SimpleTestExecutor] Turn ${turn}/${maxTurns}`);
      }

      try {
        // Generate unique UUID session ID for each turn to avoid conflicts
        agent.sessionId = uuidv4();

        // Send message to agent using query()
        const response = await agent.query(currentPrompt, conversationHistory);

        conversationHistory.push({
          turn,
          prompt: currentPrompt,
          response: response,
          timestamp: new Date().toISOString()
        });

        // CHECKPOINT 1: Commands (Turn 3)
        if (turn === 3 && requiredSnTools.length > 0) {
          const convContent = JSON.stringify(conversationHistory);
          const commandCheck = this.validateSnToolsExecution(convContent, requiredSnTools);

          if (!commandCheck.valid) {
            console.log(`[SimpleTestExecutor] ⚠️  Checkpoint 1 Failed: Missing sn-tools commands`);
            currentPrompt = this.buildCheckpointPrompt(
              turn,
              `You have not executed the required sn-tools analyses yet. You can use EITHER bash commands OR MCP tools.`,
              [
                ...requiredSnTools.map(cmd => `Option 1 (Bash): cd tools/sn-tools/ServiceNow-Tools && npm run ${cmd}`),
                `Option 2 (Preferred): Use MCP tools directly - trace_component_impact, trace_table_dependencies, query_table_schema, etc.`,
                `Include tool outputs in your documentation deliverables`
              ]
            );
            continue;
          } else {
            console.log(`[SimpleTestExecutor] ✓ Checkpoint 1 Passed: Commands executed (${commandCheck.executed.length}/${requiredSnTools.length})`);
          }
        }

        // CHECKPOINT 2: Artifacts (Turn 6)
        if (turn === 6 && expectedArtifacts.length > 0) {
          let artifactsCreated = 0;
          for (const artifact of expectedArtifacts) {
            const filePath = await this.findArtifact(artifact);
            if (filePath) artifactsCreated++;
          }

          if (artifactsCreated === 0) {
            console.log(`[SimpleTestExecutor] ⚠️  Checkpoint 2 Failed: No artifacts created yet`);
            currentPrompt = this.buildCheckpointPrompt(
              turn,
              `You should have started creating the required deliverables by now.`,
              expectedArtifacts.map(a => `Create file: ${a}`)
            );
            continue;
          } else {
            console.log(`[SimpleTestExecutor] ✓ Checkpoint 2 Passed: Artifacts created (${artifactsCreated}/${expectedArtifacts.length})`);
          }
        }

        // CHECKPOINT 3: Structure & Risk Assessment (Turn 10)
        if (turn === 10 && expectedArtifacts.length > 0) {
          const structureIssues = [];

          for (const artifact of expectedArtifacts) {
            const content = await this.readArtifact(artifact);
            if (content) {
              // Check for risk assessment section (relaxed patterns)
              const hasRiskSection = content.match(/##?\s*(Potential\s*)?(Issues?|Risks?|Constraints?|Concerns?)/i);
              const hasTechnical = content.match(/###?\s*Technical\s*(Constraints?|Considerations?|Issues?|Risks?)/i);
              const hasBusiness = content.match(/###?\s*Business\s*(Constraints?|Considerations?|Issues?|Risks?)/i);
              const hasDataIntegrity = content.match(/###?\s*Data\s*(Integrity|Quality|Constraints?|Considerations?)/i);
              const hasSecurity = content.match(/###?\s*Security\s*(Constraints?|Considerations?|Issues?|Implications?|Risks?)/i);

              if (!hasRiskSection) {
                structureIssues.push(`${artifact}: Missing "Potential Issues & Constraints" section`);
              } else {
                // Check for required subsections
                const missing = [];
                if (!hasTechnical) missing.push('Technical Constraints');
                if (!hasBusiness) missing.push('Business Constraints');
                if (!hasDataIntegrity) missing.push('Data Integrity Constraints');
                if (!hasSecurity) missing.push('Security Constraints');

                if (missing.length > 0) {
                  structureIssues.push(`${artifact}: Risk section missing subsections: ${missing.join(', ')}`);
                }
              }

              // Check for deployment sequence in implementation plans
              if (artifact.includes('plan') || artifact.includes('implementation')) {
                const hasDeployment = content.match(/##?\s*Deployment\s*Sequence/i);
                const hasRollback = content.includes('Rollback') || content.includes('rollback');

                if (!hasDeployment) {
                  structureIssues.push(`${artifact}: Missing "Deployment Sequence" section`);
                }
                if (!hasRollback) {
                  structureIssues.push(`${artifact}: Missing rollback strategy`);
                }
              }
            }
          }

          if (structureIssues.length > 0) {
            console.log(`[SimpleTestExecutor] ⚠️  Checkpoint 3 Failed: Structure/Risk assessment issues`);
            currentPrompt = this.buildCheckpointPrompt(
              turn,
              `Your deliverables are missing required sections.`,
              [
                `Add "Potential Issues & Constraints" section with subsections:`,
                `  - Technical Constraints (performance, scalability, integration)`,
                `  - Business Constraints (regulatory, cost, time)`,
                `  - Data Integrity Constraints (referential integrity, validation)`,
                `  - Security Constraints (access control, authentication)`,
                `For implementation plans, add "Deployment Sequence" with rollback strategies`,
                ...structureIssues.map(issue => `Fix: ${issue}`)
              ]
            );
            continue;
          } else {
            console.log(`[SimpleTestExecutor] ✓ Checkpoint 3 Passed: Structure & risk assessment complete`);
          }
        }

        // Check if task is complete
        if (this.isTaskComplete(response, turn, maxTurns)) {
          if (this.verbose) {
            console.log(`[SimpleTestExecutor] Task appears complete`);
          }
          break;
        }

        // Default continuation prompt
        currentPrompt = "Please continue with the task or provide status update.";

      } catch (error) {
        if (this.verbose) {
          console.error(`[SimpleTestExecutor] Turn ${turn} error: ${error.message}`);
        }

        conversationHistory.push({
          turn,
          prompt: currentPrompt,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        throw error;
      }
    }

    // Extract MCP metrics from conversation history (legacy method)
    const mcpMetrics = this.extractMcpMetrics(conversationHistory);

    // NEW: Comprehensive MCP analysis using McpResultParser
    const mcpAnalysis = this.mcpResultParser.parseConversation(conversationHistory);

    // Save conversation history
    if (outputDir) {
      await fs.writeFile(
        path.join(outputDir, 'conversation.json'),
        JSON.stringify(conversationHistory, null, 2)
      );

      // Save MCP metrics separately for easy analysis (legacy format)
      if (mcpMetrics.tool_calls > 0) {
        await fs.writeFile(
          path.join(outputDir, 'mcp-metrics.json'),
          JSON.stringify(mcpMetrics, null, 2)
        );
      }

      // NEW: Save comprehensive MCP analysis
      await fs.writeFile(
        path.join(outputDir, 'mcp-analysis.json'),
        JSON.stringify(mcpAnalysis, null, 2)
      );

      // Also save human-readable summary
      const summaryText = this.mcpResultParser.generateSummaryText(mcpAnalysis);
      await fs.writeFile(
        path.join(outputDir, 'mcp-analysis-summary.txt'),
        summaryText
      );

      if (this.verbose) {
        console.log(`[SimpleTestExecutor] MCP Analysis Summary:`);
        console.log(`  Primary method: ${mcpAnalysis.summary.primaryMethod}`);
        console.log(`  MCP tool calls: ${mcpAnalysis.summary.mcpToolCallsDetected}`);
        console.log(`  Bash fallbacks: ${mcpAnalysis.summary.bashFallbacksDetected}`);
        if (mcpAnalysis.failureAnalysis.avoidanceReasons.length > 0) {
          console.log(`  Avoidance reasons: ${mcpAnalysis.failureAnalysis.avoidanceReasons.map(r => r.reason).join(', ')}`);
        }
      }
    }

    // Generate structured report if enabled
    let structuredReport = null;
    if (this.generateStructuredReports) {
      structuredReport = this.reportGenerator.createReport({
        testId,
        testName: testId,
        taskPrompt,
        expectedArtifacts,
        successCriteria: options.successCriteria || [],
        requiredSnTools
      });

      // Populate report with execution data
      this.reportGenerator.populateFromExecution(structuredReport, {
        conversationHistory: conversationHistory.map((h, i) => ({
          turn: h.turn || i + 1,
          timestamp: h.timestamp,
          prompt: h.prompt,
          response: h.response?.response || h.response,
          mcpCalls: h.response?.mcpToolCalls || []
        })),
        auditDecisions: agent.getAuditTrail()?.decisions?.map(d => d.toJSON()) || [],
        artifacts: await this.collectArtifacts(outputDir),
        metrics: {
          totalCost: conversationHistory.reduce((sum, h) => sum + (h.response?.cost || 0), 0),
          ...mcpMetrics
        },
        // NEW: Include comprehensive MCP analysis
        mcpAnalysis: {
          summary: mcpAnalysis.summary,
          toolsUsed: mcpAnalysis.summary.mcpToolsUsed,
          primaryMethod: mcpAnalysis.summary.primaryMethod,
          confidenceLevels: mcpAnalysis.confidenceLevels,
          failureReasons: mcpAnalysis.failureAnalysis.avoidanceReasons,
          recommendations: mcpAnalysis.recommendations
        }
      });

      // Complete the report
      structuredReport.complete(turn < maxTurns);

      // Save structured report
      if (outputDir) {
        await structuredReport.saveToFile(outputDir, 'both');
      }
    }

    return {
      turns: turn,
      conversationHistory,
      completed: turn < maxTurns,
      mcpMetrics,
      mcpAnalysis, // NEW: Comprehensive MCP analysis
      structuredReport: structuredReport?.toJSON() || null
    };
  }

  /**
   * Extract MCP metrics from conversation history
   * Parses responses for MCP tool calls and metrics
   * @param {Array} conversationHistory - Conversation history
   * @returns {Object} - MCP metrics summary
   */
  extractMcpMetrics(conversationHistory) {
    const metrics = {
      tool_calls: 0,
      tools_used: {},
      total_response_size_chars: 0,
      total_response_size_kb: 0,
      truncated_responses: 0,
      average_response_size_kb: 0,
      largest_response: null,
      total_execution_time_ms: 0,
      average_execution_time_ms: 0,
      by_tool: {}
    };

    for (const entry of conversationHistory) {
      if (!entry.response) continue;

      const responseStr = JSON.stringify(entry.response);

      // Look for MCP Metrics in response
      const mcpMetricsMatches = responseStr.match(/\[MCP Metrics\][^\n]*/g);

      if (mcpMetricsMatches) {
        metrics.tool_calls++;

        for (const match of mcpMetricsMatches) {
          // Extract tool name
          const toolMatch = match.match(/Tool:\s*(\w+)/);
          if (toolMatch) {
            const toolName = toolMatch[1];
            metrics.tools_used[toolName] = (metrics.tools_used[toolName] || 0) + 1;

            if (!metrics.by_tool[toolName]) {
              metrics.by_tool[toolName] = {
                calls: 0,
                total_size_kb: 0,
                total_time_ms: 0,
                truncated_count: 0
              };
            }
            metrics.by_tool[toolName].calls++;
          }

          // Extract response size
          const sizeMatch = match.match(/Response size:\s*(\d+)\s*chars\s*\(([0-9.]+)\s*KB\)/);
          if (sizeMatch) {
            const sizeChars = parseInt(sizeMatch[1]);
            const sizeKB = parseFloat(sizeMatch[2]);

            metrics.total_response_size_chars += sizeChars;
            metrics.total_response_size_kb += sizeKB;

            if (toolMatch) {
              metrics.by_tool[toolMatch[1]].total_size_kb += sizeKB;
            }

            if (!metrics.largest_response || sizeKB > metrics.largest_response.size_kb) {
              metrics.largest_response = {
                size_kb: sizeKB,
                size_chars: sizeChars,
                tool: toolMatch ? toolMatch[1] : 'unknown',
                turn: entry.turn
              };
            }
          }

          // Extract execution time
          const timeMatch = match.match(/Execution time:\s*(\d+)ms/);
          if (timeMatch) {
            const timeMs = parseInt(timeMatch[1]);
            metrics.total_execution_time_ms += timeMs;

            if (toolMatch) {
              metrics.by_tool[toolMatch[1]].total_time_ms += timeMs;
            }
          }

          // Check for truncation
          if (match.includes('applying progressive context building')) {
            metrics.truncated_responses++;
            if (toolMatch) {
              metrics.by_tool[toolMatch[1]].truncated_count++;
            }
          }
        }
      }
    }

    // Calculate averages
    if (metrics.tool_calls > 0) {
      metrics.average_response_size_kb = (metrics.total_response_size_kb / metrics.tool_calls).toFixed(2);
      metrics.average_response_size_kb = parseFloat(metrics.average_response_size_kb);

      metrics.average_execution_time_ms = Math.round(metrics.total_execution_time_ms / metrics.tool_calls);
    }

    // Round totals
    metrics.total_response_size_kb = parseFloat(metrics.total_response_size_kb.toFixed(2));

    return metrics;
  }

  /**
   * Check if task appears to be complete
   * @param {Object} response - Agent response
   * @param {number} currentTurn - Current turn number
   * @param {number} maxTurns - Maximum turns
   * @returns {boolean} - Whether task is complete
   */
  isTaskComplete(response, currentTurn, maxTurns) {
    // If we hit max turns, consider it complete (or failed)
    if (currentTurn >= maxTurns) {
      return true;
    }

    // Check response content for completion indicators
    const content = JSON.stringify(response).toLowerCase();

    const completionIndicators = [
      'task complete',
      'analysis complete',
      'finished',
      'done',
      'successfully created',
      'all deliverables'
    ];

    return completionIndicators.some(indicator => content.includes(indicator));
  }

  /**
   * Collect artifacts created during test execution
   * @param {string} outputDir - Output directory
   * @returns {Promise<Array>} - List of artifacts
   */
  async collectArtifacts(outputDir) {
    const artifacts = [];

    try {
      const files = await fs.readdir(outputDir, { recursive: true });

      for (const file of files) {
        const filePath = path.join(outputDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          artifacts.push({
            path: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(`[SimpleTestExecutor] Failed to collect artifacts: ${error.message}`);
      }
    }

    return artifacts;
  }

  /**
   * Clean up test outputs
   * @param {string} testId - Test ID to clean up
   */
  async cleanup(testId) {
    const testOutputDir = path.join(this.outputDir, testId);

    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });

      if (this.verbose) {
        console.log(`[SimpleTestExecutor] Cleaned up: ${testOutputDir}`);
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(`[SimpleTestExecutor] Cleanup failed: ${error.message}`);
      }
    }
  }
}
