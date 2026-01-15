#!/usr/bin/env node

/**
 * Unit Tests for TaskDecomposer
 * Tests task analysis, parallelization validation, and conflict detection
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { TaskDecomposer } from '../../lib/task-decomposer.js';

describe('TaskDecomposer - Initialization', () => {
  it('should initialize with architect agent', () => {
    const mockArchitect = { query: async () => '{}' };
    const decomposer = new TaskDecomposer(mockArchitect);

    assert.ok(decomposer);
    assert.ok(decomposer.architect);
    assert.equal(decomposer.minPartsForParallel, 2);
    assert.equal(decomposer.maxPartsForParallel, 5);
    assert.equal(decomposer.minComplexityThreshold, 3);
  });
});

describe('TaskDecomposer - File Conflict Detection', () => {
  let decomposer;

  before(() => {
    const mockArchitect = { query: async () => '{}' };
    decomposer = new TaskDecomposer(mockArchitect);
  });

  it('should detect no conflicts when files are different', () => {
    const parts = [
      { files: ['src/file1.js', 'src/file2.js'] },
      { files: ['src/file3.js', 'src/file4.js'] }
    ];

    const conflict = decomposer.detectFileConflicts(parts);
    assert.equal(conflict, null);
  });

  it('should detect conflict when same file appears in multiple parts', () => {
    const parts = [
      { files: ['src/file1.js', 'src/common.js'] },
      { files: ['src/file2.js', 'src/common.js'] }
    ];

    const conflict = decomposer.detectFileConflicts(parts);
    assert.ok(conflict);
    assert.equal(conflict.file, 'src/common.js');
    assert.deepEqual(conflict.parts, [1, 2]);
  });

  it('should handle case-insensitive file paths', () => {
    const parts = [
      { files: ['src/File.js'] },
      { files: ['src/file.js'] }
    ];

    const conflict = decomposer.detectFileConflicts(parts);
    assert.ok(conflict);
  });

  it('should handle empty file arrays', () => {
    const parts = [
      { files: [] },
      { files: [] }
    ];

    const conflict = decomposer.detectFileConflicts(parts);
    assert.equal(conflict, null);
  });

  it('should trim whitespace in file paths', () => {
    const parts = [
      { files: ['  src/file.js  '] },
      { files: ['src/file.js'] }
    ];

    const conflict = decomposer.detectFileConflicts(parts);
    assert.ok(conflict);
  });
});

describe('TaskDecomposer - Circular Dependency Detection', () => {
  let decomposer;

  before(() => {
    const mockArchitect = { query: async () => '{}' };
    decomposer = new TaskDecomposer(mockArchitect);
  });

  it('should detect no circular dependencies in independent parts', () => {
    const parts = [
      { dependencies: [] },
      { dependencies: [] },
      { dependencies: [] }
    ];

    const circular = decomposer.detectCircularDependencies(parts);
    assert.equal(circular, null);
  });

  it('should detect no circular dependencies in simple chain', () => {
    const parts = [
      { dependencies: [] },
      { dependencies: [0] },
      { dependencies: [1] }
    ];

    const circular = decomposer.detectCircularDependencies(parts);
    assert.equal(circular, null);
  });

  it('should detect simple circular dependency', () => {
    const parts = [
      { dependencies: [1] },
      { dependencies: [0] }
    ];

    const circular = decomposer.detectCircularDependencies(parts);
    assert.ok(circular);
    assert.ok(circular.includes('circular') || circular.includes('cycle'));
  });

  it('should handle parts without dependencies field', () => {
    const parts = [
      {},
      {},
      {}
    ];

    const circular = decomposer.detectCircularDependencies(parts);
    assert.equal(circular, null);
  });
});

describe('TaskDecomposer - Validation', () => {
  let decomposer;

  before(() => {
    const mockArchitect = { query: async () => '{}' };
    decomposer = new TaskDecomposer(mockArchitect);
  });

  it('should reject analysis with invalid format', () => {
    const invalidAnalysis = { foo: 'bar' };

    const result = decomposer.validateAnalysis(invalidAnalysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('Invalid analysis format'));
  });

  it('should respect architect decision to not parallelize', () => {
    const analysis = {
      canParallelize: false,
      reasoning: 'Task too simple',
      parts: [],
      complexity: 2
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.equal(result.reasoning, 'Task too simple');
  });

  it('should reject tasks below complexity threshold', () => {
    const analysis = {
      canParallelize: true,
      complexity: 2,
      reasoning: 'Can parallelize',
      parts: [
        { role: 'coder', description: 'Part 1', files: ['file1.js'], dependencies: [] },
        { role: 'coder', description: 'Part 2', files: ['file2.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('complexity'));
    assert.ok(result.reasoning.includes('threshold'));
  });

  it('should reject tasks with too few parts', () => {
    const analysis = {
      canParallelize: true,
      complexity: 5,
      reasoning: 'Can parallelize',
      parts: [
        { role: 'coder', description: 'Only part', files: ['file1.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('Only 1 parts'));
  });

  it('should reject tasks with too many parts', () => {
    const analysis = {
      canParallelize: true,
      complexity: 8,
      reasoning: 'Can parallelize',
      parts: [
        { role: 'coder', description: 'Part 1', files: ['file1.js'], dependencies: [] },
        { role: 'coder', description: 'Part 2', files: ['file2.js'], dependencies: [] },
        { role: 'coder', description: 'Part 3', files: ['file3.js'], dependencies: [] },
        { role: 'coder', description: 'Part 4', files: ['file4.js'], dependencies: [] },
        { role: 'coder', description: 'Part 5', files: ['file5.js'], dependencies: [] },
        { role: 'coder', description: 'Part 6', files: ['file6.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('Too many parts'));
  });

  it('should reject tasks with file conflicts', () => {
    const analysis = {
      canParallelize: true,
      complexity: 6,
      reasoning: 'Can parallelize',
      parts: [
        { role: 'coder', description: 'Part 1', files: ['common.js', 'file1.js'], dependencies: [] },
        { role: 'coder', description: 'Part 2', files: ['common.js', 'file2.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('File conflict'));
    assert.ok(result.reasoning.includes('common.js'));
  });

  it('should reject tasks with dependencies', () => {
    const analysis = {
      canParallelize: true,
      complexity: 6,
      reasoning: 'Can parallelize',
      parts: [
        { role: 'coder', description: 'Part 1', files: ['file1.js'], dependencies: [] },
        { role: 'coder', description: 'Part 2', files: ['file2.js'], dependencies: [0] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('dependencies'));
  });

  it('should reject parts with missing required fields', () => {
    const analysis = {
      canParallelize: true,
      complexity: 6,
      reasoning: 'Can parallelize',
      parts: [
        { role: 'coder', description: 'Part 1', files: ['file1.js'], dependencies: [] },
        { description: 'Part 2', files: ['file2.js'], dependencies: [] } // Missing role
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('missing required fields'));
  });

  it('should reject parts with invalid role', () => {
    const analysis = {
      canParallelize: true,
      complexity: 6,
      reasoning: 'Can parallelize',
      parts: [
        { role: 'coder', description: 'Part 1', files: ['file1.js'], dependencies: [] },
        { role: 'invalid-role', description: 'Part 2', files: ['file2.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('Invalid role'));
  });

  it('should accept valid parallelizable task', () => {
    const analysis = {
      canParallelize: true,
      complexity: 7,
      reasoning: 'Independent API endpoints',
      parts: [
        { role: 'coder', description: 'Implement /users', files: ['routes/users.js'], dependencies: [] },
        { role: 'coder', description: 'Implement /posts', files: ['routes/posts.js'], dependencies: [] },
        { role: 'tester', description: 'Write tests', files: ['test/api.test.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test task');

    assert.equal(result.canParallelize, true);
    assert.equal(result.parts.length, 3);
  });
});

describe('TaskDecomposer - Summary Generation', () => {
  let decomposer;

  before(() => {
    const mockArchitect = { query: async () => '{}' };
    decomposer = new TaskDecomposer(mockArchitect);
  });

  it('should generate summary for non-parallelizable task', () => {
    const analysis = {
      canParallelize: false,
      reasoning: 'Task too simple'
    };

    const summary = decomposer.getSummary(analysis);

    assert.ok(summary.includes('Sequential execution'));
    assert.ok(summary.includes('Task too simple'));
  });

  it('should generate summary for parallelizable task', () => {
    const analysis = {
      canParallelize: true,
      parts: [
        { role: 'coder', description: 'Implement API endpoint' },
        { role: 'tester', description: 'Write unit tests' }
      ]
    };

    const summary = decomposer.getSummary(analysis);

    assert.ok(summary.includes('Parallel execution'));
    assert.ok(summary.includes('2 parts'));
    assert.ok(summary.includes('coder'));
    assert.ok(summary.includes('tester'));
  });
});

describe('TaskDecomposer - JSON Parsing', () => {
  let decomposer;

  before(() => {
    const mockArchitect = { query: async () => '{}' };
    decomposer = new TaskDecomposer(mockArchitect);
  });

  it('should handle markdown-wrapped JSON', async () => {
    const mockArchitect = {
      query: async () => '```json\n{"canParallelize": false, "parts": [], "complexity": 2}\n```'
    };

    decomposer = new TaskDecomposer(mockArchitect);

    const result = await decomposer.analyzeTask('simple task');

    assert.equal(result.canParallelize, false);
  });

  it('should handle plain JSON', async () => {
    const mockArchitect = {
      query: async () => '{"canParallelize": false, "parts": [], "complexity": 2}'
    };

    decomposer = new TaskDecomposer(mockArchitect);

    const result = await decomposer.analyzeTask('simple task');

    assert.equal(result.canParallelize, false);
  });

  it('should fallback on parse error', async () => {
    const mockArchitect = {
      query: async () => 'This is not JSON'
    };

    decomposer = new TaskDecomposer(mockArchitect);

    const result = await decomposer.analyzeTask('test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('Analysis failed'));
  });

  it('should fallback on architect query error', async () => {
    const mockArchitect = {
      query: async () => {
        throw new Error('API error');
      }
    };

    decomposer = new TaskDecomposer(mockArchitect);

    const result = await decomposer.analyzeTask('test task');

    assert.equal(result.canParallelize, false);
    assert.ok(result.reasoning.includes('Analysis failed'));
    assert.ok(result.reasoning.includes('API error'));
  });
});

describe('TaskDecomposer - Role Validation', () => {
  let decomposer;

  before(() => {
    const mockArchitect = { query: async () => '{}' };
    decomposer = new TaskDecomposer(mockArchitect);
  });

  it('should accept coder role', () => {
    const analysis = {
      canParallelize: true,
      complexity: 5,
      parts: [
        { role: 'coder', description: 'Code part', files: ['file1.js'], dependencies: [] },
        { role: 'coder', description: 'Code part 2', files: ['file2.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test');
    assert.equal(result.canParallelize, true);
  });

  it('should accept tester role', () => {
    const analysis = {
      canParallelize: true,
      complexity: 5,
      parts: [
        { role: 'tester', description: 'Test part', files: ['test1.js'], dependencies: [] },
        { role: 'tester', description: 'Test part 2', files: ['test2.js'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test');
    assert.equal(result.canParallelize, true);
  });

  it('should accept documenter role', () => {
    const analysis = {
      canParallelize: true,
      complexity: 5,
      parts: [
        { role: 'documenter', description: 'Doc part', files: ['doc1.md'], dependencies: [] },
        { role: 'documenter', description: 'Doc part 2', files: ['doc2.md'], dependencies: [] }
      ]
    };

    const result = decomposer.validateAnalysis(analysis, 'test');
    assert.equal(result.canParallelize, true);
  });
});

console.log('\n✅ TaskDecomposer unit tests completed\n');
