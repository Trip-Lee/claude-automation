# Add Project Command - Complete Guide

**Version**: v0.11.0
**Status**: ✅ Fully Implemented
**Date**: 2025-10-23

---

## Overview

The `add-project` command now includes **full GitHub validation and repository creation**. It will:

1. ✅ Check if the GitHub repository exists
2. ✅ Offer to create it if it doesn't exist
3. ✅ Optionally clone the new repository
4. ✅ Generate a complete project configuration

---

## Usage

### Basic Usage (With GitHub)

```bash
claude add-project my-awesome-project
```

**Interactive prompts:**
1. Project description
2. Local project path (default: `~/projects/my-awesome-project`)
3. Use GitHub integration? (Y/n)
4. GitHub repository (e.g., `username/my-awesome-project`)
5. Repository visibility (public/private)
6. Base branch (default: `main`)
7. Docker image (default: `claude-python:latest`)

### Without GitHub

```bash
claude add-project my-local-project --no-github
```

Skips all GitHub-related prompts.

---

## Workflow Examples

### Example 1: New Project with New Repo

```bash
$ claude add-project ai-chatbot

📁 Adding Project: ai-chatbot

? Project description: AI-powered chatbot with sentiment analysis
? Local project path: /home/user/projects/ai-chatbot
? Use GitHub integration? Yes
? GitHub repository (owner/repo): myusername/ai-chatbot
? Repository visibility: public
? Base branch: main
? Docker image: claude-python:latest

🔍 Validating GitHub repository...

⚠️  Repository 'myusername/ai-chatbot' not found

? Would you like me to create this repository on GitHub? Yes

📦 Creating repository 'ai-chatbot' for myusername...

  Creating GitHub repository: ai-chatbot...
  ✅ Repository created: https://github.com/myusername/ai-chatbot

? Clone repository to /home/user/projects/ai-chatbot? Yes

📥 Cloning repository...

  ✅ Repository cloned to /home/user/projects/ai-chatbot

✅ Project 'ai-chatbot' configured!

Config saved: /home/user/.claude-projects/ai-chatbot.yaml

Next steps:
  1. Review/edit config: /home/user/.claude-projects/ai-chatbot.yaml
  2. Run task: claude task ai-chatbot "<description>"
```

**What happened:**
1. ✅ Repository created on GitHub
2. ✅ Repository cloned to local machine
3. ✅ Project config saved
4. ✅ Ready to run tasks!

---

### Example 2: Existing GitHub Repo

```bash
$ claude add-project existing-project

📁 Adding Project: existing-project

? Project description: My existing project
? Local project path: /home/user/projects/existing-project
? Use GitHub integration? Yes
? GitHub repository (owner/repo): myusername/existing-project
? Repository visibility: public
? Base branch: main
? Docker image: claude-python:latest

🔍 Validating GitHub repository...

✅ Repository 'myusername/existing-project' found and accessible

✅ Project 'existing-project' configured!

Config saved: /home/user/.claude-projects/existing-project.yaml
```

**What happened:**
1. ✅ Validated repo exists
2. ✅ No need to create
3. ✅ Project config saved
4. ✅ Ready to run tasks!

---

### Example 3: Local-Only Project

```bash
$ claude add-project local-experiments --no-github

📁 Adding Project: local-experiments

? Project description: Local experiments and tests
? Local project path: /home/user/projects/local-experiments
? Base branch: main
? Docker image: claude-python:latest

✅ Project 'local-experiments' configured!

Config saved: /home/user/.claude-projects/local-experiments.yaml

Next steps:
  1. Review/edit config: /home/user/.claude-projects/local-experiments.yaml
  2. Run task: claude task local-experiments "<description>"
```

**What happened:**
1. ✅ No GitHub validation
2. ✅ Project config saved with `repo: local`
3. ✅ Can still run tasks locally
4. ❌ Cannot use `claude approve` (no GitHub)

---

### Example 4: User Declines Repo Creation

```bash
$ claude add-project manual-setup

📁 Adding Project: manual-setup

? Use GitHub integration? Yes
? GitHub repository (owner/repo): myusername/manual-setup

🔍 Validating GitHub repository...

⚠️  Repository 'myusername/manual-setup' not found

? Would you like me to create this repository on GitHub? No

⚠️  Skipping repository creation. You'll need to create it manually.

✅ Project 'manual-setup' configured!
```

**What happened:**
1. ✅ Project config created
2. ⚠️ Repo NOT created
3. ⚠️ User must create repo manually on GitHub
4. ⚠️ `claude approve` will fail until repo exists

---

## Backend Implementation

### New GitHubClient Methods

#### 1. `createRepository()`

Creates a new GitHub repository:

```javascript
await githubClient.createRepository({
  name: 'my-repo',
  description: 'My awesome project',
  private: false,
  autoInit: true  // Creates with README.md
});
```

**Returns:**
```javascript
{
  name: 'my-repo',
  fullName: 'username/my-repo',
  url: 'https://github.com/username/my-repo',
  cloneUrl: 'https://github.com/username/my-repo.git',
  sshUrl: 'git@github.com:username/my-repo.git',
  owner: 'username',
  private: false,
  defaultBranch: 'main'
}
```

#### 2. `getAuthenticatedUser()`

Gets info about the authenticated user:

```javascript
const user = await githubClient.getAuthenticatedUser();
// { login: 'username', name: 'Full Name', email: 'user@email.com', type: 'User' }
```

#### 3. `checkRepoAccess()` (already existed)

Validates repository exists and is accessible:

```javascript
const exists = await githubClient.checkRepoAccess('github.com/owner/repo');
// true or false
```

---

## Configuration Generated

The command creates a YAML config file at `~/.claude-projects/{name}.yaml`:

```yaml
name: ai-chatbot
repo: github.com/myusername/ai-chatbot
base_branch: main
pr:
  title_prefix: '[ai-chatbot]'
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
  command: ''
  timeout: 30
  required: false
security:
  secrets_scanning: true
  dependency_check: true
safety:
  max_cost_per_task: 2.0
  max_duration: 300
  max_file_size: 1048576
```

---

## Error Handling

### Error: No GitHub Token

```bash
⚠️  GITHUB_TOKEN not set. Skipping validation.

Set GITHUB_TOKEN in .env to enable GitHub features
```

**Solution**: Add `GITHUB_TOKEN=ghp_xxxxx` to `.env` file

### Error: Project Already Exists

```bash
❌ Project 'my-project' already exists at /home/user/.claude-projects/my-project.yaml
```

**Solution**: Delete old config or use different name

### Error: Invalid Repository Format

```bash
? GitHub repository (owner/repo): just-a-name
✖ Format must be: owner/repo
```

**Solution**: Use format `username/repo-name`

### Error: Repository Already Exists

```bash
❌ Failed to create repository: Repository 'my-repo' already exists
```

**Solution**: Repository exists but you don't have access, or name collision

---

## Comparison: Before vs After

### Before (Manual Setup)

```bash
# Step 1: Create repo on GitHub.com manually
# Step 2: Clone repo
git clone https://github.com/user/repo.git ~/projects/repo

# Step 3: Manually create ~/.claude-projects/repo.yaml
# Step 4: Fill in all the config fields
# Step 5: Hope you didn't make typos
```

**Time**: ~5-10 minutes
**Error-prone**: Yes
**Validation**: None

### After (Automated)

```bash
claude add-project my-repo
# Answer 7 questions
# Everything created and validated automatically
```

**Time**: ~1-2 minutes
**Error-prone**: No (validated!)
**Validation**: ✅ Repo existence checked
**Repo Creation**: ✅ Automatic if needed
**Cloning**: ✅ Optional automatic

---

## CLI Options

```bash
claude add-project <name> [options]

Options:
  --no-github    Skip GitHub validation and repo creation
  -h, --help     Display help
```

---

## Security Notes

### Repository Visibility

- **Public**: Anyone can see your code
- **Private**: Only you and collaborators can access

Choose based on your needs!

### GitHub Token Permissions

Required scopes for GITHUB_TOKEN:
- ✅ `repo` - Full control of private repositories
- ✅ `public_repo` - Access public repositories

Generate at: https://github.com/settings/tokens

---

## Future Enhancements

Potential improvements:

1. **Organization repos**: Support `org/repo` format
2. **Template repos**: Initialize from template
3. **Branch protection**: Set up branch rules
4. **CI/CD**: Auto-configure GitHub Actions
5. **Collaborators**: Add team members
6. **Labels/Projects**: Configure issue tracking

---

## Summary

**What This Feature Does:**
1. ✅ Validates GitHub repos exist
2. ✅ Creates repos if they don't exist
3. ✅ Clones new repos automatically
4. ✅ Generates complete project config
5. ✅ Prevents common mistakes
6. ✅ Saves 5-10 minutes per project

**What You Need:**
- `GITHUB_TOKEN` in `.env` (for GitHub features)
- Internet connection (for GitHub API)
- Git installed (for cloning)

**Ready to use!** Try it:

```bash
claude add-project my-first-project
```
