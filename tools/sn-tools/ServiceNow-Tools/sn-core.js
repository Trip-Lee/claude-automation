#!/usr/bin/env node

/**
 * Unified Core Utilities Module
 * Combines configuration management, credential encryption, error handling, and validation
 * Consolidates: sn-config-manager.js, sn-credential-manager.js, sn-error-handler.js, sn-validator.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const chalk = require('chalk');

// ===== ERROR HANDLER =====
class ErrorHandler {
    constructor() {
        this.logFile = path.join(__dirname, 'error.log');
        this.errorCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.criticalErrors = new Set(['ENOENT', 'EACCES', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED']);
    }

    handle(error, context = {}) {
        const errorInfo = this.analyzeError(error, context);
        this.logError(errorInfo);
        this.displayError(errorInfo);
        return errorInfo;
    }

    analyzeError(error, context) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            stack: error.stack,
            code: error.code,
            context: context,
            severity: 'medium',
            category: 'unknown',
            recoverable: true,
            suggestions: []
        };

        if (error.code) {
            errorInfo.category = this.classifyErrorCode(error.code);
            errorInfo.severity = this.criticalErrors.has(error.code) ? 'critical' : 'medium';
        }

        if (error.message) {
            const message = error.message.toLowerCase();
            if (message.includes('network') || message.includes('connection')) {
                errorInfo.category = 'network';
                errorInfo.suggestions.push('Check network connectivity', 'Verify ServiceNow instance URL');
            }
            if (message.includes('authentication') || message.includes('unauthorized')) {
                errorInfo.category = 'auth';
                errorInfo.severity = 'high';
                errorInfo.suggestions.push('Check username and password', 'Verify user permissions');
            }
            if (message.includes('timeout')) {
                errorInfo.category = 'timeout';
                errorInfo.recoverable = true;
                errorInfo.suggestions.push('Retry the operation', 'Check network speed');
            }
        }

        return errorInfo;
    }

    classifyErrorCode(code) {
        const codeMap = {
            'ENOENT': 'filesystem', 'EACCES': 'permissions', 'ENOTFOUND': 'network',
            'ETIMEDOUT': 'timeout', 'ECONNREFUSED': 'connection', 'EMFILE': 'resources'
        };
        return codeMap[code] || 'unknown';
    }

    logError(errorInfo) {
        try {
            const logEntry = { ...errorInfo, sequence: ++this.errorCount };
            fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        } catch (logError) {
            console.error('Failed to log error:', logError.message);
        }
    }

    displayError(errorInfo) {
        const severityColors = { low: 'yellow', medium: 'red', high: 'red', critical: 'red' };
        const color = severityColors[errorInfo.severity] || 'red';
        const icon = errorInfo.severity === 'critical' ? '💥' : '❌';

        console.log(chalk[color](`\n${icon} Error: ${errorInfo.message}`));
        if (errorInfo.context.operation) {
            console.log(chalk.gray(`   Operation: ${errorInfo.context.operation}`));
        }
        if (errorInfo.suggestions.length > 0) {
            console.log(chalk.blue('\n💡 Suggestions:'));
            errorInfo.suggestions.forEach(suggestion => {
                console.log(chalk.blue(`   • ${suggestion}`));
            });
        }
        console.log('');
    }

    async retry(operation, context = {}) {
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                const errorInfo = this.analyzeError(error, { ...context, attempt });
                if (!errorInfo.recoverable || attempt === this.maxRetries) {
                    throw error;
                }
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(chalk.yellow(`⏳ Retry ${attempt}/${this.maxRetries} in ${delay}ms...`));
                await this.sleep(delay);
            }
        }
        throw lastError;
    }

    safeFileOperation(operation, filePath, context = {}) {
        try {
            return operation();
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            } else if (error.code === 'EACCES') {
                throw new Error(`Permission denied: ${filePath}`);
            }
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearLog() {
        try {
            if (fs.existsSync(this.logFile)) {
                fs.unlinkSync(this.logFile);
            }
            this.errorCount = 0;
            console.log('✅ Error log cleared');
        } catch (error) {
            console.error('Failed to clear error log:', error.message);
        }
    }
}

// ===== CREDENTIAL MANAGER =====
class CredentialManager {
    constructor() {
        this.algorithm = 'aes-256-cbc';
        this.keyLength = 32;
        this.keyFile = path.join(__dirname, '.sn-key');
        this.envKeyName = 'SN_TOOLS_KEY';
    }

    getEncryptionKey() {
        if (process.env[this.envKeyName]) {
            const envKey = process.env[this.envKeyName];
            if (envKey.length >= 64) {
                return Buffer.from(envKey, 'hex');
            }
        }

        if (fs.existsSync(this.keyFile)) {
            try {
                const keyData = fs.readFileSync(this.keyFile, 'utf8');
                return Buffer.from(keyData, 'hex');
            } catch (error) {
                console.warn('Failed to read key file, generating new key');
            }
        }

        return this.generateNewKey();
    }

    generateNewKey() {
        const key = crypto.randomBytes(this.keyLength);
        const keyHex = key.toString('hex');

        try {
            fs.writeFileSync(this.keyFile, keyHex, { mode: 0o600 });
            console.log(`🔑 Generated new encryption key: ${this.keyFile}`);
            console.log(`🔒 For maximum security, set environment variable: ${this.envKeyName}=${keyHex}`);
        } catch (error) {
            console.error('Failed to save key file:', error.message);
        }

        return key;
    }

    encrypt(plaintext) {
        if (!plaintext || typeof plaintext !== 'string') {
            throw new Error('Invalid plaintext data');
        }

        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const result = iv.toString('hex') + ':' + encrypted;
        return Buffer.from(result).toString('base64');
    }

    decrypt(encryptedData) {
        if (!encryptedData || typeof encryptedData !== 'string') {
            throw new Error('Invalid encrypted data');
        }

        try {
            const key = this.getEncryptionKey();
            const data = Buffer.from(encryptedData, 'base64').toString();
            const [ivHex, encrypted] = data.split(':');

            if (!ivHex || !encrypted) {
                throw new Error('Invalid encrypted data format');
            }

            const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    encryptConfig(config) {
        if (!config || typeof config !== 'object') {
            return config;
        }

        const encryptedConfig = JSON.parse(JSON.stringify(config));

        if (encryptedConfig.instances) {
            Object.keys(encryptedConfig.instances).forEach(instanceKey => {
                const instance = encryptedConfig.instances[instanceKey];
                if (instance.password && !this.isEncrypted(instance.password)) {
                    instance.password = this.encrypt(instance.password);
                    instance._encrypted = true;
                }
            });
        }

        if (encryptedConfig.claude?.apiKey && !this.isEncrypted(encryptedConfig.claude.apiKey)) {
            encryptedConfig.claude.apiKey = this.encrypt(encryptedConfig.claude.apiKey);
            encryptedConfig.claude._encrypted = true;
        }

        encryptedConfig._credentialsEncrypted = true;
        encryptedConfig._encryptedAt = new Date().toISOString();

        return encryptedConfig;
    }

    decryptConfig(config) {
        if (!config || typeof config !== 'object' || !config._credentialsEncrypted) {
            return config;
        }

        const decryptedConfig = JSON.parse(JSON.stringify(config));

        try {
            if (decryptedConfig.instances) {
                Object.keys(decryptedConfig.instances).forEach(instanceKey => {
                    const instance = decryptedConfig.instances[instanceKey];
                    if (instance._encrypted && instance.password) {
                        instance.password = this.decrypt(instance.password);
                        delete instance._encrypted;
                    }
                });
            }

            if (decryptedConfig.claude?._encrypted && decryptedConfig.claude.apiKey) {
                decryptedConfig.claude.apiKey = this.decrypt(decryptedConfig.claude.apiKey);
                delete decryptedConfig.claude._encrypted;
            }

            return decryptedConfig;
        } catch (error) {
            throw new Error(`Failed to decrypt configuration: ${error.message}`);
        }
    }

    isEncrypted(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }
        return value.length > 50 && /^[A-Za-z0-9+/]+=*$/.test(value);
    }

    testEncryption() {
        const testData = 'test-password-123';
        try {
            const encrypted = this.encrypt(testData);
            const decrypted = this.decrypt(encrypted);
            if (decrypted !== testData) {
                throw new Error('Decrypted data does not match original');
            }
            console.log('✅ Encryption test passed');
            return true;
        } catch (error) {
            console.error('❌ Encryption test failed:', error.message);
            return false;
        }
    }
}

// ===== VALIDATOR =====
class Validator {
    constructor() {
        this.patterns = {
            instanceUrl: /^[a-zA-Z0-9][a-zA-Z0-9-]*\.service-now\.com$/,
            sysId: /^[a-f0-9]{32}$/,
            tableName: /^[a-z][a-z0-9_]*$/,
            fieldName: /^[a-z][a-z0-9_]*$/,
            scopePrefix: /^[a-zA-Z][a-zA-Z0-9_]*$/,
            username: /^[a-zA-Z0-9._@-]+$/
        };

        this.maxLengths = {
            name: 100, description: 1000, script: 50000, username: 50, password: 100,
            instanceUrl: 100, tableName: 50, fieldName: 50
        };

        this.validTableNames = new Set([
            'sys_script_include', 'sys_script', 'sys_script_client', 'sys_ui_action',
            'sys_ws_operation', 'rm_story', 'sys_hub_flow'
        ]);

        this.dangerousPatterns = [
            /eval\s*\(/i, /function\s*\(\s*\)\s*{/i, /<script/i, /javascript:/i,
            /on\w+\s*=/i, /document\.write/i, /innerHTML/i
        ];
    }

    validateInstanceUrl(url) {
        const result = { valid: false, errors: [], sanitized: null };

        if (!url || typeof url !== 'string') {
            result.errors.push('Instance URL is required');
            return result;
        }

        const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        result.sanitized = cleanUrl;

        if (!this.patterns.instanceUrl.test(cleanUrl)) {
            result.errors.push('Invalid ServiceNow instance URL format');
            return result;
        }

        if (cleanUrl.length > this.maxLengths.instanceUrl) {
            result.errors.push(`Instance URL too long (max ${this.maxLengths.instanceUrl})`);
            return result;
        }

        result.valid = true;
        return result;
    }

    validateUsername(username) {
        const result = { valid: false, errors: [], sanitized: null };

        if (!username || typeof username !== 'string') {
            result.errors.push('Username is required');
            return result;
        }

        result.sanitized = username.trim();

        if (!this.patterns.username.test(result.sanitized)) {
            result.errors.push('Invalid username format');
            return result;
        }

        if (result.sanitized.length > this.maxLengths.username) {
            result.errors.push(`Username too long (max ${this.maxLengths.username})`);
            return result;
        }

        result.valid = true;
        return result;
    }

    validateTableName(tableName) {
        const result = { valid: false, errors: [], sanitized: null };

        if (!tableName || typeof tableName !== 'string') {
            result.errors.push('Table name is required');
            return result;
        }

        result.sanitized = tableName.toLowerCase().trim();

        if (!this.patterns.tableName.test(result.sanitized)) {
            result.errors.push('Invalid table name format');
            return result;
        }

        if (!this.validTableNames.has(result.sanitized)) {
            console.warn(chalk.yellow(`⚠️  Warning: Uncommon table name: ${result.sanitized}`));
        }

        result.valid = true;
        return result;
    }

    validateSysId(sysId) {
        const result = { valid: false, errors: [], sanitized: null };

        if (!sysId || typeof sysId !== 'string') {
            result.errors.push('Sys ID is required');
            return result;
        }

        result.sanitized = sysId.toLowerCase().trim();

        if (!this.patterns.sysId.test(result.sanitized)) {
            result.errors.push('Invalid sys_id format (must be 32 hex characters)');
            return result;
        }

        result.valid = true;
        return result;
    }

    validateAIPrompt(prompt) {
        const result = { valid: false, errors: [], sanitized: null, warnings: [] };

        if (!prompt || typeof prompt !== 'string') {
            result.errors.push('AI prompt is required');
            return result;
        }

        result.sanitized = prompt.trim();

        if (result.sanitized.length > 2000) {
            result.errors.push('AI prompt too long (max 2000 characters)');
            return result;
        }

        if (result.sanitized.length < 10) {
            result.warnings.push('AI prompt is very short, consider adding more detail');
        }

        this.dangerousPatterns.forEach(pattern => {
            if (pattern.test(result.sanitized)) {
                result.warnings.push('Prompt contains potentially dangerous JavaScript patterns');
            }
        });

        result.valid = true;
        return result;
    }

    validateConfig(config) {
        const result = { valid: true, errors: [], warnings: [] };

        if (!config || typeof config !== 'object') {
            result.errors.push('Configuration must be an object');
            result.valid = false;
            return result;
        }

        if (!config.instances || typeof config.instances !== 'object') {
            result.errors.push('Configuration must have instances section');
            result.valid = false;
        } else {
            Object.entries(config.instances).forEach(([name, instance]) => {
                if (!instance.instance) {
                    result.errors.push(`Instance ${name} missing URL`);
                    result.valid = false;
                } else {
                    const urlResult = this.validateInstanceUrl(instance.instance);
                    if (!urlResult.valid) {
                        result.errors.push(...urlResult.errors.map(e => `Instance ${name}: ${e}`));
                        result.valid = false;
                    }
                }

                if (!instance.username) {
                    result.errors.push(`Instance ${name} missing username`);
                    result.valid = false;
                }
            });
        }

        if (!config.routing || !config.routing.default) {
            result.errors.push('Configuration must have routing.default');
            result.valid = false;
        }

        return result;
    }

    sanitizeString(input, allowHtml = false) {
        if (!input || typeof input !== 'string') {
            return '';
        }

        let sanitized = input.trim();

        if (!allowHtml) {
            sanitized = sanitized.replace(/<[^>]*>/g, '');
        }

        sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
        sanitized = sanitized.replace(/\s+/g, ' ');

        return sanitized;
    }

    displayResults(result, context = '') {
        if (result.errors && result.errors.length > 0) {
            console.log(chalk.red(`❌ Validation failed${context ? ` (${context})` : ''}:`));
            result.errors.forEach(error => {
                console.log(chalk.red(`   • ${error}`));
            });
        }

        if (result.warnings && result.warnings.length > 0) {
            console.log(chalk.yellow(`⚠️  Validation warnings${context ? ` (${context})` : ''}:`));
            result.warnings.forEach(warning => {
                console.log(chalk.yellow(`   • ${warning}`));
            });
        }

        if (result.valid && (!result.errors || result.errors.length === 0)) {
            console.log(chalk.green(`✅ Validation passed${context ? ` (${context})` : ''}`));
        }

        return result;
    }
}

// ===== CONFIG MANAGER =====
class ConfigManager extends EventEmitter {
    constructor() {
        super();
        this.configPath = path.join(__dirname, 'sn-config.json');
        this.config = null;
        this.lastModified = null;
        this.watchers = new Set();
        this.credentialManager = new CredentialManager();
        this.errorHandler = new ErrorHandler();
        this.validator = new Validator();
        this.initializeWatcher();
    }

    getConfig(forceReload = false) {
        if (!this.config || forceReload || this.hasConfigChanged()) {
            this.loadConfig();
        }
        return this.config;
    }

    loadConfig() {
        return this.errorHandler.safeFileOperation(() => {
            const stats = fs.statSync(this.configPath);
            const configData = fs.readFileSync(this.configPath, 'utf8');

            this.config = JSON.parse(configData);
            this.lastModified = stats.mtime;

            if (this.config._credentialsEncrypted) {
                try {
                    this.config = this.credentialManager.decryptConfig(this.config);
                } catch (error) {
                    this.errorHandler.handle(error, { operation: 'decrypt_config' });
                    console.warn('   Using encrypted config as-is. Some operations may fail.');
                }
            }

            this.validateConfig(this.config);
            this.emit('configLoaded', this.config);
            return this.config;
        }, this.configPath, { operation: 'load_config' });
    }

    saveConfig(newConfig, encrypt = false) {
        try {
            this.validateConfig(newConfig);

            let configToSave = newConfig;
            if (encrypt) {
                configToSave = this.credentialManager.encryptConfig(newConfig);
            }

            const tempPath = this.configPath + '.tmp';
            fs.writeFileSync(tempPath, JSON.stringify(configToSave, null, 2), { mode: 0o600 });
            fs.renameSync(tempPath, this.configPath);

            this.config = newConfig;
            this.emit('configSaved', newConfig);

            return true;
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error.message}`);
        }
    }

    hasConfigChanged() {
        if (!this.lastModified) return true;
        try {
            const stats = fs.statSync(this.configPath);
            return stats.mtime > this.lastModified;
        } catch {
            return true;
        }
    }

    initializeWatcher() {
        if (this.watchers.size > 0) return;

        const watcher = fs.watch(this.configPath, (eventType) => {
            if (eventType === 'change') {
                setTimeout(() => {
                    try {
                        this.loadConfig();
                        this.emit('configChanged', this.config);
                    } catch (error) {
                        this.emit('configError', error);
                    }
                }, 100);
            }
        });

        this.watchers.add(watcher);
    }

    validateConfig(config) {
        const result = this.validator.validateConfig(config);
        if (!result.valid) {
            throw new Error(`Invalid configuration: ${result.errors.join(', ')}`);
        }
    }

    updateSection(section, data) {
        const config = this.getConfig();
        config[section] = { ...config[section], ...data };
        return this.saveConfig(config);
    }

    destroy() {
        this.watchers.forEach(watcher => watcher.close());
        this.watchers.clear();
        this.removeAllListeners();
    }
}

// ===== UNIFIED CORE MODULE =====
class UnifiedCore {
    constructor() {
        this.configManager = new ConfigManager();
        this.credentialManager = new CredentialManager();
        this.errorHandler = new ErrorHandler();
        this.validator = new Validator();
    }

    // Configuration methods
    getConfig(forceReload = false) { return this.configManager.getConfig(forceReload); }
    saveConfig(config, encrypt = false) { return this.configManager.saveConfig(config, encrypt); }
    updateSection(section, data) { return this.configManager.updateSection(section, data); }

    // Credential methods
    encrypt(data) { return this.credentialManager.encrypt(data); }
    decrypt(data) { return this.credentialManager.decrypt(data); }
    encryptConfig(config) { return this.credentialManager.encryptConfig(config); }
    decryptConfig(config) { return this.credentialManager.decryptConfig(config); }
    testEncryption() { return this.credentialManager.testEncryption(); }

    // Error handling methods
    handleError(error, context) { return this.errorHandler.handle(error, context); }
    retry(operation, context) { return this.errorHandler.retry(operation, context); }
    safeFileOperation(operation, filePath, context) {
        return this.errorHandler.safeFileOperation(operation, filePath, context);
    }
    clearErrorLog() { return this.errorHandler.clearLog(); }

    // Validation methods
    validateInstanceUrl(url) { return this.validator.validateInstanceUrl(url); }
    validateUsername(username) { return this.validator.validateUsername(username); }
    validateTableName(tableName) { return this.validator.validateTableName(tableName); }
    validateSysId(sysId) { return this.validator.validateSysId(sysId); }
    validateAIPrompt(prompt) { return this.validator.validateAIPrompt(prompt); }
    validateConfig(config) { return this.validator.validateConfig(config); }
    sanitizeString(input, allowHtml) { return this.validator.sanitizeString(input, allowHtml); }
    displayValidationResults(result, context) {
        return this.validator.displayResults(result, context);
    }

    // Unified operations
    initialize() {
        console.log(chalk.blue('🔧 Initializing Core Utilities...'));

        try {
            // Test encryption
            this.testEncryption();

            // Load and validate config
            const config = this.getConfig();
            const validation = this.validateConfig(config);
            this.displayValidationResults(validation, 'Configuration');

            console.log(chalk.green('✅ Core utilities initialized successfully'));
            return true;
        } catch (error) {
            this.handleError(error, { operation: 'core_initialization' });
            return false;
        }
    }

    getStatus() {
        return {
            config: {
                loaded: !!this.configManager.config,
                lastModified: this.configManager.lastModified,
                encrypted: this.configManager.config?._credentialsEncrypted || false
            },
            encryption: {
                keyExists: fs.existsSync(this.credentialManager.keyFile),
                envKeySet: !!process.env[this.credentialManager.envKeyName]
            },
            errorLog: {
                exists: fs.existsSync(this.errorHandler.logFile),
                count: this.errorHandler.errorCount
            }
        };
    }

    cleanup() {
        console.log(chalk.yellow('🧹 Cleaning up core utilities...'));
        this.configManager.destroy();
    }
}

// Global error handlers
const globalErrorHandler = new ErrorHandler();

process.on('uncaughtException', (error) => {
    console.error(chalk.red('\n💥 Uncaught Exception:'));
    globalErrorHandler.handle(error, { context: 'uncaught', fatal: true });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('\n💥 Unhandled Promise Rejection:'));
    const error = reason instanceof Error ? reason : new Error(String(reason));
    globalErrorHandler.handle(error, { context: 'promise', promise });
});

// Singleton instance
let instance = null;

module.exports = {
    getInstance() {
        if (!instance) {
            instance = new UnifiedCore();
        }
        return instance;
    },

    // Backward compatibility - individual classes
    ConfigManager,
    CredentialManager,
    ErrorHandler,
    Validator,

    // Convenience methods
    getConfig: (forceReload) => module.exports.getInstance().getConfig(forceReload),
    saveConfig: (config, encrypt) => module.exports.getInstance().saveConfig(config, encrypt),
    validateConfig: (config) => module.exports.getInstance().validateConfig(config),
    handleError: (error, context) => module.exports.getInstance().handleError(error, context),
    encrypt: (data) => module.exports.getInstance().encrypt(data),
    decrypt: (data) => module.exports.getInstance().decrypt(data),
    getStatus: () => module.exports.getInstance().getStatus(),
    cleanup: () => module.exports.getInstance().cleanup()
};

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const core = module.exports.getInstance();

    switch (command) {
        case 'init':
            core.initialize();
            break;
        case 'status':
            console.log(JSON.stringify(core.getStatus(), null, 2));
            break;
        case 'test-encryption':
            core.testEncryption();
            break;
        case 'clear-errors':
            core.clearErrorLog();
            break;
        case 'validate-config':
            const config = core.getConfig();
            const result = core.validateConfig(config);
            core.displayValidationResults(result, 'Configuration');
            break;
        default:
            console.log(chalk.blue('\n🔧 Unified Core Utilities for ServiceNow Tools\n'));
            console.log('Usage:');
            console.log('  node sn-core.js init             # Initialize and test all systems');
            console.log('  node sn-core.js status           # Show system status');
            console.log('  node sn-core.js test-encryption  # Test encryption system');
            console.log('  node sn-core.js validate-config  # Validate configuration');
            console.log('  node sn-core.js clear-errors     # Clear error log');
    }
}