#!/usr/bin/env node

/**
 * ServiceNow Auto-Execute
 * Config-driven automatic execution of all ServiceNow operations
 * No CLI interface - everything controlled by configuration
 */

const ServiceNowTools = require('./servicenow-tools');
const SetupWizard = require('./sn-setup-wizard');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ServiceNowAutoExecutor {
    constructor() {
        this.configPath = path.join(__dirname, 'sn-config.json');
        this.tools = null;
    }

    async init() {
        // Check if configuration exists and is valid
        const setupWizard = new SetupWizard();

        if (!setupWizard.hasValidConfig()) {
            console.log(chalk.blue('\n🚀 Welcome to ServiceNow Tools!\n'));

            if (!fs.existsSync(this.configPath)) {
                console.log(chalk.yellow('⚙️  No configuration found. Let\'s set up your environment.\n'));
            } else {
                console.log(chalk.yellow('⚙️  Invalid or incomplete configuration found. Let\'s fix it.\n'));
            }

            // Run the setup wizard
            await setupWizard.runSetup();

            console.log(chalk.green('\n✅ Configuration complete! Starting ServiceNow Tools...\n'));
        } else {
            console.log(chalk.green('✅ Configuration valid. Starting ServiceNow Tools...\n'));
        }

        try {
            this.tools = new ServiceNowTools();
            console.log('✓ Configuration loaded successfully');
            console.log('');
        } catch (error) {
            console.error('Failed to initialize:', error.message);
            process.exit(1);
        }
    }

    async execute() {
        await this.init();
        
        let config;
        try {
            config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (error) {
            console.error(`Failed to read configuration: ${error.message}`);
            return;
        }
        
        console.log('╔═══════════════════════════════════════╗');
        console.log('║   ServiceNow Auto-Execute Starting    ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('Configuration Summary:');
        console.log('----------------------');
        console.log(`Instances configured: ${Object.keys(config.instances).join(', ')}`);
        console.log(`Default instance: ${config.routing.default}`);
        console.log(`Stories instance: ${config.routing.stories}`);
        console.log('');
        console.log('Enabled Operations:');
        console.log(`  • Process Updates: ${config.settings?.autoProcessUpdates !== false ? 'Yes' : 'No'}`);
        console.log(`  • Fetch Data: ${config.settings?.autoFetchData !== false ? 'Yes' : 'No'}`);
        console.log(`  • Fetch Stories: ${config.settings?.autoFetchStories !== false ? 'Yes' : 'No'}`);
        console.log(`  • Auto Backup: ${config.settings?.autoBackup !== false ? 'Yes' : 'No'}`);
        console.log(`  • Validate Updates: ${config.settings?.validateUpdates !== false ? 'Yes' : 'No'}`);
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('');

        const startTime = Date.now();
        const results = await this.tools.executeAll();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('');
        console.log('═══════════════════════════════════════');
        console.log(`Execution completed in ${duration} seconds`);
        
        if (results.errors.length === 0) {
            console.log('Status: ✓ All operations successful');
        } else {
            console.log('Status: ⚠ Completed with errors');
        }
        
        return results;
    }

    async setupConfig() {
        console.log('');
        console.log('Creating example configuration file...');
        
        const exampleConfig = {
            instances: {
                dev: {
                    instance: 'dev123456.service-now.com',
                    username: 'your-username',
                    password: 'your-password'
                },
                prod: {
                    instance: 'prod123456.service-now.com', 
                    username: 'your-username',
                    password: 'your-password'
                }
            },
            stories: {
                instance: 'prod',
                table: 'rm_story',
                query: 'active=true^assigned_toISNOTEMPTY^state!=6',
                fields: null  // null = all fields
            },
            tables: {
                sys_script_include: {
                    instance: 'dev',
                    query: 'active=true^nameSTARTSWITHx_cadso',
                    fields: null
                },
                sys_ws_operation: {
                    instance: 'dev',
                    query: 'active=true^web_service_definition.nameSTARTSWITHx_cadso',
                    fields: null
                },
                sys_script: {
                    instance: 'dev',
                    query: 'active=true',
                    fields: null
                },
                sys_ui_action: {
                    instance: 'dev',
                    query: 'active=true^table=x_cadso_tenon_ma^ORtable=x_cadso_tenon_mwm',
                    fields: null
                },
                sys_script_client: {
                    instance: 'dev',
                    query: 'active=true^table=x_cadso_tenon_ma^ORtable=x_cadso_tenon_mwm',
                    fields: null
                }
            },
            settings: {
                autoBackup: true,
                validateAfterUpdate: true,
                fetchAllFields: true,
                dataFetcherPath: './SN-DataFetcher',
                storyFetcherPath: './SN-StoryFetcher',
                sync: {
                    enableIncremental: true,  // Only fetch updated/new records
                    cleanupDeleted: true,    // Remove locally deleted records
                    fullSyncInterval: 7       // Full sync every 7 days
                }
            }
        };

        const configPath = path.join(__dirname, 'sn-config.json');
        try {
            fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));
        } catch (error) {
            console.error(`Could not create configuration file: ${error.message}`);
            return;
        }
        
        console.log('');
        console.log('✓ Created sn-config.json with example configuration');
        console.log('');
        console.log('IMPORTANT: Please edit sn-config.json with your actual:');
        console.log('  - ServiceNow instance URLs');
        console.log('  - Username and password credentials');
        console.log('  - Table queries and routing preferences');
        console.log('');
        console.log('File location: ' + configPath);
        console.log('');
    }
}

// Run immediately when executed
if (require.main === module) {
    const command = process.argv[2] || 'execute';
    const executor = new ServiceNowAutoExecutor();
    
    if (command === 'setup') {
        executor.setupConfig()
            .then(() => {
                console.log('Setup complete! Edit the config file and then run sn-tools.bat');
                process.exit(0);
            })
            .catch(error => {
                console.error('Setup failed:', error.message);
                process.exit(1);
            });
    } else {
        executor.execute()
            .then(results => {
                process.exit(results.errors.length > 0 ? 1 : 0);
            })
            .catch(error => {
                console.error('');
                console.error('═══════════════════════════════════════');
                console.error('FATAL ERROR:', error.message);
                console.error('═══════════════════════════════════════');
                process.exit(1);
            });
    }
}