# Consensus Detection

## Overview

The Consensus Detection system automatically analyzes agent conversations to determine when agents have reached agreement, identified issues, or are ready to proceed to the next phase. This enables dynamic collaboration where the number of rounds adjusts based on actual progress rather than fixed iteration counts.

## Core Features

### 1. Phase-Specific Detection

#### Architect-Coder Q&A Phase
- **isReadyToImplement()**: Detects when coder explicitly states readiness
  - Looks for phrases: "ready to implement", "everything is clear", "no further questions"
  - Returns: `boolean`

#### Coder-Reviewer Phase
- **isApproved()**: Detects when reviewer approves the implementation
  - Looks for phrases: "approved", "LGTM", "looks good to me", "no issues"
  - Returns: `boolean`

- **hasUnresolvedIssues()**: Detects outstanding problems
  - Looks for phrases: "issue", "bug", "incorrect", "missing", "needs to be fixed"
  - Returns: `boolean`

### 2. General Consensus Detection

#### detectConsensus(lookback = 5)
Analyzes recent messages for agreement/disagreement patterns.

**Returns:**
```javascript
{
  hasConsensus: boolean,  // true if confidence >= 0.6
  confidence: number,      // 0.0 to 1.0
  reason: string          // explanation of decision
}
```

**Detection Logic:**
- **Agreement phrases**: "agreed", "sounds good", "perfect", "excellent", "correct"
- **Disagreement phrases**: "however", "but", "concern", "not sure", "unclear"
- **Confidence calculation**:
  - Agreement + no disagreement + no questions → High confidence
  - Disagreement or questions → Zero confidence
  - Neutral signals → Low confidence (0.3)

### 3. Collaboration Flow Control

#### shouldContinueCollaboration()
Determines if another collaboration round is needed.

**Returns:**
```javascript
{
  shouldContinue: boolean,  // true if more discussion needed
  reason: string           // explanation
}
```

**Decision Tree:**

**After review phase (has reviewer messages):**
- ✅ Reviewer approved → Stop (don't continue)
- ⚠️ Reviewer found issues → Continue (another round needed)

**After Q&A phase (has architect + coder):**
- ✅ Coder ready to implement → Stop
- ❓ Coder has questions → Continue (clarification needed)

**Default:** Continue if uncertain

## Integration Example

### In Orchestrator (Architect-Coder Q&A)

```javascript
// Coder reviews architect's brief
const coderReview = await coderReviewAgent.executeWithTools({ ... });
conversation.add('coder', coderReview.response);

// Consensus detection
const isReady = conversation.isReadyToImplement();
const hasQuestions = conversation.hasRecentQuestions(1) && !isReady;

// Display signals
console.log('🔍 Consensus Detection:');
console.log(`  Ready to implement: ${isReady ? '✅ Yes' : '❌ No'}`);
console.log(`  Has questions: ${hasQuestions ? '❓ Yes' : '✅ No'}`);

// Dynamic flow
if (hasQuestions) {
  // Get architect clarification
  const clarification = await architectAgent.executeWithTools({ ... });
  conversation.add('architect', clarification.response);
}
```

### In Orchestrator (Coder-Reviewer Loop)

```javascript
// Reviewer provides feedback
const reviewerResult = await reviewerAgent.executeWithTools({ ... });
conversation.add('reviewer', reviewerResult.response);

// Consensus detection
const approved = conversation.isApproved();
const hasIssues = conversation.hasUnresolvedIssues();
const shouldContinue = conversation.shouldContinueCollaboration();

// Display signals
console.log('🔍 Consensus Detection:');
console.log(`  Approved: ${approved ? '✅ Yes' : '❌ No'}`);
console.log(`  Issues: ${hasIssues ? '⚠️ Found' : '✅ None'}`);
console.log(`  Decision: ${shouldContinue.shouldContinue ? '🔄 Continue' : '✅ Finish'}`);
console.log(`  Reason: ${shouldContinue.reason}`);

// Exit loop if approved
if (approved) {
  break;
}
```

## User Visibility

Consensus detection results are displayed in real-time during agent execution:

```
🔍 Consensus Detection:
  Ready to implement: ✅ Yes
  Has questions: ✅ No

🔍 Consensus Detection:
  Approved: ✅ Yes
  Issues: ✅ None
  Decision: ✅ Ready to finish
  Reason: Reviewer approved implementation
```

## Benefits

1. **Dynamic Workflow**: Rounds adjust based on actual needs, not fixed limits
2. **Transparency**: Users see why decisions are made
3. **Efficiency**: Skip unnecessary rounds when consensus is reached
4. **Quality**: Continue when issues exist, even if max rounds approached
5. **Flexibility**: Easy to extend with new detection patterns

## Future Enhancements

- Machine learning-based sentiment analysis
- Custom phrase configuration per project
- Confidence thresholds as configurable parameters
- Multi-round consensus trends (detecting progress toward agreement)
- Agent-specific confidence scoring

## Implementation Files

- `/home/coltrip/claude-automation/lib/conversation-thread.js` (lines 227-407)
  - `isReadyToImplement()`
  - `isApproved()`
  - `hasUnresolvedIssues()`
  - `detectConsensus()`
  - `shouldContinueCollaboration()`

- `/home/coltrip/claude-automation/lib/orchestrator.js` (lines 366-373, 529-552)
  - Q&A phase integration
  - Review phase integration
  - Real-time display
