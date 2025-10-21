# GitHub Setup Guide

This guide helps you set up GitHub repositories for the claude-automation project and projects in the ~/projects folder.

---

## Quick Start: GitHub Authentication

First, you need a valid GitHub token for automated operations.

### Option 1: Use GitHub CLI (Recommended)

```bash
# Authenticate with GitHub CLI
gh auth login

# Select:
# - GitHub.com
# - HTTPS
# - Yes (authenticate Git with your GitHub credentials)
# - Login with a web browser (copy the code and open the URL)
```

After authentication, run:
```bash
./setup-github.sh
```

### Option 2: Use Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `repo` (full control of private repositories)
   - ✅ `workflow` (if you use GitHub Actions)
4. Generate token and copy it

5. Add to `~/.env`:
```bash
GITHUB_TOKEN=ghp_your_token_here
```

---

## Manual Setup for claude-automation

If automated setup doesn't work, follow these steps:

### Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `claude-automation`
3. Description: `Claude Multi-Agent Coding System - Mobile-accessible AI-powered development orchestration for Raspberry Pi`
4. Choose **Public** or **Private**
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

### Step 2: Connect Local Repository

Replace `YOUR_USERNAME` with your actual GitHub username:

```bash
cd /home/coltrip/claude-automation

# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/claude-automation.git

# Or if using SSH:
# git remote add origin git@github.com:YOUR_USERNAME/claude-automation.git

# Push to GitHub
git push -u origin master

# Verify
git remote -v
```

### Step 3: Verify on GitHub

Visit `https://github.com/YOUR_USERNAME/claude-automation` to see your code.

---

## Setup for Projects in ~/projects

You have two projects that need GitHub connections:

### 1. test-project

```bash
cd ~/projects/test-project

# Check if it has git
git status

# Check if it has a remote
git remote -v

# If no remote, create GitHub repo and add it:
git remote add origin https://github.com/YOUR_USERNAME/test-project.git
git push -u origin master
```

### 2. test-multi-agent

```bash
cd ~/projects/test-multi-agent

# Check if it has git
git status

# Check if it has a remote
git remote -v

# If no remote, create GitHub repo and add it:
git remote add origin https://github.com/YOUR_USERNAME/test-multi-agent.git
git push -u origin master
```

---

## Automated Setup Script

If you have GitHub CLI authenticated, use this script:

```bash
# For claude-automation
cd /home/coltrip/claude-automation
./setup-github.sh

# For test-project
cd ~/projects/test-project
# Create GitHub repo
gh repo create test-project --public --source=. --remote=origin --push

# For test-multi-agent
cd ~/projects/test-multi-agent
# Create GitHub repo
gh repo create test-multi-agent --public --source=. --remote=origin --push
```

---

## Troubleshooting

### "Authentication failed"

Your GitHub token is invalid or expired. Create a new one:
1. Go to https://github.com/settings/tokens
2. Generate new token with `repo` scope
3. Update `~/.env` file

### "Repository already exists"

```bash
# List your GitHub repos
gh repo list

# Or check on web: https://github.com/YOUR_USERNAME?tab=repositories

# If it exists, just add remote:
git remote add origin https://github.com/YOUR_USERNAME/claude-automation.git
git push -u origin master
```

### "Permission denied"

If using HTTPS:
```bash
# Re-authenticate
gh auth login
```

If using SSH:
```bash
# Check SSH keys
gh ssh-key list

# Add SSH key if needed
ssh-keygen -t ed25519 -C "your_email@example.com"
gh ssh-key add ~/.ssh/id_ed25519.pub
```

### "No commits to push"

```bash
# Check git status
git status

# Check commit history
git log

# If no commits, make one first
git add .
git commit -m "Initial commit"
git push -u origin master
```

---

## Next Steps After Setup

Once your repositories are on GitHub:

1. **Enable GitHub Actions** (optional)
   - Useful for CI/CD and automated testing
   - Add `.github/workflows/` files

2. **Add Collaborators** (optional)
   - Settings → Collaborators → Add people

3. **Set up Branch Protection** (optional)
   - Settings → Branches → Add branch protection rule
   - Protect `master` branch
   - Require pull request reviews

4. **Add Topics** (optional)
   - Makes repository discoverable
   - Suggested topics: `ai`, `claude`, `automation`, `coding-assistant`, `raspberry-pi`, `docker`, `multi-agent`

---

## Current Status

- ✅ Local git repository initialized (master branch)
- ✅ All files committed
- ✅ .gitignore configured
- ⏳ GitHub remote not yet configured
- ⏳ Code not yet pushed to GitHub

**What's needed**: Follow steps above to create GitHub repository and push code.

---

**Last Updated**: 2025-10-21
