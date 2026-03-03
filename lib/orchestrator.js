/**
 * Orchestrator - Core workflow orchestration engine for the multi-agent system.
 *
 * This module serves as the central coordinator that manages the entire lifecycle
 * of automated coding tasks. It integrates Docker containers, Git workflows,
 * AI agents, and GitHub operations into a unified execution pipeline.
 *
 * Key Responsibilities:
 * - Task execution: Manages sequential and parallel agent workflows
 * - Container management: Creates, monitors, and cleans up Docker containers
 * - Git operations: Branch creation, merging, and conflict resolution
 * - Agent orchestration: Routes tasks to specialized agents (architect, coder,
 *   reviewer, security, etc.) using dynamic or heuristic planning
 * - GitHub integration: Automated PR creation and branch pushing
 * - Cost tracking: Monitors API usage and enforces budget limits
 *
 * Execution Flow:
 * 1. Pre-flight checks (config validation, git state, docker availability)
 * 2. Environment setup (create branch, spin up container)
 * 3. Task analysis and agent planning (orchestrator determines workflow)
 * 4. Agent execution (dynamic routing between specialized agents)
 * 5. Test execution (if configured)
 * 6. Summary generation and PR creation
 * 7. Cleanup (container removal, resource tracking)
 *
 * @module orchestrator
 */

import { DockerManager } from './docker-manager.js';
import { GitHubClient } from './github-client.js';
import { CostMonitor } from './cost-monitor.js';
import { SummaryGenerator } from './summary-generator.js';
import { ConfigManager } from './config-manager.js';
import { GitManager } from './git-manager.js';
import { AgentRegistry } from './agent-registry.js';
import { registerStandardAgents } from './standard-agents.js';
import { registerServiceNowAgents } from './servicenow-agents.js';
import { DynamicAgentExecutor } from './dynamic-agent-executor.js';
import { ToolRegistry } from './tool-registry.js';
import { OrchestratorTools, registerOrchestratorAgent } from './orchestrator-agent.js';
import { TaskDecomposer } from './task-decomposer.js';
import { ParallelAgentManager } from './parallel-agent-manager.js';
import { BranchMerger } from './branch-merger.js';
import { getGlobalConfig } from './global-config.js';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

export class Orchestrator {
  constructor(githubToken, anthropicApiKey) {
    this.globalConfig = getGlobalConfig();
    this.dockerManager = new DockerManager();
    this.githubClient = githubToken ? new GitHubClient(githubToken) : null;
    this.configManager = new ConfigManager();
    this.gitManager = new GitManager();
    this.summaryGenerator = new SummaryGenerator();
    this.tasksDir = this.globalConfig.get('tasksDir');

    // Tool system
    this.toolRegistry = new ToolRegistry();

    // Agent system
    this.anthropicApiKey = anthropicApiKey;

    // Dynamic agent routing system
    this.agentRegistry = new AgentRegistry();
    registerStandardAgents(this.agentRegistry);
    registerServiceNowAgents(this.agentRegistry);
    registerOrchestratorAgent(this.agentRegistry, this.toolRegistry);

    // Track active resources for cleanup
    this.activeContainers = new Set();
    this.cleanupRegistered = false;

    // Register cleanup handlers once
    this.registerCleanupHandlers();
  }

  /**
   * Execute a coding task
   * @param {string} projectName - Name of the project
   * @param {string} description - Task description
   * @param {Object} options - Optional callbacks and settings
   * @param {Function} options.onProgress - Progress callback (message) => void
   * @param {Function} options.onMessage - Agent message callback (message) => void
   * @param {Function} options.getInjectedMessage - Get user-injected message () => string|null
   * @returns {Promise<Object>} - { taskId, branchName, summary }
   */
  async executeTask(projectName, description, options = {}) {
    const taskId = this.generateTaskId();
    const startTime = Date.now();
    let container = null;
    let branchName = null;

    // Progress helper
    const progress = (msg) => {
      console.log(msg);
      if (options.onProgress) {
        options.onProgress({ message: msg, taskId });
      }
    };

    try {
      // Pre-flight checks (silent)
      const config = await this.configManager.load(projectName);
      await this.dockerManager.ping();

      // Analyze task for parallel execution (silent)
      const architectAgent = await this.createArchitectAgent(config);
      const decomposer = new TaskDecomposer(architectAgent);
      const analysis = await decomposer.analyzeTask(description);

      // If task can be parallelized, use parallel execution
      if (analysis.canParallelize && analysis.parts && analysis.parts.length >= 2) {
        return await this.executeParallel(taskId, projectName, description, config, analysis);
      }

      // Otherwise, fall through to sequential execution

      // Validate GitHub repository setup (if configured - silent)
      if (this.githubClient && config.repo && config.repo !== 'local') {
        // Validate repo format
        if (!config.repo.includes('github.com/')) {
          throw new Error(
            `Invalid repository format in config: ${config.repo}\n` +
            `Expected format: github.com/owner/repo\n` +
            `Update config at: ${path.join(this.globalConfig.get('configDir'), `${projectName}.yaml`)}`
          );
        }

        // Check if repository exists and is accessible
        const repoExists = await this.githubClient.checkRepoAccess(config.repo);

        if (!repoExists) {
          throw new Error(
            `GitHub repository not found: ${config.repo}\n\n` +
            `The repository either doesn't exist or you don't have access.\n\n` +
            `To fix this:\n` +
            `  1. Create the repository on GitHub\n` +
            `  2. Or run workflow mode: claude (includes repo creation)\n` +
            `  3. Or update config: ${path.join(this.globalConfig.get('configDir'), `${projectName}.yaml`)}`
          );
        }
      }

      // Setup Git and Docker (silent)

      // Determine project path - support local_path configurations
      let projectPath;
      if (config.local_path === 'cwd') {
        projectPath = process.cwd();
      } else if (config.local_path) {
        // Expand ~ to home directory
        projectPath = config.local_path.startsWith('~')
          ? config.local_path.replace('~', process.env.HOME || homedir())
          : config.local_path;
      } else {
        projectPath = path.join(this.globalConfig.get('projectsDir'), config.name);
      }

      branchName = `claude/${taskId}`;

      // Ensure project directory exists (auto-create for adhoc workspace)
      try {
        await fs.access(projectPath);
      } catch {
        // Auto-create adhoc workspace directory (no git needed - purely local)
        if (config.name === 'adhoc' && config.local_path && config.local_path !== 'cwd') {
          // Silently create adhoc workspace
          await fs.mkdir(projectPath, { recursive: true });
        } else {
          throw new Error(
            `Project directory not found: ${projectPath}\n` +
            config.local_path === 'cwd'
              ? `Current directory doesn't exist or is inaccessible`
              : `Please clone the repository first`
          );
        }
      }

      // Run Git and Docker setup in parallel
      // Get tools directory path
      const toolsPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'tools');

      // Get tool environment variables
      const toolEnv = this.toolRegistry.getAllToolEnvironmentVars();

      // For local repos, skip git operations
      const isLocalRepo = config.repo === 'local';

      const [, createdContainer] = await Promise.all([
        // Git setup (skip entirely for local repos)
        (async () => {
          if (isLocalRepo) {
            // No git operations needed for local/adhoc repos
            return;
          } else {
            await this.gitManager.pull(projectPath, config.base_branch);
            await this.gitManager.createBranch(projectPath, branchName);
          }
        })(),
        // Docker setup
        this.dockerManager.create({
          name: `claude-${taskId}`,
          image: config.docker.image,
          memory: config.docker.memory,
          cpus: config.docker.cpus,
          volumes: {
            [projectPath]: '/workspace',
            [toolsPath]: { containerPath: '/tools', mode: 'ro' }  // Tools mounted read-only
          },
          network: config.docker.network_mode,
          toolEnv: toolEnv  // Tool-specific environment variables
        })
      ]);

      // Track container for cleanup
      container = createdContainer;
      this.activeContainers.add(container);

      // Run agent system with dynamic routing
      const costMonitor = new CostMonitor(config.safety.max_cost_per_task);

      // Try Claude Code CLI with dynamic routing, fall back to mock if it fails
      let agentResult;
      try {
        agentResult = await this.runClaudeCodeAgentSystem(container, description, costMonitor, projectPath, options);
      } catch (error) {
        console.log(chalk.yellow(`  [WARN]  Claude Code agents failed: ${error.message}`));
        console.log(chalk.gray('  Falling back to mock mode...\n'));
        agentResult = await this.mockAgentExecution(container, description, costMonitor);
      }

      // Run tests (silent unless failures)
      const testResults = await this.runTests(container, config);
      if (testResults.passed === false) {
        console.log(chalk.yellow('[WARN] Tests failed'));
      }

      // Generate summary and save task data (silent)
      const duration = Date.now() - startTime;
      const result = {
        ...agentResult,
        cost: costMonitor.getTotalCost(),
        duration
      };

      const summary = this.summaryGenerator.create({
        taskId,
        description,
        result,
        testResults,
        config,
        branchName
      });

      const taskData = {
        taskId,
        projectName,
        description,
        branchName,
        result,
        testResults,
        config,
        containerId: container.id,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };
      await this.saveTaskData(taskData);
      await costMonitor.save(taskId);

      // Stop container (silent)
      await this.dockerManager.stop(container);

      // Auto-create PR (if GitHub configured and not a local repo)
      let pr = null;
      if (!isLocalRepo && this.githubClient) {
        try {
          await this.githubClient.pushBranch(projectPath, branchName);

          const prBody = this.summaryGenerator.createPRDescription({
            description,
            result,
            testResults,
            taskId
          });

          pr = await this.githubClient.createPullRequest({
            repo: config.repo,
            title: description,
            branch: branchName,
            baseBranch: config.base_branch,
            body: prBody
          });

          taskData.prNumber = pr.number;
          taskData.prUrl = pr.url;
          await this.saveTaskData(taskData);

          console.log(chalk.green(`\n[OK] PR Created: ${pr.url}\n`));
        } catch (error) {
          console.log(chalk.yellow(`[WARN] PR creation failed: ${error.message}`));
        }
      }

      // Show completion box
      const cost = costMonitor.getTotalCost();
      const costColor = cost < 0.05 ? chalk.green : cost < 0.15 ? chalk.yellow : chalk.red;
      const costStr = '$' + cost.toFixed(4);

      console.log('');
      console.log(chalk.green('╭─────────────────────────────────────╮'));
      console.log(chalk.green('│') + chalk.green.bold('  Task Complete') + ' '.repeat(22) + chalk.green('│'));
      console.log(chalk.green('│') + '  Cost: ' + costColor(costStr) + ' '.repeat(28 - costStr.length) + chalk.green('│'));
      console.log(chalk.green('╰─────────────────────────────────────╯'));
      console.log('');

      return {
        taskId,
        branchName,
        summary,
        cost: costMonitor.getTotalCost(),
        pr
      };
    } catch (error) {
      const errMsg = error.message.slice(0, 32);
      console.log('');
      console.log(chalk.red('╭─────────────────────────────────────╮'));
      console.log(chalk.red('│') + chalk.red.bold('  Task Failed') + ' '.repeat(24) + chalk.red('│'));
      console.log(chalk.red('│') + '  ' + chalk.gray(errMsg) + ' '.repeat(35 - errMsg.length) + chalk.red('│'));
      console.log(chalk.red('╰─────────────────────────────────────╯'));
      console.log('');

      // Generate error summary
      const errorSummary = this.summaryGenerator.createError({
        taskId,
        description,
        error,
        stage: 'execution'
      });

      console.log(errorSummary);

      // Save error state
      await this.saveTaskData({
        taskId,
        projectName,
        description,
        status: 'failed',
        error: {
          message: error.message,
          stack: error.stack
        },
        timestamp: new Date().toISOString()
      });

      throw error;
    } finally {
      // CRITICAL: Always cleanup container, even on error
      if (container) {
        try {
          await this.cleanupContainer(container);
          // Remove from active tracking AFTER successful cleanup
          this.activeContainers.delete(container);
        } catch (cleanupError) {
          console.error(chalk.yellow(`  [WARN]  Cleanup warning: ${cleanupError.message}`));
        }
      }
    }
  }


  /**
   * Gather comprehensive project context upfront
   * Reads project structure, key files, and caches everything
   */
  async gatherProjectContext(containerTools, conversation) {
    const context = {
      structure: '',
      files: [],
      techStack: {
        language: null,
        framework: null,
        testing: null,
        dependencies: []
      },
      readme: null,
      existingCode: {}
    };

    try {
      // 1. Get project structure (file tree)
      try {
        const tree = await containerTools.executeTool('bash', {
          command: 'find /workspace -type f -not -path "*/\\.*" -not -path "*/__pycache__/*" -not -path "*/node_modules/*" | head -50'
        });
        context.structure = tree.trim();
        context.files = tree.trim().split('\n').filter(f => f);
      } catch (error) {
        console.log(chalk.gray(`    [WARN]  Could not read project structure: ${error.message}`));
      }

      // 2. Detect tech stack and read key files
      const keyFiles = [
        'README.md',
        'requirements.txt',
        'package.json',
        'go.mod',
        'Cargo.toml',
        'pom.xml',
        'build.gradle'
      ];

      for (const file of keyFiles) {
        try {
          const content = await containerTools.executeTool('read_file', {
            path: `/workspace/${file}`
          });

          // Cache the file
          conversation.cacheFile(`/workspace/${file}`, content);

          // Parse based on file type
          if (file === 'README.md') {
            context.readme = content.substring(0, 500); // First 500 chars
          } else if (file === 'requirements.txt') {
            context.techStack.language = 'Python';
            context.techStack.dependencies = content.split('\n').slice(0, 10);
            const testFrameworks = ['pytest', 'unittest', 'nose'];
            const testingLib = content.split('\n').find(line =>
              testFrameworks.some(fw => line.toLowerCase().includes(fw))
            );
            if (testingLib) {
              context.techStack.testing = testingLib.split('==')[0].split('>=')[0].trim();
            }
          } else if (file === 'package.json') {
            context.techStack.language = 'JavaScript/TypeScript';
            try {
              const pkg = JSON.parse(content);
              if (pkg.dependencies) {
                context.techStack.dependencies = Object.keys(pkg.dependencies).slice(0, 10);
              }
              if (pkg.devDependencies) {
                const testFrameworks = ['jest', 'mocha', 'jasmine', 'vitest'];
                const testingLib = Object.keys(pkg.devDependencies).find(dep =>
                  testFrameworks.some(fw => dep.toLowerCase().includes(fw))
                );
                if (testingLib) {
                  context.techStack.testing = testingLib;
                }
              }
            } catch {}
          } else if (file === 'go.mod') {
            context.techStack.language = 'Go';
          } else if (file === 'Cargo.toml') {
            context.techStack.language = 'Rust';
          }
        } catch {
          // File doesn't exist, skip
        }
      }

      // 3. Read and cache main source files
      const sourceFiles = context.files.filter(f => {
        const ext = f.split('.').pop();
        return ['py', 'js', 'ts', 'go', 'rs', 'java', 'rb'].includes(ext) &&
               !f.includes('test') &&
               !f.includes('spec');
      }).slice(0, 5); // Limit to first 5 source files

      for (const file of sourceFiles) {
        try {
          const content = await containerTools.executeTool('read_file', { path: file });
          conversation.cacheFile(file, content);

          // Extract function/class names for reference
          const lines = content.split('\n');
          const definitions = lines
            .filter(line =>
              line.match(/^\s*(def |function |class |func |fn |public |private )/))
            .slice(0, 10);

          if (definitions.length > 0) {
            context.existingCode[file] = definitions;
          }
        } catch {}
      }

      // 4. Read and cache test files
      const testFiles = context.files.filter(f =>
        f.includes('test') || f.includes('spec')
      ).slice(0, 3);

      for (const file of testFiles) {
        try {
          const content = await containerTools.executeTool('read_file', { path: file });
          conversation.cacheFile(file, content);
        } catch {}
      }

    } catch (error) {
      console.log(chalk.yellow(`    [WARN]  Error gathering context: ${error.message}`));
    }

    return context;
  }

  /**
   * Format project context for agent prompts
   */
  formatProjectContext(context, conversation) {
    let formatted = '**📁 PROJECT CONTEXT**\n\n';

    // Tech stack
    if (context.techStack.language) {
      formatted += `**Language:** ${context.techStack.language}\n`;
    }
    if (context.techStack.testing) {
      formatted += `**Testing Framework:** ${context.techStack.testing}\n`;
    }
    if (context.techStack.dependencies.length > 0) {
      formatted += `**Dependencies:** ${context.techStack.dependencies.slice(0, 5).join(', ')}\n`;
    }
    formatted += '\n';

    // Project structure
    if (context.files.length > 0) {
      formatted += `**Project Structure (${context.files.length} files):**\n\`\`\`\n`;
      formatted += context.files.slice(0, 20).join('\n');
      if (context.files.length > 20) {
        formatted += `\n... and ${context.files.length - 20} more files`;
      }
      formatted += '\n```\n\n';
    }

    // README excerpt
    if (context.readme) {
      formatted += `**README Excerpt:**\n${context.readme}...\n\n`;
    }

    // Existing code patterns
    const codeFiles = Object.keys(context.existingCode);
    if (codeFiles.length > 0) {
      formatted += `**Existing Functions/Classes:**\n`;
      for (const file of codeFiles) {
        formatted += `\n${file}:\n`;
        for (const def of context.existingCode[file]) {
          formatted += `  ${def.trim()}\n`;
        }
      }
      formatted += '\n';
    }

    // File cache info
    const cacheStats = conversation.getFileCacheStats();
    if (cacheStats.totalFiles > 0) {
      formatted += `**[Cache] Cached Files (${cacheStats.totalFiles} available):**\n`;
      for (const file of cacheStats.files.slice(0, 10)) {
        formatted += `  - ${file.path} (${(file.size / 1024).toFixed(1)}KB)\n`;
      }
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Run multi-agent system using Claude Code CLI with dynamic routing
   * Agents decide next steps intelligently based on task requirements
   */
  async runClaudeCodeAgentSystem(container, description, costMonitor, projectPath, options = {}) {
    const workflowStartTime = Date.now();

    // Show orchestrator header
    console.log('');
    console.log(chalk.cyan('  orchestrator'));
    console.log(chalk.gray('  ────────────────────────────────────────'));
    console.log(chalk.white(`  ${description.slice(0, 60)}${description.length > 60 ? '...' : ''}`));
    console.log('');

    // Message callback helper
    const notifyMessage = (agent, content) => {
      if (options.onMessage) {
        options.onMessage({ agent, content, timestamp: Date.now() });
      }
    };

    const { ContainerTools } = await import('../test/container-tools.js');
    const { ConversationThread } = await import('./conversation-thread.js');

    const containerTools = new ContainerTools(container);
    const conversation = new ConversationThread();

    conversation.add('orchestrator', `Task: ${description}`, {});

    // Add tool context to conversation for agent awareness (silent)
    const toolContext = this.toolRegistry.getToolContextMarkdown();
    if (toolContext) {
      conversation.add('system', toolContext, { isToolContext: true });
    }

    // Step 1: Run orchestrator agent to create execution plan
    const orchestratorTools = new OrchestratorTools(this.agentRegistry, this.toolRegistry);
    const plan = await this.runOrchestratorAgent(
      orchestratorTools,
      description,
      conversation,
      costMonitor,
      containerTools
    );

    // Step 2: Execute with dynamic routing

    // Check if orchestrator completed the task directly
    if (plan.directCompletion) {
      const totalWorkflowTime = Date.now() - workflowStartTime;
      const conversationStats = conversation.getStats();

      return {
        success: true,
        plan: {
          summary: 'Task completed directly by orchestrator',
          agents: [],
          actualSequence: ['orchestrator'],
          iterations: 1,
          approved: true,
          backend: 'claude-code-cli-orchestrator',
          totalMessages: conversationStats.totalMessages
        },
        changes: { files: [], summary: 'No code changes - direct response' },
        conversations: { architect: null, coder: [], reviewer: [] },
        conversationThread: conversation,
        performance: {
          totalDuration: totalWorkflowTime,
          agentDuration: totalWorkflowTime,
          messagesExchanged: conversationStats.totalMessages
        }
      };
    }

    const executor = new DynamicAgentExecutor(
      this.agentRegistry,
      conversation,
      containerTools,
      costMonitor,
      { verbose: false }
    );

    let currentAgent = plan.agents[0]; // Start with first planned agent
    let iterationCount = 0;
    const maxIterations = 10; // Safety limit
    const executionLog = [];
    let approved = false;

    while (currentAgent && iterationCount < maxIterations) {
      iterationCount++;

      // Safety check: detect loops
      if (executor.detectLoop()) {
        console.log(chalk.red.bold('\n[ERROR] Agent loop detected!'));
        console.log(chalk.yellow(`  Last 3 agents keep repeating. Breaking to prevent infinite loop.\n`));
        break;
      }

      // Safety check: agent visited too many times
      if (executor.getVisitCount(currentAgent) > 2) {
        console.log(chalk.yellow(`\n[WARN]  Agent '${currentAgent}' visited ${executor.getVisitCount(currentAgent)} times\n`));
      }

      // Execute current agent
      try {
        const execution = await executor.execute(currentAgent, { task: description });

        // Notify message callback with agent response
        if (execution.response) {
          notifyMessage(currentAgent, execution.response);
        }

        executionLog.push({
          iteration: iterationCount,
          agent: currentAgent,
          decision: execution.decision,
          duration: execution.duration,
          cost: execution.cost
        });

        // Check if task is complete
        if (execution.decision.isComplete) {
          approved = true;
          break;
        }

        // Validate next agent
        const nextAgent = execution.decision.nextAgent;
        if (!nextAgent) {
          console.log(chalk.yellow('\n[WARN]  No next agent specified but task not marked complete'));
          console.log(chalk.gray('  Assuming task is complete...\n'));
          approved = true;
          break;
        }

        if (!this.agentRegistry.has(nextAgent)) {
          console.log(chalk.red(`\n[ERROR] Unknown agent requested: '${nextAgent}'`));
          console.log(chalk.yellow('  Routing to reviewer as fallback...\n'));
          currentAgent = 'reviewer';
        } else {
          currentAgent = nextAgent;
        }

      } catch (error) {
        console.log(chalk.red(`\n[ERROR] Agent '${currentAgent}' failed: ${error.message}\n`));

        // If architect fails, try with just coder+reviewer
        if (currentAgent === 'architect' && iterationCount === 1) {
          console.log(chalk.yellow('  Fallback: Skipping architect, starting with coder...\n'));
          currentAgent = 'coder';
        }
        // If coder fails, try to at least get a review
        else if (currentAgent === 'coder') {
          console.log(chalk.yellow('  Fallback: Routing to reviewer for assessment...\n'));
          currentAgent = 'reviewer';
        }
        // If reviewer fails or other agent, break
        else {
          console.log(chalk.red('  Cannot recover, stopping execution.\n'));
          break;
        }
      }
    }

    // Check if we hit max iterations
    if (iterationCount >= maxIterations) {
      console.log(chalk.red.bold('\n[ERROR] Max iterations reached!'));
      console.log(chalk.yellow(`  Task did not complete within ${maxIterations} agent executions.\n`));
    }

    // Display execution summary
    executor.displaySummary();

    // Calculate final state (for compatibility)
    const totalWorkflowTime = Date.now() - workflowStartTime;
    const summary = executor.getSummary();

    // Build legacy conversations structure for backward compatibility
    const conversations = {
      architect: null,
      coder: [],
      reviewer: []
    };

    // Get conversation stats
    const conversationStats = conversation.getStats();

    // Return results
    return {
      success: approved,
      plan: {
        summary: `Dynamic routing: ${summary.agentSequence.join(' → ')}`,
        agents: plan.agents,
        actualSequence: summary.agentSequence,
        iterations: iterationCount,
        approved,
        backend: 'claude-code-cli-dynamic',
        totalMessages: conversationStats.totalMessages
      },
      changes: {
        files: ['modified files'], // TODO: Parse from git diff
        summary: 'Dynamic agent system implementation'
      },
      conversations, // Legacy structure (empty but present for compatibility)
      conversationThread: conversation,
      performance: {
        totalDuration: totalWorkflowTime,
        agentDuration: summary.totalDuration,
        messagesExchanged: conversationStats.totalMessages
      }
    };
  }

  /**
   * Run the orchestrator agent to create an execution plan
   * The orchestrator uses discovery to understand available agents
   * @param {OrchestratorTools} orchestratorTools - Tools instance for discovery
   * @param {string} description - Task description
   * @param {ConversationThread} conversation - Shared conversation
   * @param {CostMonitor} costMonitor - Cost tracking
   * @param {ContainerTools} containerTools - Container tools for file access
   * @returns {Promise<Object>} - Execution plan
   */
  async runOrchestratorAgent(orchestratorTools, description, conversation, costMonitor, containerTools) {
    const { ClaudeCodeAgent } = await import('./claude-code-agent.js');

    // Get available agents and tools using discovery
    const agentsInfo = orchestratorTools.listAvailableAgents();
    const toolsInfo = orchestratorTools.listAvailableTools();

    // Format agents for the prompt
    const agentsMarkdown = agentsInfo.agents.map(a =>
      `- **${a.name}**: ${a.description}\n  Capabilities: ${a.capabilities.join(', ')}`
    ).join('\n');

    // Format tools if any
    const toolsMarkdown = toolsInfo.tools.length > 0
      ? `\n\n**External Tools Available:**\n${toolsInfo.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`
      : '';

    // Create orchestrator agent
    const orchestratorAgent = new ClaudeCodeAgent({
      role: 'orchestrator',
      model: 'haiku', // Fast planning with Haiku
      allowedTools: [], // No tools needed - just analysis
      systemPrompt: `You are the **orchestrator** - the intelligent coordinator of a multi-agent system.

Your job is to analyze the task and create an execution plan.

## Available Agents

${agentsMarkdown}${toolsMarkdown}

## Planning Guidelines

- Use MINIMUM agents needed (don't over-engineer)
- Simple analysis tasks: just architect
- Implementation tasks: architect -> coder -> reviewer
- Security tasks: architect -> coder -> security -> reviewer
- ServiceNow tasks: use the specialized sn-* agents
- Skip architect for trivial fixes
- Always include reviewer for code changes

## Output Format (REQUIRED)

You MUST output your plan in this exact JSON format:
\`\`\`json
{
  "task_analysis": "Brief analysis of what the task requires",
  "agent_sequence": ["agent1", "agent2"],
  "workflow_type": "sequential",
  "success_criteria": "What defines task completion"
}
\`\`\``,
      workingDir: containerTools?.workingDir || '/workspace',
      sessionId: uuidv4()
    });

    // Build prompt for orchestrator
    const prompt = `**Task:** ${description}

Analyze this task and create an execution plan. Output your plan in the JSON format specified.`;

    try {
      const result = await orchestratorAgent.executeWithTools({
        initialPrompt: prompt,
        containerTools,
        costMonitor
      });

      // Parse the plan from response
      const plan = this.parseOrchestratorResponse(result.response);

      if (plan) {
        // Check if orchestrator completed the task directly (empty agent sequence)
        const isDirectCompletion = plan.taskType && (
          plan.taskType.includes('direct') ||
          plan.taskType === 'complete' ||
          plan.taskType === 'none'
        );

        if (plan.agents.length === 0 && isDirectCompletion) {
          console.log(chalk.green('  Task completed directly by orchestrator'));
          console.log('');

          // Add to conversation
          conversation.add('orchestrator',
            `**Task Completed Directly**\n${plan.reasoning}`,
            { cost: result.cost || 0 }
          );

          // Return special marker to skip agent execution
          return {
            agents: [],
            taskType: 'direct',
            reasoning: plan.reasoning,
            directCompletion: true
          };
        }

        // Validate agents exist
        const validation = this.agentRegistry.validateAgents(plan.agents);
        if (!validation.valid) {
          console.log(chalk.yellow(`  [WARN]  Unknown agents: ${validation.missing.join(', ')}`));
          // Remove unknown agents
          plan.agents = plan.agents.filter(a => this.agentRegistry.has(a));
        }

        if (plan.agents.length > 0) {
          // Display plan
          orchestratorTools.displayPlan({
            task_analysis: plan.reasoning,
            agent_sequence: plan.agents,
            workflow_type: plan.taskType,
            success_criteria: plan.successCriteria || 'Task completed successfully',
            estimated_cost: this.agentRegistry.estimateCost(plan.agents)
          });

          // Add plan to conversation so other agents can see it
          conversation.add('orchestrator',
            `**Execution Plan:**\n` +
            `- Analysis: ${plan.reasoning}\n` +
            `- Agents: ${plan.agents.join(' -> ')}\n` +
            `- Workflow: ${plan.taskType}`,
            { cost: result.cost || 0 }
          );

          return plan;
        }
      }

      console.log(chalk.yellow('  [WARN]  Could not parse orchestrator plan'));
    } catch (error) {
      console.log(chalk.yellow(`  [WARN]  Orchestrator agent failed: ${error.message}`));
    }

    // Fallback to heuristic planning
    console.log(chalk.gray('  Using heuristic planning...'));
    const heuristicPlan = this.heuristicPlan(description);

    // Display plan
    console.log(chalk.gray(`  Plan: ${heuristicPlan.agents.join(' -> ')}`));
    console.log('');

    conversation.add('orchestrator', `Plan: ${heuristicPlan.agents.join(' -> ')}`, {});
    return heuristicPlan;
  }

  /**
   * Parse orchestrator response for plan
   * @private
   */
  parseOrchestratorResponse(response) {
    try {
      // Look for JSON plan in response
      const jsonMatch = response.match(/```json\n([\s\S]+?)\n```/) ||
                       response.match(/```\n([\s\S]+?)\n```/) ||
                       response.match(/(\{[\s\S]*?"agent_sequence"[\s\S]*?\})/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const plan = JSON.parse(jsonStr);

        if (plan.agent_sequence && Array.isArray(plan.agent_sequence)) {
          return {
            agents: plan.agent_sequence,
            taskType: plan.workflow_type || 'sequential',
            reasoning: plan.task_analysis || 'AI-generated plan',
            successCriteria: plan.success_criteria || 'Task completed successfully'
          };
        }
      }

      // Fallback: look for agent names mentioned in response
      const agentNames = ['architect', 'coder', 'reviewer', 'security', 'tester', 'documenter', 'performance'];
      const snAgentNames = ['sn-api', 'sn-scripting', 'sn-ui', 'sn-data', 'sn-integration'];
      const allAgents = [...agentNames, ...snAgentNames];

      // Find agents mentioned and preserve order based on first mention
      const foundAgents = [];
      const responseLower = response.toLowerCase();

      for (const agent of allAgents) {
        const index = responseLower.indexOf(agent);
        if (index !== -1) {
          foundAgents.push({ name: agent, index });
        }
      }

      // Sort by first mention order
      foundAgents.sort((a, b) => a.index - b.index);

      if (foundAgents.length > 0) {
        return {
          agents: foundAgents.map(a => a.name),
          taskType: 'sequential',
          reasoning: 'Inferred from orchestrator response',
          successCriteria: 'Task completed successfully'
        };
      }

      return null;
    } catch (error) {
      // JSON parse failed, try inferring
      return null;
    }
  }

  /**
   * Simple heuristic planning fallback
   * @private
   */
  heuristicPlan(task) {
    const taskLower = task.toLowerCase();

    // ServiceNow task detection
    if (taskLower.includes('servicenow') || taskLower.includes('sn-tools') ||
        taskLower.includes('gliderecord') || taskLower.includes('script include') ||
        taskLower.includes('business rule') || taskLower.includes('x_cadso')) {
      // Route to appropriate SN agent
      if (taskLower.includes('api') || taskLower.includes('rest')) {
        return { agents: ['sn-api'], taskType: 'sequential', reasoning: 'ServiceNow API task' };
      }
      if (taskLower.includes('script') || taskLower.includes('business rule')) {
        return { agents: ['sn-scripting'], taskType: 'sequential', reasoning: 'ServiceNow scripting task' };
      }
      if (taskLower.includes('component') || taskLower.includes('ui') || taskLower.includes('portal')) {
        return { agents: ['sn-ui'], taskType: 'sequential', reasoning: 'ServiceNow UI task' };
      }
      return { agents: ['sn-integration'], taskType: 'sequential', reasoning: 'General ServiceNow task' };
    }

    // Analysis only
    if ((taskLower.includes('analyze') || taskLower.includes('review') || taskLower.includes('explain')) &&
        !taskLower.includes('implement') && !taskLower.includes('fix')) {
      return { agents: ['architect'], taskType: 'analysis', reasoning: 'Analysis-only task' };
    }

    // Documentation
    if (taskLower.includes('document') || taskLower.includes('readme')) {
      return { agents: ['documenter'], taskType: 'documentation', reasoning: 'Documentation task' };
    }

    // Security
    if (taskLower.includes('security') || taskLower.includes('auth') || taskLower.includes('password')) {
      return { agents: ['architect', 'coder', 'security', 'reviewer'], taskType: 'security', reasoning: 'Security-sensitive task' };
    }

    // Default: standard workflow
    return { agents: ['architect', 'coder', 'reviewer'], taskType: 'implementation', reasoning: 'Standard implementation workflow' };
  }

  /**
   * Mock agent execution (fallback)
   * Used when Claude Code agents fail
   */
  async mockAgentExecution(container, description, costMonitor) {
    console.log(chalk.gray('  [MOCK] Simulating agent execution...'));

    // Import ContainerTools to properly write files
    const { ContainerTools } = await import('../test/container-tools.js');
    const containerTools = new ContainerTools(container);

    // Create a simple test file using ContainerTools
    const testCode = `# ${description}\n\nprint("Hello from Claude Multi-Agent System!")\nprint("This is a mock execution demonstrating the workflow")`;

    await containerTools.executeTool('write_file', {
      path: '/workspace/test_mock.py',
      content: testCode
    });

    // Mock some API usage
    costMonitor.addUsage({
      inputTokens: 5000,
      outputTokens: 1000
    });

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work

    console.log(chalk.gray('  [MOCK] Agent execution simulated'));

    return {
      success: true,
      plan: {
        summary: 'Mock agent created a test file with the task description'
      },
      changes: {
        files: ['test_mock.py'],
        summary: 'Created test_mock.py demonstrating the agent workflow'
      }
    };
  }

  /**
   * Run tests in container
   */
  async runTests(container, config) {
    if (!config.tests || !config.tests.command) {
      return { passed: null, output: 'No tests configured' };
    }

    try {
      const output = await this.dockerManager.exec(
        container,
        config.tests.command
      );

      return {
        passed: true,
        output,
        count: null // TODO: Parse test output
      };
    } catch (error) {
      return {
        passed: false,
        output: error.message
      };
    }
  }

  /**
   * Manually create PR for a task (used when auto-PR creation failed)
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} - PR details
   */
  async approve(taskId) {
    console.log(chalk.cyan.bold(`\n[Push] Creating PR for Task: ${taskId}\n`));

    try {
      // Load task data
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Check if PR already exists
      if (taskData.prUrl) {
        console.log(chalk.yellow(`PR already exists: ${taskData.prUrl}\n`));
        return { url: taskData.prUrl, number: taskData.prNumber };
      }

      if (taskData.status !== 'completed') {
        throw new Error(`Task is not completed (status: ${taskData.status}). Only completed tasks can have PRs created.`);
      }

      // For local repos, there's no GitHub to push to
      if (taskData.config.repo === 'local') {
        console.log(chalk.yellow('Local repo - no GitHub PR to create.\n'));
        console.log(chalk.gray('Changes are available in the task branch.\n'));
        return { url: null, number: null, local: true };
      }

      // Push branch to GitHub
      if (this.githubClient) {
        // Determine project path
        let projectPath;
        if (taskData.config.local_path === 'cwd') {
          projectPath = process.cwd();
        } else if (taskData.config.local_path) {
          projectPath = taskData.config.local_path;
        } else {
          projectPath = path.join(this.globalConfig.get('projectsDir'), taskData.config.name);
        }

        console.log(chalk.blue('[Push] Pushing branch to GitHub...'));
        await this.githubClient.pushBranch(projectPath, taskData.branchName);
        console.log(chalk.green('  [OK] Branch pushed\n'));

        // Create PR
        console.log(chalk.blue('[PR] Creating pull request...'));
        const prBody = this.summaryGenerator.createPRDescription({
          description: taskData.description,
          result: taskData.result,
          testResults: taskData.testResults,
          taskId
        });

        const pr = await this.githubClient.createPullRequest({
          repo: taskData.config.repo,
          title: `${taskData.description}`,
          branch: taskData.branchName,
          baseBranch: taskData.config.base_branch,
          body: prBody
        });

        // Update task with PR info
        taskData.prNumber = pr.number;
        taskData.prUrl = pr.url;
        await this.saveTaskData(taskData);

        console.log(chalk.green.bold(`\n[OK] PR Created: ${pr.url}\n`));

        return pr;
      } else {
        throw new Error('GitHub token not configured. Cannot create PR.');
      }
    } catch (error) {
      console.log(chalk.red(`\n[ERROR] PR creation failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Reject task and cleanup
   * @param {string} taskId - Task ID to reject
   */
  async reject(taskId) {
    console.log(chalk.cyan.bold(`\n[ERROR] Rejecting Task: ${taskId}\n`));

    try {
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const projectPath = path.join(homedir(), 'projects', taskData.config.name);

      // Delete branch
      console.log(chalk.blue('[Cleanup] Deleting branch...'));
      await this.gitManager.deleteBranch(projectPath, taskData.branchName, true);

      // Remove container if exists
      if (taskData.containerId) {
        console.log(chalk.blue('[Cleanup] Removing container...'));
        await this.dockerManager.remove(taskData.containerId);
      }

      // Update task status
      taskData.status = 'rejected';
      await this.saveTaskData(taskData);

      console.log(chalk.green.bold('\n[OK] Task rejected and cleaned up\n'));
    } catch (error) {
      console.log(chalk.red(`\n[ERROR] Rejection failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Cancel task and cleanup (works for any status)
   * @param {string} taskId - Task ID to cancel
   */
  async cancel(taskId) {
    console.log(chalk.cyan.bold(`\n[Cancel] Cancelling Task: ${taskId}\n`));

    try {
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const projectPath = path.join(homedir(), 'projects', taskData.config.name);

      // Delete branch if it exists
      try {
        console.log(chalk.blue('[Cleanup] Deleting branch...'));
        await this.gitManager.deleteBranch(projectPath, taskData.branchName, true);
        console.log(chalk.green('  [OK] Branch deleted'));
      } catch (error) {
        console.log(chalk.gray(`  [WARN]  Branch already deleted or doesn't exist`));
      }

      // Remove container if exists
      if (taskData.containerId) {
        try {
          console.log(chalk.blue('[Cleanup] Removing container...'));
          await this.dockerManager.remove(taskData.containerId);
          console.log(chalk.green('  [OK] Container removed'));
        } catch (error) {
          console.log(chalk.gray(`  [WARN]  Container already removed or doesn't exist`));
        }
      }

      // Update task status
      taskData.status = 'cancelled';
      taskData.cancelledAt = new Date().toISOString();
      await this.saveTaskData(taskData);

      console.log(chalk.green.bold('\n[OK] Task cancelled and cleaned up\n'));
    } catch (error) {
      console.log(chalk.red(`\n[ERROR] Cancellation failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Retry a failed or rejected task
   * @param {string} taskId - Task ID to retry
   */
  async retry(taskId) {
    console.log(chalk.cyan.bold(`\n[Exec] Retrying Task: ${taskId}\n`));

    try {
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Only allow retry for failed, rejected, or cancelled tasks
      if (!['failed', 'rejected', 'cancelled'].includes(taskData.status)) {
        throw new Error(`Cannot retry task with status: ${taskData.status}. Only failed, rejected, or cancelled tasks can be retried.`);
      }

      console.log(chalk.blue(`Original task: ${taskData.description}`));
      console.log(chalk.blue(`Original status: ${taskData.status}`));
      console.log(chalk.blue(`Retrying as new task...\n`));

      // Execute as a new task
      await this.executeTask(taskData.projectName, taskData.description);

    } catch (error) {
      console.log(chalk.red(`\n[ERROR] Retry failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Show git diff for a task
   * @param {string} taskId - Task ID
   * @param {boolean} statOnly - Show only diffstat
   */
  async showDiff(taskId, statOnly = false) {
    try {
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Check if task has necessary data
      if (!taskData.config || !taskData.branchName) {
        console.log(chalk.yellow(`\n[WARN]  Task ${taskId} did not complete successfully`));
        console.log(chalk.yellow(`Status: ${this.formatStatus(taskData.status)}`));
        console.log(chalk.yellow(`No branch or config available for diff\n`));
        return;
      }

      const projectPath = path.join(homedir(), 'projects', taskData.config.name);

      console.log(chalk.cyan.bold(`\n[Status] Diff for Task: ${taskId}\n`));
      console.log(chalk.blue(`Project:     ${taskData.projectName}`));
      console.log(chalk.blue(`Branch:      ${taskData.branchName}`));
      console.log(chalk.blue(`Description: ${taskData.description}`));
      console.log(chalk.blue(`Status:      ${this.formatStatus(taskData.status)}\n`));

      // Get the diff
      const diff = await this.gitManager.getDiff(
        projectPath,
        taskData.config.base_branch,
        taskData.branchName,
        statOnly
      );

      if (!diff || diff.trim() === '') {
        console.log(chalk.yellow('No changes found\n'));
        return;
      }

      console.log(chalk.cyan('-'.repeat(70)));
      console.log(diff);
      console.log(chalk.cyan('-'.repeat(70) + '\n'));

    } catch (error) {
      console.log(chalk.red(`\n[ERROR] Failed to show diff: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Show task status
   * @param {string} taskId - Optional task ID
   */
  async showStatus(taskId) {
    if (taskId) {
      // Show specific task
      const taskData = await this.loadTaskData(taskId);
      if (!taskData) {
        console.log(chalk.red(`Task not found: ${taskId}`));
        return;
      }

      console.log(chalk.cyan.bold(`\n[Status] Task Status: ${taskId}\n`));
      console.log(`Status:      ${this.formatStatus(taskData.status)}`);
      console.log(`Project:     ${taskData.projectName}`);
      console.log(`Description: ${taskData.description}`);
      console.log(`Branch:      ${taskData.branchName}`);
      if (taskData.prUrl) {
        console.log(`PR:          ${taskData.prUrl}`);
      }
      console.log(`Created:     ${taskData.timestamp}`);
      console.log('');
    } else {
      // Show all tasks
      const tasks = await this.listTasks();
      const statusReport = this.summaryGenerator.createStatusReport(tasks);
      console.log(statusReport);
    }
  }

  /**
   * List all configured projects
   */
  async listProjects() {
    const projects = await this.configManager.listProjects();

    console.log(chalk.cyan.bold('\n📁 Configured Projects\n'));

    if (projects.length === 0) {
      console.log('No projects configured');
      console.log('Add a project with: claude add-project <name>');
      console.log('');
      return;
    }

    for (const name of projects) {
      console.log(`  • ${name}`);
    }
    console.log('');
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `${timestamp}-${random}`;
  }

  /**
   * Save task data to file
   */
  async saveTaskData(taskData) {
    await fs.mkdir(this.tasksDir, { recursive: true });
    const filePath = path.join(this.tasksDir, `${taskData.taskId}.json`);
    await fs.writeFile(filePath, JSON.stringify(taskData, null, 2));
  }

  /**
   * Load task data from file
   */
  async loadTaskData(taskId) {
    try {
      const filePath = path.join(this.tasksDir, `${taskId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * List all tasks
   */
  async listTasks() {
    try {
      const files = await fs.readdir(this.tasksDir);
      const tasks = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const taskData = await this.loadTaskData(file.replace('.json', ''));
          if (taskData) {
            tasks.push(taskData);
          }
        }
      }

      // Sort by timestamp, newest first
      return tasks.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch {
      return [];
    }
  }

  /**
   * Format status with color
   */
  formatStatus(status) {
    switch (status) {
      case 'completed':
      case 'approved':
        return chalk.green(status);
      case 'failed':
      case 'rejected':
        return chalk.red(status);
      case 'pending_approval':
        return chalk.yellow(status);
      default:
        return status;
    }
  }

  /**
   * Cleanup a specific container
   * Stops and removes from tracking
   * @param {string} container - Container name/ID
   */
  async cleanupContainer(container) {
    if (!container) return;

    try {
      // Check if container still exists
      const status = await this.dockerManager.status(container);

      if (status === 'running') {
        await this.dockerManager.stop(container);
      }

      // Remove from active tracking
      this.activeContainers.delete(container);
    } catch (error) {
      // Container might already be stopped/removed - that's okay
      this.activeContainers.delete(container);
    }
  }

  /**
   * Cleanup all active containers
   * Called on process exit to prevent hanging containers
   */
  async cleanupAll() {
    if (this.activeContainers.size === 0) {
      return;
    }

    console.log(chalk.yellow(`\n🧹 Cleaning up ${this.activeContainers.size} active container(s)...`));

    const cleanupPromises = Array.from(this.activeContainers).map(async (container) => {
      try {
        await this.cleanupContainer(container);
        console.log(chalk.green(`  [OK] Cleaned up: ${container}`));
      } catch (error) {
        console.log(chalk.yellow(`  [WARN]  Could not cleanup ${container}: ${error.message}`));
      }
    });

    await Promise.all(cleanupPromises);
    console.log(chalk.green('  [OK] Cleanup complete\n'));
  }

  /**
   * Cleanup all Claude containers (including orphaned ones)
   * Useful for cleaning up containers from crashed/interrupted tasks
   */
  async cleanupAllClaudeContainers() {
    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve, reject) => {
        // Find all Claude containers
        const listProcess = spawn('docker', ['ps', '-a', '--filter', 'name=claude-', '--format', '{{.ID}}']);

        let containerIds = '';

        listProcess.stdout.on('data', (data) => {
          containerIds += data.toString();
        });

        listProcess.on('close', async (code) => {
          if (code !== 0) {
            resolve({ cleaned: 0, message: 'No containers found or docker not available' });
            return;
          }

          const ids = containerIds.trim().split('\n').filter(id => id);

          if (ids.length === 0) {
            resolve({ cleaned: 0, message: 'No Claude containers found' });
            return;
          }

          console.log(chalk.yellow(`\n🧹 Found ${ids.length} Claude container(s) to clean up...`));

          // Remove all containers
          const removeProcess = spawn('docker', ['rm', '-f', ...ids]);

          removeProcess.on('close', (removeCode) => {
            if (removeCode === 0) {
              console.log(chalk.green(`  [OK] Cleaned up ${ids.length} container(s)\n`));
              resolve({ cleaned: ids.length, containerIds: ids });
            } else {
              reject(new Error('Failed to remove containers'));
            }
          });
        });
      });
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Create architect agent for task analysis
   * @param {Object} config - Project configuration
   * @returns {Object} Architect agent with query method
   */
  async createArchitectAgent(config) {
    // Return a simple stub - parallel execution is rarely needed
    // Most tasks work fine with sequential execution
    return {
      query: async (prompt) => {
        // Return a simple "don't parallelize" response
        return JSON.stringify({
          complexity: 3,
          canParallelize: false,
          reasoning: "Sequential execution preferred for reliability",
          parts: []
        });
      }
    };
  }

  /**
   * Execute task in parallel mode
   * @param {string} taskId - Task ID
   * @param {string} projectName - Project name
   * @param {string} description - Task description
   * @param {Object} config - Project configuration
   * @param {Object} analysis - Task analysis result
   * @returns {Object} Task result
   */
  async executeParallel(taskId, projectName, description, config, analysis) {
    const startTime = Date.now();

    // Determine project path - support local_path: cwd for adhoc tasks
    let projectPath;
    if (config.local_path === 'cwd') {
      projectPath = process.cwd();
    } else if (config.local_path) {
      // Expand ~ to home directory
      projectPath = config.local_path.startsWith('~')
        ? config.local_path.replace('~', process.env.HOME || homedir())
        : config.local_path;
    } else {
      projectPath = path.join(this.globalConfig.get('projectsDir'), config.name);
    }

    const mainBranch = `task-${taskId}-main`;
    const isLocalRepo = config.repo === 'local';

    try {
      // Step 1: Setup Git environment
      console.log(chalk.blue('Step 1: Setting up Git environment'));

      // Ensure project path exists (auto-create for adhoc workspace)
      try {
        await fs.access(projectPath);
      } catch (error) {
        // Auto-create adhoc workspace directory (no git needed - purely local)
        if (config.name === 'adhoc' && config.local_path && config.local_path !== 'cwd') {
          // Silently create adhoc workspace
          await fs.mkdir(projectPath, { recursive: true });
        } else {
          throw new Error(
            `Project directory not found: ${projectPath}\n\n` +
            (config.local_path === 'cwd'
              ? `Current directory doesn't exist or is inaccessible`
              : `Run workflow mode first to set up the project: dev-tools`)
          );
        }
      }

      // Pull latest changes and create main branch (skip pull for local repos)
      if (isLocalRepo) {
        // No git operations needed for local/adhoc repos
        console.log(chalk.gray('  → Local repo - skipping git setup'));
      } else {
        await this.gitManager.pull(projectPath, config.base_branch);
        await this.gitManager.createBranch(projectPath, mainBranch);
        console.log(chalk.green('  [OK] Git setup complete'));
      }
      console.log();

      // Step 2: Execute agents in parallel
      console.log(chalk.blue('Step 2: Parallel Agent Execution'));

      const parallelManager = new ParallelAgentManager(this, taskId);
      const parallelResult = await parallelManager.executeParallel(
        mainBranch,
        projectName,
        analysis.parts
      );

      // Step 3: Merge branches
      console.log(chalk.blue('Step 3: Merging Branches'));

      const merger = new BranchMerger(this.gitManager, projectPath);
      await merger.mergeAll(mainBranch, parallelResult.results);

      // Step 4: Run reviewer on combined result
      console.log(chalk.blue('Step 4: Final Review'));

      // Create reviewer agent container
      const reviewerContainer = await this.dockerManager.create({
        name: `claude-${taskId}-reviewer`,
        memory: '4g',
        cpus: 2
      });

      this.activeContainers.add(reviewerContainer);

      await this.dockerManager.start(reviewerContainer);

      // Mount tools
      const toolsPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'tools');
      await this.dockerManager.mountTools(reviewerContainer, toolsPath, projectPath);

      // Create and execute reviewer agent
      const executor = new DynamicAgentExecutor(
        this.agentRegistry,
        this.toolRegistry,
        this.anthropicApiKey,
        config
      );

      const reviewResult = await executor.executeWorkflow(
        'Review all changes from parallel agents',
        reviewerContainer,
        projectPath,
        mainBranch,
        config.base_branch,
        new CostMonitor(5.00)
      );

      // Cleanup reviewer container
      await this.dockerManager.stop(reviewerContainer);
      await this.dockerManager.remove(reviewerContainer);
      this.activeContainers.delete(reviewerContainer);

      console.log(chalk.green('  [OK] Review complete\n'));

      // Step 5: Generate summary
      console.log(chalk.blue('Step 5: Generating Summary'));

      const duration = (Date.now() - startTime) / 1000;
      const summary = await this.summaryGenerator.generate({
        taskId,
        description,
        branchName: mainBranch,
        parallelMode: true,
        parallelParts: analysis.parts.length,
        cost: parallelResult.totalCost + (reviewResult.cost || 0),
        duration,
        agentResults: parallelResult.results
      });

      console.log(chalk.green('  [OK] Summary generated\n'));

      // Step 6: Save task metadata
      const taskDir = path.join(this.tasksDir, taskId);
      await fs.mkdir(taskDir, { recursive: true });
      await fs.writeFile(
        path.join(taskDir, 'metadata.json'),
        JSON.stringify({
          taskId,
          projectName,
          description,
          branchName: mainBranch,
          parallelMode: true,
          parallelParts: analysis.parts.length,
          cost: parallelResult.totalCost + (reviewResult.cost || 0),
          duration,
          timestamp: new Date().toISOString()
        }, null, 2)
      );

      // Step 7: Display summary
      console.log(summary);

      return {
        taskId,
        branchName: mainBranch,
        parallelParts: analysis.parts.length,
        cost: parallelResult.totalCost + (reviewResult.cost || 0),
        duration
      };

    } catch (error) {
      console.error(chalk.red(`\n[ERROR] Parallel execution failed: ${error.message}\n`));

      // Display merge conflicts if applicable
      if (error.name === 'MergeConflictError') {
        const merger = new BranchMerger(this.gitManager, projectPath);
        console.error(merger.formatConflicts(error.conflicts));
      }

      throw error;
    }
  }

  /**
   * Register cleanup handlers for process exit
   * Ensures containers are cleaned up even if process is interrupted
   */
  registerCleanupHandlers() {
    if (this.cleanupRegistered) return;

    const cleanupAndExit = async (signal) => {
      console.log(chalk.yellow(`\n\n[WARN]  Received ${signal}, cleaning up...`));

      try {
        await this.cleanupAll();
      } catch (error) {
        console.error(chalk.red(`Cleanup error: ${error.message}`));
      }

      process.exit(signal === 'SIGINT' ? 130 : 0);
    };

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      cleanupAndExit('SIGINT').catch(err => {
        console.error(chalk.red('Cleanup failed:', err));
        process.exit(130);
      });
    });

    // Handle kill command
    process.on('SIGTERM', () => {
      cleanupAndExit('SIGTERM').catch(err => {
        console.error(chalk.red('Cleanup failed:', err));
        process.exit(143);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red(`\n💥 Uncaught exception: ${error.message}`));
      console.error(error.stack);

      try {
        await this.cleanupAll();
      } catch (cleanupError) {
        console.error(chalk.red(`Cleanup error: ${cleanupError.message}`));
      }

      process.exit(1);
    });

    this.cleanupRegistered = true;
  }
}
