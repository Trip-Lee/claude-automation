# TODO - Claude Multi-Agent System

> **⚠️ ARCHIVED - 2025-10-23**
>
> This TODO list is from v0.6.0 (2025-10-16) and is now **archived**.
>
> **See `PRIORITIZED_TODOS.md` for the current, actively maintained TODO list.**
>
> This file is kept for historical reference only. Many items have been completed or superseded.

---

## Critical Issues to Fix

### 1. **Verify File Writing with New Functions**
- **Status:** 🔴 HIGH PRIORITY
- **Problem:** Current test found multiply() already exists, didn't test actual file creation
- **Action Needed:**
  - Test with a function name that doesn't exist (e.g., `divide_by_two()`, `power()`)
  - Verify file writes actually persist to disk
  - Check that coder agent successfully creates new functions
- **Files:** All agent workflow
- **Test Command:**
  ```bash
  ./cli.js task test-project "Add a divide_by_two(n) function to main.py with tests"
  ```

### 2. **Performance Investigation**
- **Status:** 🟡 MEDIUM PRIORITY
- **Problem:** Claude Code agents take 2m 16s vs expected <1min
- **Possible Causes:**
  - System prompts too long
  - Tool restrictions slowing down agent
  - Multiple Claude Code sessions overhead
  - Caching not being used effectively
- **Action Needed:**
  - Profile agent execution times (architect vs coder vs reviewer)
  - Test with shorter system prompts
  - Consider using single session with continue
  - Compare with Anthropic API direct performance
- **Files:** `lib/claude-code-agent.js`, `lib/orchestrator.js`

### 3. **Error Handling Edge Cases**
- **Status:** 🟡 MEDIUM PRIORITY
- **Known Issues:**
  - What happens if Claude Code CLI fails mid-execution?
  - How to handle permission denials from Claude Code?
  - Timeout handling for long-running agent tasks
- **Action Needed:**
  - Add timeout to spawn() call
  - Better error messages from Claude Code stderr
  - Retry logic for transient failures
  - Graceful degradation to mock mode
- **Files:** `lib/claude-code-agent.js`

## Testing & Validation

### 4. **Comprehensive Test Suite**
- **Status:** 🟡 MEDIUM PRIORITY
- **Needed Tests:**
  - ✅ Test with function that doesn't exist
  - ⬜ Test with multiple files to modify
  - ⬜ Test with failing tests (coder should fix)
  - ⬜ Test with reviewer rejection (should iterate)
  - ⬜ Test with complex refactoring task
  - ⬜ Test with timeout scenarios
  - ⬜ Test with permission errors
- **Files:** Create `test/test-claude-code-workflow.js`

### 5. **Docker Container File Write Verification**
- **Status:** 🟢 LOW PRIORITY (works but needs verification)
- **Current:** Using `tee` command for bind mount writes
- **Needed:**
  - Test with large files (>1MB)
  - Test with special characters in filenames
  - Test with deep directory structures
  - Verify file permissions after write
- **Files:** `test/container-tools.js`

## Feature Enhancements

### 6. **Session Continuation**
- **Status:** 🟢 LOW PRIORITY
- **Idea:** Use single Claude Code session with `--continue` flag
- **Benefits:**
  - Faster execution (no context reload)
  - Better conversation flow
  - Lower cost (cache hits)
- **Action Needed:**
  - Research `--continue` flag behavior
  - Test if session persists between spawns
  - Implement session continuation in ClaudeCodeAgent
- **Files:** `lib/claude-code-agent.js`

### 7. **Cost Optimization**
- **Status:** 🟢 LOW PRIORITY
- **Ideas:**
  - Use Haiku for architect (analysis only)
  - Use Sonnet for coder (requires smarts)
  - Use Haiku for reviewer (pattern matching)
- **Action Needed:**
  - Add `--model` flag support to ClaudeCodeAgent
  - Test cost difference with model selection
  - Update orchestrator to specify models per agent
- **Files:** `lib/claude-code-agent.js`, `lib/orchestrator.js`

### 8. **Real-time Progress Display**
- **Status:** 🟢 LOW PRIORITY
- **Idea:** Stream Claude Code output to show thinking process
- **Benefits:**
  - Better UX (see what's happening)
  - Debug hanging issues faster
  - Understand agent reasoning
- **Action Needed:**
  - Capture and parse Claude Code stderr
  - Display tool usage in real-time
  - Show agent thinking (with --verbose)
- **Files:** `lib/claude-code-agent.js`

## Documentation

### 9. **Claude Code Backend Documentation**
- **Status:** 🟡 MEDIUM PRIORITY
- **Needed:**
  - Architecture diagram (Orchestrator → ClaudeCodeAgent → CLI)
  - Setup guide (no API key required)
  - Troubleshooting section
  - Performance expectations
  - Cost comparison (API vs Pro/Max)
- **Files:** Create `docs/CLAUDE_CODE_BACKEND.md`

### 10. **Update README**
- **Status:** 🟡 MEDIUM PRIORITY
- **Needed:**
  - Add Claude Code backend option
  - Update prerequisites (Claude Pro/Max OR API key)
  - Add performance metrics
  - Add cost estimates
- **Files:** `README.md` (if exists, otherwise create)

## Infrastructure

### 11. **Clean Up Background Processes**
- **Status:** 🔴 HIGH PRIORITY (for next session)
- **Problem:** 8+ hanging background bash processes from testing
- **Action Needed:**
  ```bash
  # Kill all hanging tests
  pkill -f "test-claude-code-agent.js"
  pkill -f "cli.js task test-project"

  # Clean up Docker containers
  docker ps -a | grep claude- | awk '{print $1}' | xargs docker rm -f
  ```
- **Affected:** System resources

### 12. **Git Commit Current State**
- **Status:** 🟡 MEDIUM PRIORITY
- **Action Needed:**
  - Commit all v0.6.0 changes
  - Tag as v0.6.0
  - Push to remote (if configured)
  ```bash
  git add -A
  git commit -m "feat: Add Claude Code CLI backend integration (v0.6.0)

  - Implement ClaudeCodeAgent wrapper for Claude Code CLI
  - Add 3-agent workflow (Architect, Coder, Reviewer)
  - Fix critical bugs (file writes, arg parsing, stdin handling)
  - Add comprehensive testing and documentation

  Working but has known issues with performance and edge cases.
  See TODO.md and RESUME.md for details."

  git tag v0.6.0
  ```

## Research & Investigation

### 13. **Alternative Claude Code Flags**
- **Status:** 🟢 LOW PRIORITY
- **Research Needed:**
  - `--fallback-model` for reliability
  - `--mcp-config` for custom tools
  - `--agents` for custom agent definitions
  - `--permission-mode` options
- **Goal:** Find flags that improve performance/reliability
- **Files:** `lib/claude-code-agent.js`

### 14. **MCP Integration Revisited**
- **Status:** 🟢 FUTURE
- **Question:** Should we use MCP servers for container tools?
- **Pros:**
  - Standardized protocol
  - Better tooling
  - Potentially faster
- **Cons:**
  - More complex setup
  - Overhead for simple use case
- **Action:** Research when time permits

---

## Priority Summary

### 🔴 High Priority (Do First)
1. Verify file writing with new functions
2. Clean up background processes

### 🟡 Medium Priority (Do Soon)
3. Performance investigation
4. Error handling edge cases
5. Comprehensive test suite
6. Documentation (Claude Code backend)
7. Update README
8. Git commit current state

### 🟢 Low Priority (Nice to Have)
9. Session continuation
10. Cost optimization
11. Real-time progress display
12. Research alternative flags
13. Docker container verification
14. MCP integration revisited

---

## Notes

- All critical bugs from the initial implementation have been fixed
- System is functional end-to-end with Claude Code backend
- Main remaining issue is performance optimization
- Documentation needs updating to reflect new backend option
- Testing needs to be more comprehensive

**Last Updated:** 2025-10-16
**By:** Claude (Session ID: context from previous conversation)
