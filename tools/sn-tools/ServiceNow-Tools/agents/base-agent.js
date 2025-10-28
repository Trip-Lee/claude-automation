/**
 * Base Agent Class - Foundation for all ServiceNow analysis agents
 * Provides common functionality for data loading, caching, and inter-agent communication
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class BaseAgent extends EventEmitter {
    constructor(name, config = {}) {
        super();
        this.name = name;
        this.config = config;
        this.rootPath = path.join(__dirname, '..', '..');
        this.cache = new Map();
        this.dependencies = new Set();
        this.status = 'idle';
        this.lastActivity = new Date();
        
        // Shared message bus for inter-agent communication
        this.messageBus = null;
        
        // Performance metrics
        this.metrics = {
            tasksCompleted: 0,
            avgResponseTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m'
        };
    }

    /**
     * Initialize the agent
     */
    async initialize() {
        this.log(`Initializing ${this.name}...`, 'yellow');
        this.status = 'initializing';
        
        try {
            await this.loadData();
            this.status = 'ready';
            this.log(`${this.name} ready`, 'green');
            this.emit('ready', { agent: this.name });
        } catch (error) {
            this.status = 'error';
            this.logError(`Failed to initialize: ${error.message}`);
            this.emit('error', { agent: this.name, error });
        }
    }

    /**
     * Load data - to be implemented by child classes
     */
    async loadData() {
        // Override in child classes
    }

    /**
     * Process a request
     */
    async process(request) {
        const startTime = Date.now();
        this.status = 'processing';
        this.lastActivity = new Date();
        
        try {
            const result = await this.handleRequest(request);
            
            // Update metrics
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime);
            
            this.status = 'ready';
            return {
                success: true,
                agent: this.name,
                result,
                responseTime
            };
        } catch (error) {
            this.status = 'error';
            this.logError(`Processing failed: ${error.message}`);
            return {
                success: false,
                agent: this.name,
                error: error.message
            };
        }
    }

    /**
     * Handle request - to be implemented by child classes
     */
    async handleRequest(request) {
        throw new Error('handleRequest must be implemented by child class');
    }

    /**
     * Send message to another agent
     */
    async sendMessage(targetAgent, message) {
        if (!this.messageBus) {
            throw new Error('Message bus not configured');
        }
        
        return this.messageBus.send(targetAgent, {
            from: this.name,
            timestamp: new Date(),
            ...message
        });
    }

    /**
     * Request data from another agent
     */
    async requestFrom(targetAgent, request) {
        this.log(`Requesting from ${targetAgent}: ${request.type}`, 'dim');
        
        const response = await this.sendMessage(targetAgent, {
            type: 'request',
            request
        });
        
        return response;
    }

    /**
     * Cache management
     */
    getCached(key) {
        if (this.cache.has(key)) {
            this.metrics.cacheHits++;
            return this.cache.get(key);
        }
        this.metrics.cacheMisses++;
        return null;
    }

    setCached(key, value, ttl = 300000) { // 5 minutes default TTL
        this.cache.set(key, {
            value,
            expires: Date.now() + ttl
        });
    }

    clearExpiredCache() {
        const now = Date.now();
        for (const [key, item] of this.cache) {
            if (item.expires < now) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Utility methods
     */
    log(message, color = 'white') {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        console.log(`${this.colors.dim}[${timestamp}]${this.colors.reset} ${this.colors.cyan}[${this.name}]${this.colors.reset} ${this.colors[color]}${message}${this.colors.reset}`);
    }

    logError(message) {
        this.log(`ERROR: ${message}`, 'red');
    }

    logSuccess(message) {
        this.log(message, 'green');
    }

    updateMetrics(responseTime) {
        this.metrics.tasksCompleted++;
        this.metrics.avgResponseTime = 
            (this.metrics.avgResponseTime * (this.metrics.tasksCompleted - 1) + responseTime) / 
            this.metrics.tasksCompleted;
    }

    getStatus() {
        return {
            name: this.name,
            status: this.status,
            lastActivity: this.lastActivity,
            metrics: this.metrics,
            cacheSize: this.cache.size
        };
    }

    /**
     * File system utilities
     */
    getAllFiles(dir, ext) {
        const files = [];
        
        const walk = (currentDir) => {
            try {
                const entries = fs.readdirSync(currentDir);
                
                entries.forEach(entry => {
                    const fullPath = path.join(currentDir, entry);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
                        walk(fullPath);
                    } else if (ext ? fullPath.endsWith(ext) : true) {
                        files.push(fullPath);
                    }
                });
            } catch (e) {
                // Skip inaccessible directories
            }
        };
        
        walk(dir);
        return files;
    }

    readJSON(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Cleanup
     */
    async shutdown() {
        this.log('Shutting down...', 'yellow');
        this.status = 'shutdown';
        this.cache.clear();
        this.removeAllListeners();
    }
}

module.exports = BaseAgent;