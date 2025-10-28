/**
 * ClaudeCodeAgent - Wrapper for Claude Code CLI as an agent backend
 * Uses Claude Code in headless mode instead of direct Anthropic API calls
 *
 * Benefits:
 * - Uses existing Claude Pro/Max subscription
 * - No separate API key required
 * - Built-in tool support (Bash, Edit, Read, Write)
 * - Automatic session management and cost tracking
 */

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

export class ClaudeCodeAgent {
  constructor(config = {}) {
    this.sessionId = config.sessionId || uuidv4();
    this.role = config.role || 'agent'; // 'architect', 'coder', 'reviewer'
    this.systemPrompt = config.systemPrompt || '';
    this.allowedTools = config.allowedTools || [];
    this.workingDir = config.workingDir || process.cwd();
    this.maxIterations = config.maxIterations || 20;
    this.verbose = config.verbose || false;
    this.resumeSession = config.resumeSession || false; // Resume existing session instead of creating new
    this.timeout = config.timeout || 300000; // 5 minutes default timeout
    this.maxRetries = config.maxRetries || 3; // Retry failed queries up to 3 times
    this.retryDelay = config.retryDelay || 2000; // 2 second delay between retries
    this.model = config.model || 'sonnet'; // Model selection: 'sonnet', 'opus', 'haiku'
  }

  /**
   * Execute a query using Claude Code in headless mode
   * @param {string} prompt - The prompt to send
   * @param {Array} conversationHistory - Previous messages (optional)
   * @returns {Promise<Object>} - { response, usage, sessionId }
   */
  async query(prompt, conversationHistory = []) {
    // Try query with retry logic
    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this._executeQuery(prompt, conversationHistory);
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this._isRetryableError(error);

        if (!isRetryable || attempt === this.maxRetries) {
          // Not retryable or final attempt - throw the error
          throw this._enhanceError(error, { attempt, maxRetries: this.maxRetries });
        }

        // Wait before retrying with exponential backoff
        const delay = this.retryDelay * attempt;
        if (this.verbose) {
          console.log(chalk.yellow(`  [${this.role}] Retry ${attempt}/${this.maxRetries} after ${delay}ms (${error.message})`));
        }
        await this._sleep(delay);
      }
    }

    // Should never reach here, but just in case
    throw lastError;
  }

  /**
   * Internal query execution (called by query with retry logic)
   * @private
   */
  async _executeQuery(prompt, conversationHistory = []) {
    const startTime = Date.now();

    // Performance profiling
    const profiling = {
      spawnStart: Date.now(),
      spawnEnd: null,
      executionStart: null,
      executionEnd: null,
      parseStart: null,
      parseEnd: null
    };

    return new Promise((resolve, reject) => {
      const args = [
        '-p', // Print mode (non-interactive)
        '--output-format', 'json', // JSON output
        '--dangerously-skip-permissions', // Skip permission prompts (safe in Docker sandbox)
      ];

      // Use --resume for session continuation, --session-id for new sessions
      if (this.resumeSession) {
        args.push('--resume', this.sessionId); // Resume existing session
      } else {
        args.push('--session-id', this.sessionId); // Create new session
      }

      // Add model selection
      if (this.model && this.model !== 'sonnet') {
        args.push('--model', this.model);
      }

      // Add system prompt if specified
      if (this.systemPrompt) {
        args.push('--system-prompt', this.systemPrompt);
      }

      // Add allowed tools if specified
      if (this.allowedTools.length > 0) {
        args.push('--allowedTools', this.allowedTools.join(','));
      }

      // Add working directory
      args.push('--add-dir', this.workingDir);

      // Add -- to mark end of options (prevents --add-dir from consuming the prompt)
      args.push('--');

      // Add the prompt
      args.push(prompt);

      if (this.verbose) {
        console.log(chalk.gray(`  [${this.role}] Spawning: claude ${args.join(' ')}`));
      }

      const claudeProcess = spawn('claude', args, {
        cwd: this.workingDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'] // stdin: ignore, stdout: pipe, stderr: pipe
      });

      profiling.spawnEnd = Date.now();
      profiling.executionStart = Date.now();

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout for the process
      const timeoutId = setTimeout(() => {
        timedOut = true;
        claudeProcess.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!claudeProcess.killed) {
            claudeProcess.kill('SIGKILL');
          }
        }, 5000);
      }, this.timeout);

      claudeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        if (this.verbose) {
          console.log(chalk.yellow(`  [${this.role}] stderr: ${data.toString()}`));
        }
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        profiling.executionEnd = Date.now();
        profiling.parseStart = Date.now();

        if (timedOut) {
          reject(new Error(`Claude Code timed out after ${this.timeout}ms`));
          return;
        }

        if (code !== 0) {
          // Enhanced error message with context
          let errorMsg = `Claude Code exited with code ${code}`;
          if (stderr.includes('ENOENT')) {
            errorMsg += '\n\nClaude Code CLI not found. Please install:\n  npm install -g @anthropic-ai/claude-cli';
          } else if (stderr.includes('permission denied')) {
            errorMsg += '\n\nPermission denied. Try:\n  chmod +x $(which claude)';
          } else if (stderr.includes('rate limit')) {
            errorMsg += '\n\nRate limit exceeded. Please wait and try again.';
          } else if (stderr) {
            errorMsg += `\n\nError output:\n${stderr.slice(0, 500)}${stderr.length > 500 ? '...' : ''}`;
          }
          reject(new Error(errorMsg));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          profiling.parseEnd = Date.now();

          if (result.is_error) {
            reject(new Error(result.result || 'Unknown error'));
            return;
          }

          const elapsedMs = Date.now() - startTime;

          resolve({
            response: result.result,
            usage: result.usage || {},
            modelUsage: result.modelUsage || {},
            cost: result.total_cost_usd || 0,
            sessionId: result.session_id || this.sessionId,
            duration: result.duration_ms || 0,
            wallClockDuration: elapsedMs,
            numTurns: result.num_turns || 1,
            profiling: {
              spawnTime: profiling.spawnEnd - profiling.spawnStart,
              executionTime: profiling.executionEnd - profiling.executionStart,
              parseTime: profiling.parseEnd - profiling.parseStart,
              totalTime: profiling.parseEnd - profiling.spawnStart
            }
          });
        } catch (error) {
          profiling.parseEnd = Date.now();
          reject(new Error(`Failed to parse Claude Code output: ${error.message}\nOutput: ${stdout}`));
        }
      });

      claudeProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn Claude Code process: ${error.message}`));
      });
    });
  }

  /**
   * Execute a multi-turn conversation with tool support
   * @param {Object} params - { initialPrompt, containerTools, costMonitor }
   * @returns {Promise<Object>} - { response, iterations, usage }
   */
  async executeWithTools({ initialPrompt, containerTools, costMonitor }) {
    const executeStartTime = Date.now();
    let iteration = 0;
    let finalResponse = '';
    let conversationHistory = [];
    let totalCost = 0;
    let totalWallClockMs = 0;
    let aggregatedProfiling = {
      totalSpawnTime: 0,
      totalExecutionTime: 0,
      totalParseTime: 0
    };

    // Build system prompt based on role
    const rolePrompts = {
      architect: this.getArchitectSystemPrompt(),
      coder: this.getCoderSystemPrompt(),
      reviewer: this.getReviewerSystemPrompt()
    };

    const fullSystemPrompt = this.systemPrompt || rolePrompts[this.role] || '';

    while (iteration < this.maxIterations) {
      iteration++;

      if (this.verbose) {
        console.log(chalk.gray(`  Iteration ${iteration}/${this.maxIterations}`));
      }

      try {
        // Create agent with system prompt
        const agent = new ClaudeCodeAgent({
          sessionId: this.sessionId,
          role: this.role,
          systemPrompt: fullSystemPrompt,
          allowedTools: this.allowedTools,
          workingDir: this.workingDir,
          verbose: this.verbose,
          resumeSession: this.resumeSession
        });

        const result = await agent.query(
          iteration === 1 ? initialPrompt : 'Continue with the task',
          conversationHistory
        );

        finalResponse = result.response;
        totalCost += result.cost || 0;
        totalWallClockMs += result.wallClockDuration || 0;

        // Aggregate profiling data
        if (result.profiling) {
          aggregatedProfiling.totalSpawnTime += result.profiling.spawnTime || 0;
          aggregatedProfiling.totalExecutionTime += result.profiling.executionTime || 0;
          aggregatedProfiling.totalParseTime += result.profiling.parseTime || 0;
        }

        // Track cost
        if (costMonitor && result.cost) {
          costMonitor.addUsage({
            inputTokens: result.usage?.input_tokens || 0,
            outputTokens: result.usage?.output_tokens || 0
          });
        }

        // Check if done (no more iterations needed)
        // For now, we assume Claude Code handles tool use internally
        // and returns when complete
        break;

      } catch (error) {
        console.error(chalk.red(`  Error in iteration ${iteration}: ${error.message}`));
        throw error;
      }
    }

    if (iteration >= this.maxIterations) {
      throw new Error(`${this.role} agent exceeded max iterations (${this.maxIterations})`);
    }

    const totalExecuteTime = Date.now() - executeStartTime;

    return {
      response: finalResponse,
      iterations: iteration,
      sessionId: this.sessionId,
      cost: totalCost,
      wallClockDuration: totalWallClockMs,
      totalDuration: totalExecuteTime,
      profiling: aggregatedProfiling
    };
  }

  /**
   * System prompts for different agent roles
   */
  getArchitectSystemPrompt() {
    return `You're a software architect. Analyze the project and create an implementation brief.

Tasks:
- Explore project structure & tech stack
- Identify code patterns & conventions
- List files to modify/create
- Provide implementation guidance
- Specify testing requirements

Tools: Read, Bash (ls, cat, find, grep)

Output: Structured brief with Project Overview, Relevant Files, Existing Patterns, Implementation Guidance, Testing Requirements.

Be concise but thorough.`;
  }

  getCoderSystemPrompt() {
    return `You're an expert software engineer. Implement the task efficiently.

Tasks:
- Write clean, tested code
- Follow existing patterns
- Use available tools (Read, Write, Edit, Bash)

Guidelines:
- Production-quality code
- Best practices for the language
- Test before finishing

Finish your turn when done.`;
  }

  getReviewerSystemPrompt() {
    return `You're a code reviewer. Ensure quality and correctness.

Review for:
- Correct implementation
- Clean code structure
- Bugs & edge cases
- Best practices

Tools: Read, Bash (ls, cat) - read-only

Response:
- "APPROVED" if good
- Specific issues if changes needed

Be thorough but fair. Focus on correctness.`;
  }

  /**
   * Helper: Sleep for specified milliseconds
   * @private
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Determine if error is retryable
   * @private
   */
  _isRetryableError(error) {
    const message = error.message.toLowerCase();

    // Retryable errors (network, rate limit, timeout)
    const retryablePatterns = [
      'rate limit',
      'timeout',
      'econnrefused',
      'econnreset',
      'etimedout',
      'network error',
      'socket hang up',
      'temporary failure'
    ];

    // Non-retryable errors (permission, not found, syntax)
    const nonRetryablePatterns = [
      'permission denied',
      'not found',
      'enoent',
      'invalid json',
      'syntax error'
    ];

    // Check if explicitly non-retryable
    if (nonRetryablePatterns.some(pattern => message.includes(pattern))) {
      return false;
    }

    // Check if explicitly retryable
    if (retryablePatterns.some(pattern => message.includes(pattern))) {
      return true;
    }

    // Default: retry for unknown errors
    return true;
  }

  /**
   * Helper: Enhance error with context
   * @private
   */
  _enhanceError(error, context = {}) {
    const { attempt, maxRetries } = context;

    let message = error.message;

    // Add retry information if available
    if (attempt && maxRetries) {
      message += `\n\n(Failed after ${attempt} attempt${attempt > 1 ? 's' : ''})`;
    }

    // Add role context
    if (this.role) {
      message += `\n\nAgent role: ${this.role}`;
    }

    // Add troubleshooting hints
    if (error.message.includes('timeout')) {
      message += '\n\nTroubleshooting:';
      message += `\n- Increase timeout (current: ${this.timeout}ms)`;
      message += '\n- Check system resources';
      message += '\n- Try a simpler task first';
    } else if (error.message.includes('rate limit')) {
      message += '\n\nTroubleshooting:';
      message += '\n- Wait a few minutes and try again';
      message += '\n- Check your Claude Pro/Max subscription status';
      message += '\n- Reduce task complexity';
    }

    // Create enhanced error
    const enhancedError = new Error(message);
    enhancedError.originalError = error;
    enhancedError.role = this.role;
    enhancedError.attempt = attempt;
    enhancedError.maxRetries = maxRetries;

    return enhancedError;
  }
}
