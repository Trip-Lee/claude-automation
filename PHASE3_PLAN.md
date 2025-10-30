# Phase 3: Parallel Agent Execution - Implementation Plan

## Status: ✅ COMPLETE

## Overview

Transform the orchestrator from linear (one agent at a time) to parallel execution, where multiple agents can work simultaneously on non-overlapping tasks.

**User's Vision:** "If there is a large coding task with 3 separate parts, we spin up 3 coder agents and they all report back to the orchestrator."

## Architecture

### Current State (Linear)
```
Orchestrator → Architect → Coder → Reviewer → Done
     ↓ one at a time
   Single branch, single container
```

### Target State (Parallel)
```
                    ┌─→ Coder Agent 1 (branch: task-123-part1, container 1)
Orchestrator → Decomposer ─→ Coder Agent 2 (branch: task-123-part2, container 2)
     ↓                └─→ Coder Agent 3 (branch: task-123-part3, container 3)
   Aggregator ← ← ← (collect results)
     ↓
   Merger (detect conflicts, merge branches)
     ↓
   Reviewer → Done
```

## Key Components

### 1. Task Decomposer
**Purpose:** Analyze task and break into independent subtasks

**Responsibilities:**
- Consult with architect agent about task decomposition
- Identify non-overlapping work units
- Determine if parallelization is beneficial
- Create subtask specifications

**Decision Logic:**
```javascript
// When to parallelize?
const shouldParallelize = (task) => {
  // Simple tasks: run sequentially
  if (estimatedComplexity < threshold) return false;

  // Ask architect to analyze
  const analysis = await architectAgent.analyzeTask(task);

  // Must have multiple independent parts
  if (analysis.parts.length < 2) return false;

  // Parts must not overlap
  if (analysis.hasConflicts) return false;

  return true;
};
```

### 2. Parallel Agent Manager
**Purpose:** Spawn and coordinate multiple agents simultaneously

**Features:**
- Spawn N agents in parallel (each with unique branch + container)
- Track progress from all agents
- Handle agent failures gracefully
- Aggregate results

**State Tracking:**
```javascript
{
  taskId: 'abc123',
  subtasks: [
    {
      subtaskId: 'abc123-part1',
      description: 'Add user authentication endpoints',
      agentRole: 'coder',
      branchName: 'task-abc123-part1',
      containerId: 'container-xyz1',
      status: 'running',
      progress: 45,
      pid: 12345
    },
    {
      subtaskId: 'abc123-part2',
      description: 'Add frontend login form',
      agentRole: 'coder',
      branchName: 'task-abc123-part2',
      containerId: 'container-xyz2',
      status: 'completed',
      progress: 100,
      result: { filesChanged: [...] }
    }
  ]
}
```

### 3. Per-Agent Isolation
**Purpose:** Each agent works independently without interference

**Implementation:**
- **Branches:** Each agent gets `task-{taskId}-part{N}` branch from base
- **Containers:** Each agent gets dedicated Docker container
- **Logs:** Separate log files per agent
- **State:** Individual state tracking per agent

### 4. Result Aggregator
**Purpose:** Collect and combine results from all agents

**Responsibilities:**
- Wait for all agents to complete (Promise.all)
- Collect results from each agent
- Detect merge conflicts early
- Calculate total cost/duration

### 5. Branch Merger
**Purpose:** Merge all agent branches into main task branch

**Strategy:**
```javascript
// Sequential merge to detect conflicts
const baseBranch = 'task-abc123-main';

for (const subtask of subtasks) {
  try {
    // Merge subtask branch into main branch
    await git.merge(baseBranch, subtask.branchName);
  } catch (conflict) {
    // Handle conflicts
    await handleMergeConflict(conflict, subtask);
  }
}
```

### 6. Enhanced Orchestrator
**Purpose:** Coordinate parallel execution workflow

**New Workflow:**
```javascript
async executeTask(project, description) {
  // 1. Analyze task
  const architect = new Agent('architect');
  const plan = await architect.analyzeTask(description);

  // 2. Decide: parallel or sequential?
  if (!plan.canParallelize || plan.parts.length < 2) {
    // Sequential execution (existing logic)
    return this.executeSequential(project, description);
  }

  // 3. Parallel execution
  return this.executeParallel(project, description, plan);
}

async executeParallel(project, description, plan) {
  // 1. Create main task branch
  const mainBranch = `task-${taskId}-main`;
  await git.createBranch(mainBranch);

  // 2. Spawn agents in parallel
  const agentPromises = plan.parts.map(async (part, index) => {
    const subtaskId = `${taskId}-part${index + 1}`;
    const branchName = `task-${subtaskId}`;

    // Create branch from main task branch
    await git.createBranch(branchName, mainBranch);

    // Spawn agent
    const agent = new Agent(part.role);
    const container = await this.spawnContainer(subtaskId);

    // Execute subtask
    return agent.execute(container, branchName, part.description);
  });

  // 3. Wait for all agents
  const results = await Promise.all(agentPromises);

  // 4. Merge branches
  await this.mergeBranches(mainBranch, results);

  // 5. Run reviewer on combined result
  const reviewer = new Agent('reviewer');
  await reviewer.review(mainBranch);

  return results;
}
```

## Implementation Steps

### Step 1: Create Task Decomposer (1 hour)
**File:** `lib/task-decomposer.js`

```javascript
export class TaskDecomposer {
  constructor(architectAgent) {
    this.architect = architectAgent;
  }

  /**
   * Analyze task and determine if it can be parallelized
   */
  async analyzeTask(description) {
    const prompt = `Analyze this coding task and determine if it can be split into independent parallel subtasks:

Task: ${description}

Respond with JSON:
{
  "canParallelize": boolean,
  "reasoning": "why or why not",
  "parts": [
    {
      "role": "coder|tester|documenter",
      "description": "specific subtask description",
      "files": ["estimated files to modify"],
      "dependencies": ["which other parts this depends on"]
    }
  ]
}

Requirements for parallelization:
- Parts must be truly independent (no file conflicts)
- Each part should be substantial enough to warrant separate agent
- Must have 2-5 parts (not too few, not too many)
`;

    const response = await this.architect.query(prompt);
    const analysis = JSON.parse(response);

    // Validate analysis
    return this.validateAnalysis(analysis);
  }

  /**
   * Validate that parts are truly independent
   */
  validateAnalysis(analysis) {
    if (!analysis.canParallelize) {
      return analysis;
    }

    // Check for file conflicts
    const fileMap = new Map();
    for (const part of analysis.parts) {
      for (const file of part.files) {
        if (fileMap.has(file)) {
          // Conflict detected
          return {
            canParallelize: false,
            reasoning: `File conflict detected: ${file} would be modified by multiple parts`,
            parts: []
          };
        }
        fileMap.set(file, part);
      }
    }

    // Check dependencies
    const hasDependencies = analysis.parts.some(p => p.dependencies.length > 0);
    if (hasDependencies) {
      return {
        canParallelize: false,
        reasoning: 'Parts have dependencies on each other',
        parts: []
      };
    }

    return analysis;
  }
}
```

### Step 2: Create Parallel Agent Manager (1.5 hours)
**File:** `lib/parallel-agent-manager.js`

```javascript
export class ParallelAgentManager {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.activeSubtasks = new Map();
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeParallel(taskId, project, parts) {
    const mainBranch = `task-${taskId}-main`;

    // Create main branch
    await this.orchestrator.git.createBranch(mainBranch);

    // Spawn all agents in parallel
    const subtaskPromises = parts.map((part, index) =>
      this.executeSubtask(taskId, mainBranch, part, index)
    );

    // Wait for all with progress tracking
    const results = await this.waitWithProgress(subtaskPromises);

    return {
      mainBranch,
      results,
      totalCost: results.reduce((sum, r) => sum + r.cost, 0),
      totalDuration: Math.max(...results.map(r => r.duration))
    };
  }

  /**
   * Execute a single subtask
   */
  async executeSubtask(taskId, baseBranch, part, index) {
    const subtaskId = `${taskId}-part${index + 1}`;
    const branchName = `task-${subtaskId}`;

    // Create subtask branch from main
    await this.orchestrator.git.createBranch(branchName, baseBranch);

    // Spawn container
    const container = await this.orchestrator.spawnContainer(subtaskId);

    // Create agent
    const agent = this.orchestrator.createAgent(part.role);

    // Track subtask state
    this.activeSubtasks.set(subtaskId, {
      id: subtaskId,
      branch: branchName,
      container,
      status: 'running',
      progress: 0
    });

    try {
      // Execute
      const result = await agent.execute({
        container,
        branch: branchName,
        task: part.description
      });

      // Update state
      this.activeSubtasks.set(subtaskId, {
        ...this.activeSubtasks.get(subtaskId),
        status: 'completed',
        progress: 100,
        result
      });

      return {
        subtaskId,
        branch: branchName,
        success: true,
        result
      };

    } catch (error) {
      // Handle failure
      this.activeSubtasks.set(subtaskId, {
        ...this.activeSubtasks.get(subtaskId),
        status: 'failed',
        error: error.message
      });

      throw error;
    } finally {
      // Cleanup container
      await this.orchestrator.cleanupContainer(container);
    }
  }

  /**
   * Wait for all subtasks with progress tracking
   */
  async waitWithProgress(promises) {
    // Set up progress monitoring
    const progressInterval = setInterval(() => {
      this.reportProgress();
    }, 5000);

    try {
      const results = await Promise.all(promises);
      return results;
    } finally {
      clearInterval(progressInterval);
    }
  }

  /**
   * Report current progress of all subtasks
   */
  reportProgress() {
    console.log('\nParallel Execution Progress:');
    for (const [id, subtask] of this.activeSubtasks) {
      console.log(`  ${id}: ${subtask.status} (${subtask.progress}%)`);
    }
  }

  /**
   * Get current state of all subtasks
   */
  getSubtaskStates() {
    return Array.from(this.activeSubtasks.values());
  }
}
```

### Step 3: Create Branch Merger (1 hour)
**File:** `lib/branch-merger.js`

```javascript
export class BranchMerger {
  constructor(git) {
    this.git = git;
  }

  /**
   * Merge all subtask branches into main branch
   */
  async mergeAll(mainBranch, subtaskResults) {
    const conflicts = [];

    for (const result of subtaskResults) {
      try {
        console.log(`Merging ${result.branch} into ${mainBranch}...`);

        // Attempt merge
        await this.git.merge(mainBranch, result.branch);

        console.log(`  ✓ Merged successfully`);

      } catch (error) {
        if (error.code === 'MERGE_CONFLICT') {
          conflicts.push({
            branch: result.branch,
            subtaskId: result.subtaskId,
            files: error.files
          });
        } else {
          throw error;
        }
      }
    }

    if (conflicts.length > 0) {
      throw new MergeConflictError(
        `Merge conflicts detected in ${conflicts.length} branches`,
        conflicts
      );
    }
  }

  /**
   * Handle merge conflicts (interactive or automatic)
   */
  async handleConflicts(mainBranch, conflicts) {
    // For Phase 3, we'll fail fast on conflicts
    // Phase 4 can add intelligent conflict resolution
    throw new Error(
      `Cannot automatically resolve conflicts. Manual intervention required.\n` +
      `Affected branches: ${conflicts.map(c => c.branch).join(', ')}`
    );
  }
}

export class MergeConflictError extends Error {
  constructor(message, conflicts) {
    super(message);
    this.conflicts = conflicts;
    this.name = 'MergeConflictError';
  }
}
```

### Step 4: Enhance Orchestrator (2 hours)
**File:** `lib/orchestrator.js`

Add new methods:

```javascript
// In Orchestrator class

/**
 * Enhanced task execution with parallel support
 */
async executeTask(project, description) {
  const taskId = this.generateTaskId();

  // Phase 1: Task Analysis
  const decomposer = new TaskDecomposer(this.createAgent('architect'));
  const analysis = await decomposer.analyzeTask(description);

  console.log(`\nTask Analysis:`);
  console.log(`  Parallelizable: ${analysis.canParallelize}`);
  console.log(`  Reasoning: ${analysis.reasoning}`);

  // Phase 2: Execution
  if (analysis.canParallelize && analysis.parts.length >= 2) {
    console.log(`  Parts: ${analysis.parts.length}`);
    console.log(`\nExecuting in PARALLEL mode...\n`);
    return this.executeParallel(taskId, project, analysis);
  } else {
    console.log(`\nExecuting in SEQUENTIAL mode...\n`);
    return this.executeSequential(taskId, project, description);
  }
}

/**
 * Parallel execution workflow
 */
async executeParallel(taskId, project, analysis) {
  const startTime = Date.now();

  try {
    // 1. Setup
    const projectConfig = await this.loadProject(project);
    const mainBranch = `task-${taskId}-main`;

    console.log(`Creating main branch: ${mainBranch}`);
    await this.git.createBranch(mainBranch);

    // 2. Execute agents in parallel
    console.log(`\nSpawning ${analysis.parts.length} agents in parallel...`);
    const parallelManager = new ParallelAgentManager(this);
    const parallelResult = await parallelManager.executeParallel(
      taskId,
      project,
      analysis.parts
    );

    // 3. Merge branches
    console.log(`\nMerging ${analysis.parts.length} branches...`);
    const merger = new BranchMerger(this.git);
    await merger.mergeAll(parallelResult.mainBranch, parallelResult.results);

    // 4. Run reviewer on combined result
    console.log(`\nReviewing combined changes...`);
    const reviewer = this.createAgent('reviewer');
    const container = await this.spawnContainer(`${taskId}-reviewer`);

    try {
      await reviewer.execute({
        container,
        branch: mainBranch,
        task: 'Review all changes from parallel agents'
      });
    } finally {
      await this.cleanupContainer(container);
    }

    // 5. Create PR
    console.log(`\nCreating pull request...`);
    const pr = await this.createPR(mainBranch, analysis.parts);

    const duration = (Date.now() - startTime) / 1000;

    return {
      taskId,
      branchName: mainBranch,
      parallelParts: analysis.parts.length,
      cost: parallelResult.totalCost,
      duration,
      pr
    };

  } catch (error) {
    console.error(`\nParallel execution failed:`, error.message);
    throw error;
  }
}

/**
 * Sequential execution (existing logic, renamed)
 */
async executeSequential(taskId, project, description) {
  // Existing executeTask logic goes here
  // This is the current implementation
}
```

### Step 5: Update Background Worker (30 min)
**File:** `background-worker.js`

Update to support parallel execution:

```javascript
// In runTask()

// Execute task (now supports parallel)
const result = await orchestrator.executeTask(project, description);

// Update state with parallel info
await stateManager.updateTaskState(taskId, {
  status: 'completed',
  currentAgent: null,
  completedAgents: result.parallelParts
    ? Array(result.parallelParts).fill('coder').concat(['reviewer'])
    : ['architect', 'coder', 'reviewer'],
  progress: {
    percent: 100,
    eta: 0
  },
  result: {
    taskId: result.taskId,
    branchName: result.branchName,
    parallelParts: result.parallelParts || 1,
    cost: result.cost
  },
  completedAt: new Date().toISOString()
});
```

### Step 6: Add Parallel Status Tracking (30 min)
**File:** `lib/task-state-manager.js`

Add methods for parallel subtask tracking:

```javascript
/**
 * Save subtask state
 */
async saveSubtaskState(taskId, subtaskId, state) {
  const taskDir = path.join(this.tasksDir, taskId, 'subtasks');
  await fs.mkdir(taskDir, { recursive: true });

  const subtaskPath = path.join(taskDir, `${subtaskId}.json`);
  await fs.writeFile(subtaskPath, JSON.stringify(state, null, 2));
}

/**
 * Get all subtasks for a task
 */
async getSubtasks(taskId) {
  try {
    const subtasksDir = path.join(this.tasksDir, taskId, 'subtasks');
    const files = await fs.readdir(subtasksDir);

    const subtasks = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(
          path.join(subtasksDir, file),
          'utf8'
        );
        subtasks.push(JSON.parse(data));
      }
    }

    return subtasks;
  } catch (error) {
    return [];
  }
}

/**
 * Format parallel task summary
 */
formatParallelTaskSummary(task, subtasks) {
  const completedSubtasks = subtasks.filter(s => s.status === 'completed').length;
  const totalSubtasks = subtasks.length;

  return {
    ...this.formatTaskSummary(task),
    parallel: true,
    subtasks: {
      total: totalSubtasks,
      completed: completedSubtasks,
      progress: Math.round((completedSubtasks / totalSubtasks) * 100)
    }
  };
}
```

### Step 7: Update Status Command (15 min)
**File:** `cli.js`

Update status command to show parallel subtasks:

```javascript
// In status command action
for (const task of tasks) {
  const subtasks = await stateManager.getSubtasks(task.taskId);

  if (subtasks.length > 0) {
    // Parallel task
    const summary = stateManager.formatParallelTaskSummary(task, subtasks);
    console.log(`${summary.id} (${subtasks.length} parallel agents)`);

    // Show subtask progress
    for (const subtask of subtasks) {
      console.log(`    └─ ${subtask.id}: ${subtask.status}`);
    }
  } else {
    // Sequential task
    const summary = stateManager.formatTaskSummary(task);
    console.log(summary.id);
  }
}
```

## Testing Strategy

### Unit Tests
1. TaskDecomposer
   - Detects parallelizable tasks
   - Detects file conflicts
   - Validates independence

2. ParallelAgentManager
   - Spawns multiple agents
   - Tracks progress correctly
   - Handles agent failures

3. BranchMerger
   - Merges clean branches
   - Detects conflicts
   - Reports conflict details

### Integration Tests
1. Simple parallel task (2 agents, no conflicts)
2. Complex parallel task (3+ agents)
3. Non-parallelizable task (falls back to sequential)
4. Parallel task with conflicts (should fail gracefully)

### Manual Testing
```bash
# Test 1: Parallel execution
dev-tools task -b my-project "Add 3 new API endpoints: /users, /posts, /comments. Each should be in a separate file."

# Test 2: Status with parallel
dev-tools status

# Test 3: Logs from parallel task
dev-tools logs <taskId>
```

## Success Criteria

- ✅ Orchestrator can detect parallelizable tasks
- ✅ Multiple agents execute simultaneously
- ✅ Each agent has isolated branch + container
- ✅ Results merge successfully (or detect conflicts)
- ✅ Progress tracking shows all agents
- ✅ Cost/time correctly aggregated
- ✅ Falls back to sequential when needed
- ✅ All existing tests still pass

## Timeline

**Estimated: 6-7 hours**

- Step 1: Task Decomposer - 1 hour
- Step 2: Parallel Agent Manager - 1.5 hours
- Step 3: Branch Merger - 1 hour
- Step 4: Enhance Orchestrator - 2 hours
- Step 5: Update Background Worker - 30 min
- Step 6: Parallel Status Tracking - 30 min
- Step 7: Update Status Command - 15 min
- Testing & Debugging - 1 hour

## Future Enhancements (Phase 4)

- Intelligent conflict resolution
- Dynamic agent scaling based on task complexity
- Agent-to-agent communication for dependencies
- Cost optimization (prefer fewer agents when benefit is marginal)
- Retry failed subtasks independently
