/**
 * Schema Agent
 * Manages table schema and field information
 */

const { BaseAgent } = require('../base/base-agent');

class SchemaAgent extends BaseAgent {
    constructor(config) {
        super({
            name: 'SchemaAgent',
            type: 'schema',
            capabilities: [
                'get-schema',
                'get-fields',
                'get-table-info'
            ],
            ...config
        });

        this.tableFieldMapper = config.tableFieldMapper;
        this.cacheSchemas = this.config.cacheSchemas !== false;
        this.refreshInterval = this.config.refreshInterval || 3600000; // 1 hour
    }

    /**
     * Agent-specific initialization
     */
    async onInitialize() {
        console.log(`[${this.name}] Initializing with schema caching ${this.cacheSchemas ? 'enabled' : 'disabled'}`);

        // Subscribe to schema topics
        await this.subscribe('schema.get', this.handleGetSchema.bind(this));
        await this.subscribe('schema.refresh', this.handleRefreshSchema.bind(this));
    }

    /**
     * Process task
     */
    async processTask(payload) {
        const { action } = payload;

        switch (action) {
            case 'get-schema':
                return await this.getSchema(payload);

            case 'get-fields':
                return await this.getFields(payload);

            case 'get-table-info':
                return await this.getTableInfo(payload);

            case 'refresh-schema':
                return await this.refreshSchema(payload);

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    // ==================== Schema Operations ====================

    /**
     * Get schema for a table
     */
    async getSchema(payload) {
        const { table, includeInherited } = payload;

        console.log(`[${this.name}] Getting schema for ${table}`);

        // Check cache first
        if (this.cacheSchemas) {
            const cached = await this.getFromCache(table);
            if (cached) {
                console.log(`[${this.name}] Schema cache hit for ${table}`);
                return { schema: cached, source: 'cache' };
            }
        }

        try {
            // Fetch schema
            const fields = await this.tableFieldMapper.getFieldsForTable(
                table,
                includeInherited !== false
            );

            if (!fields || fields.length === 0) {
                console.warn(`[${this.name}] No fields found for ${table}`);
                return { schema: null, source: 'api' };
            }

            // Build schema object
            const schema = {
                table: table,
                fields: fields.map(f => ({
                    name: f.element,
                    label: f.column_label || f.element,
                    type: f.internal_type,
                    mandatory: f.mandatory || false,
                    readOnly: f.read_only || false,
                    reference: f.reference || null,
                    maxLength: f.max_length || null,
                    isInherited: f.is_inherited || false,
                    inheritedFrom: f.inherited_from || null
                })),
                fetchedAt: Date.now()
            };

            // Cache the schema
            if (this.cacheSchemas) {
                await this.saveToCache(table, schema);
            }

            console.log(`[${this.name}] Schema fetched for ${table}: ${schema.fields.length} fields`);

            return { schema, source: 'api' };
        } catch (error) {
            console.error(`[${this.name}] Failed to get schema for ${table}:`, error.message);
            throw error;
        }
    }

    /**
     * Get fields for a table
     */
    async getFields(payload) {
        const { table, includeInherited } = payload;

        console.log(`[${this.name}] Getting fields for ${table}`);

        const schemaResult = await this.getSchema({ table, includeInherited });

        return {
            fields: schemaResult.schema ? schemaResult.schema.fields : [],
            source: schemaResult.source
        };
    }

    /**
     * Get table information
     */
    async getTableInfo(payload) {
        const { table } = payload;

        console.log(`[${this.name}] Getting table info for ${table}`);

        try {
            const tableInfo = await this.tableFieldMapper.getTable(table);

            return {
                tableInfo: tableInfo,
                source: 'api'
            };
        } catch (error) {
            console.error(`[${this.name}] Failed to get table info for ${table}:`, error.message);
            throw error;
        }
    }

    /**
     * Refresh schema cache for a table
     */
    async refreshSchema(payload) {
        const { table } = payload;

        console.log(`[${this.name}] Refreshing schema for ${table}`);

        // Invalidate cache
        await this.invalidateCache(table);

        // Fetch fresh schema
        return await this.getSchema({ table, includeInherited: true });
    }

    // ==================== Cache Management ====================

    /**
     * Get schema from cache
     * @private
     */
    async getFromCache(table) {
        if (!this.messageBus || !this.messageBus.stateManager) {
            return null;
        }

        const cacheKey = `schema:${table}`;
        return await this.messageBus.stateManager.getCache(cacheKey);
    }

    /**
     * Save schema to cache
     * @private
     */
    async saveToCache(table, schema) {
        if (!this.messageBus || !this.messageBus.stateManager) {
            return;
        }

        const cacheKey = `schema:${table}`;
        await this.messageBus.stateManager.setCache(cacheKey, schema, this.refreshInterval);
    }

    /**
     * Invalidate schema cache
     * @private
     */
    async invalidateCache(table) {
        if (!this.messageBus || !this.messageBus.stateManager) {
            return;
        }

        const cacheKey = `schema:${table}`;
        await this.messageBus.stateManager.invalidateCache(cacheKey);
    }

    // ==================== Event Handlers ====================

    /**
     * Handle get schema event
     */
    async handleGetSchema(message) {
        console.log(`[${this.name}] Received schema.get event`);
        return await this.getSchema(message.data);
    }

    /**
     * Handle refresh schema event
     */
    async handleRefreshSchema(message) {
        console.log(`[${this.name}] Received schema.refresh event`);
        return await this.refreshSchema(message.data);
    }
}

module.exports = { SchemaAgent };
