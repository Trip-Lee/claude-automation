/**
 * GlobalConfig - Centralized configuration management for Claude Automation
 *
 * Provides a single source of truth for all system paths and settings.
 * Allows user customization while providing sensible defaults.
 *
 * Config file location: ~/.claude-automation/config.json
 */

import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

class GlobalConfig {
  constructor() {
    this.configFile = join(homedir(), '.claude-automation', 'config.json');
    this.config = null;
    this.defaults = {
      // Directory paths
      configDir: join(homedir(), '.claude-projects'),
      tasksDir: join(homedir(), '.claude-tasks'),
      logsDir: join(homedir(), '.claude-logs'),
      projectsDir: join(homedir(), 'projects'),

      // File paths
      envFile: join(homedir(), '.env'),

      // Docker defaults
      docker: {
        defaultMemory: '4g',
        defaultCpus: 2
      },

      // Safety defaults
      safety: {
        maxCostPerTask: 5.00
      },

      // Background execution
      maxParallelTasks: 10,

      // Installation info
      installPath: process.cwd(),
      installedAt: new Date().toISOString(),
      version: '0.13.0'
    };

    this.load();
  }

  /**
   * Load configuration from file, or create with defaults
   */
  load() {
    try {
      if (existsSync(this.configFile)) {
        const content = readFileSync(this.configFile, 'utf8');
        this.config = JSON.parse(content);

        // Merge with defaults for any missing keys
        this.config = { ...this.defaults, ...this.config };
      } else {
        // First run - use defaults
        this.config = { ...this.defaults };
      }
    } catch (error) {
      console.warn(`Warning: Could not load global config: ${error.message}`);
      console.warn('Using default configuration');
      this.config = { ...this.defaults };
    }
  }

  /**
   * Save current configuration to file
   */
  save() {
    try {
      // Ensure config directory exists
      const configDir = join(homedir(), '.claude-automation');
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      writeFileSync(
        this.configFile,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      console.error(`Failed to save global config: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a configuration value
   * @param {string} key - Dot-notation key (e.g., 'docker.defaultMemory')
   * @returns {*} Configuration value
   */
  get(key) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a configuration value
   * @param {string} key - Dot-notation key (e.g., 'docker.defaultMemory')
   * @param {*} value - Value to set
   */
  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;

    // Navigate to the parent object
    for (const k of keys) {
      if (!(k in target)) {
        target[k] = {};
      }
      target = target[k];
    }

    target[lastKey] = value;
  }

  /**
   * Ensure all required directories exist
   * @returns {Object} Status of directory creation
   */
  ensureDirectories() {
    const dirs = [
      this.config.configDir,
      this.config.tasksDir,
      this.config.logsDir,
      this.config.projectsDir,
      join(this.config.logsDir, 'costs')
    ];

    const results = {
      created: [],
      existing: [],
      failed: []
    };

    for (const dir of dirs) {
      try {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
          results.created.push(dir);
        } else {
          results.existing.push(dir);
        }
      } catch (error) {
        results.failed.push({ dir, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get the installation directory (where claude-automation is installed)
   * @returns {string} Installation directory path
   */
  getInstallPath() {
    return this.config.installPath;
  }

  /**
   * Update installation info
   * @param {Object} info - Installation information
   */
  updateInstallInfo(info) {
    this.config = { ...this.config, ...info };
    this.save();
  }

  /**
   * Export configuration for display
   * @returns {Object} Current configuration
   */
  toJSON() {
    return this.config;
  }

  /**
   * Create example config file
   * @param {string} filepath - Path to create example config
   */
  static createExample(filepath) {
    const example = {
      _comment: "Claude Automation Global Configuration",
      _instructions: "Customize paths below or use defaults",

      configDir: "~/.claude-projects",
      tasksDir: "~/.claude-tasks",
      logsDir: "~/.claude-logs",
      projectsDir: "~/projects",
      envFile: "~/.env",

      docker: {
        defaultMemory: "4g",
        defaultCpus: 2,
        _note: "These can be overridden per-project"
      },

      safety: {
        maxCostPerTask: 5.00,
        _note: "Maximum cost per task in USD"
      },

      maxParallelTasks: 10,
      _maxParallelTasksNote: "Maximum number of background tasks that can run simultaneously"
    };

    writeFileSync(filepath, JSON.stringify(example, null, 2), 'utf8');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the global configuration instance
 * @returns {GlobalConfig} Global configuration instance
 */
export function getGlobalConfig() {
  if (!instance) {
    instance = new GlobalConfig();
  }
  return instance;
}

/**
 * Create a new configuration instance (for testing)
 * @returns {GlobalConfig} New configuration instance
 */
export function createGlobalConfig() {
  return new GlobalConfig();
}

export default GlobalConfig;
