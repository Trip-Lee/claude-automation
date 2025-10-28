#!/usr/bin/env node

/**
 * ServiceNow Tools Setup Wizard
 * Interactive CLI setup for complete configuration
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

class SetupWizard {
    constructor() {
        this.configPath = path.join(__dirname, 'sn-config.json');
        this.config = {};
    }

    /**
     * Check if valid configuration exists
     */
    hasValidConfig() {
        if (!fs.existsSync(this.configPath)) {
            return false;
        }

        try {
            const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));

            // Check for required sections
            const hasInstances = config.instances && Object.keys(config.instances).length > 0;
            const hasRouting = config.routing && config.routing.default;

            // Check at least one instance has required fields
            let hasValidInstance = false;
            if (hasInstances) {
                for (const [name, instance] of Object.entries(config.instances)) {
                    if (instance.instance && instance.username && instance.password) {
                        hasValidInstance = true;
                        break;
                    }
                }
            }

            return hasInstances && hasRouting && hasValidInstance;
        } catch (error) {
            return false;
        }
    }

    /**
     * Run the complete setup wizard
     */
    async runSetup() {
        console.log(chalk.blue('\n🚀 ServiceNow Tools Setup Wizard\n'));
        console.log(chalk.yellow('This wizard will help you configure ServiceNow Tools for your environment.\n'));

        try {
            // Step 1: Project Information
            await this.setupProject();

            // Step 2: ServiceNow Instances
            await this.setupInstances();

            // Step 3: Table Routing
            await this.setupRouting();

            // Step 4: AI Integration (Optional)
            await this.setupAI();

            // Step 5: Advanced Settings (Optional)
            await this.setupAdvanced();

            // Save configuration
            await this.saveConfig();

            console.log(chalk.green('\n✅ Setup completed successfully!'));
            console.log(chalk.blue('You can now run: npm start'));
            console.log(chalk.gray('Configuration saved to: sn-config.json\n'));

        } catch (error) {
            console.error(chalk.red('\n❌ Setup failed:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Step 1: Project Information
     */
    async setupProject() {
        console.log(chalk.blue('📋 Step 1: Project Information\n'));

        const projectAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Project name:',
                default: 'ServiceNow Development Project',
                validate: (input) => input.length > 0 || 'Project name is required'
            },
            {
                type: 'input',
                name: 'scopePrefix',
                message: 'Scope prefix (e.g., x_myapp):',
                default: 'x_custom',
                validate: (input) => {
                    if (!input.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
                        return 'Scope prefix must start with a letter and contain only letters, numbers, and underscores';
                    }
                    return true;
                }
            },
            {
                type: 'input',
                name: 'version',
                message: 'Project version:',
                default: '1.0.0'
            }
        ]);

        this.config.project = projectAnswers;
    }

    /**
     * Step 2: ServiceNow Instances
     */
    async setupInstances() {
        console.log(chalk.blue('\n📋 Step 2: ServiceNow Instances\n'));

        this.config.instances = {};

        // Add at least one instance (required)
        let addMore = true;
        let isFirst = true;

        while (addMore) {
            const instanceType = isFirst ? 'primary' : await this.askInstanceType();

            if (instanceType === 'done') {
                break;
            }

            const instanceConfig = await this.setupSingleInstance(instanceType, isFirst);
            this.config.instances[instanceType] = instanceConfig;

            if (isFirst) {
                // Ask if they want to add more instances
                const { addAnother } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'addAnother',
                        message: 'Add another ServiceNow instance?',
                        default: false
                    }
                ]);
                addMore = addAnother;
                isFirst = false;
            } else {
                // For subsequent instances
                const { continueAdding } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'continueAdding',
                        message: 'Add another instance?',
                        default: false
                    }
                ]);
                addMore = continueAdding;
            }
        }
    }

    async askInstanceType() {
        const existingTypes = Object.keys(this.config.instances);
        const availableTypes = ['dev', 'prod', 'test', 'stage', 'sandbox']
            .filter(type => !existingTypes.includes(type));

        if (availableTypes.length === 0) {
            return 'done';
        }

        const { instanceType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'instanceType',
                message: 'Instance type:',
                choices: [
                    ...availableTypes.map(type => ({
                        name: type.charAt(0).toUpperCase() + type.slice(1),
                        value: type
                    })),
                    { name: 'Custom name', value: 'custom' },
                    { name: 'Done adding instances', value: 'done' }
                ]
            }
        ]);

        if (instanceType === 'custom') {
            const { customName } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'customName',
                    message: 'Custom instance name:',
                    validate: (input) => {
                        if (!input.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
                            return 'Instance name must start with a letter and contain only letters, numbers, and underscores';
                        }
                        if (Object.keys(this.config.instances).includes(input)) {
                            return 'Instance name already exists';
                        }
                        return true;
                    }
                }
            ]);
            return customName;
        }

        return instanceType;
    }

    async setupSingleInstance(instanceType, isFirst) {
        const displayName = instanceType.charAt(0).toUpperCase() + instanceType.slice(1);
        console.log(chalk.yellow(`\n🔧 Configuring ${displayName} Instance:\n`));

        const instanceAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'instance',
                message: 'Instance URL (e.g., mycompany.service-now.com):',
                validate: (input) => {
                    if (!input.includes('.service-now.com') && !input.includes('servicenow.com')) {
                        return 'Please enter a valid ServiceNow instance URL';
                    }
                    return true;
                },
                filter: (input) => input.replace(/^https?:\/\//, '').replace(/\/$/, '')
            },
            {
                type: 'input',
                name: 'username',
                message: 'Username:',
                validate: (input) => input.length > 0 || 'Username is required'
            },
            {
                type: 'password',
                name: 'password',
                message: 'Password:',
                mask: '*',
                validate: (input) => input.length > 0 || 'Password is required'
            }
        ]);

        return instanceAnswers;
    }

    /**
     * Step 3: Table Routing
     */
    async setupRouting() {
        console.log(chalk.blue('\n📋 Step 3: Table Routing\n'));

        const instanceNames = Object.keys(this.config.instances);

        const routingAnswers = await inquirer.prompt([
            {
                type: 'list',
                name: 'default',
                message: 'Default instance for most operations:',
                choices: instanceNames
            },
            {
                type: 'list',
                name: 'stories',
                message: 'Instance for user stories (if different):',
                choices: [
                    ...instanceNames,
                    { name: 'Same as default', value: null }
                ]
            }
        ]);

        this.config.routing = {
            default: routingAnswers.default,
            stories: routingAnswers.stories || routingAnswers.default,
            tables: {}
        };

        // Ask about specific table routing
        const { customTableRouting } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'customTableRouting',
                message: 'Configure custom routing for specific tables?',
                default: false
            }
        ]);

        if (customTableRouting) {
            await this.setupTableRouting(instanceNames);
        }
    }

    async setupTableRouting(instanceNames) {
        console.log(chalk.yellow('\n🔧 Table-Specific Routing:\n'));

        const commonTables = [
            { name: 'Script Includes (sys_script_include)', value: 'sys_script_include' },
            { name: 'Business Rules (sys_script)', value: 'sys_script' },
            { name: 'Client Scripts (sys_script_client)', value: 'sys_script_client' },
            { name: 'UI Actions (sys_ui_action)', value: 'sys_ui_action' },
            { name: 'REST APIs (sys_ws_operation)', value: 'sys_ws_operation' },
            { name: 'User Stories (rm_story)', value: 'rm_story' }
        ];

        for (const table of commonTables) {
            const { route } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'route',
                    message: `Route ${table.name} to:`,
                    choices: [
                        { name: 'Use default routing', value: null },
                        ...instanceNames
                    ]
                }
            ]);

            if (route) {
                this.config.routing.tables[table.value] = route;
            }
        }
    }

    /**
     * Step 4: AI Integration (Optional)
     */
    async setupAI() {
        console.log(chalk.blue('\n📋 Step 4: AI Integration (Optional)\n'));

        const { enableAI } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'enableAI',
                message: 'Enable AI-powered record creation?',
                default: true
            }
        ]);

        if (!enableAI) {
            return;
        }

        const aiAnswers = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'enabledProviders',
                message: 'Select AI providers to enable:',
                choices: [
                    { name: 'Claude Code (Recommended)', value: 'claude-code', checked: true },
                    { name: 'ChatGPT CLI', value: 'chatgpt-cli', checked: false },
                    { name: 'Claude API', value: 'claude-api', checked: false }
                ]
            }
        ]);

        // Configure AI settings
        this.config.ai = {
            enabled: true,
            providers: {
                'claude-code': {
                    name: 'Claude Code',
                    enabled: aiAnswers.enabledProviders.includes('claude-code'),
                    priority: 1,
                    capabilities: ['record-creation', 'code-generation', 'analysis'],
                    command: 'claude'
                },
                'chatgpt-cli': {
                    name: 'ChatGPT CLI',
                    enabled: aiAnswers.enabledProviders.includes('chatgpt-cli'),
                    priority: 2,
                    capabilities: ['record-creation', 'code-generation'],
                    command: 'chatgpt'
                },
                'claude-api': {
                    name: 'Claude API',
                    enabled: aiAnswers.enabledProviders.includes('claude-api'),
                    priority: 3,
                    capabilities: ['record-creation', 'code-generation', 'analysis']
                }
            },
            recordCreation: {
                timeout: 60000,
                retries: 2,
                includeContext: true,
                includeSchema: true
            }
        };

        // Setup Claude API if selected
        if (aiAnswers.enabledProviders.includes('claude-api')) {
            await this.setupClaudeAPI();
        }
    }

    async setupClaudeAPI() {
        console.log(chalk.yellow('\n🔧 Claude API Configuration:\n'));

        const { setupClaudeAPI } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'setupClaudeAPI',
                message: 'Configure Claude API key now?',
                default: false
            }
        ]);

        if (setupClaudeAPI) {
            const claudeAnswers = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'apiKey',
                    message: 'Claude API key:',
                    mask: '*',
                    validate: (input) => {
                        if (!input || input.length < 10) {
                            return 'Please enter a valid Claude API key';
                        }
                        return true;
                    }
                },
                {
                    type: 'list',
                    name: 'model',
                    message: 'Claude model:',
                    choices: [
                        { name: 'Claude 3 Sonnet (Recommended)', value: 'claude-3-sonnet-20240229' },
                        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
                        { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }
                    ],
                    default: 'claude-3-sonnet-20240229'
                }
            ]);

            this.config.claude = {
                enabled: true,
                apiKey: claudeAnswers.apiKey,
                model: claudeAnswers.model,
                maxTokens: 4096,
                timeout: 30000
            };
        }
    }

    /**
     * Step 5: Advanced Settings (Optional)
     */
    async setupAdvanced() {
        console.log(chalk.blue('\n📋 Step 5: Advanced Settings (Optional)\n'));

        const { configureAdvanced } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'configureAdvanced',
                message: 'Configure advanced settings?',
                default: false
            }
        ]);

        if (!configureAdvanced) {
            return;
        }

        const advancedAnswers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'fileWatcher',
                message: 'Enable automatic file watching?',
                default: true
            },
            {
                type: 'confirm',
                name: 'dependencyTracking',
                message: 'Enable dependency tracking?',
                default: true
            },
            {
                type: 'number',
                name: 'requestTimeout',
                message: 'Request timeout (milliseconds):',
                default: 30000,
                validate: (input) => input > 0 || 'Timeout must be greater than 0'
            },
            {
                type: 'number',
                name: 'maxRetries',
                message: 'Maximum retry attempts:',
                default: 3,
                validate: (input) => input >= 0 || 'Retries must be 0 or greater'
            }
        ]);

        this.config.advanced = advancedAnswers;
    }

    /**
     * Save configuration to file
     */
    async saveConfig() {
        try {
            const configJson = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configPath, configJson);
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error.message}`);
        }
    }

    /**
     * Display current configuration summary
     */
    showConfigSummary() {
        console.log(chalk.blue('\n📋 Configuration Summary:\n'));

        // Project info
        console.log(chalk.green('Project:'));
        console.log(`  Name: ${this.config.project.name}`);
        console.log(`  Scope: ${this.config.project.scopePrefix}`);

        // Instances
        console.log(chalk.green('\nInstances:'));
        Object.entries(this.config.instances).forEach(([name, instance]) => {
            console.log(`  ${name}: ${instance.instance} (${instance.username})`);
        });

        // Routing
        console.log(chalk.green('\nRouting:'));
        console.log(`  Default: ${this.config.routing.default}`);
        console.log(`  Stories: ${this.config.routing.stories}`);

        // AI
        if (this.config.ai?.enabled) {
            console.log(chalk.green('\nAI Integration: Enabled'));
            const enabledProviders = Object.entries(this.config.ai.providers)
                .filter(([_, provider]) => provider.enabled)
                .map(([name, _]) => name);
            console.log(`  Providers: ${enabledProviders.join(', ')}`);
        }

        console.log('');
    }
}

// CLI interface
async function main() {
    const wizard = new SetupWizard();

    const args = process.argv.slice(2);
    if (args.includes('--force') || args.includes('-f')) {
        // Force setup even if config exists
        await wizard.runSetup();
    } else if (wizard.hasValidConfig()) {
        console.log(chalk.yellow('⚠️  Valid configuration already exists.'));
        console.log(chalk.blue('Use --force to run setup anyway.\n'));
        process.exit(0);
    } else {
        await wizard.runSetup();
    }
}

if (require.main === module) {
    main();
}

module.exports = SetupWizard;