#!/usr/bin/env node

/**
 * Cross-Platform ServiceNow Tools Launcher
 * Works on Windows, Mac, and Linux
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');

class SNLauncher {
    constructor() {
        this.platform = process.platform;
        this.isWindows = this.platform === 'win32';
        this.isMac = this.platform === 'darwin';
        this.isLinux = this.platform === 'linux';

        this.toolsDir = path.dirname(__filename);
        this.rootDir = path.dirname(this.toolsDir);
        this.nodeExe = this.getNodeExecutable();
        this.config = this.loadConfig();

        // Ensure directories exist on startup
        this.ensureDirectories();
    }

    loadConfig() {
        const configPath = path.join(this.toolsDir, 'sn-config.json');
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(configData);
            }
        } catch (error) {
            console.warn('Could not load configuration:', error.message);
        }
        return { ai: { mode: 'manual' } };
    }

    saveConfig() {
        const configPath = path.join(this.toolsDir, 'sn-config.json');
        try {
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Could not save configuration:', error.message);
            return false;
        }
    }

    getAIMode() {
        return this.config.ai?.mode || 'manual';
    }

    setAIMode(mode) {
        if (!this.config.ai) {
            this.config.ai = {};
        }
        this.config.ai.mode = mode;
        return this.saveConfig();
    }

    async promptForAIAssistance(step) {
        const aiMode = this.getAIMode();

        if (aiMode === 'auto') {
            return true;
        } else if (aiMode === 'manual') {
            return false;
        } else if (aiMode === 'interactive') {
            const response = await this.prompt(`Would you like to use AI assistance for ${step}? (y/n): `);
            return response.toLowerCase().startsWith('y');
        }

        return false;
    }

    getNodeExecutable() {
        if (this.isWindows) {
            const nvmNode = path.join(this.rootDir, 'nvm', 'v22.11.0', 'node.exe');
            if (fs.existsSync(nvmNode)) {
                return nvmNode;
            }
        }
        return 'node';
    }

    clearScreen() {
        try {
            if (this.isWindows) {
                // Use console.clear() for better performance and less lag
                console.clear();
            } else {
                console.clear();
            }
        } catch (error) {
            // Fallback to old method if console.clear() not supported
            try {
                if (this.isWindows) {
                    execSync('cls', { stdio: 'inherit' });
                } else {
                    execSync('clear', { stdio: 'inherit' });
                }
            } catch (e) {
                // If all else fails, just print newlines
                console.log('\n'.repeat(50));
            }
        }
    }

    async prompt(question) {
        // Create a fresh readline interface for each prompt to avoid lag
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    async pauseForKey() {
        await this.prompt('\nPress Enter to continue...');
    }

    runNode(script, args = []) {
        const nodeArgs = [path.join(this.toolsDir, script), ...args];

        return new Promise((resolve, reject) => {
            const child = spawn(this.nodeExe, nodeArgs, {
                cwd: this.toolsDir,
                stdio: 'inherit',
                shell: false, // Disable shell for better performance
                windowsHide: false // Ensure proper console output on Windows
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(code);
                } else {
                    reject(new Error(`Process exited with code ${code}`));
                }
            });

            child.on('error', reject);
        });
    }

    displayHeader(title) {
        console.log('╔' + '═'.repeat(title.length + 2) + '╗');
        console.log('║ ' + title + ' ║');
        console.log('╚' + '═'.repeat(title.length + 2) + '╝');
        console.log();
    }

    displaySection(title) {
        console.log('='.repeat(40));
        console.log(`    ${title}`);
        console.log('='.repeat(40));
        console.log();
    }

    ensureDirectories() {
        // Core directories for ServiceNow Tools operation
        const coreDirectories = [
            path.join(this.toolsDir, 'temp_updates'),
            path.join(this.toolsDir, 'backups'), 
            path.join(this.toolsDir, 'local_development'),
            path.join(this.rootDir, 'ServiceNow-Data'),
            path.join(this.rootDir, 'ServiceNow-Data', 'Tenon'),
            path.join(this.rootDir, 'Scripts')
        ];

        coreDirectories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`[Setup] Created directory: ${path.relative(this.rootDir, dir)}`);
                } catch (error) {
                    console.warn(`[Setup] Could not create ${dir}: ${error.message}`);
                }
            }
        });
    }

    async showMainMenu() {
        while (true) {
            this.clearScreen();
            this.displayHeader('ServiceNow Tools - Cross Platform');

            console.log(chalk.gray('━'.repeat(80)));
            console.log(chalk.blue('Platform:'), chalk.cyan(this.platform));
            console.log(chalk.blue('Node:'), chalk.cyan(this.nodeExe));
            console.log(chalk.blue('AI Mode:'), chalk.yellow(this.getAIMode().toUpperCase()));
            console.log(chalk.gray('━'.repeat(80)));
            console.log();

            console.log(chalk.cyan('🔧 Configuration & Testing'));
            console.log('  1. 🔍 Test Connections');
            console.log('  2. ⚙️  Set Configuration');
            console.log();

            console.log(chalk.cyan('📊 Data Operations'));
            console.log('  3. 📥 Fetch Data');
            console.log('  4. ➕ Create Record');
            console.log('  5. ✏️  Update Record');
            console.log('  6. 🔄 Process Updates');
            console.log();

            console.log(chalk.cyan('🚀 Advanced Tools'));
            console.log('  7. ▶️  Run All (Auto-execute everything)');
            console.log('  8. 🛠️  Development Tools');
            console.log('  9. 👁️  File Watcher');
            console.log(' 10. 🤖 AI Mode Configuration');
            console.log();

            console.log(chalk.red('  0. 🚪 Exit'));
            console.log();

            const choice = await this.prompt('Select option: ');

            try {
                switch (choice) {
                    case '1':
                        await this.testConnections();
                        break;
                    case '2':
                        await this.setupConfig();
                        break;
                    case '3':
                        await this.fetchData();
                        break;
                    case '4':
                        await this.createRecord();
                        break;
                    case '5':
                        await this.updateRecord();
                        break;
                    case '6':
                        await this.processUpdates();
                        break;
                    case '7':
                        await this.runAll();
                        break;
                    case '8':
                        await this.showDevMenu();
                        break;
                    case '9':
                        await this.showWatchMenu();
                        break;
                    case '10':
                        await this.configureAIMode();
                        break;
                    case '0':
                        console.log('Goodbye!');
                        return;
                    default:
                        console.log('Invalid selection.');
                        await this.pauseForKey();
                }
            } catch (error) {
                console.error('Error:', error.message);
                await this.pauseForKey();
            }
        }
    }

    async runAll() {
        this.displaySection('Running All Operations');
        await this.runNode('sn-auto-execute.js');
        await this.pauseForKey();
    }

    async showDevMenu() {
        while (true) {
            this.clearScreen();
            this.displayHeader('ServiceNow Development Tools');

            console.log(chalk.gray('━'.repeat(80)));
            console.log(chalk.yellow('🛠️  Advanced tools for ServiceNow development and analysis'));
            console.log(chalk.gray('━'.repeat(80)));
            console.log();

            console.log(chalk.cyan('📊 Analysis & Reporting'));
            console.log('  1. 🔗 Dependency Analysis');
            console.log('  2. 💥 Impact Analysis');
            console.log('  3. 📝 Generate Context Summary');
            console.log('  4. 📋 Development Session Report');
            console.log();

            console.log(chalk.cyan('🔍 Debugging & Tracing'));
            console.log('  5. 🧩 Component Tracing');
            console.log('  6. 🌊 Flow Tracing');
            console.log();

            console.log(chalk.gray('  0. ← Back to Main Menu'));
            console.log();

            const choice = await this.prompt('Select option: ');

            try {
                switch (choice) {
                    case '1':
                        await this.dependencyMenu();
                        break;
                    case '2':
                        await this.impactAnalysis();
                        break;
                    case '3':
                        await this.generateContext();
                        break;
                    case '4':
                        await this.sessionReport();
                        break;
                    case '5':
                        await this.componentTrace();
                        break;
                    case '6':
                        await this.flowTrace();
                        break;
                    case '0':
                        return;
                    default:
                        console.log('Invalid selection.');
                        await this.pauseForKey();
                }
            } catch (error) {
                console.error('Error:', error.message);
                await this.pauseForKey();
            }
        }
    }

    async showWatchMenu() {
        this.clearScreen();
        this.displaySection('File Watcher');

        console.log(chalk.gray('━'.repeat(80)));
        console.log(chalk.yellow('👁️  Monitor files for changes and sync with ServiceNow'));
        console.log(chalk.gray('━'.repeat(80)));
        console.log();

        console.log(chalk.cyan('Select Watcher Mode:'));
        console.log();
        console.log('  1. 👁️  Watch Only (manual sync)');
        console.log(chalk.gray('     → Detects changes but requires manual approval'));
        console.log();
        console.log('  2. ⚡ Watch & Auto-Update');
        console.log(chalk.gray('     → Automatically syncs changes to ServiceNow'));
        console.log();
        console.log(chalk.gray('  0. ← Back to Main Menu'));
        console.log();

        const choice = await this.prompt('Select mode: ');

        if (choice === '1') {
            console.log(chalk.blue('\n👁️  Starting file watcher (manual mode)...'));
            console.log(chalk.gray('Changes will be detected but require manual approval\n'));
            await this.runNode('sn-file-watcher.js', ['watch']);
        } else if (choice === '2') {
            console.log(chalk.blue('\n⚡ Starting file watcher (auto-update mode)...'));
            console.log(chalk.yellow('⚠️  Warning: Changes will be automatically synced to ServiceNow\n'));
            await this.runNode('sn-file-watcher.js', ['watch', '--auto-update']);
        } else if (choice === '0') {
            return; // Back to main menu
        } else {
            console.log(chalk.red('Invalid choice.'));
            await this.pauseForKey();
        }
    }

    async dependencyMenu() {
        while (true) {
            this.clearScreen();
            this.displaySection('Dependency Analysis');

            console.log(chalk.gray('━'.repeat(80)));
            console.log(chalk.yellow('🔗 Analyze dependencies between Script Includes and other components'));
            console.log(chalk.gray('━'.repeat(80)));
            console.log();

            console.log('  1. 🔍 Full Scan (scan entire codebase)');
            console.log('  2. 📊 View Dependency Graph');
            console.log('  3. 🔎 Find Dependencies for Item');
            console.log();
            console.log(chalk.gray('  0. ← Back to Development Tools'));
            console.log();

            const choice = await this.prompt('Select option: ');

            try {
                if (choice === '1') {
                    console.log(chalk.blue('\n🔍 Starting full dependency scan...\n'));
                    await this.runNode('sn-dependency-tracker.js', ['scan']);
                    await this.pauseForKey();
                } else if (choice === '2') {
                    console.log(chalk.blue('\n📊 Generating dependency graph...\n'));
                    await this.runNode('sn-dependency-tracker.js', ['graph']);
                    await this.pauseForKey();
                } else if (choice === '3') {
                    const item = await this.prompt('Enter item name: ');
                    if (item.trim()) {
                        console.log(chalk.blue(`\n🔎 Finding dependencies for: ${item.trim()}\n`));
                        await this.runNode('sn-dependency-tracker.js', ['depends-on', item.trim()]);
                    }
                    await this.pauseForKey();
                } else if (choice === '0') {
                    return; // Back to dev menu
                } else {
                    console.log(chalk.red('Invalid selection.'));
                    await this.pauseForKey();
                }
            } catch (error) {
                console.error(chalk.red('Error:'), error.message);
                await this.pauseForKey();
            }
        }
    }

    async impactAnalysis() {
        this.displaySection('Impact Analysis');
        const scriptName = await this.prompt('Enter Script Include name to analyze: ');
        
        if (scriptName.trim()) {
            await this.runNode('sn-dependency-tracker.js', ['impact', scriptName.trim()]);
        } else {
            console.log('No name provided.');
        }
        
        await this.pauseForKey();
    }

    async generateContext() {
        this.displaySection('Generate Context Summary');
        await this.runNode('sn-claude-helper.js', ['summary']);
        console.log('\nContext summary generated: claude-summary.md');
        console.log('This helps Claude understand your current development state.');
        await this.pauseForKey();
    }

    async sessionReport() {
        this.displaySection('Development Session Report');
        await this.runNode('sn-claude-helper.js', ['report']);
        console.log('\nSession report generated: session-report.json');
        await this.pauseForKey();
    }

    async componentTrace() {
        this.displaySection('Component Tracing');
        const component = await this.prompt('Enter component name to trace: ');
        
        if (component.trim()) {
            await this.runNode('sn-flow-tracer.js', ['component', component.trim()]);
        }
        
        await this.pauseForKey();
    }

    async flowTrace() {
        this.displaySection('Flow Tracing');
        const flow = await this.prompt('Enter flow name to trace: ');
        
        if (flow.trim()) {
            await this.runNode('sn-flow-tracer.js', ['flow', flow.trim()]);
        }
        
        await this.pauseForKey();
    }

    async fetchData() {
        this.displaySection('Fetch Data');
        await this.runNode('sn-operations.js', ['fetch-data']);
        await this.pauseForKey();
    }

    async processUpdates() {
        this.displaySection('Process Updates Only');
        await this.runNode('sn-operations.js', ['process-updates']);
        await this.pauseForKey();
    }

    async createRecord() {
        this.displaySection('Create ServiceNow Record');

        console.log(chalk.cyan('Select table type:'));
        console.log('  1. 📜 Script Include (sys_script_include)');
        console.log('  2. 🌐 REST API (sys_ws_operation)');
        console.log('  3. ⚙️  Business Rule (sys_script)');
        console.log('  4. 🔘 UI Action (sys_ui_action)');
        console.log('  5. 💻 Client Script (sys_script_client)');
        console.log('  6. 📋 Custom table (enter table name)');
        console.log();
        console.log(chalk.gray('  0. ← Back to Main Menu'));
        console.log();

        const tableChoice = await this.prompt('Enter choice (0-6): ');
        let table = '';

        switch(tableChoice.trim()) {
            case '0':
                return; // Back to main menu
            case '1': table = 'sys_script_include'; break;
            case '2': table = 'sys_ws_operation'; break;
            case '3': table = 'sys_script'; break;
            case '4': table = 'sys_ui_action'; break;
            case '5': table = 'sys_script_client'; break;
            case '6':
                table = await this.prompt('Enter table name: ');
                table = table.trim(); // Ensure table name is trimmed
                if (!table) {
                    console.log(chalk.yellow('No table name provided.'));
                    await this.pauseForKey();
                    return;
                }
                break;
            default:
                console.log(chalk.red('Invalid selection.'));
                await this.pauseForKey();
                return;
        }

        console.log();
        console.log(chalk.cyan('How do you want to provide the data?'));
        console.log('  1. 📄 From JSON file');
        console.log('  2. ✨ Auto-discover fields and prompt (Enhanced Mode)');
        console.log('  3. 🤖 AI assistance (describe what you want to create)');
        console.log();
        console.log(chalk.gray('  0. ← Back'));
        console.log();

        const dataChoice = await this.prompt('Enter choice (0-3): ');

        if (dataChoice === '0') {
            return; // Back to main menu
        } else if (dataChoice === '1') {
            const jsonFile = await this.prompt('Enter path to JSON file: ');
            if (jsonFile.trim()) {
                await this.runNode('sn-operations.js', ['create', '--table', table, '--data', jsonFile.trim()]);
            } else {
                console.log(chalk.yellow('No file path provided.'));
            }
        } else if (dataChoice === '2') {
            // Use enhanced record creator - no data provided triggers auto-discovery
            console.log();
            console.log(chalk.blue('🔧 Starting Enhanced Record Creator...'));
            console.log(chalk.gray('This will automatically discover all fields for the table and guide you through creation.'));
            console.log();

            await this.runNode('sn-operations.js', ['create', '--table', table]);
        } else if (dataChoice === '3') {
            const useAI = await this.promptForAIAssistance('record creation');

            if (useAI) {
                console.log();
                console.log('AI Assistance Mode');
                console.log('================');

                console.log('Choose prompt creation method:');
                console.log('1. Quick prompt (enter description directly)');
                console.log('2. Guided prompt builder (step-by-step questions)');
                console.log();

                const promptChoice = await this.prompt('Enter choice (1-2): ');

                let aiPrompt = '';

                if (promptChoice === '1') {
                    console.log();
                    console.log('Describe what you want to create, and AI will generate the appropriate field values.');
                    console.log('Example: "Create a script include that validates email addresses"');
                    console.log();

                    aiPrompt = await this.prompt('Describe what you want to create: ');
                } else if (promptChoice === '2') {
                    console.log();
                    console.log('🎯 Guided AI Prompt Builder');
                    console.log('==========================');
                    console.log('I\'ll ask you a few questions to create an effective AI prompt.');
                    console.log();

                    const functionality = await this.prompt('What type of functionality do you want to create? ');
                    const purpose = await this.prompt('What should this component do? ');
                    const requirements = await this.prompt('Any specific requirements or constraints? (optional) ');
                    const name = await this.prompt('What should it be named? (optional) ');

                    const parts = [functionality, purpose];
                    if (requirements.trim()) parts.push(requirements);
                    if (name.trim()) parts.push(`Call it "${name}"`);

                    aiPrompt = `Create a ${table.replace('sys_', '')} that ${parts.join('. ')}.`;

                    console.log();
                    console.log('Generated AI Prompt:');
                    console.log(`"${aiPrompt}"`);
                    console.log();
                } else {
                    console.log('Invalid choice.');
                    await this.pauseForKey();
                    return;
                }

                if (aiPrompt.trim()) {
                    await this.runNode('sn-operations.js', ['create', '--table', table, '--ai-prompt', aiPrompt.trim(), '--ai-mode', this.getAIMode()]);
                } else {
                    console.log('No description provided.');
                }
            } else {
                console.log();
                console.log('🔧 Starting Enhanced Record Creator...');
                console.log('This will automatically discover all fields for the table and guide you through creation.');
                console.log();

                await this.runNode('sn-operations.js', ['create', '--table', table, '--ai-mode', this.getAIMode()]);
            }
        } else {
            console.log('Invalid choice.');
        }

        await this.pauseForKey();
    }

    async testConnections() {
        this.displaySection('Connection Test');
        await this.runNode('sn-operations.js', ['test']);
        await this.pauseForKey();
    }

    async updateRecord() {
        this.displaySection('Update ServiceNow Record');

        console.log(chalk.cyan('Select table type:'));
        console.log('  1. 📜 Script Include (sys_script_include)');
        console.log('  2. 🌐 REST API (sys_ws_operation)');
        console.log('  3. ⚙️  Business Rule (sys_script)');
        console.log('  4. 🔘 UI Action (sys_ui_action)');
        console.log('  5. 💻 Client Script (sys_script_client)');
        console.log('  6. 📋 Custom table (enter table name)');
        console.log('  7. ✨ Enhanced Update (search by name, select fields)');
        console.log();
        console.log(chalk.gray('  0. ← Back to Main Menu'));
        console.log();

        const tableChoice = await this.prompt('Enter choice (0-7): ');
        let table = '';

        switch(tableChoice.trim()) {
            case '0':
                return; // Back to main menu
            case '7':
                // Use enhanced update flow from sn-operations.js
                console.log(chalk.blue('\n✨ Starting Enhanced Record Update...\n'));
                await this.runNode('sn-operations.js', ['interactive']);
                await this.pauseForKey();
                return;
            case '1': table = 'sys_script_include'; break;
            case '2': table = 'sys_ws_operation'; break;
            case '3': table = 'sys_script'; break;
            case '4': table = 'sys_ui_action'; break;
            case '5': table = 'sys_script_client'; break;
            case '6':
                table = await this.prompt('Enter table name: ');
                table = table.trim(); // Ensure table name is trimmed
                if (!table) {
                    console.log(chalk.yellow('No table name provided.'));
                    await this.pauseForKey();
                    return;
                }
                break;
            default:
                console.log(chalk.red('Invalid selection.'));
                await this.pauseForKey();
                return;
        }

        console.log();
        const recordId = await this.prompt('Enter the sys_id of the record to update (or 0 to go back): ');

        if (recordId.trim() === '0') {
            return; // Back to main menu
        }

        if (!recordId.trim()) {
            console.log(chalk.yellow('No record ID provided.'));
            await this.pauseForKey();
            return;
        }

        console.log();
        console.log(chalk.cyan('How do you want to provide the update data?'));
        console.log('  1. 📄 From JSON file');
        console.log('  2. ⌨️  Enter field values manually');
        console.log('  3. 🤖 AI assistance (describe what you want to update)');
        console.log();
        console.log(chalk.gray('  0. ← Back'));
        console.log();

        const dataChoice = await this.prompt('Enter choice (0-3): ');

        if (dataChoice === '0') {
            return; // Back to main menu
        } else if (dataChoice === '1') {
            const jsonFile = await this.prompt('Enter path to JSON file: ');
            if (jsonFile.trim()) {
                await this.runNode('sn-operations.js', ['update', '--table', table, '--sys_id', recordId.trim(), '--data', jsonFile.trim()]);
            } else {
                console.log(chalk.yellow('No file path provided.'));
            }
        } else if (dataChoice === '2') {
            console.log();
            console.log('Enter field values to update (press Enter without value to finish):');
            const args = ['update', '--table', table, '--id', recordId.trim()];

            while (true) {
                const fieldName = await this.prompt('Field name (or press Enter to finish): ');
                if (!fieldName.trim()) break;

                const fieldValue = await this.prompt(`New value for ${fieldName}: `);
                args.push('--field', fieldName, '--value', fieldValue);
            }

            if (args.length > 4) {
                await this.runNode('sn-operations.js', args);
            } else {
                console.log('No fields provided.');
            }
        } else if (dataChoice === '3') {
            const useAI = await this.promptForAIAssistance('record update');

            if (useAI) {
                console.log();
                console.log('AI Assistance Mode');
                console.log('================');

                console.log('Choose prompt creation method:');
                console.log('1. Quick prompt (enter description directly)');
                console.log('2. Guided prompt builder (step-by-step questions)');
                console.log();

                const promptChoice = await this.prompt('Enter choice (1-2): ');

                let aiPrompt = '';

                if (promptChoice === '1') {
                    console.log();
                    console.log('Describe what you want to update, and AI will generate the appropriate field values.');
                    console.log('Example: "Update the script to add error handling and logging"');
                    console.log();

                    aiPrompt = await this.prompt('Describe what you want to update: ');
                } else if (promptChoice === '2') {
                    console.log();
                    console.log('🎯 Guided AI Prompt Builder');
                    console.log('==========================');
                    console.log('I\'ll ask you a few questions to create an effective AI prompt.');
                    console.log();

                    const updateType = await this.prompt('What type of update do you want to make? ');
                    const purpose = await this.prompt('What should this update accomplish? ');
                    const requirements = await this.prompt('Any specific requirements or constraints? (optional) ');

                    const parts = [updateType, purpose];
                    if (requirements.trim()) parts.push(requirements);

                    aiPrompt = `Update the ${table.replace('sys_', '')} to ${parts.join('. ')}.`;

                    console.log();
                    console.log('Generated AI Prompt:');
                    console.log(`"${aiPrompt}"`);
                    console.log();
                } else {
                    console.log('Invalid choice.');
                    await this.pauseForKey();
                    return;
                }

                if (aiPrompt.trim()) {
                    await this.runNode('sn-operations.js', ['update', '--table', table, '--id', recordId.trim(), '--ai-prompt', aiPrompt.trim(), '--ai-mode', this.getAIMode()]);
                } else {
                    console.log('No description provided.');
                }
            } else {
                console.log();
                console.log('Manual Mode - Enter field values manually.');
                console.log('Enter field values to update (press Enter without value to finish):');
                const args = ['update', '--table', table, '--id', recordId.trim(), '--ai-mode', this.getAIMode()];

                while (true) {
                    const fieldName = await this.prompt('Field name (or press Enter to finish): ');
                    if (!fieldName.trim()) break;

                    const fieldValue = await this.prompt(`New value for ${fieldName}: `);
                    args.push('--field', fieldName, '--value', fieldValue);
                }

                if (args.length > 5) {
                    await this.runNode('sn-operations.js', args);
                } else {
                    console.log('No fields provided.');
                }
            }
        } else {
            console.log('Invalid choice.');
        }

        await this.pauseForKey();
    }

    async setupConfig() {
        this.displaySection('Configuration Setup');

        const configPath = path.join(this.toolsDir, 'sn-config.json');
        const examplePath = path.join(this.toolsDir, 'sn-config.example.json');

        if (fs.existsSync(configPath)) {
            console.log('Configuration exists. You can edit it manually at:');
            console.log(configPath);
        } else {
            console.log('Creating new configuration...');
            if (fs.existsSync(examplePath)) {
                fs.copyFileSync(examplePath, configPath);
                console.log('Configuration template created at:');
                console.log(configPath);
                console.log('Please edit this file with your ServiceNow instance details.');
            } else {
                console.log('Failed to find configuration template.');
                console.log('Please create sn-config.json manually in:', this.toolsDir);
            }
        }

        await this.pauseForKey();
    }

    async configureAIMode() {
        this.clearScreen();
        this.displayHeader('AI Integration Workflow Configuration');

        const currentMode = this.getAIMode();
        console.log(`Current AI Mode: ${currentMode.toUpperCase()}`);
        console.log();

        console.log('Available AI Modes:');
        console.log();
        console.log('1. Auto AI Mode');
        console.log('   - AI automatically handles all functionality');
        console.log('   - Includes creating features, updating code, tracing, debugging');
        console.log('   - Provides continuous feedback through CLI');
        console.log();
        console.log('2. Manual Mode (No AI)');
        console.log('   - No AI assistance used during operations');
        console.log('   - User manually provides all information');
        console.log('   - User fills out all fields for feature requests');
        console.log();
        console.log('3. Interactive Mode (Ask Each Step)');
        console.log('   - System prompts user at each development step');
        console.log('   - Flexible choice of AI assistance per operation');
        console.log('   - Maintains control throughout the process');
        console.log();

        console.log('Select new AI mode:');
        console.log('1. Auto AI Mode');
        console.log('2. Manual Mode');
        console.log('3. Interactive Mode');
        console.log('0. Back to Main Menu');
        console.log();

        const choice = await this.prompt('Enter choice (0-3): ');

        let newMode = null;
        switch(choice) {
            case '1':
                newMode = 'auto';
                break;
            case '2':
                newMode = 'manual';
                break;
            case '3':
                newMode = 'interactive';
                break;
            case '0':
                return;
            default:
                console.log('Invalid selection.');
                await this.pauseForKey();
                return;
        }

        if (newMode && newMode !== currentMode) {
            if (this.setAIMode(newMode)) {
                console.log();
                console.log(`✓ AI mode changed from '${currentMode}' to '${newMode}'`);
                console.log('The new mode will take effect for all operations.');

                if (newMode === 'auto') {
                    console.log();
                    console.log('⚠️  Auto mode enables full AI automation.');
                    console.log('   AI will handle feature creation, code updates, and analysis.');
                } else if (newMode === 'interactive') {
                    console.log();
                    console.log('💡 Interactive mode will prompt you at each step.');
                    console.log('   You can choose AI assistance or manual input per operation.');
                }
            } else {
                console.log();
                console.log('❌ Failed to save AI mode configuration.');
            }
        } else if (newMode === currentMode) {
            console.log();
            console.log(`AI mode is already set to '${currentMode}'.`);
        }

        await this.pauseForKey();
    }
}

// Handle command line arguments
if (require.main === module) {
    const launcher = new SNLauncher();
    
    // Check for direct command execution
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        // Direct command execution
        const command = args[0];
        const commandArgs = args.slice(1);
        
        switch (command) {
            case 'auto-execute':
                launcher.runNode('sn-auto-execute.js', commandArgs)
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case 'dev':
                launcher.showDevMenu()
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case 'setup':
                launcher.setupConfig()
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case 'watch':
                launcher.runNode('sn-file-watcher.js', ['watch', ...commandArgs])
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case 'fetch':
                launcher.runNode('sn-operations.js', ['fetch-data', ...commandArgs])
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case 'update':
                launcher.runNode('sn-operations.js', ['process-updates', ...commandArgs])
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case 'test':
                launcher.runNode('sn-operations.js', ['test', ...commandArgs])
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case '--skip-to-fetch':
                // Run fetch data and then show main menu
                launcher.fetchData()
                    .then(() => launcher.showMainMenu())
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case '--skip-to-stories':
                // Run fetch stories and then show main menu
                launcher.runNode('sn-operations.js', ['fetch-stories'])
                    .then(() => launcher.pauseForKey())
                    .then(() => launcher.showMainMenu())
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case '--skip-to-updates':
                // Run process updates and then show main menu
                launcher.processUpdates()
                    .then(() => launcher.showMainMenu())
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            case '--skip-to-test':
                // Run test connections and then show main menu
                launcher.testConnections()
                    .then(() => launcher.showMainMenu())
                    .then(() => process.exit(0))
                    .catch((err) => {
                        console.error('Error:', err.message);
                        process.exit(1);
                    });
                break;
            default:
                console.log(`Unknown command: ${command}`);
                console.log('Available commands: auto-execute, dev, setup, watch, fetch, update, test, --skip-to-fetch, --skip-to-stories, --skip-to-updates, --skip-to-test');
                process.exit(1);
        }
    } else {
        // Interactive mode
        launcher.showMainMenu()
            .then(() => process.exit(0))
            .catch((err) => {
                console.error('Error:', err.message);
                process.exit(1);
            });
    }
}

module.exports = SNLauncher;