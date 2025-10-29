# Claude Automation - Installation Guide

Complete installation guide for Claude Multi-Agent Coding System v0.13.0

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Quick Install](#quick-install)
3. [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Uninstall](#uninstall)

---

## System Requirements

### Required Dependencies

| Dependency | Minimum Version | Purpose | Install Command |
|------------|----------------|---------|-----------------|
| **Node.js** | >= 20.0.0 | Runtime environment | [nodejs.org](https://nodejs.org) |
| **Docker** | Latest | Container execution | [docs.docker.com/install](https://docs.docker.com/engine/install/) |
| **Git** | Any recent | Version control | `sudo apt install git` |

### Optional Dependencies

| Dependency | Purpose | Install Command |
|------------|---------|-----------------|
| **GitHub CLI (gh)** | Easier GitHub integration | `sudo apt install gh` |

### System Resources

- **RAM**: Minimum 8GB (16GB recommended for multiple agents)
- **Disk**: 10GB free space (for Docker images and project data)
- **Network**: Internet connection for API calls and Docker image pulls

---

## Quick Install

The fastest way to get started:

```bash
# 1. Clone or download the repository
git clone https://github.com/YOUR_USERNAME/claude-automation.git
cd claude-automation

# 2. Install dependencies
npm install

# 3. Run the installer
node install.js

# 4. Start using Claude Automation
claude
```

The installer will:
- ✅ Validate system dependencies
- ✅ Create required directories
- ✅ Set up configuration files
- ✅ Prompt for API keys
- ✅ Link the `claude` command globally

---

## Manual Installation

If you prefer manual setup or the automated installer fails:

### Step 1: Install System Dependencies

#### Node.js (>= 20.0.0)

```bash
# Check current version
node --version

# Install Node.js 20+ if needed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (avoids sudo)
sudo usermod -aG docker $USER

# Start Docker daemon
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
docker info
```

#### Git

```bash
# Install Git
sudo apt install git

# Verify installation
git --version
```

#### GitHub CLI (Optional)

```bash
# Install GitHub CLI
sudo apt install gh

# Authenticate
gh auth login
```

### Step 2: Install Claude Automation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/claude-automation.git
cd claude-automation

# Install npm dependencies
npm install
```

### Step 3: Create Directory Structure

```bash
# Create required directories
mkdir -p ~/.claude-projects
mkdir -p ~/.claude-tasks
mkdir -p ~/.claude-logs/costs
mkdir -p ~/projects

# Create global config directory
mkdir -p ~/.claude-automation
```

### Step 4: Configure API Keys

Create `~/.env` with your API keys:

```bash
# Create .env file
cat > ~/.env << 'EOF'
# Claude Automation Configuration

# Required: Anthropic API Key for Claude
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Optional: GitHub Personal Access Token
GITHUB_TOKEN=ghp_your-github-token-here

# Optional: Docker defaults
DEFAULT_DOCKER_MEMORY=4g
DEFAULT_DOCKER_CPUS=2

# Optional: Safety defaults
DEFAULT_MAX_COST=5.00
EOF

# Secure the file
chmod 600 ~/.env
```

**Where to get API keys:**

- **Anthropic API Key**: https://console.anthropic.com/settings/keys
  - Required for all Claude API calls
  - Format: `sk-ant-...`

- **GitHub Token**: https://github.com/settings/tokens
  - Optional but recommended for PR creation
  - Required scopes: `repo`
  - Format: `ghp_...` or `github_pat_...`

### Step 5: Link CLI Command

```bash
# Link the claude command globally
npm link

# Or create a manual symlink
sudo ln -s $(pwd)/cli.js /usr/local/bin/claude
```

### Step 6: Create Example Project Config

```bash
# Copy example config
cat > ~/.claude-projects/example-project.yaml << 'EOF'
name: example-project
repo: github.com/your-username/your-repo
base_branch: main

protected_branches:
  - main
  - master

docker:
  image: anthropics/claude-code-agent:latest
  memory: 4g
  cpus: 2
  network_mode: none

safety:
  max_cost_per_task: 5.00
  allow_dependency_changes: false
EOF
```

---

## Configuration

### Global Configuration

Located at `~/.claude-automation/config.json`:

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
  }
}
```

**Customizing paths**: Edit this file to change default directory locations.

### Project Configuration

Each project needs a config file in `~/.claude-projects/`:

```yaml
# ~/.claude-projects/my-project.yaml

name: my-project
repo: github.com/username/my-repo
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

# Optional: CI/CD commands
tests:
  command: npm test
  timeout: 300

lint:
  command: npm run lint
  autofix: true

security:
  command: npm audit
  fail_on_high: true
```

---

## Verification

### Verify Installation

```bash
# Check system dependencies
node install.js

# Or run quick check
claude --version

# Test with a simple task
claude task example-project "Add a test comment to README"
```

### Health Check

```bash
# Verify all components
docker --version          # Should show Docker version
git --version            # Should show Git version
node --version           # Should show Node.js 20+
claude --help            # Should show CLI help

# Check Docker daemon
docker info              # Should show Docker system info

# Verify directories
ls -la ~/.claude-projects
ls -la ~/.claude-tasks
ls -la ~/.claude-logs
```

---

## Troubleshooting

### Common Issues

#### 1. "Docker daemon is not running"

```bash
# Start Docker daemon
sudo systemctl start docker

# Enable Docker on boot
sudo systemctl enable docker

# Check status
sudo systemctl status docker
```

#### 2. "Permission denied" when running Docker

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or run:
newgrp docker

# Verify
docker ps
```

#### 3. "command not found: claude"

```bash
# Re-link the command
cd /path/to/claude-automation
npm link

# Or run directly
node /path/to/claude-automation/cli.js
```

#### 4. "ANTHROPIC_API_KEY is not set"

```bash
# Check if .env exists
cat ~/.env

# If missing, create it
echo "ANTHROPIC_API_KEY=sk-ant-your-key" >> ~/.env
```

#### 5. "Node.js version is too old"

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
```

### Getting Help

- **Documentation**: See [README.md](README.md)
- **Changelog**: See [docs/CHANGELOG.md](docs/CHANGELOG.md)
- **Issues**: https://github.com/YOUR_USERNAME/claude-automation/issues

---

## Uninstall

To completely remove Claude Automation:

```bash
# 1. Unlink CLI command
npm unlink -g claude-automation
# Or: sudo rm /usr/local/bin/claude

# 2. Remove installation directory
cd ~
rm -rf /path/to/claude-automation

# 3. Optionally remove data (WARNING: This deletes all your project configs and task history)
# rm -rf ~/.claude-automation
# rm -rf ~/.claude-projects
# rm -rf ~/.claude-tasks
# rm -rf ~/.claude-logs

# 4. Optionally remove API keys
# rm ~/.env
```

**Note**: Keep `~/.claude-projects/` if you want to preserve your project configurations.

---

## Next Steps

After installation:

1. **Create a project config**: Copy `~/.claude-projects/example-project.yaml` and customize it
2. **Run your first task**: `claude task my-project "Add documentation"`
3. **Try workflow mode**: `claude` (interactive mode)
4. **Read the user guide**: See [README.md](README.md) for usage examples

---

## Advanced Configuration

### Custom Installation Directory

If installing to a non-standard location:

```bash
# Install to custom directory
git clone https://github.com/YOUR_USERNAME/claude-automation.git ~/my-custom-path/claude
cd ~/my-custom-path/claude
npm install
node install.js

# Link from custom location
npm link
```

### Multiple Installations

You can have multiple installations (e.g., stable vs. development):

```bash
# Stable installation
git clone -b v0.13.0 https://github.com/YOUR_USERNAME/claude-automation.git ~/claude-stable
cd ~/claude-stable
npm install
npm link

# Development installation
git clone https://github.com/YOUR_USERNAME/claude-automation.git ~/claude-dev
cd ~/claude-dev
npm install
# Don't link - run directly with node cli.js
```

### Custom Configuration Paths

Edit `~/.claude-automation/config.json` to customize paths:

```json
{
  "configDir": "/custom/path/to/configs",
  "tasksDir": "/custom/path/to/tasks",
  "logsDir": "/custom/path/to/logs",
  "projectsDir": "/custom/path/to/projects"
}
```

---

**Installation Version**: v0.13.0
**Last Updated**: 2025-10-29
