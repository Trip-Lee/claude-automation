# Test Project Guide

Complete guide for using the test project for end-to-end testing of the Claude Multi-Agent System.

## Overview

The test project is a permanent, simple Python project used for testing the full orchestrator workflow. It includes:

- **Location**: `~/projects/test-project/`
- **Configuration**: `~/.claude-projects/test-project.yaml`
- **Git**: Initialized with initial commit on `master` branch
- **Purpose**: End-to-end workflow testing

## Test Project Structure

```
~/projects/test-project/
├── README.md              # Project documentation
├── main.py                # Main application (greet, add_numbers functions)
├── test_main.py           # Test cases
└── requirements.txt       # Python dependencies (pytest)
```

## Quick Start

### 1. Verify Setup

Check that the test project exists:
```bash
ls -la ~/projects/test-project/
```

Check that configuration exists:
```bash
cat ~/.claude-projects/test-project.yaml
```

### 2. Run Full Workflow Test

**Mock Mode (Default)** - No API credits required:
```bash
cd ~/claude-automation
node test/test-full-workflow.js
```

**Real Agent Mode** - Requires API credits:
```bash
cd ~/claude-automation
node test/test-full-workflow.js --real
```

### 3. Review Results

The test will:
1. ✅ Verify test project exists
2. ✅ Check configuration
3. ✅ Initialize orchestrator
4. ✅ Execute a coding task (add multiply function)
5. ✅ Create a git branch with changes
6. ✅ Run tests
7. ✅ Generate summary
8. ✅ Save task data

You'll get a task ID and branch name at the end.

### 4. Inspect Changes

```bash
cd ~/projects/test-project
git branch                           # See all branches
git diff master...claude/TASK_ID     # See what changed
git log --oneline                    # See commit history
```

### 5. Reset for Next Test

To clean up and reset for the next test:
```bash
cd ~/claude-automation
./test/reset-test-project.sh
```

This will:
- Switch back to master branch
- Delete all `claude/*` branches
- Reset to clean state
- Ready for next test

## Test Scenarios

### Basic Test (Recommended)
Tests the add multiply function workflow:
```bash
node test/test-full-workflow.js
```

Expected result:
- New branch created: `claude/TIMESTAMP-XXXX`
- New function added to `main.py`
- New test added to `test_main.py`
- Tests pass
- Summary generated

### Custom Tasks

You can modify `test/test-full-workflow.js` to test different tasks:

```javascript
const task = `Your custom task description here`;
```

Example tasks to try:
- Add a new function (multiply, subtract, divide)
- Refactor existing code
- Add error handling
- Add documentation
- Fix a bug (introduce one first!)

## Configuration Details

### Project Config (`~/.claude-projects/test-project.yaml`)

```yaml
name: test-project
repo: github.com/test/test-project  # Placeholder
base_branch: master

docker:
  image: claude-python:latest
  memory: 1g
  cpus: 2

tests:
  command: "python test_main.py"
  timeout: 30
  required: true

safety:
  max_cost_per_task: 2.00  # $2 max
  max_duration: 300        # 5 minutes max
```

## Troubleshooting

### "Test project not found"
```bash
# Verify project exists
ls ~/projects/test-project/

# If missing, it was created at the start of this session
# Check git status
cd ~/projects/test-project && git status
```

### "Configuration not found"
```bash
# Verify config exists
cat ~/.claude-projects/test-project.yaml

# If missing, check the file was created
ls -la ~/.claude-projects/
```

### "Git errors"
```bash
# Reset git state
cd ~/projects/test-project
git checkout master
git reset --hard HEAD
git clean -fd
```

### "Docker errors"
```bash
# Check Docker is running
docker ps

# Check image exists
docker images | grep claude-python

# Remove any stuck containers
docker rm -f $(docker ps -aq --filter "name=claude-*")
```

### "Branch already exists"
Use the reset script:
```bash
cd ~/claude-automation
./test/reset-test-project.sh
```

## Files Created During Testing

### Task Data
- Location: `~/.claude-tasks/TASK_ID.json`
- Contains: Task metadata, results, status
- Cleanup: Delete old task files if needed

### Test Reports
- Location: `~/.claude-logs/full-workflow-test.json`
- Contains: Test results, timing, mode
- Cleanup: Overwritten each test run

### Cost Data
- Location: `~/.claude-logs/costs/TASK_ID.json`
- Contains: API usage and cost breakdown
- Cleanup: Keep for historical analysis

## Integration with CLI

After running a test, you can use the CLI commands:

```bash
# Show task status
./cli.js status TASK_ID

# List all tasks
./cli.js status

# Approve task (would create PR if GitHub token configured)
./cli.js approve TASK_ID

# Reject task (cleans up branch and container)
./cli.js reject TASK_ID

# List projects
./cli.js list-projects
```

## Test Coverage

This test project validates:
- ✅ Configuration loading and validation
- ✅ Git operations (pull, branch, diff)
- ✅ Docker container creation and management
- ✅ Agent system execution (mock or real)
- ✅ Test execution in container
- ✅ Summary generation
- ✅ Task data persistence
- ✅ Cost monitoring and tracking
- ✅ Error handling and fallbacks

## Best Practices

1. **Always reset between tests**: Use `reset-test-project.sh`
2. **Check git status first**: Ensure clean working directory
3. **Review changes**: Use `git diff` to see what agents did
4. **Monitor costs**: Check `~/.claude-logs/costs/` after real agent tests
5. **Keep it simple**: Test project is intentionally minimal
6. **Test both modes**: Try mock and real agent modes

## Extending the Test Project

To add more test cases:

1. **Add complexity to main.py**:
   - Add more functions
   - Add classes
   - Add error handling scenarios

2. **Add more test files**:
   - Create `test_advanced.py`
   - Test edge cases
   - Test error conditions

3. **Update configuration**:
   - Modify test commands
   - Adjust resource limits
   - Change Docker image

4. **Create task templates**:
   - Save common tasks in a file
   - Parameterize the test script
   - Test different agent behaviors

## Notes

- The test project uses `master` as the base branch (git default)
- No actual GitHub repository is required for testing
- The `repo` field in config is a placeholder
- PR creation would fail without GitHub token (expected)
- Tests run inside Docker containers for isolation
- All changes are local until approved and pushed

## Questions?

- Main docs: `~/claude-automation/docs/SYSTEM_DOCUMENTATION.md`
- Status file: `~/claude-automation/STATUS.md`
- This guide: `~/claude-automation/test/TEST_PROJECT_GUIDE.md`
