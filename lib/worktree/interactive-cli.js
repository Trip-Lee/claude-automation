/**
 * Interactive CLI for Worktree Agent System
 *
 * Provides a terminal interface for users to:
 * 1. View agent conversations in real-time
 * 2. Inject messages into ongoing conversations
 * 3. List and manage conversations
 * 4. Control agent execution
 */

import readline from 'readline';
import chalk from 'chalk';
import { WorktreeOrchestrator, OrchestratorStrategy } from './orchestrator.js';
import { MessageRole } from './agent-conversation.js';

/**
 * Interactive CLI for agent conversations
 */
export class InteractiveCli {
  constructor(options = {}) {
    this.orchestrator = options.orchestrator || new WorktreeOrchestrator({
      workingDir: options.workingDir,
      verbose: options.verbose !== false
    });

    this.rl = null;
    this.running = false;
    this.currentConversation = null;
    this.inputMode = 'command'; // 'command' or 'message'
  }

  /**
   * Start the interactive CLI
   */
  async start() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.running = true;

    this._printBanner();
    this._printHelp();

    // Set up conversation event listeners when active
    this._setupConversationListeners();

    // Main input loop
    this._promptUser();

    this.rl.on('line', async (line) => {
      await this._handleInput(line.trim());
      if (this.running) {
        this._promptUser();
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      console.log(chalk.gray('\nGoodbye!'));
    });

    // Handle SIGINT gracefully
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nInterrupted. Cleaning up...'));
      this.stop();
    });
  }

  /**
   * Stop the CLI
   */
  async stop() {
    this.running = false;

    if (this.orchestrator) {
      await this.orchestrator.cleanup();
    }

    if (this.rl) {
      this.rl.close();
    }
  }

  /**
   * Handle user input
   */
  async _handleInput(input) {
    if (!input) return;

    // Check for commands (start with /)
    if (input.startsWith('/')) {
      await this._handleCommand(input.slice(1));
      return;
    }

    // If in message mode and there's an active conversation, inject the message
    if (this.inputMode === 'message' && this.currentConversation) {
      try {
        this.orchestrator.injectUserMessage(input);
        console.log(chalk.green('Message queued for next agent turn'));
      } catch (error) {
        console.log(chalk.red(`Error: ${error.message}`));
      }
      return;
    }

    // Default: treat as a new task
    await this._startTask(input);
  }

  /**
   * Handle CLI commands
   */
  async _handleCommand(command) {
    const [cmd, ...args] = command.split(/\s+/);

    switch (cmd.toLowerCase()) {
      case 'help':
      case 'h':
        this._printHelp();
        break;

      case 'status':
      case 's':
        this._printStatus();
        break;

      case 'list':
      case 'l':
        await this._listConversations();
        break;

      case 'history':
        this._printHistory();
        break;

      case 'message':
      case 'm':
        this.inputMode = this.inputMode === 'message' ? 'command' : 'message';
        console.log(chalk.cyan(`Input mode: ${this.inputMode}`));
        break;

      case 'inject':
      case 'i':
        if (args.length > 0) {
          const message = args.join(' ');
          try {
            this.orchestrator.injectUserMessage(message);
            console.log(chalk.green('Message injected'));
          } catch (error) {
            console.log(chalk.red(`Error: ${error.message}`));
          }
        } else {
          console.log(chalk.yellow('Usage: /inject <message>'));
        }
        break;

      case 'continue':
      case 'c':
        if (args.length > 0) {
          await this._continueConversation(args[0], args.slice(1).join(' '));
        } else {
          console.log(chalk.yellow('Usage: /continue <conversation-id> [message]'));
        }
        break;

      case 'switch':
        if (args.length > 0) {
          await this._switchConversation(args[0]);
        } else {
          console.log(chalk.yellow('Usage: /switch <conversation-id>'));
        }
        break;

      case 'agent':
      case 'a':
        if (args.length >= 2) {
          const agentName = args[0];
          const task = args.slice(1).join(' ');
          await this._runWithAgent(agentName, task);
        } else {
          console.log(chalk.yellow('Usage: /agent <agent-name> <task>'));
          this._printAgents();
        }
        break;

      case 'sn':
      case 'servicenow':
        if (args.length > 0) {
          const task = args.join(' ');
          await this._runServiceNowTask(task);
        } else {
          console.log(chalk.yellow('Usage: /sn <task>'));
        }
        break;

      case 'strategy':
        if (args.length > 0) {
          this._setStrategy(args[0]);
        } else {
          console.log(chalk.cyan(`Current strategy: ${this.orchestrator.strategy}`));
          console.log(chalk.gray('Available: single, sequential, parallel, architect_led, auto'));
        }
        break;

      case 'quit':
      case 'q':
      case 'exit':
        await this.stop();
        break;

      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
        console.log(chalk.gray('Type /help for available commands'));
    }
  }

  /**
   * Start a new task
   */
  async _startTask(taskDescription) {
    console.log(chalk.cyan('\nStarting task...'));

    try {
      const result = await this.orchestrator.execute(taskDescription, {
        realTimeOutput: true
      });

      this.currentConversation = result.conversationId;

      if (result.success) {
        console.log(chalk.green('\nTask completed successfully'));
      } else {
        console.log(chalk.red(`\nTask failed: ${result.error}`));
      }

    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  }

  /**
   * Run task with specific agent
   */
  async _runWithAgent(agentName, task) {
    console.log(chalk.cyan(`\nRunning with agent: ${agentName}`));

    try {
      const result = await this.orchestrator.executeWithAgent(agentName, task, {
        realTimeOutput: true
      });

      this.currentConversation = result.conversationId;

      if (result.success) {
        console.log(chalk.green('\nAgent task completed'));
      } else {
        console.log(chalk.red(`\nAgent task failed: ${result.error}`));
      }

    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  }

  /**
   * Run ServiceNow-specific task
   */
  async _runServiceNowTask(task) {
    console.log(chalk.cyan('\nRunning ServiceNow task...'));

    try {
      const result = await this.orchestrator.executeServiceNowTask(task, {
        realTimeOutput: true
      });

      this.currentConversation = result.conversationId;

      if (result.success) {
        console.log(chalk.green('\nServiceNow task completed'));
      } else {
        console.log(chalk.red(`\nServiceNow task failed`));
      }

    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  }

  /**
   * Continue an existing conversation
   */
  async _continueConversation(conversationId, message) {
    if (!message) {
      console.log(chalk.yellow('Please provide a message to continue the conversation'));
      return;
    }

    console.log(chalk.cyan(`\nContinuing conversation: ${conversationId}`));

    try {
      const result = await this.orchestrator.continueConversation(conversationId, message, {
        realTimeOutput: true
      });

      this.currentConversation = conversationId;

      if (result.success) {
        console.log(chalk.green('\nContinuation completed'));
      } else {
        console.log(chalk.red('\nContinuation failed'));
      }

    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  }

  /**
   * Switch to viewing a different conversation
   */
  async _switchConversation(conversationId) {
    const state = this.orchestrator.getConversationState(conversationId);

    if (!state) {
      console.log(chalk.red(`Conversation not found: ${conversationId}`));
      return;
    }

    this.currentConversation = conversationId;
    console.log(chalk.green(`Switched to conversation: ${conversationId}`));
    this._printConversationSummary(state);
  }

  /**
   * List all conversations
   */
  async _listConversations() {
    const conversations = await this.orchestrator.listConversations();

    if (conversations.length === 0) {
      console.log(chalk.gray('No conversations found'));
      return;
    }

    console.log(chalk.cyan('\nConversations:'));
    console.log(chalk.gray('-'.repeat(60)));

    for (const conv of conversations) {
      const current = conv.conversationId === this.currentConversation ? chalk.yellow(' (current)') : '';
      const status = conv.status === 'completed' ? chalk.green(conv.status) :
                     conv.status === 'failed' ? chalk.red(conv.status) :
                     chalk.yellow(conv.status);

      console.log(`  ${chalk.white(conv.conversationId)}${current}`);
      console.log(`    Status: ${status} | Messages: ${conv.messageCount}`);
      console.log(`    Task: ${chalk.gray(this._truncate(conv.taskDescription, 50))}`);
      console.log();
    }
  }

  /**
   * Print current conversation status
   */
  _printStatus() {
    if (!this.currentConversation) {
      console.log(chalk.gray('No active conversation'));
      return;
    }

    const state = this.orchestrator.getConversationState(this.currentConversation);

    if (!state) {
      console.log(chalk.gray('Conversation state not available'));
      return;
    }

    this._printConversationSummary(state);
  }

  /**
   * Print conversation history
   */
  _printHistory() {
    if (!this.currentConversation) {
      console.log(chalk.gray('No active conversation'));
      return;
    }

    const state = this.orchestrator.getConversationState(this.currentConversation);

    if (!state || !state.messages) {
      console.log(chalk.gray('No messages in conversation'));
      return;
    }

    console.log(chalk.cyan('\nConversation History:'));
    console.log(chalk.gray('='.repeat(60)));

    for (const msg of state.messages) {
      this._printMessage(msg);
    }
  }

  /**
   * Print a single message
   */
  _printMessage(msg) {
    const time = msg.formattedTime || new Date(msg.timestamp).toLocaleTimeString();

    switch (msg.role) {
      case MessageRole.AGENT:
        console.log(chalk.blue(`\n[${time}] ${msg.agent}:`));
        console.log(chalk.white(this._formatContent(msg.content)));
        break;

      case MessageRole.USER:
        console.log(chalk.green(`\n[${time}] User:`));
        console.log(chalk.white(msg.content));
        break;

      case MessageRole.ORCHESTRATOR:
        console.log(chalk.magenta(`[${time}] ${msg.content}`));
        break;

      case MessageRole.TOOL_RESULT:
        console.log(chalk.gray(`  [${time}] Tool(${msg.tool}): ${this._truncate(msg.content, 100)}`));
        break;

      case MessageRole.SYSTEM:
        console.log(chalk.cyan(`[${time}] ${msg.content}`));
        break;
    }
  }

  /**
   * Print conversation summary
   */
  _printConversationSummary(state) {
    console.log(chalk.cyan('\nConversation Summary:'));
    console.log(chalk.gray('-'.repeat(40)));
    console.log(`  ID: ${chalk.white(state.conversationId)}`);
    console.log(`  Status: ${this._formatStatus(state.status)}`);
    console.log(`  Task: ${chalk.gray(this._truncate(state.taskDescription, 50))}`);
    console.log(`  Messages: ${state.messageCount}`);
    console.log(`  Cost: $${state.totalCost?.toFixed(4) || '0.0000'}`);

    if (state.currentAgent) {
      console.log(`  Current Agent: ${chalk.yellow(state.currentAgent)}`);
    }

    if (state.agents && state.agents.length > 0) {
      console.log(`  Agents: ${state.agents.map(a => a.name).join(', ')}`);
    }
  }

  /**
   * Print available agents
   */
  _printAgents() {
    console.log(chalk.cyan('\nAvailable Agents:'));
    console.log(chalk.gray('-'.repeat(40)));

    const agents = [
      { name: 'architect', desc: 'System design and planning' },
      { name: 'coder', desc: 'Code implementation' },
      { name: 'reviewer', desc: 'Code review and quality' },
      { name: 'documenter', desc: 'Documentation' },
      { name: 'sn-api', desc: 'ServiceNow API analysis' },
      { name: 'sn-ui', desc: 'ServiceNow UI/Portal' },
      { name: 'sn-scripting', desc: 'ServiceNow scripts' },
      { name: 'sn-integration', desc: 'ServiceNow integrations' },
      { name: 'sn-security', desc: 'ServiceNow security' }
    ];

    for (const agent of agents) {
      console.log(`  ${chalk.white(agent.name.padEnd(15))} ${chalk.gray(agent.desc)}`);
    }
  }

  /**
   * Set orchestration strategy
   */
  _setStrategy(strategy) {
    const strategies = ['single', 'sequential', 'parallel', 'architect_led', 'auto'];

    if (!strategies.includes(strategy)) {
      console.log(chalk.red(`Invalid strategy. Available: ${strategies.join(', ')}`));
      return;
    }

    this.orchestrator.strategy = strategy;
    console.log(chalk.green(`Strategy set to: ${strategy}`));
  }

  /**
   * Set up event listeners for real-time updates
   */
  _setupConversationListeners() {
    // These would be called when events occur
    // The orchestrator's executeAgent already handles real-time output
  }

  /**
   * Print welcome banner
   */
  _printBanner() {
    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan.bold('  CLAUDE WORKTREE AGENT SYSTEM'));
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.gray('  Multi-agent collaboration with real-time interaction'));
    console.log(chalk.cyan('='.repeat(60) + '\n'));
  }

  /**
   * Print help
   */
  _printHelp() {
    console.log(chalk.cyan('\nCommands:'));
    console.log(chalk.gray('-'.repeat(40)));
    console.log('  Just type a task description to start');
    console.log();
    console.log(chalk.white('  /help, /h       ') + chalk.gray('Show this help'));
    console.log(chalk.white('  /status, /s     ') + chalk.gray('Show current conversation status'));
    console.log(chalk.white('  /list, /l       ') + chalk.gray('List all conversations'));
    console.log(chalk.white('  /history        ') + chalk.gray('Show conversation history'));
    console.log(chalk.white('  /message, /m    ') + chalk.gray('Toggle message input mode'));
    console.log(chalk.white('  /inject <msg>   ') + chalk.gray('Inject message into conversation'));
    console.log(chalk.white('  /continue <id>  ') + chalk.gray('Continue a conversation'));
    console.log(chalk.white('  /switch <id>    ') + chalk.gray('Switch to viewing a conversation'));
    console.log(chalk.white('  /agent <n> <t>  ') + chalk.gray('Run task with specific agent'));
    console.log(chalk.white('  /sn <task>      ') + chalk.gray('Run ServiceNow-specific task'));
    console.log(chalk.white('  /strategy <s>   ') + chalk.gray('Set orchestration strategy'));
    console.log(chalk.white('  /quit, /q       ') + chalk.gray('Exit'));
    console.log();
  }

  /**
   * Show prompt
   */
  _promptUser() {
    const modeIndicator = this.inputMode === 'message' ? chalk.yellow('[MSG]') : '';
    const convIndicator = this.currentConversation
      ? chalk.gray(`[${this.currentConversation.slice(0, 8)}]`)
      : '';

    this.rl.setPrompt(`${modeIndicator}${convIndicator}${chalk.cyan('> ')}`);
    this.rl.prompt();
  }

  /**
   * Format status with color
   */
  _formatStatus(status) {
    switch (status) {
      case 'completed': return chalk.green(status);
      case 'failed': return chalk.red(status);
      case 'running': return chalk.yellow(status);
      case 'paused': return chalk.magenta(status);
      default: return chalk.gray(status);
    }
  }

  /**
   * Format content for display
   */
  _formatContent(content, maxLines = 10) {
    if (!content) return '';

    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return content;
    }

    return lines.slice(0, maxLines).join('\n') + chalk.gray(`\n... (${lines.length - maxLines} more lines)`);
  }

  /**
   * Truncate string
   */
  _truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

/**
 * Main entry point for CLI
 */
export async function runInteractiveCli(options = {}) {
  const cli = new InteractiveCli(options);
  await cli.start();
}

export default InteractiveCli;
