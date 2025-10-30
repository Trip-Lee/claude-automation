# Claude Multi-Agent Coding System - Installation Guide

**Version**: v0.14.0
**Date**: 2025-10-30

Complete installation guide for Claude Multi-Agent Coding System with background execution and parallel agents.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Installation](#quick-installation)
3. [Detailed Installation Steps](#detailed-installation-steps)
4. [Post-Installation Configuration](#post-installation-configuration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Upgrading](#upgrading)
8. [Uninstallation](#uninstallation)

---

## Prerequisites

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Node.js | 18.0.0+ | JavaScript runtime |
| Docker | 20.10.0+ | Container isolation |
| Git | 2.30.0+ | Version control |
| GitHub CLI | 2.0.0+ | GitHub integration (optional but recommended) |

### System Requirements

- **OS**: Linux, macOS, or Windows with WSL2
- **RAM**: 8GB minimum (16GB recommended for parallel execution)
- **Disk Space**: 10GB minimum
- **Network**: Internet connection for API calls

### API Keys

- **Anthropic API Key** (Required)
  - Sign up at: https://console.anthropic.com/
  - Navigate to API Keys section
  - Create new key starting with `sk-ant-`

- **GitHub Personal Access Token** (Optional but recommended)
  - Go to: https://github.com/settings/tokens
  - Generate new token (classic)
  - Required scopes: `repo`, `workflow`
  - Token starts with `ghp_` or `github_pat_`

---

## Quick Installation

For experienced users:

```bash
# 1. Clone and install
git clone https://github.com/Trip-Lee/claude-automation.git
cd claude-automation
npm install

# 2. Run installer
node install.js

# 3. Configure a project
cp ~/.claude-projects/example-project.yaml ~/.claude-projects/my-project.yaml
nano ~/.claude-projects/my-project.yaml

# 4. Run your first task
dev-tools task my-project "Add README"

# 5. Try background execution (NEW in v0.14.0)
dev-tools task -b my-project "Add documentation"
dev-tools status
dev-tools logs -f <taskId>
```

---

## Detailed Installation Steps

### Step 1: Check Prerequisites

```bash
# Check Node.js version (need 18.0.0+)
node --version

# Check Docker
docker --version
docker ps  # Should not error

# Check Git
git --version

# Check GitHub CLI (optional)
gh --version
```

If any are missing, install them:

#### Ubuntu/Debian
```bash
# Node.js (via nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in

# Git
sudo apt update
sudo apt install git

# GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

#### macOS
```bash
# Using Homebrew
brew install node docker git gh
```

### Step 2: Clone Repository

```bash
git clone https://github.com/Trip-Lee/claude-automation.git
cd claude-automation
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run Interactive Installer

```bash
node install.js
```

The installer will:
1. ✅ Validate system dependencies
2. ✅ Create required directories
3. ✅ Prompt for API keys
4. ✅ Create `~/.env` file
5. ✅ Link `dev-tools` command globally
6. ✅ Create example project configuration

---

## Post-Installation Configuration

### Create Your First Project

```bash
# Copy example config
cp ~/.claude-projects/example-project.yaml ~/.claude-projects/my-project.yaml

# Edit configuration
nano ~/.claude-projects/my-project.yaml
```

Example configuration:
```yaml
name: my-project
repo: github.com/your-username/your-repo
base_branch: main

docker:
  memory: 4g
  cpus: 2

safety:
  max_cost_per_task: 5.00
```

### Configure Global Settings (Optional)

Edit `~/.claude-automation/config.json`:

```json
{
  "maxParallelTasks": 10,
  "docker": {
    "defaultMemory": "4g",
    "defaultCpus": 2
  },
  "safety": {
    "maxCostPerTask": 5.00
  }
}
```

---

## Verification

### Run System Validation

```bash
dev-tools validate
```

### Test Basic Functionality

```bash
# Interactive mode
dev-tools

# Direct mode
dev-tools task test-project "Add README"

# Background mode (NEW in v0.14.0)
dev-tools task -b test-project "Add documentation"
dev-tools status
```

---

## Troubleshooting

### Installation Issues

#### "npm install" fails
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### "Docker daemon not running"
```bash
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and back in
```

#### "Permission denied" when linking CLI
```bash
# Option 1: Use sudo
sudo npm link

# Option 2: Use alias
echo 'alias dev-tools="node $(pwd)/cli.js"' >> ~/.bashrc
source ~/.bashrc
```

### Runtime Issues

#### "No running tasks" but task is running
```bash
ps aux | grep background-worker
kill -9 <PID>
rm -rf ~/.claude-tasks/<taskId>
```

#### "Max parallel tasks reached"
```bash
# Edit config
nano ~/.claude-automation/config.json
# Increase: "maxParallelTasks": 20
```

---

## Upgrading

### From v0.13.0 to v0.14.0

```bash
cd ~/claude-automation
git pull origin main
npm install
dev-tools --version  # Should show 0.14.0
```

### New Features in v0.14.0

- Background task execution
- Intelligent parallel agent coordination
- Real-time task monitoring
- Log streaming
- Task cancellation and restart

Test new features:
```bash
# Background execution
dev-tools task -b my-project "Add tests"

# Monitor tasks
dev-tools status
dev-tools logs -f <taskId>

# Cancel task
dev-tools cancel <taskId>

# Restart task
dev-tools restart -b <taskId>
```

---

## Uninstallation

### Complete Uninstallation

```bash
# Remove CLI link
npm unlink dev-tools

# Remove installation
rm -rf ~/claude-automation

# Remove data (optional)
rm -rf ~/.claude-projects
rm -rf ~/.claude-tasks
rm -rf ~/.claude-logs
rm -rf ~/.claude-automation
rm ~/.env
```

---

## Directory Structure After Installation

```
~/.claude-automation/
└── config.json               # Global configuration

~/.claude-projects/
├── example-project.yaml      # Example configuration
└── my-project.yaml           # Your projects

~/.claude-tasks/
└── <taskId>/                 # Task states (NEW in v0.14.0)
    ├── state.json
    ├── metadata.json
    └── subtasks/             # Parallel subtasks

~/.claude-logs/
└── <taskId>.log              # Task logs (NEW in v0.14.0)

~/.env                        # API keys

~/projects/                   # Project repositories
```

---

## Support

### Documentation
- [Main README](README.md) - Feature overview
- [Phase 2 Plan](PHASE2_PLAN.md) - Background execution
- [Phase 3 Plan](PHASE3_PLAN.md) - Parallel execution
- [Test Results](TEST_RESULTS_PHASE2_PHASE3.md) - Validation

### Getting Help
- **GitHub Issues**: https://github.com/Trip-Lee/claude-automation/issues
- **Validation**: `dev-tools validate`
- **Logs**: `~/.claude-logs/<taskId>.log`

---

**Installation complete! Start building with AI agents.**
