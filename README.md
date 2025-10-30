# Claude Multi-Agent Coding System

**Version**: v0.14.0
**Status**: ✨ Production Ready - Background Execution & Parallel Agents
**Date**: 2025-10-30

---

## Overview

An intelligent, **installable** multi-agent coding system that uses **dynamic routing**, **parallel execution**, and **background task management** to automatically orchestrate specialized AI agents for coding tasks. Features professional installer, automatic PR creation, comprehensive error handling, and works on any system.

### 🎯 What Makes This Special

- **🚀 Parallel Agent Execution** - Automatically detects and parallelizes independent work (NEW in v0.14.0)
- **⚡ Background Execution** - Run tasks in background with full monitoring (NEW in v0.14.0)
- **🤖 Dynamic Agent Routing** - Agents decide next steps intelligently
- **🔒 Docker Isolation** - Each agent runs in isolated container
- **📊 Real-time Monitoring** - Track progress, view logs, manage tasks
- **💰 Cost Tracking** - Monitor API usage per task and agent
- **🌐 GitHub Integration** - Auto-validation, repo creation, PR management

---

## Key Features

### 🆕 v0.14.0: Background & Parallel Execution

#### Background Task Management
- **Detached Execution** - Tasks run independently in background
- **Real-time Monitoring** - Check status, view/follow logs
- **Task Management** - Cancel, restart, and track multiple tasks
- **Progress Tracking** - ETA estimation and progress percentage
- **Configurable Limits** - Control max parallel tasks (default: 10)
- **State Persistence** - Task state survives crashes (not reboots)

#### Intelligent Parallel Execution
- **Automatic Detection** - Analyzes tasks to determine if parallelization is beneficial
- **Smart Decomposition** - Breaks complex tasks into independent subtasks
- **Conflict Avoidance** - Detects file conflicts and dependencies
- **Isolated Execution** - Each agent gets own branch + container
- **Sequential Merging** - Combines results with conflict detection
- **Graceful Fallback** - Falls back to sequential when needed

#### Enhanced Commands
```bash
dev-tools task -b <project> <description>    # Run in background
dev-tools status [project]                    # Show running tasks
dev-tools logs [-f] <taskId>                  # View/follow logs
dev-tools cancel [taskId]                     # Cancel task(s)
dev-tools restart [-b] <taskId>               # Restart task
```

### 🆕 v0.13.0: Installation & Portability

- **Interactive Installer** - Guided setup with dependency validation
- **Fully Portable** - Works on any system, any user (no hardcoded paths)
- **Auto-Configuration** - Creates all directories and config files
- **Dependency Validation** - Checks Node.js, Docker, Git, GitHub CLI
- **Auto-PR Creation** - PRs created automatically after task completion
- **Pre-flight Validation** - Catches errors before expensive agent execution

### 🤖 AI & Agents

- **15 Specialized Agents** - 7 standard + 8 ServiceNow-specific agents
  - **Standard**: Architect, Coder, Reviewer, Security, Documenter, Tester, Performance
  - **ServiceNow**: API, Flows, Scripting, UI, Integration, Security, Testing, Performance
- **Dynamic Agent Routing** - Agents decide next steps intelligently
- **Parallel Coordination** - Multiple agents work simultaneously
- **Session Continuity** - Agents share context across workflow
- **Platform-Specific Agents** - Optimized for ServiceNow, extensible to other platforms

### 🚀 Workflow & Integration

- **Workflow Mode** - Interactive guided workflow (just run `dev-tools`)
- **Direct Task Mode** - Quick one-off tasks with background option
- **In-Workflow Project Creation** - Create projects from dropdown
- **GitHub Integration** - Validation, repo creation, PR management
- **Branch Management** - Automatic branch creation and merging

### 🔒 Security & Reliability

- **Docker Isolation** - Each task/agent runs in isolated container
- **Resource Cleanup** - Automatic container and branch cleanup
- **Error Recovery** - Restart failed tasks, cancel runaway processes
- **Comprehensive Error Handling** - Clear, actionable error messages
- **Cost Limits** - Configurable max cost per task

---

## Quick Start

### 1. Install

```bash
# Clone repository
git clone https://github.com/Trip-Lee/claude-automation.git
cd claude-automation

# Install dependencies
npm install

# Run interactive installer
node install.js
```

The installer will:
- ✅ Validate system dependencies (Node.js, Docker, Git, GitHub CLI)
- ✅ Create required directories (`~/.claude-projects`, `~/.claude-tasks`, `~/.claude-logs`)
- ✅ Prompt for API keys (Anthropic, GitHub)
- ✅ Create `~/.env` file with your credentials
- ✅ Link `dev-tools` command globally

### 2. Configure a Project

```bash
# Copy example config
cp ~/.claude-projects/example-project.yaml ~/.claude-projects/my-project.yaml

# Edit with your project details
nano ~/.claude-projects/my-project.yaml
```

Example configuration:
```yaml
name: my-project
repo: github.com/username/my-repo
base_branch: main

protected_branches:
  - main
  - master

docker:
  image: anthropics/claude-code-agent:latest
  memory: 4g
  cpus: 2

safety:
  max_cost_per_task: 5.00
```

### 3. Run Your First Task

#### Option A: Interactive Workflow Mode
```bash
dev-tools
# Select project from dropdown
# Enter task description
# System handles everything automatically
```

#### Option B: Direct Task Mode (Foreground)
```bash
dev-tools task my-project "Add user authentication endpoints"
# Waits for completion, shows output
```

#### Option C: Background Mode (NEW!)
```bash
dev-tools task -b my-project "Add 3 new API endpoints"
# Returns immediately with task ID
# Monitor with: dev-tools status
```

---

## Background Execution

### Running Tasks in Background

```bash
# Start a task in background
dev-tools task -b my-project "Implement user dashboard"

# Output:
# ✓ Background task started
#
# Task Details:
#   ID:       a7f3c4e2b1d9
#   Project:  my-project
#   PID:      12345
#
#   Log:      ~/.claude-logs/a7f3c4e2b1d9.log
#
# Monitoring:
#   View logs:    dev-tools logs a7f3c4e2b1d9
#   Follow logs:  dev-tools logs -f a7f3c4e2b1d9
#   Check status: dev-tools status
#   Cancel task:  dev-tools cancel a7f3c4e2b1d9
```

### Monitoring Tasks

```bash
# View all running tasks
dev-tools status

# Output:
#  Running Background Tasks
#
# ID            Project       Stage       Progress  ETA     Started
# ─────────────────────────────────────────────────────────────────────
# a7f3c4e2b1d9  my-project    coder       45%       120s    5m ago
# f2e9b8c3a1d4  other-proj    reviewer    80%       30s     12m ago
#
# ─────────────────────────────────────────────────────────────────────
# Total: 2 running tasks

# Filter by project
dev-tools status my-project

# View logs
dev-tools logs a7f3c4e2b1d9

# Follow logs in real-time
dev-tools logs -f a7f3c4e2b1d9

# Cancel a task
dev-tools cancel a7f3c4e2b1d9

# Restart a failed task (foreground)
dev-tools restart a7f3c4e2b1d9

# Restart in background
dev-tools restart -b a7f3c4e2b1d9
```

### Configuration

Configure max parallel tasks in `~/.claude-automation/config.json`:

```json
{
  "maxParallelTasks": 10
}
```

---

## Parallel Execution

### How It Works

The system automatically analyzes each task to determine if it can be parallelized:

```
Task Submission
     ↓
Architect analyzes task complexity
     ↓
Can parallelize? (independent parts, no conflicts)
     ↓
   ┌─YES─┐         ┌─NO──┐
   ↓      ↓         ↓
Parallel  │    Sequential
Execution │    Execution
   │      │
   ├──────┴──────┐
   │             │
Spawn Agent 1   Spawn Agent 2
(branch + container) (branch + container)
   │             │
   └──────┬──────┘
          ↓
    Merge branches
          ↓
    Final review
          ↓
    Create PR
```

### Examples

#### Parallelizable Task
```bash
dev-tools task -b my-project "Add 3 new API endpoints: /users, /posts, /comments. Each in separate files."

# System Analysis:
#   Complexity: 6/10
#   Can Parallelize: Yes
#   Reasoning: 3 independent endpoints, no file conflicts
#   Parts: 3

# Execution:
# ⚡ Parallel Execution Mode
#
# Spawning 3 agents in parallel...
#
# [part1] Starting coder agent
#   Branch: task-abc123-part1
#   Task: Create /users endpoint
#
# [part2] Starting coder agent
#   Branch: task-abc123-part2
#   Task: Create /posts endpoint
#
# [part3] Starting coder agent
#   Branch: task-abc123-part3
#   Task: Create /comments endpoint
#
# [part1] ✓ Completed in 45s
# [part2] ✓ Completed in 52s
# [part3] ✓ Completed in 48s
#
# 🔀 Merging Branches
# Merging task-abc123-part1 → task-abc123-main... ✓
# Merging task-abc123-part2 → task-abc123-main... ✓
# Merging task-abc123-part3 → task-abc123-main... ✓
#
# 📋 Final Review
#   Reviewing combined changes... ✓
#
# ✅ Task completed in 65s (3 agents, 2.3x speedup)
```

#### Non-Parallelizable Task (Sequential Fallback)
```bash
dev-tools task my-project "Refactor authentication system to use JWT"

# System Analysis:
#   Complexity: 7/10
#   Can Parallelize: No
#   Reasoning: All auth files interdependent, would cause conflicts
#
# → Using SEQUENTIAL execution
#
# 📋 Step 1: Architect creates plan...
# 📋 Step 2: Coder implements changes...
# 📋 Step 3: Reviewer validates...
# ✅ Task completed
```

### When Parallelization Happens

The system parallelizes when ALL conditions are met:

✅ **Complexity ≥ 3/10** - Task is substantial enough
✅ **2-5 independent parts** - Not too few, not too many
✅ **No file conflicts** - Parts work on different files
✅ **No dependencies** - Parts don't depend on each other

If ANY condition fails, the system gracefully falls back to proven sequential execution.

---

## Command Reference

### Task Management

```bash
# Foreground execution (waits for completion)
dev-tools task <project> <description>

# Background execution (returns immediately)
dev-tools task -b <project> <description>

# Examples
dev-tools task my-project "Add login endpoint"
dev-tools task -b my-project "Implement user dashboard"
```

### Monitoring & Control

```bash
# Show all running tasks
dev-tools status

# Show running tasks for specific project
dev-tools status <project>

# View task logs (last 50 lines)
dev-tools logs <taskId>

# View specific number of lines
dev-tools logs -n 100 <taskId>

# Follow logs in real-time
dev-tools logs -f <taskId>

# Cancel a running task
dev-tools cancel <taskId>

# Cancel with interactive selection
dev-tools cancel

# Restart failed/completed task (foreground)
dev-tools restart <taskId>

# Restart in background
dev-tools restart -b <taskId>
```

### Project Management

```bash
# List all configured projects
dev-tools list-projects

# Add new project (interactive)
dev-tools add-project <name>

# Launch interactive workflow
dev-tools
```

### Task Review

```bash
# Manually create PR (if auto-creation failed)
dev-tools approve <taskId>

# Reject task and delete branch
dev-tools reject <taskId>

# Retry failed task
dev-tools retry <taskId>

# View task diff
dev-tools diff <taskId>
dev-tools diff --stat <taskId>
```

### System Maintenance

```bash
# Show system status
dev-tools monitor

# Clean up hanging containers
dev-tools cleanup
dev-tools cleanup --all

# Validate system health
dev-tools validate
dev-tools validate --fix

# Run unit tests
dev-tools test
dev-tools test --verbose
```

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI (dev-tools)                      │
└─────────────┬───────────────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────┐        ┌──────▼──────┐
│ Direct │        │  Workflow   │
│  Mode  │        │    Mode     │
└───┬────┘        └──────┬──────┘
    │                    │
    └─────────┬──────────┘
              │
      ┌───────▼────────┐
      │  Orchestrator  │◄──── Task Analysis
      └───────┬────────┘      (Architect Agent)
              │
       ┌──────┴──────┐
       │             │
   Sequential    Parallel
   Execution     Execution
       │             │
       ↓             ├─→ Agent 1 (Branch + Container)
   Single Agent     ├─→ Agent 2 (Branch + Container)
   (Branch +        └─→ Agent N (Branch + Container)
   Container)           │
       │                ↓
       │          Merge Branches
       │                │
       └────────┬───────┘
                │
         ┌──────▼───────┐
         │   Reviewer   │
         └──────┬───────┘
                │
          ┌─────▼─────┐
          │  Create   │
          │    PR     │
          └───────────┘
```

### Task State Directory Structure

```
~/.claude-tasks/
├── abc123-def456/              # Task directory
│   ├── state.json              # Task state
│   ├── subtasks/               # Parallel subtasks (if any)
│   │   ├── abc123-part1.json
│   │   ├── abc123-part2.json
│   │   └── abc123-part3.json
│   └── metadata.json           # Task metadata
└── xyz789-uvw012/
    └── state.json

~/.claude-logs/
├── abc123-def456.log           # Task log
└── xyz789-uvw012.log

~/.claude-automation/
└── config.json                 # Global configuration
```

---

## Configuration

### Global Configuration (`~/.claude-automation/config.json`)

```json
{
  "configDir": "~/.claude-projects",
  "tasksDir": "~/.claude-tasks",
  "logsDir": "~/.claude-logs",
  "projectsDir": "~/projects",
  "envFile": "~/.env",

  "docker": {
    "defaultMemory": "4g",
    "defaultCpus": 2
  },

  "safety": {
    "maxCostPerTask": 5.00
  },

  "maxParallelTasks": 10,

  "installPath": "/path/to/claude-automation",
  "installedAt": "2025-10-30T...",
  "version": "0.14.0"
}
```

### Project Configuration (`~/.claude-projects/<project>.yaml`)

```yaml
name: my-project
repo: github.com/username/repo
base_branch: main

protected_branches:
  - main
  - master
  - develop

docker:
  image: anthropics/claude-code-agent:latest
  memory: 4g
  cpus: 2
  network_mode: none

safety:
  max_cost_per_task: 5.00
  allow_dependency_changes: false
  require_manual_review: false
  backup_before_changes: false

# Optional: Tests, lint, security
tests:
  command: npm test
  timeout: 300

lint:
  command: npm run lint
  autofix: true

security:
  command: npm audit
  fail_on: high
```

### Environment Variables (`~/.env`)

```bash
# Required: Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-...

# Optional: GitHub Personal Access Token
GITHUB_TOKEN=ghp_...

# Optional: Docker defaults
DEFAULT_DOCKER_MEMORY=4g
DEFAULT_DOCKER_CPUS=2

# Optional: Safety defaults
DEFAULT_MAX_COST=5.00
```

---

## ServiceNow Agents

The system includes **8 specialized ServiceNow agents** optimized for ServiceNow platform development and SN-tools testing:

### Available Agents

| Agent | Icon | Focus | Use Case |
|-------|------|-------|----------|
| **sn-api** | 🔌 | REST APIs, GlideAjax | API development, integrations |
| **sn-flows** | 🔄 | Flow Designer, IntegrationHub | Workflow automation |
| **sn-scripting** | 📜 | Business rules, client scripts | Server/client scripting |
| **sn-ui** | 🎨 | Service Portal, widgets | UI development |
| **sn-integration** | 🔗 | External integrations, ETL | System integrations |
| **sn-security** | 🔐 | ACLs, security audit | Security reviews |
| **sn-testing** | 🧪 | ATF tests | Automated testing |
| **sn-performance** | ⚡ | Query optimization | Performance tuning |

### Quick Examples

```bash
# Create REST API endpoint
dev-tools task sn-tools "Create REST API for incident statistics"
# → architect → sn-api → sn-testing → reviewer

# Build workflow automation
dev-tools task sn-tools "Create flow to auto-assign incidents"
# → architect → sn-flows → sn-testing → reviewer

# Security audit
dev-tools task sn-tools "Review ACLs on incident table"
# → architect → sn-security → reviewer

# Performance optimization
dev-tools task sn-tools "Optimize slow business rule on incident"
# → architect → sn-performance → sn-scripting → sn-performance → reviewer

# Service Portal widget
dev-tools task sn-tools "Create widget for user's open tasks"
# → architect → sn-ui → sn-testing → reviewer
```

### Automatic Agent Selection

The system automatically selects ServiceNow agents based on task keywords:

- **"api", "rest", "glideajax"** → sn-api-dev sequence
- **"flow", "workflow"** → sn-flow-dev sequence
- **"portal", "widget"** → sn-ui-dev sequence
- **"integration", "import"** → sn-integration-dev sequence
- **"acl", "security"** → sn-security-audit sequence
- **"performance", "slow"** → sn-performance sequence

### Documentation

For detailed ServiceNow agent documentation, see [SERVICENOW_AGENTS.md](SERVICENOW_AGENTS.md)

---

## Troubleshooting

### Background Tasks Not Starting

```bash
# Check running tasks
dev-tools status

# Check if at max limit
# Edit ~/.claude-automation/config.json:
{
  "maxParallelTasks": 20  # Increase limit
}
```

### Task Logs Not Found

```bash
# Logs are in ~/.claude-logs/
ls -la ~/.claude-logs/

# View with full path
tail -f ~/.claude-logs/<taskId>.log
```

### Parallel Execution Not Working

The system may choose sequential execution if:
- Task complexity too low (<3/10)
- Only 1 part identified
- File conflicts detected
- Parts have dependencies

This is intentional and ensures optimal execution strategy.

### Container Cleanup Issues

```bash
# Clean up all hanging containers
dev-tools cleanup --all

# Manual cleanup
docker ps -a | grep claude- | awk '{print $1}' | xargs docker rm -f
```

### Process Still Running After Cancel

```bash
# Find process
ps aux | grep background-worker

# Force kill
kill -9 <PID>

# Update task state
# Edit ~/.claude-tasks/<taskId>/state.json
# Change status to "cancelled"
```

---

## Performance

### Sequential vs Parallel Execution

| Scenario | Sequential | Parallel | Speedup |
|----------|-----------|----------|---------|
| 3 independent endpoints | 180s | 65s | 2.8x |
| Frontend + Backend | 240s | 130s | 1.8x |
| 5 test files | 300s | 95s | 3.2x |
| Refactor (dependent) | 150s | 150s | 1.0x* |

\* Falls back to sequential automatically

### Cost Optimization

Parallel execution can reduce time but may increase costs slightly:
- Sequential: 1 agent × N tasks = baseline cost
- Parallel: N agents × 1 time = similar total cost, faster completion

The system balances speed vs cost based on task complexity.

---

## Development

### Running Tests

```bash
# Unit tests
npm test

# Smoke tests (quick validation)
npm run test:smoke

# Validation suite (comprehensive)
npm run test:validate

# All tests
npm run test:all
```

### Project Structure

```
claude-automation/
├── cli.js                      # Main CLI entry point
├── background-worker.js        # Background task executor
├── install.js                  # Interactive installer
├── package.json               # Package configuration
├── lib/
│   ├── orchestrator.js        # Task orchestration
│   ├── task-decomposer.js     # Task analysis
│   ├── parallel-agent-manager.js  # Parallel coordination
│   ├── branch-merger.js       # Branch merging
│   ├── task-state-manager.js  # State persistence
│   ├── agent-registry.js      # Agent management
│   ├── standard-agents.js     # Standard agent definitions
│   ├── servicenow-agents.js   # ServiceNow agent definitions
│   ├── docker-manager.js      # Docker operations
│   ├── git-manager.js         # Git operations
│   ├── github-client.js       # GitHub API
│   ├── cost-monitor.js        # Cost tracking
│   └── ...
├── test/
│   ├── smoke-test.js          # Quick health checks
│   ├── validation-suite.js    # Comprehensive tests
│   └── run-unit-tests.js      # Unit test runner
└── docs/
    ├── PHASE2_PLAN.md         # Background execution design
    ├── PHASE3_PLAN.md         # Parallel execution design
    └── CHANGELOG.md           # Version history
```

---

## Changelog

### v0.14.0 (2025-10-30)

**🚀 Major Features**
- **Background Execution System**
  - Run tasks in detached background processes
  - Real-time monitoring and log streaming
  - Task cancellation with graceful shutdown
  - Task restart capability
  - Configurable parallel task limits

- **Intelligent Parallel Agent Execution**
  - Automatic task analysis and decomposition
  - File conflict and dependency detection
  - Per-agent branch and container isolation
  - Sequential branch merging with conflict detection
  - Graceful fallback to sequential execution

- **ServiceNow Platform Agents** (8 specialized agents)
  - sn-api: REST API and GlideAjax development
  - sn-flows: Flow Designer and IntegrationHub
  - sn-scripting: Business rules and client scripts
  - sn-ui: Service Portal and UI Builder
  - sn-integration: External system integration
  - sn-security: ACL and security audits
  - sn-testing: ATF automated testing
  - sn-performance: Query and performance optimization

**✨ Enhancements**
- Status command redesigned for background tasks
- New logs command with follow mode
- New cancel command with interactive selection
- New restart command for failed tasks
- Enhanced orchestrator with parallel workflow
- Task state persistence system

**📊 Statistics**
- 4,427 lines of code added (including ServiceNow agents)
- 8 new components (3 parallel execution + 5 state management)
- 15 total specialized agents (7 standard + 8 ServiceNow)
- 13 files modified/created
- 75/75 tests passing

### v0.13.0 (2025-10-29)

- Interactive installer with dependency validation
- Fully portable (no hardcoded paths)
- Auto-PR creation after task completion
- Pre-flight validation
- Comprehensive error handling

---

## Support

### Documentation
- [Installation Guide](INSTALLATION.md)
- [ServiceNow Agents Guide](SERVICENOW_AGENTS.md)
- [Phase 2: Background Execution](PHASE2_PLAN.md)
- [Phase 3: Parallel Execution](PHASE3_PLAN.md)
- [Test Results](TEST_RESULTS_PHASE2_PHASE3.md)

### Issues
Report issues at: https://github.com/Trip-Lee/claude-automation/issues

### License
MIT

---

**Built with ❤️ using Claude Code**
