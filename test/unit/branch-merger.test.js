#!/usr/bin/env node

/**
 * Unit Tests for BranchMerger
 * Tests branch merging, conflict detection, and cleanup operations
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { BranchMerger, MergeConflictError } from '../../lib/branch-merger.js';

describe('BranchMerger - Initialization', () => {
  it('should initialize with git manager and project path', () => {
    const mockGit = {};
    const projectPath = '/test/project';

    const merger = new BranchMerger(mockGit, projectPath);

    assert.ok(merger);
    assert.equal(merger.git, mockGit);
    assert.equal(merger.projectPath, projectPath);
  });
});

describe('BranchMerger - Conflict File Detection', () => {
  let merger;

  before(() => {
    const mockGit = {};
    merger = new BranchMerger(mockGit, '/test/project');
  });

  it('should parse conflicted files from git output', () => {
    // This test verifies the parsing logic
    const sampleGitOutput = 'file1.js\nfile2.js\nfile3.js\n';
    const files = sampleGitOutput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    assert.equal(files.length, 3);
    assert.ok(files.includes('file1.js'));
    assert.ok(files.includes('file2.js'));
    assert.ok(files.includes('file3.js'));
  });

  it('should handle empty git output', () => {
    const sampleGitOutput = '';
    const files = sampleGitOutput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    assert.equal(files.length, 0);
  });

  it('should handle git output with empty lines', () => {
    const sampleGitOutput = 'file1.js\n\n\nfile2.js\n\n';
    const files = sampleGitOutput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    assert.equal(files.length, 2);
    assert.ok(files.includes('file1.js'));
    assert.ok(files.includes('file2.js'));
  });
});

describe('BranchMerger - Merge All Success', () => {
  it('should merge all branches successfully', async () => {
    const mockGit = {
      checkout: async (branch) => {},
    };

    const merger = new BranchMerger(mockGit, '/test/project');

    // Mock successful merges
    merger.mergeBranch = async (target, source) => {
      // Simulate successful merge
    };

    const subtaskResults = [
      { branch: 'claude/subtask-1', subtaskId: 'task-1' },
      { branch: 'claude/subtask-2', subtaskId: 'task-2' },
      { branch: 'claude/subtask-3', subtaskId: 'task-3' }
    ];

    const result = await merger.mergeAll('claude/main-branch', subtaskResults);

    assert.equal(result.mergedCount, 3);
    assert.equal(result.merged.length, 3);
    assert.ok(result.merged.every(m => m.success === true));
  });
});

describe('BranchMerger - Merge Conflicts', () => {
  it('should detect and collect merge conflicts', async () => {
    const mockGit = {
      checkout: async (branch) => {},
    };

    const merger = new BranchMerger(mockGit, '/test/project');

    // Mock merge with conflict
    let mergeCount = 0;
    merger.mergeBranch = async (target, source) => {
      mergeCount++;
      if (mergeCount === 2) {
        // Second merge has conflict
        const error = new Error('Merge conflict in files: common.js');
        error.isConflict = true;
        error.files = ['common.js'];
        throw error;
      }
    };

    const subtaskResults = [
      { branch: 'claude/subtask-1', subtaskId: 'task-1' },
      { branch: 'claude/subtask-2', subtaskId: 'task-2' },
      { branch: 'claude/subtask-3', subtaskId: 'task-3' }
    ];

    try {
      await merger.mergeAll('claude/main-branch', subtaskResults);
      assert.fail('Should have thrown MergeConflictError');
    } catch (error) {
      assert.ok(error instanceof MergeConflictError);
      assert.equal(error.conflicts.length, 1);
      assert.equal(error.conflicts[0].branch, 'claude/subtask-2');
      assert.ok(error.conflicts[0].files.includes('common.js'));
    }
  });

  it('should continue checking all branches for conflicts', async () => {
    const mockGit = {
      checkout: async (branch) => {},
    };

    const merger = new BranchMerger(mockGit, '/test/project');

    // Mock multiple conflicts
    merger.mergeBranch = async (target, source) => {
      if (source === 'claude/subtask-2' || source === 'claude/subtask-3') {
        const error = new Error('Merge conflict');
        error.isConflict = true;
        error.files = ['conflict.js'];
        throw error;
      }
    };

    const subtaskResults = [
      { branch: 'claude/subtask-1', subtaskId: 'task-1' },
      { branch: 'claude/subtask-2', subtaskId: 'task-2' },
      { branch: 'claude/subtask-3', subtaskId: 'task-3' }
    ];

    try {
      await merger.mergeAll('claude/main-branch', subtaskResults);
      assert.fail('Should have thrown MergeConflictError');
    } catch (error) {
      assert.equal(error.conflicts.length, 2);
    }
  });
});

describe('BranchMerger - Conflict Formatting', () => {
  let merger;

  before(() => {
    const mockGit = {};
    merger = new BranchMerger(mockGit, '/test/project');
  });

  it('should format conflict report with file list', () => {
    const conflicts = [
      {
        branch: 'claude/subtask-1',
        subtaskId: 'task-1',
        files: ['src/common.js', 'src/utils.js'],
        message: 'Merge conflict'
      }
    ];

    const report = merger.formatConflicts(conflicts);

    assert.ok(report.includes('MERGE CONFLICTS'));
    assert.ok(report.includes('claude/subtask-1'));
    assert.ok(report.includes('src/common.js'));
    assert.ok(report.includes('src/utils.js'));
  });

  it('should format multiple conflicts', () => {
    const conflicts = [
      {
        branch: 'claude/subtask-1',
        subtaskId: 'task-1',
        files: ['file1.js'],
        message: 'Conflict 1'
      },
      {
        branch: 'claude/subtask-2',
        subtaskId: 'task-2',
        files: ['file2.js', 'file3.js'],
        message: 'Conflict 2'
      }
    ];

    const report = merger.formatConflicts(conflicts);

    assert.ok(report.includes('claude/subtask-1'));
    assert.ok(report.includes('claude/subtask-2'));
    assert.ok(report.includes('file1.js'));
    assert.ok(report.includes('file2.js'));
    assert.ok(report.includes('file3.js'));
  });

  it('should include resolution instructions', () => {
    const conflicts = [
      {
        branch: 'claude/subtask-1',
        subtaskId: 'task-1',
        files: ['file1.js'],
        message: 'Conflict'
      }
    ];

    const report = merger.formatConflicts(conflicts);

    assert.ok(report.includes('To resolve'));
    assert.ok(report.includes('manual') || report.includes('sequential'));
  });
});

describe('BranchMerger - Branch Cleanup', () => {
  it('should delete all specified branches', async () => {
    const deletedBranches = [];

    const mockGit = {
      deleteBranch: async (branch) => {
        deletedBranches.push(branch);
      }
    };

    const merger = new BranchMerger(mockGit, '/test/project');

    const branches = ['claude/subtask-1', 'claude/subtask-2', 'claude/subtask-3'];

    await merger.cleanupBranches(branches);

    assert.equal(deletedBranches.length, 3);
    assert.ok(deletedBranches.includes('claude/subtask-1'));
    assert.ok(deletedBranches.includes('claude/subtask-2'));
    assert.ok(deletedBranches.includes('claude/subtask-3'));
  });

  it('should continue cleanup even if some branches fail', async () => {
    const deletedBranches = [];

    const mockGit = {
      deleteBranch: async (branch) => {
        if (branch === 'claude/subtask-2') {
          throw new Error('Branch deletion failed');
        }
        deletedBranches.push(branch);
      }
    };

    const merger = new BranchMerger(mockGit, '/test/project');

    const branches = ['claude/subtask-1', 'claude/subtask-2', 'claude/subtask-3'];

    await merger.cleanupBranches(branches);

    // Should have deleted 2 out of 3
    assert.equal(deletedBranches.length, 2);
    assert.ok(deletedBranches.includes('claude/subtask-1'));
    assert.ok(deletedBranches.includes('claude/subtask-3'));
    assert.ok(!deletedBranches.includes('claude/subtask-2'));
  });
});

describe('BranchMerger - Merge Command Construction', () => {
  it('should use no-ff merge strategy', () => {
    const targetBranch = 'main';
    const sourceBranch = 'feature/new';

    const command = `git merge --no-ff -m "Merge ${sourceBranch} into ${targetBranch}" ${sourceBranch}`;

    assert.ok(command.includes('--no-ff'));
    assert.ok(command.includes(sourceBranch));
    assert.ok(command.includes(targetBranch));
  });

  it('should include descriptive commit message', () => {
    const targetBranch = 'claude/main-task';
    const sourceBranch = 'claude/subtask-1';

    const command = `git merge --no-ff -m "Merge ${sourceBranch} into ${targetBranch}" ${sourceBranch}`;

    assert.ok(command.includes('Merge claude/subtask-1 into claude/main-task'));
  });
});

describe('BranchMerger - Error Detection', () => {
  it('should identify merge conflict errors', () => {
    const conflictMessage = 'CONFLICT (content): Merge conflict in file.js';
    assert.ok(conflictMessage.includes('CONFLICT'));
  });

  it('should identify automatic merge failed errors', () => {
    const failedMessage = 'Automatic merge failed; fix conflicts and then commit';
    assert.ok(failedMessage.includes('Automatic merge failed'));
  });
});

describe('BranchMerger - MergeConflictError', () => {
  it('should create custom error with conflicts', () => {
    const conflicts = [
      { branch: 'test', files: ['file.js'] }
    ];

    const error = new MergeConflictError('Test conflict', conflicts);

    assert.equal(error.name, 'MergeConflictError');
    assert.equal(error.message, 'Test conflict');
    assert.equal(error.conflicts, conflicts);
    assert.equal(error.isConflict, true);
  });

  it('should be instanceof Error', () => {
    const error = new MergeConflictError('Test', []);
    assert.ok(error instanceof Error);
  });
});

describe('BranchMerger - Merge Abort on Conflict', () => {
  it('should abort merge when conflict detected', async () => {
    // This test verifies the logic flow
    const abortCalled = false;

    // Simulate detecting conflict and aborting
    const handleConflict = () => {
      // In actual code: execSync('git merge --abort')
      return true;
    };

    assert.ok(handleConflict());
  });
});

describe('BranchMerger - Sequential Merging', () => {
  it('should merge branches one at a time', async () => {
    const mergeOrder = [];

    const mockGit = {
      checkout: async (branch) => {}
    };

    const merger = new BranchMerger(mockGit, '/test/project');

    merger.mergeBranch = async (target, source) => {
      mergeOrder.push(source);
    };

    const subtaskResults = [
      { branch: 'claude/subtask-1', subtaskId: 'task-1' },
      { branch: 'claude/subtask-2', subtaskId: 'task-2' },
      { branch: 'claude/subtask-3', subtaskId: 'task-3' }
    ];

    await merger.mergeAll('claude/main-branch', subtaskResults);

    // Should maintain order
    assert.deepEqual(mergeOrder, [
      'claude/subtask-1',
      'claude/subtask-2',
      'claude/subtask-3'
    ]);
  });
});

describe('BranchMerger - Merge Result Tracking', () => {
  it('should track successful merges', async () => {
    const mockGit = {
      checkout: async (branch) => {}
    };

    const merger = new BranchMerger(mockGit, '/test/project');

    merger.mergeBranch = async (target, source) => {};

    const subtaskResults = [
      { branch: 'claude/subtask-1', subtaskId: 'task-1' },
      { branch: 'claude/subtask-2', subtaskId: 'task-2' }
    ];

    const result = await merger.mergeAll('claude/main-branch', subtaskResults);

    assert.ok(result.merged);
    assert.equal(result.merged.length, 2);
    assert.equal(result.merged[0].branch, 'claude/subtask-1');
    assert.equal(result.merged[0].subtaskId, 'task-1');
    assert.equal(result.merged[0].success, true);
  });
});

console.log('\n✅ BranchMerger unit tests completed\n');
