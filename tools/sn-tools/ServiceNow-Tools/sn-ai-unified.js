#!/usr/bin/env node

/**
 * Unified AI Integration Module
 * Combines AI caching, integration, process management, and external interfaces
 * Consolidates: sn-ai-cache.js, sn-ai-integration-v2.js, sn-ai-process-manager.js, sn-external-ai.js
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const https = require('https');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class UnifiedAI extends EventEmitter {
    constructor() {
        super();

        // Cache properties
        this.cacheFile = path.join(__dirname, '.ai-detection-cache.json');
        this.cache = this.loadCache();
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours

        // Process management
        this.activeProcesses = new Map();
        this.processCounter = 0;
        this.defaultTimeout = 60000;

        // Provider management
        this.providers = new Map();
        this.initialized = false;

        // External interface
        this.snToolsPath = path.join(__dirname, 'sn-operations.js');
        this.logFile = path.join(__dirname, 'external-ai.log');
        this.supportedOperations = ['create', 'update', 'fetch-data', 'fetch-stories', 'test', 'interactive'];

        // Cleanup on exit
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }

    // ===== CACHE MANAGEMENT =====

    loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const cacheData = fs.readFileSync(this.cacheFile, 'utf8');
                const parsed = JSON.parse(cacheData);
                if (parsed.version && parsed.timestamp && parsed.detections) {
                    return parsed;
                }
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️  AI cache corrupted, will rebuild...'));
        }
        return this.createEmptyCache();
    }

    createEmptyCache() {
        return {
            version: '1.0.0',
            timestamp: 0,
            detections: {},
            metadata: { lastFullScan: 0, scanCount: 0 }
        };
    }

    saveCache() {
        try {
            const tempFile = this.cacheFile + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(this.cache, null, 2));
            fs.renameSync(tempFile, this.cacheFile);
            return true;
        } catch (error) {
            console.error(chalk.red(`❌ Failed to save AI cache: ${error.message}`));
            return false;
        }
    }

    isCacheValid() {
        const now = Date.now();
        const age = now - this.cache.timestamp;
        return age < this.cacheTimeout && Object.keys(this.cache.detections).length > 0;
    }

    getCachedDetections() {
        if (this.isCacheValid()) {
            console.log(chalk.green('📋 Using cached AI detection results'));
            return this.cache.detections;
        }
        return null;
    }

    cacheDetections(detections) {
        this.cache.detections = detections;
        this.cache.timestamp = Date.now();
        this.cache.metadata.lastFullScan = Date.now();
        this.cache.metadata.scanCount++;
        this.saveCache();
        console.log(chalk.green('💾 AI detection results cached'));
    }

    shouldUpdateProvider(providerKey) {
        const provider = this.cache.detections[providerKey];
        if (!provider) return true;
        const age = Date.now() - (provider.lastChecked || 0);
        return age > (6 * 60 * 60 * 1000); // 6 hours
    }

    // ===== PROCESS MANAGEMENT =====

    async executeAICommand(command, args = [], options = {}) {
        const processId = ++this.processCounter;
        const timeout = options.timeout || this.defaultTimeout;
        const input = options.input || '';

        console.log(chalk.blue(`🔄 Starting AI process ${processId}: ${command}`));

        return new Promise((resolve, reject) => {
            let timeoutHandle;
            let childProcess;

            try {
                if (!this.isValidCommand(command)) {
                    throw new Error(`Invalid or potentially unsafe command: ${command}`);
                }

                childProcess = spawn(command, args, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: false,
                    timeout: timeout,
                    detached: false,
                    windowsHide: true
                });

                this.activeProcesses.set(processId, {
                    process: childProcess,
                    command,
                    startTime: Date.now(),
                    timeout: timeout
                });

                let stdout = '';
                let stderr = '';

                childProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                childProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                timeoutHandle = setTimeout(() => {
                    console.log(chalk.yellow(`⏰ AI process ${processId} timed out, terminating...`));
                    this.terminateProcess(processId);
                    reject(new Error(`AI process timed out after ${timeout}ms`));
                }, timeout);

                childProcess.on('close', (code, signal) => {
                    clearTimeout(timeoutHandle);
                    this.activeProcesses.delete(processId);

                    if (signal) {
                        reject(new Error(`AI process terminated by signal: ${signal}`));
                    } else if (code === 0) {
                        resolve({
                            success: true,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            processId
                        });
                    } else {
                        reject(new Error(`AI process failed with code ${code}: ${stderr}`));
                    }
                });

                childProcess.on('error', (error) => {
                    clearTimeout(timeoutHandle);
                    this.activeProcesses.delete(processId);
                    reject(new Error(`Failed to start AI process: ${error.message}`));
                });

                if (input) {
                    childProcess.stdin.write(input);
                }
                childProcess.stdin.end();

                this.emit('processStarted', { processId, command, args });

            } catch (error) {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                if (childProcess && !childProcess.killed) {
                    this.terminateProcess(processId);
                }
                reject(error);
            }
        });
    }

    isValidCommand(command) {
        const allowedCommands = ['claude', 'chatgpt', 'node'];
        const baseCommand = command.split(/[\s\/\\]/).pop().toLowerCase();
        return allowedCommands.includes(baseCommand) && !/[;&|`$\(\)<>]/.test(command);
    }

    terminateProcess(processId) {
        const processInfo = this.activeProcesses.get(processId);
        if (!processInfo) return false;

        const { process: childProcess } = processInfo;
        try {
            if (!childProcess.killed) {
                childProcess.kill('SIGTERM');
                setTimeout(() => {
                    if (!childProcess.killed) {
                        childProcess.kill('SIGKILL');
                    }
                }, 5000);
                this.activeProcesses.delete(processId);
                this.emit('processTerminated', processId);
                return true;
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error terminating process ${processId}: ${error.message}`));
        }
        return false;
    }

    // ===== PROVIDER DETECTION & MANAGEMENT =====

    async initialize() {
        if (this.initialized) return;
        console.log(chalk.blue('🚀 Initializing Unified AI System...'));

        const cachedDetections = this.getCachedDetections();
        if (cachedDetections) {
            this.updateProvidersFromCache(cachedDetections);
        } else {
            await this.detectProviders();
        }
        this.initialized = true;
    }

    async detectProviders() {
        console.log(chalk.blue('🔍 Detecting AI providers...'));

        const config = this.getConfig();
        const detectionResults = {};
        const detectionPromises = [];

        // Claude Code detection
        if (this.shouldUpdateProvider('claude-code')) {
            detectionPromises.push(
                this.detectProvider('claude-code', 'claude', ['--version'])
                    .then(result => detectionResults['claude-code'] = result)
            );
        }

        // ChatGPT CLI detection
        if (this.shouldUpdateProvider('chatgpt-cli')) {
            detectionPromises.push(
                this.detectProvider('chatgpt-cli', 'chatgpt', ['--version'])
                    .then(result => detectionResults['chatgpt-cli'] = result)
            );
        }

        // Claude API detection
        detectionResults['claude-api'] = this.detectClaudeAPI();

        await Promise.allSettled(detectionPromises);

        Object.entries(detectionResults).forEach(([key, result]) => {
            this.updateProvider(key, result);
        });

        this.cacheDetections(detectionResults);
        this.displayDetectionResults();
    }

    async detectProvider(providerId, command, args) {
        try {
            const result = await this.executeAICommand(command, args, { timeout: 5000 });
            if (result.success && result.stdout) {
                return {
                    detected: true,
                    version: result.stdout.trim(),
                    command: command,
                    lastChecked: Date.now()
                };
            }
        } catch (error) {
            console.log(chalk.red(`✗ ${providerId} not found: ${error.message}`));
        }

        return { detected: false, error: 'Command not found or failed', lastChecked: Date.now() };
    }

    detectClaudeAPI() {
        const config = this.getConfig();
        const claudeConfig = config.claude || {};
        const hasApiKey = claudeConfig.apiKey && claudeConfig.apiKey.length > 10;

        return {
            detected: hasApiKey && claudeConfig.enabled,
            configured: hasApiKey,
            enabled: claudeConfig.enabled || false,
            lastChecked: Date.now()
        };
    }

    updateProvidersFromCache(cachedDetections) {
        Object.entries(cachedDetections).forEach(([key, result]) => {
            this.updateProvider(key, result);
        });
    }

    updateProvider(providerId, detectionResult) {
        const config = this.getConfig();
        const configProvider = config.ai?.providers?.[providerId];
        if (!configProvider) return;

        const provider = {
            id: providerId,
            name: configProvider.name,
            priority: configProvider.priority,
            capabilities: configProvider.capabilities,
            detected: detectionResult.detected,
            enabled: detectionResult.detected && configProvider.enabled,
            version: detectionResult.version,
            command: detectionResult.command || configProvider.command,
            lastChecked: detectionResult.lastChecked
        };

        this.providers.set(providerId, provider);
    }

    getBestProvider(capability = 'record-creation') {
        const availableProviders = Array.from(this.providers.values())
            .filter(p => p.detected && p.enabled && p.capabilities.includes(capability))
            .sort((a, b) => a.priority - b.priority);
        return availableProviders[0] || null;
    }

    // ===== AI RECORD CREATION =====

    async createRecord(table, userPrompt, options = {}) {
        await this.initialize();

        const provider = this.getBestProvider('record-creation');
        if (!provider) {
            throw new Error('No AI providers available for record creation');
        }

        console.log(chalk.blue(`\n🤖 Creating ${table} record using ${provider.name}...\n`));

        const context = this.buildContext(table, options);
        const prompt = this.buildPrompt(userPrompt, context, table, provider);
        this.validateInputs(table, userPrompt, provider);

        switch (provider.id) {
            case 'claude-code':
                return await this.executeClaudeCode(prompt, table);
            case 'chatgpt-cli':
                return await this.executeChatGPT(prompt, table);
            case 'claude-api':
                return await this.executeClaudeAPI(prompt, table);
            default:
                throw new Error(`Unknown provider: ${provider.id}`);
        }
    }

    async executeClaudeCode(prompt, table) {
        try {
            const result = await this.executeAICommand('claude', [], {
                input: prompt,
                timeout: this.getConfig().ai?.recordCreation?.timeout || 60000
            });
            return this.parseAIResponse(result.stdout, table, 'claude-code');
        } catch (error) {
            throw new Error(`Claude Code execution failed: ${error.message}`);
        }
    }

    async executeChatGPT(prompt, table) {
        try {
            const result = await this.executeAICommand('chatgpt', [prompt], {
                timeout: this.getConfig().ai?.recordCreation?.timeout || 60000
            });
            return this.parseAIResponse(result.stdout, table, 'chatgpt-cli');
        } catch (error) {
            throw new Error(`ChatGPT CLI execution failed: ${error.message}`);
        }
    }

    async executeClaudeAPI(prompt, table) {
        const config = this.getConfig();
        const claudeConfig = config.claude || {};

        if (!claudeConfig.apiKey) {
            throw new Error('Claude API key not configured');
        }

        const requestData = JSON.stringify({
            model: claudeConfig.model || 'claude-3-sonnet-20240229',
            max_tokens: claudeConfig.maxTokens || 4096,
            messages: [{ role: 'user', content: prompt }]
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestData),
                    'x-api-key': claudeConfig.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode !== 200) {
                            reject(new Error(`Claude API error: ${response.error?.message || data}`));
                            return;
                        }
                        const content = response.content?.[0]?.text || '';
                        const result = this.parseAIResponse(content, table, 'claude-api');
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse Claude API response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Claude API request failed: ${error.message}`));
            });

            req.setTimeout(claudeConfig.timeout || 30000);
            req.write(requestData);
            req.end();
        });
    }

    // ===== EXTERNAL INTERFACE =====

    async executeCommand(operation, options = {}) {
        this.log(`External AI command: ${operation}`, options);

        if (!this.supportedOperations.includes(operation)) {
            throw new Error(`Unsupported operation: ${operation}. Supported: ${this.supportedOperations.join(', ')}`);
        }

        const args = this.buildCommandArgs(operation, options);
        return await this.runSnTools(args);
    }

    async createRecordExternal(table, prompt, options = {}) {
        console.log(chalk.blue(`\n🔗 External AI → sn-tools: Creating ${table} record`));
        return await this.executeCommand('create', {
            table,
            'ai-prompt': prompt,
            'ai-mode': options.aiMode || 'auto',
            ...options
        });
    }

    buildCommandArgs(operation, options) {
        const args = [operation];
        for (const [key, value] of Object.entries(options)) {
            if (value !== undefined && value !== null) {
                args.push(`--${key}`, String(value));
            }
        }
        return args;
    }

    async runSnTools(args) {
        return new Promise((resolve, reject) => {
            const child = spawn('node', [this.snToolsPath, ...args], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(output);
                stdout += output;
            });

            child.stderr.on('data', (data) => {
                const error = data.toString();
                console.error(chalk.red(error));
                stderr += error;
            });

            child.on('close', (code) => {
                this.log(`Command completed with code: ${code}`);
                if (code === 0) {
                    resolve({ success: true, code, stdout: stdout.trim(), stderr: stderr.trim() });
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });

            child.on('error', (error) => {
                this.log(`Command error: ${error.message}`);
                reject(error);
            });
        });
    }

    // ===== UTILITY METHODS =====

    getConfig() {
        try {
            const ConfigManager = require('./sn-config-manager');
            return ConfigManager.getConfig();
        } catch (error) {
            return { ai: {}, claude: {}, instances: {}, routing: {} };
        }
    }

    buildContext(table, options) {
        const config = this.getConfig();
        const context = {
            table: table,
            project: config.project,
            instance: config.routing?.tables?.[table] || config.routing?.default,
            scopePrefix: config.project?.scopePrefix,
            timestamp: new Date().toISOString()
        };

        // Add CLAUDE.md context if available
        if (options.includeContext !== false) {
            context.claudeFiles = this.discoverClaudeFiles();
            context.exampleFile = options.exampleFile ? this.readExampleFile(options.exampleFile) : null;
        }

        return context;
    }

    /**
     * Discover CLAUDE.md files from parent folder and down
     * Searches up to 3 levels up from current directory and all subdirectories
     */
    discoverClaudeFiles() {
        const claudeFiles = [];
        const searchedPaths = new Set();

        // Helper to find CLAUDE.md recursively
        const findClaudeMd = (dir, maxDepth = 3, currentDepth = 0) => {
            if (currentDepth > maxDepth || searchedPaths.has(dir)) return;
            searchedPaths.add(dir);

            try {
                if (!fs.existsSync(dir)) return;

                const claudePath = path.join(dir, 'CLAUDE.md');
                if (fs.existsSync(claudePath)) {
                    try {
                        const content = fs.readFileSync(claudePath, 'utf8');
                        claudeFiles.push({
                            path: claudePath,
                            relativePath: path.relative(__dirname, claudePath),
                            content: content,
                            size: content.length
                        });
                    } catch (error) {
                        console.log(chalk.yellow(`⚠️  Could not read ${claudePath}: ${error.message}`));
                    }
                }

                // Search subdirectories (one level down only to avoid too many files)
                if (currentDepth === 0) {
                    try {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                                findClaudeMd(path.join(dir, entry.name), 0, 1);
                            }
                        }
                    } catch (error) {
                        // Ignore read errors for subdirectories
                    }
                }
            } catch (error) {
                // Ignore errors for individual directories
            }
        };

        // Start from current directory
        let currentDir = __dirname;

        // Search current directory and subdirectories
        findClaudeMd(currentDir, 0, 0);

        // Search up to 3 parent directories
        for (let i = 0; i < 3; i++) {
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) break; // Reached root
            currentDir = parentDir;
            findClaudeMd(currentDir, 0, 0);
        }

        if (claudeFiles.length > 0) {
            console.log(chalk.green(`📚 Found ${claudeFiles.length} CLAUDE.md file(s) for context`));
        }

        return claudeFiles;
    }

    /**
     * Read an example file to use as reference
     * @param {string} filePath - Path to the example file
     */
    readExampleFile(filePath) {
        try {
            // Handle both absolute and relative paths
            let fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);

            // Also try relative to parent directory
            if (!fs.existsSync(fullPath)) {
                fullPath = path.join(path.dirname(__dirname), filePath);
            }

            if (!fs.existsSync(fullPath)) {
                console.log(chalk.yellow(`⚠️  Example file not found: ${filePath}`));
                return null;
            }

            const content = fs.readFileSync(fullPath, 'utf8');
            const stats = fs.statSync(fullPath);

            console.log(chalk.green(`📄 Using example file: ${path.basename(fullPath)} (${stats.size} bytes)`));

            return {
                path: fullPath,
                relativePath: path.relative(__dirname, fullPath),
                basename: path.basename(fullPath),
                content: content,
                size: stats.size,
                extension: path.extname(fullPath)
            };
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not read example file: ${error.message}`));
            return null;
        }
    }

    buildPrompt(userPrompt, context, table, provider) {
        let prompt = `You are a ServiceNow development expert. Create a ${table} record based on the user's request.

**Context:**
- Project: ${context.project?.name || 'Unknown'}
- Scope: ${context.scopePrefix || 'x_'}
- Table: ${table}
- Instance: ${context.instance || 'default'}
`;

        // Add CLAUDE.md context if available
        if (context.claudeFiles && context.claudeFiles.length > 0) {
            prompt += `\n**Project Documentation (CLAUDE.md files):**\n`;
            for (const claudeFile of context.claudeFiles) {
                const truncatedContent = this.truncateContent(claudeFile.content, 2000);
                prompt += `\nFrom: ${claudeFile.relativePath}\n---\n${truncatedContent}\n---\n`;
            }
        }

        // Add example file context if available
        if (context.exampleFile) {
            const truncatedExample = this.truncateContent(context.exampleFile.content, 1500);
            prompt += `\n**Example Reference (${context.exampleFile.basename}):**\n`;
            prompt += `Use this as a reference for structure and style:\n---\n${truncatedExample}\n---\n`;
        }

        prompt += `
**User Request:**
${userPrompt}

**Requirements:**
1. Generate valid ServiceNow record data
2. Follow naming conventions (${context.scopePrefix || 'x_'}_*)
3. Include all required fields
4. If CLAUDE.md or example files are provided above, follow their patterns and conventions
5. Return ONLY valid JSON in this format:
{
  "record": { /* field values */ },
  "metadata": {
    "table": "${table}",
    "summary": "brief description",
    "confidence": 0.95
  }
}

Generate the record now:`;

        return prompt;
    }

    /**
     * Truncate content to a maximum length while preserving readability
     * @param {string} content - Content to truncate
     * @param {number} maxLength - Maximum length in characters
     */
    truncateContent(content, maxLength) {
        if (!content || content.length <= maxLength) return content;

        // Try to truncate at a newline near the limit
        const truncated = content.substring(0, maxLength);
        const lastNewline = truncated.lastIndexOf('\n');

        if (lastNewline > maxLength * 0.8) {
            return truncated.substring(0, lastNewline) + '\n\n[... content truncated for brevity ...]';
        }

        return truncated + '\n\n[... content truncated for brevity ...]';
    }

    parseAIResponse(output, table, provider) {
        try {
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in AI response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const record = parsed.record || parsed;

            this.validateGeneratedRecord(record, table);

            return {
                success: true,
                provider: provider,
                record: record,
                metadata: parsed.metadata || {
                    table: table,
                    summary: 'AI-generated record',
                    confidence: 0.85
                },
                rawOutput: output
            };
        } catch (error) {
            throw new Error(`Failed to parse AI response: ${error.message}`);
        }
    }

    validateInputs(table, userPrompt, provider) {
        if (!table || typeof table !== 'string') {
            throw new Error('Invalid table name');
        }

        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length < 5) {
            throw new Error('Invalid or too short user prompt');
        }

        if (!provider || !provider.detected) {
            throw new Error('Invalid or unavailable AI provider');
        }

        const dangerousPatterns = [/[;&|`$\(\)<>]/, /rm\s+-rf/, /sudo/, /chmod/, /\.\.\//, /eval\(/];
        if (dangerousPatterns.some(pattern => pattern.test(userPrompt))) {
            throw new Error('Potentially unsafe prompt detected');
        }
    }

    validateGeneratedRecord(record, table) {
        if (!record || typeof record !== 'object') {
            throw new Error('Invalid record structure');
        }

        const requiredFields = this.getRequiredFields(table);
        const missing = requiredFields.filter(field => !record[field]);

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        const config = this.getConfig();
        if (record.name && config.project?.scopePrefix) {
            const expectedPrefix = config.project.scopePrefix + '_';
            if (!record.name.startsWith(expectedPrefix)) {
                record.name = expectedPrefix + record.name.replace(/^[^_]*_?/, '');
            }
        }
    }

    getRequiredFields(table) {
        const fieldMap = {
            'sys_script_include': ['name', 'script'],
            'sys_ws_operation': ['name', 'script'],
            'sys_script': ['name', 'script', 'table'],
            'sys_ui_action': ['name', 'script'],
            'sys_script_client': ['name', 'script']
        };
        return fieldMap[table] || ['name'];
    }

    displayDetectionResults() {
        console.log(chalk.blue('\n🤖 AI Provider Status:\n'));
        this.providers.forEach((provider, id) => {
            const status = provider.detected ?
                (provider.enabled ? chalk.green('✓ Available') : chalk.yellow('○ Disabled')) :
                chalk.red('✗ Not Found');

            console.log(`${provider.name} (Priority ${provider.priority}): ${status}`);
            if (provider.version) {
                console.log(`  Version: ${provider.version}`);
            }
            console.log(`  Capabilities: ${provider.capabilities.join(', ')}`);
            console.log('');
        });
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logLine = `${timestamp} - ${message}${data ? ' - ' + JSON.stringify(data) : ''}\n`;
        try {
            fs.appendFileSync(this.logFile, logLine);
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    getStatus() {
        return {
            initialized: this.initialized,
            providers: Array.from(this.providers.values()),
            cache: {
                valid: this.isCacheValid(),
                age: Date.now() - this.cache.timestamp,
                providers: Object.keys(this.cache.detections).length
            },
            processes: this.getProcessStatus()
        };
    }

    getProcessStatus() {
        const processes = [];
        this.activeProcesses.forEach((info, id) => {
            processes.push({
                id,
                command: info.command,
                running: !info.process.killed,
                duration: Date.now() - info.startTime,
                timeout: info.timeout
            });
        });
        return processes;
    }

    cleanup() {
        console.log(chalk.yellow('🧹 Cleaning up AI system...'));
        const processIds = Array.from(this.activeProcesses.keys());
        processIds.forEach(id => this.terminateProcess(id));
        this.activeProcesses.clear();
        this.saveCache();
        this.emit('cleanup', processIds.length);
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance() {
        if (!instance) {
            instance = new UnifiedAI();
        }
        return instance;
    },

    // Convenience methods for backward compatibility
    getCached: () => module.exports.getInstance().getCachedDetections(),
    cache: (detections) => module.exports.getInstance().cacheDetections(detections),
    execute: (command, args, options) => module.exports.getInstance().executeAICommand(command, args, options),
    createRecord: (table, prompt, options) => module.exports.getInstance().createRecord(table, prompt, options),
    getStatus: () => module.exports.getInstance().getStatus(),
    cleanup: () => module.exports.getInstance().cleanup()
};

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(chalk.blue('\n🤖 Unified AI Interface for ServiceNow Tools\n'));
        console.log('Usage examples:');
        console.log('  node sn-ai-unified.js create --table sys_script_include --ai-prompt "Create utility"');
        console.log('  node sn-ai-unified.js status');
        console.log('  node sn-ai-unified.js test');
        return;
    }

    const ai = module.exports.getInstance();
    const command = args[0];

    switch (command) {
        case 'status':
            console.log(JSON.stringify(ai.getStatus(), null, 2));
            break;
        case 'test':
            ai.initialize().then(() => {
                console.log(chalk.green('✅ AI system initialized successfully'));
                ai.displayDetectionResults();
            }).catch(error => {
                console.error(chalk.red('❌ AI initialization failed:'), error.message);
            });
            break;
        default:
            console.log(chalk.red('Unknown command. Use: status, test'));
    }
}