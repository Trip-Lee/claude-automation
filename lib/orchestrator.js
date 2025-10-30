/**
 * Orchestrator - Core workflow orchestration
 * Coordinates all components to execute tasks
 *
 * Flow:
 * 1. Pre-flight checks (config, git, docker)
 * 2. Setup environment (branch, container)
 * 3. Execute agent system (Phase 2 - mock for now)
 * 4. Run tests
 * 5. Generate summary
 * 6. Wait for approval/rejection
 */

import { DockerManager } from './docker-manager.js';
import { GitHubClient } from './github-client.js';
import { CostMonitor } from './cost-monitor.js';
import { SummaryGenerator } from './summary-generator.js';
import { ConfigManager } from './config-manager.js';
import { GitManager } from './git-manager.js';
import { AgentRegistry } from './agent-registry.js';
import { registerStandardAgents } from './standard-agents.js';
import { TaskPlanner } from './task-planner.js';
import { DynamicAgentExecutor } from './dynamic-agent-executor.js';
import { ToolRegistry } from './tool-registry.js';
import { getGlobalConfig } from './global-config.js';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';

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
   * @returns {Promise<Object>} - { taskId, branchName, summary }
   */
  async executeTask(projectName, description) {
    const taskId = this.generateTaskId();
    const startTime = Date.now();
    let container = null;
    let branchName = null;

    console.log(chalk.cyan.bold(`\n🚀 Starting Task: ${taskId}\n`));

    try {
      // Step 1: Pre-flight checks
      console.log(chalk.blue('📋 Step 1/7: Pre-flight checks'));
      const config = await this.configManager.load(projectName);
      await this.dockerManager.ping();

      // Validate GitHub repository setup (if configured)
      if (this.githubClient && config.repo && config.repo !== 'local') {
        console.log(chalk.gray('  → Validating GitHub repository...'));

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

        console.log(chalk.green('    ✅ Repository validated'));
      }

      console.log(chalk.green('  ✅ All checks passed\n'));

      // Step 2 & 3: Setup Git and Docker in parallel
      console.log(chalk.blue('📋 Step 2-3/7: Setting up Git environment and Docker container (parallel)'));
      const projectPath = path.join(this.globalConfig.get('projectsDir'), config.name);
      branchName = `claude/${taskId}`;

      // Ensure project exists
      try {
        await fs.access(projectPath);
      } catch {
        throw new Error(
          `Project directory not found: ${projectPath}\n` +
          `Please clone the repository first`
        );
      }

      // Run Git and Docker setup in parallel
      // Get tools directory path
      const toolsPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'tools');

      // Get tool environment variables
      const toolEnv = this.toolRegistry.getAllToolEnvironmentVars();

      const [, createdContainer] = await Promise.all([
        // Git setup
        (async () => {
          await this.gitManager.pull(projectPath, config.base_branch);
          await this.gitManager.createBranch(projectPath, branchName);
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

      console.log(chalk.green(`  ✅ Branch created: ${branchName}`));
      console.log(chalk.green(`  ✅ Container ready\n`));

      // Step 4: Run agent system with dynamic routing
      console.log(chalk.blue('📋 Step 4/7: Running agent system (dynamic routing)'));
      const costMonitor = new CostMonitor(config.safety.max_cost_per_task);

      // Try Claude Code CLI with dynamic routing, fall back to mock if it fails
      let agentResult;
      try {
        agentResult = await this.runClaudeCodeAgentSystem(container, description, costMonitor, projectPath);
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  Claude Code agents failed: ${error.message}`));
        console.log(chalk.gray('  Falling back to mock mode...\n'));
        agentResult = await this.mockAgentExecution(container, description, costMonitor);
      }

      console.log(chalk.green(`  ✅ Agent completed (Cost: $${costMonitor.getTotalCost().toFixed(4)})\n`));

      // Conversation transcript is displayed in real-time during execution
      // No need for additional post-processing

      // Step 5: Run tests
      console.log(chalk.blue('📋 Step 5/7: Running tests'));
      const testResults = await this.runTests(container, config);
      if (testResults.passed) {
        console.log(chalk.green('  ✅ All tests passed\n'));
      } else {
        console.log(chalk.yellow('  ⚠️  Tests failed\n'));
      }

      // Step 6: Generate summary
      console.log(chalk.blue('📋 Step 6/7: Generating summary'));
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
      console.log(chalk.green('  ✅ Summary generated\n'));

      // Step 7: Save task data
      console.log(chalk.blue('📋 Step 7/7: Saving task data'));
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

      // Save cost data
      await costMonitor.save(taskId);
      console.log(chalk.green('  ✅ Task data saved\n'));

      // Stop container but don't remove yet (keep in tracking for cleanup)
      console.log(chalk.blue('🐳 Stopping Docker container...'));
      await this.dockerManager.stop(container);
      console.log(chalk.green('  ✅ Container stopped\n'));

      // Step 8: Auto-create PR (if GitHub configured)
      let pr = null;
      if (this.githubClient) {
        try {
          console.log(chalk.blue.bold('\n📤 Creating Pull Request...\n'));

          // Push branch to GitHub
          console.log(chalk.blue('  → Pushing branch to GitHub...'));
          await this.githubClient.pushBranch(projectPath, branchName);
          console.log(chalk.green('    ✅ Branch pushed\n'));

          // Create PR
          console.log(chalk.blue('  → Creating pull request...'));
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

          // Update task with PR info
          taskData.prNumber = pr.number;
          taskData.prUrl = pr.url;
          await this.saveTaskData(taskData);

          console.log(chalk.green.bold(`    ✅ PR Created!\n`));
          console.log(chalk.cyan(`    ${pr.url}\n`));
        } catch (error) {
          console.log(chalk.yellow(`\n⚠️  PR creation failed: ${error.message}`));
          console.log(chalk.gray(`   You can create it manually with: claude approve ${taskId}\n`));
        }
      } else {
        console.log(chalk.yellow('\n⚠️  GitHub not configured - skipping PR creation'));
        console.log(chalk.gray('   Set GITHUB_TOKEN in .env to enable PR creation\n'));
      }

      // Display summary
      console.log(summary);

      return {
        taskId,
        branchName,
        summary,
        cost: costMonitor.getTotalCost(),
        pr
      };
    } catch (error) {
      console.log(chalk.red(`\n❌ Task failed: ${error.message}\n`));

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
          console.error(chalk.yellow(`  ⚠️  Cleanup warning: ${cleanupError.message}`));
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
        console.log(chalk.gray(`    ⚠️  Could not read project structure: ${error.message}`));
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
      console.log(chalk.yellow(`    ⚠️  Error gathering context: ${error.message}`));
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
      formatted += `**📦 Cached Files (${cacheStats.totalFiles} available):**\n`;
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
  async runClaudeCodeAgentSystem(container, description, costMonitor, projectPath) {
    const workflowStartTime = Date.now();
    console.log(chalk.cyan('  🤖 Using Claude Code CLI with Dynamic Routing\n'));
    console.log(chalk.gray('  Mode: Intelligent agent selection based on task requirements\n'));

    const { ContainerTools } = await import('../test/container-tools.js');
    const { ConversationThread } = await import('./conversation-thread.js');

    const containerTools = new ContainerTools(container);
    const conversation = new ConversationThread();

    conversation.add('orchestrator', `Task: ${description}`, {}, true);

    // Add tool context to conversation for agent awareness
    const toolContext = this.toolRegistry.getToolContextMarkdown();
    if (toolContext) {
      console.log(chalk.gray(`  📦 Loaded ${this.toolRegistry.getToolCount()} tool(s)\n`));
      conversation.add('system', toolContext, { isToolContext: true }, true);
    }

    // Step 1: Plan the task (determine optimal agent sequence)
    console.log(chalk.blue.bold('📋 Planning Task\n'));

    const planner = new TaskPlanner(this.agentRegistry, conversation);
    const plan = await planner.planTask(description, containerTools, costMonitor, {
      useAI: false // Use heuristic planning for speed (can be made configurable)
    });

    planner.displayPlan(plan);

    // Step 2: Execute with dynamic routing
    console.log(chalk.blue.bold('🔄 Dynamic Agent Execution\n'));

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

      console.log(chalk.blue(`\n── Iteration ${iterationCount}/${maxIterations} ──\n`));

      // Safety check: detect loops
      if (executor.detectLoop()) {
        console.log(chalk.red.bold('\n❌ Agent loop detected!'));
        console.log(chalk.yellow(`  Last 3 agents keep repeating. Breaking to prevent infinite loop.\n`));
        break;
      }

      // Safety check: agent visited too many times
      if (executor.getVisitCount(currentAgent) > 2) {
        console.log(chalk.yellow(`\n⚠️  Agent '${currentAgent}' visited ${executor.getVisitCount(currentAgent)} times\n`));
      }

      // Execute current agent
      try {
        const execution = await executor.execute(currentAgent, { task: description });

        executionLog.push({
          iteration: iterationCount,
          agent: currentAgent,
          decision: execution.decision,
          duration: execution.duration,
          cost: execution.cost
        });

        // Check if task is complete
        if (execution.decision.isComplete) {
          console.log(chalk.green.bold('\n✅ Task Complete!'));
          if (!execution.decision.explicit) {
            console.log(chalk.yellow('  (Completion inferred from agent response)\n'));
          }
          approved = true;
          break;
        }

        // Validate next agent
        const nextAgent = execution.decision.nextAgent;
        if (!nextAgent) {
          console.log(chalk.yellow('\n⚠️  No next agent specified but task not marked complete'));
          console.log(chalk.gray('  Assuming task is complete...\n'));
          approved = true;
          break;
        }

        if (!this.agentRegistry.has(nextAgent)) {
          console.log(chalk.red(`\n❌ Unknown agent requested: '${nextAgent}'`));
          console.log(chalk.yellow('  Routing to reviewer as fallback...\n'));
          currentAgent = 'reviewer';
        } else {
          currentAgent = nextAgent;
        }

      } catch (error) {
        console.log(chalk.red(`\n❌ Agent '${currentAgent}' failed: ${error.message}\n`));

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
      console.log(chalk.red.bold('\n❌ Max iterations reached!'));
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
    console.log(chalk.cyan.bold(`\n📤 Creating PR for Task: ${taskId}\n`));

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

      // Push branch to GitHub
      if (this.githubClient) {
        const projectPath = path.join(this.globalConfig.get('projectsDir'), taskData.config.name);

        console.log(chalk.blue('📤 Pushing branch to GitHub...'));
        await this.githubClient.pushBranch(projectPath, taskData.branchName);
        console.log(chalk.green('  ✅ Branch pushed\n'));

        // Create PR
        console.log(chalk.blue('📝 Creating pull request...'));
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

        console.log(chalk.green.bold(`\n✅ PR Created: ${pr.url}\n`));

        return pr;
      } else {
        throw new Error('GitHub token not configured. Cannot create PR.');
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ PR creation failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Reject task and cleanup
   * @param {string} taskId - Task ID to reject
   */
  async reject(taskId) {
    console.log(chalk.cyan.bold(`\n❌ Rejecting Task: ${taskId}\n`));

    try {
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const projectPath = path.join(homedir(), 'projects', taskData.config.name);

      // Delete branch
      console.log(chalk.blue('🗑️  Deleting branch...'));
      await this.gitManager.deleteBranch(projectPath, taskData.branchName, true);

      // Remove container if exists
      if (taskData.containerId) {
        console.log(chalk.blue('🗑️  Removing container...'));
        await this.dockerManager.remove(taskData.containerId);
      }

      // Update task status
      taskData.status = 'rejected';
      await this.saveTaskData(taskData);

      console.log(chalk.green.bold('\n✅ Task rejected and cleaned up\n'));
    } catch (error) {
      console.log(chalk.red(`\n❌ Rejection failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Cancel task and cleanup (works for any status)
   * @param {string} taskId - Task ID to cancel
   */
  async cancel(taskId) {
    console.log(chalk.cyan.bold(`\n🚫 Cancelling Task: ${taskId}\n`));

    try {
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const projectPath = path.join(homedir(), 'projects', taskData.config.name);

      // Delete branch if it exists
      try {
        console.log(chalk.blue('🗑️  Deleting branch...'));
        await this.gitManager.deleteBranch(projectPath, taskData.branchName, true);
        console.log(chalk.green('  ✅ Branch deleted'));
      } catch (error) {
        console.log(chalk.gray(`  ⚠️  Branch already deleted or doesn't exist`));
      }

      // Remove container if exists
      if (taskData.containerId) {
        try {
          console.log(chalk.blue('🗑️  Removing container...'));
          await this.dockerManager.remove(taskData.containerId);
          console.log(chalk.green('  ✅ Container removed'));
        } catch (error) {
          console.log(chalk.gray(`  ⚠️  Container already removed or doesn't exist`));
        }
      }

      // Update task status
      taskData.status = 'cancelled';
      taskData.cancelledAt = new Date().toISOString();
      await this.saveTaskData(taskData);

      console.log(chalk.green.bold('\n✅ Task cancelled and cleaned up\n'));
    } catch (error) {
      console.log(chalk.red(`\n❌ Cancellation failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Retry a failed or rejected task
   * @param {string} taskId - Task ID to retry
   */
  async retry(taskId) {
    console.log(chalk.cyan.bold(`\n🔄 Retrying Task: ${taskId}\n`));

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
      console.log(chalk.red(`\n❌ Retry failed: ${error.message}\n`));
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
        console.log(chalk.yellow(`\n⚠️  Task ${taskId} did not complete successfully`));
        console.log(chalk.yellow(`Status: ${this.formatStatus(taskData.status)}`));
        console.log(chalk.yellow(`No branch or config available for diff\n`));
        return;
      }

      const projectPath = path.join(homedir(), 'projects', taskData.config.name);

      console.log(chalk.cyan.bold(`\n📊 Diff for Task: ${taskId}\n`));
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

      console.log(chalk.cyan('═'.repeat(70)));
      console.log(diff);
      console.log(chalk.cyan('═'.repeat(70) + '\n'));

    } catch (error) {
      console.log(chalk.red(`\n❌ Failed to show diff: ${error.message}\n`));
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

      console.log(chalk.cyan.bold(`\n📊 Task Status: ${taskId}\n`));
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
        console.log(chalk.green(`  ✅ Cleaned up: ${container}`));
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  Could not cleanup ${container}: ${error.message}`));
      }
    });

    await Promise.all(cleanupPromises);
    console.log(chalk.green('  ✅ Cleanup complete\n'));
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
              console.log(chalk.green(`  ✅ Cleaned up ${ids.length} container(s)\n`));
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
   * Register cleanup handlers for process exit
   * Ensures containers are cleaned up even if process is interrupted
   */
  registerCleanupHandlers() {
    if (this.cleanupRegistered) return;

    const cleanupAndExit = async (signal) => {
      console.log(chalk.yellow(`\n\n⚠️  Received ${signal}, cleaning up...`));

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
