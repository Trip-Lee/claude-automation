/**
 * ServiceNow AI Operations Integration
 * Bridges the new AI tools system with sn-operations.js workflow
 *
 * This module provides AI-assisted operation planning, validation,
 * and execution for ServiceNow operations.
 */

const { getInstance: getAITools } = require('./sn-ai-tools');
const SchemaGraph = require('./sn-schema-graph');
const AIContextGenerator = require('./sn-ai-context-generator');
const { CRUDAnalyzer, getInstance: getCRUDAnalyzer } = require('./sn-crud-analyzer');
const fs = require('fs').promises;
const path = require('path');

class AIOperationsIntegration {
  constructor(config) {
    this.config = config;
    this.schema = SchemaGraph.getInstance();
    this.tools = null; // Initialized when API instance is available
    this.contextGenerator = null; // Initialized when API instance is available
    this.crudAnalyzer = getCRUDAnalyzer(); // CRUD analyzer for auto-detection
  }

  /**
   * Initialize with API instance
   */
  async initialize(apiInstance) {
    this.tools = getAITools(apiInstance, this.config);
    this.contextGenerator = new AIContextGenerator(this.config, this.tools);
    return this;
  }

  /**
   * Get available operations from schema graph
   */
  getAvailableOperations() {
    const operations = this.schema.getAvailableOperations();
    // Map from 'operation' field to 'key' field for consistency
    return operations.map(op => ({
      key: op.operation,
      description: op.description,
      complexity: op.complexity
    }));
  }

  /**
   * Get operation template with guidance
   */
  async getOperationGuidance(operation) {
    if (!this.tools) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    const template = await this.tools.getOperationTemplate(operation);
    const sequence = this.schema.getOperationSequence(operation);

    return {
      template,
      sequence,
      availableTools: this.tools.getAvailableTools()
    };
  }

  /**
   * Analyze user request and suggest operation
   */
  async analyzeRequest(userRequest) {
    const operations = this.getAvailableOperations();

    // Simple keyword matching to suggest operation
    const keywords = {
      'create_table': ['create table', 'new table', 'add table', 'make table'],
      'add_field': ['add field', 'new field', 'create field', 'add column'],
      'add_reference_field': ['reference field', 'link to', 'relationship', 'foreign key'],
      'create_choice_list': ['choice', 'dropdown', 'options', 'picklist'],
      'extend_table': ['extend', 'inherit', 'child table'],
      'create_business_rule': ['business rule', 'server script', 'when record', 'before insert', 'after update'],
      'create_client_script': ['client script', 'form script', 'onchange', 'onload', 'onsubmit'],
      'create_ui_action': ['button', 'ui action', 'form button', 'list button'],
      'create_rest_api': ['rest api', 'api endpoint', 'web service', 'http'],
      'create_scheduled_job': ['scheduled job', 'scheduled script', 'nightly job', 'cleanup job', 'batch job', 'cron'],
      'create_acl': ['acl', 'access control', 'security', 'protect field', 'permission', 'role-based'],
      'create_data_policy': ['data policy', 'mandatory field', 'required field', 'validation policy', 'enforce'],
      'create_ui_policy': ['ui policy', 'hide field', 'show field', 'readonly', 'form behavior', 'conditional'],
      'create_notification': ['notification', 'email', 'alert', 'notify', 'send email', 'email notification'],
      'create_catalog_item': ['catalog item', 'service catalog', 'request form', 'catalog request', 'service request']
    };

    const requestLower = userRequest.toLowerCase();
    const suggestions = [];

    for (const [opKey, patterns] of Object.entries(keywords)) {
      for (const pattern of patterns) {
        if (requestLower.includes(pattern)) {
          const op = operations.find(o => o.key === opKey);
          if (op && !suggestions.find(s => s.key === opKey)) {
            suggestions.push(op);
          }
        }
      }
    }

    return {
      suggestions: suggestions.length > 0 ? suggestions : operations,
      confidence: suggestions.length > 0 ? 'high' : 'low',
      userRequest
    };
  }

  /**
   * Build operation plan from user input
   */
  async buildOperationPlan(operation, userRequest, userInput = {}) {
    if (!this.tools) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    const sequence = this.schema.getOperationSequence(operation);
    if (!sequence) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    // Load template if available
    let template = null;
    try {
      template = await this.loadTemplate(operation);
    } catch (error) {
      // Template not required
    }

    // Build plan based on operation sequence
    const plan = {
      operation,
      description: sequence.description,
      steps: [],
      data: {}
    };

    // Extract data from user input based on template
    if (template && template.example) {
      for (const [table, data] of Object.entries(template.example)) {
        if (table.startsWith('sys_')) {
          plan.data[table] = this.mergeTemplateWithInput(data, userInput, template.variables);
        }
      }
    }

    // Apply CRUD auto-detection if script is provided
    plan.data = await this.applyCRUDAutoDetection(operation, plan.data, userInput);

    // Add steps from sequence
    if (sequence.steps) {
      plan.steps = sequence.steps.map(step => ({
        order: step.order,
        table: step.table,
        action: step.action,
        description: step.description,
        required_fields: step.required_fields || [],
        optional_fields: step.optional_fields || []
      }));
    }

    return plan;
  }

  /**
   * Merge template with user input
   */
  mergeTemplateWithInput(templateData, userInput, variables = {}) {
    const result = {};

    for (const [key, value] of Object.entries(templateData)) {
      // First check if user provided a value directly
      if (userInput[key] !== undefined && userInput[key] !== null) {
        result[key] = userInput[key];
      } else if (typeof value === 'string' && value.includes('{{')) {
        // Replace template variables
        let replaced = value;
        for (const [varName, varInfo] of Object.entries(variables)) {
          const placeholder = `{{${varName}}}`;
          if (replaced.includes(placeholder)) {
            replaced = replaced.replace(placeholder, userInput[varName] || varInfo.example || '');
          }
        }
        // If still has placeholders and user didn't provide value, keep the placeholder
        result[key] = replaced;
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Apply CRUD auto-detection to operation data
   * Analyzes scripts and automatically sets CRUD flags
   */
  async applyCRUDAutoDetection(operation, planData, userInput) {
    // Map operations to their table names
    const operationTableMap = {
      'create_business_rule': 'sys_script',
      'create_client_script': 'sys_script_client',
      'create_ui_action': 'sys_ui_action',
      'create_rest_api': 'sys_ws_operation'
    };

    const tableName = operationTableMap[operation];
    if (!tableName || !planData[tableName]) {
      return planData;
    }

    const record = planData[tableName];
    // Extract script from various possible fields
    const script = record.script ||
                   record.onclick ||
                   record.operation_script ||
                   userInput.script ||
                   userInput.operation_script ||
                   userInput.onclick;

    // Only auto-detect if script is provided
    if (!script) {
      return planData;
    }

    try {
      // Analyze the script using CRUD analyzer
      const analysis = await this.crudAnalyzer.analyze({ script }, operation.replace('create_', ''));

      // Generate recommended CRUD configuration
      const crudConfig = this.crudAnalyzer.generateCRUDConfig(analysis);

      // Helper to check if value is unset or a template placeholder
      const isUnset = (value) => {
        return value === undefined ||
               value === null ||
               (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}'));
      };

      // Apply auto-detected CRUD flags based on operation type
      if (operation === 'create_business_rule') {
        // Track what was actually set by auto-detection
        let autoDetectedCount = 0;

        // For business rules, set action flags if not already set by user
        if (isUnset(record.action_insert) && crudConfig.recommended.action_insert !== undefined) {
          record.action_insert = crudConfig.recommended.action_insert;
          if (crudConfig.recommended.action_insert === true) autoDetectedCount++;
        }
        if (isUnset(record.action_update) && crudConfig.recommended.action_update !== undefined) {
          record.action_update = crudConfig.recommended.action_update;
          if (crudConfig.recommended.action_update === true) autoDetectedCount++;
        }
        if (isUnset(record.action_delete) && crudConfig.recommended.action_delete !== undefined) {
          record.action_delete = crudConfig.recommended.action_delete;
          if (crudConfig.recommended.action_delete === true) autoDetectedCount++;
        }
        if (isUnset(record.action_query) && crudConfig.recommended.action_query !== undefined) {
          record.action_query = crudConfig.recommended.action_query;
          if (crudConfig.recommended.action_query === true) autoDetectedCount++;
        }

        // Add metadata only if something was actually detected (not all false)
        if (autoDetectedCount > 0) {
          record._crud_auto_detected = true;
          record._crud_confidence = {
            create: analysis.crud.confidence?.create || 'none',
            read: analysis.crud.confidence?.read || 'none',
            update: analysis.crud.confidence?.update || 'none',
            delete: analysis.crud.confidence?.delete || 'none'
          };
        }
      }

      if (operation === 'create_client_script') {
        // For client scripts, suggest type if not set
        if (isUnset(record.type) && crudConfig.recommended.type) {
          record.type = crudConfig.recommended.type;
          record._type_auto_detected = true;
        }
      }

      if (operation === 'create_rest_api') {
        // For REST APIs, validate HTTP method matches script intent
        if (record.http_method) {
          const expectedMethod = this._getExpectedHTTPMethod(analysis.crud);
          if (expectedMethod && record.http_method !== expectedMethod) {
            record._crud_warning = `HTTP method '${record.http_method}' may not match script intent (suggests ${expectedMethod})`;
          }
        }
      }

    } catch (error) {
      // If auto-detection fails, log but don't fail the operation
      console.warn(`CRUD auto-detection failed for ${operation}:`, error.message);
    }

    return planData;
  }

  /**
   * Get expected HTTP method based on CRUD operations
   * Priority: DELETE > UPDATE > CREATE (with high confidence) > READ
   * Special case: If CREATE has low confidence and READ is present, prefer GET
   */
  _getExpectedHTTPMethod(crud) {
    if (crud.delete) return 'DELETE';
    if (crud.update) return 'PUT';

    // If both create and read are detected, check confidence
    // Low confidence CREATE + READ = likely just a query (GET)
    if (crud.create && crud.read) {
      if (crud.confidence?.create === 'low' || crud.confidence?.create === 'none') {
        return 'GET';
      }
    }

    if (crud.create) return 'POST';
    if (crud.read) return 'GET';
    return null;
  }

  /**
   * Validate operation plan before execution
   */
  async validatePlan(operation, plan) {
    if (!this.tools) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    // Schema validation
    const schemaValidation = this.schema.validateOperationPlan(operation, plan);

    // Runtime validation using AI tools
    const runtimeValidation = await this.tools.validatePlan(operation, plan);

    // Combine results
    const allErrors = [...schemaValidation.errors, ...runtimeValidation.errors];
    const allWarnings = [...(schemaValidation.warnings || []), ...(runtimeValidation.warnings || [])];

    return {
      valid: schemaValidation.valid && runtimeValidation.valid,
      errors: allErrors,
      warnings: allWarnings,
      details: {
        schema: schemaValidation,
        runtime: runtimeValidation
      }
    };
  }

  /**
   * Generate AI context for operation
   */
  async generateContext(userRequest, operation, options = {}) {
    if (!this.contextGenerator) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    return await this.contextGenerator.generateContext(userRequest, operation, options);
  }

  /**
   * Generate AI prompt for operation
   */
  async generatePrompt(userRequest, operation, options = {}) {
    if (!this.contextGenerator) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    return await this.contextGenerator.generatePrompt(userRequest, operation, options);
  }

  /**
   * Execute operation with AI assistance
   */
  async executeWithAI(userRequest, options = {}) {
    if (!this.tools) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    const results = {
      userRequest,
      timestamp: new Date().toISOString(),
      steps: []
    };

    try {
      // 1. Analyze request
      results.steps.push({ step: 'analyze', status: 'running' });
      const analysis = await this.analyzeRequest(userRequest);
      results.analysis = analysis;
      results.steps[results.steps.length - 1].status = 'completed';

      // 2. Select operation (use first suggestion or fallback)
      const operation = options.operation || (analysis.suggestions[0] && analysis.suggestions[0].key);
      if (!operation) {
        throw new Error('Could not determine operation from request');
      }
      results.operation = operation;

      // 3. Get guidance
      results.steps.push({ step: 'getGuidance', status: 'running' });
      const guidance = await this.getOperationGuidance(operation);
      results.guidance = guidance;
      results.steps[results.steps.length - 1].status = 'completed';

      // 4. Build plan
      results.steps.push({ step: 'buildPlan', status: 'running' });
      const plan = await this.buildOperationPlan(operation, userRequest, options.input || {});
      results.plan = plan;
      results.steps[results.steps.length - 1].status = 'completed';

      // 5. Validate plan
      results.steps.push({ step: 'validate', status: 'running' });
      const validation = await this.validatePlan(operation, plan);
      results.validation = validation;
      results.steps[results.steps.length - 1].status = 'completed';

      // 6. Generate AI context (if needed)
      if (options.generateContext) {
        results.steps.push({ step: 'generateContext', status: 'running' });
        const context = await this.generateContext(userRequest, operation);
        results.context = context;
        results.steps[results.steps.length - 1].status = 'completed';
      }

      results.success = true;
      return results;

    } catch (error) {
      results.success = false;
      results.error = error.message;
      if (results.steps.length > 0) {
        results.steps[results.steps.length - 1].status = 'failed';
        results.steps[results.steps.length - 1].error = error.message;
      }
      return results;
    }
  }

  /**
   * Get table information using AI tools
   */
  async getTableInfo(tableName) {
    if (!this.tools) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    const exists = await this.tools.tableExists(tableName);
    if (!exists) {
      return { exists: false, tableName };
    }

    const schema = await this.tools.getTableSchema(tableName);
    return {
      exists: true,
      tableName,
      schema,
      fieldCount: schema.fields.length,
      relationships: schema.relationships
    };
  }

  /**
   * Search for tables using AI tools
   */
  async searchTables(query, options = {}) {
    if (!this.tools) {
      throw new Error('AIOperationsIntegration not initialized. Call initialize(apiInstance) first.');
    }

    return await this.tools.searchTables(query, options);
  }

  /**
   * Load operation template from file
   */
  async loadTemplate(operation) {
    const templatePath = path.join(__dirname, 'templates', `${operation}.json`);
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Template not found for operation: ${operation}`);
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    if (!this.tools) {
      return { initialized: false };
    }

    return {
      initialized: true,
      tools: this.tools.getStats(),
      availableOperations: this.getAvailableOperations().length
    };
  }

  /**
   * Reset rate limits and cache (for testing/admin)
   */
  reset() {
    if (this.tools) {
      this.tools.resetRateLimits();
      this.tools.clearCache();
    }
  }
}

// Export singleton pattern
let instance = null;

module.exports = {
  AIOperationsIntegration,
  getInstance: (config) => {
    if (!instance) {
      instance = new AIOperationsIntegration(config);
    }
    return instance;
  },
  resetInstance: () => {
    instance = null;
  }
};
