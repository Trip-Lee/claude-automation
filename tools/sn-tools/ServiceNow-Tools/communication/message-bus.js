/**
 * Message Bus for Agent Communication
 * Supports in-memory and Redis backends
 */

const EventEmitter = require('events');

class MessageBus extends EventEmitter {
    constructor(config = {}) {
        super();
        this.backend = config.backend || 'memory'; // memory | redis
        this.topics = new Map(); // topic -> Set of handlers
        this.agents = new Map(); // agentId -> agent reference
        this.messageLog = []; // For debugging
        this.maxLogSize = config.maxLogSize || 1000;
        this.redis = null;
    }

    /**
     * Initialize the message bus
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log(`[MessageBus] Initializing with backend: ${this.backend}`);

        if (this.backend === 'redis') {
            await this.initializeRedis();
        }

        console.log('[MessageBus] Initialized successfully');
    }

    /**
     * Initialize Redis backend
     */
    async initializeRedis() {
        // TODO: Implement Redis support
        // const redis = require('redis');
        // this.redis = redis.createClient();
        // await this.redis.connect();
        console.warn('[MessageBus] Redis backend not yet implemented, falling back to memory');
        this.backend = 'memory';
    }

    /**
     * Register an agent with the message bus
     * @param {string} agentId - Agent ID
     * @param {Object} agent - Agent instance
     */
    registerAgent(agentId, agent) {
        this.agents.set(agentId, agent);
        console.log(`[MessageBus] Agent registered: ${agentId}`);
    }

    /**
     * Unregister an agent
     * @param {string} agentId - Agent ID
     */
    unregisterAgent(agentId) {
        this.agents.delete(agentId);
        console.log(`[MessageBus] Agent unregistered: ${agentId}`);
    }

    /**
     * Send a direct message to an agent
     * @param {Object} message - Message object
     * @returns {Promise<void>}
     */
    async send(message) {
        // Log the message
        this.logMessage(message);

        // Emit event for monitoring
        this.emit('message-sent', message);

        // Route to specific agent or orchestrator
        const targetAgent = this.agents.get(message.to);

        if (!targetAgent) {
            // Try to find by type if not found by ID
            const agentsByType = Array.from(this.agents.values()).filter(
                a => a.type === message.to || a.name === message.to
            );

            if (agentsByType.length > 0) {
                // Send to first matching agent
                await agentsByType[0].receiveMessage(message);
                return;
            }

            // If orchestrator, emit special event
            if (message.to === 'orchestrator') {
                this.emit('message-to-orchestrator', message);
                return;
            }

            throw new Error(`Target agent not found: ${message.to}`);
        }

        // Deliver message to target agent
        await targetAgent.receiveMessage(message);
    }

    /**
     * Publish a message to a topic
     * @param {string} topic - Topic name
     * @param {Object} data - Data to publish
     * @returns {Promise<void>}
     */
    async publish(topic, data) {
        // Log the publication
        this.logMessage({ type: 'publish', topic, data });

        // Emit event for monitoring
        this.emit('message-published', { topic, data });

        // Get all subscribers for this topic
        const handlers = this.topics.get(topic);

        if (!handlers || handlers.size === 0) {
            console.log(`[MessageBus] No subscribers for topic: ${topic}`);
            return;
        }

        // Deliver to all subscribers
        const promises = Array.from(handlers).map(handler => {
            try {
                return handler(data);
            } catch (error) {
                console.error(`[MessageBus] Error in subscriber for ${topic}:`, error);
                return Promise.resolve();
            }
        });

        await Promise.all(promises);
    }

    /**
     * Subscribe to a topic
     * @param {string} topic - Topic name
     * @param {Function} handler - Message handler
     * @returns {Promise<void>}
     */
    async subscribe(topic, handler) {
        if (!this.topics.has(topic)) {
            this.topics.set(topic, new Set());
        }

        this.topics.get(topic).add(handler);
        console.log(`[MessageBus] New subscription to topic: ${topic} (${this.topics.get(topic).size} subscribers)`);

        // If using Redis, subscribe to channel
        if (this.backend === 'redis' && this.redis) {
            // await this.redis.subscribe(topic);
        }
    }

    /**
     * Unsubscribe from a topic
     * @param {string} topic - Topic name
     * @param {Function} handler - Handler to remove
     * @returns {Promise<void>}
     */
    async unsubscribe(topic, handler) {
        const handlers = this.topics.get(topic);
        if (handlers) {
            handlers.delete(handler);

            if (handlers.size === 0) {
                this.topics.delete(topic);

                // If using Redis, unsubscribe from channel
                if (this.backend === 'redis' && this.redis) {
                    // await this.redis.unsubscribe(topic);
                }
            }
        }
    }

    /**
     * Get statistics about the message bus
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            backend: this.backend,
            registeredAgents: this.agents.size,
            topics: this.topics.size,
            messageLogSize: this.messageLog.length,
            topicSubscribers: Array.from(this.topics.entries()).map(([topic, handlers]) => ({
                topic,
                subscribers: handlers.size
            }))
        };
    }

    /**
     * Get message log
     * @param {number} limit - Number of messages to return
     * @returns {Array} Recent messages
     */
    getMessageLog(limit = 100) {
        return this.messageLog.slice(-limit);
    }

    /**
     * Clear message log
     */
    clearMessageLog() {
        this.messageLog = [];
    }

    /**
     * Log a message for debugging
     * @private
     */
    logMessage(message) {
        this.messageLog.push({
            ...message,
            loggedAt: Date.now()
        });

        // Keep log size under control
        if (this.messageLog.length > this.maxLogSize) {
            this.messageLog.shift();
        }
    }

    /**
     * Shutdown the message bus
     */
    async shutdown() {
        console.log('[MessageBus] Shutting down...');

        // Clear all subscriptions
        this.topics.clear();
        this.agents.clear();

        // Disconnect from Redis if connected
        if (this.redis) {
            await this.redis.quit();
        }

        console.log('[MessageBus] Shutdown complete');
    }
}

module.exports = { MessageBus };
