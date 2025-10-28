# GitHub Setup Guide

Complete step-by-step guide for setting up GitHub integration with the Claude Multi-Agent System.

---

## Table of Contents

1. [Quick Start](#quick-start-github-authentication)
2. [Authentication Options](#authentication-options)
3. [Automated Setup](#automated-setup-for-claude-automation)
4. [Manual Setup](#manual-setup-for-claude-automation)
5. [Projects Setup](#setup-for-projects-in-projects)
6. [Process Diagrams](#process-diagrams)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Configuration](#advanced-configuration)
9. [Next Steps](#next-steps-after-setup)

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

## Process Diagrams

### Complete Setup Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 GITHUB SETUP WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

START
  │
  ├──> Is GitHub CLI installed?
  │    │
  │    ├─YES──> Is authenticated?
  │    │        │
  │    │        ├─YES──> Run ./setup-github.sh
  │    │        │        │
  │    │        │        ├──> Repository created?
  │    │        │        │    │
  │    │        │        │    ├─YES──> Code pushed
  │    │        │        │    │        │
  │    │        │        │    │        └──> DONE ✅
  │    │        │        │    │
  │    │        │        │    └─NO──> Already exists
  │    │        │        │             │
  │    │        │        │             ├──> Add remote
  │    │        │        │             ├──> Push code
  │    │        │        │             └──> DONE ✅
  │    │        │
  │    │        └─NO──> Run: gh auth login
  │    │                │
  │    │                └──> Return to start
  │    │
  │    └─NO──> Install GitHub CLI
  │             │
  │             └──> Return to start
  │
  └──> Alternative: Use Personal Access Token
       │
       ├──> Generate token on GitHub
       ├──> Add to ~/.env
       └──> Run: node create-github-repo.js
            │
            └──> DONE ✅
```

---

### Authentication Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│            WHICH AUTHENTICATION METHOD?                      │
└─────────────────────────────────────────────────────────────┘

                    START
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Do you have GitHub CLI?    │
        └─────────────┬───────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
         YES                     NO
          │                       │
          ▼                       ▼
    ┌──────────┐          ┌─────────────┐
    │ Use CLI  │          │ Use Token   │
    │ (Easy)   │          │ (Advanced)  │
    └────┬─────┘          └──────┬──────┘
         │                       │
         ▼                       ▼
    gh auth login         1. Generate token
         │                2. Add to ~/.env
         │                       │
         └───────┬───────────────┘
                 │
                 ▼
            AUTHENTICATED ✅
```

---

### Repository Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│              REPOSITORY CREATION PROCESS                     │
└─────────────────────────────────────────────────────────────┘

STEP 1: Local Repository Status
  │
  ├──> Check if git initialized
  │    git rev-parse --git-dir
  │    │
  │    ├─YES──> Continue
  │    └─NO──> Run: git init
  │
  ├──> Check for commits
  │    git log --oneline
  │    │
  │    ├─YES──> Continue
  │    └─NO──> Create initial commit
  │             git add .
  │             git commit -m "Initial commit"

STEP 2: GitHub Repository Creation
  │
  ├──> Run setup script
  │    ./setup-github.sh
  │
  ├──> Script checks authentication
  │    gh auth status
  │
  ├──> Create repository on GitHub
  │    gh repo create claude-automation \
  │      --public \
  │      --description "..." \
  │      --source=. \
  │      --remote=origin \
  │      --push
  │
  └──> Repository created ✅

STEP 3: Verification
  │
  ├──> Check remote configured
  │    git remote -v
  │    Expected: origin https://github.com/user/claude-automation.git
  │
  ├──> Check branch tracking
  │    git branch -vv
  │    Expected: * master [origin/master]
  │
  └──> Open in browser
       gh repo view --web
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

Comprehensive troubleshooting guide for common GitHub setup issues.

---

### Issue: "Authentication failed"

**Symptoms:**
```
remote: Invalid username or password
fatal: Authentication failed for 'https://github.com/...'
```

**Diagnosis:**
Your GitHub token is invalid, expired, or missing.

**Solution Steps:**

1. **Check current authentication:**
   ```bash
   gh auth status
   ```

2. **If using GitHub CLI:**
   ```bash
   # Re-authenticate
   gh auth login

   # Follow prompts:
   # 1. Select "GitHub.com"
   # 2. Select "HTTPS"
   # 3. Authenticate with browser
   # 4. Paste one-time code
   ```

3. **If using personal access token:**
   ```bash
   # 1. Generate new token
   # Visit: https://github.com/settings/tokens
   # Click: "Generate new token (classic)"
   # Select scopes: repo, workflow
   # Generate and copy token

   # 2. Update ~/.env
   echo "GITHUB_TOKEN=ghp_your_new_token_here" >> ~/.env

   # 3. Verify token works
   curl -H "Authorization: token $(cat ~/.env | grep GITHUB_TOKEN | cut -d'=' -f2)" \
        https://api.github.com/user
   ```

**Prevention:**
- Use GitHub CLI for automatic token management
- Set token expiration reminders
- Store tokens securely in `~/.env`

---

### Issue: "Repository already exists"

**Symptoms:**
```
Error: GraphQL: Name already exists on this account
```

**Diagnosis:**
A repository with this name already exists on your account.

**Solution Steps:**

1. **List your repositories:**
   ```bash
   # Using GitHub CLI
   gh repo list

   # Or check web interface
   # Visit: https://github.com/YOUR_USERNAME?tab=repositories
   ```

2. **If repository exists and is correct:**
   ```bash
   # Just add remote and push
   git remote add origin https://github.com/YOUR_USERNAME/claude-automation.git
   git push -u origin master
   ```

3. **If repository exists but is wrong:**
   ```bash
   # Option A: Delete and recreate
   gh repo delete YOUR_USERNAME/claude-automation
   ./setup-github.sh

   # Option B: Use different name
   # Edit setup-github.sh and change repository name
   ```

4. **If you want to keep both:**
   ```bash
   # Rename local repository
   git remote add origin https://github.com/YOUR_USERNAME/claude-automation-v2.git
   ```

---

### Issue: "Permission denied (publickey)"

**Symptoms:**
```
git@github.com: Permission denied (publickey).
fatal: Could not read from remote repository.
```

**Diagnosis:**
SSH authentication is failing. Either SSH key is missing or not configured.

**Solution Steps:**

**For HTTPS (Recommended):**
```bash
# 1. Switch to HTTPS
git remote set-url origin https://github.com/YOUR_USERNAME/claude-automation.git

# 2. Authenticate with GitHub CLI
gh auth login

# 3. Push
git push -u origin master
```

**For SSH:**
```bash
# 1. Check for existing SSH keys
ls -la ~/.ssh
# Look for: id_rsa.pub, id_ed25519.pub, id_ecdsa.pub

# 2. If no keys exist, generate new key
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept default location
# Enter passphrase (optional but recommended)

# 3. Add SSH key to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 4. Copy public key
cat ~/.ssh/id_ed25519.pub

# 5. Add to GitHub
# Visit: https://github.com/settings/keys
# Click: "New SSH key"
# Paste key and save

# Or using GitHub CLI:
gh ssh-key add ~/.ssh/id_ed25519.pub

# 6. Test connection
ssh -T git@github.com
# Should see: "Hi username! You've successfully authenticated..."
```

---

### Issue: "No commits to push"

**Symptoms:**
```
Everything up-to-date
```
or
```
fatal: No commits yet
```

**Diagnosis:**
Either no commits exist, or all commits are already pushed.

**Solution Steps:**

1. **Check git status:**
   ```bash
   git status
   ```

2. **Check commit history:**
   ```bash
   git log --oneline
   # If empty: No commits exist
   ```

3. **If no commits exist:**
   ```bash
   # Add all files
   git add .

   # Create initial commit
   git commit -m "Initial commit: Claude Multi-Agent System v0.12.0-alpha"

   # Push to GitHub
   git push -u origin master
   ```

4. **If commits exist but already pushed:**
   ```bash
   # Make a change
   echo "# Updates" >> README.md

   # Commit change
   git add README.md
   git commit -m "Update README"

   # Push
   git push
   ```

---

### Issue: "Failed to connect to github.com"

**Symptoms:**
```
fatal: unable to access 'https://github.com/...': Failed to connect to github.com port 443: Connection refused
```

**Diagnosis:**
Network connectivity issue or firewall blocking access.

**Solution Steps:**

1. **Check internet connection:**
   ```bash
   ping google.com
   ```

2. **Check GitHub status:**
   ```bash
   # Visit: https://www.githubstatus.com/
   curl https://www.githubstatus.com/api/v2/status.json
   ```

3. **Try different protocol:**
   ```bash
   # If HTTPS fails, try SSH
   git remote set-url origin git@github.com:YOUR_USERNAME/claude-automation.git
   git push
   ```

4. **Check proxy settings:**
   ```bash
   # If behind corporate proxy
   git config --global http.proxy http://proxy.company.com:8080
   git config --global https.proxy https://proxy.company.com:8080
   ```

---

### Issue: "Branch diverged" or "Updates were rejected"

**Symptoms:**
```
! [rejected]        master -> master (non-fast-forward)
error: failed to push some refs to 'https://github.com/...'
hint: Updates were rejected because the tip of your current branch is behind
```

**Diagnosis:**
Remote has commits that local doesn't have.

**Solution Steps:**

1. **Pull latest changes:**
   ```bash
   git pull origin master
   ```

2. **If merge conflicts occur:**
   ```bash
   # View conflicting files
   git status

   # Edit files to resolve conflicts
   # Look for markers: <<<<<<<, =======, >>>>>>>

   # After resolving
   git add .
   git commit -m "Resolve merge conflicts"
   ```

3. **Push changes:**
   ```bash
   git push origin master
   ```

4. **If you want to force push (DANGEROUS):**
   ```bash
   # Only use if you're sure!
   # This will overwrite remote history
   git push --force origin master
   ```

---

### Issue: "Rate limit exceeded"

**Symptoms:**
```
API rate limit exceeded for xxx.xxx.xxx.xxx
```

**Diagnosis:**
Too many API requests in short time period.

**Solution Steps:**

1. **Check rate limit status:**
   ```bash
   gh api rate_limit
   ```

2. **Wait for reset:**
   ```bash
   # Rate limits reset every hour
   # Check reset time in rate_limit response
   date -d @<reset_timestamp>
   ```

3. **Use authentication:**
   ```bash
   # Authenticated requests have higher limits
   # 5,000 requests/hour vs 60 requests/hour
   gh auth login
   ```

---

### Issue: "Git not initialized"

**Symptoms:**
```
fatal: not a git repository (or any of the parent directories): .git
```

**Diagnosis:**
Current directory is not a git repository.

**Solution Steps:**

1. **Navigate to correct directory:**
   ```bash
   cd /home/coltrip/claude-automation
   ```

2. **Initialize git if needed:**
   ```bash
   git init
   ```

3. **Verify git initialized:**
   ```bash
   git status
   # Should show: On branch master (or main)
   ```

---

### Issue: "Large file warning"

**Symptoms:**
```
warning: File is X MB; this exceeds GitHub's recommended maximum file size of 50 MB
```

**Diagnosis:**
Trying to commit files larger than GitHub's limits.

**Solution Steps:**

1. **Identify large files:**
   ```bash
   find . -type f -size +50M
   ```

2. **Add to .gitignore:**
   ```bash
   echo "large-file.zip" >> .gitignore
   echo "*.iso" >> .gitignore
   echo "node_modules/" >> .gitignore
   ```

3. **Remove from git if already tracked:**
   ```bash
   git rm --cached large-file.zip
   git commit -m "Remove large file from tracking"
   ```

4. **For files that must be tracked:**
   ```bash
   # Use Git LFS (Large File Storage)
   git lfs install
   git lfs track "*.zip"
   git add .gitattributes
   git add large-file.zip
   git commit -m "Add large file with LFS"
   ```

---

### Getting Help

**Check logs:**
```bash
# Git verbose output
GIT_TRACE=1 git push -v

# GitHub CLI debug
gh --debug repo create
```

**Verify configuration:**
```bash
# Check git config
git config --list

# Check remote configuration
git remote -v

# Check current branch
git branch -vv
```

**Community resources:**
- GitHub Docs: https://docs.github.com
- GitHub Community: https://github.community
- Stack Overflow: https://stackoverflow.com/questions/tagged/github
- Git Documentation: https://git-scm.com/doc

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
