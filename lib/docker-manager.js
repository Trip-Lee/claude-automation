/**
 * DockerManager - Manages Docker container lifecycle with security isolation
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * - Only mount specific project directory (never home directory)
 * - Root filesystem read-only
 * - Network isolated during development
 * - Resource limits enforced
 * - Never mount orchestrator code or credentials
 */

import Dockerode from 'dockerode';
import chalk from 'chalk';
import { getGlobalConfig } from './global-config.js';

export class DockerManager {
  constructor() {
    this.docker = new Dockerode();
    this.globalConfig = getGlobalConfig();
  }

  /**
   * Create a Docker container with strict isolation
   * @param {Object} options - Container configuration
   * @param {string} options.name - Container name
   * @param {string} options.image - Docker image name
   * @param {string} options.memory - Memory limit (e.g., "4g", "512m")
   * @param {number} options.cpus - CPU limit (number of CPUs)
   * @param {Object} options.volumes - Volume mappings {hostPath: containerPath}
   * @param {string} options.network - Network mode (default: 'none')
   * @param {Object} options.toolEnv - Tool-specific environment variables
   * @returns {Promise<Container>} - Docker container instance
   */
  async create(options) {
    console.log(chalk.gray(`  Creating container: ${options.name}`));

    // Build environment variables array for container
    const envVars = [];
    if (options.toolEnv && typeof options.toolEnv === 'object') {
      for (const [key, value] of Object.entries(options.toolEnv)) {
        envVars.push(`${key}=${value}`);
      }
    }

    const containerConfig = {
      Image: options.image,
      name: options.name,
      Cmd: ['sleep', 'infinity'], // Keep container running
      WorkingDir: '/workspace',
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      OpenStdin: false,
      Env: envVars.length > 0 ? envVars : undefined,
      HostConfig: {
        // Resource limits
        Memory: this.parseMemory(options.memory),
        MemorySwap: this.parseMemory(options.memory), // Disable swap
        CpuPeriod: 100000,
        CpuQuota: this.parseCpus(options.cpus),

        // SECURITY: Only mount project directory
        Binds: this.createBinds(options.volumes),

        // SECURITY: Root filesystem read-only
        ReadonlyRootfs: true,

        // SECURITY: Temp directory with restrictions
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=512m',
          '/workspace/.tmp': 'rw,size=1g' // Writable workspace temp
        },

        // SECURITY: Network isolation
        NetworkMode: options.network || 'none',

        // Prevent privilege escalation
        SecurityOpt: ['no-new-privileges'],

        // Drop dangerous capabilities but keep file operation capabilities
        // We need CAP_CHOWN, CAP_DAC_OVERRIDE, CAP_FOWNER for file writes
        CapDrop: [
          'CAP_NET_RAW',        // Prevent raw network access
          'CAP_NET_ADMIN',      // Prevent network configuration
          'CAP_SYS_ADMIN',      // Prevent system administration
          'CAP_SYS_MODULE',     // Prevent kernel module loading
          'CAP_SYS_PTRACE',     // Prevent process tracing
          'CAP_SYS_BOOT',       // Prevent system reboot
          'CAP_SYS_TIME',       // Prevent time modification
          'CAP_AUDIT_CONTROL',  // Prevent audit control
          'CAP_MAC_ADMIN',      // Prevent MAC configuration
          'CAP_MAC_OVERRIDE',   // Prevent MAC override
          'CAP_SYSLOG',         // Prevent syslog access
          'CAP_SETUID',         // Prevent UID changes
          'CAP_SETGID',         // Prevent GID changes
          'CAP_SETPCAP',        // Prevent capability changes
          'CAP_LINUX_IMMUTABLE',// Prevent immutable flag
          'CAP_IPC_LOCK',       // Prevent memory locking
          'CAP_IPC_OWNER',      // Prevent IPC ownership override
          'CAP_SYS_RAWIO',      // Prevent raw I/O
          'CAP_SYS_CHROOT',     // Prevent chroot
          'CAP_SYS_NICE',       // Prevent priority changes
          'CAP_SYS_RESOURCE',   // Prevent resource limit override
          'CAP_SYS_TTY_CONFIG', // Prevent TTY configuration
          'CAP_MKNOD',          // Prevent device node creation
          'CAP_LEASE',          // Prevent file leases
          'CAP_AUDIT_WRITE',    // Prevent audit writes
          'CAP_AUDIT_READ'      // Prevent audit reads
        ],
        // Keep: CAP_CHOWN, CAP_DAC_OVERRIDE, CAP_FOWNER, CAP_FSETID for file operations
        // Keep: CAP_KILL for process management
        // Keep: CAP_SETFCAP for capability management

        // Auto-remove on stop (optional, configurable)
        AutoRemove: false
      }
    };

    const container = await this.docker.createContainer(containerConfig);
    await container.start();

    console.log(chalk.gray(`  Container started: ${options.name}`));

    return container;
  }

  /**
   * Execute command in container
   * @param {Container} container - Docker container
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @param {boolean} options.streaming - Enable streaming output
   * @returns {Promise<string>} - Command output
   */
  async exec(container, command, options = {}) {
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace'
    });

    if (options.streaming) {
      return await this.execStreaming(exec);
    } else {
      return await this.execAndGetOutput(exec);
    }
  }

  /**
   * Execute command and get output (non-streaming)
   */
  async execAndGetOutput(exec) {
    return new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err) return reject(err);

        let output = '';

        stream.on('data', (chunk) => {
          // Docker multiplexes stdout/stderr with 8-byte headers
          // Skip header and get actual content
          if (chunk.length > 8) {
            output += chunk.slice(8).toString('utf-8');
          }
        });

        stream.on('end', async () => {
          const inspectData = await exec.inspect();

          if (inspectData.ExitCode === 0) {
            resolve(output);
          } else {
            reject(new Error(output || `Command failed with exit code ${inspectData.ExitCode}`));
          }
        });

        stream.on('error', reject);
      });
    });
  }

  /**
   * Execute command with streaming output
   */
  async execStreaming(exec) {
    return new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err) return reject(err);

        let output = '';

        stream.on('data', (chunk) => {
          if (chunk.length > 8) {
            const data = chunk.slice(8).toString('utf-8');
            output += data;
            // Stream to stdout in real-time
            process.stdout.write(data);
          }
        });

        stream.on('end', async () => {
          const inspectData = await exec.inspect();

          if (inspectData.ExitCode === 0) {
            resolve(output);
          } else {
            reject(new Error(output || `Command failed with exit code ${inspectData.ExitCode}`));
          }
        });

        stream.on('error', reject);
      });
    });
  }

  /**
   * Stop a running container
   * @param {Container} container - Docker container
   */
  async stop(container) {
    try {
      await container.stop({ t: 2 }); // 2 second grace period (fast since we just run sleep)
    } catch (error) {
      // Container might already be stopped
      if (!error.message.includes('already stopped')) {
        throw error;
      }
    }
  }

  /**
   * Remove a container
   * @param {string|Container} containerNameOrId - Container to remove
   */
  async remove(containerNameOrId) {
    try {
      const container = typeof containerNameOrId === 'string'
        ? this.docker.getContainer(containerNameOrId)
        : containerNameOrId;

      await container.stop({ t: 5 });
      await container.remove();
    } catch (error) {
      // Container might not exist or already removed
      console.log(chalk.yellow(`  Could not remove container: ${error.message}`));
    }
  }

  /**
   * Check if Docker daemon is running
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      throw new Error('Docker daemon is not running');
    }
  }

  /**
   * List all containers (for cleanup and monitoring)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - List of containers
   */
  async listContainers(filters = {}) {
    return await this.docker.listContainers({
      all: true,
      filters: filters
    });
  }

  /**
   * Cleanup old containers
   * @param {string} namePrefix - Container name prefix (e.g., 'claude-')
   * @param {number} maxAgeHours - Maximum age in hours
   */
  async cleanupOldContainers(namePrefix, maxAgeHours = 24) {
    const containers = await this.listContainers();
    const cutoffTime = Date.now() / 1000 - (maxAgeHours * 3600);

    for (const containerInfo of containers) {
      const name = containerInfo.Names[0]?.replace('/', '');
      if (name?.startsWith(namePrefix) && containerInfo.Created < cutoffTime) {
        console.log(chalk.gray(`  Cleaning up old container: ${name}`));
        await this.remove(containerInfo.Id);
      }
    }
  }

  /**
   * Parse memory string to bytes
   * @param {string} memory - Memory string (e.g., "4g", "512m")
   * @returns {number} - Memory in bytes
   */
  parseMemory(memory) {
    const units = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = memory.toLowerCase().match(/^(\d+)([bkmg])$/);
    if (!match) {
      throw new Error(`Invalid memory format: ${memory}`);
    }

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  /**
   * Parse CPU count to quota
   * @param {number} cpus - Number of CPUs
   * @returns {number} - CPU quota
   */
  parseCpus(cpus) {
    // Convert CPU count to quota (cpus * 100000)
    return parseInt(cpus) * 100000;
  }

  /**
   * Create bind mounts with security validation
   * @param {Object} volumes - Volume mappings {hostPath: containerPath} or {hostPath: {containerPath, mode}}
   * @returns {Array<string>} - Bind mount strings
   */
  createBinds(volumes) {
    // SECURITY: Create bind mounts
    // CRITICAL: Only mount the specific project directory and tools directory
    // NEVER mount:
    // - ~/claude-automation (orchestrator code) - EXCEPT tools directory (read-only)
    // - ~/.env (credentials)
    // - ~/.claude-projects (configs)
    // - ~/ (home directory)

    return Object.entries(volumes).map(
      ([hostPath, containerPathOrOptions]) => {
        // Parse containerPath and mode
        let containerPath, mode;
        if (typeof containerPathOrOptions === 'string') {
          containerPath = containerPathOrOptions;
          mode = 'rw'; // Default to read-write
        } else {
          containerPath = containerPathOrOptions.containerPath || containerPathOrOptions;
          mode = containerPathOrOptions.mode || 'rw';
        }

        // Validate that we're not mounting sensitive directories
        const installPath = this.globalConfig.getInstallPath();
        const forbidden = [
          installPath,                                    // claude-automation installation
          this.globalConfig.get('envFile'),               // .env file
          this.globalConfig.get('configDir'),             // .claude-projects
          this.globalConfig.get('tasksDir'),              // .claude-tasks
          '/root'                                         // root directory
        ];

        // EXCEPTION: Allow mounting tools directory (read-only only)
        const toolsPath = installPath ? `${installPath}/tools` : null;
        const isToolsDir = toolsPath && hostPath.startsWith(toolsPath);
        if (isToolsDir && mode !== 'ro') {
          throw new Error(`Security violation: Tools directory must be mounted read-only (ro)`);
        }

        // Check forbidden paths (except tools directory)
        if (!isToolsDir) {
          for (const path of forbidden) {
            if (path && hostPath.startsWith(path)) {
              throw new Error(`Security violation: Cannot mount ${hostPath}`);
            }
          }
        }

        return `${hostPath}:${containerPath}:${mode}`;
      }
    );
  }

  /**
   * Get container stats (for monitoring)
   * @param {Container} container - Docker container
   * @returns {Promise<Object>} - Container stats
   */
  async getStats(container) {
    return new Promise((resolve, reject) => {
      container.stats({ stream: false }, (err, stats) => {
        if (err) return reject(err);
        resolve(stats);
      });
    });
  }
}
