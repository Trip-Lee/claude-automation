# Workflow Routing: Fixed vs Dynamic

**Current Version**: v0.10.0
**Last Updated**: 2025-10-23

---

## TL;DR

The workflow is **mostly hardcoded** with a fixed main path, BUT has **intelligent dynamic branching** based on conversation analysis:

- ✅ **Fixed**: Main sequence (Architect → Coder → Reviewer)
- ✅ **Dynamic**: Q&A sessions trigger based on content
- ✅ **Dynamic**: Agent-to-agent dialogue when needed
- ✅ **Dynamic**: Loop iterations based on approval
- ❌ **Not Dynamic**: Can't skip agents or reorder main sequence

---

## Current Workflow: Hardcoded Main Path with Dynamic Branches

```
START
  ↓
┌─────────────────────────────────┐
│  1. ARCHITECT (always first)    │  ← HARDCODED ORDER
│     Analyzes & creates brief    │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  2. CODER Q&A (always runs)     │  ← HARDCODED STEP
│     Reviews brief               │
└────────────┬────────────────────┘
             ↓
        ┌────┴────┐
        │         │
     Yes│         │No
   ┌────▼────┐   │
   │ Has Q?  │   │                  ← DYNAMIC BRANCH!
   └────┬────┘   │
        │        │
     ┌──▼───┐    │
     │ 2b.  │    │
     │ ARCH │    │                  ← OPTIONAL STEP
     │ CLR  │    │
     └──┬───┘    │
        │        │
        └────┬───┘
             ↓
┌─────────────────────────────────┐
│  3. CODER implements            │  ← HARDCODED STEP
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  4. REVIEWER checks             │  ← HARDCODED STEP
└────────────┬────────────────────┘
             ↓
        ┌────┴────┐
        │         │
    Approved   Issues
        │         │                 ← DYNAMIC DECISION!
        │    ┌────▼────┐
        │    │ Needs   │
        │    │Dialogue?│            ← DYNAMIC CHECK!
        │    └────┬────┘
        │         │
        │      Yes│ No
        │    ┌────▼────┐
        │    │ AGENT   │
        │    │DIALOGUE │            ← OPTIONAL DIALOGUE
        │    │ (2 rnds)│
        │    └────┬────┘
        │         │
        └────┬────┘
             │
          ┌──▼──┐
          │Loop?│                   ← DYNAMIC LOOP!
          └─┬─┬─┘
         No │ │ Yes (max 3)
            │ └──→ Back to step 3
            ↓
          DONE
```

---

## Hardcoded Elements (Cannot Change)

### 1. Main Agent Sequence

**Always runs in this order**:
```
Architect → Coder Q&A → Implementation Loop
```

You **cannot**:
- ❌ Skip architect and go straight to coder
- ❌ Have reviewer go first
- ❌ Reorder agents arbitrarily
- ❌ Run agents in parallel (sequential only)

**Code location**: `lib/orchestrator.js:507-904`

```javascript
// Step 1: Architect Agent (read-only) - ALWAYS FIRST
const architectAgent = new ClaudeCodeAgent({ ... });

// Step 1.5: Coder reviews brief - ALWAYS SECOND
const coderReviewAgent = new ClaudeCodeAgent({ ... });

// Step 2-N: Coder + Reviewer loop - ALWAYS LAST
while (round < maxRounds && !approved) {
  // Coder implements
  // Reviewer checks
}
```

### 2. Tool Permissions

**Hardcoded per agent**:
- Architect: Read-only (cannot be given Write access)
- Coder: Full access (cannot be restricted)
- Reviewer: Read-only (cannot be given Write access)

### 3. Max Iterations

**Hardcoded limits**:
- Coder/Reviewer loop: Max 3 rounds
- Agent dialogue: Max 2 rounds
- Q&A session: Single round (no loop)

---

## Dynamic Elements (AI-Driven Branching)

### 1. Consensus Detection (Intelligent Branching)

The system analyzes conversation content to make decisions:

**Code location**: `lib/conversation-thread.js:229-277`

```javascript
// Detects if coder is ready to implement
isReadyToImplement() {
  const lastCoderMsg = this.getLastMessage('coder').content.toLowerCase();
  const readyPhrases = [
    'ready to implement',
    'ready to proceed',
    'everything is clear',
    'no questions',
    'looks good'
  ];
  return readyPhrases.some(phrase => lastCoderMsg.includes(phrase));
}

// Detects if reviewer approved
isApproved() {
  const lastReviewMsg = this.getLastMessage('reviewer').content.toLowerCase();
  const approvalPhrases = [
    'approved',
    'lgtm',
    'looks good to me',
    'implementation is correct',
    'no issues found'
  ];
  return approvalPhrases.some(phrase => lastReviewMsg.includes(phrase));
}

// Detects if there are unresolved issues
hasUnresolvedIssues() {
  const lastReviewMsg = this.getLastMessage('reviewer').content.toLowerCase();
  const issuePhrases = ['issue', 'problem', 'bug', 'incorrect', 'missing'];
  return issuePhrases.some(phrase => lastReviewMsg.includes(phrase));
}
```

### 2. Architect Clarification (Conditional Branch)

**Trigger**: Coder has questions in Q&A session

**Code location**: `lib/orchestrator.js:605-651`

```javascript
// Check if coder has questions
const isReady = conversation.isReadyToImplement();
const hasQuestions = conversation.hasRecentQuestions(1) && !isReady;

if (hasQuestions) {
  // DYNAMIC: Architect provides clarification
  const architectClarificationAgent = new ClaudeCodeAgent({ ... });
  // ... execute clarification
} else {
  // SKIP: Coder is ready, no clarification needed
  console.log('Coder is ready to implement (no questions)');
}
```

**Example Flow**:

```
Coder: "Should divide_by_two accept floats? What about zero?"
         ↓
hasQuestions = true
         ↓
Architect: "Yes, accept floats. Return error for zero."
         ↓
Coder: "READY TO IMPLEMENT"
```

### 3. Agent-to-Agent Dialogue (Conditional Branch)

**Trigger**: Reviewer and Coder need to discuss implementation details

**Code location**: `lib/orchestrator.js:808-905`

```javascript
// Check if agents need direct dialogue
const needsDialogue = conversation.needsAgentDialogue();

if (needsDialogue && round < maxRounds) {
  // DYNAMIC: Enable direct dialogue (up to 2 rounds)
  while (dialogueRound < maxDialogueRounds) {
    // Agent2 responds to Agent1
    // Agent1 asks follow-up (if needed)
  }
}
```

**What triggers dialogue**:
- Reviewer asks coder a specific question
- Coder asks reviewer for clarification
- Confusion detected in conversation

**Code location**: `lib/conversation-thread.js:327-382`

```javascript
needsAgentDialogue() {
  const lastReviewMsg = this.getLastMessage('reviewer').content.toLowerCase();

  // Question patterns
  const questionPatterns = [
    'why did you',
    'can you explain',
    'what about',
    'how did you handle',
    'did you consider'
  ];

  if (questionPatterns.some(q => lastReviewMsg.includes(q))) {
    return {
      shouldDialogue: true,
      agent1: 'reviewer',
      agent2: 'coder',
      reason: 'Reviewer has specific questions for coder'
    };
  }

  return { shouldDialogue: false };
}
```

**Example Flow**:

```
Round 1:
Reviewer: "Why did you use a try-catch here? Did you consider returning None?"
         ↓
needsAgentDialogue() = true
         ↓
Coder: "The try-catch handles division by zero gracefully. None wouldn't
        indicate the error type."
         ↓
Reviewer: "That makes sense, but could you add a comment explaining it?"
         ↓
Dialogue continues for 1 more round...
```

### 4. Loop Continuation (Dynamic Decision)

**Trigger**: Reviewer found issues AND haven't hit max rounds

**Code location**: `lib/orchestrator.js:659-806`

```javascript
while (round < maxRounds && !approved) {
  // Coder implements/fixes
  // Reviewer checks

  // DYNAMIC: Check if approved
  approved = conversation.isApproved();

  if (approved) {
    // EXIT LOOP: Done!
    break;
  } else if (round < maxRounds) {
    // CONTINUE LOOP: Try again
    continue;
  } else {
    // MAX ROUNDS: Stop and return partial result
    break;
  }
}
```

**Possible outcomes**:

```
Round 1: Not approved → Loop continues
Round 2: Not approved → Loop continues
Round 3: Approved → Exit early ✅

OR

Round 1: Approved → Exit immediately ✅ (only 1 round)

OR

Round 1: Not approved → Loop continues
Round 2: Not approved → Loop continues
Round 3: Not approved → Exit (max rounds) ⚠️
```

---

## What You CAN'T Do (Limitations)

### 1. Cannot Skip Agents

```javascript
// ❌ NOT POSSIBLE:
"Just run coder, skip architect"
"Only run reviewer, no implementation"
```

Every task MUST go through:
- Architect (analysis)
- Coder (implementation)
- Reviewer (QA)

### 2. Cannot Reorder Agents

```javascript
// ❌ NOT POSSIBLE:
Reviewer → Architect → Coder  // Wrong order!
Coder → Reviewer → Architect  // Wrong order!
```

Order is fixed: **Architect → Coder → Reviewer**

### 3. Cannot Run Agents in Parallel

```javascript
// ❌ NOT POSSIBLE:
Run Architect + Security Scanner at same time
Run Coder + Tester simultaneously
```

All agents run **sequentially**, one after another.

### 4. Cannot Add Custom Agents Mid-Flow

```javascript
// ❌ NOT POSSIBLE:
"After coder, run a security scanner before reviewer"
"Insert a documentation writer between architect and coder"
```

Agent sequence is hardcoded. To add agents, you must modify the orchestrator code.

### 5. Cannot Dynamically Select Agents

```javascript
// ❌ NOT POSSIBLE (Yet):
if (task.includes('security')) {
  agents = [Architect, SecurityExpert, Coder, SecurityReviewer];
} else {
  agents = [Architect, Coder, Reviewer];
}
```

This is a **planned Phase 5 feature** (20+ agent system with AI-based selection).

---

## Comparison: Current vs Future

### Current System (v0.10.0): Fixed with Smart Branching

```
Fixed Sequence:
Architect → Coder Q&A → Implementation Loop

Smart Branching:
├─ Architect clarification (if coder has questions)
├─ Agent dialogue (if confusion detected)
└─ Loop iterations (until approved or max rounds)

Advantages:
✅ Simple and predictable
✅ Easy to debug
✅ Clear workflow
✅ Proven pattern

Limitations:
❌ Can't skip agents
❌ Can't reorder agents
❌ Can't add custom agents
❌ Sequential only (no parallelism)
```

### Future System (Phase 5): Dynamic Agent Selection

```
AI Planner Analyzes Task:
"Add authentication with JWT tokens"
         ↓
Selects Optimal Agents:
[SecurityArchitect, BackendDev, DatabaseDev, SecurityReviewer, TestEngineer]
         ↓
Dynamic Workflow Generation:
SecurityArchitect → BackendDev + DatabaseDev (parallel)
                              ↓
                    SecurityReviewer + TestEngineer (parallel)
                              ↓
                           Done!

Advantages:
✅ Task-specific agent selection
✅ Parallel execution
✅ Specialized expertise
✅ Flexible routing

Complexity:
⚠️ More complex to debug
⚠️ Agent coordination challenges
⚠️ Conflict resolution needed
⚠️ Higher cost
```

---

## Code Locations

### Main Workflow

| Component | File | Lines | Description |
|-----------|------|-------|-------------|
| Workflow orchestration | `lib/orchestrator.js` | 474-904 | Main agent sequence |
| Consensus detection | `lib/conversation-thread.js` | 229-382 | AI-driven branching |
| Agent dialogue logic | `lib/orchestrator.js` | 808-905 | Dynamic agent communication |
| Q&A session | `lib/orchestrator.js` | 560-651 | Clarification branch |
| Loop control | `lib/orchestrator.js` | 653-806 | Iteration logic |

### Consensus Methods

| Method | Purpose | Line |
|--------|---------|------|
| `isReadyToImplement()` | Check if coder is ready | 236-252 |
| `isApproved()` | Check if reviewer approved | 259-277 |
| `hasUnresolvedIssues()` | Check for problems | 283-300 |
| `needsAgentDialogue()` | Check if dialogue needed | 327-382 |
| `shouldContinueCollaboration()` | Loop decision | 388-420 |

---

## How to Modify the Workflow

If you want to change the workflow, here's what you need to edit:

### 1. Add a New Agent in Sequence

**File**: `lib/orchestrator.js`

```javascript
// After reviewer (line ~806):

// NEW: Security Scanner Agent
console.log(chalk.red('\n🔒 Security Scanner Agent'));

const securityAgent = new ClaudeCodeAgent({
  role: 'security',
  sessionId: sharedSessionId,
  resumeSession: true,
  workingDir: projectPath,
  allowedTools: ['Read', 'Bash(grep:*,find:*)'],
  verbose: false
});

const securityResult = await securityAgent.executeWithTools({
  initialPrompt: "Scan for security vulnerabilities...",
  containerTools,
  costMonitor
});

conversation.add('security', securityResult.response, {
  duration: securityResult.totalDuration,
  cost: securityResult.cost
}, true);
```

### 2. Change Loop Max Rounds

**File**: `lib/orchestrator.js:654`

```javascript
// Change from 3 to 5 rounds
const maxRounds = 5; // was 3
```

### 3. Add Custom Consensus Detection

**File**: `lib/conversation-thread.js`

```javascript
// Add new method
isSecurityClear() {
  const lastSecurityMsg = this.getLastMessage('security').content.toLowerCase();
  return lastSecurityMsg.includes('no vulnerabilities') ||
         lastSecurityMsg.includes('security check passed');
}
```

Then use it in orchestrator:

```javascript
// In orchestrator.js
const securityOk = conversation.isSecurityClear();
if (!securityOk) {
  console.log('Security issues found, cannot proceed');
  return;
}
```

---

## Summary

**Current Workflow**:
- **Fixed main path**: Architect → Coder → Reviewer (always in this order)
- **Dynamic branching**: Q&A, dialogue, loops based on AI analysis of conversation
- **Cannot**: Skip agents, reorder agents, add agents dynamically, run in parallel

**Smart branching decisions**:
1. ✅ Architect clarification (if coder has questions)
2. ✅ Agent-to-agent dialogue (if confusion detected)
3. ✅ Loop iterations (until approved, max 3 rounds)
4. ✅ Early exit (if approved on first round)

**Future enhancement** (Phase 5):
- Dynamic agent selection based on task
- Parallel agent execution
- 20+ specialized agents
- AI-based workflow generation

**Recommendation**: Current system is a good balance of flexibility and simplicity. Only expand to full dynamic routing when complexity justifies it.

---

**Last Updated**: 2025-10-23
**Version**: v0.10.0
**Status**: Fixed sequence with intelligent branching
