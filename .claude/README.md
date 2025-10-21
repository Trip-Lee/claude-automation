# .claude/ - Development Guides Directory

## Purpose

This directory contains **development guides and reference materials** for working on the Claude Multi-Agent System codebase.

These files are **not user-facing documentation** - they're for developers (including AI assistants like Claude) working on the codebase itself.

---

## Files Overview

### 📋 DOCUMENTATION_CHECKLIST.md
**Purpose**: Complete checklist for updating documentation after changes

**When to use**:
- After making any code changes
- Before committing
- At end of session

**What it contains**:
- Mandatory updates for every change type
- Conditional updates based on change scope
- Verification commands
- Quick templates

**Example usage**:
```bash
# Check what docs need updating
cat .claude/DOCUMENTATION_CHECKLIST.md

# Go through checklist:
# ✅ Updated CHANGELOG.md
# ✅ Updated STATUS.md
# ✅ Added session to RESUME.md
```

---

### ⚡ QUICK_REFERENCE.md
**Purpose**: Quick lookup for common patterns and workflows

**When to use**:
- Need a quick reminder
- Forgot a command
- Want to check standard pattern
- Every session as a refresher

**What it contains**:
- Critical files to always update
- Common update patterns
- Session checklist
- Testing commands
- Docker/Git commands
- Common pitfalls

**Example usage**:
```bash
# Quick check before committing
cat .claude/QUICK_REFERENCE.md | grep "Testing"

# See session checklist
cat .claude/QUICK_REFERENCE.md | grep -A 10 "Session End"
```

---

### 🎓 LESSONS_LEARNED.md
**Purpose**: Key insights from development sessions - what worked, what didn't

**When to use**:
- Starting new features
- Troubleshooting issues
- Avoiding past mistakes
- Learning from experience

**What it contains**:
- 12 major categories of learnings
- What we learned vs what didn't work
- Code patterns that work
- Common mistakes to avoid
- Top 10 takeaways

**Covers**:
1. Docker Container Management
2. Error Handling Patterns
3. Testing and Validation
4. Git and GitHub Workflows
5. Documentation Discipline
6. Performance Optimization
7. CLI Design Patterns
8. Node.js and JavaScript Patterns
9. Testing Docker Functionality
10. API Integration Patterns
11. Shell Script Best Practices
12. Project Structure Patterns

**Example usage**:
```bash
# Before implementing error handling
cat .claude/LESSONS_LEARNED.md | grep -A 20 "Error Handling"

# Learn from Docker mistakes
cat .claude/LESSONS_LEARNED.md | grep -A 15 "Docker"
```

---

### 🔄 DEVELOPMENT_WORKFLOW.md
**Purpose**: Best practices and workflows for development sessions

**When to use**:
- Starting a new session
- Onboarding new developers
- Setting up development environment
- Need guidance on workflow

**What it contains**:
- Session startup checklist
- Making changes guidelines
- Documentation requirements
- Testing strategy
- Git workflow
- Docker best practices
- Common pitfalls to avoid
- Performance guidelines
- Session end checklist

**Sections**:
- 🚀 Starting a New Session
- 💡 Making Changes
- 📝 Documentation Requirements
- 🧪 Testing Strategy
- 🔄 Git Workflow
- 🐳 Docker Best Practices
- 🚨 Common Pitfalls to Avoid
- 📊 Performance Guidelines
- 🎯 Session Checklist
- 🆘 Troubleshooting

**Example usage**:
```bash
# Start of session
cat .claude/DEVELOPMENT_WORKFLOW.md | grep -A 30 "Starting a New Session"

# Before committing
cat .claude/DEVELOPMENT_WORKFLOW.md | grep -A 20 "Git Workflow"
```

---

### 📖 API_PATTERNS.md
**Purpose**: Correct usage patterns for all APIs in the system

**When to use**:
- Using DockerManager, GitManager, etc.
- Not sure how an API works
- Getting unexpected returns
- Writing new code that uses APIs

**What it contains**:
- Complete API reference for:
  - DockerManager
  - GitManager
  - GitHub API (Octokit)
  - ClaudeCodeAgent
  - ConfigManager
  - CostMonitor
- Method signatures
- Return types
- Usage examples
- Common patterns
- What NOT to do

**Example patterns**:
```javascript
// DockerManager.exec() - Returns string directly
const output = await dockerManager.exec(container, 'ls');
// NOT an object!

// Always cleanup in finally
finally {
  if (container) {
    await dockerManager.stop(container);
    await dockerManager.remove(container);
  }
}
```

**Example usage**:
```bash
# Check DockerManager usage
cat .claude/API_PATTERNS.md | grep -A 50 "DockerManager"

# See GitHub API examples
cat .claude/API_PATTERNS.md | grep -A 30 "GitHub API"
```

---

### 🧪 TESTING_GUIDE.md
**Purpose**: Complete guide to testing strategy and execution

**When to use**:
- Before committing code
- Adding new tests
- Tests are failing
- Need to understand test coverage

**What it contains**:
- Testing philosophy
- Smoke tests (Tier 1) - 7 tests, ~3 seconds
- Full validation (Tier 2) - 24 tests, 30-60 seconds
- When to run each tier
- How to add new tests
- Test-driven development (TDD)
- Interpreting test results
- Troubleshooting failures
- Performance monitoring
- CI/CD integration

**Commands**:
```bash
# Smoke tests (fast)
node cli.js validate --smoke

# Full validation (comprehensive)
node cli.js validate --full
```

**Example usage**:
```bash
# See what smoke tests cover
cat .claude/TESTING_GUIDE.md | grep -A 20 "What It Tests"

# Learn how to add tests
cat .claude/TESTING_GUIDE.md | grep -A 30 "Adding New Tests"
```

---

## File Sizes and Scope

| File | Lines | Purpose |
|------|-------|---------|
| DOCUMENTATION_CHECKLIST.md | ~370 | Complete doc update checklist |
| QUICK_REFERENCE.md | ~250 | Quick patterns and commands |
| LESSONS_LEARNED.md | ~630 | What worked/didn't work |
| DEVELOPMENT_WORKFLOW.md | ~580 | Session best practices |
| API_PATTERNS.md | ~750 | API usage reference |
| TESTING_GUIDE.md | ~650 | Testing strategy guide |
| **Total** | **~3,230** | **Complete development reference** |

---

## Recommended Reading Order

### First Time Working on Codebase
1. **README.md** (this file) - Understand what's in .claude/
2. **QUICK_REFERENCE.md** - Get familiar with key patterns
3. **DEVELOPMENT_WORKFLOW.md** - Learn the workflow
4. **API_PATTERNS.md** - Understand how APIs work
5. **LESSONS_LEARNED.md** - Avoid past mistakes
6. **TESTING_GUIDE.md** - Learn testing approach

### Starting a New Session
1. **QUICK_REFERENCE.md** - Refresh on patterns
2. **DEVELOPMENT_WORKFLOW.md** - Session checklist
3. (Reference others as needed)

### Before Committing
1. **DOCUMENTATION_CHECKLIST.md** - What docs to update
2. **QUICK_REFERENCE.md** - Session checklist
3. **TESTING_GUIDE.md** - Run validation

### Troubleshooting
1. **LESSONS_LEARNED.md** - Past solutions
2. **API_PATTERNS.md** - Correct API usage
3. **DEVELOPMENT_WORKFLOW.md** - Troubleshooting section

---

## Quick Commands

### View All .claude Files
```bash
ls -lh .claude/
```

### Search Across All Guides
```bash
grep -r "search term" .claude/*.md
```

### Check File Sizes
```bash
wc -l .claude/*.md
```

### View Specific Section
```bash
# See Docker patterns
grep -A 30 "Docker" .claude/LESSONS_LEARNED.md

# See testing commands
grep -A 10 "Testing Quick Reference" .claude/QUICK_REFERENCE.md
```

---

## When to Update These Files

### DOCUMENTATION_CHECKLIST.md
- When adding new documentation types
- When changing documentation structure
- Rarely (it's a reference)

### QUICK_REFERENCE.md
- After learning new patterns
- When finding better shortcuts
- Every few sessions

### LESSONS_LEARNED.md
- After major discoveries
- When something didn't work as expected
- After solving tricky problems
- Every major session

### DEVELOPMENT_WORKFLOW.md
- When changing development process
- After establishing new best practices
- When onboarding insights emerge

### API_PATTERNS.md
- When APIs change
- When discovering new usage patterns
- When adding new APIs

### TESTING_GUIDE.md
- When testing strategy changes
- When adding test categories
- When test commands change

---

## Integration with Main Documentation

### User-Facing Docs (docs/)
```
docs/
├── CHANGELOG.md           # Version history
├── VALIDATION_SYSTEM.md   # How validation works
├── ERROR_HANDLING.md      # Error handling features
├── AUTOMATIC_CLEANUP.md   # Cleanup system
├── GITHUB_SETUP.md        # GitHub setup guide
└── PERFORMANCE_ANALYSIS.md
```

**Purpose**: End-user documentation, feature guides, user-facing info

### Developer Guides (.claude/)
```
.claude/
├── README.md                      # This file
├── DOCUMENTATION_CHECKLIST.md     # Doc update checklist
├── QUICK_REFERENCE.md             # Quick patterns
├── LESSONS_LEARNED.md             # Development insights
├── DEVELOPMENT_WORKFLOW.md        # Best practices
├── API_PATTERNS.md                # API usage guide
└── TESTING_GUIDE.md               # Testing strategy
```

**Purpose**: Developer workflow, internal patterns, development guidelines

### Project Status (root)
```
RESUME.md          # Session history
STATUS.md          # Current state
TODO.md            # What's next
CHANGELOG.md       # Version history (symlink to docs/CHANGELOG.md)
```

**Purpose**: Project tracking, progress, planning

---

## Best Practices for Using .claude/

### DO ✅
- Read relevant guides before starting work
- Reference API_PATTERNS.md when using APIs
- Check LESSONS_LEARNED.md before implementing
- Use QUICK_REFERENCE.md for common patterns
- Update guides after major learnings

### DON'T ❌
- Ignore these guides and make past mistakes
- Implement without checking API patterns
- Commit without checking documentation checklist
- Work without understanding workflow
- Forget to run tests before committing

---

## Summary

The `.claude/` directory is your **development companion**:

1. **DOCUMENTATION_CHECKLIST.md** - What to update
2. **QUICK_REFERENCE.md** - How to do it quickly
3. **LESSONS_LEARNED.md** - Why we do it this way
4. **DEVELOPMENT_WORKFLOW.md** - Complete workflow guide
5. **API_PATTERNS.md** - How to use APIs correctly
6. **TESTING_GUIDE.md** - How to test properly

**Think of it as**: Your senior developer sitting next to you, reminding you of best practices and helping you avoid mistakes.

---

**Last Updated**: 2025-10-21
**Maintained By**: Development team
**Version**: 1.0 (Complete reference suite)
