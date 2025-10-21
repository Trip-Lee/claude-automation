# Prioritized TODOs - October 21, 2025

**Current Version**: v0.9.1
**Current Phase**: Phase 3.1 (Hardening - 2/6 complete)

---

## 🔥 HIGH PRIORITY (Next 1-2 Weeks)

### Goal: Make system reliable and usable for daily work

---

### 1. System Validation & Smoke Tests ⏱️ 2-3 hours
**Why First**: Need confidence system works before optimizing
**Impact**: HIGH - Catches regressions early

**Tasks**:
- [ ] Create `test/smoke-test.js` - Quick validation script
  - Runs simple task (add comment to file)
  - Verifies all agents work
  - Checks cleanup happens
  - Duration: <30 seconds
- [ ] Create `test/validation-suite.js` - Full system validation
  - Tests all 3 agents (architect, coder, reviewer)
  - Tests error handling (timeout, retry)
  - Tests cleanup (success, error, interrupt)
  - Validates file writing
  - Checks cost tracking
- [ ] Add `claude validate` command to CLI
  - Runs validation suite
  - Reports pass/fail
  - Shows system health

**Success Criteria**:
- Can run `claude validate` and get green ✅
- Takes <2 minutes to run
- Catches broken functionality

**Blocks**: Nothing - can do now
**Unblocks**: Confident changes won't break things

---

### 2. Performance - Low-Hanging Fruit ⏱️ 4-6 hours
**Why**: System is 2x slower than goal (245s vs 120s)
**Impact**: HIGH - Users feel the speed

**Based on Performance Analysis**:
- Coder bottleneck: 126.4s (51.5%)
- Architect: 55.1s (22.5%)
- Reviewer: 45.5s (18.5%)

**Quick Wins (No Architecture Changes)**:

#### 2.1 Reduce Architect Brief Verbosity
- [ ] Analyze architect brief from test run
- [ ] Identify redundant sections
- [ ] Create concise brief template
- [ ] Test with simple task
- [ ] Measure improvement

**Expected**: -10-15s (20% architect improvement)

#### 2.2 Optimize Reviewer with Context
- [ ] Pre-load test results to reviewer
- [ ] Skip redundant file reads
- [ ] Streamline approval flow

**Expected**: -5-10s (15-20% reviewer improvement)

#### 2.3 Parallel Test Execution (If applicable)
- [ ] Run tests while coder is working
- [ ] Don't block on sequential test → review

**Expected**: -5-10s if tests are separate step

**Total Expected**: **-20-35s** (8-14% improvement)
**New Target**: 210-225s (closer to 180s realistic goal)

---

### 3. CLI Quick Wins ⏱️ 3-4 hours
**Why**: Improves daily usability immediately
**Impact**: MEDIUM-HIGH - Better UX

**Essential Commands**:

#### 3.1 `claude cancel <taskId>` command
- [ ] Stop running agents gracefully
- [ ] Cleanup containers
- [ ] Mark task as cancelled
- [ ] Show cancellation summary

**User Story**: "I started wrong task, need to cancel it"

#### 3.2 `claude status` command
- [ ] Show all active/pending tasks
- [ ] Show container status
- [ ] Show resource usage
- [ ] Show recent task history

**User Story**: "What tasks are running? What happened yesterday?"

#### 3.3 Improved error messages
- [ ] Better validation errors (missing config, etc)
- [ ] Suggest fixes for common problems
- [ ] Link to troubleshooting docs

**User Story**: "Error message should tell me how to fix it"

---

### 4. Basic Unit Tests ⏱️ 6-8 hours
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

### 5. Comprehensive Test Suite ⏱️ 12-16 hours

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

### 6. Model Selection Strategy ⏱️ 4-6 hours
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

### 7. Advanced CLI Features ⏱️ 6-8 hours

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

### 8. Context Caching Optimization ⏱️ 8-12 hours

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

### 9. Docker Enhancements ⏱️ 4-6 hours

- [ ] Container versioning (tag containers with version)
- [ ] Health checks (verify container is responsive)
- [ ] Resource monitoring (CPU/RAM usage)
- [ ] Container logs persistence
- [ ] Multiple container support (parallel tasks)

---

### 10. Git/GitHub Enhancements ⏱️ 6-8 hours

- [ ] Merge conflict detection
- [ ] Draft PRs (for review before final)
- [ ] PR templates
- [ ] Automatic labeling
- [ ] Link to task ID in PR description

---

### 11. Advanced Agent Features ⏱️ 12-20 hours

- [ ] Agent-to-agent dialogue (already implemented, needs testing)
- [ ] Consensus detection tuning
- [ ] Streaming output (real-time agent thinking)
- [ ] Parallel agent execution
- [ ] Agent selection based on task type

---

## 📋 RECOMMENDED SPRINT PLAN

### Week 1 (Oct 21-27): Validation & Quick Wins
**Goal**: Confidence + Speed improvements

**Monday-Tuesday** (6 hours):
- ✅ System validation suite
- ✅ Smoke tests
- ✅ `claude validate` command

**Wednesday-Thursday** (8 hours):
- ✅ Reduce architect brief verbosity
- ✅ Optimize reviewer context
- ✅ Measure improvements

**Friday** (4 hours):
- ✅ `claude status` command
- ✅ `claude cancel` command

**Expected Outcomes**:
- Can run `claude validate` ✅
- System 10-15% faster
- Better daily usability

---

### Week 2 (Oct 28-Nov 3): Testing Foundation
**Goal**: Prevent regressions

**Monday-Wednesday** (12 hours):
- ✅ Unit tests for critical modules
- ✅ 50-60% coverage on key paths
- ✅ Run tests in CI (if applicable)

**Thursday-Friday** (6 hours):
- ✅ Integration tests (happy path)
- ✅ Error scenario tests

**Expected Outcomes**:
- 50-60% test coverage ✅
- Confident to make changes
- Catch bugs early

---

### Week 3-4 (Nov 4-17): Polish & Optimization
**Goal**: Production-ready polish

**Week 3**:
- Model selection strategy (Haiku for architect/reviewer)
- Comprehensive test suite
- Benchmark suite

**Week 4**:
- Advanced CLI features
- Progress indicators
- Performance tuning

**Expected Outcomes**:
- 80% test coverage ✅
- Cost reduced 30% ✅
- Professional UX ✅

---

## 🎯 MY TOP 3 RECOMMENDATIONS

### If You Have 6 Hours This Week:

**#1: System Validation (2-3 hours) - CRITICAL**
```bash
claude validate
# Runs smoke tests
# Verifies system works
# Gives confidence
```

**Why**: You need to know the system works reliably before doing anything else.

**#2: Performance Quick Wins (3-4 hours) - HIGH IMPACT**
- Reduce architect brief verbosity
- Optimize reviewer context
- Measure 10-15% improvement

**Why**: System is 2x slower than goal. Quick wins get you closer fast.

**#3: `claude status` Command (1 hour) - HIGH VALUE**
```bash
claude status
# Shows running tasks
# Shows recent history
# Shows resource usage
```

**Why**: Daily usability improvement. You'll use this constantly.

---

### If You Have 12 Hours This Week:

Do all of the above (#1-3) PLUS:

**#4: Basic Unit Tests (6-8 hours)**
- Test error handling logic
- Test cleanup logic
- 50-60% coverage of critical paths

**Why**: Foundation for quality. Enables confident changes.

---

### If You Have 20 Hours This Week:

Do all of the above (#1-4) PLUS:

**#5: Model Selection (4-6 hours)**
- Haiku for architect
- Haiku for reviewer
- Measure cost reduction (30-40%)

**Why**: Big cost savings with minimal risk.

**#6: CLI Polish (3-4 hours)**
- `claude cancel` command
- Progress indicators
- Better error messages

**Why**: Professional polish. Better daily experience.

---

## 🚨 ANTI-PRIORITIES (What NOT to Do Yet)

### ❌ Don't Do These Until High Priority Items Are Done:

1. **❌ Multi-agent expansion** (20+ agents)
   - Current 3 agents work fine
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

## 🎯 FINAL RECOMMENDATION

### Start With This (6-8 hours):

1. **System Validation Suite** (2-3 hours)
   - Creates `claude validate` command
   - Smoke tests all functionality
   - Foundation for confidence

2. **Performance Quick Wins** (3-4 hours)
   - Reduce architect brief verbosity
   - Optimize reviewer
   - Measure 10-15% improvement
   - Get closer to 180s goal

3. **`claude status` Command** (1 hour)
   - Shows running tasks
   - Daily usability win
   - Quick to implement

4. **Basic Error Message Improvements** (1 hour)
   - Better validation errors
   - Suggest fixes
   - Link to docs

**Total: 7-9 hours**

**Result**:
- ✅ Confidence system works
- ✅ 10-15% faster
- ✅ Better daily UX
- ✅ Ready for next phase

---

**After That**: Week 2 focus on unit tests (50-60% coverage), then Week 3+ polish and optimization.

---

**Last Updated**: 2025-10-21
**Next Review**: After completing Week 1 tasks
**Maintained By**: System development team
