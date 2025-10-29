# Prioritized TODOs - October 29, 2025

**Current Version**: v0.13.0
**Current Phase**: ✨ Production Ready - Fully Installable
**Last Updated**: 2025-10-29

> **📝 Note**: This is the actively maintained TODO list. The old `TODO.md` has been archived as of 2025-10-23.
> **✅ Latest**: v0.13.0 released - Fully installable and portable system!

---

## ✅ RECENTLY COMPLETED (Last 2 Weeks)

### Installability & Production Ready - COMPLETE (2025-10-29)
**Status**: DONE - v0.13.0 released
**Time Actual**: ~8 hours

**Completed**:
- [x] Created `lib/global-config.js` (250 lines) - Centralized configuration system
- [x] Created `lib/system-validator.js` (250 lines) - Dependency validation
- [x] Created `install.js` (200 lines) - Interactive installer wizard
- [x] Created `INSTALLATION.md` (400+ lines) - Complete installation guide
- [x] Updated `cli.js` - Global config integration, auto-directory creation
- [x] Updated `lib/config-manager.js` - Dynamic config paths
- [x] Updated `lib/orchestrator.js` - Dynamic project/task paths, auto-PR creation
- [x] Updated `lib/cost-monitor.js` - Dynamic log paths
- [x] Updated `lib/docker-manager.js` - Dynamic security validation
- [x] Updated `package.json` - v0.13.0, install scripts
- [x] Removed all hardcoded paths (`/home/coltrip/*`)
- [x] Added auto-PR creation (no manual approval needed)
- [x] Added pre-flight validation (catches errors early)
- [x] Enhanced error messages with actionable solutions
- [x] Fixed SSH URL parsing bug
- [x] Updated all documentation (README, STATUS, CHANGELOG)

**Results**:
- ✅ Works on any system, any user (fully portable)
- ✅ Interactive installer validates all dependencies
- ✅ Auto-creates all required directories
- ✅ PRs created automatically after tasks
- ✅ Comprehensive error handling
- ✅ Professional installation experience
- ✅ ~1,200 lines of new code
- ✅ 11 files modified, 4 new files created

**Code Statistics**:
- Lines Added: ~1,200 (installation: 700, config: 200, error handling: 175, docs: 125)
- New Files: 4 (global-config, system-validator, install.js, INSTALLATION.md)
- Modified Files: 11 (all core components)
- Documentation: Complete installation guide with troubleshooting

**Documentation**: See INSTALLATION.md, README.md, docs/CHANGELOG.md

**Benefits**:
- Professional distribution-ready system
- Easy to install on new machines
- Clear dependency requirements
- Configurable paths for custom setups
- Faster workflow (auto-PR creation)
- Better error messages prevent wasted time

---

### External Tools System - COMPLETE (2025-10-27)
**Status**: DONE - ServiceNow tools integrated
**Time Actual**: ~6 hours

**Completed**:
- [x] Created `lib/tool-registry.js` (357 lines) - Tool discovery & management
- [x] Created `lib/tool-executor.js` (249 lines) - Tool execution with fallback
- [x] Updated `lib/docker-manager.js` (+40 lines) - Tools mount & env vars
- [x] Updated `lib/orchestrator.js` (+20 lines) - Tool registry integration
- [x] Created `tools/` directory with sn-tools v2.1.0
- [x] Created tool manifest system (YAML-based)
- [x] Created `tools/README.md` (350 lines) - Tools documentation
- [x] Created `tools/template/tool-manifest.yaml` - Template for new tools
- [x] Created `TOOLS_SYSTEM.md` (650+ lines) - Implementation docs
- [x] Updated all documentation (README, STATUS, CHANGELOG)

**Results**:
- ✅ Tool registry auto-discovers tools
- ✅ ServiceNow tools (11 capabilities) available to agents
- ✅ Read-only mounting security enforced
- ✅ Namespaced environment variables (SNTOOL_*)
- ✅ Dedicated execution interface with Bash fallback
- ✅ Template-based tool creation
- ✅ Complete documentation

**Documentation**: See TOOLS_SYSTEM.md, tools/README.md

**Benefits**:
- Agents can now use external tools beyond core functionality
- Reusable tools across all agents and tasks
- Easy addition of new tools (Jira, Slack, etc.)
- Secure execution environment

---

### System Validation & Smoke Tests - COMPLETE (2025-10-24)
**Status**: DONE - 57 tests, 100% pass rate
**Time Actual**: 8 hours (includes unit tests)

**Completed**:
- [x] Created `test/smoke-test.js` - 7 tests, ~3-5s
- [x] Created `test/validation-suite.js` - 25 tests, ~3-5s
- [x] Created `test/unit/claude-code-agent.test.js` - 25 tests, ~0.2s
- [x] Created `test/run-unit-tests.js` - Auto-discovering test runner
- [x] Added `claude validate` command with --smoke and --full flags
- [x] Added `claude test` command with --all flag
- [x] Added NPM test scripts (test, test:unit, test:smoke, test:validate, test:all)
- [x] Created docs/TESTING.md (550 lines comprehensive guide)

**Results**:
- ✅ 57/57 tests passing (100%)
- ✅ Duration: ~8 seconds total
- ✅ Coverage: ~30% (critical paths)
- ✅ CLI integration complete

**Documentation**: See docs/TESTING.md

---

## 🔥 HIGH PRIORITY (Next 1-2 Weeks)

### Goal: Optimize performance and expand test coverage

---

### 1. Performance - Low-Hanging Fruit ⏱️ 4-6 hours
**Why**: System is 2x slower than goal (245s vs 120s)
**Impact**: HIGH - Users feel the speed

**Based on Performance Analysis**:
- Coder bottleneck: 126.4s (51.5%)
- Architect: 55.1s (22.5%)
- Reviewer: 45.5s (18.5%)

**Quick Wins (No Architecture Changes)**:

#### 1.1 Reduce Architect Brief Verbosity
- [ ] Analyze architect brief from test run
- [ ] Identify redundant sections
- [ ] Create concise brief template
- [ ] Test with simple task
- [ ] Measure improvement

**Expected**: -10-15s (20% architect improvement)

#### 1.2 Optimize Reviewer with Context
- [ ] Pre-load test results to reviewer
- [ ] Skip redundant file reads
- [ ] Streamline approval flow

**Expected**: -5-10s (15-20% reviewer improvement)

#### 1.3 Parallel Test Execution (If applicable)
- [ ] Run tests while coder is working
- [ ] Don't block on sequential test → review

**Expected**: -5-10s if tests are separate step

**Total Expected**: **-20-35s** (8-14% improvement)
**New Target**: 210-225s (closer to 180s realistic goal)

---

### 2. CLI Quick Wins ⏱️ 3-4 hours
**Why**: Improves daily usability immediately
**Impact**: MEDIUM-HIGH - Better UX

**Essential Commands**:

#### 2.1 `claude cancel <taskId>` command
- [ ] Stop running agents gracefully
- [ ] Cleanup containers
- [ ] Mark task as cancelled
- [ ] Show cancellation summary

**User Story**: "I started wrong task, need to cancel it"

#### 2.2 `claude status` command
- [ ] Show all active/pending tasks
- [ ] Show container status
- [ ] Show resource usage
- [ ] Show recent task history

**User Story**: "What tasks are running? What happened yesterday?"

#### 2.3 Improved error messages
- [ ] Better validation errors (missing config, etc)
- [ ] Suggest fixes for common problems
- [ ] Link to troubleshooting docs

**User Story**: "Error message should tell me how to fix it"

---

### 3. Unit Test Coverage to 50% ⏱️ 6-8 hours
**Why**: Prevent regressions, enable confident changes
**Impact**: MEDIUM - Foundation for quality

**Critical Modules to Test**:
- [ ] `lib/claude-code-agent.js` - Error handling logic
  - Test timeout
  - Test retry logic
  - Test error classification
  - Test error enhancement
- [ ] `lib/orchestrator.js` - Cleanup logic
  - Test container tracking
  - Test cleanup on success
  - Test cleanup on error
  - Test exit handlers
- [ ] `lib/config-manager.js` - Validation logic
  - Test config loading
  - Test validation
  - Test defaults

**Target**: 50-60% coverage (not 80% yet, but critical paths)

**Tools**: Jest or Mocha (already familiar?)

---

## 🟡 MEDIUM PRIORITY (Next 2-4 Weeks)

### Goal: Professional polish and comprehensive testing

---

### 4. Comprehensive Test Suite ⏱️ 12-16 hours

**Integration Tests**:
- [ ] Test full workflow (simple task)
- [ ] Test full workflow (complex task)
- [ ] Test error scenarios (API down, Docker down)
- [ ] Test interruption scenarios (Ctrl+C at each phase)
- [ ] Test approval/rejection flows
- [ ] Test cleanup in all scenarios

**Edge Cases**:
- [ ] Very large files
- [ ] Binary files
- [ ] Permission errors
- [ ] Network failures
- [ ] Rate limiting
- [ ] Timeout scenarios

**Benchmark Suite**:
- [ ] Simple tasks: <90s
- [ ] Medium tasks: <180s
- [ ] Complex tasks: <300s
- [ ] Cost: <$0.15 per medium task

---

### 5. Model Selection Strategy ⏱️ 4-6 hours
**Why**: Can reduce cost 30-40% with similar speed
**Impact**: MEDIUM - Cost optimization

**Strategy**:
- Architect: **Haiku** (fast, cheap analysis)
- Coder: **Sonnet** (smart implementation needed)
- Reviewer: **Haiku** (pattern matching sufficient)

**Implementation**:
- [ ] Add model selection to ClaudeCodeAgent
- [ ] Test Haiku for architect (quality check)
- [ ] Test Haiku for reviewer (quality check)
- [ ] Measure performance impact
- [ ] Measure cost impact

**Expected**: Similar speed, -30-40% cost

---

### 6. Advanced CLI Features ⏱️ 6-8 hours

- [ ] Progress indicators (ora library)
  - Show agent thinking
  - Show file operations
  - Show test execution
- [ ] `claude diff <taskId>` - Show changes
- [ ] `claude retry <taskId>` - Retry failed task
- [ ] Verbose/quiet modes
- [ ] Command auto-completion (bash/zsh)

---

## 🟢 LOWER PRIORITY (Next 1-2 Months)

### Goal: Advanced features and optimization

---

### 7. Context Caching Optimization ⏱️ 8-12 hours

**Current Issue**: Files read multiple times
- Architect reads: main.py, test_main.py
- Coder reads: main.py, test_main.py (again!)
- Reviewer reads: main.py, test_main.py (again!)

**Solution**:
- [ ] Parse agent responses for file paths
- [ ] Read and cache mentioned files
- [ ] Provide cache summaries in prompts
- [ ] Invalidate cache when files change

**Expected**: 10-15% improvement

---

### 8. Docker Enhancements ⏱️ 4-6 hours

- [ ] Container versioning (tag containers with version)
- [ ] Health checks (verify container is responsive)
- [ ] Resource monitoring (CPU/RAM usage)
- [ ] Container logs persistence
- [ ] Multiple container support (parallel tasks)

---

### 9. Git/GitHub Enhancements ⏱️ 6-8 hours

- [ ] Merge conflict detection
- [ ] Draft PRs (for review before final)
- [ ] PR templates
- [ ] Automatic labeling
- [ ] Link to task ID in PR description

---

### 10. Advanced Agent Features ⏱️ 12-20 hours

- [ ] Agent-to-agent dialogue (already implemented, needs testing)
- [ ] Consensus detection tuning
- [ ] Streaming output (real-time agent thinking)
- [ ] Parallel agent execution
- [ ] Agent selection based on task type

---

### 11. Documentation & Research ⏱️ 4-6 hours

**Documentation Needs:**
- [ ] Claude Code Backend guide (`docs/CLAUDE_CODE_BACKEND.md`)
  - Architecture diagram (Orchestrator → ClaudeCodeAgent → CLI)
  - Setup guide (no API key required)
  - Troubleshooting section
  - Performance expectations
  - Cost comparison (API vs Pro/Max)
- [ ] Update README with current capabilities
  - Add Claude Code backend option
  - Update prerequisites (Claude Pro/Max OR API key)
  - Add performance metrics and cost estimates

**Research Tasks:**
- [ ] Alternative Claude Code flags exploration
  - `--fallback-model` for reliability
  - `--mcp-config` for custom tools
  - `--agents` for custom agent definitions
  - `--permission-mode` options
- [ ] Session continuation with `--continue` flag
  - Research flag behavior
  - Test if session persists between spawns
  - Potential for faster execution and lower cost
- [ ] MCP integration revisited (future exploration)
  - Evaluate pros/cons for container tools
  - Consider when testing infrastructure is solid

---

### 12. Docker Edge Cases Testing ⏱️ 2-3 hours

- [ ] Test large files (>1MB)
- [ ] Test special characters in filenames
- [ ] Test deep directory structures
- [ ] Verify file permissions after write
- [ ] Test with binary files
- [ ] Stress test concurrent operations

---

## 📋 RECOMMENDED SPRINT PLAN

### ✅ Week 1 (Oct 21-27): COMPLETE - Validation & Tools
**Goal**: Foundation + External Tools

**Completed**:
- ✅ System validation suite (v0.11.1)
- ✅ 57 tests, 100% pass rate
- ✅ External tools system (v0.12.0)
- ✅ ServiceNow integration
- ✅ Documentation updates

---

### Week 2 (Oct 28-Nov 3): Performance & Testing
**Goal**: Speed improvements + Test coverage

**Monday-Tuesday** (6-8 hours):
- [ ] Performance optimization (Item #1)
  - Architect brief reduction
  - Reviewer optimization
  - Model selection experiments
- [ ] Measure improvements

**Wednesday-Thursday** (4-6 hours):
- [ ] CLI Quick Wins (Item #2)
  - `claude status` command
  - `claude cancel` command
  - Improved error messages

**Friday** (6-8 hours):
- [ ] Start Unit Test Coverage (Item #3)
  - Orchestrator tests
  - Begin ConfigManager tests

**Expected Outcomes**:
- System 15-30% faster
- `claude status` working
- Foundation for testing expansion

---

### Week 3 (Nov 4-10): Test Coverage Complete
**Goal**: Solid test foundation

- [ ] Complete Unit Test Coverage (Item #3)
  - Finish Orchestrator, ConfigManager tests
  - Tool Registry tests
  - Target: 50-60% coverage
- [ ] Comprehensive Test Suite (Item #4)
  - Integration tests
  - Error scenarios
  - Edge cases

**Expected Outcomes**:
- 50-60% test coverage ✅
- Integration tests passing ✅
- Confident to make major changes

---

### Week 4 (Nov 11-17): Polish & Advanced Features
**Goal**: Production-ready polish

- [ ] Model Selection Strategy (Item #5)
- [ ] Advanced CLI Features (Item #6)
- [ ] Troubleshooting documentation
- [ ] Performance monitoring

**Expected Outcomes**:
- Cost reduced 30-40% ✅
- Professional CLI polish ✅
- Complete documentation

---

## 🎯 CURRENT TOP PRIORITIES (Updated 2025-10-28)

### If You Have 6 Hours This Week:

**#1: Performance Optimization (4-6 hours) - HIGH IMPACT** (Item #1)
- Reduce architect brief verbosity
- Optimize reviewer context
- Model selection experiments (Haiku vs Sonnet)
- Measure improvements

**Why**: System is 2x slower than goal (245s vs 120s). Quick wins provide immediate value.

**#2: `claude status` Command (1-2 hours) - HIGH VALUE** (Item #2.2)
```bash
claude status
# Shows running tasks
# Shows recent history
# Shows resource usage
```

**Why**: Daily usability improvement. You'll use this constantly.

---

### If You Have 12 Hours This Week:

Do all of the above (#1-2) PLUS:

**#3: CLI Quick Wins (3-4 hours)** (Item #2)
- `claude cancel` command
- `claude status` command (if not done)
- Improved error messages

**Why**: Professional polish. Better daily experience.

**#4: Start Unit Tests (4-6 hours)** (Item #3)
- Begin Orchestrator tests
- Begin ConfigManager tests
- Foundation for 50% coverage

**Why**: Foundation for quality. Enables confident changes.

---

### If You Have 20 Hours This Week:

Do all of the above (#1-4) PLUS:

**#5: Complete Unit Test Coverage (6-8 hours)** (Item #3)
- Finish Orchestrator tests
- Finish ConfigManager tests
- Tool Registry tests
- Target: 50-60% coverage

**Why**: Solid foundation prevents regressions.

**#6: Comprehensive Test Suite (4-6 hours)** (Item #4)
- Integration tests
- Error scenarios
- Happy path verification

**Why**: Confidence in end-to-end functionality.

---

## 🚨 ANTI-PRIORITIES (What NOT to Do Yet)

### ❌ Don't Do These Until High Priority Items Are Done:

1. **❌ Multi-agent expansion** (20+ agents)
   - Current 7 agents work fine
   - Not a bottleneck
   - Wait until testing is solid

2. **❌ Advanced features** before basics work
   - Agent pool persistence
   - Real-time feedback queue
   - ML-based consensus

3. **❌ Over-optimization** before measuring
   - Don't optimize spawn (it's 0.01s!)
   - Don't optimize parsing (it's negligible)
   - Focus on the 92.5% (Claude CLI execution)

4. **❌ Perfect test coverage** (80%) initially
   - Start with 50-60% on critical paths
   - Add more as you go
   - Don't block on perfection

---

## 📊 DECISION MATRIX

| Task | Impact | Effort | Priority | When |
|------|--------|--------|----------|------|
| **Validation Suite** | 🔴 Critical | 2-3h | 🔥 Highest | Week 1 |
| **Performance Quick Wins** | 🔴 High | 4-6h | 🔥 Highest | Week 1 |
| **Status Command** | 🟡 Medium | 1h | 🔥 High | Week 1 |
| **Cancel Command** | 🟡 Medium | 2h | 🔥 High | Week 1 |
| **Unit Tests (50%)** | 🔴 High | 6-8h | 🔥 High | Week 2 |
| **Integration Tests** | 🟡 Medium | 6-8h | 🟡 Medium | Week 2 |
| **Model Selection** | 🟡 Medium | 4-6h | 🟡 Medium | Week 3 |
| **Progress Indicators** | 🟢 Low | 2-3h | 🟡 Medium | Week 3 |
| **Context Caching** | 🟡 Medium | 8-12h | 🟢 Lower | Week 4+ |
| **Agent Pool** | 🟢 Low | 16-24h | 🟢 Lower | Month 2+ |

**Legend**:
- 🔴 Critical/High Impact
- 🟡 Medium Impact
- 🟢 Lower Impact
- 🔥 Do First
- 🟡 Do Soon
- 🟢 Do Later

---

## 🎯 FINAL RECOMMENDATION (Updated 2025-10-28)

### Start With This Week (6-8 hours):

1. **Performance Optimization** (4-6 hours) - Item #1
   - Reduce architect brief verbosity
   - Optimize reviewer context
   - Model selection experiments
   - Measure 15-30% improvement

2. **CLI Quick Wins** (1-2 hours) - Item #2
   - `claude status` command
   - `claude cancel` command (if time permits)
   - Better error messages

**Total: 5-8 hours**

**Result**:
- ✅ System 15-30% faster
- ✅ Better daily usability
- ✅ Foundation for next phase

---

**After That**: Continue with unit test coverage (Item #3), then comprehensive test suite (Item #4).

---

**Last Updated**: 2025-10-28
**Next Review**: After completing Week 2 performance tasks
**Maintained By**: System development team

---

## 📝 CHANGELOG

**2025-10-28:**
- Updated to v0.12.0-alpha (External Tools System complete)
- Moved completed items to "Recently Completed" section
  - External Tools System (v0.12.0) - ServiceNow integration
  - System Validation & Smoke Tests (v0.11.1) - 57 tests, 100% pass
- Renumbered all items (1-12 instead of 1-13)
- Updated Sprint Plan to reflect Week 2 (Oct 28-Nov 3)
- Updated Top Priorities section
- Changed Phase to 4.1 (Performance Optimization & Testing)
- Last Updated date changed to 2025-10-28

**2025-10-23:**
- Updated version to v0.10.0
- Archived old `TODO.md` (v0.6.0 era)
- Consolidated unique items from `TODO.md` into this file
- Added items 12 (Documentation & Research) and 13 (Docker Edge Cases Testing)
