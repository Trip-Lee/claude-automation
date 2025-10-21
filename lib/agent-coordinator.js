/**
 * AgentCoordinator - Orchestrates multi-agent system
 *
 * Three-Agent Architecture:
 * 1. Architect Agent: Analyzes project, creates implementation brief (read-only)
 * 2. Coder Agent: Writes code based on architect's brief, has full container access
 * 3. Reviewer Agent: Reviews code, has read-only access
 *
 * Flow:
 * 1. Architect explores project and creates detailed brief
 * 2. Coder implements the task using architect's guidance
 * 3. Reviewer reviews the implementation
 * 4. If issues found, coder fixes them
 * 5. Loop (steps 2-4) until approved or max rounds reached
 */

import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';

export class AgentCoordinator {
  constructor(apiKey, config = {}) {
    this.client = new Anthropic({ apiKey });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 8192;
    this.maxRounds = config.maxRounds || 3; // Max coder/reviewer rounds
    this.maxIterationsPerAgent = config.maxIterationsPerAgent || 20; // Increased from 10
  }

  /**
   * Execute multi-agent workflow
   * @param {Object} params - { containerTools, task, costMonitor }
   * @returns {Promise<Object>} - { success, plan, changes, conversations }
   */
  async execute({ containerTools, task, costMonitor }) {
    console.log(chalk.cyan.bold('\n🤖 Multi-Agent System Starting\n'));
    console.log(chalk.gray(`Task: ${task}\n`));

    try {
      const conversations = {
        architect: null,
        coder: [],
        reviewer: []
      };

      // Step 0: Gather and enrich context
      console.log(chalk.blue.bold('📊 Enriching Context\n'));
      const enrichedContext = await this.enrichContext({ containerTools, task });
      console.log(chalk.green('  ✅ Context enriched\n'));

      // Step 1: Architect gathers project context and creates brief
      console.log(chalk.magenta.bold('🏗️  Architect Agent\n'));
      console.log(chalk.gray('  Analyzing project and creating implementation brief...\n'));

      const architectResult = await this.runArchitectAgent({
        task,
        enrichedContext,
        containerTools,
        costMonitor
      });

      conversations.architect = architectResult;
      console.log(chalk.green('  ✅ Architect brief complete\n'));

      let round = 0;
      let approved = false;
      let coderOutput = null;

      while (round < this.maxRounds && !approved) {
        round++;
        console.log(chalk.blue.bold(`\n📍 Round ${round}/${this.maxRounds}\n`));

        // Step 1: Coder implements/fixes the task (with architect's brief)
        console.log(chalk.green('👨‍💻 Coder Agent'));
        const coderResult = await this.runCoderAgent({
          task,
          containerTools,
          costMonitor,
          architectBrief: architectResult.brief,
          previousFeedback: coderOutput?.reviewerFeedback,
          round
        });

        conversations.coder.push(coderResult);
        coderOutput = coderResult;

        // Step 2: Reviewer checks the implementation
        console.log(chalk.yellow('\n👁️  Reviewer Agent'));
        const reviewerResult = await this.runReviewerAgent({
          task,
          containerTools,
          costMonitor,
          coderWork: coderResult
        });

        conversations.reviewer.push(reviewerResult);

        // Check if approved
        if (reviewerResult.approved) {
          console.log(chalk.green.bold('\n✅ Code approved by reviewer!'));
          approved = true;
          coderOutput.reviewerFeedback = null; // No fixes needed
        } else {
          console.log(chalk.yellow.bold('\n⚠️  Reviewer requested changes'));
          coderOutput.reviewerFeedback = reviewerResult.feedback;

          if (round < this.maxRounds) {
            console.log(chalk.gray(`Feedback: ${reviewerResult.feedback.substring(0, 100)}...`));
          }
        }
      }

      if (!approved) {
        console.log(chalk.red.bold('\n❌ Max rounds reached without approval'));
      }

      // Get final state
      const finalState = await this.getFinalState(containerTools);

      return {
        success: approved,
        plan: {
          summary: coderOutput?.plan || 'Multi-agent implementation',
          rounds: round,
          approved
        },
        changes: finalState,
        conversations
      };
    } catch (error) {
      // Check for insufficient credits error
      if (this.isInsufficientCreditsError(error)) {
        console.log(chalk.yellow.bold('\n⚠️  Insufficient API credits - falling back to mock mode\n'));
        console.log(chalk.gray('Add credits at: https://console.anthropic.com/settings/billing\n'));

        // Return mock result
        return await this.executeMockAgent({ containerTools, task });
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Check if error is due to insufficient credits
   */
  isInsufficientCreditsError(error) {
    return error.status === 400 &&
           error.message &&
           error.message.toLowerCase().includes('credit balance is too low');
  }

  /**
   * Execute mock agent (fallback when no credits)
   */
  async executeMockAgent({ containerTools, task }) {
    console.log(chalk.yellow('🤖 Running in MOCK mode (simulated agent)\n'));

    // Write a simple test file to demonstrate the workflow
    await containerTools.executeTool('write_file', {
      path: '/workspace/mock_result.txt',
      content: `Mock Agent Result\n\nTask: ${task}\n\nThis is a simulated result because no API credits are available.\nThe infrastructure (Docker, Git, file operations) is working correctly.\n\nTo test with real agents, add credits at:\nhttps://console.anthropic.com/settings/billing\n`
    });

    console.log(chalk.gray('  ✓ Created mock_result.txt'));
    console.log(chalk.green('\n✅ Mock agent completed\n'));

    return {
      success: true,
      plan: {
        summary: 'Mock agent execution (no API credits)',
        rounds: 1,
        approved: true,
        mock: true
      },
      changes: {
        files: ['mock_result.txt'],
        summary: 'Created mock result file'
      },
      conversations: {
        coder: [{ plan: 'Mock execution', iterations: 1 }],
        reviewer: [{ approved: true, feedback: null, iterations: 1 }]
      }
    };
  }

  /**
   * Enrich context before passing to agents
   * Gathers system, project, and environment information
   */
  async enrichContext({ containerTools, task }) {
    const context = {
      system: {},
      project: {},
      environment: {}
    };

    try {
      // Gather system information
      console.log(chalk.gray('  Gathering system information...'));

      // Python version
      try {
        const pythonVersion = await containerTools.executeTool('execute_command', {
          command: 'python --version 2>&1'
        });
        context.system.python = pythonVersion.trim();
      } catch (e) {
        context.system.python = 'Not available';
      }

      // Node version
      try {
        const nodeVersion = await containerTools.executeTool('execute_command', {
          command: 'node --version 2>&1'
        });
        context.system.node = nodeVersion.trim();
      } catch (e) {
        context.system.node = 'Not available';
      }

      // OS info
      try {
        const osInfo = await containerTools.executeTool('execute_command', {
          command: 'uname -a'
        });
        context.system.os = osInfo.trim();
      } catch (e) {
        context.system.os = 'Linux (container)';
      }

      // Gather project information
      console.log(chalk.gray('  Analyzing project structure...'));

      // Top-level files and directories
      try {
        const listing = await containerTools.executeTool('list_directory', {
          path: '/workspace'
        });
        context.project.structure = listing;
      } catch (e) {
        context.project.structure = 'Unable to list';
      }

      // Check for dependencies
      try {
        const requirements = await containerTools.executeTool('execute_command', {
          command: 'test -f /workspace/requirements.txt && echo "exists" || echo "not found"'
        });
        context.project.hasRequirements = requirements.includes('exists');

        if (context.project.hasRequirements) {
          const deps = await containerTools.executeTool('read_file', {
            path: '/workspace/requirements.txt'
          });
          context.project.dependencies = deps;
        }
      } catch (e) {
        context.project.hasRequirements = false;
      }

      // Check for package.json (Node projects)
      try {
        const packageJson = await containerTools.executeTool('execute_command', {
          command: 'test -f /workspace/package.json && echo "exists" || echo "not found"'
        });
        context.project.hasPackageJson = packageJson.includes('exists');
      } catch (e) {
        context.project.hasPackageJson = false;
      }

      // Check for README
      try {
        const readme = await containerTools.executeTool('execute_command', {
          command: 'test -f /workspace/README.md && echo "exists" || echo "not found"'
        });
        context.project.hasReadme = readme.includes('exists');

        if (context.project.hasReadme) {
          const readmeContent = await containerTools.executeTool('read_file', {
            path: '/workspace/README.md'
          });
          // Only include first 500 chars of README
          context.project.readme = readmeContent.substring(0, 500);
        }
      } catch (e) {
        context.project.hasReadme = false;
      }

      // Environment info
      console.log(chalk.gray('  Checking environment...'));
      context.environment.workingDir = '/workspace';
      context.environment.timestamp = new Date().toISOString();

      console.log(chalk.gray(`    System: ${context.system.python || context.system.node}`));
      console.log(chalk.gray(`    Dependencies: ${context.project.hasRequirements ? 'requirements.txt' : context.project.hasPackageJson ? 'package.json' : 'none found'}`));

    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Context enrichment partial: ${error.message}`));
    }

    return context;
  }

  /**
   * Run the Architect Agent
   * Gathers project context and creates implementation brief
   */
  async runArchitectAgent({ task, enrichedContext, containerTools, costMonitor }) {
    const systemPrompt = this.getArchitectSystemPrompt();

    // Format enriched context for the architect
    const contextSummary = `
**System Information:**
- Python: ${enrichedContext.system.python || 'N/A'}
- Node: ${enrichedContext.system.node || 'N/A'}
- OS: ${enrichedContext.system.os || 'Linux (container)'}

**Project Information:**
- Has dependencies: ${enrichedContext.project.hasRequirements ? 'requirements.txt' : enrichedContext.project.hasPackageJson ? 'package.json' : 'none found'}
- Has README: ${enrichedContext.project.hasReadme ? 'yes' : 'no'}
${enrichedContext.project.readme ? `- README excerpt: ${enrichedContext.project.readme}` : ''}

**Project Structure:**
${enrichedContext.project.structure || 'Unable to determine'}
`.trim();

    const userMessage = `Please analyze this project and create an implementation brief for the following task:

**Task:** ${task}

**Environment Context:**
${contextSummary}

Your job is to:
1. Explore the project structure and identify relevant files
2. Understand the existing code patterns and conventions
3. Identify dependencies, frameworks, and tech stack
4. Note any constraints or requirements
5. Create a detailed brief with recommendations for the implementation

Do NOT write any code. Focus on analysis and planning.`;

    const messages = [{ role: 'user', content: userMessage }];
    let iteration = 0;
    let brief = '';

    while (iteration < this.maxIterationsPerAgent) {
      iteration++;
      console.log(chalk.gray(`  Iteration ${iteration}/${this.maxIterationsPerAgent}`));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        tools: this.getReadOnlyTools(containerTools),
        messages
      });

      // Track cost
      costMonitor.addUsage({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      });

      // Extract and display text content
      const textContent = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      if (textContent) {
        brief = textContent;
        // Display architect's analysis
        console.log(chalk.magenta('\n    💬 Architect:'));
        console.log(chalk.gray('    ┌─────────────────────────────────────────────────'));
        textContent.split('\n').slice(0, 10).forEach(line => {
          console.log(chalk.white('    │ ' + line));
        });
        if (textContent.split('\n').length > 10) {
          console.log(chalk.gray('    │ ...'));
        }
        console.log(chalk.gray('    └─────────────────────────────────────────────────'));
      }

      // Handle stop reasons
      if (response.stop_reason === 'end_turn') {
        return { brief, iterations: iteration };
      }

      if (response.stop_reason === 'tool_use') {
        // Execute tools silently
        const toolResults = await this.executeTools(response.content, containerTools);

        // // Show tool usage (commented out for cleaner output)
        // const toolUses = response.content.filter(b => b.type === 'tool_use');
        // console.log(chalk.cyan('\n    🔧 Analyzing:'));
        // for (const tool of toolUses) {
        //   console.log(chalk.gray(`    → ${tool.name}(${JSON.stringify(tool.input).substring(0, 60)}...)`));
        // }
        //
        // // Show results briefly
        // console.log(chalk.cyan('\n    📊 Found:'));
        // for (const result of toolResults) {
        //   if (!result.is_error) {
        //     const preview = result.content.substring(0, 80);
        //     console.log(chalk.green(`    ✓ ${preview}...`));
        //   }
        // }

        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults }
        );
      }
    }

    return { brief: 'Architect exceeded max iterations', iterations: iteration };
  }

  /**
   * Run the Coder Agent
   */
  async runCoderAgent({ task, containerTools, costMonitor, architectBrief, previousFeedback, round }) {
    const systemPrompt = this.getCoderSystemPrompt();

    let userMessage;
    if (round === 1) {
      userMessage = `Please implement the following task:\n\n${task}\n\n`;
      if (architectBrief) {
        userMessage += `**Architect's Brief:**\n${architectBrief}\n\n`;
      }
      userMessage += `Provide a brief plan before implementing.`;
    } else {
      userMessage = `The reviewer found issues with your previous implementation:\n\n${previousFeedback}\n\nPlease fix these issues.`;
    }

    const messages = [{ role: 'user', content: userMessage }];
    let iteration = 0;
    let plan = null;

    while (iteration < this.maxIterationsPerAgent) {
      iteration++;
      console.log(chalk.gray(`  Iteration ${iteration}/${this.maxIterationsPerAgent}`));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        tools: containerTools.getTools(),
        messages
      });

      // Track cost
      costMonitor.addUsage({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      });

      // Extract and display full text content
      const textContent = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      if (textContent && !plan) {
        plan = textContent;
      }

      if (textContent) {
        // Display full agent response in real-time
        console.log(chalk.green('\n    💬 Coder:'));
        console.log(chalk.gray('    ┌─────────────────────────────────────────────────'));
        textContent.split('\n').forEach(line => {
          console.log(chalk.white('    │ ' + line));
        });
        console.log(chalk.gray('    └─────────────────────────────────────────────────'));
      }

      // Handle stop reasons
      if (response.stop_reason === 'end_turn') {
        console.log(chalk.green('  ✅ Coder finished'));
        return { plan, iterations: iteration };
      }

      if (response.stop_reason === 'max_tokens') {
        throw new Error('Coder agent hit token limit - task too complex');
      }

      if (response.stop_reason === 'tool_use') {
        // Execute tools
        const toolResults = await this.executeTools(response.content, containerTools);

        // Show tool usage (temporarily enabled for debugging)
        const toolUses = response.content.filter(b => b.type === 'tool_use');
        console.log(chalk.cyan('\n    🔧 Tool Usage:'));
        for (const tool of toolUses) {
          console.log(chalk.gray(`    → ${tool.name}(${JSON.stringify(tool.input).substring(0, 100)}...)`));
        }

        // Show tool results (errors always shown, success on failures only)
        console.log(chalk.cyan('\n    📊 Tool Results:'));
        for (const result of toolResults) {
          if (result.is_error) {
            console.log(chalk.red(`    ✗ Error: ${result.content.substring(0, 200)}`));
          } else {
            const preview = result.content.substring(0, 150);
            console.log(chalk.green(`    ✓ ${preview}${result.content.length > 150 ? '...' : ''}`));
          }
        }

        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults }
        );
      }
    }

    throw new Error(`Coder agent exceeded max iterations (${this.maxIterationsPerAgent})`);
  }

  /**
   * Run the Reviewer Agent
   */
  async runReviewerAgent({ task, containerTools, costMonitor, coderWork }) {
    const systemPrompt = this.getReviewerSystemPrompt();

    // Get current workspace state for review
    const workspaceState = await this.getWorkspaceState(containerTools);

    const userMessage = `
Please review the following implementation:

**Original Task:**
${task}

**Coder's Plan:**
${coderWork.plan || 'No plan provided'}

**Current Workspace State:**
${workspaceState}

Review the implementation and determine if it:
1. Correctly implements the task requirements
2. Follows good coding practices
3. Is complete and functional

Respond with either:
- "APPROVED" if the implementation is good
- A detailed list of issues that need to be fixed
`.trim();

    const messages = [{ role: 'user', content: userMessage }];
    let iteration = 0;

    while (iteration < this.maxIterationsPerAgent) {
      iteration++;
      console.log(chalk.gray(`  Iteration ${iteration}/${this.maxIterationsPerAgent}`));

      // Reviewer only gets read-only tools
      const readOnlyTools = this.getReadOnlyTools(containerTools);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        tools: readOnlyTools,
        messages
      });

      // Track cost
      costMonitor.addUsage({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      });

      // Extract and display full text content
      const reviewText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      if (reviewText) {
        // Display full reviewer response in real-time
        console.log(chalk.yellow('\n    💬 Reviewer:'));
        console.log(chalk.gray('    ┌─────────────────────────────────────────────────'));
        reviewText.split('\n').forEach(line => {
          console.log(chalk.white('    │ ' + line));
        });
        console.log(chalk.gray('    └─────────────────────────────────────────────────'));
      }

      // Handle stop reasons
      if (response.stop_reason === 'end_turn') {
        const approved = reviewText.toUpperCase().includes('APPROVED');

        console.log(chalk.green(`  ✅ Reviewer finished: ${approved ? 'APPROVED ✓' : 'Changes requested ⚠️'}`));

        return {
          approved,
          feedback: approved ? null : reviewText,
          iterations: iteration
        };
      }

      if (response.stop_reason === 'tool_use') {
        // Execute tools silently
        const toolResults = await this.executeTools(response.content, containerTools);

        // // Show detailed tool usage (commented out for cleaner output)
        // const toolUses = response.content.filter(b => b.type === 'tool_use');
        // console.log(chalk.cyan('\n    🔧 Reviewer Tools:'));
        // for (const tool of toolUses) {
        //   console.log(chalk.gray(`    → ${tool.name}(${JSON.stringify(tool.input).substring(0, 100)}...)`));
        // }
        //
        // // Show tool results
        // console.log(chalk.cyan('\n    📊 Results:'));
        // for (const result of toolResults) {
        //   if (result.is_error) {
        //     console.log(chalk.red(`    ✗ Error: ${result.content.substring(0, 200)}`));
        //   } else {
        //     const preview = result.content.substring(0, 150);
        //     console.log(chalk.green(`    ✓ ${preview}${result.content.length > 150 ? '...' : ''}`));
        //   }
        // }

        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults }
        );
      }
    }

    // If reviewer doesn't finish, assume changes needed
    return {
      approved: false,
      feedback: 'Reviewer exceeded max iterations - please simplify the task',
      iterations: iteration
    };
  }

  /**
   * Execute tool calls
   */
  async executeTools(content, containerTools) {
    const toolUseBlocks = content.filter(block => block.type === 'tool_use');

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const { name, input, id } = block;

        try {
          const result = await containerTools.executeTool(name, input);

          return {
            type: 'tool_result',
            tool_use_id: id,
            content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          };
        } catch (error) {
          return {
            type: 'tool_result',
            tool_use_id: id,
            content: `Error: ${error.message}`,
            is_error: true
          };
        }
      })
    );

    return toolResults;
  }

  /**
   * Get workspace state for reviewer
   */
  async getWorkspaceState(containerTools) {
    try {
      const files = await containerTools.executeTool('list_directory', { path: '/workspace' });
      return `Files in workspace:\n${files}`;
    } catch (error) {
      return 'Unable to list workspace files';
    }
  }

  /**
   * Get final state of workspace
   */
  async getFinalState(containerTools) {
    try {
      const files = await containerTools.executeTool('list_directory', { path: '/workspace' });

      // Extract file names
      const fileList = files.split('\n')
        .filter(line => line.trim() && !line.startsWith('total'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        })
        .filter(name => name !== '.' && name !== '..');

      return {
        files: fileList,
        summary: `Modified ${fileList.length} file(s) in workspace`
      };
    } catch (error) {
      return {
        files: [],
        summary: 'Unable to determine final state'
      };
    }
  }

  /**
   * Get read-only tools for reviewer (only read_file and list_directory)
   */
  getReadOnlyTools(containerTools) {
    return containerTools.getTools().filter(tool =>
      tool.name === 'read_file' || tool.name === 'list_directory'
    );
  }

  /**
   * System prompt for Coder Agent
   */
  getCoderSystemPrompt() {
    return `You are an expert software engineer tasked with implementing code changes.

Your responsibilities:
1. Understand the task requirements thoroughly
2. Create a brief implementation plan
3. Write clean, functional code
4. Test your implementation
5. Use the provided tools to create and modify files

Available tools:
- read_file: Read existing files
- write_file: Create or modify files
- list_directory: List directory contents
- execute_command: Run commands (tests, linters, etc.)

Guidelines:
- Write production-quality code
- Follow best practices for the language
- Add comments for complex logic
- Test your code before finishing
- Be thorough but efficient

When you're done implementing, simply finish your turn.`;
  }

  /**
   * System prompt for Reviewer Agent
   */
  getReviewerSystemPrompt() {
    return `You are an expert code reviewer tasked with ensuring code quality.

Your responsibilities:
1. Review the implementation against the task requirements
2. Check for correctness, completeness, and quality
3. Identify any bugs, issues, or improvements needed
4. Provide clear, actionable feedback

Available tools (read-only):
- read_file: Read files to review code
- list_directory: See what files exist

Review criteria:
- Does it correctly implement the requirements?
- Is the code clean and well-structured?
- Are there any bugs or edge cases not handled?
- Does it follow best practices?

Your response should be either:
1. "APPROVED" if the implementation is good to go
2. A detailed list of specific issues that need to be fixed

Be thorough but fair. Minor style issues are acceptable. Focus on correctness and completeness.`;
  }

  /**
   * System prompt for Architect Agent
   */
  getArchitectSystemPrompt() {
    return `You are a senior software architect tasked with analyzing projects and creating implementation briefs.

Your responsibilities:
1. Explore the project structure and understand the codebase
2. Identify existing patterns, conventions, and architecture
3. Understand the tech stack, dependencies, and frameworks in use
4. Analyze constraints and requirements
5. Create a detailed, actionable brief for the implementation team

Available tools (read-only):
- read_file: Read files to understand code
- list_directory: Explore project structure

Analysis checklist:
- What is the project structure? (files, directories, organization)
- What programming language(s) and frameworks are used?
- What are the existing code patterns and conventions?
- Where should new code be added?
- What existing code needs to be modified?
- Are there tests? What testing framework is used?
- Are there any special considerations or constraints?

Output format:
Create a structured brief with sections for:
- Project Overview (tech stack, structure)
- Relevant Files (which files to modify/create)
- Existing Patterns (code style, conventions to follow)
- Implementation Guidance (specific recommendations)
- Testing Requirements (how to test the changes)

Be concise but thorough. Focus on information that will help the coder implement efficiently.`;
  }

  /**
   * Format conversation history for display
   * @param {Object} conversations - Conversation history from execute()
   * @returns {string} - Formatted conversation transcript
   */
  formatConversations(conversations) {
    let output = '\n' + '='.repeat(70) + '\n';
    output += '📝 AGENT CONVERSATION TRANSCRIPT\n';
    output += '='.repeat(70) + '\n\n';

    const { coder, reviewer } = conversations;

    for (let round = 0; round < Math.max(coder.length, reviewer.length); round++) {
      output += chalk.cyan.bold(`Round ${round + 1}\n`);
      output += '-'.repeat(70) + '\n\n';

      // Coder's work
      if (coder[round]) {
        output += chalk.green('👨‍💻 Coder Agent:\n');
        output += `  Iterations: ${coder[round].iterations}\n`;
        if (coder[round].plan) {
          output += `  Plan:\n`;
          const planLines = coder[round].plan.split('\n').slice(0, 5);
          planLines.forEach(line => {
            output += `    ${line}\n`;
          });
          if (coder[round].plan.split('\n').length > 5) {
            output += '    ...\n';
          }
        }
        output += '\n';
      }

      // Reviewer's feedback
      if (reviewer[round]) {
        output += chalk.yellow('👁️  Reviewer Agent:\n');
        output += `  Iterations: ${reviewer[round].iterations}\n`;
        output += `  Decision: ${reviewer[round].approved ? chalk.green('APPROVED') : chalk.yellow('CHANGES REQUESTED')}\n`;
        if (reviewer[round].feedback) {
          output += `  Feedback:\n`;
          const feedbackLines = reviewer[round].feedback.split('\n').slice(0, 5);
          feedbackLines.forEach(line => {
            output += `    ${line}\n`;
          });
          if (reviewer[round].feedback.split('\n').length > 5) {
            output += '    ...\n';
          }
        }
        output += '\n';
      }
    }

    output += '='.repeat(70) + '\n';
    return output;
  }
}
