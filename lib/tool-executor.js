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

    // SECURITY: Validate operation is allowed for AI
    const operationCheck = this.validateOperation(toolName, command);
    if (!operationCheck.allowed) {
      throw new Error(
        `SECURITY: Operation blocked - ${operationCheck.reason}\n` +
        `Tool: ${toolName}\n` +
        `Command: ${command}\n` +
        `\n` +
        `${operationCheck.suggestion || ''}`
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

  /**
   * Validate if an operation is allowed for AI execution
   * Checks against safe_operations and forbidden_operations in tool manifest
   *
   * @param {string} toolName - Name of the tool
   * @param {string} command - Command to execute
   * @returns {Object} - { allowed: boolean, reason: string, suggestion: string }
   */
  validateOperation(toolName, command) {
    const tool = this.toolRegistry.getTool(toolName);

    if (!tool) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' not found`,
        suggestion: null
      };
    }

    // If no operation restrictions defined, allow by default (backward compatibility)
    if (!tool.safe_operations && !tool.forbidden_operations) {
      return { allowed: true };
    }

    // Extract operation name from command
    // Supports: "npm run test-connections", "test-connections", "npm run fetch-data", etc.
    const operation = this.extractOperationName(command);

    // Check forbidden operations first (highest priority)
    if (tool.forbidden_operations && Array.isArray(tool.forbidden_operations)) {
      if (tool.forbidden_operations.includes(operation)) {
        return {
          allowed: false,
          reason: `Operation '${operation}' requires human approval`,
          suggestion:
            `This operation modifies external systems and must be executed manually.\n` +
            `After AI completes its work and you review the changes:\n` +
            `  1. Review files in temp_updates/\n` +
            `  2. Approve the PR\n` +
            `  3. Manually run: cd /tools/${tool.directoryName}/ServiceNow-Tools && npm run ${operation}`
        };
      }
    }

    // Check safe operations whitelist
    if (tool.safe_operations && Array.isArray(tool.safe_operations)) {
      if (tool.safe_operations.includes(operation)) {
        return { allowed: true };
      }

      // Operation not in whitelist
      return {
        allowed: false,
        reason: `Operation '${operation}' is not in the safe operations list`,
        suggestion:
          `AI can only execute these operations:\n` +
          tool.safe_operations.map(op => `  - ${op}`).join('\n') +
          `\n\nIf you need to execute '${operation}', run it manually after task completion.`
      };
    }

    // No restrictions defined - allow
    return { allowed: true };
  }

  /**
   * Extract operation name from command string
   * Handles various command formats:
   *   "npm run test-connections" -> "test-connections"
   *   "test-connections" -> "test-connections"
   *   "cd /tools/sn-tools && npm run fetch-data" -> "fetch-data"
   *
   * @param {string} command - Command string
   * @returns {string} - Operation name
   */
  extractOperationName(command) {
    // Remove cd commands and &&
    let cleaned = command.replace(/cd\s+[^\s&]+\s*&&\s*/g, '').trim();

    // Match "npm run <operation>"
    const npmRunMatch = cleaned.match(/npm\s+run\s+([^\s]+)/);
    if (npmRunMatch) {
      return npmRunMatch[1];
    }

    // Match direct script execution: "node script.js <operation>"
    const nodeMatch = cleaned.match(/node\s+[^\s]+\.js\s+([^\s]+)/);
    if (nodeMatch) {
      return nodeMatch[1];
    }

    // Return first token if no pattern matches
    return cleaned.split(/\s+/)[0];
  }
}

// Export already done above
