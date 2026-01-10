#!/usr/bin/env node

/**
 * Claude Worktree Agent System - CLI Entry Point
 *
 * Standalone CLI for the worktree-based multi-agent system.
 * This uses Claude's native Task tool patterns for coordination.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import { homedir } from 'os';

// Load environment
dotenv.config({ path: path.join(homedir(), '.env') });

const program = new Command();

program
  .name('worktree')
  .description('Claude Worktree Agent System - Multi-agent collaboration')
  .version('1.0.0');

// Interactive mode - main entry point
program
  .command('interactive')
  .alias('i')
  .description('Start interactive conversation mode')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-v, --verbose', 'Verbose output', true)
  .option('-s, --strategy <strategy>', 'Orchestration strategy (auto, single, sequential, parallel, architect_led)', 'auto')
  .action(async (options) => {
    try {
      const { runInteractiveCli } = await import('./lib/worktree/interactive-cli.js');

      await runInteractiveCli({
        workingDir: options.dir,
        verbose: options.verbose,
        strategy: options.strategy
      });

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Execute a single task
program
  .command('run <task>')
  .description('Execute a task with the agent system')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-s, --strategy <strategy>', 'Strategy: auto, single, sequential, parallel, architect_led', 'auto')
  .option('-a, --agent <agent>', 'Specific agent to use (overrides strategy)')
  .option('--no-save', 'Do not save conversation to disk')
  .option('-q, --quiet', 'Minimal output')
  .action(async (task, options) => {
    try {
      const { WorktreeOrchestrator } = await import('./lib/worktree/orchestrator.js');

      const orchestrator = new WorktreeOrchestrator({
        workingDir: options.dir,
        verbose: !options.quiet,
        strategy: options.strategy
      });

      let result;

      if (options.agent) {
        console.log(chalk.cyan(`\nRunning with agent: ${options.agent}\n`));
        result = await orchestrator.executeWithAgent(options.agent, task, {
          realTimeOutput: !options.quiet,
          save: options.save
        });
      } else {
        console.log(chalk.cyan(`\nExecuting task...\n`));
        result = await orchestrator.execute(task, {
          realTimeOutput: !options.quiet,
          save: options.save,
          strategy: options.strategy
        });
      }

      if (result.success) {
        console.log(chalk.green('\nTask completed successfully'));
        console.log(chalk.gray(`Conversation ID: ${result.conversationId}`));
      } else {
        console.log(chalk.red(`\nTask failed: ${result.error}`));
        process.exit(1);
      }

      await orchestrator.cleanup();

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// ServiceNow-specific task
program
  .command('sn <task>')
  .alias('servicenow')
  .description('Execute a ServiceNow-specific task')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('--no-save', 'Do not save conversation to disk')
  .option('-q, --quiet', 'Minimal output')
  .action(async (task, options) => {
    try {
      const { WorktreeOrchestrator } = await import('./lib/worktree/orchestrator.js');

      const orchestrator = new WorktreeOrchestrator({
        workingDir: options.dir,
        verbose: !options.quiet
      });

      console.log(chalk.cyan(`\nExecuting ServiceNow task...\n`));

      const result = await orchestrator.executeServiceNowTask(task, {
        realTimeOutput: !options.quiet,
        save: options.save
      });

      if (result.success) {
        console.log(chalk.green('\nServiceNow task completed'));
        console.log(chalk.gray(`Conversation ID: ${result.conversationId}`));
      } else {
        console.log(chalk.red(`\nTask failed`));
        process.exit(1);
      }

      await orchestrator.cleanup();

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Continue a conversation
program
  .command('continue <conversationId> <message>')
  .description('Continue an existing conversation')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action(async (conversationId, message, options) => {
    try {
      const { WorktreeOrchestrator } = await import('./lib/worktree/orchestrator.js');

      const orchestrator = new WorktreeOrchestrator({
        workingDir: options.dir,
        verbose: true
      });

      console.log(chalk.cyan(`\nContinuing conversation: ${conversationId}\n`));

      const result = await orchestrator.continueConversation(conversationId, message, {
        realTimeOutput: true
      });

      if (result.success) {
        console.log(chalk.green('\nContinuation completed'));
      } else {
        console.log(chalk.red('\nContinuation failed'));
      }

      await orchestrator.cleanup();

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// List conversations
program
  .command('list')
  .alias('ls')
  .description('List all conversations')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action(async (options) => {
    try {
      const { WorktreeOrchestrator } = await import('./lib/worktree/orchestrator.js');

      const orchestrator = new WorktreeOrchestrator({
        workingDir: options.dir,
        verbose: false
      });

      const conversations = await orchestrator.listConversations();

      if (conversations.length === 0) {
        console.log(chalk.gray('\nNo conversations found\n'));
        return;
      }

      console.log(chalk.cyan('\nConversations:'));
      console.log(chalk.gray('-'.repeat(60)));

      for (const conv of conversations) {
        const statusColor = conv.status === 'completed' ? chalk.green :
                           conv.status === 'failed' ? chalk.red :
                           chalk.yellow;

        console.log(`\n  ${chalk.white(conv.conversationId)}`);
        console.log(`    Status: ${statusColor(conv.status)} | Messages: ${conv.messageCount}`);
        console.log(`    Task: ${chalk.gray(conv.taskDescription?.substring(0, 50) || 'N/A')}`);

        if (conv.savedAt) {
          console.log(`    Saved: ${chalk.gray(new Date(conv.savedAt).toLocaleString())}`);
        }
      }

      console.log();

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Show conversation details
program
  .command('show <conversationId>')
  .description('Show conversation details and history')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-f, --full', 'Show full message content')
  .action(async (conversationId, options) => {
    try {
      const { WorktreeOrchestrator } = await import('./lib/worktree/orchestrator.js');
      const { MessageRole } = await import('./lib/worktree/agent-conversation.js');

      const orchestrator = new WorktreeOrchestrator({
        workingDir: options.dir,
        verbose: false
      });

      const state = orchestrator.getConversationState(conversationId);

      if (!state) {
        // Try to load from disk
        const conversations = await orchestrator.listConversations();
        const conv = conversations.find(c => c.conversationId === conversationId);

        if (!conv) {
          console.log(chalk.red(`\nConversation not found: ${conversationId}\n`));
          process.exit(1);
        }
      }

      // Load and display
      const { AgentConversation } = await import('./lib/worktree/agent-conversation.js');
      const path = await import('path');

      const convPath = path.join(
        options.dir,
        '.claude-worktree',
        `conversation-${conversationId}.json`
      );

      const conversation = await AgentConversation.load(convPath);

      console.log(chalk.cyan('\nConversation Details:'));
      console.log(chalk.gray('='.repeat(60)));
      console.log(`  ID: ${chalk.white(conversation.conversationId)}`);
      console.log(`  Task: ${chalk.white(conversation.taskDescription)}`);
      console.log(`  Status: ${conversation.status}`);
      console.log(`  Cost: $${conversation.totalCost.toFixed(4)}`);
      console.log(`  Messages: ${conversation.messages.length}`);

      console.log(chalk.cyan('\nAgents:'));
      for (const [name, data] of conversation.agents) {
        console.log(`  - ${name}: ${data.status || 'active'}`);
      }

      console.log(chalk.cyan('\nMessages:'));
      console.log(chalk.gray('-'.repeat(60)));

      for (const msg of conversation.messages) {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const maxLen = options.full ? Infinity : 200;

        switch (msg.role) {
          case 'agent':
            console.log(chalk.blue(`\n[${time}] ${msg.agent}:`));
            console.log(msg.content.substring(0, maxLen) + (msg.content.length > maxLen ? '...' : ''));
            break;

          case 'user':
            console.log(chalk.green(`\n[${time}] User:`));
            console.log(msg.content);
            break;

          case 'orchestrator':
            console.log(chalk.magenta(`[${time}] ${msg.content}`));
            break;

          case 'tool_result':
            console.log(chalk.gray(`  [${time}] Tool(${msg.tool})`));
            break;

          case 'system':
            console.log(chalk.cyan(`[${time}] ${msg.content}`));
            break;
        }
      }

      console.log();

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// List available agents
program
  .command('agents')
  .description('List available agents')
  .action(async () => {
    try {
      const { WorktreeAgentRegistry } = await import('./lib/worktree/agent-registry.js');

      const registry = new WorktreeAgentRegistry();

      console.log(chalk.cyan('\nAvailable Agents:'));
      console.log(chalk.gray('='.repeat(60)));

      console.log(chalk.white('\nGeneral Purpose:'));
      console.log(`  ${chalk.cyan('architect')}    - System design and planning`);
      console.log(`  ${chalk.cyan('coder')}        - Code implementation`);
      console.log(`  ${chalk.cyan('reviewer')}     - Code review and quality`);
      console.log(`  ${chalk.cyan('documenter')}   - Documentation writing`);

      console.log(chalk.white('\nServiceNow Specialists:'));
      console.log(`  ${chalk.cyan('sn-api')}       - API and GlideRecord analysis`);
      console.log(`  ${chalk.cyan('sn-ui')}        - Portal and UI components`);
      console.log(`  ${chalk.cyan('sn-scripting')}'} - Business rules and scripts`);
      console.log(`  ${chalk.cyan('sn-integration')} - Integrations and REST/SOAP`);
      console.log(`  ${chalk.cyan('sn-security')}  - ACLs and security policies`);

      console.log(chalk.gray('\n─'.repeat(60)));
      console.log(chalk.gray('Use --agent <name> to run with a specific agent'));
      console.log();

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Default action - show help or start interactive
if (process.argv.length === 2) {
  // No command - start interactive mode
  import('./lib/worktree/interactive-cli.js').then(({ runInteractiveCli }) => {
    runInteractiveCli({
      workingDir: process.cwd(),
      verbose: true
    }).catch(error => {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    });
  });
} else {
  program.parse();
}
