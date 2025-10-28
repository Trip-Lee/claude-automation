/**
 * Utility functions for the multi-agent system
 */

const crypto = require('crypto');

/**
 * Generate a unique UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Create a throttled function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function}
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        onRetry = null
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries - 1) {
                if (onRetry) {
                    onRetry(attempt + 1, error);
                }

                await sleep(delay);
                delay = Math.min(delay * backoffMultiplier, maxDelay);
            }
        }
    }

    throw lastError;
}

/**
 * Create a timeout promise
 * @param {number} ms - Milliseconds to wait
 * @param {string} message - Error message
 * @returns {Promise<never>}
 */
function createTimeout(ms, message = 'Operation timed out') {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
    });
}

/**
 * Race a promise against a timeout
 * @param {Promise} promise - Promise to race
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout error message
 * @returns {Promise<any>}
 */
async function promiseWithTimeout(promise, ms, message) {
    return Promise.race([
        promise,
        createTimeout(ms, message)
    ]);
}

/**
 * Priority Queue implementation
 */
class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(item, priority) {
        const queueItem = { item, priority };
        let added = false;

        for (let i = 0; i < this.items.length; i++) {
            if (queueItem.priority > this.items[i].priority) {
                this.items.splice(i, 0, queueItem);
                added = true;
                break;
            }
        }

        if (!added) {
            this.items.push(queueItem);
        }
    }

    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items.shift().item;
    }

    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[0].item;
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    clear() {
        this.items = [];
    }
}

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
    constructor(options = {}) {
        this.maxTokens = options.maxRequests || 100;
        this.windowMs = options.windowMs || 60000;
        this.tokens = this.maxTokens;
        this.lastRefill = Date.now();
    }

    async acquire() {
        this.refill();

        if (this.tokens > 0) {
            this.tokens--;
            return Promise.resolve();
        }

        // Wait until tokens are available
        const waitTime = this.windowMs - (Date.now() - this.lastRefill);
        await sleep(Math.max(0, waitTime));

        this.refill();
        this.tokens--;
    }

    refill() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;

        if (timePassed >= this.windowMs) {
            this.tokens = this.maxTokens;
            this.lastRefill = now;
        }
    }

    getAvailableTokens() {
        this.refill();
        return this.tokens;
    }
}

/**
 * Circuit breaker pattern implementation
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= 2) {
                this.state = 'CLOSED';
            }
        }
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    getState() {
        return this.state;
    }

    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
    }
}

module.exports = {
    generateUUID,
    sleep,
    debounce,
    throttle,
    retryWithBackoff,
    createTimeout,
    promiseWithTimeout,
    PriorityQueue,
    RateLimiter,
    CircuitBreaker
};
