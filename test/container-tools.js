/**
 * ContainerTools - Interface for executing tools in a container context
 *
 * Provides a unified interface for:
 * - Docker container-based execution (actual container)
 * - Local execution (when running without Docker)
 *
 * Used by both:
 * - Claude Code CLI-based agents (just needs workingDir)
 * - Anthropic API-based agents (needs full tool execution)
 */

import { spawn, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export class ContainerTools {
  /**
   * @param {Object|null} container - Docker container reference or null for local execution
   * @param {Object} options - Additional options
   */
  constructor(container = null, options = {}) {
    this.container = container;
    this.containerName = container?.name || container?.containerName || null;

    // Working directory - defaults to /workspace in container or cwd locally
    this.workingDir = options.workingDir ||
      (this.containerName ? '/workspace' : process.cwd());

    // Track if we're using Docker or local execution
    this.isDocker = !!this.containerName;

    // Timeout for commands
    this.timeout = options.timeout || 60000; // 60 second default
  }

  /**
   * Execute a tool by name
   * @param {string} toolName - Tool name (read_file, write_file, execute_command, list_directory)
   * @param {Object} args - Tool-specific arguments
   * @returns {Promise<Object>} - { success, result, error }
   */
  async executeTool(toolName, args) {
    try {
      switch (toolName) {
        case 'read_file':
          return await this.readFile(args.path);

        case 'write_file':
          return await this.writeFile(args.path, args.content);

        case 'execute_command':
          return await this.executeCommand(args.command);

        case 'list_directory':
          return await this.listDirectory(args.path || '.');

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Read a file
   * @param {string} filePath - Path to file (relative to workingDir)
   */
  async readFile(filePath) {
    const fullPath = this.resolvePath(filePath);

    if (this.isDocker) {
      const result = await this.dockerExec(`cat "${fullPath}"`);
      return {
        success: result.exitCode === 0,
        result: result.stdout,
        error: result.stderr || null
      };
    } else {
      const content = await fs.readFile(fullPath, 'utf-8');
      return {
        success: true,
        result: content
      };
    }
  }

  /**
   * Write a file
   * @param {string} filePath - Path to file (relative to workingDir)
   * @param {string} content - File content
   */
  async writeFile(filePath, content) {
    const fullPath = this.resolvePath(filePath);

    if (this.isDocker) {
      // Use heredoc to write file in container
      const escapedContent = content.replace(/'/g, "'\\''");
      const result = await this.dockerExec(
        `mkdir -p "$(dirname "${fullPath}")" && cat > "${fullPath}" << 'CONTAINERTOOLS_EOF'\n${content}\nCONTAINERTOOLS_EOF`
      );
      return {
        success: result.exitCode === 0,
        result: 'File written successfully',
        error: result.stderr || null
      };
    } else {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
      return {
        success: true,
        result: 'File written successfully'
      };
    }
  }

  /**
   * Execute a command
   * @param {string} command - Command to execute
   */
  async executeCommand(command) {
    if (this.isDocker) {
      return await this.dockerExec(command);
    } else {
      return await this.localExec(command);
    }
  }

  /**
   * List directory contents
   * @param {string} dirPath - Path to directory (relative to workingDir)
   */
  async listDirectory(dirPath = '.') {
    const fullPath = this.resolvePath(dirPath);

    if (this.isDocker) {
      const result = await this.dockerExec(`ls -la "${fullPath}"`);
      return {
        success: result.exitCode === 0,
        result: result.stdout,
        error: result.stderr || null
      };
    } else {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const listing = entries.map(e => {
        const type = e.isDirectory() ? 'd' : '-';
        return `${type} ${e.name}`;
      }).join('\n');
      return {
        success: true,
        result: listing
      };
    }
  }

  /**
   * Get available tools (for Anthropic API tool_use)
   * @returns {Array} - Tool definitions
   */
  getTools() {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read (relative to workspace)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file (creates parent directories if needed)',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write (relative to workspace)'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'execute_command',
        description: 'Execute a shell command in the workspace',
        input_schema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command to execute'
            }
          },
          required: ['command']
        }
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory (relative to workspace). Defaults to current directory.'
            }
          },
          required: []
        }
      }
    ];
  }

  /**
   * Resolve a path relative to workingDir
   * @private
   */
  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.workingDir, filePath);
  }

  /**
   * Execute command in Docker container
   * @private
   */
  async dockerExec(command) {
    return new Promise((resolve) => {
      try {
        const result = execSync(
          `docker exec ${this.containerName} sh -c '${command.replace(/'/g, "'\\''")}'`,
          {
            encoding: 'utf-8',
            timeout: this.timeout,
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
          }
        );
        resolve({
          success: true,
          exitCode: 0,
          stdout: result,
          stderr: ''
        });
      } catch (error) {
        resolve({
          success: error.status === 0,
          exitCode: error.status || 1,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message
        });
      }
    });
  }

  /**
   * Execute command locally
   * @private
   */
  async localExec(command) {
    return new Promise((resolve) => {
      try {
        const result = execSync(command, {
          encoding: 'utf-8',
          cwd: this.workingDir,
          timeout: this.timeout,
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        resolve({
          success: true,
          exitCode: 0,
          stdout: result,
          stderr: ''
        });
      } catch (error) {
        resolve({
          success: error.status === 0,
          exitCode: error.status || 1,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message
        });
      }
    });
  }
}
