# Git Submodule Workflow - sn-tools

**Version**: v0.14.0
**Date**: 2025-11-17

---

## Overview

Starting with v0.14.0, `sn-tools` is managed as a **git submodule** to:
- ✅ Eliminate 30,508 lines of duplicate code
- ✅ Allow independent versioning of sn-tools
- ✅ Simplify updates to latest sn-tools version
- ✅ Cleaner repository structure

---

## Initial Setup

### Option 1: Clone with Submodules (Recommended)

```bash
git clone --recurse-submodules https://github.com/Trip-Lee/claude-automation.git
cd claude-automation
```

The `--recurse-submodules` flag automatically initializes and clones the sn-tools submodule.

### Option 2: Initialize After Cloning

If you already cloned the repository without `--recurse-submodules`:

```bash
cd claude-automation
git submodule update --init --recursive
```

### Verify Submodule

Check that sn-tools is properly initialized:

```bash
# Check submodule status
git submodule status

# Should show:
# +<commit-hash> tools/sn-tools (v2.3.0)

# Verify files exist
ls -la tools/sn-tools/ServiceNow-Tools/
```

### Install sn-tools Dependencies

```bash
cd tools/sn-tools/ServiceNow-Tools
npm install
cd ../../..
```

---

## Common Operations

### Update Submodule to Latest Version

```bash
# Update sn-tools to latest version from remote
git submodule update --remote tools/sn-tools

# Or update all submodules
git submodule update --remote

# Commit the update
git add tools/sn-tools
git commit -m "Update sn-tools to latest version"
```

### Check Submodule Version

```bash
# Show current sn-tools commit
cd tools/sn-tools
git log -1 --oneline
git describe --tags

# Show sn-tools version in package.json
cat ServiceNow-Tools/package.json | grep version
```

### Switch to Specific sn-tools Version

```bash
cd tools/sn-tools

# List available tags/versions
git tag

# Checkout specific version
git checkout v2.3.0

# Return to main project and commit
cd ../..
git add tools/sn-tools
git commit -m "Pin sn-tools to v2.3.0"
```

### Pull Latest Changes (Including Submodule Updates)

```bash
# Pull main repo and update submodules
git pull --recurse-submodules

# Or pull and then update submodules separately
git pull
git submodule update --init --recursive
```

---

## Troubleshooting

### Issue: Submodule shows as "modified" in git status

**Symptoms**:
```bash
$ git status
modified:   tools/sn-tools (modified content)
```

**Cause**: You have uncommitted changes in the submodule, or the submodule is on a different commit than what the parent repo expects.

**Solution**:
```bash
# See what changed in submodule
cd tools/sn-tools
git status
git diff

# Option 1: Discard submodule changes
git reset --hard HEAD

# Option 2: Commit submodule changes and update parent
git add .
git commit -m "Update sn-tools"
cd ../..
git add tools/sn-tools
git commit -m "Update sn-tools submodule reference"
```

### Issue: Submodule folder is empty after clone

**Symptoms**:
```bash
$ ls tools/sn-tools/
# Empty or only .git file
```

**Cause**: Cloned without `--recurse-submodules` flag

**Solution**:
```bash
git submodule update --init --recursive
```

### Issue: Permission denied when updating submodule

**Symptoms**:
```bash
$ git submodule update --remote
fatal: could not read from remote repository
```

**Cause**: SSH keys not configured or incorrect submodule URL

**Solution**:
```bash
# Check submodule URL
cat .gitmodules

# Update to use HTTPS instead of SSH
git config submodule.tools/sn-tools.url https://github.com/Trip-Lee/sn-tools.git

# Try update again
git submodule update --remote
```

### Issue: Detached HEAD state in submodule

**Symptoms**:
```bash
$ cd tools/sn-tools
$ git status
HEAD detached at <commit>
```

**Cause**: Submodules are checked out at specific commits by default (detached HEAD state)

**This is Normal!** Submodules intentionally track specific commits, not branches.

**If you want to track a branch**:
```bash
cd tools/sn-tools

# Checkout a branch
git checkout main

# Configure submodule to track branch
cd ../..
git config -f .gitmodules submodule.tools/sn-tools.branch main

# Update submodule
git submodule update --remote
git add .gitmodules tools/sn-tools
git commit -m "Configure sn-tools to track main branch"
```

---

## Working with Submodules

### Making Changes to sn-tools

**Scenario**: You need to modify sn-tools code

**Workflow**:

1. **Make changes in submodule**:
   ```bash
   cd tools/sn-tools
   
   # Create a branch for your changes
   git checkout -b feature/my-changes
   
   # Make your changes
   vim ServiceNow-Tools/some-file.js
   
   # Commit changes
   git add .
   git commit -m "Add new feature"
   
   # Push to sn-tools repo (if you have permissions)
   git push origin feature/my-changes
   ```

2. **Update parent repo to use new commit**:
   ```bash
   cd ../..  # Back to claude-automation root
   
   # Parent repo sees submodule changed
   git add tools/sn-tools
   git commit -m "Update sn-tools with new feature"
   ```

3. **Push both repos**:
   ```bash
   # Push sn-tools changes
   cd tools/sn-tools
   git push origin feature/my-changes
   
   # Push claude-automation changes
   cd ../..
   git push origin main
   ```

### Removing Submodule (If Needed)

**WARNING**: This will remove sn-tools submodule completely

```bash
# Remove submodule
git rm -f tools/sn-tools

# Remove submodule config
git config -f .gitmodules --remove-section submodule.tools/sn-tools
git add .gitmodules

# Commit removal
git commit -m "Remove sn-tools submodule"

# Clean up .git/config
git config --remove-section submodule.tools/sn-tools

# Remove submodule directory from .git
rm -rf .git/modules/tools/sn-tools
```

---

## Best Practices

### 1. Always Clone with --recurse-submodules

```bash
# Good
git clone --recurse-submodules <repo-url>

# Requires extra step
git clone <repo-url>
git submodule update --init --recursive
```

### 2. Update Submodules After Pulling

```bash
# Best practice - pull with submodules
git pull --recurse-submodules

# Alternative - pull then update submodules
git pull
git submodule update --init --recursive
```

### 3. Commit Submodule Reference Updates

When sn-tools updates, commit the new reference:

```bash
git add tools/sn-tools
git commit -m "Update sn-tools to v2.4.0"
```

### 4. Document Submodule Version

In commit messages, specify which sn-tools version you're using:

```bash
git commit -m "Update sn-tools submodule to v2.3.0 for unified tracing support"
```

### 5. Pin to Specific Versions for Stability

Don't use bleeding-edge main branch in production:

```bash
cd tools/sn-tools
git checkout v2.3.0  # Pin to stable release
cd ../..
git add tools/sn-tools
git commit -m "Pin sn-tools to stable v2.3.0"
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Test with Submodules

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout with submodules
        uses: actions/checkout@v3
        with:
          submodules: recursive
      
      - name: Install dependencies
        run: |
          npm install
          cd tools/sn-tools/ServiceNow-Tools
          npm install
      
      - name: Run tests
        run: npm test
```

### Docker

```dockerfile
FROM node:18

# Clone with submodules
RUN git clone --recurse-submodules https://github.com/Trip-Lee/claude-automation.git /app

WORKDIR /app

# Install dependencies
RUN npm install && \
    cd tools/sn-tools/ServiceNow-Tools && \
    npm install

CMD ["node", "cli.js"]
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git clone --recurse-submodules <url>` | Clone repo with submodules |
| `git submodule update --init --recursive` | Initialize submodules after clone |
| `git submodule update --remote` | Update submodule to latest |
| `git pull --recurse-submodules` | Pull with submodule updates |
| `git submodule status` | Show submodule status |
| `cd tools/sn-tools && git log -1` | Check current submodule commit |
| `git add tools/sn-tools && git commit` | Commit submodule reference update |

---

**Last Updated**: 2025-11-17
**sn-tools Version**: v2.3.0
**Maintained By**: System development team
