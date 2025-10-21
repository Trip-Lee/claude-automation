# Development Workflow Guide

## Best Practices for Working on Claude Multi-Agent System

---

## 🚀 Starting a New Session

### 1. Read Context Files (ALWAYS!)

Before making any changes:

```bash
# Read these files in order:
1. STATUS.md              # Where are we now?
2. RESUME.md              # How did we get here?
3. TODO.md or PRIORITIZED_TODOS.md  # What's next?
4. CHANGELOG.md           # Recent changes
```

**Why**: Prevents duplicate work, understands current state, knows what's been tried.

### 2. Validate System Health

```bash
# Quick check (<3 seconds)
node cli.js validate --smoke

# Or full check (30-60s) if major changes planned
node cli.js validate --full
```

**Why**: Ensures you're starting from a working state. Don't build on broken foundation.

### 3. Check for Hanging Resources

```bash
# Check for orphaned containers
docker ps -a | grep claude

# Clean up if needed
node cli.js cleanup --all
```

**Why**: Clean slate prevents interference from previous sessions.

---

## 💡 Making Changes

### 1. Plan Before Coding

**For Small Changes** (<1 hour):
- Write down what you're changing
- Identify affected files
- Consider edge cases

**For Large Changes** (>1 hour):
- Use TodoWrite tool to track progress
- Break into smaller tasks
- Document each step

### 2. Test As You Go

**After Each Meaningful Change:**

```javascript
// If changing core functionality
node cli.js validate --smoke

// If adding new feature
// Add test to test/validation-suite.js first
// Then implement feature (TDD approach)
```

**Before Committing:**

```bash
# Always run smoke tests
node cli.js validate --smoke

# For major changes, run full suite
node cli.js validate --full
```

### 3. Follow Code Patterns

**Error Handling:**
```javascript
async function operation() {
  let resource = null;

  try {
    resource = await createResource();
    // ... work ...
    return result;
  } catch (error) {
    throw new Error(`Operation failed: ${error.message}`);
  } finally {
    // ALWAYS cleanup
    if (resource) {
      await cleanup(resource);
    }
  }
}
```

**Timeout Protection:**
```javascript
const result = await Promise.race([
  operation(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  )
]);
```

**Retry Logic:**
```javascript
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryable(error) || attempt === maxRetries) {
      throw error;
    }
    await sleep(retryDelay * attempt); // Exponential backoff
  }
}
```

---

## 📝 Documentation Requirements

### Update EVERY Time You:

1. **Add a feature** → Update CHANGELOG.md, STATUS.md
2. **Fix a bug** → Update CHANGELOG.md
3. **End a session** → Update RESUME.md
4. **Change behavior** → Update relevant docs/ file
5. **Bump version** → Update STATUS.md, CHANGELOG.md

### Use the Checklist

```bash
# Check off items as you update
cat .claude/DOCUMENTATION_CHECKLIST.md

# Quick reference for common updates
cat .claude/QUICK_REFERENCE.md
```

### Documentation Template

**CHANGELOG.md Entry:**
```markdown
## [Version] - YYYY-MM-DD

### Added
- Feature description

### Changed
- What changed and why

### Fixed
- Bug description and fix
```

**RESUME.md Entry:**
```markdown
## Session YYYY-MM-DD: Brief Title

### Duration: ~X hours
### Goal: What you set out to do
### Status: ✅ Complete / ⏳ In Progress / ❌ Blocked

### What Was Accomplished

#### 1. Major Task ✅
- Bullet points of what was done
- Include file names and line counts
- Link to relevant docs

### Files Modified
- path/to/file.js (+lines / -lines)

### Next Steps
- What should happen next
```

---

## 🧪 Testing Strategy

### Two-Tier Approach

**Tier 1: Smoke Tests (ALWAYS)**
```bash
node cli.js validate --smoke
```
- Run before starting work
- Run after each meaningful change
- Run before committing
- Duration: ~3 seconds
- Tests: 7 core functionality tests

**Tier 2: Full Validation (BEFORE RELEASES)**
```bash
node cli.js validate --full
```
- Run before version bumps
- Run before pushing to GitHub
- Run weekly as health check
- Duration: ~30-60 seconds
- Tests: 24 comprehensive tests

### Adding New Tests

**To smoke-test.js:**
```javascript
// Only add if it's critical infrastructure
await runTest('Test name', async () => {
  // Test logic
  if (!condition) {
    throw new Error('What failed');
  }
});
```

**To validation-suite.js:**
```javascript
// Add to appropriate category
await runTest('category', 'Test name', async () => {
  // Test logic
}, {
  skip: false,       // Set true to skip
  timeout: 60000     // Custom timeout
});
```

---

## 🔄 Git Workflow

### Before Starting Work

```bash
# Check current state
git status
git branch

# Make sure on master
git checkout master
```

### Making Changes

```bash
# Make changes
# Test changes
node cli.js validate --smoke

# Stage changes
git add .

# Check what's staged
git status

# Commit with good message
git commit -m "type: Brief description

Detailed explanation of what and why.

- Bullet point changes
- Include file references
- Link to issues if applicable"
```

### Commit Message Types

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `test:` Adding tests
- `refactor:` Code restructuring
- `perf:` Performance improvement
- `chore:` Maintenance tasks

### Before Pushing to GitHub

```bash
# Run full validation
node cli.js validate --full

# If all pass, push
git push origin master
```

---

## 🐳 Docker Best Practices

### Container Naming

```javascript
// Always use timestamp for uniqueness
const name = `${prefix}-${Date.now()}`;

// Examples
const name = `task-${Date.now()}`;
const name = `test-${Date.now()}`;
const name = `validation-${Date.now()}`;
```

### Resource Limits

```javascript
await dockerManager.create({
  name: containerName,
  image: 'claude-python:latest',
  memory: '512m',  // Default, adjust if needed
  cpus: 1,         // Single CPU sufficient
  volumes: {
    [projectPath]: '/workspace'
  }
});
```

### Cleanup Patterns

```javascript
// Track all containers
this.activeContainers = new Set();

// Add when created
container = await dockerManager.create(...);
this.activeContainers.add(container);

// Always cleanup in finally
finally {
  if (container) {
    await this.cleanupContainer(container);
  }
}

// Register process handlers
process.on('SIGINT', async () => {
  await this.cleanupAll();
  process.exit(130);
});
```

---

## 🚨 Common Pitfalls to Avoid

### 1. ❌ Committing Generated Files

**DON'T commit:**
- node_modules/
- package-lock.json (we exclude it)
- .env files
- __pycache__/
- *.pyc
- logs/

**DO have .gitignore:**
```bash
# Check before first commit
cat .gitignore

# Add to .gitignore if missing
echo "node_modules/" >> .gitignore
```

### 2. ❌ Not Cleaning Up Resources

```javascript
// BAD
const container = await dockerManager.create(...);
// ... work ...
// Forgot to cleanup!

// GOOD
let container = null;
try {
  container = await dockerManager.create(...);
  // ... work ...
} finally {
  if (container) {
    await dockerManager.stop(container);
    await dockerManager.remove(container);
  }
}
```

### 3. ❌ Optimizing Without Measuring

```javascript
// BAD
// "I think spawn is slow, let me optimize it"
// (It's actually 0.01s - not worth optimizing)

// GOOD
console.time('operation');
await operation();
console.timeEnd('operation');
// Now you know if it's worth optimizing
```

### 4. ❌ Generic Error Messages

```javascript
// BAD
throw new Error('Failed');

// GOOD
throw new Error(
  `Failed to create container: ${error.message}\n` +
  `Troubleshooting:\n` +
  `- Check if Docker is running: docker ps\n` +
  `- Check image exists: docker images | grep claude-python`
);
```

### 5. ❌ Silent Operations

```javascript
// BAD
await operation(); // User sees nothing

// GOOD
console.log(chalk.blue('Starting operation...'));
await operation();
console.log(chalk.green('✅ Operation complete'));
```

### 6. ❌ Not Using Validation Suite

```javascript
// BAD
// Make changes
git commit
git push
// Hope it works

// GOOD
// Make changes
node cli.js validate --smoke  // Quick check
git commit
node cli.js validate --full   // Before push
git push
```

---

## 📊 Performance Guidelines

### When to Optimize

1. **Measure first** - Use console.time() or profiling
2. **Identify bottleneck** - What's actually slow?
3. **Check if it matters** - Is it <1% of total time?
4. **Quick wins first** - 80/20 rule

### Current Performance Profile

```
Total task time: ~245s

Breakdown:
- Claude CLI execution: 92.5% (can't optimize)
  - Coder: 51.5%
  - Architect: 22.5%
  - Reviewer: 18.5%
- Our code: 7.5%
  - Spawn: 0.01s (negligible)
  - Parsing: minimal
  - Docker ops: ~2s

Focus optimization on:
1. Prompt verbosity (reduce architect brief)
2. Context optimization (cache file reads)
3. Model selection (use Haiku for simple tasks)
```

### Don't Optimize

- Spawn time (0.01s - not worth it)
- JSON parsing (negligible)
- File I/O (already fast)
- Git operations (already efficient)

---

## 🎯 Session Checklist

### Before Starting

- [ ] Read STATUS.md, RESUME.md, TODO.md
- [ ] Run `node cli.js validate --smoke`
- [ ] Check for hanging containers: `docker ps -a | grep claude`
- [ ] Clean workspace: `node cli.js cleanup --all` if needed

### While Working

- [ ] Test changes incrementally
- [ ] Run smoke tests after meaningful changes
- [ ] Update documentation as you go
- [ ] Use TodoWrite tool for complex tasks
- [ ] Commit frequently with good messages

### Before Finishing

- [ ] Run full validation: `node cli.js validate --full`
- [ ] Update CHANGELOG.md with changes
- [ ] Update STATUS.md if version changed
- [ ] Add session summary to RESUME.md
- [ ] Commit all changes
- [ ] Clean up test containers

### Before Pushing to GitHub

- [ ] All tests pass: `node cli.js validate --full`
- [ ] Documentation updated
- [ ] Commit message is clear
- [ ] No sensitive data in commits (.env, tokens, etc.)
- [ ] .gitignore is correct

---

## 🆘 Troubleshooting

### Tests Failing

```bash
# Run with verbose output
VERBOSE=1 node cli.js validate --full

# Check specific category
# Edit test file to only run that category
node test/validation-suite.js
```

### Docker Issues

```bash
# Check Docker daemon
docker ps

# Check images
docker images | grep claude

# Check container logs
docker logs <container-id>

# Nuclear option: clean all
node cli.js cleanup --all
docker system prune -f
```

### Git Issues

```bash
# Uncommitted changes blocking you
git stash save "WIP: description"
# ... do other work ...
git stash pop

# Wrong branch
git checkout master
git branch -D wrong-branch

# Committed to wrong branch
git log  # Find commit hash
git checkout correct-branch
git cherry-pick <commit-hash>
```

### GitHub Authentication

```bash
# Using gh CLI
gh auth login
# Follow prompts

# Check status
gh auth status

# Or use personal access token
# Update ~/.env with new token
```

---

## 📚 Quick Reference

For common patterns and snippets:
```bash
cat .claude/QUICK_REFERENCE.md
```

For documentation requirements:
```bash
cat .claude/DOCUMENTATION_CHECKLIST.md
```

For lessons learned:
```bash
cat .claude/LESSONS_LEARNED.md
```

---

**Last Updated**: 2025-10-21
**Next Review**: When onboarding new developers or changing workflow
**Maintained By**: Development team
