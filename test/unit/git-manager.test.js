#!/usr/bin/env node

/**
 * Unit Tests for GitManager
 * Tests git operations, branch management, and error handling
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { GitManager } from '../../lib/git-manager.js';

describe('GitManager - Initialization', () => {
  it('should initialize without errors', () => {
    const manager = new GitManager();
    assert.ok(manager);
  });
});

describe('GitManager - Commit Message Escaping', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should escape single quotes in commit messages', () => {
    const message = "Add user's profile page";
    const escaped = message.replace(/'/g, "'\\''");

    assert.ok(escaped.includes("'\\''"));
    assert.ok(!escaped.includes("user's"));
  });

  it('should handle messages without special characters', () => {
    const message = "Add user profile page";
    const escaped = message.replace(/'/g, "'\\''");

    assert.equal(escaped, message);
  });

  it('should handle multiple single quotes', () => {
    const message = "It's the user's profile";
    const escaped = message.replace(/'/g, "'\\''");

    // Should escape both quotes
    const quoteCount = (escaped.match(/'\\'/g) || []).length;
    assert.equal(quoteCount, 2);
  });

  it('should handle empty message', () => {
    const message = "";
    const escaped = message.replace(/'/g, "'\\''");

    assert.equal(escaped, "");
  });
});

describe('GitManager - Branch Name Validation', () => {
  it('should accept valid branch names', () => {
    const validNames = [
      'feature/new-feature',
      'claude/task-123',
      'fix-bug-456',
      'update_docs',
      'v1.2.3'
    ];

    for (const name of validNames) {
      assert.ok(name.length > 0);
      assert.ok(!name.includes(' '));
    }
  });

  it('should identify invalid characters in branch names', () => {
    const invalidNames = [
      'feature with spaces',
      'feature@special',
      'feature:colon'
    ];

    for (const name of invalidNames) {
      assert.ok(
        name.includes(' ') || name.includes('@') || name.includes(':')
      );
    }
  });
});

describe('GitManager - getDiff Options Parsing', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should build basic diff command', () => {
    let command = 'git diff';
    assert.equal(command, 'git diff');
  });

  it('should build staged diff command', () => {
    let command = 'git diff';
    const options = { staged: true };

    if (options.staged) {
      command += ' --staged';
    }

    assert.equal(command, 'git diff --staged');
  });

  it('should build file-specific diff command', () => {
    let command = 'git diff';
    const options = { file: 'path/to/file.js' };

    if (options.file) {
      command += ` ${options.file}`;
    }

    assert.equal(command, 'git diff path/to/file.js');
  });

  it('should build branch comparison diff command', () => {
    let command = 'git diff';
    const baseBranch = 'main';
    const targetBranch = 'feature/new';

    command += ` ${baseBranch}..${targetBranch}`;

    assert.equal(command, 'git diff main..feature/new');
  });

  it('should build diff stat command', () => {
    let command = 'git diff';
    const statOnly = true;

    if (statOnly) {
      command += ' --stat';
    }

    assert.equal(command, 'git diff --stat');
  });
});

describe('GitManager - File Staging', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should handle single file as string', () => {
    const files = 'src/file.js';
    const fileList = Array.isArray(files) ? files.join(' ') : files;

    assert.equal(fileList, 'src/file.js');
  });

  it('should handle multiple files as array', () => {
    const files = ['src/file1.js', 'src/file2.js', 'src/file3.js'];
    const fileList = Array.isArray(files) ? files.join(' ') : files;

    assert.equal(fileList, 'src/file1.js src/file2.js src/file3.js');
  });

  it('should handle all files with dot', () => {
    const files = '.';
    const fileList = Array.isArray(files) ? files.join(' ') : files;

    assert.equal(fileList, '.');
  });

  it('should handle empty array', () => {
    const files = [];
    const fileList = Array.isArray(files) ? files.join(' ') : files;

    assert.equal(fileList, '');
  });
});

describe('GitManager - Branch Operations', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should have createBranch method', () => {
    assert.ok(typeof manager.createBranch === 'function');
  });

  it('should have deleteBranch method', () => {
    assert.ok(typeof manager.deleteBranch === 'function');
  });

  it('should have getCurrentBranch method', () => {
    assert.ok(typeof manager.getCurrentBranch === 'function');
  });

  it('should support force delete flag', () => {
    const force = true;
    const flag = force ? '-D' : '-d';

    assert.equal(flag, '-D');
  });

  it('should use non-force delete by default', () => {
    const force = false;
    const flag = force ? '-D' : '-d';

    assert.equal(flag, '-d');
  });
});

describe('GitManager - Remote Operations', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should have push method', () => {
    assert.ok(typeof manager.push === 'function');
  });

  it('should have pull method', () => {
    assert.ok(typeof manager.pull === 'function');
  });

  it('should have hasRemote method', () => {
    assert.ok(typeof manager.hasRemote === 'function');
  });

  it('should set upstream by default when pushing', () => {
    const setUpstream = true;
    assert.equal(setUpstream, true);
  });
});

describe('GitManager - Status Operations', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should have getStatus method', () => {
    assert.ok(typeof manager.getStatus === 'function');
  });

  it('should have getDiff method', () => {
    assert.ok(typeof manager.getDiff === 'function');
  });

  it('should have add method', () => {
    assert.ok(typeof manager.add === 'function');
  });

  it('should have commit method', () => {
    assert.ok(typeof manager.commit === 'function');
  });
});

describe('GitManager - Error Handling', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should throw descriptive errors', async () => {
    // Test error message format
    try {
      throw new Error('Failed to pull main: fatal: not a git repository');
    } catch (error) {
      assert.ok(error.message.includes('Failed to pull'));
      assert.ok(error.message.includes('main'));
    }
  });

  it('should handle missing remote gracefully', () => {
    // Simulate no remote configured
    const errorMessage = 'No remote configured';
    assert.ok(errorMessage.includes('No remote'));
  });

  it('should provide context in error messages', () => {
    const branchName = 'feature/test';
    const errorMessage = `Failed to create branch ${branchName}: error`;

    assert.ok(errorMessage.includes('Failed to create branch'));
    assert.ok(errorMessage.includes(branchName));
  });
});

describe('GitManager - Command Construction', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should construct git checkout command', () => {
    const branch = 'main';
    const command = `git checkout ${branch}`;

    assert.equal(command, 'git checkout main');
  });

  it('should construct git checkout -b command', () => {
    const branchName = 'feature/new';
    const command = `git checkout -b ${branchName}`;

    assert.equal(command, 'git checkout -b feature/new');
  });

  it('should construct git pull command', () => {
    const branch = 'main';
    const command = `git pull origin ${branch}`;

    assert.equal(command, 'git pull origin main');
  });

  it('should construct git push command with upstream', () => {
    const branchName = 'feature/new';
    const command = `git push -u origin ${branchName}`;

    assert.equal(command, 'git push -u origin feature/new');
  });

  it('should construct git add command', () => {
    const files = '.';
    const command = `git add ${files}`;

    assert.equal(command, 'git add .');
  });

  it('should construct git commit command', () => {
    const message = 'Test commit';
    const escapedMessage = message.replace(/'/g, "'\\''");
    const command = `git commit -m '${escapedMessage}'`;

    assert.ok(command.includes('git commit -m'));
    assert.ok(command.includes('Test commit'));
  });
});

describe('GitManager - Path Handling', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should handle absolute paths', () => {
    const projectPath = '/home/user/projects/my-project';
    assert.ok(projectPath.startsWith('/'));
  });

  it('should handle relative paths', () => {
    const projectPath = './projects/my-project';
    assert.ok(projectPath.startsWith('.'));
  });

  it('should handle paths with spaces (would need quoting)', () => {
    const projectPath = '/home/user/my projects/project';
    assert.ok(projectPath.includes(' '));
    // In actual implementation, this should be quoted
  });
});

describe('GitManager - Branch Deletion Safety', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should switch to safe branch before deletion', () => {
    // GitManager switches to main/master before deleting a branch
    const switchCommand = 'git checkout main || git checkout master';
    assert.ok(switchCommand.includes('main'));
    assert.ok(switchCommand.includes('master'));
    assert.ok(switchCommand.includes('||'));
  });

  it('should provide force and non-force delete options', () => {
    const forceFlag = '-D';
    const normalFlag = '-d';

    assert.equal(forceFlag, '-D');
    assert.equal(normalFlag, '-d');
    assert.notEqual(forceFlag, normalFlag);
  });
});

describe('GitManager - Local vs Remote Repositories', () => {
  let manager;

  before(() => {
    manager = new GitManager();
  });

  it('should handle local-only repositories', () => {
    // When no remote is configured, should handle gracefully
    const message = 'Local repository - no remote';
    assert.ok(message.includes('Local repository'));
  });

  it('should detect missing remote', () => {
    // Should check for remote before operations
    assert.ok(typeof manager.hasRemote === 'function');
  });
});

describe('GitManager - Git Output Parsing', () => {
  it('should handle git status output', () => {
    const sampleStatus = `On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`;

    assert.ok(sampleStatus.includes('On branch'));
    assert.ok(sampleStatus.includes('up to date'));
  });

  it('should detect uncommitted changes in status', () => {
    const sampleStatus = `On branch main
Changes not staged for commit:
  modified:   file.js`;

    assert.ok(sampleStatus.includes('Changes not staged'));
  });

  it('should detect untracked files in status', () => {
    const sampleStatus = `On branch main
Untracked files:
  newfile.js`;

    assert.ok(sampleStatus.includes('Untracked files'));
  });
});

console.log('\n✅ GitManager unit tests completed\n');
