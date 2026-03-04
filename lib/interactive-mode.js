/**
 * Interactive Mode - Always-on REPL for Claude Automation
 *
 * Works like Claude Code:
 * - Type anything → goes to orchestrator
 * - Orchestrator routes to appropriate agent(s)
 * - Commands start with /
 */

import readline from 'readline';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Orchestrator } from './orchestrator.js';
import { getGlobalConfig } from './global-config.js';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';

export class InteractiveMode extends EventEmitter {
  constructor(options = {}) {
    super();

    this.globalConfig = getGlobalConfig();
    this.orchestrator = null;
    this.rl = null;
    this.running = false;

    // Conversation state
    this.isProcessing = false;
    this.conversationActive = false;
    this.currentProject = options.defaultProject || 'adhoc';

    // Message history for context
    this.messageHistory = [];

    // Agent registry for direct messaging
    this.availableAgents = ['architect', 'coder', 'reviewer', 'security', 'tester', 'documenter', 'sn-api'];
  }

  /**
   * Start interactive mode
   */
  async start() {
    // Initialize orchestrator
    this.orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );

    // Print welcome
    this._printWelcome();

    // Select project on startup
    await this._selectProjectOnStartup();

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this._getPrompt()
    });

    this.running = true;

    // Show project and usage guidance
    console.log('');
    console.log(chalk.white(`  Project: ${chalk.cyan.bold(this.currentProject)}`));
    console.log(chalk.gray('  Type a task or /help for commands'));
    console.log('');

    // Show prompt
    this.rl.prompt();

    // Handle input
    this.rl.on('line', async (line) => {
      const input = line.trim();

      if (!input) {
        this.rl.prompt();
        return;
      }

      // Commands start with /
      if (input.startsWith('/')) {
        await this._handleCommand(input.slice(1));
      } else {
        // Everything else goes to orchestrator
        await this._sendToOrchestrator(input);
      }

      if (this.running) {
        this.rl.setPrompt(this._getPrompt());
        this.rl.prompt();
      }
    });

    // Handle close
    this.rl.on('close', () => {
      this.running = false;
      this._cleanup();
    });

    // Handle SIGINT
    process.on('SIGINT', () => {
      if (this.isProcessing) {
        console.log(chalk.yellow('\n\nInterrupting current task...'));
        // TODO: Actually interrupt the task
        this.isProcessing = false;
        this.rl.prompt();
      } else {
        console.log(chalk.yellow('\n\nShutting down...'));
        this._cleanup();
        process.exit(0);
      }
    });
  }

  /**
   * Get dynamic prompt based on state
   */
  _getPrompt() {
    if (this.isProcessing) {
      return chalk.yellow('  ... ');
    }
    // Input prompt with visual line
    return chalk.gray('  ────────────────────────────────────────────\n') +
           chalk.cyan('  > ');
  }

  /**
   * Print welcome message
   */
  _printWelcome() {
    console.log('');
    console.log(chalk.cyan('╭───────────────────────────────────────────────╮'));
    console.log(chalk.cyan('│') + chalk.cyan.bold('   Claude Multi-Agent System') + '                  ' + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.gray('   AI-powered development orchestration') + '       ' + chalk.cyan('│'));
    console.log(chalk.cyan('╰───────────────────────────────────────────────╯'));
  }

  /**
   * Send message to orchestrator
   */
  async _sendToOrchestrator(message) {
    this.isProcessing = true;
    this.conversationActive = true;
    this.rl.setPrompt(this._getPrompt());

    // Clear screen and show task header
    console.clear();
    console.log(chalk.cyan('─'.repeat(50)));
    console.log(chalk.cyan.bold('  Task: ') + chalk.white(message.slice(0, 40) + (message.length > 40 ? '...' : '')));
    console.log(chalk.cyan('─'.repeat(50)));
    console.log('');

    // Add to history
    this.messageHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    try {
      // Execute task through orchestrator
      const result = await this.orchestrator.executeTask(
        this.currentProject,
        message,
        {
          onProgress: (progress) => {
            // Show progress without blocking
            if (progress.message) {
              // Don't reprint the chalk-formatted messages
              // They're already being printed by the orchestrator
            }
          },
          onMessage: (msg) => {
            // Agent responses are already printed by orchestrator
            // Store in history for context
            this.messageHistory.push({
              role: msg.agent || 'assistant',
              content: msg.content,
              timestamp: msg.timestamp || Date.now()
            });
          }
        }
      );

      // Orchestrator already shows completion box
      // Show post-task menu
      await this._showPostTaskMenu();

    } catch (error) {
      // Orchestrator already shows error box
      // Show post-task menu
      await this._showPostTaskMenu();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Show menu after task completion
   */
  async _showPostTaskMenu() {
    this.rl.pause();

    try {
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What next?',
        choices: [
          { name: 'New task', value: 'new' },
          { name: 'Exit', value: 'exit' }
        ]
      }]);

      if (action === 'exit') {
        this.running = false;
        this._cleanup();
        process.exit(0);
      }

      // Clear for new task
      console.clear();
      this._printWelcome();
      console.log('');
      console.log(chalk.white(`  Project: ${chalk.cyan.bold(this.currentProject)}`));
      console.log(chalk.gray('  Type a task or /help for commands'));
      console.log('');

    } catch (error) {
      // User cancelled - continue
    } finally {
      if (this.running) {
        this.rl.resume();
      }
    }
  }

  /**
   * Handle commands
   */
  async _handleCommand(command) {
    const [cmd, ...args] = command.split(/\s+/);
    const arg = args.join(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
      case 'h':
        this._printHelp();
        break;

      case 'status':
      case 's':
        this._printStatus();
        break;

      case 'agent':
      case 'a':
        await this._selectAgentAndMessage();
        break;

      case 'project':
      case 'p':
        if (arg) {
          this.currentProject = arg;
          console.log(chalk.green(`Project set to: ${arg}\n`));
        } else {
          await this._selectProject();
        }
        break;

      case 'history':
        this._printHistory();
        break;

      case 'clear':
        console.clear();
        this._printWelcome();
        break;

      case 'new':
        this.messageHistory = [];
        this.conversationActive = false;
        console.log(chalk.green('Started new conversation.\n'));
        break;

      case 'quit':
      case 'q':
      case 'exit':
        this.running = false;
        this.rl.close();
        break;

      default:
        console.log(chalk.red(`Unknown command: /${cmd}`));
        console.log(chalk.gray('Type /help for available commands\n'));
    }
  }

  /**
   * Select agent with dropdown and send message
   */
  async _selectAgentAndMessage() {
    // Temporarily close readline to use inquirer
    this.rl.pause();

    try {
      const { agent } = await inquirer.prompt([{
        type: 'list',
        name: 'agent',
        message: 'Select agent:',
        choices: this.availableAgents.map(a => ({
          name: this._formatAgentName(a),
          value: a
        }))
      }]);

      const { message } = await inquirer.prompt([{
        type: 'input',
        name: 'message',
        message: `Message to ${agent}:`
      }]);

      if (message.trim()) {
        console.log(chalk.cyan(`\nSending to ${agent}...\n`));
        // TODO: Direct agent messaging through orchestrator
        // For now, prefix the message to hint at the agent
        await this._sendToOrchestrator(`[To ${agent}]: ${message}`);
      }
    } catch (error) {
      // User cancelled
    } finally {
      this.rl.resume();
    }
  }

  /**
   * Format agent name for display
   */
  _formatAgentName(agent) {
    const descriptions = {
      'architect': 'Architect - Analysis & Planning',
      'coder': 'Coder - Implementation',
      'reviewer': 'Reviewer - Code Review',
      'security': 'Security - Security Analysis',
      'tester': 'Tester - Test Engineering',
      'documenter': 'Documenter - Documentation',
      'sn-api': 'SN-API - ServiceNow API Analysis'
    };
    return descriptions[agent] || agent;
  }

  /**
   * Select project on startup (before readline is created)
   */
  async _selectProjectOnStartup() {
    try {
      const projectsDir = this.globalConfig.get('configDir');
      const files = await fs.readdir(projectsDir);
      const projects = files
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => f.replace(/\.(yaml|yml)$/, ''));

      if (projects.length === 0) {
        console.log(chalk.yellow('No projects configured. Using adhoc.\n'));
        this.currentProject = 'adhoc';
        return;
      }

      // Build choices - adhoc first if available
      const choices = [];
      if (projects.includes('adhoc')) {
        choices.push({
          name: 'adhoc (quick task, no GitHub)',
          value: 'adhoc'
        });
        choices.push({
          name: '-'.repeat(30),
          value: 'sep',
          disabled: true
        });
      }

      // Add other projects
      projects
        .filter(p => p !== 'adhoc')
        .forEach(p => choices.push({ name: p, value: p }));

      const { project } = await inquirer.prompt([{
        type: 'list',
        name: 'project',
        message: 'Select project:',
        choices
      }]);

      this.currentProject = project;
    } catch (error) {
      console.log(chalk.yellow(`Could not load projects: ${error.message}`));
      console.log(chalk.gray('Using adhoc as default.\n'));
      this.currentProject = 'adhoc';
    }
  }

  /**
   * Select project with dropdown (during session)
   */
  async _selectProject() {
    this.rl.pause();

    try {
      const projectsDir = this.globalConfig.get('configDir');
      const files = await fs.readdir(projectsDir);
      const projects = files
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => f.replace(/\.(yaml|yml)$/, ''));

      const { project } = await inquirer.prompt([{
        type: 'list',
        name: 'project',
        message: 'Select project:',
        choices: projects.map(p => ({
          name: p === this.currentProject ? `${p} (current)` : p,
          value: p
        }))
      }]);

      this.currentProject = project;
      console.log(chalk.green(`\nProject set to: ${project}\n`));
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}\n`));
    } finally {
      this.rl.resume();
    }
  }

  /**
   * Print help
   */
  _printHelp() {
    console.log('');
    console.log(chalk.cyan('  Commands'));
    console.log(chalk.gray('  ────────────────────────────────────'));
    console.log(chalk.white('  /help, /h     ') + chalk.gray('Show this help'));
    console.log(chalk.white('  /status, /s   ') + chalk.gray('Show current status'));
    console.log(chalk.white('  /agent, /a    ') + chalk.gray('Message specific agent'));
    console.log(chalk.white('  /project, /p  ') + chalk.gray('Switch project'));
    console.log(chalk.white('  /history      ') + chalk.gray('Conversation history'));
    console.log(chalk.white('  /new          ') + chalk.gray('New conversation'));
    console.log(chalk.white('  /clear        ') + chalk.gray('Clear screen'));
    console.log(chalk.white('  /quit, /q     ') + chalk.gray('Exit'));
    console.log('');
    console.log(chalk.gray('  Or just type a task to get started.'));
    console.log('');
  }

  /**
   * Print status
   */
  _printStatus() {
    console.log('');
    console.log(chalk.cyan('  Status'));
    console.log(chalk.gray('  ────────────────────────────────────'));
    console.log(chalk.white('  Project:      ') + chalk.cyan(this.currentProject));
    console.log(chalk.white('  Processing:   ') + (this.isProcessing ? chalk.yellow('Yes') : chalk.gray('No')));
    console.log(chalk.white('  Conversation: ') + (this.conversationActive ? chalk.green('Active') : chalk.gray('None')));
    console.log(chalk.white('  Messages:     ') + chalk.gray(this.messageHistory.length));
    console.log('');
  }

  /**
   * Print conversation history
   */
  _printHistory() {
    console.log('');
    console.log(chalk.cyan('  History'));
    console.log(chalk.gray('  ────────────────────────────────────'));

    if (this.messageHistory.length === 0) {
      console.log(chalk.gray('  No messages yet.'));
      console.log('');
      return;
    }

    // Show last 10 messages
    const recent = this.messageHistory.slice(-10);
    for (const msg of recent) {
      const role = msg.role === 'user' ? chalk.green('you') : chalk.cyan(msg.role);
      const preview = msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : '');
      console.log(`  ${role}: ${chalk.white(preview)}`);
    }
    console.log('');
  }

  /**
   * Cleanup on exit
   */
  async _cleanup() {
    console.log(chalk.gray('\nCleaning up...'));

    try {
      if (this.orchestrator) {
        await this.orchestrator.cleanupAll();
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log(chalk.gray('Goodbye!\n'));
  }
}

/**
 * Start interactive mode
 */
export async function startInteractiveMode(options = {}) {
  const interactive = new InteractiveMode(options);
  await interactive.start();
}
