#!/usr/bin/env node

/**
 * Unified Test Suite for ServiceNow Tools
 * Combines all testing functionality from separate test files
 * Consolidates: test-all-functionality.js, test-consolidated-ai.js, test-cross-platform.js, test-validation.js
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { spawn, execSync } = require('child_process');

class UnifiedTestSuite {
    constructor() {
        this.platform = process.platform;
        this.isWindows = this.platform === 'win32';
        this.toolsDir = path.dirname(__filename);
        this.rootDir = path.dirname(this.toolsDir);

        this.results = {
            configuration: { status: 'pending', tests: [] },
            security: { status: 'pending', tests: [] },
            aiIntegration: { status: 'pending', tests: [] },
            errorHandling: { status: 'pending', tests: [] },
            validation: { status: 'pending', tests: [] },
            fileOperations: { status: 'pending', tests: [] },
            crossPlatform: { status: 'pending', tests: [] },
            overall: 'pending'
        };

        this.testCount = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.detailedResults = [];
    }

    // ===== UTILITY METHODS =====

    addTest(category, name, status, details) {
        this.testCount++;
        if (status === 'pass') this.passedTests++;
        else if (status === 'fail') this.failedTests++;

        const test = { name, status, details, timestamp: new Date().toISOString() };
        this.results[category].tests.push(test);
        this.detailedResults.push({ category, ...test });

        const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
        const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
        console.log(chalk[color](`   ${icon} ${name}: ${details}`));
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    checkFileExists(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
    }

    checkExecutable(filePath) {
        this.checkFileExists(filePath);
        if (!this.isWindows) {
            try {
                const stats = fs.statSync(filePath);
                if (!(stats.mode & fs.constants.S_IXUSR)) {
                    throw new Error(`File is not executable: ${filePath}`);
                }
            } catch (error) {
                throw new Error(`Cannot check executable permissions: ${error.message}`);
            }
        }
    }

    // ===== MAIN TEST RUNNER =====

    async runAllTests(testType = 'all') {
        console.log(chalk.blue('\n🧪 Unified ServiceNow Tools Test Suite\n'));
        console.log(chalk.yellow(`Platform: ${this.platform}`));
        console.log(chalk.yellow(`Test Type: ${testType}\n`));

        try {
            if (testType === 'all' || testType === 'core') {
                await this.testConfigurationSystem();
                await this.testSecurityFeatures();
                await this.testErrorHandling();
                await this.testFileOperations();
            }

            if (testType === 'all' || testType === 'ai') {
                await this.testAIIntegration();
            }

            if (testType === 'all' || testType === 'validation') {
                await this.testInputValidation();
                await this.testFieldValidation();
            }

            if (testType === 'all' || testType === 'platform') {
                await this.testCrossPlatformSupport();
            }

            this.generateFinalReport();

        } catch (error) {
            console.error(chalk.red('Test suite failed:'), error.message);
            this.results.overall = 'failed';
        }
    }

    // ===== CONFIGURATION TESTS =====

    async testConfigurationSystem() {
        console.log(chalk.blue('📋 Testing Configuration System'));

        try {
            // Test unified core module first
            let coreModule;
            try {
                coreModule = require('./sn-core');
                this.addTest('configuration', 'Unified Core Module', 'pass', 'sn-core module loaded successfully');
            } catch (error) {
                this.addTest('configuration', 'Unified Core Module', 'fail', `Failed to load sn-core: ${error.message}`);
            }

            // Test config manager (either standalone or unified)
            try {
                if (coreModule) {
                    const config = coreModule.getConfig();
                    this.addTest('configuration', 'Config Loading', 'pass', 'Configuration loaded via unified core');
                } else {
                    const ConfigManager = require('./sn-config-manager');
                    this.addTest('configuration', 'Config Manager Import', 'pass', 'ConfigManager class loaded');
                }
            } catch (error) {
                this.addTest('configuration', 'Config Loading', 'fail', error.message);
            }

            // Test setup wizard
            try {
                const SetupWizard = require('./sn-setup-wizard');
                const wizard = new SetupWizard();
                const hasValidConfig = wizard.hasValidConfig();
                this.addTest('configuration', 'Setup Wizard', hasValidConfig ? 'pass' : 'warn',
                    hasValidConfig ? 'Valid configuration found' : 'Configuration needs setup');
            } catch (error) {
                this.addTest('configuration', 'Setup Wizard', 'fail', error.message);
            }

            this.results.configuration.status = 'pass';
            console.log(chalk.green('✅ Configuration System - PASS\n'));

        } catch (error) {
            this.results.configuration.status = 'fail';
            console.log(chalk.red('❌ Configuration System - FAIL\n'));
        }
    }

    // ===== SECURITY TESTS =====

    async testSecurityFeatures() {
        console.log(chalk.blue('🔐 Testing Security Features'));

        try {
            // Test credential manager
            let credManager;
            try {
                const coreModule = require('./sn-core');
                credManager = coreModule.getInstance();
                this.addTest('security', 'Unified Credential Manager', 'pass', 'Credential manager loaded from unified core');
            } catch (error) {
                try {
                    const CredentialManager = require('./sn-credential-manager');
                    credManager = new CredentialManager();
                    this.addTest('security', 'Standalone Credential Manager', 'pass', 'Standalone credential manager loaded');
                } catch (standalonError) {
                    this.addTest('security', 'Credential Manager', 'fail', `Failed to load credential manager: ${standalonError.message}`);
                }
            }

            // Test encryption
            if (credManager) {
                try {
                    const testSuccess = credManager.testEncryption();
                    this.addTest('security', 'Encryption Test', testSuccess ? 'pass' : 'fail',
                        testSuccess ? 'Encryption/decryption works correctly' : 'Encryption test failed');
                } catch (error) {
                    this.addTest('security', 'Encryption Test', 'fail', error.message);
                }
            }

            // Test key management
            try {
                const keyFile = path.join(__dirname, '.sn-key');
                const envKey = process.env.SN_TOOLS_KEY;

                if (envKey) {
                    this.addTest('security', 'Key Management', 'pass', 'Environment variable key detected (most secure)');
                } else if (fs.existsSync(keyFile)) {
                    this.addTest('security', 'Key Management', 'warn', 'File-based key detected (consider using environment variable)');
                } else {
                    this.addTest('security', 'Key Management', 'warn', 'No existing key found (will be generated)');
                }
            } catch (error) {
                this.addTest('security', 'Key Management', 'fail', error.message);
            }

            this.results.security.status = 'pass';
            console.log(chalk.green('✅ Security Features - PASS\n'));

        } catch (error) {
            this.results.security.status = 'fail';
            console.log(chalk.red('❌ Security Features - FAIL\n'));
        }
    }

    // ===== AI INTEGRATION TESTS =====

    async testAIIntegration() {
        console.log(chalk.blue('🤖 Testing AI Integration'));

        try {
            // Test unified AI module first
            let aiModule;
            try {
                aiModule = require('./sn-ai-unified');
                this.addTest('aiIntegration', 'Unified AI Module', 'pass', 'sn-ai-unified module loaded successfully');
            } catch (error) {
                this.addTest('aiIntegration', 'Unified AI Module', 'fail', `Failed to load unified AI: ${error.message}`);
            }

            // Test AI system initialization
            if (aiModule) {
                try {
                    const ai = aiModule.getInstance();
                    await ai.initialize();
                    this.addTest('aiIntegration', 'AI System Initialization', 'pass', 'AI system initialized successfully');

                    // Test provider detection
                    const status = ai.getStatus();
                    const detectedProviders = status.providers.filter(p => p.detected).length;
                    this.addTest('aiIntegration', 'Provider Detection', 'pass',
                        `${detectedProviders} providers detected`);

                    // Test best provider selection
                    const bestProvider = ai.getBestProvider('record-creation');
                    this.addTest('aiIntegration', 'Provider Selection', bestProvider ? 'pass' : 'warn',
                        bestProvider ? `Best provider: ${bestProvider.name}` : 'No available providers');

                } catch (error) {
                    this.addTest('aiIntegration', 'AI System Initialization', 'fail', error.message);
                }
            }

            // Test fallback to individual modules
            if (!aiModule) {
                try {
                    const UnifiedAI = require('./sn-ai-unified');
                    const ai = UnifiedAI.getInstance();
                    await ai.initialize();
                    this.addTest('aiIntegration', 'Legacy AI Integration', 'pass', 'Legacy AI system works');
                } catch (error) {
                    this.addTest('aiIntegration', 'Legacy AI Integration', 'fail', error.message);
                }

                try {
                    const ExternalAIInterface = require('./sn-external-ai');
                    const externalAI = new ExternalAIInterface();
                    this.addTest('aiIntegration', 'External AI Interface', 'pass', 'External AI interface available');
                } catch (error) {
                    this.addTest('aiIntegration', 'External AI Interface', 'fail', error.message);
                }
            }

            this.results.aiIntegration.status = 'pass';
            console.log(chalk.green('✅ AI Integration - PASS\n'));

        } catch (error) {
            this.results.aiIntegration.status = 'fail';
            console.log(chalk.red('❌ AI Integration - FAIL\n'));
        }
    }

    // ===== ERROR HANDLING TESTS =====

    async testErrorHandling() {
        console.log(chalk.blue('⚠️ Testing Error Handling'));

        try {
            // Test error handler
            let errorHandler;
            try {
                const coreModule = require('./sn-core');
                errorHandler = coreModule.getInstance();
                this.addTest('errorHandling', 'Unified Error Handler', 'pass', 'Error handler loaded from unified core');
            } catch (error) {
                try {
                    const { ErrorHandler } = require('./sn-error-handler');
                    errorHandler = new ErrorHandler();
                    this.addTest('errorHandling', 'Standalone Error Handler', 'pass', 'Standalone error handler loaded');
                } catch (standalonError) {
                    this.addTest('errorHandling', 'Error Handler', 'fail', `Failed to load error handler: ${standalonError.message}`);
                }
            }

            // Test error handling functionality
            if (errorHandler) {
                try {
                    const testError = new Error('Test error');
                    testError.code = 'ETEST';
                    const result = errorHandler.handleError ?
                        errorHandler.handleError(testError, { test: true }) :
                        errorHandler.handle(testError, { test: true });

                    this.addTest('errorHandling', 'Error Analysis', 'pass',
                        `Error categorized as: ${result.category}, severity: ${result.severity}`);
                } catch (error) {
                    this.addTest('errorHandling', 'Error Analysis', 'fail', error.message);
                }
            }

            this.results.errorHandling.status = 'pass';
            console.log(chalk.green('✅ Error Handling - PASS\n'));

        } catch (error) {
            this.results.errorHandling.status = 'fail';
            console.log(chalk.red('❌ Error Handling - FAIL\n'));
        }
    }

    // ===== VALIDATION TESTS =====

    async testInputValidation() {
        console.log(chalk.blue('✔️ Testing Input Validation'));

        try {
            // Test validator
            let validator;
            try {
                const coreModule = require('./sn-core');
                validator = coreModule.getInstance();
                this.addTest('validation', 'Unified Validator', 'pass', 'Validator loaded from unified core');
            } catch (error) {
                try {
                    const Validator = require('./sn-validator');
                    validator = new Validator();
                    this.addTest('validation', 'Standalone Validator', 'pass', 'Standalone validator loaded');
                } catch (standalonError) {
                    this.addTest('validation', 'Validator', 'fail', `Failed to load validator: ${standalonError.message}`);
                }
            }

            // Test validation functions
            if (validator) {
                const testCases = [
                    {
                        name: 'Instance URL Validation',
                        test: () => validator.validateInstanceUrl('myinstance.service-now.com'),
                        expectValid: true
                    },
                    {
                        name: 'Invalid Instance URL',
                        test: () => validator.validateInstanceUrl('invalid-url'),
                        expectValid: false
                    },
                    {
                        name: 'Table Name Validation',
                        test: () => validator.validateTableName('sys_script_include'),
                        expectValid: true
                    },
                    {
                        name: 'Sys ID Validation',
                        test: () => validator.validateSysId('a1b2c3d4e5f67890123456789012abcd'),
                        expectValid: true
                    },
                    {
                        name: 'AI Prompt Validation',
                        test: () => validator.validateAIPrompt('Create a script include for email validation'),
                        expectValid: true
                    }
                ];

                testCases.forEach(({ name, test, expectValid }) => {
                    try {
                        const result = test();
                        const actualValid = result.valid;
                        const passed = actualValid === expectValid;
                        this.addTest('validation', name, passed ? 'pass' : 'fail',
                            passed ? 'Validation result as expected' :
                            `Expected ${expectValid}, got ${actualValid}`);
                    } catch (error) {
                        this.addTest('validation', name, 'fail', error.message);
                    }
                });
            }

            this.results.validation.status = 'pass';
            console.log(chalk.green('✅ Input Validation - PASS\n'));

        } catch (error) {
            this.results.validation.status = 'fail';
            console.log(chalk.red('❌ Input Validation - FAIL\n'));
        }
    }

    async testFieldValidation() {
        console.log(chalk.blue('🔍 Testing Field Validation'));

        try {
            // Test field validator if it exists
            try {
                const { FieldValidator } = require('./sn-field-validator');
                const fieldValidator = new FieldValidator();
                this.addTest('validation', 'Field Validator', 'pass', 'Field validator loaded successfully');

                // Test specific field types
                const fieldTests = [
                    {
                        name: 'String Field Test',
                        field: { element: 'name', internal_type: 'string', max_length: '50' },
                        value: 'Test Value',
                        expectValid: true
                    },
                    {
                        name: 'Email Field Test',
                        field: { element: 'email', internal_type: 'email' },
                        value: 'test@example.com',
                        expectValid: true
                    },
                    {
                        name: 'Integer Field Test',
                        field: { element: 'count', internal_type: 'integer' },
                        value: '42',
                        expectValid: true
                    }
                ];

                fieldTests.forEach(({ name, field, value, expectValid }) => {
                    try {
                        const result = fieldValidator.validateField(field, value, false);
                        const passed = result.isValid === expectValid;
                        this.addTest('validation', name, passed ? 'pass' : 'fail',
                            passed ? 'Field validation as expected' :
                            `Expected ${expectValid}, got ${result.isValid}`);
                    } catch (error) {
                        this.addTest('validation', name, 'fail', error.message);
                    }
                });

            } catch (error) {
                this.addTest('validation', 'Field Validator', 'warn', 'Field validator not available (optional)');
            }

            this.results.validation.status = 'pass';
            console.log(chalk.green('✅ Field Validation - PASS\n'));

        } catch (error) {
            this.results.validation.status = 'fail';
            console.log(chalk.red('❌ Field Validation - FAIL\n'));
        }
    }

    // ===== FILE OPERATIONS TESTS =====

    async testFileOperations() {
        console.log(chalk.blue('📁 Testing File Operations'));

        try {
            // Test core files exist
            const coreFiles = [
                'sn-operations.js',
                'sn-launcher.js',
                'sn-config.json',
                'package.json'
            ];

            coreFiles.forEach(file => {
                const filePath = path.join(this.toolsDir, file);
                try {
                    this.checkFileExists(filePath);
                    this.addTest('fileOperations', `Core File: ${file}`, 'pass', 'File exists');
                } catch (error) {
                    this.addTest('fileOperations', `Core File: ${file}`, 'fail', error.message);
                }
            });

            // Test new unified files
            const unifiedFiles = [
                'sn-ai-unified.js',
                'sn-core.js'
            ];

            unifiedFiles.forEach(file => {
                const filePath = path.join(this.toolsDir, file);
                try {
                    this.checkFileExists(filePath);
                    this.addTest('fileOperations', `Unified File: ${file}`, 'pass', 'New unified file exists');
                } catch (error) {
                    this.addTest('fileOperations', `Unified File: ${file}`, 'warn', 'Unified file not found (may not be created yet)');
                }
            });

            this.results.fileOperations.status = 'pass';
            console.log(chalk.green('✅ File Operations - PASS\n'));

        } catch (error) {
            this.results.fileOperations.status = 'fail';
            console.log(chalk.red('❌ File Operations - FAIL\n'));
        }
    }

    // ===== CROSS-PLATFORM TESTS =====

    async testCrossPlatformSupport() {
        console.log(chalk.blue('🌐 Testing Cross-Platform Support'));

        try {
            // Test platform detection
            this.addTest('crossPlatform', 'Platform Detection', 'pass', `Detected platform: ${this.platform}`);

            // Test platform-specific scripts
            const scriptExtension = this.isWindows ? '.bat' : '.sh';
            const platformScripts = [
                `sn-tools${scriptExtension}`,
                `sn-setup${scriptExtension}`,
                `sn-dev${scriptExtension}`
            ];

            // Check root level scripts
            platformScripts.forEach(script => {
                const scriptPath = path.join(this.rootDir, script);
                try {
                    this.checkFileExists(scriptPath);
                    this.addTest('crossPlatform', `Root Script: ${script}`, 'pass', 'Platform script exists');

                    if (!this.isWindows) {
                        try {
                            this.checkExecutable(scriptPath);
                            this.addTest('crossPlatform', `${script} Executable`, 'pass', 'Script is executable');
                        } catch (error) {
                            this.addTest('crossPlatform', `${script} Executable`, 'fail', error.message);
                        }
                    }
                } catch (error) {
                    this.addTest('crossPlatform', `Root Script: ${script}`, 'fail', error.message);
                }
            });

            // Check Scripts directory
            const scriptsDir = path.join(this.rootDir, 'Scripts');
            if (fs.existsSync(scriptsDir)) {
                this.addTest('crossPlatform', 'Scripts Directory', 'pass', 'Scripts directory exists');

                platformScripts.forEach(script => {
                    const scriptPath = path.join(scriptsDir, script);
                    try {
                        this.checkFileExists(scriptPath);
                        this.addTest('crossPlatform', `Scripts/${script}`, 'pass', 'Script exists in Scripts directory');
                    } catch (error) {
                        this.addTest('crossPlatform', `Scripts/${script}`, 'warn', 'Script not in Scripts directory');
                    }
                });
            } else {
                this.addTest('crossPlatform', 'Scripts Directory', 'warn', 'Scripts directory not found');
            }

            // Test Node.js availability
            try {
                const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
                this.addTest('crossPlatform', 'Node.js Availability', 'pass', `Node.js version: ${nodeVersion}`);
            } catch (error) {
                this.addTest('crossPlatform', 'Node.js Availability', 'fail', 'Node.js not available');
            }

            this.results.crossPlatform.status = 'pass';
            console.log(chalk.green('✅ Cross-Platform Support - PASS\n'));

        } catch (error) {
            this.results.crossPlatform.status = 'fail';
            console.log(chalk.red('❌ Cross-Platform Support - FAIL\n'));
        }
    }

    // ===== REPORT GENERATION =====

    generateFinalReport() {
        console.log(chalk.blue('\n📊 Final Test Report'));
        console.log(chalk.blue('='.repeat(50)));

        const passedCategories = Object.values(this.results).filter(r => r.status === 'pass').length - 1; // -1 for overall
        const totalCategories = Object.keys(this.results).length - 1; // -1 for overall

        console.log(chalk.yellow(`Platform: ${this.platform}`));
        console.log(chalk.yellow(`Total Tests: ${this.testCount}`));
        console.log(chalk.green(`Passed: ${this.passedTests}`));
        console.log(chalk.red(`Failed: ${this.failedTests}`));
        console.log(chalk.yellow(`Warnings: ${this.testCount - this.passedTests - this.failedTests}`));
        console.log(chalk.blue(`Categories Passed: ${passedCategories}/${totalCategories}`));

        // Detailed results by category
        Object.entries(this.results).forEach(([category, result]) => {
            if (category === 'overall') return;

            const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
            const color = result.status === 'pass' ? 'green' : result.status === 'fail' ? 'red' : 'yellow';

            console.log(chalk[color](`\n${icon} ${category.toUpperCase()}: ${result.status.toUpperCase()}`));

            if (result.tests.length > 0) {
                const categoryPassed = result.tests.filter(t => t.status === 'pass').length;
                const categoryTotal = result.tests.length;
                console.log(chalk.gray(`   Tests: ${categoryPassed}/${categoryTotal} passed`));
            }
        });

        // Determine overall status
        const overallSuccess = this.failedTests === 0 && passedCategories === totalCategories;
        this.results.overall = overallSuccess ? 'pass' : 'fail';

        console.log(chalk.blue('\n' + '='.repeat(50)));
        if (overallSuccess) {
            console.log(chalk.green('🎉 ALL TESTS PASSED! System is ready for use.'));
        } else {
            console.log(chalk.red('⚠️  Some tests failed. Please review the results above.'));
        }

        // Save detailed results
        this.saveTestResults();
    }

    saveTestResults() {
        const resultsFile = path.join(this.toolsDir, `test-results-unified-${this.platform}.json`);
        const reportData = {
            platform: this.platform,
            timestamp: new Date().toISOString(),
            summary: {
                total: this.testCount,
                passed: this.passedTests,
                failed: this.failedTests,
                warnings: this.testCount - this.passedTests - this.failedTests,
                success: this.results.overall === 'pass'
            },
            categories: this.results,
            detailedResults: this.detailedResults
        };

        try {
            fs.writeFileSync(resultsFile, JSON.stringify(reportData, null, 2));
            console.log(chalk.gray(`\n📄 Detailed results saved to: ${resultsFile}`));
        } catch (error) {
            console.error(chalk.red(`Failed to save test results: ${error.message}`));
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const testType = args[0] || 'all';

    const validTypes = ['all', 'core', 'ai', 'validation', 'platform'];

    if (!validTypes.includes(testType)) {
        console.log(chalk.blue('\n🧪 Unified ServiceNow Tools Test Suite\n'));
        console.log('Usage:');
        console.log('  node sn-test-unified.js [test-type]');
        console.log('\nTest Types:');
        console.log('  all        - Run all tests (default)');
        console.log('  core       - Configuration, security, error handling, files');
        console.log('  ai         - AI integration and provider detection');
        console.log('  validation - Input and field validation');
        console.log('  platform   - Cross-platform compatibility');
        return;
    }

    const tester = new UnifiedTestSuite();
    await tester.runAllTests(testType);
}

if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('Test suite crashed:'), error);
        process.exit(1);
    });
}

module.exports = UnifiedTestSuite;