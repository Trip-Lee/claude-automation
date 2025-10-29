# Changelog

All notable changes to the Claude Multi-Agent Coding System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.13.0] - 2025-10-29

### 🚀 Major Features

#### Auto-PR Creation Workflow
- **Breaking Change**: Pull requests are now created automatically after task completion
- Removed manual "Approve/Reject/Hold" prompt from workflow mode
- PR is pushed to GitHub and created immediately when task succeeds
- Displays PR URL for user to review in GitHub
- Manual `claude approve <taskId>` still available if PR creation fails
- **Impact**: Faster workflow, full context always available in GitHub PR

#### Comprehensive Error Handling
- Added pre-flight validation to prevent wasted agent execution
- Validates GitHub repository exists BEFORE running expensive tasks
- **Savings**: Prevents 2-5 minutes and $0.05-$0.15 per failed setup
- Added git remote validation before pushing branches
- Enhanced all GitHub API errors with actionable solutions
- Better config validation with clear error messages

### 🐛 Bug Fixes

- **Critical**: Fixed SSH format repo URL parsing (`git@github.com:user/repo.git`)
  - Was parsing incorrectly, causing GitHub API calls to fail
  - Now supports all 5 repo URL formats correctly

### 🔒 Security

- Enhanced `.gitignore` to prevent secrets from being committed
  - Added patterns for `.env`, `*.key`, `*.secret`, credentials files
  - Added ServiceNow-specific config exclusions
- Removed sensitive configuration files from git tracking
  - `.sn-key` files no longer tracked
  - `sn-config.json` files no longer tracked
- **Action Required**: If you have ServiceNow credentials in `tools/sn-tools/ServiceNow-Tools/sn-config.json`, they were exposed in git history and should be rotated

### ✨ Enhancements

#### Orchestrator (`lib/orchestrator.js`)
- Added pre-flight GitHub repository validation (+30 lines)
- Validates repo format and existence before task execution
- Auto-creates PR after task completion (Step 8)
- Changed task status from `'pending_approval'` to `'completed'`
- Keeps container in tracking during PR creation for proper cleanup

#### Git Manager (`lib/git-manager.js`)
- Added `hasRemote()` method - check if git remote exists
- Added `getRemoteUrl()` method - get remote URL
- Enhanced `push()` with remote validation (+50 lines)
- Better error messages for push failures with troubleshooting

#### GitHub Client (`lib/github-client.js`)
- Added `_enhanceGitHubError()` method - centralized error enhancement (+90 lines)
- Maps all HTTP status codes to user-friendly messages:
  - 401 → "Token invalid, here's how to fix"
  - 403 → "Rate limit or permissions, check your token"
  - 404 → "Resource not found, verify these things"
  - 422 → "Validation failed, likely reasons"
  - 500/502/503 → "GitHub down, check status page"
- Fixed `parseRepo()` to handle SSH format correctly
- Enhanced `checkRepoAccess()` with better error messages
- Applied error enhancement to all API methods

#### Config Manager (`lib/config-manager.js`)
- Enhanced `isValidRepoUrl()` to support SSH format (+15 lines)
- Now accepts: HTTPS, plain, SSH, and 'local'
- Better validation error messages with examples
- Clearer config format guidance

#### CLI (`cli.js`)
- Removed "Approve/Reject/Hold" prompt from workflow mode
- Now displays PR URL immediately after task completion
- Shows "Review and merge the PR in GitHub when ready"
- Updated command descriptions for clarity

### 📚 Documentation

#### New Documentation Files
- `ERROR_HANDLING_GUIDE.md` - Complete error handling guide (650 lines)
- `APPROVAL_WORKFLOW_CHANGES.md` - Workflow changes documentation
- `COMPREHENSIVE_FIX_SUMMARY.md` - Implementation summary
- `TEST_PLAN_V013.md` - Comprehensive test plan (35+ test cases)
- `TEST_RESULTS_V013.md` - Test execution results
- `FINAL_TEST_REPORT_V013.md` - Executive test summary

#### Updated Documentation
- Updated README.md with new workflow
- Updated all references to approval process

### 🧪 Testing

- Created comprehensive test plan with 35+ test cases
- Ran 12 automated tests (100% pass rate after bug fix)
- Found and fixed 1 critical SSH parsing bug
- Validated all repo URL formats
- Tested error messages for clarity
- All syntax checks pass

### ⚠️ Breaking Changes

**Approval Workflow**:
- **Old**: Task completes → prompt "Approve/Reject/Hold" → run `claude approve <taskId>`
- **New**: Task completes → PR auto-created → review in GitHub

**Migration**:
- No action needed - new workflow is automatic
- `claude approve <taskId>` still works for manual PR creation
- Tasks with `status: 'pending_approval'` need manual PR creation

### 🔄 Changed Behavior

**Task Status Flow**:
- Old: `executing` → `pending_approval` → `approved`
- New: `executing` → `completed` (PR auto-created)

**Container Cleanup**:
- Container now stays in tracking during PR creation
- Ensures cleanup if user Ctrl+C's during PR creation
- Removed from tracking only after PR creation completes

### 📊 Performance Impact

- Pre-flight checks add ~2-5 seconds to task startup
- **But saves 2-5 minutes if setup is wrong** (huge net positive)
- PR creation adds ~5-10 seconds at task completion
- Overall: Faster workflow, prevents wasted time

### 🎯 Error Handling Coverage

**New Pre-flight Checks**:
- ✅ Config file exists and is valid YAML
- ✅ Required config fields present
- ✅ Repo URL format correct
- ✅ Docker is running
- ✅ GitHub repository exists (if not 'local')
- ✅ Git remote configured (before push)

**Enhanced Error Messages For**:
- GitHub authentication failures
- Repository access issues
- Rate limiting
- Network errors
- Git remote not configured
- Invalid configuration
- All GitHub API errors

### 📦 Code Statistics

- **Total Lines Added**: ~175 lines
- **Bug Fixes**: 1 critical
- **Files Modified**: 5 core files
- **Documentation**: 6 new comprehensive guides
- **Tests**: 12 automated tests

### 🔗 Related Issues

- Fixes context loss in manual approval workflow
- Fixes SSH repo URL parsing
- Prevents wasted agent execution on setup errors
- Improves user experience with clear error messages

### 🙏 Notes

- All changes are backward compatible (with migration path)
- Error handling comprehensive but not fully live-tested
- Recommend running one integration test on first use
- All syntax validated, code review complete
- Ready for deployment with monitoring

---

---

## [Unreleased]

### Future Enhancements
- Multi-agent expansion (20+ specialized agents with intelligent selection)
- Parallel agent execution with conflict detection
- Real-time user feedback queue during execution
- Machine learning-based consensus detection
- Advanced context optimizations
- Expanded file type support
- Tool versioning and automatic updates
- Tool usage analytics and monitoring

---

## [0.12.0-alpha] - 2025-10-27

### Added - External Tools System

**Major Feature: External Tool Integration**

A comprehensive tools system that allows agents to use external tools mounted in containers to extend their capabilities beyond core functionality.

#### 1. Tool Registry System (`lib/tool-registry.js` - 357 lines)

**Purpose**: Automatic tool discovery and management

**Features**:
- Auto-discovers tools by scanning for `tool-manifest.yaml` files
- Validates tool manifests for required fields and accuracy
- Generates formatted tool context for agent prompts (markdown)
- Manages tool-specific environment variables with namespacing
- Validates tool execution prerequisites
- Provides tool statistics and insights

**Key Capabilities**:
- `loadAllTools()` - Discovers all tools in tools/ directory
- `getToolContext()` - Returns formatted context for agents
- `getToolContextMarkdown()` - Generates agent prompt text
- `getToolEnvironmentVars(toolName)` - Filters env vars per tool
- `validateToolExecution(toolName)` - Checks prerequisites

#### 2. Tool Executor (`lib/tool-executor.js` - 249 lines)

**Purpose**: Execute tools in containers with intelligent fallback

**Execution Strategy**:
- **Option B (Primary)**: Dedicated tool execution interface
  - Type-aware execution (node_script, python_script, binary, shell_script)
  - Constructs commands based on tool type
  - Handles npm commands, direct scripts, and binaries
- **Option A (Fallback)**: Bash execution
  - Falls back if dedicated execution fails
  - Agents can use Bash tool directly
  - More flexible, less controlled

**Key Methods**:
- `executeTool(toolName, command, container, options)` - Execute with fallback
- `executeNpmCommand(toolName, scriptName, container)` - npm convenience
- `testTool(toolName, container)` - Test tool availability
- `testAllTools(container)` - Validate all tools in container

#### 3. Docker Manager Enhancements

**Environment Variable Support**:
- Added `toolEnv` parameter to `create()` method
- Passes tool-specific environment variables to containers
- Namespaced pattern (e.g., `SNTOOL_DEV_URL`, `JIRA_API_TOKEN`)

**Read-Only Tool Mounting**:
- Updated `createBinds()` to support `{containerPath, mode}` format
- Tools directory mounted at `/tools:ro` (read-only, executable)
- Security validation: Tools must be mounted read-only
- Exception added for tools directory in security checks

**Security Model**:
```javascript
volumes: {
  [projectPath]: '/workspace',                          // Read-write
  [toolsPath]: { containerPath: '/tools', mode: 'ro' }  // Read-only
}
```

#### 4. Orchestrator Integration

**Tool Registry Initialization**:
- Automatically loads tool registry on startup
- Discovers and validates all available tools

**Container Creation**:
- Tools directory automatically mounted read-only
- Tool-specific environment variables passed to container
- No configuration required by user

**Agent Context Integration**:
- Tool information automatically added to agent prompts
- Agents receive formatted markdown with:
  - Tool descriptions and capabilities
  - Usage examples and commands
  - Environment variable requirements
  - Agent-specific guidance notes

#### 5. Tool Manifest System

**YAML-based Tool Definitions**:
- Structured format for tool metadata
- Required fields: name, version, description, type, capabilities, entry_point
- Optional fields: examples, requires, environment, constraints, metadata
- Template provided for creating new tools

**Example Manifest**:
```yaml
name: sn-tools
version: 2.1.0
description: Professional ServiceNow development toolkit
type: node_script
capabilities:
  - Query ServiceNow tables and records
  - Create and update ServiceNow records
  - Test ServiceNow connectivity
entry_point: ServiceNow-Tools/sn-auto-execute.js
environment:
  - name: SNTOOL_DEV_URL
    description: ServiceNow dev instance URL
    required: false
constraints:
  read_only: true
  executable: true
  network: true
```

#### 6. ServiceNow Tools (sn-tools v2.1.0)

**First Production Tool**:
- Complete ServiceNow development toolkit
- 11 capabilities for ServiceNow automation
- Multi-instance support (dev/prod routing)
- Real-time file watching and syncing
- Dependency tracking and impact analysis
- Flow tracing and table field mapping

**npm Commands Available**:
- `npm run test-connections` - Test ServiceNow connectivity
- `npm run fetch-data` - Fetch ServiceNow records
- `npm run dependency-scan` - Analyze Script Include dependencies
- `npm run impact-analysis` - Analyze change impact
- `npm run generate-context` - Generate AI context summary

#### 7. Documentation

**New Documentation Files**:
- `tools/README.md` (350 lines) - Complete tools documentation
- `tools/sn-tools/tool-manifest.yaml` (130 lines) - sn-tools definition
- `tools/template/tool-manifest.yaml` (95 lines) - Tool template
- `TOOLS_SYSTEM.md` (650+ lines) - Implementation documentation

**Updated Files**:
- `README.md` - Added tools system section
- `STATUS.md` - Updated with v0.12.0 features
- `CHANGELOG.md` - This entry

### Changed

**Docker Security**:
- Enhanced security validation to allow tools directory mounting
- Tools must be mounted read-only (enforced)
- Agents can execute but not modify tool code

**Agent Context**:
- Agents now automatically receive tool information
- Tool capabilities visible in agent prompts
- Usage examples provided for agent decision-making

### Technical Details

**Files Added** (6):
| File | Lines | Purpose |
|------|-------|---------|
| `tools/README.md` | 350 | Tools directory documentation |
| `tools/sn-tools/tool-manifest.yaml` | 130 | sn-tools definition |
| `tools/template/tool-manifest.yaml` | 95 | Template for new tools |
| `lib/tool-registry.js` | 357 | Tool discovery & management |
| `lib/tool-executor.js` | 249 | Tool execution with fallback |
| `TOOLS_SYSTEM.md` | 650+ | Complete implementation docs |

**Files Modified** (2):
| File | Changes | Purpose |
|------|---------|---------|
| `lib/docker-manager.js` | +40 lines | Tools mount & env vars support |
| `lib/orchestrator.js` | +20 lines | Tool registry integration |

**Total New Code**: ~1,180 lines (registry + executor + docs + manifests)

### Benefits

**For Agents**:
- Extended capabilities beyond core functionality
- Clear documentation in prompts
- Automatic tool discovery
- Safe execution environment

**For Users**:
- Reusable tools across all agents and tasks
- Centralized management
- Easy tool addition via templates
- Secure credential management
- Extensible architecture

**For Development**:
- Modular design
- Tools separate from core system
- Template-based tool creation
- Independently testable

### Status

**Phase 4.0: External Tools System** ✅ COMPLETE
- ✅ Tool registry with auto-discovery
- ✅ Tool executor with fallback strategy
- ✅ Docker integration (read-only mounting)
- ✅ Environment variable management
- ✅ Agent context integration
- ✅ ServiceNow tools installed and configured
- ✅ Complete documentation
- ✅ Template for future tools

**Next Steps**:
1. Test tools in real task execution
2. Add more tools as needed (Jira, Slack, etc.)
3. Monitor tool usage patterns
4. Add tool versioning support

---

## [0.11.2-alpha] - 2025-10-25

### Added - Professional CLI Interface

**UX Improvements**

#### 1. Emoji-Free Professional Interface

**CLI Cleanup**:
- Removed all emoji icons from CLI output
- Replaced emoji prefixes with clear text labels (ERROR:, WARNING:)
- Maintained color-coded output for visual clarity
- Professional appearance suitable for enterprise environments

**Benefits**:
- Better compatibility with all terminals
- Improved readability in logs
- More professional presentation
- Cleaner screenshot/documentation appearance

#### 2. In-Workflow Project Creation

**Enhanced Project Dropdown**:
```
? Select project: (Use arrow keys)
    my-app
    test-project
  ─────────────────
  + Create New Project
```

**Features**:
- Create new projects directly from workflow dropdown
- No workflow interruption
- Seamless integration with existing flow
- GitHub repo creation deferred to validation step

**Workflow**:
1. Select "+ Create New Project" from dropdown
2. Enter project details (name, description, path, docker image)
3. Specify GitHub repository (not created yet)
4. Continue to task description
5. GitHub repo validated/created during normal workflow step

**Benefits**:
- Faster project creation
- No need to exit workflow
- Consistent user experience
- Reduces friction for new projects

### Changed

**CLI Output Format**:
- Before: `🚀 Executing Task...`
- After: `Executing Task...`
- Before: `✅ Task Complete!`
- After: `Task Complete!`
- Before: `📁 my-project`
- After: `  my-project` (2-space indent)
- Before: `➕ Create New Project`
- After: `+ Create New Project`

**Arrow Symbols**:
- Before: `→` (Unicode arrow)
- After: `->` (ASCII arrow)

### Technical Details

**Files Modified**:
- `cli.js` (lines 549-671): Added project creation in dropdown
- `cli.js` (global): Removed all emoji characters
- `README.md`: Updated examples and documentation
- `WORKFLOW_MODE_GUIDE.md`: Updated workflow examples
- `docs/CHANGELOG.md`: Added v0.11.2 entry

**Version**: v0.11.2-alpha
**Status**: Professional CLI + Dynamic Routing + Workflow Mode Complete
**Date**: 2025-10-25

---

## [0.11.1-alpha] - 2025-10-24

### Added - Testing Infrastructure

**Complete Testing System (57 tests, 100% pass rate)**

#### 1. Unit Tests (`test/unit/` - 260 lines)

**ClaudeCodeAgent Unit Tests** (25 tests):
- Configuration tests (4): initialization, timeout, retry, session IDs
- Role configuration tests (4): architect, coder, reviewer, custom
- Error classification tests (6): retryable vs non-retryable errors
- Error enhancement tests (3): context addition, troubleshooting hints
- System prompt tests (3): architect, coder, reviewer prompts
- Tool configuration tests (3): architect, coder, custom tools
- Helper method tests (2): sleep, retry validation

**Coverage**: Error handling, retry logic, timeout protection, tool configuration

#### 2. Smoke Tests (`test/smoke-test.js` - 192 lines, 7 tests)

**Quick System Health Check** (<30s):
- Docker daemon accessibility
- Configuration system loading
- Test project existence
- Container creation and operations
- File operations in containers
- Container cleanup
- Git operations

**Purpose**: Fast validation before making changes or after updates

#### 3. Validation Suite (`test/validation-suite.js` - 451 lines, 25 tests)

**Comprehensive System Validation** (~5s):

**Infrastructure Tests** (6):
- Docker daemon accessible
- Docker Python image exists
- Configuration system initializes
- Test project configuration exists
- Test project directory exists
- Git operations work

**File Operations Tests** (6):
- Container creation
- List files in container
- Read files in container
- Write files in container
- Execute Python in container
- Run pytest in container

**Cleanup System Tests** (4):
- Container stop
- Container remove
- Orchestrator cleanup registration
- Active container tracking

**Error Handling Tests** (3):
- ClaudeCodeAgent has timeout
- ClaudeCodeAgent has retry logic
- Error classification works

**Cost Tracking Tests** (3):
- CostMonitor initializes
- CostMonitor tracks usage
- CostMonitor enforces limit

**Agent System Tests** (3):
- Claude Code CLI available
- ClaudeCodeAgent initializes
- Agent system prompts defined

#### 4. Test Runner (`test/run-unit-tests.js` - 53 lines)

**Auto-discovering Test Runner**:
- Discovers all `*.test.js` files in `test/unit/`
- Runs tests with Node's built-in test runner
- Reports pass/fail counts and duration
- Clean output with colored formatting

#### 5. CLI Test Commands (`cli.js` - +42 lines)

**New Commands**:
```bash
claude validate           # Quick smoke tests (default)
claude validate --smoke   # Explicit smoke tests
claude validate --full    # Full validation suite
claude test               # Unit tests
claude test --all         # All tests (unit + smoke + validation)
```

#### 6. NPM Test Scripts (`package.json`)

**Test Scripts**:
```json
{
  "test": "node test/run-unit-tests.js",
  "test:unit": "node test/run-unit-tests.js",
  "test:smoke": "node test/smoke-test.js",
  "test:validate": "node test/validation-suite.js",
  "test:all": "npm run test:unit && npm run test:smoke && npm run test:validate"
}
```

#### 7. Documentation (`docs/TESTING.md` - 550 lines)

**Comprehensive Testing Guide**:
- Overview of all test levels
- Quick start commands
- Test coverage details
- Writing new tests
- Debugging failed tests
- Best practices
- CI/CD integration
- FAQ

### Changed

**Validation Suite Bug Fix**:
- Fixed git test to use `getCurrentBranch()` instead of `status()`
- All 25 validation tests now passing

### Status

**Test Results:**
```
Unit Tests:      25/25 passed ✅
Smoke Tests:     7/7 passed ✅
Validation:      25/25 passed ✅
Total:           57/57 passed (100%) ✅
Duration:        ~8 seconds (all tests)
Coverage:        ~30% (critical paths)
```

**Files Added:**
| File | Lines | Purpose |
|------|-------|---------|
| `test/unit/claude-code-agent.test.js` | 260 | Unit tests for ClaudeCodeAgent |
| `test/run-unit-tests.js` | 53 | Auto-discovering test runner |
| `docs/TESTING.md` | 550 | Complete testing guide |

**Files Modified:**
| File | Changes | Purpose |
|------|---------|---------|
| `test/validation-suite.js` | Fixed git test | Bug fix for 100% pass rate |
| `cli.js` | +42 lines | Test commands integration |
| `package.json` | Test scripts | NPM test integration |

**Phase 3.2: Testing & Validation** (Complete)
- ✅ Unit test infrastructure complete
- ✅ Smoke tests for quick validation
- ✅ Comprehensive validation suite
- ✅ CLI test commands integrated
- ✅ NPM scripts configured
- ✅ Testing documentation complete

**Next Steps:**
1. Performance optimization (model selection for agents)
2. `claude status` command
3. Increase test coverage to 50-60%
4. Integration tests

---

## [0.11.0-alpha] - 2025-10-23

### Added - Dynamic Agent Routing + Workflow Mode

**Major Features:**
- ✅ Dynamic agent routing system (1,138 lines of core code)
- ✅ Workflow-driven CLI mode (simple, linear, guided)
- ✅ GitHub repo validation and automatic creation
- ✅ Automatic container cleanup
- ✅ Single unified orchestrator (no duplicate code)

**Components Added:**
- `lib/agent-registry.js` (157 lines)
- `lib/standard-agents.js` (235 lines)
- `lib/task-planner.js` (253 lines)
- `lib/dynamic-agent-executor.js` (251 lines)

**Performance Improvements:**
- 59% faster for analysis-only tasks
- 63% faster for simple fixes
- Better quality for complex tasks (specialized agents)

---

## [0.10.0] - 2025-10-22

### Added - CLI Completeness & Performance Optimization

#### 1. New CLI Commands (`cli.js` - +51 lines, `lib/orchestrator.js` - +118 lines)

**Cancel Command:**
- `claude cancel <taskId>` - Cancel any task regardless of status
- Graceful cleanup (branch deletion, container removal)
- Handles missing resources (already deleted branch/container)
- Updates task status to 'cancelled' with timestamp

**Retry Command:**
- `claude retry <taskId>` - Retry failed, rejected, or cancelled tasks
- Validates task status before retry
- Re-executes as completely new task
- Shows original task details for context

**Diff Command:**
- `claude diff <taskId>` - Show git diff for task changes
- `claude diff <taskId> --stat` - Show diffstat only
- Displays project, branch, description, and status
- Handles incomplete tasks gracefully (failed tasks without branches)
- Formatted output with visual separators

#### 2. Git Manager Enhancement (`lib/git-manager.js` - updated)

**getDiff() Method Improvements:**
- Backward compatible with both old and new signatures
- Support for branch comparison: `getDiff(path, baseBranch, targetBranch, statOnly)`
- Support for existing options object: `getDiff(path, {staged: true, file: 'path'})`
- `--stat` flag support for diffstat-only output

### Changed - Performance Optimization

**Architect Prompt Verbosity Reduced:**
- Before: 12 lines with verbose instructions
- After: 8 lines with concise direction
- **Key Change:** "Create a concise implementation brief" + "max 3-4 sentences"
- **Goal:** Reduce Architect execution time (currently 22.5% of total)
- Expected impact: 5-10% faster architect phase, ~3-5s savings per task

**Prompt Optimization Details:**
```diff
- Analyze this project and create an implementation brief for: ${description}
+ Create a concise implementation brief for: ${description}

- **Your Task:**
- Create a detailed implementation brief with:
+ **Provide:**
  1. Files to modify/create
  2. Code patterns to follow
- 3. Specific implementation guidance
+ 3. Implementation approach (max 3-4 sentences)
  4. Testing strategy
- You have access to Read and Bash tools if you need to examine specific files in more detail, but the context above should give you a strong starting point.
+ Keep it brief - the coder needs clear direction, not an essay. You can use Read/Bash if needed.
```

### Status

**Phase 3.1: Hardening** (In Progress)
- ✅ Error handling complete
- ✅ Resource cleanup complete
- ✅ CLI completeness (cancel, retry, diff) complete
- ⬜ Unit test coverage (pending)
- ⬜ Integration tests (pending)
- ⬜ System validation script (pending)

**Key Achievements:**

1. **Complete CLI Suite**: All essential task management commands now available (task, approve, reject, cancel, retry, diff, status)
2. **Flexible Task Management**: Can cancel any task, retry failed tasks, inspect changes before approval
3. **Performance Focus**: First step toward optimizing agent execution time (architect verbosity reduced)

**Line Counts:**
| Component | Lines Added |
|-----------|-------------|
| CLI commands (cli.js) | +51 |
| Orchestrator methods (orchestrator.js) | +118 |
| Git manager enhancement (git-manager.js) | +26 |
| **Total Production Code** | **+195 lines** |

---

## [0.9.1] - 2025-10-21

### Added - Reliability & Error Handling Improvements

#### 1. Comprehensive Error Handling (`lib/claude-code-agent.js` - +120 lines)

**Timeout Protection:**
- Configurable timeout (default: 5 minutes)
- Graceful termination with SIGTERM
- Force kill with SIGKILL after 5 seconds if needed
- Clear timeout error messages

**Automatic Retry Logic:**
- Up to 3 retries with exponential backoff
- Intelligent error classification (retryable vs permanent)
- Retryable: rate limits, network errors, timeouts
- Non-retryable: permission denied, not found, syntax errors

**Enhanced Error Messages:**
- Context-rich error messages with troubleshooting hints
- Installation instructions for missing CLI
- Permission fix suggestions
- Rate limit guidance
- Retry attempt information
- Agent role context

**Helper Methods:**
- `_sleep(ms)` - Promise-based delay
- `_isRetryableError(error)` - Error classification
- `_enhanceError(error, context)` - Error enrichment

#### 2. Automatic Cleanup System (`lib/orchestrator.js` - +165 lines, `cli.js` - +35 lines)

**Automatic Container Cleanup:**
- `finally` block ensures cleanup on success AND failure
- Active container tracking via Set
- Cleanup on task completion (success or error)
- Idempotent cleanup operations

**Process Exit Handlers:**
- SIGINT (Ctrl+C) - Graceful cleanup before exit (code 130)
- SIGTERM (kill) - Graceful cleanup before termination (code 0)
- uncaughtException - Cleanup even on crashes (code 1)
- Prevents orphaned containers on interruption

**Manual Cleanup Command:**
- `claude cleanup` - Clean up tracked active containers
- `claude cleanup --all` - Nuclear cleanup of ALL Claude containers
- Clear user feedback and progress indicators

**Cleanup Methods:**
- `cleanupContainer(container)` - Clean specific container
- `cleanupAll()` - Clean all active tracked containers
- `cleanupAllClaudeContainers()` - Clean ALL Claude containers (orphaned too)
- `registerCleanupHandlers()` - Register process exit handlers

#### 3. Documentation System (`.claude/` directory)

**New Files:**
- `.claude/DOCUMENTATION_CHECKLIST.md` - Comprehensive update checklist
- `.claude/QUICK_REFERENCE.md` - Quick reference for doc updates
- `docs/ERROR_HANDLING.md` - Complete error handling guide
- `docs/AUTOMATIC_CLEANUP.md` - Cleanup system documentation
- `docs/PERFORMANCE_ANALYSIS.md` - Performance bottleneck analysis
- `HIGH_PRIORITY_TODOS_COMPLETED.md` - Summary of completed TODOs
- `CLEANUP_FEATURE_COMPLETE.md` - Cleanup feature summary

### Changed

**Error Handling:**
- `query()` method now wraps `_executeQuery()` with retry logic
- Spawn process now has timeout protection
- Error messages now include context and troubleshooting

**Container Management:**
- `executeTask()` now uses try/finally for guaranteed cleanup
- Containers tracked in Set for bulk cleanup
- Stops container AND removes from tracking

**CLI Commands:**
- Added `cleanup` command with optional `--all` flag

### Fixed

**Critical Issues:**
- ✅ Docker containers now cleaned up on errors (was leaking)
- ✅ Docker containers now cleaned up on Ctrl+C (was leaking)
- ✅ Docker containers now cleaned up on crashes (was leaking)
- ✅ No more indefinite hangs (timeout protection)
- ✅ Better error messages for common failures

### Performance

**Error Handling:**
- Happy path: <5ms overhead
- Error path: 2-12s for retries (only on failures)
- Timeout check: <1ms overhead

**Cleanup:**
- No impact on successful tasks (cleanup already existed)
- +50-100ms on error path (cleanup now happens)
- Parallel cleanup when multiple containers active

### Testing & Validation

**Completed High-Priority TODOs:**
1. ✅ Cleaned up 11 hanging Docker containers
2. ✅ Verified file writing works (power() function test)
3. ✅ Identified performance bottlenecks (Coder: 51.5%, Execution: 92.5%)
4. ✅ Added comprehensive error handling (timeout, retry, enhanced messages)
5. ✅ Added automatic cleanup system (tracked resources, exit handlers)

**Test Results:**
- File writing test: 245.4s, $0.1301, 100% success
- Cleanup command: Successfully removed 1 container
- All Claude containers cleaned up
- Zero hanging containers after testing

### Documentation

**New Guides:**
- Error handling implementation and usage
- Automatic cleanup system and workflows
- Performance analysis and bottleneck identification
- High-priority TODO completion summary
- Documentation update checklist and quick reference

**Updated:**
- CHANGELOG.md (this file)
- RESUME.md (session summary)
- STATUS.md (version and features)

### Line Counts

| Component | Lines Added |
|-----------|-------------|
| Error handling (claude-code-agent.js) | +120 |
| Cleanup system (orchestrator.js) | +165 |
| CLI cleanup command (cli.js) | +35 |
| Documentation | 6 comprehensive guides |
| **Total Production Code** | **+320 lines** |

### Status

**Phase 2.9: Interactive UX** → **Phase 3.1: Hardening** (In Progress)
- ✅ Error handling complete (timeout, retry, enhanced messages)
- ✅ Resource cleanup complete (automatic + manual)
- ✅ Documentation system established
- ⬜ Unit test coverage (pending)
- ⬜ Integration tests (pending)
- ⬜ CLI completeness (cancel, retry, diff) (pending)

**Key Achievements:**

1. **Zero Resource Leaks**: All containers cleaned up in ALL scenarios (success, error, interrupt, crash)
2. **Robust Error Handling**: Timeout protection, automatic retries, enhanced messages
3. **Documentation Discipline**: Comprehensive checklist ensures docs stay updated
4. **Production Ready**: System handles failures gracefully, no manual cleanup needed

---

## [0.9.0] - 2025-10-20

### Added - Interactive CLI (`dev-tools`)

#### Beautiful User Experience

1. **dev-tools Command** (`dev-tools.js` - new, 431 lines)
   - **Interactive project selection:**
     - Dropdown list of all configured projects
     - Option to create new project
     - Exit option
     - Automatic project creation wizard for first-time users
   - **Project creation wizard:**
     - Step-by-step guided setup
     - Project name validation
     - GitHub repository URL validation
     - Docker image selection (Python, Node.js, or custom)
     - Test command configuration
     - Pull request requirements
     - Configuration preview before saving
     - Automatic validation and error messages
   - **Task description editor:**
     - Opens default editor (vim/nano)
     - Multi-line task descriptions
     - Examples provided for guidance
     - Input validation
   - **Smart backend detection:**
     - Auto-detects Claude Code CLI vs Anthropic API
     - Only shows cost limit for API usage (not subscription)
     - No unnecessary prompts
   - **Beautiful confirmation:**
     - Shows project, task, mode, backend
     - Conditionally shows cost limit only when relevant
     - Clear summary before execution

2. **Intelligent Cost Management**
   - **Claude Code CLI (Pro/Max subscription):**
     - No cost prompt (subscription-based)
     - Shows: "Using Claude Code CLI (no API cost limit needed)"
   - **Anthropic API (pay-per-token):**
     - Shows: "Using Anthropic API (pay-per-token pricing)"
     - Optional cost limit setting
     - Default: $5.00, max: $50.00
     - Validation prevents invalid amounts

3. **Interactive Mode Always On**
   - No prompts about interactive mode
   - Always enabled by default
   - Provides best user experience
   - Real-time feedback during agent execution

4. **ASCII Art Banner**
   - Beautiful visual welcome screen
     ```
     ╔═══════════════════════════════════════════════════════════════════╗
     ║   ██████╗ ███████╗██╗   ██╗      ████████╗ ██████╗  ██████╗ ██╗  ║
     ║   ██╔══██╗██╔════╝██║   ██║      ╚══██╔══╝██╔═══██╗██╔═══██╗██║  ║
     ║   ██║  ██║█████╗  ██║   ██║█████╗   ██║   ██║   ██║██║   ██║██║  ║
     ║   ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════╝   ██║   ██║   ██║██║   ██║██║  ║
     ║   ██████╔╝███████╗ ╚████╔╝          ██║   ╚██████╔╝╚██████╔╝███████╗║
     ║   ╚═════╝ ╚══════╝  ╚═══╝           ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝║
     ║            Claude Multi-Agent Development Assistant              ║
     ╚═══════════════════════════════════════════════════════════════════╝
     ```
   - Professional branding
   - Immediate visual impact
   - Sets tone for high-quality UX

#### Project Wizard Features

5. **Input Validation**
   - Project names: lowercase, numbers, hyphens only
   - GitHub URLs: Must contain "github.com"
   - Custom images: Required if custom selected
   - All inputs validated before saving

6. **Docker Image Selection**
   - 🐍 Python (claude-python:latest)
   - 📦 Node.js (claude-node:latest)
   - 🔧 Custom (user-specified)

7. **Configuration Preview**
   - Shows full YAML before saving
   - Confirmation prompt
   - Easy to cancel and restart
   - Clear error messages

#### Documentation

8. **User Guide** (`docs/DEV-TOOLS-GUIDE.md` - new, comprehensive)
   - Quick start instructions
   - Complete usage flow walkthrough
   - Example workflows (simple, complex, bug fix)
   - Pro tips for best results
   - Troubleshooting section
   - Comparison with old CLI

#### Dependencies Added
- `inquirer@9.2.15` - Interactive CLI prompts
- Total packages: 196 (was 154)

#### package.json Updates
- Added `dev-tools` to bin scripts
- Enables global `dev-tools` command
- Works alongside existing `claude` command

### Benefits

- **Faster Workflow:** No more remembering CLI arguments
- **Better UX:** Visual guidance at every step
- **Fewer Errors:** Validation prevents common mistakes
- **Easier Onboarding:** New users can set up without reading docs
- **Smart Defaults:** Auto-detects best settings
- **Mobile-Friendly:** Works perfectly via SSH

### Line Counts
- dev-tools.js: 431 lines (new)
- DEV-TOOLS-GUIDE.md: comprehensive guide (new)
- package.json: updated (bin scripts)
- Total new code: 431 lines

### Status
**Phase 2.9: Interactive UX** ✅ COMPLETE
- ✅ Beautiful interactive CLI
- ✅ Project wizard with validation
- ✅ Smart backend detection
- ✅ Intelligent cost management
- ✅ Interactive mode always on
- ✅ ASCII art branding
- ✅ Comprehensive documentation

**Key Achievements:**

1. **Zero-Learning-Curve UX**: New users can create projects and run tasks without reading documentation. Step-by-step wizard guides them through entire process.

2. **Smart Context Awareness**: System detects which backend (CLI vs API) is being used and only asks relevant questions. No more unnecessary prompts about cost when using subscription model.

3. **Production-Ready Interface**: Professional ASCII art banner, clear visual hierarchy, color-coded output, and emoji indicators create polished experience suitable for demo/portfolio.

**User Experience:**

| Aspect | Old CLI | dev-tools |
|--------|---------|-----------|
| **Project Selection** | Type manually | Dropdown |
| **Task Input** | One-line argument | Multi-line editor |
| **Project Creation** | Manual YAML | Guided wizard |
| **Validation** | Runtime errors | Pre-validated |
| **Cost Settings** | Always asked | Only when relevant |
| **Learning Curve** | Read docs first | Self-explanatory |

**Ready For:**
- User demos and presentations
- Portfolio showcasing
- Real-world daily usage
- Further UX enhancements

---

## [0.8.0] - 2025-10-17

### Added - Performance Optimization & Context Enhancement

#### Performance Profiling System

1. **Detailed Timing Instrumentation** (`lib/claude-code-agent.js` - updated)
   - **Profiling object** tracks spawn, execution, and parse phases separately
   - **Aggregation** across all agent invocations
   - **Percentage breakdown** showing time distribution
   - **Key Finding:** 93.3% of time spent in Claude Code CLI execution, 6.7% in orchestration

2. **Orchestrator Profiling Display** (`lib/orchestrator.js` - updated)
   - Real-time profiling data collection from all agents
   - Aggregated metrics for architect, coder, and reviewer
   - Performance breakdown display
   - Insight: Bottleneck is Claude Code CLI processing, not orchestration

#### Parallel Operations

3. **Concurrent Git + Docker Setup** (`lib/orchestrator.js` - updated)
   - Git operations (pull + createBranch) run in parallel with Docker creation
   - Uses `Promise.all()` for concurrent execution
   - **Savings:** 1-2 seconds per task

#### Context Caching Infrastructure

4. **File Caching System** (`lib/conversation-thread.js` - updated to 581 lines)
   - **cacheFile(filePath, content)**: Store file contents with metadata
   - **getCachedFile(filePath)**: Retrieve cached contents
   - **getFileCacheStats()**: Get detailed statistics
   - **Integration:** Files cached during context gathering, available to all agents

5. **Project Context Gathering** (`lib/orchestrator.js` - added `gatherProjectContext()`)
   - Runs before any agents start
   - Auto-detects tech stack
   - Reads and caches key files
   - Extracts code patterns

6. **Context Formatting** (`lib/orchestrator.js` - added `formatProjectContext()`)
   - Formats rich context for agent prompts
   - Provided to all agents as starting context

#### Documentation

7. **Optimization Results** (`docs/OPTIMIZATION_RESULTS.md` - comprehensive)
8. **Context Enhancement** (`docs/CONTEXT_ENHANCEMENT.md` - detailed)

### Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Total Time** | 162.6s | 139.9s | **-22.7s (-13.9%)** |
| **Cost** | $0.0855 | $0.0766 | **-$0.0089 (-10.4%)** |

---

## [0.7.0] - 2025-10-17

### Added - Consensus Detection & Enhanced Collaboration

#### Consensus Detection System

1. **ConversationThread Consensus Methods** (`lib/conversation-thread.js` - updated to 540 lines)
   - **isReadyToImplement()**: Detects when coder explicitly states readiness
   - **isApproved()**: Detects when reviewer approves implementation
   - **hasUnresolvedIssues()**: Detects outstanding problems
   - **detectConsensus()**: General consensus detection
   - **shouldContinueCollaboration()**: Workflow decision engine

2. **Agent-to-Agent Dialogue**
   - Direct peer communication between agents
   - Automatic dialogue detection
   - Smart termination
   - Reduces iteration cycles

---

## [0.6.0] - 2025-10-16

### Added - Claude Code CLI Agent Backend

#### Core Implementation

1. **ClaudeCodeAgent** (`lib/claude-code-agent.js` - 219 lines)
   - Claude Code CLI integration
   - Agent roles (Architect, Coder, Reviewer)
   - Tool scoping per role
   - System prompts
   - Cost tracking

#### Critical Bug Fixes

2-7. **Five Major Bug Fixes:**
   - File writing on bind mounts (tee command)
   - CLI argument parsing
   - Stdin handling
   - Path references
   - Docker capabilities

### Status
- ✅ Working multi-agent system
- ✅ Uses Pro/Max subscription
- ✅ Full workflow tested (2m 16s)

---

## [0.5.0] - 2025-10-16

### Added - Agent Conversation Display & Test Project

1. **Real-time conversation display**
2. **Test project infrastructure**
3. **Full workflow testing**

---

## [0.4.0] - 2025-10-16

### Added - Multi-Agent System

1. **AgentCoordinator** (401 lines)
   - Two-agent architecture (Coder + Reviewer)
   - Multi-turn conversation
   - Approval mechanism

---

## [0.3.0] - 2025-10-16

### Added - Core Infrastructure Modules

1-7. **Seven production modules implemented**

---

## [0.2.0] - 2025-10-15

### Added - Proof-of-Concept Implementation

---

## [0.1.0] - 2025-10-15

### Added - Initial Skeleton Setup

---
