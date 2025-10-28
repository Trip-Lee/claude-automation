# Agent System Overview

**Current Version**: v0.10.0
**Last Updated**: 2025-10-23
**Status**: 3-agent system implemented, 20+ agent system planned

---

## Current Implementation: 3-Agent System ✅

The system currently has **3 specialized agents** with distinct roles and permissions.

### Agent Roles & Configuration

#### 1. 🏗️ Architect Agent (Analysis & Planning)

**Purpose**: Analyze project structure and create implementation brief

**Configuration**:
```javascript
{
  role: 'architect',
  allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
  sessionId: sharedSessionId,
  resumeSession: false  // Creates new Claude Code session
}
```

**Capabilities**:
- ✅ Read files and directories
- ✅ Execute read-only bash commands (ls, cat, find, grep)
- ❌ Cannot write or edit files
- ❌ Cannot execute destructive commands

**Responsibilities**:
1. Explore project structure
2. Analyze existing code patterns
3. Understand tech stack and dependencies
4. Create concise implementation brief (3-4 sentences)
5. Provide file modification list
6. Define testing strategy
7. Answer coder's clarifying questions

**Performance**:
- Duration: ~55 seconds
- Percentage: 22.5% of total task time
- Cost: ~$0.02 per task

---

#### 2. 👨‍💻 Coder Agent (Implementation)

**Purpose**: Implement code changes based on architect's brief

**Configuration**:
```javascript
{
  role: 'coder',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash'],  // FULL ACCESS
  sessionId: sharedSessionId,
  resumeSession: true  // Continues architect's session
}
```

**Capabilities**:
- ✅ Read files and directories
- ✅ Write new files
- ✅ Edit existing files
- ✅ Execute bash commands (with some restrictions)
- ✅ Install dependencies (within container)
- ✅ Run tests
- ✅ Access full conversation history

**Responsibilities**:
1. Review architect's brief
2. Ask clarifying questions before implementing
3. Implement code changes
4. Write tests
5. Fix issues raised by reviewer
6. Iterate based on feedback (max 3 rounds)

**Performance**:
- Duration: ~126 seconds ⚠️ **BOTTLENECK**
- Percentage: 51.5% of total task time
- Cost: ~$0.04 per task

---

#### 3. 👁️ Reviewer Agent (Quality Assurance)

**Purpose**: Review implementation and ensure quality

**Configuration**:
```javascript
{
  role: 'reviewer',
  allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
  sessionId: sharedSessionId,
  resumeSession: true  // Continues same session
}
```

**Capabilities**:
- ✅ Read files and directories
- ✅ Execute read-only bash commands
- ✅ Access full conversation history
- ✅ See all file changes made by coder
- ❌ Cannot write or edit files
- ❌ Cannot run tests directly (reads test output)

**Responsibilities**:
1. Review code quality
2. Check against original requirements
3. Verify architect's brief was followed
4. Identify bugs and issues
5. Either APPROVE or REQUEST CHANGES
6. Provide specific, actionable feedback

**Performance**:
- Duration: ~45 seconds
- Percentage: 18.5% of total task time
- Cost: ~$0.02 per task

---

## Workflow: How the 3 Agents Collaborate

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER SUBMITS TASK                        │
│            "Add a divide_by_two function to main.py"            │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: ARCHITECT ANALYZES (~55s)                              │
│  ─────────────────────────────────────────────────────────────  │
│  • Reads project files (main.py, test_main.py)                 │
│  • Identifies code patterns (existing functions)                │
│  • Creates brief:                                               │
│    - Files to modify: main.py, test_main.py                    │
│    - Pattern: Follow existing function style                   │
│    - Approach: Add divide_by_two(n) function                   │
│    - Tests: Add pytest tests with edge cases                   │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: CODER Q&A SESSION (~30s)                               │
│  ─────────────────────────────────────────────────────────────  │
│  • Coder reads architect's brief                                │
│  • Asks clarifying questions (if needed):                       │
│    - "Should divide_by_two accept floats?"                      │
│    - "What should happen with n=0?"                             │
│  • Architect answers with specific guidance                     │
│  • Coder responds "READY TO IMPLEMENT"                          │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: CODER IMPLEMENTS (~126s) [BOTTLENECK]                  │
│  ─────────────────────────────────────────────────────────────  │
│  • Reads existing code                                          │
│  • Adds divide_by_two function to main.py                       │
│  • Writes comprehensive tests to test_main.py                   │
│  • Uses Edit tool to modify files                               │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: REVIEWER CHECKS (~45s)                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • Reads modified files                                         │
│  • Checks against requirements                                  │
│  • Reviews code quality                                         │
│  • Decision:                                                    │
│    ├─ "APPROVED" → Done! ✅                                     │
│    └─ "CHANGES NEEDED: Missing edge case for zero" → Iterate   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ├─ If APPROVED ────────→ DONE ✅
                              │
                              └─ If CHANGES NEEDED ───→ STEP 3
                                 (max 3 rounds)
```

---

## Session Management & Context Sharing

All 3 agents share the **same Claude Code session** for context continuity:

```javascript
// 1. Architect creates session
const architectAgent = new ClaudeCodeAgent({
  sessionId: 'shared-uuid-12345',
  resumeSession: false  // Create new session
});

// 2. Coder resumes same session (has architect's context)
const coderAgent = new ClaudeCodeAgent({
  sessionId: 'shared-uuid-12345',  // Same ID!
  resumeSession: true  // Resume session
});

// 3. Reviewer resumes same session (has full context)
const reviewerAgent = new ClaudeCodeAgent({
  sessionId: 'shared-uuid-12345',  // Same ID!
  resumeSession: true  // Resume session
});
```

**Benefits**:
- Agents see each other's conversation
- No context loss between agents
- Reduced token usage (context caching)
- Better collaboration and understanding

---

## ConversationThread: Shared Context

The `ConversationThread` class maintains full conversation history:

```javascript
conversation.add('orchestrator', 'Task: Add divide_by_two function');
conversation.add('architect', 'Brief: Add to main.py, follow existing pattern...');
conversation.add('coder', 'Question: Should it accept floats?');
conversation.add('architect', 'Yes, accept floats and return float');
conversation.add('coder', 'Implementation complete');
conversation.add('reviewer', 'APPROVED - implementation looks good');
```

**All agents can access**:
- `conversation.getHistory()` - Full transcript
- `conversation.getContextFor(agent)` - Filtered for specific agent
- `conversation.getFileCacheSummary()` - What files were read
- Consensus detection methods (`isApproved()`, `hasUnresolvedIssues()`)

---

## Performance Breakdown

**Total Time**: ~245 seconds (simple task)

| Phase | Agent | Duration | Percentage | Notes |
|-------|-------|----------|------------|-------|
| Analysis | Architect | 55s | 22.5% | Could optimize verbosity |
| Q&A | Coder (review) | 30s | 12.2% | Collaborative phase |
| Implementation | Coder | 126s | 51.5% | **PRIMARY BOTTLENECK** |
| Review | Reviewer | 45s | 18.5% | Could optimize context |
| Orchestration | Overhead | 18s | 7.3% | Spawn, parsing, etc. |

**Optimization Opportunities**:
1. ✅ **Reduce architect verbosity** (v0.10.0 - "max 3-4 sentences")
2. ⏳ **Model selection** (Haiku for architect/reviewer, Sonnet for coder)
3. ⏳ **Context caching** (already implemented, could improve)
4. ⏳ **Parallel operations** where possible

---

## Backend Support

The agent system supports **3 backends**:

### 1. Claude Code CLI (Primary)
- Uses Claude Pro/Max subscription
- No API key required
- Built-in tool support
- Session management via `--session-id` and `--resume`
- Current implementation

### 2. Anthropic API Direct (Alternative)
- Requires ANTHROPIC_API_KEY
- Pay-per-token pricing ($3/MTok input, $15/MTok output)
- Full control over tools
- Fallback if Claude Code unavailable

### 3. Mock Mode (Testing)
- No API or subscription required
- Simulates agent behavior
- Used for testing and development
- Returns predefined responses

**Selection Logic**:
```javascript
if (anthropicApiKey) {
  // Use Anthropic API
} else if (claudeCodeAvailable) {
  // Use Claude Code CLI
} else {
  // Use mock mode
}
```

---

## Future: 20+ Agent System (Not Implemented)

This is a **planned advanced feature** from the architecture docs:

### Intelligent Multi-Agent Registry

Instead of 3 fixed agents, the system would have:

**Specialized Agent Types** (20+ agents):
- **Analysis Agents**: Architect, Security Auditor, Performance Analyzer, Dependency Reviewer
- **Implementation Agents**: Frontend Developer, Backend Developer, Database Developer, DevOps Engineer
- **Quality Agents**: Code Reviewer, Test Engineer, Security Scanner, Documentation Writer
- **Specialized Agents**: API Designer, UI/UX Specialist, Migration Expert, Refactoring Specialist

**Task-Based Agent Selection**:
```javascript
// AI analyzes task and selects appropriate agents
const task = "Add authentication to API";

// System selects:
const selectedAgents = [
  'SecurityArchitect',     // Design secure auth
  'BackendDeveloper',      // Implement endpoints
  'DatabaseDeveloper',     // Create user tables
  'TestEngineer',          // Write security tests
  'SecurityScanner'        // Scan for vulnerabilities
];

// Execute with parallel coordination
await orchestrator.executeWithAgents(task, selectedAgents);
```

**Features**:
- [ ] Agent registry with 20+ specialized agents
- [ ] Task planner using AI to select agents
- [ ] Parallel agent execution with conflict detection
- [ ] Agent handoff and routing
- [ ] Dynamic workflow generation

**Status**: 🟡 Planned (Phase 5 - Future Enhancement)

---

## Current Limitations

### What the 3-Agent System Can't Do (Yet)

1. **No Parallel Execution**
   - Agents run sequentially
   - Could run architect + security scan in parallel
   - Future: Parallel with conflict detection

2. **No Task-Based Agent Selection**
   - Always uses same 3 agents
   - All tasks follow same workflow
   - Future: AI selects optimal agents per task

3. **Limited Specialization**
   - Coder does everything (frontend, backend, tests, docs)
   - No specialized security, performance, or UX agents
   - Future: 20+ specialized agents

4. **No Multi-Task Coordination**
   - One task at a time
   - No task queue or prioritization
   - Future: Task scheduler with resource management

5. **No Agent Learning**
   - Agents don't improve from feedback
   - No personalization or style preferences
   - Future: ML-based consensus detection and learning

---

## Why 3 Agents Work Well (For Now)

Despite being "only" 3 agents, the system is **production-ready** because:

✅ **Clear Separation of Concerns**
- Analysis (architect) separate from implementation (coder)
- Review (reviewer) provides checks and balances
- No single point of failure

✅ **Proven Workflow**
- Similar to real-world development (design → code → review)
- Developers understand the mental model
- Natural handoff points

✅ **Collaboration**
- Agents see full conversation history
- Q&A sessions improve clarity
- Iterative feedback loops

✅ **Security**
- Read-only agents can't accidentally break things
- Coder has full access but reviewer catches issues
- Container isolation provides additional safety

✅ **Cost-Effective**
- 3 agents easier to optimize than 20+
- Simpler debugging and monitoring
- Clear performance bottlenecks

✅ **Maintainable**
- Simple architecture is easier to understand
- Fewer edge cases to handle
- Easier to test and validate

---

## When to Expand to 20+ Agents

Expand when you need:

1. **Specialized Expertise**
   - Security-critical applications
   - Performance-sensitive systems
   - Complex multi-component projects

2. **Parallel Workflows**
   - Large refactoring tasks
   - Multi-service deployments
   - Independent feature development

3. **Advanced Quality Checks**
   - Automated security scanning
   - Performance benchmarking
   - Accessibility testing
   - Compliance validation

4. **Scale Requirements**
   - Multiple concurrent tasks
   - Task prioritization needed
   - Resource optimization critical

**Recommendation**: Stick with 3 agents until Phase 4-5 features are needed.

---

## Agent Configuration Summary

### Current Agents (Implementation: `lib/orchestrator.js`)

| Agent | Role | Tools | Resume | Session | Lines |
|-------|------|-------|--------|---------|-------|
| Architect | Analysis | Read, Bash(read-only) | false | Creates | ~50 |
| Coder | Implementation | Read, Write, Edit, Bash | true | Resumes | ~100 |
| Reviewer | QA | Read, Bash(read-only) | true | Resumes | ~50 |

### Tool Restrictions

**Read-Only Tools** (Architect, Reviewer):
```javascript
allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)']
```
- Can list files (`ls`)
- Can read files (`cat`)
- Can search files (`find`, `grep`)
- **Cannot** write, edit, or execute destructive commands

**Full Access Tools** (Coder):
```javascript
allowedTools: ['Read', 'Write', 'Edit', 'Bash']
```
- All read-only tools
- Can create new files (`Write`)
- Can edit existing files (`Edit`)
- Can execute bash commands (with some safety restrictions)

---

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/orchestrator.js` | ~1,567 | Coordinates all 3 agents |
| `lib/agent-coordinator.js` | ~875 | Multi-agent workflow (older Anthropic API implementation) |
| `lib/claude-code-agent.js` | ~466 | Claude Code CLI wrapper |
| `lib/conversation-thread.js` | ~630 | Shared conversation history |

---

## Summary

**Current State**: 3-agent system (v0.10.0)
- ✅ Production-ready
- ✅ Well-tested
- ✅ Cost-effective (~$0.08/task)
- ✅ Maintainable
- ⏳ Performance optimization ongoing

**Future State**: 20+ agent system (Phase 5)
- 🟡 Designed but not implemented
- 🟡 Awaiting Phase 3-4 completion
- 🟡 Advanced feature for specialized needs
- 🟡 Not required for current use cases

**Recommendation**: Focus on optimizing current 3-agent system before expanding.

---

**Last Updated**: 2025-10-23
**Version**: v0.10.0
**Status**: 3 agents implemented, 20+ agents planned
