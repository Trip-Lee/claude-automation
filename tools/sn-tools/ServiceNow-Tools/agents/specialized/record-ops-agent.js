/**
 * Record Operations Agent
 * Handles CRUD operations on ServiceNow records
 */

const { BaseAgent } = require('../base/base-agent');

class RecordOperationsAgent extends BaseAgent {
    constructor(config) {
        super({
            name: 'RecordOperationsAgent',
            type: 'record-ops',
            capabilities: [
                'create-record',
                'update-record',
                'delete-record',
                'sync-file-to-record'
            ],
            ...config
        });

        this.snTools = config.serviceNowTools;
        this.enhancedRecordCreator = config.enhancedRecordCreator;
        this.locks = new Map(); // For record locking
    }

    /**
     * Agent-specific initialization
     */
    async onInitialize() {
        console.log(`[${this.name}] Initializing...`);

        // Subscribe to record operation topics
        await this.subscribe('record.create', this.handleCreate.bind(this));
        await this.subscribe('record.update', this.handleUpdate.bind(this));
        await this.subscribe('record.delete', this.handleDelete.bind(this));
        await this.subscribe('file.changed', this.handleFileChange.bind(this));
    }

    /**
     * Process task
     */
    async processTask(payload) {
        const { action } = payload;

        switch (action) {
            case 'create-record':
                return await this.createRecord(payload);

            case 'update-record':
                return await this.updateRecord(payload);

            case 'delete-record':
                return await this.deleteRecord(payload);

            case 'sync-file-to-record':
                return await this.syncFileToRecord(payload);

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    // ==================== CRUD Operations ====================

    /**
     * Create a ServiceNow record
     */
    async createRecord(payload) {
        const { table, data, instance, useAI, aiPrompt, validateFirst } = payload;

        console.log(`[${this.name}] Creating record in ${table}`);

        try {
            // Step 1: Validate first if requested
            if (validateFirst !== false) {
                const schemaResponse = await this.delegateTask('schema', {
                    action: 'get-schema',
                    table: table
                });

                if (schemaResponse && schemaResponse.schema) {
                    const validationResponse = await this.delegateTask('validation', {
                        action: 'validate-record',
                        table: table,
                        data: data,
                        schema: schemaResponse.schema
                    });

                    if (!validationResponse.valid) {
                        throw new Error(`Validation failed: ${validationResponse.errors.join(', ')}`);
                    }
                }
            }

            // Step 2: Enhance with AI if requested
            let recordData = { ...data };

            if (useAI && aiPrompt) {
                console.log(`[${this.name}] Requesting AI enhancement...`);

                const aiResponse = await this.delegateTask('ai', {
                    action: 'ai-generate',
                    table: table,
                    prompt: aiPrompt,
                    baseData: recordData
                });

                if (aiResponse && aiResponse.data) {
                    recordData = { ...recordData, ...aiResponse.data };
                }
            }

            // Step 3: Create the record
            const result = await this.snTools.createRecord({
                table,
                data: recordData,
                instance
            });

            console.log(`[${this.name}] Record created: ${result.sys_id}`);

            // Step 4: Notify other agents
            await this.publish('record.created', {
                table,
                sys_id: result.sys_id,
                instance,
                data: recordData
            });

            // Step 5: Trigger file sync if file watcher is active
            await this.publish('sync.trigger', {
                action: 'pull-record',
                table,
                sys_id: result.sys_id,
                instance
            });

            // Step 6: Invalidate related caches
            await this.publish('cache.invalidate', {
                table,
                instance
            });

            return {
                success: true,
                sys_id: result.sys_id,
                result: result
            };
        } catch (error) {
            console.error(`[${this.name}] Create failed:`, error.message);

            await this.publish('record.create-failed', {
                table,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Update a ServiceNow record
     */
    async updateRecord(payload) {
        const { table, sys_id, data, instance, validateFirst } = payload;

        console.log(`[${this.name}] Updating record: ${table}/${sys_id}`);

        // Acquire lock
        const lockKey = `${table}:${sys_id}`;
        const lockAcquired = await this.acquireLock(lockKey);

        if (!lockAcquired) {
            throw new Error(`Record is locked: ${lockKey}`);
        }

        try {
            // Validate if requested
            if (validateFirst !== false) {
                const schemaResponse = await this.delegateTask('schema', {
                    action: 'get-schema',
                    table: table
                });

                if (schemaResponse && schemaResponse.schema) {
                    const validationResponse = await this.delegateTask('validation', {
                        action: 'validate-record',
                        table: table,
                        data: data,
                        schema: schemaResponse.schema,
                        isUpdate: true
                    });

                    if (!validationResponse.valid) {
                        throw new Error(`Validation failed: ${validationResponse.errors.join(', ')}`);
                    }
                }
            }

            // Update the record
            const result = await this.snTools.updateRecord({
                table,
                sys_id,
                data,
                instance
            });

            console.log(`[${this.name}] Record updated: ${sys_id}`);

            // Notify other agents
            await this.publish('record.updated', {
                table,
                sys_id,
                instance,
                changes: Object.keys(data)
            });

            // Trigger file sync
            await this.publish('sync.trigger', {
                action: 'pull-record',
                table,
                sys_id,
                instance
            });

            // Invalidate caches
            await this.publish('cache.invalidate', {
                table,
                instance
            });

            return {
                success: true,
                sys_id: sys_id,
                result: result
            };
        } finally {
            // Always release lock
            await this.releaseLock(lockKey);
        }
    }

    /**
     * Delete a ServiceNow record
     */
    async deleteRecord(payload) {
        const { table, sys_id, instance } = payload;

        console.log(`[${this.name}] Deleting record: ${table}/${sys_id}`);

        // Acquire lock
        const lockKey = `${table}:${sys_id}`;
        const lockAcquired = await this.acquireLock(lockKey);

        if (!lockAcquired) {
            throw new Error(`Record is locked: ${lockKey}`);
        }

        try {
            // Delete the record
            await this.snTools.deleteRecord({
                table,
                sys_id,
                instance
            });

            console.log(`[${this.name}] Record deleted: ${sys_id}`);

            // Notify other agents
            await this.publish('record.deleted', {
                table,
                sys_id,
                instance
            });

            // Invalidate caches
            await this.publish('cache.invalidate', {
                table,
                instance
            });

            return {
                success: true,
                sys_id: sys_id
            };
        } finally {
            await this.releaseLock(lockKey);
        }
    }

    /**
     * Sync file changes to ServiceNow record
     */
    async syncFileToRecord(payload) {
        const { filePath, changeType, table, sys_id, instance } = payload;

        console.log(`[${this.name}] Syncing file to record: ${filePath} -> ${table}/${sys_id}`);

        try {
            // Read file content
            const fs = require('fs');
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Determine which field to update based on file type
            let field = 'script';
            if (filePath.endsWith('.xml')) {
                field = 'xml';
            } else if (filePath.endsWith('.json')) {
                field = 'value';
            }

            // Update the record
            const result = await this.updateRecord({
                table,
                sys_id,
                data: { [field]: fileContent },
                instance,
                validateFirst: false // Skip validation for file sync
            });

            console.log(`[${this.name}] File synced to record: ${sys_id}`);

            return result;
        } catch (error) {
            console.error(`[${this.name}] File sync failed:`, error.message);
            throw error;
        }
    }

    // ==================== Locking ====================

    /**
     * Acquire a lock on a record
     * @private
     */
    async acquireLock(lockKey, ttl = 30000) {
        if (this.locks.has(lockKey)) {
            const lock = this.locks.get(lockKey);

            // Check if lock expired
            if (Date.now() > lock.expiresAt) {
                this.locks.delete(lockKey);
            } else {
                console.warn(`[${this.name}] Lock already held: ${lockKey}`);
                return false;
            }
        }

        // Acquire lock
        this.locks.set(lockKey, {
            acquiredAt: Date.now(),
            expiresAt: Date.now() + ttl,
            holder: this.id
        });

        // Auto-release after TTL
        setTimeout(() => {
            const currentLock = this.locks.get(lockKey);
            if (currentLock && currentLock.holder === this.id) {
                this.locks.delete(lockKey);
                console.log(`[${this.name}] Lock auto-released: ${lockKey}`);
            }
        }, ttl);

        return true;
    }

    /**
     * Release a lock
     * @private
     */
    async releaseLock(lockKey) {
        const lock = this.locks.get(lockKey);

        if (!lock) {
            return false;
        }

        if (lock.holder !== this.id) {
            console.warn(`[${this.name}] Cannot release lock held by ${lock.holder}`);
            return false;
        }

        this.locks.delete(lockKey);
        console.log(`[${this.name}] Lock released: ${lockKey}`);
        return true;
    }

    // ==================== Event Handlers ====================

    /**
     * Handle create event
     */
    async handleCreate(message) {
        console.log(`[${this.name}] Received record.create event`);
        return await this.createRecord(message.data);
    }

    /**
     * Handle update event
     */
    async handleUpdate(message) {
        console.log(`[${this.name}] Received record.update event`);
        return await this.updateRecord(message.data);
    }

    /**
     * Handle delete event
     */
    async handleDelete(message) {
        console.log(`[${this.name}] Received record.delete event`);
        return await this.deleteRecord(message.data);
    }

    /**
     * Handle file change event
     */
    async handleFileChange(message) {
        console.log(`[${this.name}] Received file.changed event`);
        return await this.syncFileToRecord(message.data);
    }

    // ==================== Health & Metrics ====================

    /**
     * Get agent-specific health information
     */
    async healthCheck() {
        const baseHealth = await super.healthCheck();

        return {
            ...baseHealth,
            activeLocks: this.locks.size,
            locks: Array.from(this.locks.keys())
        };
    }
}

module.exports = { RecordOperationsAgent };
