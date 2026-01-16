# Claude Automation

AI-powered development orchestration CLI using multi-agent workflows.

**Version**: 0.15.0

## Quick Start

```bash
# Install
git clone --recurse-submodules https://github.com/Trip-Lee/claude-automation.git
cd claude-automation
npm install
node install.js

# Run interactive CLI
dev-tools

# Run a task directly
dev-tools task my-project "Add user authentication"

# Run in background
dev-tools task -b my-project "Refactor database layer"
dev-tools status
dev-tools logs -f <taskId>
```

## What It Does

- Orchestrates multiple Claude agents (Architect, Coder, Reviewer)
- Runs code in isolated Docker containers
- Manages Git branches and GitHub PRs automatically
- Supports background task execution with parallel agents
- Includes ServiceNow integration via MCP tools

## Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.0.0+ | Runtime |
| Docker | 20.10.0+ | Container isolation |
| Git | 2.30.0+ | Version control |
| GitHub CLI | 2.0.0+ | GitHub integration (optional) |

**API Keys Required**:
- `ANTHROPIC_API_KEY` - Get from https://console.anthropic.com/
- `GITHUB_TOKEN` - Get from https://github.com/settings/tokens (scope: `repo`)

## Commands

### Interactive Mode
```bash
dev-tools              # Launch interactive CLI
```

### Task Execution
```bash
dev-tools task <project> "<description>"     # Run task
dev-tools task -b <project> "<description>"  # Run in background
```

### Background Task Management
```bash
dev-tools status                    # List running tasks
dev-tools logs <taskId>             # View task logs
dev-tools logs -f <taskId>          # Stream logs (follow)
dev-tools cancel <taskId>           # Cancel task
dev-tools restart -b <taskId>       # Restart failed task
```

### Project Management
```bash
dev-tools add-project <name>        # Add new project
dev-tools validate                  # Validate system setup
```

## Configuration

Projects are configured in `~/.claude-projects/<project>.yaml`:

```yaml
name: my-project
repo: github.com/username/repo
base_branch: main

docker:
  image: node:20
  memory: 4g
  cpus: 2

safety:
  max_cost_per_task: 5.00
```

## Error Handling

The system validates prerequisites before executing tasks:

| Check | Error | Fix |
|-------|-------|-----|
| Config missing | "Project configuration not found" | Run `dev-tools add-project <name>` |
| Docker not running | "Docker daemon not running" | Start Docker |
| Invalid token | "GitHub authentication failed" | Update `~/.env` with valid token |
| Repo not found | "GitHub repository not found" | Create repo or use `repo: local` |
| No git remote | "Git remote 'origin' not configured" | Run `git remote add origin <url>` |

Errors are caught early (before agent execution) to avoid wasting time and API costs.

## Project Structure

```
claude-automation/
├── cli.js                    # Main CLI entry point
├── install.js                # Interactive installer
├── background-worker.js      # Background task runner
├── lib/                      # Core modules
│   ├── orchestrator.js       # Main workflow orchestration
│   ├── claude-code-agent.js  # Claude agent wrapper
│   ├── docker-manager.js     # Docker container management
│   ├── git-manager.js        # Git operations
│   ├── github-client.js      # GitHub API integration
│   └── ...
├── mcp/                      # MCP server for ServiceNow tools
├── test/                     # Test suite
├── docs/                     # Additional documentation
└── tools/                    # External tools (sn-tools submodule)
```

## Testing

```bash
npm test                      # Unit tests (~60s)
npm run test:smoke            # Quick health check (<30s)
npm run test:all              # Full test suite (~9 min)
npm run test:servicenow       # ServiceNow tests (~2.5 hours)
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [INSTALLATION.md](INSTALLATION.md) | Detailed installation guide |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [MCP_GUIDE.md](MCP_GUIDE.md) | MCP integration for ServiceNow |
| [docs/DEV-TOOLS-GUIDE.md](docs/DEV-TOOLS-GUIDE.md) | Interactive CLI guide |
| [docs/TESTING.md](docs/TESTING.md) | Testing reference |
| [docs/GITHUB_INTEGRATION.md](docs/GITHUB_INTEGRATION.md) | GitHub setup |

## License

MIT
