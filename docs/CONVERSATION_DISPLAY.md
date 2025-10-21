# Agent Conversation Display

The multi-agent system now displays real-time coordination between agents, giving you full visibility into what the agents are doing and how they're working together.

## Overview

When you run tasks with real agents (`--real` flag), you'll see:

1. **Real-time updates** as agents work
2. **Agent plans and reasoning**
3. **Tool usage** (what files they're reading/writing)
4. **Reviewer feedback**
5. **Full conversation transcript** at the end
6. **Saved transcript file** for later review

## What You'll See

### During Execution

```
👨‍💻 Coder Agent
  Iteration 1/10

    Coder says:
    I'll implement the multiply function in main.py.

    Here's my plan:
    1. Add the multiply(a, b) function...

    → Using tools: write_file, read_file, execute_command

  ✅ Coder finished

👁️  Reviewer Agent
  Iteration 1/10

    → Reviewing: read_file, list_directory

  ✅ Reviewer finished: Changes requested

    Reviewer says:
    I found a few issues:

    1. The multiply function doesn't handle non-numeric inputs
    2. The docstring could be more descriptive...
```

### At the End

After agents complete, you'll see a full transcript:

```
======================================================================
📝 AGENT CONVERSATION TRANSCRIPT
======================================================================

Round 1
----------------------------------------------------------------------

👨‍💻 Coder Agent:
  Iterations: 3
  Plan:
    I'll implement the multiply function in main.py.

    Here's my plan:
    1. Add the multiply(a, b) function
    2. Add proper documentation
    3. Add test cases in test_main.py
    4. Verify everything works

👁️  Reviewer Agent:
  Iterations: 2
  Decision: CHANGES REQUESTED
  Feedback:
    I found a few issues:

    1. The multiply function doesn't handle non-numeric inputs
    2. The docstring could be more descriptive
    3. Need more test cases for edge cases

Round 2
----------------------------------------------------------------------

👨‍💻 Coder Agent:
  Iterations: 2
  Plan:
    I'll fix the issues the reviewer found:
    1. Add error handling for non-numeric inputs
    2. Improve the docstring
    3. Add more comprehensive tests

👁️  Reviewer Agent:
  Iterations: 1
  Decision: APPROVED

======================================================================
```

## Saved Transcripts

Full conversations are automatically saved to:
```
~/.claude-logs/conversations/TASK_ID.txt
```

You can review these later to:
- Understand what agents did
- Debug issues
- Learn from agent reasoning
- Audit decisions

## Benefits

### 1. **Transparency**
You can see exactly what the agents are thinking and doing at each step.

### 2. **Trust Building**
Watch agents reason through problems, making their decisions transparent.

### 3. **Debugging**
When something goes wrong, the conversation history shows exactly where and why.

### 4. **Learning**
See how agents break down tasks, handle feedback, and iterate on solutions.

### 5. **Monitoring**
Track progress in real-time instead of waiting for completion.

## Example Flow

Here's what a typical 2-round interaction looks like:

**Round 1:**
1. Coder receives task
2. Coder creates plan → **You see the plan**
3. Coder implements → **You see which tools are used**
4. Reviewer checks code → **You see what files reviewer reads**
5. Reviewer finds issues → **You see the feedback**

**Round 2:**
6. Coder receives feedback
7. Coder fixes issues → **You see the fixes being made**
8. Reviewer checks again → **You see the review process**
9. Reviewer approves → **You see "APPROVED"**

## Integration

The conversation display is automatically enabled when:
- Using real agents (not mock mode)
- Running with `--real` flag
- API key is configured

No additional configuration needed!

## Demo

To see a demo of the conversation display:
```bash
cd ~/claude-automation
node test/test-conversation-display.js
```

This shows a mock conversation demonstrating the format and features.

## Technical Details

### Real-time Display
- Shows first few lines of agent plans/feedback during execution
- Displays tool usage as it happens
- Updates after each iteration

### Full Transcript
- Generated at the end of execution
- Includes all rounds and iterations
- Formatted for readability
- Saved to disk automatically

### File Format
- Plain text with ANSI colors
- Human-readable
- Easy to search and grep
- Timestamped by task ID

## Use Cases

### Development
Watch agents work while developing new features. See their reasoning and adjust prompts if needed.

### Testing
Verify agents are following instructions correctly. Check that reviewer is catching issues.

### Production
Monitor agent behavior in real workflows. Audit decisions for compliance.

### Education
Learn how multi-agent systems work. Study agent collaboration patterns.

## Tips

1. **Save important conversations**: Copy transcripts to a permanent location
2. **Review failed tasks**: Conversation shows why agents struggled
3. **Improve prompts**: Use conversations to refine system prompts
4. **Track progress**: Watch tool usage to see what's taking time
5. **Verify quality**: Read reviewer feedback to ensure thoroughness

## Future Enhancements

Possible future additions:
- Interactive mode (pause/resume agents)
- Conversation search and filtering
- Visualization of agent flow
- Export to different formats (JSON, Markdown, HTML)
- Real-time streaming to web interface
- Conversation analytics and insights

## Questions?

- Full system docs: `~/claude-automation/docs/SYSTEM_DOCUMENTATION.md`
- Status file: `~/claude-automation/STATUS.md`
- Test the display: `node test/test-conversation-display.js`
