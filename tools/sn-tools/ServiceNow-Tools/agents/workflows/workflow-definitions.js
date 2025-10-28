/**
 * Workflow Definitions
 * Predefined multi-agent workflows for common operations
 */

const WorkflowDefinitions = {
    /**
     * Create a record with full validation and AI assistance
     */
    'create-record-with-ai': {
        name: 'Create Record with AI Assistance',
        description: 'Create a ServiceNow record using AI to generate field values',
        steps: [
            {
                name: 'get-schema',
                action: 'get-schema',
                payload: {
                    table: '$params.table',
                    includeInherited: true
                }
            },
            {
                name: 'generate-data',
                action: 'ai-generate',
                payload: {
                    table: '$params.table',
                    prompt: '$params.prompt',
                    baseData: '$params.baseData'
                }
            },
            {
                name: 'validate-data',
                action: 'validate-record',
                payload: {
                    table: '$params.table',
                    data: '$results.generate-data.data',
                    schema: '$results.get-schema.schema'
                }
            },
            {
                name: 'create-record',
                action: 'create-record',
                payload: {
                    table: '$params.table',
                    data: '$results.generate-data.data',
                    instance: '$params.instance',
                    validateFirst: false // Already validated
                }
            }
        ]
    },

    /**
     * Create a record with manual data
     */
    'create-record': {
        name: 'Create Record',
        description: 'Create a ServiceNow record with validation',
        steps: [
            {
                name: 'get-schema',
                action: 'get-schema',
                payload: {
                    table: '$params.table'
                }
            },
            {
                name: 'validate-data',
                action: 'validate-record',
                payload: {
                    table: '$params.table',
                    data: '$params.data',
                    schema: '$results.get-schema.schema'
                }
            },
            {
                name: 'create-record',
                action: 'create-record',
                payload: {
                    table: '$params.table',
                    data: '$params.data',
                    instance: '$params.instance',
                    validateFirst: false
                }
            }
        ]
    },

    /**
     * Update a record
     */
    'update-record': {
        name: 'Update Record',
        description: 'Update a ServiceNow record with validation',
        steps: [
            {
                name: 'get-schema',
                action: 'get-schema',
                payload: {
                    table: '$params.table'
                }
            },
            {
                name: 'validate-data',
                action: 'validate-record',
                payload: {
                    table: '$params.table',
                    data: '$params.data',
                    schema: '$results.get-schema.schema',
                    isUpdate: true
                }
            },
            {
                name: 'update-record',
                action: 'update-record',
                payload: {
                    table: '$params.table',
                    sys_id: '$params.sys_id',
                    data: '$params.data',
                    instance: '$params.instance',
                    validateFirst: false
                }
            }
        ]
    },

    /**
     * Enhanced record creation with all features
     */
    'enhanced-create': {
        name: 'Enhanced Record Creation',
        description: 'Create record with enhanced field discovery and AI assistance',
        steps: [
            {
                name: 'get-schema',
                action: 'get-schema',
                payload: {
                    table: '$params.table',
                    includeInherited: true
                }
            },
            {
                name: 'ai-enhance',
                action: 'ai-enhance',
                payload: {
                    table: '$params.table',
                    data: '$params.data',
                    prompt: '$params.aiPrompt'
                },
                optional: true
            },
            {
                name: 'validate-data',
                action: 'validate-record',
                payload: {
                    table: '$params.table',
                    data: '$results.ai-enhance.data',
                    schema: '$results.get-schema.schema'
                }
            },
            {
                name: 'create-record',
                action: 'create-record',
                payload: {
                    table: '$params.table',
                    data: '$results.ai-enhance.data',
                    instance: '$params.instance',
                    validateFirst: false
                }
            }
        ]
    }
};

module.exports = { WorkflowDefinitions };
