# Claude Multi-Agent Coding System

**Version**: v0.13.0
**Status**: ✨ Fully Installable & Portable - Ready for Production
**Date**: 2025-10-29

---

## Overview

An intelligent, **installable** multi-agent coding system that uses **dynamic routing** to automatically select and orchestrate specialized AI agents for coding tasks. Now features a professional installer, automatic PR creation, comprehensive error handling, and works on any system.

### Key Features

#### 🆕 Installation & Portability (v0.13.0)
- **Interactive Installer** - Guided setup with dependency validation
- **Fully Portable** - Works on any system, any user (no hardcoded paths)
- **Auto-Configuration** - Creates all directories and config files
- **Dependency Validation** - Checks Node.js, Docker, Git, GitHub CLI

#### 🤖 AI & Agents
- **Dynamic Agent Routing** - Agents decide next steps intelligently
- **7 Specialized Agents** - Architect, Coder, Reviewer, Security, Documenter, Tester, Performance
- **External Tools System** - Extensible tool integration (ServiceNow, Jira, etc.)
- **Session Continuity** - Agents share context across workflow

#### 🚀 Workflow & Integration
- **Auto-PR Creation** - PRs created automatically after task completion (v0.13.0)
- **Workflow Mode** - Interactive guided workflow (just run `claude`)
- **In-Workflow Project Creation** - Create projects directly from dropdown menu
- **GitHub Integration** - Auto-validation, repo creation, PR management
- **Pre-flight Validation** - Catches errors before expensive agent execution (v0.13.0)

#### 🔒 Security & Reliability
- **Docker Isolation** - Each task runs in isolated container
- **Comprehensive Error Handling** - Clear, actionable error messages (v0.13.0)
- **Cost Tracking** - Monitor API usage per task
- **Automatic Cleanup** - Containers removed after completion
- **Professional CLI** - Clean, emoji-free interface

---

## Quick Start

### 1. Install

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/claude-automation.git
cd claude-automation

# Install dependencies
npm install

# Run interactive installer
node install.js
```

The installer will:
- ✅ Validate system dependencies (Node.js 20+, Docker, Git)
- ✅ Create required directories
- ✅ Prompt for API keys (Anthropic required, GitHub optional)
- ✅ Create `~/.env` configuration
- ✅ Link `claude` command globally
- ✅ Create example project config

### 2. Create Your First Project

```bash
# Copy example config
cp ~/.claude-projects/example-project.yaml ~/.claude-projects/my-project.yaml

# Edit with your details
nano ~/.claude-projects/my-project.yaml
```

### 3. Run Your First Task

```bash
# Interactive workflow mode
claude

# Or direct task mode
claude task my-project "Add documentation to README"
```

**That's it!** The system will:
1. Validate GitHub repository
2. Execute task with dynamic agents
3. Auto-create pull request
4. Display PR URL for review

For detailed installation instructions, see **[INSTALLATION.md](INSTALLATION.md)**

---

## 🆕 What's New in v0.13.0

### Installation & Portability
- ✅ **Interactive Installer** - Automated setup with dependency validation
- ✅ **Fully Portable** - Works on any system/user (no hardcoded paths)
- ✅ **Global Configuration** - Centralized config management
- ✅ **Auto-Directory Creation** - All directories created automatically

### Workflow Improvements
- ✅ **Auto-PR Creation** - PRs created automatically after tasks (no manual approval!)
- ✅ **Pre-flight Validation** - Catches errors before expensive agent execution
- ✅ **Comprehensive Error Handling** - Clear, actionable error messages with solutions
- ✅ **SSH URL Support** - Fixed parsing for `git@github.com:user/repo.git` format

### Developer Experience
- ✅ **System Validator** - Checks Node.js, Docker, Git, GitHub CLI automatically
- ✅ **Better Error Messages** - All GitHub API errors now include fix instructions
- ✅ **Configurable Paths** - Customize all directory locations via config
- ✅ **Example Configs** - Auto-generated project config templates

**Migration from v0.12.x**: Run `node install.js` to update paths and configuration. See [CHANGELOG.md](docs/CHANGELOG.md) for full details.

---

## Usage

### Workflow Mode (Interactive)

**Simplest way to use the system:**

```bash
claude
```

You'll be guided through:
```
Claude Multi-Agent Coding System
Workflow: Project -> Task -> Execute -> Approve

? Select project: (Use arrow keys)
    my-app
    test-project
  ─────────────────
  + Create New Project

? What would you like me to do? [your task]
[automatic repo validation]
[dynamic agent execution]
? Approve/Reject/Hold? [your choice]
[auto cleanup]
```

Perfect for:
- First-time users
- Interactive sessions
- Learning the system
- Quick project creation

---

### Command Line Mode

**For scripting and automation:**

```bash
# Create project
claude add-project my-app

# Run task
claude task my-app "Add user authentication"

# Approve (creates PR)
claude approve <taskId>

# Reject (deletes branch)
claude reject <taskId>

# Show status
claude status

# List projects
claude list-projects

# Show diff
claude diff <taskId>
```

Perfect for:
- Automation/scripts
- CI/CD pipelines
- Power users

---

## Dynamic Agent Routing

### How It Works

**Old System (Hardcoded):**
```
Every task: Architect -> Coder -> Reviewer
```
- Wastes time on simple tasks
- Can't skip unnecessary steps
- Can't add specialized agents

**New System (Dynamic):**
```
Each task gets optimal agents based on requirements
```
- Simple fixes: Coder -> Reviewer (skip Architect!)
- Analysis: Architect -> Reviewer (skip Coder!)
- Security: Architect -> Security -> Coder -> Security -> Reviewer
- Agents decide next step via NEXT:/REASON: format

### Performance Improvements

| Task Type | Old Duration | New Duration | Improvement |
|-----------|-------------|--------------|-------------|
| Analysis only | ~245s | ~100s | **59% faster** |
| Simple fixes | ~245s | ~90s | **63% faster** |
| Complex tasks | ~245s | ~250s | Similar (more thorough) |

### The 7 Agents

1. **Architect** - Analysis, planning, architecture design
2. **Coder** - Implementation, code changes, feature development
3. **Reviewer** - Quality assurance, code review, validation
4. **Security** - Security scanning, vulnerability detection
5. **Documenter** - Documentation writing, API docs
6. **Tester** - Test engineering, test case creation
7. **Performance** - Performance analysis, optimization

---

## GitHub Integration

### Automatic Repo Validation

When you run a task, the system:
1. Checks if GitHub repo exists
2. Offers to create it if missing
3. Clones new repos automatically
4. Sets up git remote properly

### Repository Creation

**Option 1: Via Add Project Command**
```bash
claude add-project my-app
```

**Option 2: During Workflow (New!)**
```bash
claude
? Select project: + Create New Project
```

**The wizard will:**
- Ask for project details
- Validate GitHub repository
- Offer to create repo if it doesn't exist
- Clone repo to local machine
- Generate complete project config

### Pull Request Creation (Auto-Created in v0.13.0!)

**🆕 Automatic PR Creation:**
After task completion, the system automatically:
- Pushes branch to GitHub
- Creates pull request with detailed description
- Includes test results and metrics
- Displays PR URL for immediate review
- Links to task ID for tracking

**Manual PR Creation (if auto-creation fails):**
```bash
claude approve <taskId>
```

**What changed in v0.13.0:**
- ✅ No more manual approval prompts
- ✅ PRs created immediately after task completion
- ✅ Full context always available in GitHub
- ✅ Faster workflow (no context switching)

---

## External Tools System

### Overview

The tools system allows agents to use external tools to extend their capabilities beyond core functionality. Tools are automatically discovered, mounted read-only in containers, and integrated into agent prompts.

### Available Tools

**ServiceNow Tools (sn-tools v2.1.0)**

A comprehensive ServiceNow development toolkit that enables agents to interact with ServiceNow instances directly. Designed for ServiceNow developers who need to automate workflows, analyze dependencies, and sync code changes in real-time.

**What Problems It Solves:**
- **Manual CRUD Operations** - Eliminates manual record creation/updates via ServiceNow UI
- **Dependency Blindness** - Maps Script Include dependencies and Flow relationships automatically
- **Multi-Environment Complexity** - Manages separate dev/prod instances with intelligent routing
- **Code Synchronization** - Watches local files and syncs changes to ServiceNow in real-time
- **Impact Assessment** - Analyzes change impact across the ServiceNow platform before deployment

**Key Capabilities:**
- Query and modify ServiceNow records (Script Includes, Flows, REST APIs, any table)
- Multi-instance support with automatic routing (dev/prod environments)
- Dependency tracking and impact analysis with visual graph generation
- Real-time file watching and automatic syncing to ServiceNow
- Flow tracing and execution path analysis
- AI-powered record creation and code analysis
- Cross-platform support (Windows, macOS, Linux)

**Getting Started with sn-tools:**
See "Using ServiceNow Tools" section below for setup instructions.

### How It Works

**For Agents:**
1. Tools automatically mounted at `/tools:ro` (read-only)
2. Tool context added to agent prompts
3. Agents see capabilities, usage, and examples
4. Agents can execute tools via Bash or dedicated interface

**For Users:**
- Zero configuration required
- Tools available to all agents automatically
- Credentials managed via environment variables

### Using ServiceNow Tools

**1. Set Credentials (if using sn-tools):**
```bash
# Add to ~/.env
SNTOOL_DEV_URL=https://your-dev.service-now.com
SNTOOL_DEV_USERNAME=your_username
SNTOOL_DEV_PASSWORD=your_password
```

**2. Run Task:**
```bash
claude task my-project "Check ServiceNow connectivity"
```

Agents will automatically see and can use sn-tools!

### Adding New Tools

**1. Create Tool Directory:**
```bash
mkdir -p ~/claude-automation/tools/my-tool
```

**2. Copy Template:**
```bash
cp ~/claude-automation/tools/template/tool-manifest.yaml \
   ~/claude-automation/tools/my-tool/
```

**3. Fill in Manifest** (with accurate descriptions):
- Name, version, description
- List all capabilities
- Provide usage examples
- Define environment variables

**4. Add Tool Code:**
- Place executable scripts
- Install dependencies
- Test tool

**See `tools/README.md` for complete guide.**

### Tool Security

- **Read-Only Mounting**: Agents can execute but not modify tools
- **Namespaced Env Vars**: Tools use prefixed variables (e.g., `SNTOOL_*`)
- **Container Isolation**: Tools run in isolated Docker containers
- **Validation**: Prerequisites checked before execution

**Documentation**: See `TOOLS_SYSTEM.md` for complete implementation details.

---

## Project Configuration

Projects are configured via YAML files in `~/.claude-projects/`:

```yaml
# ~/.claude-projects/my-app.yaml
name: my-app
repo: github.com/username/my-app
base_branch: main

pr:
  title_prefix: '[my-app]'
  auto_merge: false
  reviewers: []
  labels:
    - automated

docker:
  image: claude-python:latest
  memory: 1g
  cpus: 2
  network_mode: none

tests:
  command: 'pytest'
  timeout: 30
  required: true

safety:
  max_cost_per_task: 2.0
  max_duration: 300
```

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────┐
│                 CLI / Workflow                  │
│            (cli.js - Entry Point)               │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│              Orchestrator                       │
│        (Manages Complete Workflow)              │
└────────────────┬────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ↓            ↓            ↓
┌─────────┐  ┌──────────┐  ┌──────────┐
│  Task   │  │ Dynamic  │  │ GitHub   │
│ Planner │  │ Executor │  │ Client   │
└─────────┘  └──────────┘  └──────────┘
    │            │            │
    ↓            ↓            ↓
┌─────────┐  ┌──────────┐  ┌──────────┐
│  Agent  │  │  Claude  │  │   Git    │
│Registry │  │   Code   │  │ Manager  │
└─────────┘  └──────────┘  └──────────┘
```

### Workflow Sequence

```
1. User Input (workflow mode or CLI)
2. Project Selection/Creation (dropdown with create option)
3. GitHub Repo Validation (create if needed)
4. Docker Container Setup
5. Task Planning (select optimal agents)
6. Dynamic Agent Execution
   └─> Agent 1 (e.g., Architect)
       └─> Decision: NEXT: coder
           └─> Agent 2 (Coder)
               └─> Decision: NEXT: reviewer
                   └─> Agent 3 (Reviewer)
                       └─> Decision: NEXT: COMPLETE
7. Test Execution
8. Summary Generation
9. User Decision (Approve/Reject/Hold)
10. Auto Cleanup
```

---

## File Structure

```
claude-automation/
├── cli.js                          # Entry point & workflow mode
├── package.json                    # Dependencies
├── .env                            # Configuration (create this)
│
├── lib/
│   ├── orchestrator.js             # Main orchestrator (with dynamic routing + tools)
│   ├── agent-registry.js           # Agent management
│   ├── standard-agents.js          # 7 pre-configured agents
│   ├── task-planner.js             # Task analysis & planning
│   ├── dynamic-agent-executor.js   # Agent execution with handoff
│   ├── claude-code-agent.js        # Claude Code CLI wrapper
│   ├── conversation-thread.js      # Shared conversation context
│   ├── tool-registry.js            # Tool discovery & management
│   ├── tool-executor.js            # Tool execution with fallback
│   ├── github-client.js            # GitHub API integration
│   ├── git-manager.js              # Git operations
│   ├── docker-manager.js           # Docker container management + tools mount
│   ├── cost-monitor.js             # API cost tracking
│   └── config-manager.js           # Project config loading
│
├── tools/                          # External tools directory
│   ├── README.md                   # Tools documentation
│   ├── sn-tools/                   # ServiceNow tools
│   │   ├── tool-manifest.yaml     # Tool definition
│   │   └── ServiceNow-Tools/      # Tool code
│   └── template/                   # Template for new tools
│       └── tool-manifest.yaml
│
├── test/
│   ├── unit/                       # Unit tests
│   ├── smoke-test.js               # Smoke tests
│   ├── validation-suite.js         # Validation tests
│   └── container-tools.js          # Docker tool interface
│
└── docs/
    ├── README.md                   # This file
    ├── STATUS.md                   # Project status
    ├── CHANGELOG.md                # Version history
    ├── TOOLS_SYSTEM.md             # Tools implementation guide
    ├── TESTING.md                  # Testing guide
    ├── WORKFLOW_MODE_GUIDE.md      # Workflow mode documentation
    ├── ADD_PROJECT_GUIDE.md        # Project setup guide
    └── DYNAMIC_ROUTING_COMPLETE.md # Dynamic routing details
```

---

## Examples

### Example 1: Simple Bug Fix

```bash
$ claude

? Select project: my-website
? What would you like me to do? Fix typo in login error message

Executing Task...

Planning: [coder, reviewer] (skips architect for simple fix)

CODER: Fixes typo
REVIEWER: Approves

Task Complete! (90s, $0.06)

? What would you like to do? Approve & Create PR

PR Created!
```

**Duration**: ~90s (vs ~245s with old system = 63% faster!)

---

### Example 2: New Feature

```bash
$ claude

? Select project: api-backend
? What would you like me to do? Add JWT authentication

Executing Task...

Planning: [architect, security, coder, security, reviewer]

ARCHITECT: Designs auth system
SECURITY: Reviews security requirements
CODER: Implements JWT auth
SECURITY: Validates implementation
REVIEWER: Final approval

Task Complete! (300s, $0.10)

? What would you like to do? Approve & Create PR

PR Created!
```

**Duration**: ~300s (worth it for security validation!)

---

### Example 3: Analysis Only

```bash
$ claude

? Select project: mobile-app
? What would you like me to do? Analyze code quality and suggest improvements

Executing Task...

Planning: [architect, reviewer] (skips coder - no changes!)

ARCHITECT: Analyzes code quality
REVIEWER: Validates analysis

Task Complete! (100s, $0.04)

? What would you like to do? Hold for Later Review

Task held - no PR needed (analysis only)
```

**Duration**: ~100s (vs ~245s = 59% faster!)
**No PR needed**: Analysis only, no code changes

---

### Example 4: Create Project in Workflow (New!)

```bash
$ claude

Claude Multi-Agent Coding System
Workflow: Project -> Task -> Execute -> Approve

? Select project: (Use arrow keys)
    test-project
    my-website
  ─────────────────
  + Create New Project

[Select "Create New Project"]

Creating New Project

? Project name: my-new-api
? Project description: My awesome API project
? Local project path: /home/user/projects/my-new-api
? Base branch: main
? Docker image: claude-python:latest
? GitHub repository (owner/repo): username/my-new-api

Project 'my-new-api' configured!
Config saved: /home/user/.claude-projects/my-new-api.yaml

Note: GitHub repo will be validated/created in the next step.

? What would you like me to do? Add user authentication

[continues with normal workflow...]
```

---

## Requirements

### System Requirements
- **OS**: Linux, macOS, or WSL2 on Windows
- **Node.js**: v20.0.0 or higher (validated by installer)
- **Docker**: For container isolation (validated by installer)
- **Git**: For repository management (validated by installer)
- **GitHub CLI (gh)**: Optional but recommended (validated by installer)

**The installer validates all requirements automatically!**

### API Keys
- **ANTHROPIC_API_KEY**: **Required** for Claude API (installer prompts for this)
- **GITHUB_TOKEN**: Optional but recommended for PR creation and repo access (installer prompts)

---

## Configuration

### Automatic Configuration (v0.13.0)

The installer (`node install.js`) automatically:
- ✅ Creates `~/.env` with your API keys
- ✅ Creates all required directories
- ✅ Generates example project config
- ✅ Sets up global config at `~/.claude-automation/config.json`

### Manual Configuration

If you need to add keys later, edit `~/.env`:

```bash
# Required: Anthropic API for Claude
ANTHROPIC_API_KEY=sk-ant-your_api_key_here

# Optional: GitHub for PR creation
GITHUB_TOKEN=ghp_your_github_token

# Optional: Docker defaults
DEFAULT_DOCKER_MEMORY=4g
DEFAULT_DOCKER_CPUS=2

# Optional: Safety defaults
DEFAULT_MAX_COST=5.00
```

### API Key Setup

**Anthropic API Key** (Required):
1. Go to https://console.anthropic.com/settings/keys
2. Create new API key
3. Copy key (starts with `sk-ant-`)

**GitHub Token** (Optional):
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes:
   - `repo` - Full control of repositories
4. Copy token (starts with `ghp_` or `github_pat_`)

**The installer guides you through this!**

---

## Troubleshooting

### Installation Issues

**"Docker daemon is not running"**
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

**"Node.js version too old"**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**"command not found: claude"**
```bash
cd /path/to/claude-automation
npm link
```

**For comprehensive troubleshooting**, see **[INSTALLATION.md](INSTALLATION.md)**

### Usage Issues

**"No projects configured"**
```bash
claude add-project my-first-project
```
Or use the "+ Create New Project" option in the workflow dropdown!

**"ANTHROPIC_API_KEY is not set"**
Add to `~/.env` or run the installer again:
```bash
node install.js
```

**"Repository not found"**
The workflow will offer to create it for you!

**"Docker not running"**
```bash
sudo systemctl start docker
```

**"Container cleanup needed"**
Happens automatically after each workflow!

---

## Development

### Running Tests

```bash
npm test
```

### Manual Testing

```bash
# Test workflow mode
claude

# Test specific command
claude task test-project "Add feature"

# Validate syntax
node --check cli.js
node --check lib/orchestrator.js
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| `README.md` | Main documentation (this file) |
| `WORKFLOW_MODE_GUIDE.md` | Complete workflow mode guide |
| `ADD_PROJECT_GUIDE.md` | Project setup documentation |
| `DYNAMIC_ROUTING_COMPLETE.md` | Dynamic routing implementation |
| `DYNAMIC_ROUTING_DESIGN.md` | Technical architecture design |
| `STATUS.md` | Current project status |

---

## Roadmap

### Completed (v0.11.2)
- Dynamic agent routing
- Workflow mode
- In-workflow project creation dropdown
- Professional emoji-free CLI
- GitHub repo validation & creation
- Auto cleanup
- 7 specialized agents
- Cost tracking
- Session continuity

### Next Steps
- Integration testing
- Performance benchmarking
- Unit test coverage
- Advanced agent types (API Designer, DevOps, UI/UX)
- Parallel agent execution
- Learning from outcomes

---

## Contributing

This is an active development project. Key areas for contribution:
- New agent types
- Test coverage
- Performance optimization
- Documentation improvements
- Bug reports and fixes

---

## License

MIT

---

## Quick Reference

```bash
# Workflow mode (recommended)
claude

# Add project
claude add-project <name>

# Run task
claude task <project> "<description>"

# Approve
claude approve <taskId>

# Reject
claude reject <taskId>

# Status
claude status

# Help
claude --help
```

---

**Ready to start?**

```bash
claude
```

Just run it and follow the prompts!
