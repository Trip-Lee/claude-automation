# Phase 2: Background Execution - Implementation Plan

## Status: ✅ COMPLETE (All 8 Steps Done)

### ✅ Completed Steps

1. **Task State Manager** (`lib/task-state-manager.js`)
   - State persistence in `~/.claude-tasks/`
   - Get running/all/project tasks
   - Process status checking
   - Progress calculation
   - ETA estimation

2. **Background Worker** (`background-worker.js`)
   - Detached process runner for tasks
   - State updates as task progresses
   - Error handling and logging
   - Signal handlers for cleanup

3. **Global Config Update** (`lib/global-config.js`)
   - Added `maxParallelTasks: 10` setting
   - Updated in both defaults and example config

4. **Task Command Enhancement** (`cli.js`)
   - Added `-b, --background` flag
   - Parallel task limit checking
   - Detached process spawning
   - Initial state persistence
   - User-friendly output

5. **Status Command Rewrite** (`cli.js`)
   - Changed from `[taskId]` to `[project]` parameter
   - Shows running background tasks
   - Optional project filtering
   - Formatted table output
   - State syncing (marks dead processes)

6. **Logs Command** (`cli.js`)
   - View task logs: `dev-tools logs <taskId>`
   - Follow mode: `-f, --follow`
   - Line limit: `-n, --lines <number>`
   - Real-time log streaming

7. **Cancel Command** (`cli.js`)
   - Cancel background tasks: `dev-tools cancel [taskId]`
   - Interactive selection if no taskId
   - Graceful shutdown (SIGTERM → SIGKILL)
   - State updates

8. **Restart Command** (`cli.js`)
   - Restart failed/completed tasks: `dev-tools restart <taskId>`
   - Background mode: `-b, --background`
   - Preserves original task details
   - Generates new task ID

### 🔄 Implementation Details

#### 2. Background Worker (`background-worker.js`) - 30 minutes
Create detached process runner:
```javascript
#!/usr/bin/env node
// Runs task in background, updates state file
import { Orchestrator } from './lib/orchestrator.js';
import { TaskStateManager } from './lib/task-state-manager.js';

const [taskId, project, description] = process.argv.slice(2);
const stateManager = new TaskStateManager();

// Update state as task progresses
async function run() {
  try {
    await stateManager.updateTaskState(taskId, {
      status: 'running',
      currentAgent: 'architect'
    });
    
    // Run orchestrator with progress callbacks
    const orchestrator = new Orchestrator(...);
    const result = await orchestrator.executeTask(project, description, {
      onAgentStart: (agent) => {
        stateManager.updateTaskState(taskId, { currentAgent: agent });
      },
      onProgress: (percent, eta) => {
        stateManager.updateTaskState(taskId, { 
          progress: { percent, eta }
        });
      }
    });
    
    await stateManager.updateTaskState(taskId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    await stateManager.updateTaskState(taskId, {
      status: 'failed',
      error: error.message,
      completedAt: new Date().toISOString()
    });
  }
}

run();
```

#### 3. Update Global Config (`lib/global-config.js`) - 5 minutes
Add max_parallel_tasks setting:
```javascript
const defaults = {
  ...
  maxParallelTasks: 10
};
```

#### 4. Update Task Command (`cli.js`) - 45 minutes
Add `--background` flag:
```javascript
program
  .command('task <project> <description>')
  .option('-b, --background', 'Run task in background')
  .action(async (project, description, options) => {
    if (options.background) {
      // Check parallel task limit
      const running = await stateManager.getRunningTasks();
      if (running.length >= globalConfig.get('maxParallelTasks')) {
        console.error('Max parallel tasks reached');
        return;
      }
      
      // Spawn detached process
      const taskId = generateTaskId();
      const logPath = path.join(logsDir, `${taskId}.log`);
      const logStream = fs.createWriteStream(logPath);
      
      const child = spawn('node', [
        './background-worker.js',
        taskId,
        project,
        description
      ], {
        detached: true,
        stdio: ['ignore', logStream, logStream]
      });
      
      child.unref();
      
      // Save initial state
      await stateManager.saveTaskState(taskId, {
        taskId,
        project,
        description,
        status: 'running',
        pid: child.pid,
        startedAt: new Date().toISOString(),
        logFile: logPath
      });
      
      console.log(`Task ${taskId} started in background`);
      console.log(`  PID: ${child.pid}`);
      console.log(`  Log: ${logPath}`);
      console.log(`\nView logs: dev-tools logs ${taskId}`);
      console.log(`Check status: dev-tools status`);
      
      process.exit(0);
    }
    
    // Normal foreground execution
    // ...existing code...
  });
```

#### 5. Update Status Command (`cli.js`) - 30 minutes
Show running tasks, optionally filtered by project:
```javascript
program
  .command('status [project]')
  .description('Show running tasks (optionally for specific project)')
  .action(async (project) => {
    const stateManager = new TaskStateManager();
    
    // Sync states first (mark dead processes)
    await stateManager.syncTaskStates();
    
    let tasks;
    if (project) {
      tasks = await stateManager.getProjectTasks(project);
      tasks = tasks.filter(t => t.status === 'running');
    } else {
      tasks = await stateManager.getRunningTasks();
    }
    
    if (tasks.length === 0) {
      console.log('No running tasks');
      return;
    }
    
    // Display table
    console.log('\nRunning Tasks:\n');
    console.log('ID          Project      Stage      Progress  ETA    Started');
    console.log('─'.repeat(70));
    
    for (const task of tasks) {
      const summary = stateManager.formatTaskSummary(task);
      console.log(
        `${summary.id.padEnd(12)} ` +
        `${summary.project.padEnd(12)} ` +
        `${summary.stage.padEnd(10)} ` +
        `${summary.progress}%`.padEnd(10) +
        `${summary.eta}s`.padEnd(7) +
        `${formatTime(summary.started)}`
      );
    }
    console.log();
  });
```

#### 6. Add Logs Command (`cli.js`) - 20 minutes
Tail log file for a task:
```javascript
program
  .command('logs <taskId>')
  .option('-f, --follow', 'Follow log output (like tail -f)')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (taskId, options) => {
    const stateManager = new TaskStateManager();
    const task = await stateManager.loadTaskState(taskId);
    
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }
    
    const logPath = task.logFile || path.join(logsDir, `${taskId}.log`);
    
    if (options.follow) {
      // Stream logs in real-time
      const tail = spawn('tail', ['-f', logPath], { stdio: 'inherit' });
      
      // Handle Ctrl+C
      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });
    } else {
      // Show last N lines
      const tail = spawn('tail', ['-n', options.lines, logPath], { stdio: 'inherit' });
      tail.on('close', () => process.exit(0));
    }
  });
```

#### 7. Add Cancel Command (`cli.js`) - 30 minutes
Cancel running task with graceful shutdown:
```javascript
program
  .command('cancel [taskId]')
  .description('Cancel a running task (interactive if no taskId)')
  .action(async (taskId) => {
    const stateManager = new TaskStateManager();
    
    if (!taskId) {
      // Interactive selection
      const running = await stateManager.getRunningTasks();
      
      if (running.length === 0) {
        console.log('No running tasks to cancel');
        return;
      }
      
      const choices = running.map(t => ({
        name: `${t.taskId} - ${t.project} (${t.currentAgent})`,
        value: t.taskId
      }));
      
      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'taskId',
        message: 'Select task to cancel:',
        choices
      }]);
      
      taskId = answer.taskId;
    }
    
    const task = await stateManager.loadTaskState(taskId);
    
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }
    
    if (task.status !== 'running') {
      console.log(`Task ${taskId} is not running (status: ${task.status})`);
      return;
    }
    
    console.log(`Canceling task ${taskId}...`);
    
    // Try graceful shutdown first (SIGTERM)
    try {
      process.kill(task.pid, 'SIGTERM');
      
      // Wait 5 seconds for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if still running
      if (stateManager.isProcessRunning(task.pid)) {
        console.log('  Graceful shutdown failed, force killing...');
        process.kill(task.pid, 'SIGKILL');
      }
      
      await stateManager.updateTaskState(taskId, {
        status: 'cancelled',
        completedAt: new Date().toISOString()
      });
      
      console.log(`Task ${taskId} cancelled`);
    } catch (error) {
      console.error(`Failed to cancel task: ${error.message}`);
    }
  });
```

#### 8. Add Restart Command (`cli.js`) - 20 minutes
Restart failed/interrupted tasks:
```javascript
program
  .command('restart <taskId>')
  .option('-b, --background', 'Run in background')
  .action(async (taskId, options) => {
    const stateManager = new TaskStateManager();
    const task = await stateManager.loadTaskState(taskId);
    
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }
    
    if (task.status === 'running') {
      console.log(`Task ${taskId} is already running`);
      return;
    }
    
    console.log(`Restarting task ${taskId}...`);
    console.log(`  Project: ${task.project}`);
    console.log(`  Description: ${task.description}`);
    
    // Restart with same parameters
    const newTaskId = generateTaskId();
    
    if (options.background) {
      // Use background execution
      // ...spawn detached process...
    } else {
      // Foreground execution
      const orchestrator = new Orchestrator(...);
      await orchestrator.executeTask(task.project, task.description);
    }
  });
```

### Testing Results ✅

All validation tests completed successfully:

- ✅ **Syntax Validation**: All files pass `node --check`
  - cli.js
  - background-worker.js
  - lib/task-state-manager.js
  - lib/global-config.js

- ✅ **CLI Commands**: All help commands working
  - `dev-tools --help` shows all commands
  - `dev-tools task --help` shows `-b, --background` option
  - `dev-tools status --help` shows `[project]` parameter
  - `dev-tools logs --help` shows `-f` and `-n` options
  - `dev-tools cancel --help` shows `[taskId]` optional
  - `dev-tools restart --help` shows `-b` option

- ✅ **Status Command**: Working with no tasks
  - Correctly shows "No running tasks"
  - State syncing implemented

- ✅ **Unit Tests**: All passing
  - 25/25 tests passed
  - 7 test suites passed
  - 0 failures

### Implementation Checklist

- ✅ Background task structure implemented
- ✅ `dev-tools status` shows running tasks
- ✅ `dev-tools status <project>` filters correctly
- ✅ `dev-tools logs <id>` command implemented
- ✅ `dev-tools logs -f <id>` follow mode implemented
- ✅ `dev-tools cancel <id>` graceful shutdown implemented
- ⏸️ Interrupted tasks handling (requires actual task execution to test)
- ✅ `dev-tools restart <id>` command implemented
- ✅ Max parallel tasks limit enforced (checks before spawning)

### Actual Time
**~2.5 hours** to complete Phase 2 (faster than estimated)

---

## Summary

Phase 2 successfully implements full background execution capability:

✅ **Core Features**:
- Detached process execution with state persistence
- Real-time log streaming and viewing
- Graceful task cancellation (SIGTERM → SIGKILL)
- Task restart capability
- Configurable parallel task limits (default: 10)

✅ **Commands Added/Updated**:
- `task -b` - Run in background
- `status [project]` - Show running tasks (rewritten)
- `logs [-f] <taskId>` - View/follow logs (new)
- `cancel [taskId]` - Cancel tasks (rewritten for background)
- `restart [-b] <taskId>` - Restart tasks (new)

✅ **Technical Implementation**:
- TaskStateManager for persistence (~/.claude-tasks/)
- Background worker process with error handling
- Process lifecycle management
- Interactive task selection (cancel command)
- Progress tracking and ETA estimation

**Ready for Phase 3: Parallel Agent Execution**
