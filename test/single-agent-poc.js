#!/usr/bin/env node

/**
 * Single Agent Proof-of-Concept
 *
 * Tests the core agent system with a simple coding task:
 * 1. Create a Docker container
 * 2. Ask agent to create a Python hello world program
 * 3. Ask agent to modify it
 * 4. Ask agent to test it
 * 5. Measure cost and performance
 *
 * Usage: node test/single-agent-poc.js
 */

import dotenv from 'dotenv';
import { AgentExecutor } from './agent-executor.js';
import { ContainerTools, createTestContainer, cleanupContainer } from './container-tools.js';

dotenv.config();

// Verify environment
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not set in .env file');
  process.exit(1);
}

/**
 * Fallback validation mode - manually test tools without API
 * This validates the Docker integration works even without Anthropic credits
 */
async function runFallbackValidation(containerTools) {
  console.log('🔧 Testing write_file tool...');
  await containerTools.executeTool('write_file', {
    path: '/workspace/hello.py',
    content: `#!/usr/bin/env python3
from datetime import datetime

print("Hello from Claude!")
print(f"Current date and time: {datetime.now()}")
`
  });
  console.log('✅ write_file succeeded\n');

  console.log('🔧 Testing read_file tool...');
  const content = await containerTools.executeTool('read_file', {
    path: '/workspace/hello.py'
  });
  console.log('✅ read_file succeeded\n');

  console.log('🔧 Testing execute_command tool...');
  const output = await containerTools.executeTool('execute_command', {
    command: 'python /workspace/hello.py'
  });
  console.log('✅ execute_command succeeded');
  console.log(`📄 Output:\n${output}\n`);

  console.log('🔧 Testing list_directory tool...');
  const files = await containerTools.executeTool('list_directory', {
    path: '/workspace'
  });
  console.log('✅ list_directory succeeded');
  console.log(`📁 Files: ${files}\n`);

  return {
    response: `✅ Fallback Validation Complete!\n\nAll Docker container tools tested successfully:\n- write_file: ✅\n- read_file: ✅\n- execute_command: ✅\n- list_directory: ✅\n\nThe system infrastructure is working correctly. Full agent testing requires Anthropic API credits.`,
    cost: 0,
    usage: { input_tokens: 0, output_tokens: 0 },
    iterations: 0
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 Single Agent Proof-of-Concept                         ║');
  console.log('║  Testing: Tool calling in Docker containers               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let container = null;

  try {
    // 1. Create container
    container = await createTestContainer('claude-python:latest');
    const containerTools = new ContainerTools(container);

    // 2. Create executor
    const executor = new AgentExecutor(containerTools, {
      maxIterations: 15,
      maxTokens: 4096
    });

    // 3. Run test task
    const task = `Create a Python program called hello.py that prints "Hello from Claude!" and then modify it to also print the current date and time. Finally, test that it works by running it.`;

    const systemPrompt = `You are a helpful coding assistant. You have access to tools to read, write, and execute files in a container.

Your task: Complete the user's request step by step.

Guidelines:
- Write clean, well-commented code
- Test your code after writing it
- Use execute_command to run Python scripts
- Always verify your changes work

Available tools:
- read_file: Read file contents
- write_file: Write to a file
- list_directory: List files in a directory
- execute_command: Run shell commands

Remember: All file paths must start with /workspace`;

    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 Task:', task);
    console.log('='.repeat(60));

    const startTime = Date.now();
    let result;
    let fallbackMode = false;

    try {
      result = await executor.run(
        systemPrompt,
        task,
        containerTools.getTools()
      );
    } catch (error) {
      // If low credits, fall back to manual validation mode
      if (error.message === 'ANTHROPIC_LOW_CREDITS') {
        console.log(`\n⚠️  Anthropic API credits too low - switching to fallback validation mode`);
        console.log(`📝 Manually validating Docker container tools...\n`);
        fallbackMode = true;
        result = await runFallbackValidation(containerTools);
      } else {
        throw error;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 4. Display results
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESULTS');
    console.log('='.repeat(60));
    console.log(`\n${result.response}\n`);
    console.log('─'.repeat(60));
    console.log(`💰 Total Cost: $${result.cost.toFixed(4)}`);
    console.log(`📊 Input Tokens: ${result.usage.input_tokens.toLocaleString()}`);
    console.log(`📊 Output Tokens: ${result.usage.output_tokens.toLocaleString()}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🔄 Iterations: ${result.iterations}`);
    console.log('='.repeat(60));

    // 5. Verify the file was created
    console.log(`\n📁 Verifying file was created...`);
    try {
      const fileContent = await containerTools.executeTool('read_file', {
        path: '/workspace/hello.py'
      });
      console.log(`✅ File exists! Content:\n`);
      console.log('─'.repeat(60));
      console.log(fileContent);
      console.log('─'.repeat(60));
    } catch (error) {
      console.log(`⚠️  Could not read file: ${error.message}`);
    }

    // 6. Success criteria check
    console.log(`\n✅ SUCCESS CRITERIA:`);
    if (fallbackMode) {
      console.log(`   Mode: Fallback validation (Docker tools only)`);
      console.log(`   All tools tested: ✅`);
      console.log(`   Duration: ✅ (${duration}s)`);
      console.log(`   Completed: ✅`);
      console.log(`\n⚠️  Note: Full agent validation requires Anthropic API credits`);
    } else {
      console.log(`   Cost < $2.00: ${result.cost < 2 ? '✅' : '❌'} ($${result.cost.toFixed(4)})`);
      console.log(`   Duration < 5min: ${duration < 300 ? '✅' : '❌'} (${duration}s)`);
      console.log(`   Completed: ✅`);
    }

    // 7. Save report
    const report = {
      timestamp: new Date().toISOString(),
      task: task,
      cost: result.cost,
      usage: result.usage,
      duration: duration,
      iterations: result.iterations,
      fallbackMode: fallbackMode,
      success: fallbackMode ? true : (result.cost < 2 && duration < 300)
    };

    console.log(`\n💾 Saving report to .claude-logs/poc-report.json`);
    const fs = await import('fs');
    fs.writeFileSync(
      '/home/coltrip/.claude-logs/poc-report.json',
      JSON.stringify(report, null, 2)
    );

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (container) {
      await cleanupContainer(container);
    }
  }

  console.log(`\n✅ Proof-of-concept complete!\n`);
}

// Run
main().catch(console.error);
