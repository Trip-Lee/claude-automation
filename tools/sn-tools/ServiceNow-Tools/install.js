#!/usr/bin/env node

/**
 * ServiceNow Tools v2.1.0 Installer
 * Automated setup and configuration with enhanced error handling
 * Features: AI Integration, Multi-Instance Support, Advanced Automation
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ServiceNowToolsInstaller {
    constructor() {
        this.rootDir = __dirname;
        this.configPath = path.join(this.rootDir, 'sn-config.json');
        this.packagePath = path.join(this.rootDir, 'package.json');
        this.nodeModulesPath = path.join(this.rootDir, 'node_modules');
    }

    /**
     * Main installation process
     */
    async install() {
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║             ServiceNow Tools v2.1.0 Installer            ║');
        console.log('║    Professional Development Toolkit with AI Integration   ║');
        console.log('║          Enhanced Error Handling & File Operations       ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('');

        try {
            // Step 1: Check prerequisites
            await this.checkPrerequisites();

            // Step 2: Install dependencies
            await this.installDependencies();

            // Step 3: Setup directories
            await this.setupDirectories();

            // Step 4: Configuration
            await this.setupConfiguration();

            // Step 5: Verify installation
            await this.verifyInstallation();

            // Step 6: Final instructions
            this.showCompletionMessage();

        } catch (error) {
            console.error('❌ Installation failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Check system prerequisites
     */
    async checkPrerequisites() {
        console.log('🔍 Checking prerequisites...');

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

        if (majorVersion < 12) {
            throw new Error(`Node.js 12.0.0 or higher required. Current version: ${nodeVersion}`);
        }

        console.log(`✅ Node.js ${nodeVersion} - Compatible`);

        // Check if we have package.json
        if (!fs.existsSync(this.packagePath)) {
            throw new Error('package.json not found. This may not be a valid ServiceNow Tools installation.');
        }

        const packageInfo = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        console.log(`✅ ServiceNow Tools ${packageInfo.version} - Ready to install`);

        // Check write permissions
        try {
            const testFile = path.join(this.rootDir, '.install-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('✅ Write permissions - OK');
        } catch (error) {
            throw new Error('Insufficient write permissions in installation directory');
        }

        console.log('');
    }

    /**
     * Install NPM dependencies
     */
    async installDependencies() {
        console.log('📦 Installing dependencies...');

        // Check if we're being called from npm install to prevent recursion
        if (process.env.npm_lifecycle_event === 'install') {
            console.log('✅ Running from npm install - dependencies handled automatically');
            return;
        }

        // Check if already installed
        if (fs.existsSync(this.nodeModulesPath)) {
            console.log('📦 Dependencies already installed, checking for updates...');
        }

        try {
            await this.runCommand('npm', ['install', '--no-scripts'], {
                cwd: this.rootDir,
                stdio: 'inherit'
            });

            console.log('✅ Core dependencies installed');

            // Try to install optional Claude dependency
            try {
                console.log('📦 Installing optional Claude AI dependency...');
                await this.runCommand('npm', ['install', '@anthropic/sdk@^0.24.3'], {
                    cwd: this.rootDir,
                    stdio: 'pipe' // Silent for optional dependency
                });
                console.log('✅ Claude AI dependency installed (optional)');
            } catch (error) {
                console.log('⚠️  Claude AI dependency skipped (optional) - install manually if needed');
            }

        } catch (error) {
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }

        console.log('');
    }

    /**
     * Setup required directories
     */
    async setupDirectories() {
        console.log('📁 Setting up directories...');

        const directories = [
            'temp_updates',
            'temp_updates/processed',
            'backups',
            'local_development',
            'local_development/script_includes',
            'local_development/rest_apis',
            'local_development/business_rules',
            'local_development/ui_actions',
            'local_development/client_scripts',
            'dependency-graphs'
        ];

        for (const dir of directories) {
            const fullPath = path.join(this.rootDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`✅ Created: ${dir}/`);
            } else {
                console.log(`✓ Exists: ${dir}/`);
            }
        }

        // Set executable permissions on Unix systems
        await this.setExecutablePermissions();

        console.log('');
    }

    /**
     * Set executable permissions on shell scripts for Unix systems
     */
    async setExecutablePermissions() {
        // Only needed on Unix systems (Mac/Linux)
        if (process.platform === 'win32') {
            return;
        }

        console.log('🔧 Setting executable permissions on shell scripts...');

        const shellScripts = [
            // Root level scripts
            '../sn-tools.sh',
            '../sn-dev.sh',
            '../sn-setup.sh',
            // Scripts directory
            '../Scripts/sn-tools.sh',
            '../Scripts/sn-dev.sh',
            '../Scripts/sn-setup.sh',
            '../Scripts/sn-fetch-all.sh',
            '../Scripts/sn-watch.sh',
            // ServiceNow-Tools directory
            'sn-fetch.sh',
            'sn-test.sh',
            'sn-watch.sh'
        ];

        for (const script of shellScripts) {
            const scriptPath = path.join(this.rootDir, script);
            if (fs.existsSync(scriptPath)) {
                try {
                    fs.chmodSync(scriptPath, '755');
                    console.log(`✅ Made executable: ${script}`);
                } catch (error) {
                    console.log(`⚠️  Could not set permissions on ${script}: ${error.message}`);
                }
            } else {
                console.log(`✓ Not found (skipped): ${script}`);
            }
        }
    }

    /**
     * Setup configuration
     */
    async setupConfiguration() {
        console.log('⚙️  Setting up configuration...');

        if (fs.existsSync(this.configPath)) {
            console.log('✓ Configuration file already exists: sn-config.json');

            // Validate existing config
            try {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));

                // Check if it needs Claude configuration update
                if (!config.claude) {
                    console.log('📝 Updating configuration with Claude AI settings...');
                    config.claude = {
                        "enabled": false,
                        "apiKey": "",
                        "model": "claude-3-sonnet-20240229",
                        "baseUrl": "https://api.anthropic.com",
                        "autoAnalysis": {
                            "onFileChange": false,
                            "onDataFetch": false,
                            "onError": true,
                            "onDependencyChange": false
                        },
                        "features": {
                            "codeReview": true,
                            "errorAnalysis": true,
                            "dependencyImpact": true,
                            "optimizationSuggestions": true,
                            "documentationGeneration": false
                        },
                        "safety": {
                            "requireApproval": true,
                            "maxApiCallsPerHour": 50,
                            "emergencyDisable": false,
                            "restrictedOperations": ["update", "create", "delete"]
                        },
                        "contextLimits": {
                            "maxTokens": 100000,
                            "maxFileSize": 50000,
                            "includeHistory": true,
                            "historyLength": 10
                        }
                    };

                    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
                    console.log('✅ Configuration updated with Claude AI support');
                }

                console.log('✅ Configuration validated');
            } catch (error) {
                console.log('⚠️  Configuration file exists but may have issues:', error.message);
            }
        } else {
            console.log('📝 Creating example configuration...');
            await this.createExampleConfig();
            console.log('✅ Example configuration created: sn-config.json');
            console.log('⚠️  Please edit sn-config.json with your ServiceNow instance details');
        }

        console.log('');
    }

    /**
     * Create example configuration
     */
    async createExampleConfig() {
        const exampleConfig = {
            "instances": {
                "dev": {
                    "instance": "dev123456.service-now.com",
                    "username": "your-dev-username",
                    "password": "your-dev-password"
                },
                "prod": {
                    "instance": "prod123456.service-now.com",
                    "username": "your-prod-username",
                    "password": "your-prod-password"
                }
            },
            "stories": {
                "instance": "prod",
                "table": "rm_story",
                "query": "active=true^assigned_toISNOTEMPTY^state!=6",
                "fields": null
            },
            "tables": {
                "sys_script_include": {
                    "instance": "dev",
                    "query": "active=true^sys_scope.nameLIKEyourproject",
                    "fields": null
                },
                "sys_ws_operation": {
                    "instance": "dev",
                    "query": "active=true^sys_scope.nameLIKEyourproject",
                    "fields": null
                },
                "sys_script": {
                    "instance": "dev",
                    "query": "active=true^sys_scope.nameLIKEyourproject",
                    "fields": null
                },
                "sys_ui_action": {
                    "instance": "dev",
                    "query": "active=true^sys_scope.nameLIKEyourproject",
                    "fields": null
                },
                "sys_script_client": {
                    "instance": "dev",
                    "query": "active=true^sys_scope.nameLIKEyourproject",
                    "fields": null
                },
                "sys_db_object": {
                    "instance": "dev",
                    "query": "sys_scope.nameLIKEyourproject^ORsys_scope.name=global",
                    "fields": null
                },
                "sys_dictionary": {
                    "instance": "dev",
                    "query": "sys_scope.nameLIKEyourproject^ORsys_scope.name=global",
                    "fields": null
                }
            },
            "paths": {
                "outputBase": "../ServiceNow-Data",
                "dataSubdir": "Data",
                "autoDetect": true,
                "fallbackPaths": ["./ServiceNow-Data", "../Data"],
                "componentRepoName": "Component Repo",
                "componentDirectories": ["Sashimono", "component-library"]
            },
            "project": {
                "name": "MyProject",
                "scopePrefix": "x_custom",
                "companyName": "MyCompany"
            },
            "settings": {
                "autoBackup": true,
                "validateUpdates": true,
                "autoFetchData": true,
                "autoFetchStories": true,
                "fetchAllFields": true,
                "deleteBeforeFetch": false,
                "dataFetcherPath": "./SN-DataFetcher",
                "storyFetcherPath": "./SN-StoryFetcher",
                "sync": {
                    "enableIncremental": true,
                    "cleanupDeleted": true,
                    "fullSyncInterval": 7
                }
            },
            "claude": {
                "enabled": false,
                "apiKey": "",
                "model": "claude-3-sonnet-20240229",
                "baseUrl": "https://api.anthropic.com",
                "autoAnalysis": {
                    "onFileChange": false,
                    "onDataFetch": false,
                    "onError": true,
                    "onDependencyChange": false
                },
                "features": {
                    "codeReview": true,
                    "errorAnalysis": true,
                    "dependencyImpact": true,
                    "optimizationSuggestions": true,
                    "documentationGeneration": false
                },
                "safety": {
                    "requireApproval": true,
                    "maxApiCallsPerHour": 50,
                    "emergencyDisable": false,
                    "restrictedOperations": ["update", "create", "delete"]
                },
                "contextLimits": {
                    "maxTokens": 100000,
                    "maxFileSize": 50000,
                    "includeHistory": true,
                    "historyLength": 10
                }
            },
            "ai": {
                "mode": "manual",
                "description": "AI Integration Workflow Configuration",
                "preferredProvider": "auto-detect",
                "providers": {
                    "claude-code": {
                        "name": "Claude Code",
                        "enabled": true,
                        "detected": false,
                        "command": "claude",
                        "priority": 1,
                        "capabilities": ["code-generation", "analysis", "record-creation", "web-search", "file-operations"],
                        "contextPassing": "stdin",
                        "outputFormat": "markdown"
                    },
                    "chatgpt-cli": {
                        "name": "ChatGPT CLI",
                        "enabled": false,
                        "detected": false,
                        "command": "chatgpt",
                        "priority": 2,
                        "capabilities": ["code-generation", "analysis", "record-creation"],
                        "contextPassing": "args",
                        "outputFormat": "text"
                    }
                },
                "recordCreation": {
                    "enabled": true,
                    "includeContext": true,
                    "includeSchema": true,
                    "includeExamples": true,
                    "timeout": 60000,
                    "maxRetries": 2
                }
            }
        };

        fs.writeFileSync(this.configPath, JSON.stringify(exampleConfig, null, 2));
    }

    /**
     * Verify installation
     */
    async verifyInstallation() {
        console.log('🧪 Verifying installation...');

        // Test core modules
        const coreModules = [
            'servicenow-tools.js',
            'sn-auto-execute.js',
            'sn-operations.js',
            'sn-file-watcher.js',
            'sn-dependency-tracker.js',
            'sn-claude-helper.js',
            'sn-launcher.js',
            'sn-ai-cache.js',
            'sn-autonomous-integration.js',
            'flow-lookup-helper.js'
        ];

        for (const module of coreModules) {
            const modulePath = path.join(this.rootDir, module);
            if (fs.existsSync(modulePath)) {
                console.log(`✅ Module: ${module}`);
            } else {
                console.log(`❌ Missing: ${module}`);
                throw new Error(`Core module missing: ${module}`);
            }
        }

        // Test CLI commands
        try {
            console.log('🧪 Testing CLI commands...');

            // Test basic functionality
            await this.runCommand('node', ['sn-operations.js'], {
                cwd: this.rootDir,
                stdio: 'pipe',
                timeout: 5000
            });
            console.log('✅ CLI commands working');

            // Test AI integration
            await this.runCommand('node', ['test-consolidated-ai.js'], {
                cwd: this.rootDir,
                stdio: 'pipe',
                timeout: 10000
            });
            console.log('✅ AI integration systems ready');

        } catch (error) {
            console.log('⚠️  CLI test completed with minor issues (expected for unconfigured tools)');
        }

        console.log('');
    }

    /**
     * Show completion message
     */
    showCompletionMessage() {
        console.log('🎉 Installation completed successfully!');
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║                    Next Steps                             ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📝 1. Configure your ServiceNow instances:');
        console.log('   Edit sn-config.json with your instance details');
        console.log('');
        console.log('🧪 2. Test your configuration:');
        console.log('   npm run test-connections');
        console.log('');
        console.log('📊 3. Fetch your first data:');
        console.log('   npm run fetch-data');
        console.log('   npm run fetch-stories');
        console.log('');
        console.log('🤖 4. (Optional) Setup AI integration:');
        console.log('   npm run test-consolidated-ai  # Test AI providers');
        console.log('   Edit ai.providers section in sn-config.json');
        console.log('   For Claude: Get API key from https://console.anthropic.com/');
        console.log('');
        console.log('📚 5. Read the documentation:');
        console.log('   Open README.md for complete usage guide');
        console.log('');
        console.log('🚀 Quick commands to get started:');
        console.log('   Windows:');
        console.log('     sn-tools.bat             # Run everything');
        console.log('     Scripts\\sn-dev.bat       # Development tools');
        console.log('     Scripts\\sn-watch.bat     # File watcher');
        console.log('   Unix/Linux/Mac:');
        console.log('     ./sn-tools.sh            # Run everything');
        console.log('     ./Scripts/sn-dev.sh      # Development tools');
        console.log('     ./Scripts/sn-watch.sh    # File watcher');
        console.log('   Cross-platform (npm):');
        console.log('     npm run execute          # Run everything');
        console.log('     npm run watch            # Start file watcher');
        console.log('     npm run dependency-scan  # Analyze dependencies');
        console.log('');
        console.log('💡 For help and troubleshooting:');
        console.log('   - Check README.md for complete documentation');
        console.log('   - Review CLAUDE_INTEGRATION.md for AI features');
        console.log('   - Use node [script].js without arguments to see help');
        console.log('');
        console.log('✨ Welcome to ServiceNow Tools v2.1.0!');
        console.log('   Enhanced error handling & comprehensive AI integration');
    }

    /**
     * Run command with promise
     */
    runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 30000;

            const child = spawn(command, args, {
                stdio: options.stdio || 'inherit',
                cwd: options.cwd || this.rootDir,
                shell: true
            });

            let output = '';
            let errorOutput = '';

            if (options.stdio === 'pipe') {
                child.stdout?.on('data', (data) => {
                    output += data.toString();
                });

                child.stderr?.on('data', (data) => {
                    errorOutput += data.toString();
                });
            }

            const timer = setTimeout(() => {
                child.kill();
                reject(new Error('Command timeout'));
            }, timeout);

            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) {
                    resolve({ code, output, errorOutput });
                } else {
                    reject(new Error(`Command failed with exit code ${code}: ${errorOutput}`));
                }
            });

            child.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
}

// Run installer if executed directly
if (require.main === module) {
    const installer = new ServiceNowToolsInstaller();
    installer.install().catch(error => {
        console.error('Installation failed:', error.message);
        process.exit(1);
    });
}

module.exports = ServiceNowToolsInstaller;