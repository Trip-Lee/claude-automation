/**
 * ContainerTools - Docker container interface with tool execution
 * Provides safe file and command execution in isolated containers
 */

import Dockerode from 'dockerode';
import { z } from 'zod';

export class ContainerTools {
  constructor(container) {
    this.container = container;
    this.docker = new Dockerode();

    // Define tools with validation schemas
    this.tools = [
      {
        name: "read_file",
        description: "Read the contents of a file from the container filesystem. Returns the file contents as a string.",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute path to the file (must start with /workspace)"
            }
          },
          required: ["path"]
        },
        validator: z.object({
          path: z.string().refine(
            p => p.startsWith('/workspace'),
            { message: "Path must start with /workspace" }
          )
        })
      },
      {
        name: "write_file",
        description: "Write content to a file in the container filesystem. Creates parent directories if needed.",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute path to the file (must start with /workspace)"
            },
            content: {
              type: "string",
              description: "Content to write to the file"
            }
          },
          required: ["path", "content"]
        },
        validator: z.object({
          path: z.string().refine(
            p => p.startsWith('/workspace'),
            { message: "Path must start with /workspace" }
          ),
          content: z.string()
        })
      },
      {
        name: "list_directory",
        description: "List files and directories at a given path. Returns names, types, and sizes.",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute path to directory (must start with /workspace)"
            }
          },
          required: ["path"]
        },
        validator: z.object({
          path: z.string().refine(
            p => p.startsWith('/workspace'),
            { message: "Path must start with /workspace" }
          )
        })
      },
      {
        name: "execute_command",
        description: "Execute a shell command in the container. Use for running tests, linters, or other commands.",
        input_schema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "Command to execute (e.g., 'python main.py', 'pytest', 'npm test')"
            }
          },
          required: ["command"]
        },
        validator: z.object({
          command: z.string().min(1)
        })
      }
    ];
  }

  /**
   * Get tool definitions for Claude API
   * Only return fields that Anthropic API accepts (no validator field)
   */
  getTools() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema
    }));
  }

  /**
   * Execute a tool by name with input validation
   */
  async executeTool(toolName, input) {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Validate input
    try {
      tool.validator.parse(input);
    } catch (error) {
      throw new Error(`Invalid input for ${toolName}: ${error.message}`);
    }

    // Execute tool
    switch (toolName) {
      case "read_file":
        return await this.readFile(input.path);
      case "write_file":
        return await this.writeFile(input.path, input.content);
      case "list_directory":
        return await this.listDirectory(input.path);
      case "execute_command":
        return await this.executeCommand(input.command);
      default:
        throw new Error(`Tool not implemented: ${toolName}`);
    }
  }

  /**
   * Read file from container
   */
  async readFile(path) {
    const exec = await this.container.exec({
      Cmd: ['cat', path],
      AttachStdout: true,
      AttachStderr: true
    });

    return await this.execAndGetOutput(exec);
  }

  /**
   * Write file to container
   * Uses base64 encoding to safely handle UTF-8 and avoid shell escaping issues
   */
  async writeFile(path, content) {
    // Use base64 encoding to safely transfer content without shell escaping issues
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    // Create parent directories
    const mkdirCmd = ['mkdir', '-p', path.substring(0, path.lastIndexOf('/'))];
    const mkdirExec = await this.container.exec({
      Cmd: mkdirCmd,
      AttachStdout: true,
      AttachStderr: true
    });
    await this.execAndGetOutput(mkdirExec);

    // Write file using base64 decode and tee (tee can overwrite bind-mounted files)
    // Using tee instead of > redirection to handle permission issues on bind mounts
    const writeCmd = ['sh', '-c', `echo '${base64Content}' | base64 -d | tee ${path} > /dev/null`];
    const writeExec = await this.container.exec({
      Cmd: writeCmd,
      AttachStdout: true,
      AttachStderr: true
    });
    await this.execAndGetOutput(writeExec);

    return `Successfully wrote ${content.length} bytes to ${path}`;
  }

  /**
   * List directory contents
   */
  async listDirectory(path) {
    const exec = await this.container.exec({
      Cmd: ['ls', '-lah', path],
      AttachStdout: true,
      AttachStderr: true
    });

    const output = await this.execAndGetOutput(exec);
    return output;
  }

  /**
   * Execute command in container
   */
  async executeCommand(command) {
    const exec = await this.container.exec({
      Cmd: ['sh', '-c', `cd /workspace && ${command}`],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace'
    });

    const output = await this.execAndGetOutput(exec);
    const inspect = await exec.inspect();

    if (inspect.ExitCode !== 0) {
      return `Command failed with exit code ${inspect.ExitCode}:\n${output}`;
    }

    return output || 'Command executed successfully (no output)';
  }

  /**
   * Execute and capture output from exec instance
   */
  async execAndGetOutput(exec) {
    return new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err) return reject(err);

        let output = '';

        stream.on('data', (chunk) => {
          // Docker multiplexes stdout/stderr with 8-byte headers
          // Skip header and get actual content
          output += chunk.slice(8).toString('utf-8');
        });

        stream.on('end', () => {
          resolve(output.trim());
        });

        stream.on('error', reject);
      });
    });
  }
}

/**
 * Create and start a container for testing
 */
export async function createTestContainer(imageName = 'claude-python:latest') {
  const docker = new Dockerode();

  console.log(`🐳 Creating container from ${imageName}...`);

  const container = await docker.createContainer({
    Image: imageName,
    Cmd: ['sleep', 'infinity'], // Keep container running
    WorkingDir: '/workspace',
    HostConfig: {
      AutoRemove: false,
      Memory: 1024 * 1024 * 1024 * 2, // 2GB
      MemorySwap: 1024 * 1024 * 1024 * 2,
      CpuPeriod: 100000,
      CpuQuota: 100000, // 1 CPU
      NetworkMode: 'none' // Isolated
    },
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    Tty: false,
    OpenStdin: false
  });

  await container.start();
  console.log(`✅ Container ${container.id.substring(0, 12)} started`);

  return container;
}

/**
 * Stop and remove container
 */
export async function cleanupContainer(container) {
  try {
    console.log(`🧹 Cleaning up container...`);
    await container.stop();
    await container.remove();
    console.log(`✅ Container cleaned up`);
  } catch (error) {
    console.log(`⚠️  Cleanup warning: ${error.message}`);
  }
}
