/**
 * Base Agent Class
 * Abstract base class for all agents in the multi-agent system
 */

const EventEmitter = require('events');
const { generateUUID, sleep, PriorityQueue } = require('./utils');

class BaseAgent extends EventEmitter {
    constructor(config) {
        super();

        // Agent identity
        this.id = config.id || generateUUID();
        this.name = config.name || 'UnnamedAgent';
        this.type = config.type || 'generic';

        // Agent state
        this.state = 'uninitialized'; // uninitialized | idle | busy | error | stopped
        this.capabilities = config.capabilities || [];

        // Communication
        this.messageBus = config.messageBus || null;
        this.orchestratorId = config.orchestratorId || 'orchestrator';
        this.taskQueue = new PriorityQueue();
        this.subscriptions = new Map();
        this.pendingRequests = new Map(); // correlationId -> resolver

        // Configuration
        this.config = config.agentConfig || {};

        // State & Metrics
        this.metrics = {
            tasksProcessed: 0,
            tasksSucceeded: 0,
            tasksFailed: 0,
            averageTaskTime: 0,
            lastTaskTime: null,
            uptime: 0,
            startTime: null,
            lastActivityTime: null
        };

        // Health
        this.healthStatus = 'unknown';
        this.lastHealthCheck = null;
        this.errors = [];
        this.maxErrors = 10;

        // Processing control
        this.processing = false;
        this.shutdownRequested = false;
    }

    // ==================== Lifecycle Methods ====================

    /**
     * Initialize the agent
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.state !== 'uninitialized') {
            throw new Error(`Cannot initialize agent in state: ${this.state}`);
        }

        console.log(`[${this.name}] Initializing...`);

        try {
            // Register with orchestrator
            await this.registerWithOrchestrator();

            // Setup message bus subscriptions
            await this.setupSubscriptions();

            // Load agent-specific configuration
            await this.loadConfiguration();

            // Run agent-specific initialization
            await this.onInitialize();

            this.state = 'idle';
            this.healthStatus = 'healthy';
            this.metrics.startTime = Date.now();
            this.lastHealthCheck = Date.now();

            this.emit('initialized', { agentId: this.id, name: this.name });
            console.log(`[${this.name}] Initialized successfully`);
        } catch (error) {
            this.state = 'error';
            this.healthStatus = 'unhealthy';
            this.addError(error);
            console.error(`[${this.name}] Initialization failed:`, error.message);
            throw error;
        }
    }

    /**
     * Start the agent
     * @returns {Promise<void>}
     */
    async start() {
        if (this.state === 'uninitialized') {
            throw new Error('Agent must be initialized before starting');
        }

        console.log(`[${this.name}] Starting...`);

        this.state = 'idle';
        this.processing = true;
        this.shutdownRequested = false;

        // Start processing loop
        this.startProcessingLoop();

        // Run agent-specific start logic
        await this.onStart();

        this.emit('started', { agentId: this.id, name: this.name });
        console.log(`[${this.name}] Started successfully`);
    }

    /**
     * Stop the agent gracefully
     * @returns {Promise<void>}
     */
    async stop() {
        console.log(`[${this.name}] Stopping...`);

        this.shutdownRequested = true;
        this.state = 'stopped';

        // Wait for current task to complete
        while (this.state === 'busy') {
            await sleep(100);
        }

        // Run agent-specific stop logic
        await this.onStop();

        // Unsubscribe from all topics
        await this.cleanupSubscriptions();

        // Unregister from orchestrator
        await this.unregisterFromOrchestrator();

        this.emit('stopped', { agentId: this.id, name: this.name });
        console.log(`[${this.name}] Stopped successfully`);
    }

    /**
     * Restart the agent
     * @returns {Promise<void>}
     */
    async restart() {
        console.log(`[${this.name}] Restarting...`);
        await this.stop();
        await this.start();
    }

    // ==================== Communication Methods ====================

    /**
     * Send a message to another agent or orchestrator
     * @param {string} to - Target agent ID or type
     * @param {Object} payload - Message payload
     * @param {Object} options - Message options
     * @returns {Promise<Object>} Response
     */
    async sendMessage(to, payload, options = {}) {
        if (!this.messageBus) {
            throw new Error('Message bus not configured');
        }

        const message = {
            id: generateUUID(),
            type: options.type || 'request',
            from: this.id,
            fromName: this.name,
            to: to,
            payload: payload,
            timestamp: Date.now(),
            correlationId: options.correlationId || generateUUID(),
            priority: options.priority || 5,
            requiresAck: options.requiresAck !== false,
            timeout: options.timeout || 30000
        };

        if (message.requiresAck) {
            // Wait for response
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this.pendingRequests.delete(message.correlationId);
                    reject(new Error(`Message timeout after ${message.timeout}ms`));
                }, message.timeout);

                this.pendingRequests.set(message.correlationId, {
                    resolve: (response) => {
                        clearTimeout(timeoutId);
                        resolve(response);
                    },
                    reject: (error) => {
                        clearTimeout(timeoutId);
                        reject(error);
                    }
                });

                this.messageBus.send(message).catch(reject);
            });
        } else {
            // Fire and forget
            return await this.messageBus.send(message);
        }
    }

    /**
     * Receive and queue a message
     * @param {Object} message - Incoming message
     */
    async receiveMessage(message) {
        // Check if this is a response to a pending request
        if (message.type === 'response' && this.pendingRequests.has(message.correlationId)) {
            const pending = this.pendingRequests.get(message.correlationId);
            this.pendingRequests.delete(message.correlationId);

            if (message.error) {
                pending.reject(new Error(message.error));
            } else {
                pending.resolve(message.payload);
            }
            return;
        }

        // Queue the message for processing
        this.taskQueue.enqueue(message, message.priority || 5);
        this.metrics.lastActivityTime = Date.now();
    }

    /**
     * Subscribe to a topic
     * @param {string} topic - Topic name
     * @param {Function} handler - Message handler
     */
    async subscribe(topic, handler) {
        if (!this.messageBus) {
            throw new Error('Message bus not configured');
        }

        this.subscriptions.set(topic, handler);
        await this.messageBus.subscribe(topic, handler.bind(this));
        console.log(`[${this.name}] Subscribed to topic: ${topic}`);
    }

    /**
     * Publish to a topic
     * @param {string} topic - Topic name
     * @param {Object} data - Data to publish
     */
    async publish(topic, data) {
        if (!this.messageBus) {
            throw new Error('Message bus not configured');
        }

        await this.messageBus.publish(topic, {
            publisherId: this.id,
            publisherName: this.name,
            topic: topic,
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Send a response to a message
     * @param {Object} originalMessage - Original request message
     * @param {Object} payload - Response payload
     * @param {Error} error - Error if any
     */
    async sendResponse(originalMessage, payload, error = null) {
        const response = {
            id: generateUUID(),
            type: 'response',
            from: this.id,
            fromName: this.name,
            to: originalMessage.from,
            payload: error ? null : payload,
            error: error ? error.message : null,
            timestamp: Date.now(),
            correlationId: originalMessage.correlationId,
            priority: originalMessage.priority
        };

        await this.messageBus.send(response);
    }

    // ==================== Task Processing ====================

    /**
     * Start the message processing loop
     */
    async startProcessingLoop() {
        console.log(`[${this.name}] Starting processing loop`);

        while (!this.shutdownRequested) {
            try {
                if (this.state === 'idle' && !this.taskQueue.isEmpty()) {
                    const message = this.taskQueue.dequeue();
                    await this.handleTask(message);
                } else {
                    await sleep(50); // Prevent busy waiting
                }
            } catch (error) {
                console.error(`[${this.name}] Error in processing loop:`, error);
                this.addError(error);
                await sleep(1000); // Back off on error
            }
        }

        console.log(`[${this.name}] Processing loop stopped`);
    }

    /**
     * Handle a task from the queue
     * @param {Object} message - Task message
     */
    async handleTask(message) {
        const startTime = Date.now();
        this.state = 'busy';
        this.metrics.lastActivityTime = Date.now();

        try {
            console.log(`[${this.name}] Processing task: ${message.payload?.action || 'unknown'}`);

            const result = await this.processTask(message.payload);

            this.metrics.tasksSucceeded++;
            this.updateMetrics(startTime);
            this.state = 'idle';

            // Send response if required
            if (message.requiresAck) {
                await this.sendResponse(message, result);
            }

            this.emit('task-completed', { message, result });
            console.log(`[${this.name}] Task completed successfully`);

            return { success: true, result };
        } catch (error) {
            this.metrics.tasksFailed++;
            this.addError(error);

            // Send error response if required
            if (message.requiresAck) {
                await this.sendResponse(message, null, error);
            }

            this.emit('task-failed', { message, error });
            console.error(`[${this.name}] Task failed:`, error.message);

            // Decide whether to enter error state
            if (this.errors.length >= 5) {
                this.state = 'error';
                this.healthStatus = 'unhealthy';
            } else {
                this.state = 'idle';
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Process a task - must be implemented by subclasses
     * @param {Object} payload - Task payload
     * @returns {Promise<any>} Result
     */
    async processTask(payload) {
        throw new Error('processTask must be implemented by subclass');
    }

    /**
     * Delegate a task to another agent
     * @param {string} toAgentType - Target agent type
     * @param {Object} task - Task to delegate
     * @returns {Promise<any>} Result
     */
    async delegateTask(toAgentType, task) {
        console.log(`[${this.name}] Delegating task to ${toAgentType}`);

        return await this.sendMessage(this.orchestratorId, {
            action: 'route-task',
            targetAgentType: toAgentType,
            task: task
        });
    }

    // ==================== Health & Metrics ====================

    /**
     * Perform health check
     * @returns {Object} Health status
     */
    async healthCheck() {
        this.lastHealthCheck = Date.now();

        const health = {
            agentId: this.id,
            name: this.name,
            type: this.type,
            state: this.state,
            healthStatus: this.healthStatus,
            metrics: { ...this.metrics },
            uptime: this.metrics.startTime ? Date.now() - this.metrics.startTime : 0,
            queueSize: this.taskQueue.size(),
            errorCount: this.errors.length,
            capabilities: [...this.capabilities],
            lastActivityTime: this.metrics.lastActivityTime,
            timestamp: Date.now()
        };

        // Update health status based on state and errors
        if (this.state === 'error' || this.errors.length >= 5) {
            this.healthStatus = 'unhealthy';
        } else if (this.state === 'stopped') {
            this.healthStatus = 'stopped';
        } else {
            this.healthStatus = 'healthy';
        }

        health.healthStatus = this.healthStatus;

        return health;
    }

    /**
     * Get metrics
     * @returns {Object} Metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Update metrics after task completion
     * @param {number} taskStartTime - Task start time
     */
    updateMetrics(taskStartTime) {
        const duration = Date.now() - taskStartTime;
        this.metrics.tasksProcessed++;
        this.metrics.lastTaskTime = duration;

        // Calculate moving average
        const totalTasks = this.metrics.tasksProcessed;
        this.metrics.averageTaskTime =
            (this.metrics.averageTaskTime * (totalTasks - 1) + duration) / totalTasks;
    }

    /**
     * Add an error to the error log
     * @param {Error} error - Error object
     */
    addError(error) {
        this.errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });

        // Keep only last N errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        this.emit('error', error);
    }

    // ==================== Agent-Specific Hooks ====================

    /**
     * Called during initialization - override in subclasses
     */
    async onInitialize() {
        // Override in subclasses
    }

    /**
     * Called during start - override in subclasses
     */
    async onStart() {
        // Override in subclasses
    }

    /**
     * Called during stop - override in subclasses
     */
    async onStop() {
        // Override in subclasses
    }

    /**
     * Setup subscriptions - override in subclasses
     */
    async setupSubscriptions() {
        // Override in subclasses to subscribe to topics
    }

    /**
     * Load configuration - override in subclasses
     */
    async loadConfiguration() {
        // Override in subclasses
    }

    // ==================== Private Helper Methods ====================

    /**
     * Register with orchestrator
     */
    async registerWithOrchestrator() {
        if (!this.messageBus) {
            console.warn(`[${this.name}] No message bus, skipping orchestrator registration`);
            return;
        }

        try {
            await this.sendMessage(this.orchestratorId, {
                action: 'register-agent',
                agentId: this.id,
                name: this.name,
                type: this.type,
                capabilities: this.capabilities
            }, { timeout: 5000 });

            console.log(`[${this.name}] Registered with orchestrator`);
        } catch (error) {
            console.warn(`[${this.name}] Failed to register with orchestrator:`, error.message);
        }
    }

    /**
     * Unregister from orchestrator
     */
    async unregisterFromOrchestrator() {
        if (!this.messageBus) {
            return;
        }

        try {
            await this.sendMessage(this.orchestratorId, {
                action: 'unregister-agent',
                agentId: this.id
            }, { timeout: 5000, requiresAck: false });

            console.log(`[${this.name}] Unregistered from orchestrator`);
        } catch (error) {
            console.warn(`[${this.name}] Failed to unregister from orchestrator:`, error.message);
        }
    }

    /**
     * Cleanup subscriptions
     */
    async cleanupSubscriptions() {
        for (const [topic, handler] of this.subscriptions) {
            try {
                await this.messageBus.unsubscribe(topic, handler);
            } catch (error) {
                console.warn(`[${this.name}] Failed to unsubscribe from ${topic}:`, error.message);
            }
        }
        this.subscriptions.clear();
    }
}

module.exports = { BaseAgent };
