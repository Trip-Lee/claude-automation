/**
 * State Manager for Multi-Agent System
 * Manages shared state and context across agents
 */

const EventEmitter = require('events');

class StateManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.backend = config.backend || 'memory'; // memory | redis
        this.store = new Map(); // Main state store
        this.cache = new Map(); // Cache with TTL
        this.locks = new Map(); // Optimistic locks
        this.eventLog = []; // Event sourcing log
        this.maxEventLog = config.maxEventLog || 10000;
    }

    /**
     * Initialize the state manager
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('[StateManager] Initializing...');

        if (this.backend === 'redis') {
            // TODO: Initialize Redis
            console.warn('[StateManager] Redis backend not implemented, using memory');
            this.backend = 'memory';
        }

        console.log('[StateManager] Initialized successfully');
    }

    // ==================== Basic State Operations ====================

    /**
     * Set a state value
     * @param {string} key - State key
     * @param {any} value - State value
     * @param {Object} options - Options (namespace, ttl)
     * @returns {Promise<void>}
     */
    async set(key, value, options = {}) {
        const fullKey = this.buildKey(key, options.namespace);

        // Check for lock
        if (options.requireLock && this.locks.has(fullKey)) {
            const lock = this.locks.get(fullKey);
            if (lock.holder !== options.lockHolder) {
                throw new Error(`Key is locked by ${lock.holder}`);
            }
        }

        this.store.set(fullKey, value);

        // Set TTL if specified
        if (options.ttl) {
            setTimeout(() => {
                this.store.delete(fullKey);
                this.emit('state-expired', { key: fullKey });
            }, options.ttl);
        }

        // Log event
        this.logEvent('set', fullKey, value);

        // Emit change event
        this.emit('state-changed', { key: fullKey, value, operation: 'set' });

        return value;
    }

    /**
     * Get a state value
     * @param {string} key - State key
     * @param {Object} options - Options (namespace, default)
     * @returns {Promise<any>} Value
     */
    async get(key, options = {}) {
        const fullKey = this.buildKey(key, options.namespace);

        if (this.store.has(fullKey)) {
            return this.store.get(fullKey);
        }

        return options.default !== undefined ? options.default : null;
    }

    /**
     * Delete a state value
     * @param {string} key - State key
     * @param {Object} options - Options (namespace)
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(key, options = {}) {
        const fullKey = this.buildKey(key, options.namespace);
        const existed = this.store.has(fullKey);

        if (existed) {
            this.store.delete(fullKey);
            this.logEvent('delete', fullKey, null);
            this.emit('state-changed', { key: fullKey, operation: 'delete' });
        }

        return existed;
    }

    /**
     * Check if a key exists
     * @param {string} key - State key
     * @param {Object} options - Options (namespace)
     * @returns {Promise<boolean>}
     */
    async has(key, options = {}) {
        const fullKey = this.buildKey(key, options.namespace);
        return this.store.has(fullKey);
    }

    /**
     * Get all keys in a namespace
     * @param {string} namespace - Namespace
     * @returns {Promise<Array>} Array of keys
     */
    async keys(namespace = '') {
        const prefix = namespace ? `${namespace}:` : '';
        const keys = [];

        for (const key of this.store.keys()) {
            if (!namespace || key.startsWith(prefix)) {
                keys.push(namespace ? key.substring(prefix.length) : key);
            }
        }

        return keys;
    }

    /**
     * Clear all state in a namespace
     * @param {string} namespace - Namespace (empty for all)
     * @returns {Promise<number>} Number of keys cleared
     */
    async clear(namespace = '') {
        let count = 0;
        const keysToDelete = [];

        const prefix = namespace ? `${namespace}:` : '';

        for (const key of this.store.keys()) {
            if (!namespace || key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.store.delete(key);
            count++;
        }

        this.logEvent('clear', namespace, count);
        this.emit('state-cleared', { namespace, count });

        return count;
    }

    // ==================== Advanced Operations ====================

    /**
     * Increment a numeric value atomically
     * @param {string} key - State key
     * @param {number} delta - Amount to increment
     * @param {Object} options - Options (namespace)
     * @returns {Promise<number>} New value
     */
    async increment(key, delta = 1, options = {}) {
        const fullKey = this.buildKey(key, options.namespace);
        const current = (await this.get(key, options)) || 0;
        const newValue = current + delta;
        await this.set(key, newValue, options);
        return newValue;
    }

    /**
     * Decrement a numeric value atomically
     * @param {string} key - State key
     * @param {number} delta - Amount to decrement
     * @param {Object} options - Options (namespace)
     * @returns {Promise<number>} New value
     */
    async decrement(key, delta = 1, options = {}) {
        return await this.increment(key, -delta, options);
    }

    /**
     * Append to an array
     * @param {string} key - State key
     * @param {any} value - Value to append
     * @param {Object} options - Options (namespace)
     * @returns {Promise<Array>} Updated array
     */
    async append(key, value, options = {}) {
        const current = (await this.get(key, options)) || [];

        if (!Array.isArray(current)) {
            throw new Error('Cannot append to non-array value');
        }

        current.push(value);
        await this.set(key, current, options);
        return current;
    }

    /**
     * Remove from an array
     * @param {string} key - State key
     * @param {any} value - Value to remove
     * @param {Object} options - Options (namespace)
     * @returns {Promise<Array>} Updated array
     */
    async remove(key, value, options = {}) {
        const current = (await this.get(key, options)) || [];

        if (!Array.isArray(current)) {
            throw new Error('Cannot remove from non-array value');
        }

        const index = current.indexOf(value);
        if (index > -1) {
            current.splice(index, 1);
        }

        await this.set(key, current, options);
        return current;
    }

    /**
     * Merge an object
     * @param {string} key - State key
     * @param {Object} value - Object to merge
     * @param {Object} options - Options (namespace)
     * @returns {Promise<Object>} Updated object
     */
    async merge(key, value, options = {}) {
        const current = (await this.get(key, options)) || {};

        if (typeof current !== 'object' || Array.isArray(current)) {
            throw new Error('Cannot merge with non-object value');
        }

        const merged = { ...current, ...value };
        await this.set(key, merged, options);
        return merged;
    }

    // ==================== Locking ====================

    /**
     * Acquire a lock on a key
     * @param {string} key - Key to lock
     * @param {string} holder - Lock holder ID
     * @param {number} ttl - Lock TTL in milliseconds
     * @returns {Promise<boolean>} True if lock acquired
     */
    async acquireLock(key, holder, ttl = 30000) {
        const fullKey = this.buildKey(key);

        if (this.locks.has(fullKey)) {
            const lock = this.locks.get(fullKey);

            // Check if lock has expired
            if (Date.now() > lock.expiresAt) {
                this.locks.delete(fullKey);
            } else {
                return false; // Lock is held by someone else
            }
        }

        // Acquire the lock
        this.locks.set(fullKey, {
            holder,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + ttl
        });

        // Auto-release after TTL
        setTimeout(() => {
            const currentLock = this.locks.get(fullKey);
            if (currentLock && currentLock.holder === holder) {
                this.locks.delete(fullKey);
                this.emit('lock-released', { key: fullKey, holder, reason: 'ttl' });
            }
        }, ttl);

        this.emit('lock-acquired', { key: fullKey, holder });
        return true;
    }

    /**
     * Release a lock
     * @param {string} key - Key to unlock
     * @param {string} holder - Lock holder ID
     * @returns {Promise<boolean>} True if lock released
     */
    async releaseLock(key, holder) {
        const fullKey = this.buildKey(key);
        const lock = this.locks.get(fullKey);

        if (!lock) {
            return false; // No lock exists
        }

        if (lock.holder !== holder) {
            throw new Error(`Lock is held by ${lock.holder}, not ${holder}`);
        }

        this.locks.delete(fullKey);
        this.emit('lock-released', { key: fullKey, holder, reason: 'manual' });
        return true;
    }

    /**
     * Check if a key is locked
     * @param {string} key - Key to check
     * @returns {Promise<Object|null>} Lock info or null
     */
    async isLocked(key) {
        const fullKey = this.buildKey(key);
        const lock = this.locks.get(fullKey);

        if (!lock) {
            return null;
        }

        // Check if expired
        if (Date.now() > lock.expiresAt) {
            this.locks.delete(fullKey);
            return null;
        }

        return { ...lock };
    }

    // ==================== Cache Operations ====================

    /**
     * Set a cached value with TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - TTL in milliseconds
     * @returns {Promise<void>}
     */
    async setCache(key, value, ttl = 300000) {
        const fullKey = this.buildKey(key, 'cache');

        this.cache.set(fullKey, {
            value,
            expiresAt: Date.now() + ttl
        });

        // Auto-expire
        setTimeout(() => {
            this.cache.delete(fullKey);
        }, ttl);
    }

    /**
     * Get a cached value
     * @param {string} key - Cache key
     * @returns {Promise<any|null>} Cached value or null
     */
    async getCache(key) {
        const fullKey = this.buildKey(key, 'cache');
        const cached = this.cache.get(fullKey);

        if (!cached) {
            return null;
        }

        // Check if expired
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(fullKey);
            return null;
        }

        return cached.value;
    }

    /**
     * Invalidate cache
     * @param {string} key - Cache key (or pattern)
     * @returns {Promise<number>} Number of keys invalidated
     */
    async invalidateCache(key) {
        const fullKey = this.buildKey(key, 'cache');
        let count = 0;

        // Support wildcard patterns
        if (key.includes('*')) {
            const pattern = new RegExp('^' + fullKey.replace(/\*/g, '.*') + '$');
            for (const cacheKey of this.cache.keys()) {
                if (pattern.test(cacheKey)) {
                    this.cache.delete(cacheKey);
                    count++;
                }
            }
        } else {
            if (this.cache.delete(fullKey)) {
                count = 1;
            }
        }

        return count;
    }

    // ==================== Event Sourcing ====================

    /**
     * Log an event
     * @private
     */
    logEvent(operation, key, value) {
        this.eventLog.push({
            operation,
            key,
            value,
            timestamp: Date.now()
        });

        // Keep log size under control
        if (this.eventLog.length > this.maxEventLog) {
            this.eventLog.shift();
        }
    }

    /**
     * Get event log
     * @param {number} limit - Number of events to return
     * @returns {Array} Recent events
     */
    getEventLog(limit = 100) {
        return this.eventLog.slice(-limit);
    }

    /**
     * Clear event log
     */
    clearEventLog() {
        this.eventLog = [];
    }

    // ==================== Statistics ====================

    /**
     * Get statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            backend: this.backend,
            storeSize: this.store.size,
            cacheSize: this.cache.size,
            lockCount: this.locks.size,
            eventLogSize: this.eventLog.length
        };
    }

    // ==================== Utilities ====================

    /**
     * Build a full key with namespace
     * @private
     */
    buildKey(key, namespace = '') {
        return namespace ? `${namespace}:${key}` : key;
    }

    /**
     * Shutdown the state manager
     */
    async shutdown() {
        console.log('[StateManager] Shutting down...');

        this.store.clear();
        this.cache.clear();
        this.locks.clear();
        this.eventLog = [];

        console.log('[StateManager] Shutdown complete');
    }
}

module.exports = { StateManager };
