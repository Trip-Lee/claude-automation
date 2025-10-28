/**
 * Tool Executor
 *
 * Executes tools within Docker containers.
 * Provides a dedicated tool execution interface (Option B)
 * with fallback to Bash execution (Option A).
 */

import { ToolRegistry } from './tool-registry.js';

export class ToolExecutor {
  constructor(dockerManager, toolRegistry = null) {
    this.dockerManager = dockerManager;
    this.toolRegistry = toolRegistry || new ToolRegistry();
  }

  /**
   * Execute a tool in a container
   *
   * Primary method - Option B: Dedicated tool execution interface
   * Falls back to Option A (Bash) if dedicated execution fails
   *
   * @param {string} toolName - Name of the tool to execute
   * @param {string} command - Command/operation to execute
   * @param {Object} container - Docker container instance
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeTool(toolName, command, container, options = {}) {
    // Validate tool exists
    if (!this.toolRegistry.hasTool(toolName)) {
      throw new Error(
        `Tool '${toolName}' not found. Available tools: ${this.toolRegistry.getToolNames().join(', ')}`
      );
    }

    // Validate execution prerequisites
    const validation = this.toolRegistry.validateToolExecution(toolName);
    if (!validation.valid) {
      throw new Error(
        `Tool execution validation failed: ${validation.error}${validation.suggestion ? '\n' + validation.suggestion : ''}`
      );
    }

    // Get tool execution info
    const toolInfo = this.toolRegistry.getToolExecutionInfo(toolName);

    console.log(`Executing tool: ${toolName}`);
    console.log(`  Command: ${command}`);
    console.log(`  Working directory: ${toolInfo.workingDirectory}`);

    try {
      // Try Option B: Dedicated tool execution
      return await this._executeDedicated(toolInfo, command, container, options);
    } catch (dedicatedError) {
      console.warn(`Dedicated tool execution failed: ${dedicatedError.message}`);
      console.log(`Falling back to Bash execution...`);

      // Fallback to Option A: Bash execution
      try {
        return await this._executeBash(toolInfo, command, container, options);
      } catch (bashError) {
        throw new Error(
          `Tool execution failed with both methods:\n` +
          `  Dedicated: ${dedicatedError.message}\n` +
          `  Bash: ${bashError.message}`
        );
      }
    }
  }

  /**
   * Option B: Dedicated tool execution interface
   *
   * Constructs and executes the tool command based on tool type
   */
  async _executeDedicated(toolInfo, command, container, options) {
    const { type, workingDirectory, entryPoint } = toolInfo;

    // Build command based on tool type
    let fullCommand;

    switch (type) {
      case 'node_script':
        // For Node.js tools, use npm run or node directly
        if (command.startsWith('npm run ')) {
          // npm run command
          fullCommand = `cd ${workingDirectory} && ${command}`;
        } else if (command.includes('/')) {
          // Direct script path
          fullCommand = `cd ${workingDirectory} && node ${command}`;
        } else {
          // Assume it's an npm script name
          fullCommand = `cd ${workingDirectory} && npm run ${command}`;
        }
        break;

      case 'python_script':
        fullCommand = `cd ${workingDirectory} && python3 ${entryPoint} ${command}`;
        break;

      case 'shell_script':
        fullCommand = `cd ${workingDirectory} && bash ${entryPoint} ${command}`;
        break;

      case 'binary':
        fullCommand = `cd ${workingDirectory} && ./${entryPoint} ${command}`;
        break;

      default:
        throw new Error(`Unsupported tool type: ${type}`);
    }

    // Execute in container
    const result = await this.dockerManager.exec(container, fullCommand, {
      timeout: options.timeout || 300000, // 5 minute default
      ...options
    });

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      method: 'dedicated',
      toolInfo
    };
  }

  /**
   * Option A: Bash execution fallback
   *
   * Lets agents use Bash tool directly to execute commands
   * This is more flexible but less controlled
   */
  async _executeBash(toolInfo, command, container, options) {
    const { workingDirectory } = toolInfo;

    // If command already includes cd, use it as-is
    let fullCommand;
    if (command.includes('cd ')) {
      fullCommand = command;
    } else {
      fullCommand = `cd ${workingDirectory} && ${command}`;
    }

    const result = await this.dockerManager.exec(container, fullCommand, {
      timeout: options.timeout || 300000,
      ...options
    });

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      method: 'bash_fallback',
      toolInfo
    };
  }

  /**
   * Execute tool with npm run command
   * Convenience method for node_script tools
   */
  async executeNpmCommand(toolName, scriptName, container, options = {}) {
    return await this.executeTool(toolName, `npm run ${scriptName}`, container, options);
  }

  /**
   * Test tool availability in container
   * Verifies the tool can be accessed and executed
   */
  async testTool(toolName, container) {
    const toolInfo = this.toolRegistry.getToolExecutionInfo(toolName);

    // Test basic access
    try {
      const testCommand = `ls -la ${toolInfo.containerPath}`;
      const result = await this.dockerManager.exec(container, testCommand);

      if (result.exitCode !== 0) {
        return {
          available: false,
          error: 'Tool directory not accessible',
          details: result.stderr
        };
      }

      // Check entry point exists
      const entryCheckCommand = `test -f ${toolInfo.fullPath} && echo "EXISTS" || echo "MISSING"`;
      const entryResult = await this.dockerManager.exec(container, entryCheckCommand);

      if (entryResult.stdout.trim() !== 'EXISTS') {
        return {
          available: false,
          error: 'Tool entry point not found',
          details: `Expected: ${toolInfo.fullPath}`
        };
      }

      return {
        available: true,
        toolInfo
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Test all tools in a container
   */
  async testAllTools(container) {
    const results = {};

    for (const toolName of this.toolRegistry.getToolNames()) {
      results[toolName] = await this.testTool(toolName, container);
    }

    return results;
  }

  /**
   * Get tool context for agent prompts
   */
  getToolContext() {
    return this.toolRegistry.getToolContext();
  }

  /**
   * Get tool context as markdown
   */
  getToolContextMarkdown() {
    return this.toolRegistry.getToolContextMarkdown();
  }

  /**
   * Get tool statistics
   */
  getStats() {
    return this.toolRegistry.getStats();
  }
}

// Export already done above
