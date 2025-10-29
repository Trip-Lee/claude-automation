/**
 * ConfigManager - Loads and validates project configurations
 *
 * Handles loading YAML configuration files from ~/.claude-projects/
 * and validating them against the expected schema.
 */

import { promises as fs } from 'fs';
import { parse } from 'yaml';
import { homedir } from 'os';
import path from 'path';

export class ConfigManager {
  constructor() {
    this.configDir = path.join(homedir(), '.claude-projects');
  }

  /**
   * Load project configuration
   * @param {string} projectName - Name of the project
   * @returns {Promise<Object>} - Project configuration object
   */
  async load(projectName) {
    const configPath = path.join(this.configDir, `${projectName}.yaml`);

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = parse(content);

      // Validate required fields
      this.validate(config);

      // Apply defaults
      return this.applyDefaults(config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `Project configuration not found: ${configPath}\n` +
          `Create it with: claude add-project ${projectName}`
        );
      }
      throw new Error(`Failed to load project config: ${error.message}`);
    }
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @throws {Error} - If validation fails
   */
  validate(config) {
    // Required top-level fields
    const requiredFields = ['name', 'repo', 'base_branch', 'docker'];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field in config: ${field}`);
      }
    }

    // Validate docker config
    if (!config.docker.image) {
      throw new Error('Missing required field: docker.image');
    }

    // Validate repo format (allow 'local' for local-only repos)
    if (config.repo !== 'local' && !this.isValidRepoUrl(config.repo)) {
      throw new Error(
        `Invalid repo URL: ${config.repo}\n` +
        `Expected format:\n` +
        `  - github.com/owner/repo\n` +
        `  - https://github.com/owner/repo\n` +
        `  - 'local' (for local-only repositories without GitHub)\n\n` +
        `Update config at: ~/.claude-projects/${config.name}.yaml`
      );
    }

    // Validate base_branch
    if (typeof config.base_branch !== 'string' || config.base_branch.length === 0) {
      throw new Error('base_branch must be a non-empty string');
    }

    // Validate docker memory/cpu if provided
    if (config.docker.memory && !this.isValidMemoryFormat(config.docker.memory)) {
      throw new Error(
        `Invalid memory format: ${config.docker.memory}\n` +
        `Expected format: 4g, 512m, etc.`
      );
    }

    if (config.docker.cpus && (typeof config.docker.cpus !== 'number' || config.docker.cpus <= 0)) {
      throw new Error('docker.cpus must be a positive number');
    }

    // Validate safety.max_cost_per_task if provided
    if (config.safety?.max_cost_per_task !== undefined) {
      if (typeof config.safety.max_cost_per_task !== 'number' || config.safety.max_cost_per_task < 0) {
        throw new Error('safety.max_cost_per_task must be a non-negative number');
      }
    }
  }

  /**
   * Apply default values to config
   * @param {Object} config - Configuration object
   * @returns {Object} - Config with defaults applied
   */
  applyDefaults(config) {
    return {
      ...config,
      protected_branches: config.protected_branches || ['main', 'master', 'develop'],
      requires_pr: config.requires_pr !== undefined ? config.requires_pr : true,
      auto_merge: config.auto_merge || false,
      require_pr_approval: config.require_pr_approval !== undefined ? config.require_pr_approval : true,

      docker: {
        image: config.docker.image,
        memory: config.docker.memory || process.env.DEFAULT_DOCKER_MEMORY || '4g',
        cpus: config.docker.cpus || parseInt(process.env.DEFAULT_DOCKER_CPUS || '2'),
        network_mode: config.docker.network_mode || 'none'
      },

      tests: config.tests || null,
      lint: config.lint || null,
      security: config.security || null,

      pre_push_checks: config.pre_push_checks || [],

      safety: {
        max_cost_per_task: config.safety?.max_cost_per_task || parseFloat(process.env.DEFAULT_MAX_COST || '5.00'),
        allow_dependency_changes: config.safety?.allow_dependency_changes || false,
        require_manual_review: config.safety?.require_manual_review || false,
        backup_before_changes: config.safety?.backup_before_changes || false
      },

      notifications: config.notifications || {
        on_complete: false,
        on_error: true,
        email: null
      }
    };
  }

  /**
   * Check if repo URL is valid
   * @param {string} repo - Repository URL
   * @returns {boolean}
   */
  isValidRepoUrl(repo) {
    // Allow 'local' as a special value
    if (repo === 'local') {
      return true;
    }

    const patterns = [
      /^github\.com\/[\w-]+\/[\w-]+$/,                      // github.com/owner/repo
      /^https:\/\/github\.com\/[\w-]+\/[\w-]+(\.git)?$/,   // https://github.com/owner/repo(.git)
      /^git@github\.com:[\w-]+\/[\w-]+(\.git)?$/           // git@github.com:owner/repo(.git)
    ];

    return patterns.some(pattern => pattern.test(repo));
  }

  /**
   * Check if memory format is valid
   * @param {string} memory - Memory string (e.g., "4g", "512m")
   * @returns {boolean}
   */
  isValidMemoryFormat(memory) {
    return /^\d+[bkmg]$/i.test(memory);
  }

  /**
   * List all available project configurations
   * @returns {Promise<Array<string>>} - List of project names
   */
  async listProjects() {
    try {
      const files = await fs.readdir(this.configDir);
      return files
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => f.replace(/\.(yaml|yml)$/, ''));
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Config directory doesn't exist yet
        return [];
      }
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  /**
   * Check if a project configuration exists
   * @param {string} projectName - Name of the project
   * @returns {Promise<boolean>}
   */
  async exists(projectName) {
    const configPath = path.join(this.configDir, `${projectName}.yaml`);
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new project configuration
   * @param {string} projectName - Name of the project
   * @param {Object} config - Configuration object
   */
  async create(projectName, config) {
    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    const configPath = path.join(this.configDir, `${projectName}.yaml`);

    // Check if config already exists
    if (await this.exists(projectName)) {
      throw new Error(`Project configuration already exists: ${projectName}`);
    }

    // Validate before saving
    this.validate(config);

    // Convert to YAML and save
    const yaml = this.toYaml(config);
    await fs.writeFile(configPath, yaml, 'utf-8');

    return configPath;
  }

  /**
   * Update an existing project configuration
   * @param {string} projectName - Name of the project
   * @param {Object} updates - Partial config updates
   */
  async update(projectName, updates) {
    // Load existing config
    const config = await this.load(projectName);

    // Merge updates
    const merged = this.deepMerge(config, updates);

    // Validate merged config
    this.validate(merged);

    // Save
    const configPath = path.join(this.configDir, `${projectName}.yaml`);
    const yaml = this.toYaml(merged);
    await fs.writeFile(configPath, yaml, 'utf-8');

    return merged;
  }

  /**
   * Delete a project configuration
   * @param {string} projectName - Name of the project
   */
  async delete(projectName) {
    const configPath = path.join(this.configDir, `${projectName}.yaml`);

    try {
      await fs.unlink(configPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Project configuration not found: ${projectName}`);
      }
      throw error;
    }
  }

  /**
   * Convert config object to YAML string
   * @param {Object} config - Configuration object
   * @returns {string} - YAML string
   */
  toYaml(config) {
    // Manual YAML formatting for better readability
    let yaml = `# Claude Multi-Agent Coding System - Project Configuration\n\n`;
    yaml += `name: ${config.name}\n`;
    yaml += `repo: ${config.repo}\n`;
    yaml += `base_branch: ${config.base_branch}\n\n`;

    if (config.protected_branches && config.protected_branches.length > 0) {
      yaml += `protected_branches:\n`;
      config.protected_branches.forEach(b => {
        yaml += `  - ${b}\n`;
      });
      yaml += `\n`;
    }

    yaml += `# PR Settings\n`;
    yaml += `requires_pr: ${config.requires_pr || true}\n`;
    yaml += `auto_merge: ${config.auto_merge || false}\n`;
    yaml += `require_pr_approval: ${config.require_pr_approval !== undefined ? config.require_pr_approval : true}\n\n`;

    yaml += `# Docker Configuration\n`;
    yaml += `docker:\n`;
    yaml += `  image: ${config.docker.image}\n`;
    yaml += `  memory: ${config.docker.memory || '4g'}\n`;
    yaml += `  cpus: ${config.docker.cpus || 2}\n`;
    yaml += `  network_mode: ${config.docker.network_mode || 'none'}\n\n`;

    if (config.tests) {
      yaml += `# Testing\n`;
      yaml += `tests:\n`;
      yaml += `  command: ${config.tests.command}\n`;
      if (config.tests.coverage_required) {
        yaml += `  coverage_required: ${config.tests.coverage_required}\n`;
        yaml += `  min_coverage: ${config.tests.min_coverage || 80}\n`;
      }
      yaml += `\n`;
    }

    if (config.lint) {
      yaml += `# Linting\n`;
      yaml += `lint:\n`;
      yaml += `  command: ${config.lint.command}\n`;
      yaml += `  required: ${config.lint.required || true}\n\n`;
    }

    yaml += `# Safety Settings\n`;
    yaml += `safety:\n`;
    yaml += `  max_cost_per_task: ${config.safety?.max_cost_per_task || 5.00}\n`;
    yaml += `  allow_dependency_changes: ${config.safety?.allow_dependency_changes || false}\n`;
    yaml += `  require_manual_review: ${config.safety?.require_manual_review || false}\n`;
    yaml += `  backup_before_changes: ${config.safety?.backup_before_changes || false}\n`;

    return yaml;
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} - Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}
