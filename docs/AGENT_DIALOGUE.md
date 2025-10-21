# Agent-to-Agent Dialogue

## Overview

The Agent-to-Agent Dialogue system enables direct peer-to-peer communication between agents, moving beyond orchestrator-mediated interactions. When one agent has questions or concerns about another agent's work, they can engage in a focused dialogue to resolve issues before continuing the workflow.

## Architecture

### Traditional Flow (Orchestrator-Mediated)
```
Orchestrator → Architect → Orchestrator → Coder → Orchestrator → Reviewer
```

### New Flow (With Agent Dialogue)
```
Orchestrator → Architect → Orchestrator → Coder
                              ↓
Orchestrator → Reviewer finds issue
                              ↓
                    💬 Reviewer ↔ Coder (direct dialogue)
                              ↓
                    Dialogue resolved → Continue
```

## Features

### 1. Automatic Dialogue Detection

The system automatically detects when agents need to communicate directly:

**Trigger Patterns:**
- Explicit agent addressing: `"@coder, can you explain..."`
- Questions with agent mention: `"Why did the coder use approach X?"`
- Concern phrases: `"I'm unclear about...", "Could you clarify..."`

**Detection Methods:**
- `detectAgentQuestion(lookback)` - Finds questions directed at specific agents
- `needsAgentDialogue()` - Determines if dialogue is needed
- Returns: `{ agent1, agent2, reason, question }`

### 2. Direct Dialogue Rounds

When dialogue is triggered:

1. **Agent 2 responds** to Agent 1's concerns
   - Full conversation context provided
   - Specific questions highlighted
   - Response recorded in conversation

2. **Agent 1 reviews** the response
   - Can ask follow-up questions
   - Or confirm satisfaction: "Thank you, that clarifies things"
   - Smart detection of resolution

3. **Max 2 rounds** to prevent infinite loops
   - Most issues resolve in 1 round
   - Complex issues get 2 rounds
   - Falls back to normal workflow if unresolved

### 3. Real-Time Visibility

Users see the dialogue as it happens:

```
💬 Agent-to-Agent Dialogue
  Reviewer has concerns needing clarification

💬 coder → reviewer (round 1/2)
  Duration: 12.3s | Cost: $0.0234

💬 reviewer → coder (follow-up)
  Duration: 8.7s | Cost: $0.0156

✅ Dialogue resolved
```

## Implementation Details

### ConversationThread Methods

#### detectAgentQuestion(lookback = 2)
```javascript
const question = conversation.detectAgentQuestion(3);
// Returns: { from: 'reviewer', to: 'coder', content: '...', timestamp: ... }
```

**Patterns Matched:**
- `@coder` or `@reviewer` or `@architect`
- `"reviewer, can you..."` (direct addressing)
- Generic questions (inferred from message flow)

#### needsAgentDialogue()
```javascript
const needsDialogue = conversation.needsAgentDialogue();
// Returns: { agent1: 'reviewer', agent2: 'coder', reason: '...', question: {...} }
```

**Triggers:**
- Explicit agent questions detected
- Reviewer concerns without approval
- Uncertainty phrases in recent messages

#### getAgentDialogueContext(fromAgent, toAgent)
```javascript
const context = conversation.getAgentDialogueContext('reviewer', 'coder');
```

**Provides:**
- Full conversation history
- Recent messages from both agents
- Explicit dialogue framing

### Orchestrator Integration

Location: `lib/orchestrator.js:554-661`

**Trigger Point:** After reviewer provides feedback and issues are detected

**Dialogue Flow:**
```javascript
const needsDialogue = conversation.needsAgentDialogue();

if (needsDialogue && round < maxRounds) {
  // Enable direct dialogue (max 2 rounds)
  while (dialogueRound < maxDialogueRounds) {
    // Agent 2 responds to Agent 1
    const response = await respondingAgent.executeWithTools({
      initialPrompt: respondPrompt,
      containerTools,
      costMonitor
    });

    conversation.add(needsDialogue.agent2, response.response, metadata, true);

    // Check for follow-up
    if (!hasFollowUp) break;

    // Agent 1 asks follow-up
    const followUp = await questioningAgent.executeWithTools({
      initialPrompt: followUpPrompt,
      containerTools,
      costMonitor
    });

    conversation.add(needsDialogue.agent1, followUp.response, metadata, true);

    // Check satisfaction
    if (isSatisfied) break;
  }
}
```

## Use Cases

### 1. Reviewer Seeks Clarification
```
Scenario: Reviewer doesn't understand implementation choice

Reviewer: "I'm not sure why you used a recursive approach here.
           Could you explain the reasoning?"

System detects: needsDialogue() → { reviewer, coder, "concerns needing clarification" }

Coder responds: "I chose recursion because the problem has natural
                 recursive structure, and the max depth is bounded at 10..."

Reviewer: "Thank you, that clarifies things. Approved."

✅ Dialogue resolved
```

### 2. Coder Questions Architect
```
Scenario: Coder needs clarification during implementation

Coder: "The brief mentions using approach X, but I'm seeing some
        edge cases. Architect, should I handle them differently?"

System detects: needsDialogue() → { coder, architect, "coder has question" }

Architect responds: "Good catch! For those edge cases, use approach Y
                     because..."

Coder: "Perfect, that makes sense. Proceeding with implementation."

✅ Dialogue resolved
```

### 3. Extended Dialogue
```
Scenario: Complex issue needing multiple exchanges

Reviewer: "The error handling seems incomplete. What about X?"

Coder: "I handled X in the try-catch block on line 42..."

Reviewer: "I see that, but what about Y?"

Coder: "Y is handled by the calling function, which validates inputs..."

Reviewer: "Got it, thanks for clarifying. Approved."

✅ Dialogue resolved (2 rounds)
```

## Configuration

### Dialogue Parameters

**Location:** `lib/orchestrator.js:562`

```javascript
const maxDialogueRounds = 2;  // Maximum back-and-forth exchanges
```

**Customization:**
- Increase for complex projects
- Decrease for faster workflows
- Set to 0 to disable agent dialogue

### Detection Sensitivity

**Location:** `lib/conversation-thread.js:469`

```javascript
const concernPhrases = [
  'concern',
  'unclear',
  'not sure',
  'could you',
  'can you explain',
  'why did you',
  'question about'
];
```

**Customization:**
- Add project-specific trigger phrases
- Remove phrases for stricter detection
- Adjust for team communication style

## Benefits

### 1. **Reduced Iteration Cycles**
- Issues resolved before full re-implementation
- Faster consensus on approach
- Less wasted compute time

### 2. **Better Understanding**
- Agents explain their reasoning
- Reviewers get context they missed
- Shared understanding emerges

### 3. **More Natural Collaboration**
- Mimics human team dynamics
- Direct questions get direct answers
- Reduces "telephone game" effect

### 4. **User Transparency**
- See agents working through issues
- Understand decision-making process
- Trust in the collaborative process

## Performance Impact

**Additional Time:**
- 1 dialogue round: ~15-25 seconds
- 2 dialogue rounds: ~30-50 seconds

**Typical Savings:**
- Avoids 1 full coder-reviewer round: ~60-90 seconds
- Net benefit: 10-40 seconds saved per task

**When Dialogue Helps Most:**
- Ambiguous requirements
- Complex technical decisions
- Edge cases not in original brief
- Reviewer uncertainty (not errors)

## Limitations

### Current

1. **Max 2 Rounds**: Prevents infinite loops but may cut off complex discussions
2. **Text-Only Detection**: Relies on keywords, may miss subtle questions
3. **No Multi-Agent**: Only supports 2 agents at a time
4. **Sequential Only**: Dialogues happen one at a time

### Future Enhancements

1. **Dynamic Round Limits**: Based on conversation complexity
2. **Sentiment Analysis**: Better detection of confusion/concerns
3. **Group Dialogues**: Allow 3+ agents to discuss
4. **Parallel Dialogues**: Multiple agent pairs simultaneously
5. **Learning System**: Adapt trigger phrases based on success rate

## Examples in Action

### Example 1: Quick Resolution
```
[66.0s] 👁️  Reviewer:
  The implementation looks good overall, but I'm unclear about the
  choice of data structure. Why use a dictionary instead of a list?

🔍 Consensus Detection:
  Approved: ❌ No
  Issues: ⚠️  Found
  Decision: 🔄 Continue collaboration
  Reason: Reviewer has concerns needing clarification

💬 Agent-to-Agent Dialogue
  Reviewer has concerns needing clarification

💬 coder → reviewer (round 1/2)
  I used a dictionary for O(1) lookup performance. The specification
  requires frequent key-based access, and a list would be O(n)...
  Duration: 14.2s | Cost: $0.0198

💬 reviewer → coder (follow-up)
  Thank you, that clarifies things. The performance consideration
  makes sense. Approved!
  Duration: 8.3s | Cost: $0.0134

✅ Dialogue resolved
✅ Code approved by reviewer!
```

### Example 2: Extended Discussion
```
[82.5s] 👁️  Reviewer:
  I have several concerns about the implementation...

💬 Agent-to-Agent Dialogue
  Reviewer has concerns needing clarification

💬 coder → reviewer (round 1/2)
  Let me address each concern...
  Duration: 18.7s | Cost: $0.0256

💬 reviewer → coder (follow-up)
  Thanks for the explanation. I still have a question about #3...
  Duration: 11.2s | Cost: $0.0176

💬 coder → reviewer (round 2/2)
  For #3, the approach handles that case by...
  Duration: 15.3s | Cost: $0.0234

💬 reviewer → coder (follow-up)
  Perfect, all clear now. Approved!
  Duration: 7.8s | Cost: $0.0123

✅ Dialogue resolved
✅ Code approved by reviewer!
```

## Integration with Other Features

### Works With Consensus Detection
- Dialogue updates conversation context
- Consensus re-evaluated after dialogue
- Approval status checked dynamically

### Works With Performance Profiling
- Dialogue time tracked separately
- Shown in performance summary
- Included in total duration

### Works With Real-Time Display
- All dialogue messages shown live
- User sees agent communication
- Timestamps relative to workflow start

## Troubleshooting

### Dialogue Not Triggering

**Symptom:** Agents have questions but dialogue doesn't start

**Causes:**
- Question phrasing doesn't match patterns
- Max rounds already reached
- Reviewer already approved

**Solution:**
- Add custom trigger phrases
- Check `needsDialogue()` return value
- Verify `round < maxRounds`

### Dialogue Loops Indefinitely

**Symptom:** Dialogue reaches max rounds without resolution

**Causes:**
- Agents asking same questions repeatedly
- Satisfaction detection too strict
- Real issue can't be resolved via dialogue

**Solution:**
- Reduce `maxDialogueRounds`
- Relax satisfaction phrases
- Falls back to normal workflow (correct behavior)

### Performance Impact Too High

**Symptom:** Dialogue adds significant time

**Causes:**
- Multiple dialogue rounds per task
- Complex responses taking long
- Unnecessary dialogues triggered

**Solution:**
- Make trigger phrases more specific
- Reduce max rounds to 1
- Set threshold for issue severity

## Files Modified

- `lib/conversation-thread.js` (lines 408-539) - Detection and context methods
- `lib/orchestrator.js` (lines 554-661) - Dialogue integration
- `docs/AGENT_DIALOGUE.md` - This documentation

## Version History

- **v0.7.0** (2025-10-17): Initial agent-to-agent dialogue implementation
  - Automatic dialogue detection
  - Direct peer-to-peer communication
  - Real-time visibility
  - Smart termination

## See Also

- [Consensus Detection](./CONSENSUS_DETECTION.md) - How agents reach agreement
- [Conversation Thread](../lib/conversation-thread.js) - Shared context management
- [Orchestrator](../lib/orchestrator.js) - Workflow coordination
