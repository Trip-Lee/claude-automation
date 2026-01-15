#!/usr/bin/env node

/**
 * Unit Tests for ConfigManager
 * Tests configuration loading, validation, and default application
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigManager } from '../../lib/config-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { homedir } from 'os';

// Use a test-specific config directory
const TEST_CONFIG_DIR = path.join(homedir(), '.claude-projects-test');

describe('ConfigManager - Initialization', () => {
  it('should initialize with config directory', () => {
    const manager = new ConfigManager();
    assert.ok(manager.configDir);
  });
});

describe('ConfigManager - Validation', () => {
  let manager;

  before(() => {
    manager = new ConfigManager();
  });

  it('should validate config with all required fields', () => {
    const validConfig = {
      name: 'test-project',
      repo: 'github.com/user/test-project',
      base_branch: 'main',
      docker: {
        image: 'claude-python:latest'
      }
    };

    // Should not throw
    manager.validate(validConfig);
  });

  it('should throw error for missing name', () => {
    const invalidConfig = {
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /Missing required field.*name/
    );
  });

  it('should throw error for missing repo', () => {
    const invalidConfig = {
      name: 'test-project',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /Missing required field.*repo/
    );
  });

  it('should throw error for missing base_branch', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'github.com/user/test',
      docker: { image: 'claude-python:latest' }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /Missing required field.*base_branch/
    );
  });

  it('should throw error for missing docker', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main'
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /Missing required field.*docker/
    );
  });

  it('should throw error for missing docker.image', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: {}
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /Missing required field.*docker\.image/
    );
  });

  it('should allow local as repo value', () => {
    const config = {
      name: 'test-project',
      repo: 'local',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    // Should not throw
    manager.validate(config);
  });

  it('should throw error for invalid repo URL', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'invalid-url',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /Invalid repo URL/
    );
  });

  it('should throw error for empty base_branch', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: '',
      docker: { image: 'claude-python:latest' }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      (err) => {
        return err.message.includes('base_branch') || err.message.includes('Missing required field');
      }
    );
  });

  it('should throw error for invalid memory format', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: {
        image: 'claude-python:latest',
        memory: 'invalid'
      }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /Invalid memory format/
    );
  });

  it('should throw error for negative cpus', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: {
        image: 'claude-python:latest',
        cpus: -1
      }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /docker\.cpus must be a positive number/
    );
  });

  it('should throw error for negative max_cost_per_task', () => {
    const invalidConfig = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' },
      safety: {
        max_cost_per_task: -5.0
      }
    };

    assert.throws(
      () => manager.validate(invalidConfig),
      /max_cost_per_task must be a non-negative number/
    );
  });
});

describe('ConfigManager - Default Application', () => {
  let manager;

  before(() => {
    manager = new ConfigManager();
  });

  it('should apply default protected branches', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.ok(Array.isArray(withDefaults.protected_branches));
    assert.ok(withDefaults.protected_branches.includes('main'));
    assert.ok(withDefaults.protected_branches.includes('master'));
    assert.ok(withDefaults.protected_branches.includes('develop'));
  });

  it('should preserve custom protected branches', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' },
      protected_branches: ['production', 'staging']
    };

    const withDefaults = manager.applyDefaults(config);

    assert.deepEqual(withDefaults.protected_branches, ['production', 'staging']);
  });

  it('should apply default docker memory', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.ok(withDefaults.docker.memory);
    assert.match(withDefaults.docker.memory, /^\d+[gmk]$/i);
  });

  it('should preserve custom docker memory', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: {
        image: 'claude-python:latest',
        memory: '8g'
      }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.equal(withDefaults.docker.memory, '8g');
  });

  it('should apply default docker cpus', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.ok(typeof withDefaults.docker.cpus === 'number');
    assert.ok(withDefaults.docker.cpus > 0);
  });

  it('should apply default network mode', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.equal(withDefaults.docker.network_mode, 'none');
  });

  it('should apply default max_cost_per_task', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.ok(typeof withDefaults.safety.max_cost_per_task === 'number');
    assert.ok(withDefaults.safety.max_cost_per_task > 0);
  });

  it('should apply default requires_pr as true', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.equal(withDefaults.requires_pr, true);
  });

  it('should apply default auto_merge as false', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.equal(withDefaults.auto_merge, false);
  });

  it('should apply default safety settings', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.equal(withDefaults.safety.allow_dependency_changes, false);
    assert.equal(withDefaults.safety.require_manual_review, false);
    assert.equal(withDefaults.safety.backup_before_changes, false);
  });

  it('should preserve custom safety settings', () => {
    const config = {
      name: 'test-project',
      repo: 'github.com/user/test',
      base_branch: 'main',
      docker: { image: 'claude-python:latest' },
      safety: {
        max_cost_per_task: 10.0,
        allow_dependency_changes: true,
        require_manual_review: true
      }
    };

    const withDefaults = manager.applyDefaults(config);

    assert.equal(withDefaults.safety.max_cost_per_task, 10.0);
    assert.equal(withDefaults.safety.allow_dependency_changes, true);
    assert.equal(withDefaults.safety.require_manual_review, true);
  });
});

describe('ConfigManager - URL Validation', () => {
  let manager;

  before(() => {
    manager = new ConfigManager();
  });

  it('should accept github.com/owner/repo format', () => {
    assert.equal(manager.isValidRepoUrl('github.com/user/project'), true);
  });

  it('should accept https://github.com/owner/repo format', () => {
    assert.equal(manager.isValidRepoUrl('https://github.com/user/project'), true);
  });

  it('should accept https://github.com/owner/repo.git format', () => {
    assert.equal(manager.isValidRepoUrl('https://github.com/user/project.git'), true);
  });

  it('should accept git@github.com:owner/repo format', () => {
    assert.equal(manager.isValidRepoUrl('git@github.com:user/project'), true);
  });

  it('should accept git@github.com:owner/repo.git format', () => {
    assert.equal(manager.isValidRepoUrl('git@github.com:user/project.git'), true);
  });

  it('should accept local as special value', () => {
    assert.equal(manager.isValidRepoUrl('local'), true);
  });

  it('should reject invalid URLs', () => {
    assert.equal(manager.isValidRepoUrl('invalid-url'), false);
    assert.equal(manager.isValidRepoUrl('http://example.com/repo'), false);
    assert.equal(manager.isValidRepoUrl('github/user/project'), false);
  });
});

describe('ConfigManager - Memory Format Validation', () => {
  let manager;

  before(() => {
    manager = new ConfigManager();
  });

  it('should accept valid memory formats', () => {
    assert.equal(manager.isValidMemoryFormat('4g'), true);
    assert.equal(manager.isValidMemoryFormat('512m'), true);
    assert.equal(manager.isValidMemoryFormat('1024k'), true);
    assert.equal(manager.isValidMemoryFormat('2G'), true); // Case insensitive
  });

  it('should reject invalid memory formats', () => {
    assert.equal(manager.isValidMemoryFormat('4gb'), false);
    assert.equal(manager.isValidMemoryFormat('invalid'), false);
    assert.equal(manager.isValidMemoryFormat('512'), false);
    assert.equal(manager.isValidMemoryFormat('m512'), false);
  });
});

describe('ConfigManager - List Projects', () => {
  let manager;

  before(async () => {
    manager = new ConfigManager();
    // Override config directory for testing
    manager.configDir = TEST_CONFIG_DIR;

    // Create test config directory
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });

    // Create test config files
    await fs.writeFile(
      path.join(TEST_CONFIG_DIR, 'project1.yaml'),
      'name: project1\nrepo: local\nbase_branch: main\ndocker:\n  image: test:latest'
    );
    await fs.writeFile(
      path.join(TEST_CONFIG_DIR, 'project2.yml'),
      'name: project2\nrepo: local\nbase_branch: main\ndocker:\n  image: test:latest'
    );
    await fs.writeFile(
      path.join(TEST_CONFIG_DIR, 'not-a-config.txt'),
      'not a yaml file'
    );
  });

  after(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should list all YAML config files', async () => {
    const projects = await manager.listProjects();

    assert.ok(Array.isArray(projects));
    assert.ok(projects.includes('project1'));
    assert.ok(projects.includes('project2'));
    assert.ok(!projects.includes('not-a-config'));
  });

  it('should return empty array for non-existent directory', async () => {
    const newManager = new ConfigManager();
    newManager.configDir = path.join(TEST_CONFIG_DIR, 'non-existent');

    const projects = await newManager.listProjects();
    assert.deepEqual(projects, []);
  });
});

describe('ConfigManager - Project Existence Check', () => {
  let manager;

  before(async () => {
    manager = new ConfigManager();
    manager.configDir = TEST_CONFIG_DIR;

    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    await fs.writeFile(
      path.join(TEST_CONFIG_DIR, 'existing-project.yaml'),
      'name: existing\nrepo: local\nbase_branch: main\ndocker:\n  image: test:latest'
    );
  });

  after(async () => {
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should return true for existing project', async () => {
    const exists = await manager.exists('existing-project');
    assert.equal(exists, true);
  });

  it('should return false for non-existent project', async () => {
    const exists = await manager.exists('non-existent-project');
    assert.equal(exists, false);
  });
});

describe('ConfigManager - Error Handling', () => {
  let manager;

  before(() => {
    manager = new ConfigManager();
  });

  it('should throw descriptive error for missing config file', async () => {
    try {
      await manager.load('totally-non-existent-project-999');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Project configuration not found'));
      assert.ok(error.message.includes('totally-non-existent-project-999'));
    }
  });

  it('should provide helpful error messages for validation failures', () => {
    try {
      manager.validate({ name: 'test' }); // Missing required fields
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Missing required field'));
    }
  });
});

console.log('\n✅ ConfigManager unit tests completed\n');
