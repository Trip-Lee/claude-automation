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
import { AgentCoordinator } from './agent-coordinator.js';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';

export class Orchestrator {
  constructor(githubToken, anthropicApiKey) {
    this.dockerManager = new DockerManager();
    this.githubClient = githubToken ? new GitHubClient(githubToken) : null;
    this.configManager = new ConfigManager();
    this.gitManager = new GitManager();
    this.summaryGenerator = new SummaryGenerator();
    this.tasksDir = path.join(homedir(), '.claude-tasks');

    // Agent system
    this.anthropicApiKey = anthropicApiKey;

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
      console.log(chalk.green('  ✅ All checks passed\n'));

      // Step 2 & 3: Setup Git and Docker in parallel
      console.log(chalk.blue('📋 Step 2-3/7: Setting up Git environment and Docker container (parallel)'));
      const projectPath = path.join(homedir(), 'projects', config.name);
      const branchName = `claude/${taskId}`;

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
            [projectPath]: '/workspace'
          },
          network: config.docker.network_mode
        })
      ]);

      // Track container for cleanup
      container = createdContainer;
      this.activeContainers.add(container);

      console.log(chalk.green(`  ✅ Branch created: ${branchName}`));
      console.log(chalk.green(`  ✅ Container ready\n`));

      // Step 4: Run agent system
      console.log(chalk.blue('📋 Step 4/7: Running agent system'));
      const costMonitor = new CostMonitor(config.safety.max_cost_per_task);

      // Choose agent backend:
      // 1. Anthropic API if key is available
      // 2. Claude Code CLI if no API key (uses Pro/Max subscription)
      // 3. Mock mode as fallback
      let agentResult;
      if (this.anthropicApiKey) {
        agentResult = await this.runRealAgentSystem(container, description, costMonitor);
      } else {
        // Try Claude Code CLI, fall back to mock if it fails
        try {
          agentResult = await this.runClaudeCodeAgentSystem(container, description, costMonitor, projectPath);
        } catch (error) {
          console.log(chalk.yellow(`  ⚠️  Claude Code agents failed: ${error.message}`));
          console.log(chalk.gray('  Falling back to mock mode...\n'));
          agentResult = await this.mockAgentExecution(container, description, costMonitor);
        }
      }

      console.log(chalk.green(`  ✅ Agent completed (Cost: $${costMonitor.getTotalCost().toFixed(4)})\n`));

      // Display conversation transcript if real agents were used (not in mock mode)
      if (agentResult.conversations && !agentResult.plan?.mock) {
        console.log(chalk.cyan('📝 Displaying agent conversation...\n'));

        // Use AgentCoordinator to format conversations
        const agentCoordinator = new AgentCoordinator(this.anthropicApiKey);
        const transcript = agentCoordinator.formatConversations(agentResult.conversations);
        console.log(transcript);

        // Save conversation to file
        const conversationPath = path.join(homedir(), '.claude-logs', 'conversations', `${taskId}.txt`);
        await fs.mkdir(path.dirname(conversationPath), { recursive: true });
        await fs.writeFile(conversationPath, transcript);
        console.log(chalk.gray(`  Conversation saved: ${conversationPath}\n`));
      }

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
      await this.saveTaskData({
        taskId,
        projectName,
        description,
        branchName,
        result,
        testResults,
        config,
        containerId: container.id,
        timestamp: new Date().toISOString(),
        status: 'pending_approval'
      });

      // Save cost data
      await costMonitor.save(taskId);
      console.log(chalk.green('  ✅ Task data saved\n'));

      // Stop container but don't remove (needed for approval)
      console.log(chalk.blue('🐳 Stopping Docker container...'));
      await this.dockerManager.stop(container);
      this.activeContainers.delete(container); // Remove from active tracking
      console.log(chalk.green('  ✅ Container stopped\n'));

      // Display summary
      console.log(summary);

      return {
        taskId,
        branchName,
        summary,
        cost: costMonitor.getTotalCost()
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
        } catch (cleanupError) {
          console.error(chalk.yellow(`  ⚠️  Cleanup warning: ${cleanupError.message}`));
        }
      }
    }
  }

  /**
   * Run real multi-agent system
   */
  async runRealAgentSystem(container, description, costMonitor) {
    // Import ContainerTools dynamically
    const { ContainerTools } = await import('../test/container-tools.js');
    const containerTools = new ContainerTools(container);

    // Create agent coordinator
    const agentCoordinator = new AgentCoordinator(this.anthropicApiKey);

    // Execute multi-agent workflow
    const result = await agentCoordinator.execute({
      containerTools,
      task: description,
      costMonitor
    });

    return {
      success: result.success,
      plan: result.plan,
      changes: result.changes,
      conversations: result.conversations
    };
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
   * Run multi-agent system using Claude Code CLI
   * Uses the authenticated Claude Code session instead of API
   */
  async runClaudeCodeAgentSystem(container, description, costMonitor, projectPath) {
    const workflowStartTime = Date.now();
    console.log(chalk.cyan('  🤖 Using Claude Code CLI agents (Pro/Max subscription)\n'));
    console.log(chalk.gray('  Mode: Collaborative (shared context + session continuation)\n'));

    const { ClaudeCodeAgent } = await import('./claude-code-agent.js');
    const { ContainerTools } = await import('../test/container-tools.js');
    const { ConversationThread } = await import('./conversation-thread.js');
    const { v4: uuidv4 } = await import('uuid');

    const containerTools = new ContainerTools(container);
    const conversation = new ConversationThread();

    // Shared session ID for all agents (enables session continuation)
    const sharedSessionId = uuidv4();
    console.log(chalk.gray(`  Session ID: ${sharedSessionId}\n`));

    // Step 0: Gather comprehensive project context upfront
    console.log(chalk.cyan('📚 Gathering project context...\n'));
    const projectContext = await this.gatherProjectContext(containerTools, conversation);
    console.log(chalk.green(`  ✅ Project context ready (${projectContext.files.length} files analyzed)\n`));

    // Display conversation header
    console.log(chalk.cyan.bold('\n💬 COLLABORATIVE CONVERSATION\n'));
    console.log(chalk.gray('  (Messages displayed as agents communicate)\n'));

    // Legacy structure for backward compatibility
    const conversations = {
      architect: null,
      coder: [],
      reviewer: []
    };

    // Step 1: Architect Agent (read-only)
    console.log(chalk.magenta.bold('🏗️  Architect Agent\n'));
    console.log(chalk.gray('  Analyzing project and creating implementation brief...\n'));

    // Add orchestrator's request to conversation and display
    conversation.add('orchestrator', `Task: ${description}\n\nArchitect: Please analyze the project and create an implementation brief.`, {}, true);

    const architectAgent = new ClaudeCodeAgent({
      role: 'architect',
      sessionId: sharedSessionId,
      resumeSession: false, // First agent creates the session
      workingDir: projectPath,
      allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
      verbose: false
    });

    // Format project context for architect
    const contextSummary = this.formatProjectContext(projectContext, conversation);

    const architectPrompt = `Analyze this project and create an implementation brief for: ${description}

${contextSummary}

**Your Task:**
Create a detailed implementation brief with:
1. Relevant files to modify/create (based on the structure above)
2. Existing code patterns to follow
3. Specific implementation guidance
4. Testing requirements

You have access to Read and Bash tools if you need to examine specific files in more detail, but the context above should give you a strong starting point.`;

    const architectResult = await architectAgent.executeWithTools({
      initialPrompt: architectPrompt,
      containerTools,
      costMonitor
    });

    // Add architect's response to conversation and display
    conversation.add('architect', architectResult.response, {
      duration: architectResult.totalDuration,
      cost: architectResult.cost
    }, true);

    conversations.architect = {
      brief: architectResult.response,
      iterations: architectResult.iterations,
      duration: architectResult.totalDuration,
      cost: architectResult.cost,
      profiling: architectResult.profiling
    };

    console.log(chalk.green(`  ✅ Architect brief complete (${(architectResult.totalDuration / 1000).toFixed(1)}s, $${(architectResult.cost || 0).toFixed(4)})\n`));

    // Step 1.5: Coder reviews brief and asks questions (COLLABORATIVE)
    console.log(chalk.blue.bold('💬 Coder Q&A Session\n'));
    console.log(chalk.gray('  Coder reviewing architect\'s brief...\n'));

    const coderReviewAgent = new ClaudeCodeAgent({
      role: 'coder',
      sessionId: sharedSessionId,
      resumeSession: true, // Resume architect's session
      workingDir: projectPath,
      allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*)'],
      verbose: false
    });

    conversation.add('orchestrator', 'Coder: Please review the architect\'s brief and ask any clarifying questions before implementation.', {}, true);

    const coderReviewPrompt = `Review this implementation brief and ask any clarifying questions:

**Task:** ${description}

**Architect's Brief:**
${architectResult.response}

If you have questions about:
- Unclear requirements
- Implementation approach
- Edge cases to consider
- Tech stack or dependencies
- Testing strategy

Please ask them now. If everything is clear, respond with "READY TO IMPLEMENT".`;

    const coderReview = await coderReviewAgent.executeWithTools({
      initialPrompt: coderReviewPrompt,
      containerTools,
      costMonitor
    });

    conversation.add('coder', coderReview.response, {
      duration: coderReview.totalDuration,
      cost: coderReview.cost
    }, true);

    console.log(chalk.gray(`    Duration: ${(coderReview.totalDuration / 1000).toFixed(1)}s | Cost: $${(coderReview.cost || 0).toFixed(4)}`));

    // Use consensus detection for Q&A phase
    const isReady = conversation.isReadyToImplement();
    const hasQuestions = conversation.hasRecentQuestions(1) && !isReady;

    // Display consensus signals
    console.log(chalk.cyan('\n🔍 Consensus Detection:'));
    console.log(chalk.gray(`  Ready to implement: ${isReady ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.gray(`  Has questions: ${hasQuestions ? '❓ Yes' : '✅ No'}`));

    if (hasQuestions) {
      console.log(chalk.yellow('  📋 Coder has questions - getting architect clarification...\n'));

      conversation.add('orchestrator', 'Architect: The coder has questions. Please provide clarifications.', {}, true);

      const architectClarificationAgent = new ClaudeCodeAgent({
        role: 'architect',
        sessionId: sharedSessionId,
        resumeSession: true, // Resume coder's session
        workingDir: projectPath,
        allowedTools: ['Read', 'Bash(ls:*,cat:*)'],
        verbose: false
      });

      const clarificationPrompt = `The coder reviewed your implementation brief and has questions:

**Coder's Questions:**
${coderReview.response}

Please provide clear answers to help them proceed with confidence.`;

      const clarification = await architectClarificationAgent.executeWithTools({
        initialPrompt: clarificationPrompt,
        containerTools,
        costMonitor
      });

      conversation.add('architect', clarification.response, {
        duration: clarification.totalDuration,
        cost: clarification.cost
      }, true);

      console.log(chalk.green(`  ✅ Architect clarification provided (${(clarification.totalDuration / 1000).toFixed(1)}s, $${(clarification.cost || 0).toFixed(4)})\n`));

      // Update architect brief with clarifications
      conversations.architect.clarifications = clarification.response;
    } else {
      console.log(chalk.green('  ✅ Coder is ready to implement (no questions)\n'));
    }

    // Step 2-N: Coder + Reviewer loop (up to 3 rounds)
    const maxRounds = 3;
    let round = 0;
    let approved = false;
    let coderOutput = null;

    while (round < maxRounds && !approved) {
      round++;
      console.log(chalk.blue.bold(`\n📍 Round ${round}/${maxRounds}\n`));

      // Coder Agent (full access)
      console.log(chalk.green('👨‍💻 Coder Agent'));

      // Add coder task to conversation
      const coderTaskDesc = round === 1
        ? 'Implement the task according to the brief and Q&A discussion.'
        : `Fix the issues identified by the reviewer.`;

      conversation.add('orchestrator', `Coder: ${coderTaskDesc}`, {}, true);

      const coderAgent = new ClaudeCodeAgent({
        role: 'coder',
        sessionId: sharedSessionId,
        resumeSession: true, // Resume session
        workingDir: projectPath,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
        verbose: false
      });

      // Build coder prompt with FULL conversation context
      const conversationContext = conversation.getHistory();
      const fileCacheSummary = conversation.getFileCacheSummary();

      const coderPrompt = round === 1
        ? `Implement: ${description}

**Full Conversation Context:**
${conversationContext}

${fileCacheSummary !== 'No files cached yet.' ? `**${fileCacheSummary}**\n\nThese files have been pre-read and cached. You can reference them or use Read tool to examine them again if needed.\n` : ''}

Please implement the task. You have access to the full discussion above, including the architect's brief and any clarifications. Write clean, tested code.`
        : `The reviewer found issues. Here's the full conversation:

**Full Conversation Context:**
${conversationContext}

${fileCacheSummary !== 'No files cached yet.' ? `**${fileCacheSummary}**\n` : ''}

Please fix the issues identified by the reviewer in the conversation above.`;

      const coderResult = await coderAgent.executeWithTools({
        initialPrompt: coderPrompt,
        containerTools,
        costMonitor
      });

      // Add coder's response to conversation and display
      conversation.add('coder', coderResult.response, {
        duration: coderResult.totalDuration,
        cost: coderResult.cost
      }, true);

      conversations.coder.push({
        plan: coderResult.response,
        iterations: coderResult.iterations,
        duration: coderResult.totalDuration,
        cost: coderResult.cost,
        profiling: coderResult.profiling
      });

      coderOutput = coderResult;

      console.log(chalk.gray(`    Duration: ${(coderResult.totalDuration / 1000).toFixed(1)}s | Cost: $${(coderResult.cost || 0).toFixed(4)}`))

      // Reviewer Agent (read-only)
      console.log(chalk.yellow('\n👁️  Reviewer Agent'));

      // Add reviewer task to conversation and display
      conversation.add('orchestrator', 'Reviewer: Please review the implementation and provide feedback.', {}, true);

      const reviewerAgent = new ClaudeCodeAgent({
        role: 'reviewer',
        sessionId: sharedSessionId,
        resumeSession: true, // Resume session
        workingDir: projectPath,
        allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
        verbose: false
      });

      // Reviewer gets FULL conversation context
      const reviewerConversationContext = conversation.getHistory();
      const reviewerFileCacheSummary = conversation.getFileCacheSummary();

      const reviewerPrompt = `Review the implementation with full context:

**Full Conversation Context:**
${reviewerConversationContext}

${reviewerFileCacheSummary !== 'No files cached yet.' ? `**${reviewerFileCacheSummary}**\n\nThese files are available for reference. Use Read tool to examine current state after coder's changes.\n` : ''}

**Your Task:**
Use Read and Bash tools to examine the actual code changes in the project directory. Review against:
1. The original task requirements
2. The architect's brief and clarifications
3. The coder's implementation

Respond with either:
- "APPROVED" if the implementation is good
- A detailed list of specific issues that need to be fixed

Be thorough but fair. The coder has access to the full conversation context.`;

      const reviewerResult = await reviewerAgent.executeWithTools({
        initialPrompt: reviewerPrompt,
        containerTools,
        costMonitor
      });

      // Add reviewer's response to conversation and display
      conversation.add('reviewer', reviewerResult.response, {
        duration: reviewerResult.totalDuration,
        cost: reviewerResult.cost
      }, true);

      conversations.reviewer.push({
        approved: reviewerResult.response.toUpperCase().includes('APPROVED'),
        feedback: reviewerResult.response,
        iterations: reviewerResult.iterations,
        duration: reviewerResult.totalDuration,
        cost: reviewerResult.cost,
        profiling: reviewerResult.profiling
      });

      console.log(chalk.gray(`    Duration: ${(reviewerResult.totalDuration / 1000).toFixed(1)}s | Cost: $${(reviewerResult.cost || 0).toFixed(4)}`));

      // Use consensus detection to determine approval
      approved = conversation.isApproved();
      const hasIssues = conversation.hasUnresolvedIssues();
      const shouldContinue = conversation.shouldContinueCollaboration();

      // Display consensus signals
      console.log(chalk.cyan('\n🔍 Consensus Detection:'));
      console.log(chalk.gray(`  Approved: ${approved ? '✅ Yes' : '❌ No'}`));
      console.log(chalk.gray(`  Issues: ${hasIssues ? '⚠️  Found' : '✅ None'}`));
      console.log(chalk.gray(`  Decision: ${shouldContinue.shouldContinue ? '🔄 Continue collaboration' : '✅ Ready to finish'}`));
      console.log(chalk.gray(`  Reason: ${shouldContinue.reason}`));

      if (approved) {
        console.log(chalk.green.bold('\n✅ Code approved by reviewer!'));
        coderOutput.reviewerFeedback = null;
      } else {
        console.log(chalk.yellow.bold('\n⚠️  Reviewer requested changes'));
        coderOutput.reviewerFeedback = reviewerResult.response;

        // Check if agents need direct dialogue
        const needsDialogue = conversation.needsAgentDialogue();

        if (needsDialogue && round < maxRounds) {
          console.log(chalk.cyan.bold(`\n💬 Agent-to-Agent Dialogue\n`));
          console.log(chalk.gray(`  ${needsDialogue.reason}\n`));

          // Enable direct dialogue between agents (max 2 rounds)
          const maxDialogueRounds = 2;
          let dialogueRound = 0;

          while (dialogueRound < maxDialogueRounds) {
            dialogueRound++;

            // Agent2 (usually Coder) responds to Agent1 (usually Reviewer)
            console.log(chalk.green(`\n💬 ${needsDialogue.agent2} → ${needsDialogue.agent1} (round ${dialogueRound}/${maxDialogueRounds})`));

            const respondingAgent = new ClaudeCodeAgent({
              role: needsDialogue.agent2,
              sessionId: sharedSessionId,
              resumeSession: true, // Resume session
              workingDir: projectPath,
              allowedTools: needsDialogue.agent2 === 'coder'
                ? ['Read', 'Bash(ls:*,cat:*)']
                : ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
              verbose: false
            });

            const dialogueContext = conversation.getAgentDialogueContext(needsDialogue.agent1, needsDialogue.agent2);

            const respondPrompt = `You (${needsDialogue.agent2}) are responding directly to ${needsDialogue.agent1}'s concerns:

${dialogueContext}

Please respond to their questions or concerns. Be specific and helpful.`;

            const response = await respondingAgent.executeWithTools({
              initialPrompt: respondPrompt,
              containerTools,
              costMonitor
            });

            conversation.add(needsDialogue.agent2, response.response, {
              duration: response.totalDuration,
              cost: response.cost
            }, true);

            console.log(chalk.gray(`    Duration: ${(response.totalDuration / 1000).toFixed(1)}s | Cost: $${(response.cost || 0).toFixed(4)}`));

            // Check if Agent1 has follow-up questions
            const hasFollowUp = conversation.hasRecentQuestions(1);

            if (!hasFollowUp) {
              console.log(chalk.green('  ✅ Dialogue resolved\n'));
              break;
            }

            // Agent1 asks follow-up
            console.log(chalk.yellow(`\n💬 ${needsDialogue.agent1} → ${needsDialogue.agent2} (follow-up)`));

            const questioningAgent = new ClaudeCodeAgent({
              role: needsDialogue.agent1,
              sessionId: sharedSessionId,
              resumeSession: true, // Resume session
              workingDir: projectPath,
              allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
              verbose: false
            });

            const followUpContext = conversation.getAgentDialogueContext(needsDialogue.agent2, needsDialogue.agent1);

            const followUpPrompt = `You (${needsDialogue.agent1}) are continuing dialogue with ${needsDialogue.agent2}:

${followUpContext}

Review their response. If satisfied, say "Thank you, that clarifies things."
If you still have concerns, ask specific follow-up questions.`;

            const followUp = await questioningAgent.executeWithTools({
              initialPrompt: followUpPrompt,
              containerTools,
              costMonitor
            });

            conversation.add(needsDialogue.agent1, followUp.response, {
              duration: followUp.totalDuration,
              cost: followUp.cost
            }, true);

            console.log(chalk.gray(`    Duration: ${(followUp.totalDuration / 1000).toFixed(1)}s | Cost: $${(followUp.cost || 0).toFixed(4)}`));

            // Check if satisfied
            const isSatisfied = followUp.response.toLowerCase().includes('clarifies') ||
                                followUp.response.toLowerCase().includes('thank') ||
                                !conversation.hasRecentQuestions(1);

            if (isSatisfied) {
              console.log(chalk.green('  ✅ Dialogue resolved\n'));
              break;
            }
          }

          if (dialogueRound >= maxDialogueRounds) {
            console.log(chalk.yellow('  ⚠️  Max dialogue rounds reached\n'));
          }
        }

        // If we've hit max rounds, check if issues are critical
        if (round >= maxRounds && hasIssues) {
          console.log(chalk.yellow('⚠️  Max rounds reached with unresolved issues'));
        }
      }
    }

    if (!approved) {
      console.log(chalk.red.bold('\n❌ Max rounds reached without approval'));
    }

    // Display full collaborative conversation (with complete text)
    console.log(chalk.cyan.bold('\n📜 FULL CONVERSATION TRANSCRIPT\n'));
    console.log(chalk.gray('  (Complete messages from all agents)\n'));
    console.log(conversation.formatForDisplay());

    // Calculate timing breakdown
    const totalWorkflowTime = Date.now() - workflowStartTime;
    const architectTime = conversations.architect?.duration || 0;
    const coderTime = conversations.coder.reduce((sum, c) => sum + (c.duration || 0), 0);
    const reviewerTime = conversations.reviewer.reduce((sum, r) => sum + (r.duration || 0), 0);
    const conversationStats = conversation.getStats();

    // Aggregate profiling data
    const architectProfiling = conversations.architect?.profiling || {};
    const coderProfiling = conversations.coder.reduce((sum, c) => ({
      totalSpawnTime: sum.totalSpawnTime + (c.profiling?.totalSpawnTime || 0),
      totalExecutionTime: sum.totalExecutionTime + (c.profiling?.totalExecutionTime || 0),
      totalParseTime: sum.totalParseTime + (c.profiling?.totalParseTime || 0)
    }), { totalSpawnTime: 0, totalExecutionTime: 0, totalParseTime: 0 });
    const reviewerProfiling = conversations.reviewer.reduce((sum, r) => ({
      totalSpawnTime: sum.totalSpawnTime + (r.profiling?.totalSpawnTime || 0),
      totalExecutionTime: sum.totalExecutionTime + (r.profiling?.totalExecutionTime || 0),
      totalParseTime: sum.totalParseTime + (r.profiling?.totalParseTime || 0)
    }), { totalSpawnTime: 0, totalExecutionTime: 0, totalParseTime: 0 });

    const totalProfiling = {
      spawn: (architectProfiling.totalSpawnTime || 0) + coderProfiling.totalSpawnTime + reviewerProfiling.totalSpawnTime,
      execution: (architectProfiling.totalExecutionTime || 0) + coderProfiling.totalExecutionTime + reviewerProfiling.totalExecutionTime,
      parse: (architectProfiling.totalParseTime || 0) + coderProfiling.totalParseTime + reviewerProfiling.totalParseTime
    };

    // Display timing summary
    console.log(chalk.cyan.bold('\n⏱️  Performance Summary'));
    console.log(chalk.gray(`  Architect:  ${(architectTime / 1000).toFixed(1)}s`));
    console.log(chalk.gray(`  Coder:      ${(coderTime / 1000).toFixed(1)}s (${conversations.coder.length} round${conversations.coder.length > 1 ? 's' : ''})`));
    console.log(chalk.gray(`  Reviewer:   ${(reviewerTime / 1000).toFixed(1)}s (${conversations.reviewer.length} round${conversations.reviewer.length > 1 ? 's' : ''})`));
    console.log(chalk.gray(`  Messages:   ${conversationStats.totalMessages}`));
    console.log(chalk.gray(`  Total:      ${(totalWorkflowTime / 1000).toFixed(1)}s`));

    // Display profiling breakdown
    console.log(chalk.cyan.bold('\n🔍 Performance Breakdown'));
    console.log(chalk.gray(`  Spawn:      ${(totalProfiling.spawn / 1000).toFixed(2)}s (${((totalProfiling.spawn / totalWorkflowTime) * 100).toFixed(1)}%)`));
    console.log(chalk.gray(`  Execution:  ${(totalProfiling.execution / 1000).toFixed(2)}s (${((totalProfiling.execution / totalWorkflowTime) * 100).toFixed(1)}%)`));
    console.log(chalk.gray(`  Parse:      ${(totalProfiling.parse / 1000).toFixed(2)}s (${((totalProfiling.parse / totalWorkflowTime) * 100).toFixed(1)}%)`));
    const overhead = totalWorkflowTime - (totalProfiling.spawn + totalProfiling.execution + totalProfiling.parse);
    console.log(chalk.gray(`  Overhead:   ${(overhead / 1000).toFixed(2)}s (${((overhead / totalWorkflowTime) * 100).toFixed(1)}%)`));

    // Get final state
    const finalState = {
      files: ['modified files'], // TODO: Parse from git diff
      summary: coderOutput?.plan || 'Claude Code agent implementation'
    };

    return {
      success: approved,
      plan: {
        summary: coderOutput?.plan || 'Claude Code multi-agent implementation',
        rounds: round,
        approved,
        backend: 'claude-code-cli-collaborative',
        totalMessages: conversationStats.totalMessages
      },
      changes: finalState,
      conversations,
      conversationThread: conversation, // NEW: Full conversation thread
      performance: {
        totalDuration: totalWorkflowTime,
        architectDuration: architectTime,
        coderDuration: coderTime,
        reviewerDuration: reviewerTime,
        messagesExchanged: conversationStats.totalMessages
      }
    };
  }

  /**
   * Mock agent execution (fallback)
   * Used when Anthropic API key is not available
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
   * Approve task and create PR
   * @param {string} taskId - Task ID to approve
   * @returns {Promise<Object>} - PR details
   */
  async approve(taskId) {
    console.log(chalk.cyan.bold(`\n✅ Approving Task: ${taskId}\n`));

    try {
      // Load task data
      const taskData = await this.loadTaskData(taskId);

      if (!taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (taskData.status !== 'pending_approval') {
        throw new Error(`Task is not pending approval (status: ${taskData.status})`);
      }

      // Push branch to GitHub
      if (this.githubClient) {
        const projectPath = path.join(homedir(), 'projects', taskData.config.name);

        console.log(chalk.blue('📤 Pushing branch to GitHub...'));
        await this.githubClient.pushBranch(projectPath, taskData.branchName);

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

        // Update task status
        taskData.status = 'approved';
        taskData.prNumber = pr.number;
        taskData.prUrl = pr.url;
        await this.saveTaskData(taskData);

        console.log(chalk.green.bold(`\n✅ PR Created: ${pr.url}\n`));

        return pr;
      } else {
        throw new Error('GitHub token not configured. Cannot create PR.');
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Approval failed: ${error.message}\n`));
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
    process.on('SIGINT', () => cleanupAndExit('SIGINT'));

    // Handle kill command
    process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));

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
