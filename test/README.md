# Phase 0 Proof-of-Concept Tests

This directory contains the proof-of-concept implementation for testing Claude's tool calling capabilities with Docker containers.

## Files

- **agent-executor.js** - Clean abstraction for Claude API tool calling
  - Manages conversation state
  - Handles tool execution with retry logic
  - Tracks costs and usage
  - ~200 lines of clean, testable code

- **container-tools.js** - Docker container interface
  - Safe file operations (read, write, list)
  - Command execution in containers
  - Input validation with Zod schemas
  - Path traversal protection

- **single-agent-poc.js** - Main test script
  - Creates isolated Docker container
  - Runs simple coding task
  - Measures performance and costs
  - Validates success criteria

## Prerequisites

1. **Environment variables** - Copy templates and fill in:
   ```bash
   cp ~/claude-automation/templates/env.template ~/.env
   # Edit ~/.env and add your ANTHROPIC_API_KEY
   chmod 600 ~/.env
   ```

2. **Docker images** - Should already be built:
   ```bash
   docker images | grep claude
   # Should show: claude-python:latest and claude-node:latest
   ```

3. **Dependencies** - Should already be installed:
   ```bash
   cd ~/claude-automation && npm install
   ```

## Running the PoC

### Basic test:
```bash
cd ~/claude-automation
node test/single-agent-poc.js
```

### Expected output:
```
╔════════════════════════════════════════════════════════════╗
║  🧪 Single Agent Proof-of-Concept                         ║
║  Testing: Tool calling in Docker containers               ║
╚════════════════════════════════════════════════════════════╝

🐳 Creating container from claude-python:latest...
✅ Container abc123def456 started

🤖 Starting agent execution...
📝 Task: Create a Python program called hello.py...

🔄 Iteration 1/15
🔧 Executing 1 tool(s)...
  → write_file({"path":"/workspace/hello.py"...
  ✓ write_file succeeded
💰 Cost so far: $0.0245

🔄 Iteration 2/15
🔧 Executing 1 tool(s)...
  → execute_command({"command":"python hello.py"}...
  ✓ execute_command succeeded
💰 Cost so far: $0.0512

✅ Agent finished

============================================================
📊 RESULTS
============================================================

I've successfully created and tested the Python program...

------------------------------------------------------------
💰 Total Cost: $0.0512
📊 Input Tokens: 2,456
📊 Output Tokens: 487
⏱️  Duration: 8.3s
🔄 Iterations: 2
============================================================

📁 Verifying file was created...
✅ File exists! Content:

------------------------------------------------------------
#!/usr/bin/env python3
from datetime import datetime

print("Hello from Claude!")
print(f"Current date and time: {datetime.now()}")
------------------------------------------------------------

✅ SUCCESS CRITERIA:
   Cost < $2.00: ✅ ($0.0512)
   Duration < 5min: ✅ (8.3s)
   Completed: ✅

💾 Saving report to .claude-logs/poc-report.json
🧹 Cleaning up container...
✅ Container cleaned up

✅ Proof-of-concept complete!
```

## Success Criteria

For the PoC to be successful:
- ✅ Agent can read files in container
- ✅ Agent can write files in container
- ✅ Agent can execute commands (python, pytest, etc.)
- ✅ Cost per task < $2.00
- ✅ RAM usage < 8GB (monitor with `docker stats`)
- ✅ Tasks complete in < 5 minutes

## What It Tests

1. **Tool Definition** - Can we properly define tools for Claude?
2. **Tool Execution** - Can Claude use tools correctly?
3. **Multi-turn Conversation** - Can agent maintain context across tool calls?
4. **Container Integration** - Can we safely execute operations in Docker?
5. **Cost Tracking** - Can we accurately track API costs?
6. **Error Handling** - Does retry logic work?

## Monitoring Resources

While the PoC runs, monitor in another terminal:

```bash
# Watch container resources
docker stats

# Watch system resources
htop

# Check logs
tail -f ~/.claude-logs/poc-report.json
```

## Next Steps After PoC

If PoC succeeds:
1. ✅ GO decision - proceed to Phase 1
2. Implement multi-agent coordination
3. Add more sophisticated tools
4. Build full orchestrator

If PoC fails or costs too high:
1. ❌ NO-GO decision
2. Revise architecture
3. Consider simpler alternatives
4. Reassess feasibility

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
```bash
# Check .env file exists and has key
cat ~/.env | grep ANTHROPIC_API_KEY
# Should show: ANTHROPIC_API_KEY=sk-ant-...
```

### "Cannot connect to Docker daemon"
```bash
# Check Docker is running
docker ps
# Start Docker if needed
sudo systemctl start docker
```

### "Image not found: claude-python:latest"
```bash
# Rebuild images
docker build -t claude-python:latest ~/.docker/claude-python/
docker build -t claude-node:latest ~/.docker/claude-node/
```

### High costs or slow execution
- Check token usage in report
- Consider using claude-3-sonnet instead of sonnet-4
- Reduce max_tokens if responses too long
- Simplify task description

## Architecture Notes

This PoC validates the **raw tool calling** approach:
- ✅ No MCP framework overhead
- ✅ Direct Docker exec for tool execution
- ✅ Simple conversation management
- ✅ Full control over security and validation
- ✅ Easy to debug and understand

The clean abstraction (AgentExecutor) provides:
- Automatic retry with exponential backoff
- Cost tracking
- Conversation state management
- Error handling
- Extensibility

This approach scales to multi-agent systems by:
- Running multiple AgentExecutor instances sequentially
- Passing context between agents
- Different tools for different agents (read-only vs write)
- Separate cost tracking per agent
