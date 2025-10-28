/**
 * Validation Agent
 * Validates data before create/update operations
 */

const { BaseAgent } = require('../base/base-agent');

class ValidationAgent extends BaseAgent {
    constructor(config) {
        super({
            name: 'ValidationAgent',
            type: 'validation',
            capabilities: [
                'validate-record',
                'validate-field',
                'validate-schema'
            ],
            ...config
        });

        this.fieldValidator = config.fieldValidator;
    }

    /**
     * Agent-specific initialization
     */
    async onInitialize() {
        console.log(`[${this.name}] Initializing...`);

        // Subscribe to validation topics
        await this.subscribe('validate.record', this.handleValidateRecord.bind(this));
    }

    /**
     * Process task
     */
    async processTask(payload) {
        const { action } = payload;

        switch (action) {
            case 'validate-record':
                return await this.validateRecord(payload);

            case 'validate-field':
                return await this.validateField(payload);

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    // ==================== Validation Operations ====================

    /**
     * Validate record data against schema
     */
    async validateRecord(payload) {
        const { table, data, schema, isUpdate } = payload;

        console.log(`[${this.name}] Validating record for ${table}`);

        const errors = [];
        const warnings = [];

        try {
            // Get schema if not provided
            let tableSchema = schema;
            if (!tableSchema) {
                const schemaResponse = await this.delegateTask('schema', {
                    action: 'get-schema',
                    table: table
                });
                tableSchema = schemaResponse?.schema;
            }

            if (!tableSchema) {
                console.warn(`[${this.name}] No schema available for ${table}, skipping validation`);
                return {
                    valid: true,
                    errors: [],
                    warnings: ['No schema available for validation']
                };
            }

            // Validate each field
            for (const field of tableSchema.fields) {
                const value = data[field.name];

                // Check mandatory fields (skip for updates unless explicitly provided)
                if (field.mandatory && !isUpdate) {
                    if (value === null || value === undefined || value === '') {
                        errors.push(`Field '${field.label}' (${field.name}) is mandatory`);
                    }
                }

                // Skip validation if field not provided
                if (value === null || value === undefined) {
                    continue;
                }

                // Validate field if fieldValidator available
                if (this.fieldValidator) {
                    const fieldValidation = this.fieldValidator.validateField(value, field, field.mandatory);

                    if (!fieldValidation.isValid) {
                        errors.push(`Field '${field.label}' (${field.name}): ${fieldValidation.message}`);
                    }
                }

                // Type-specific validation
                const typeErrors = this.validateFieldType(field, value);
                errors.push(...typeErrors);

                // Read-only check (for updates)
                if (isUpdate && field.readOnly) {
                    warnings.push(`Field '${field.label}' (${field.name}) is read-only`);
                }
            }

            // Check for unknown fields
            for (const fieldName of Object.keys(data)) {
                const fieldExists = tableSchema.fields.some(f => f.name === fieldName);
                if (!fieldExists) {
                    warnings.push(`Unknown field: ${fieldName}`);
                }
            }

            const isValid = errors.length === 0;

            console.log(`[${this.name}] Validation complete: ${isValid ? 'VALID' : 'INVALID'} (${errors.length} errors, ${warnings.length} warnings)`);

            return {
                valid: isValid,
                errors: errors,
                warnings: warnings
            };
        } catch (error) {
            console.error(`[${this.name}] Validation error:`, error.message);
            throw error;
        }
    }

    /**
     * Validate a single field
     */
    async validateField(payload) {
        const { field, value, mandatory } = payload;

        console.log(`[${this.name}] Validating field: ${field.name}`);

        const errors = this.validateFieldType(field, value);

        if (mandatory && (value === null || value === undefined || value === '')) {
            errors.push('Field is mandatory');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate field type
     * @private
     */
    validateFieldType(field, value) {
        const errors = [];

        switch (field.type) {
            case 'string':
            case 'email':
            case 'url':
                if (typeof value !== 'string') {
                    errors.push(`Expected string, got ${typeof value}`);
                } else if (field.maxLength && value.length > field.maxLength) {
                    errors.push(`Value exceeds maximum length of ${field.maxLength}`);
                }
                break;

            case 'integer':
                if (!Number.isInteger(Number(value))) {
                    errors.push('Expected integer value');
                }
                break;

            case 'decimal':
            case 'float':
            case 'currency':
                if (isNaN(Number(value))) {
                    errors.push('Expected numeric value');
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
                    errors.push('Expected boolean value');
                }
                break;

            case 'reference':
                if (typeof value !== 'string' || value.length !== 32) {
                    errors.push('Expected 32-character sys_id for reference field');
                }
                break;
        }

        return errors;
    }

    // ==================== Event Handlers ====================

    /**
     * Handle validate record event
     */
    async handleValidateRecord(message) {
        console.log(`[${this.name}] Received validate.record event`);
        return await this.validateRecord(message.data);
    }
}

module.exports = { ValidationAgent };
