/**
 * ServiceNow CRUD Analyzer
 * Automatically detects and infers CRUD operations from scripts and records
 */

const fs = require('fs').promises;
const path = require('path');

class CRUDAnalyzer {
  constructor() {
    // Pattern matchers for each CRUD operation
    this.patterns = {
      create: {
        explicit: [
          /action_insert\s*[=:]\s*true/i,
          /http_method\s*[=:]\s*['"]POST['"]/i,
          /isNewRecord\s*\(\)/,
        ],
        script: [
          /\.initialize\s*\(\)/,
          /\.insert\s*\(\)/,
          /new\s+GlideRecord\s*\(/,
          /gr\.initialize/,
          /current\.initialize/,
          /\bcreate\b/i,
          /\badd\b.*\brecord/i,
        ]
      },
      read: {
        explicit: [
          /action_query\s*[=:]\s*true/i,
          /http_method\s*[=:]\s*['"]GET['"]/i,
          /type\s*[=:]\s*['"]onLoad['"]/i,
        ],
        script: [
          /\.get\s*\(/,
          /\.query\s*\(\)/,
          /\.getBy/,
          /GlideRecord\s*\(\s*['"][^'"]+['"]\s*\)/,
          /\bretrieve\b/i,
          /\bfetch\b/i,
          /\bload\b/i,
          /\bselect\b/i,
        ]
      },
      update: {
        explicit: [
          /action_update\s*[=:]\s*true/i,
          /http_method\s*[=:]\s*['"](?:PUT|PATCH)['"]/i,
          /type\s*[=:]\s*['"](?:onChange|onSubmit)['"]/i,
        ],
        script: [
          /\.update\s*\(\)/,
          /\.setValue\s*\(/,
          /current\.\w+\s*=/,
          /gr\.\w+\s*=/,
          /\bmodify\b/i,
          /\bchange\b/i,
          /\bedit\b/i,
          /g_form\.setValue/,
        ]
      },
      delete: {
        explicit: [
          /action_delete\s*[=:]\s*true/i,
          /http_method\s*[=:]\s*['"]DELETE['"]/i,
        ],
        script: [
          /\.deleteRecord\s*\(\)/,
          /\.delete\s*\(\)/,
          /\bremove\b/i,
          /\bdestroy\b/i,
        ]
      }
    };

    // Script type indicators
    this.scriptTypes = {
      business_rule: [
        'sys_script',
        'action_insert',
        'action_update',
        'when',
        /\bcurrent\b/,
        /\bprevious\b/
      ],
      client_script: [
        'sys_script_client',
        'g_form',
        'onChange',
        'onLoad',
        'onSubmit',
        /function\s+onChange/,
        /function\s+onLoad/
      ],
      ui_action: [
        'sys_ui_action',
        'form_button',
        'list_button',
        'action_name',
        /\baction\b/
      ],
      rest_api: [
        'sys_ws_operation',
        'http_method',
        'operation_uri',
        /request\.body/,
        /response\.setBody/,
        /\(request,\s*response\)/
      ]
    };
  }

  /**
   * Analyze a record or file to detect CRUD operations
   */
  async analyze(source, type = 'auto') {
    let content;
    let metadata = {};

    // Determine if source is a file path or object
    if (typeof source === 'string') {
      content = await this.loadFile(source);
      metadata.source = 'file';
      metadata.path = source;
    } else {
      content = JSON.stringify(source, null, 2);
      metadata.source = 'object';
    }

    // Auto-detect type if not specified
    if (type === 'auto') {
      type = this.detectType(content);
    }

    // Analyze CRUD operations
    const crud = this.detectCRUD(content, type);

    // Extract additional information
    const details = this.extractDetails(content, type);

    return {
      type,
      crud,
      details,
      metadata,
      summary: this.generateSummary(crud, type)
    };
  }

  /**
   * Load file from disk
   */
  async loadFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Failed to load file: ${error.message}`);
    }
  }

  /**
   * Detect script type
   */
  detectType(content) {
    const scores = {};

    for (const [type, indicators] of Object.entries(this.scriptTypes)) {
      scores[type] = 0;

      for (const indicator of indicators) {
        if (typeof indicator === 'string') {
          if (content.includes(indicator)) {
            scores[type] += 2;
          }
        } else if (indicator instanceof RegExp) {
          if (indicator.test(content)) {
            scores[type] += 1;
          }
        }
      }
    }

    // Return type with highest score
    const detectedType = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])[0];

    return detectedType && detectedType[1] > 0 ? detectedType[0] : 'unknown';
  }

  /**
   * Detect CRUD operations
   */
  detectCRUD(content, type) {
    const crud = {
      create: false,
      read: false,
      update: false,
      delete: false,
      confidence: {}
    };

    for (const operation of ['create', 'read', 'update', 'delete']) {
      const patterns = this.patterns[operation];
      let score = 0;
      let matches = [];

      // Check explicit patterns (high confidence)
      for (const pattern of patterns.explicit) {
        if (pattern.test(content)) {
          score += 10;
          matches.push({ type: 'explicit', pattern: pattern.source });
        }
      }

      // Check script patterns (medium confidence)
      for (const pattern of patterns.script) {
        if (pattern.test(content)) {
          score += 3;
          matches.push({ type: 'script', pattern: pattern.source });
        }
      }

      // Determine if operation is detected
      crud[operation] = score > 0;
      crud.confidence[operation] = score >= 10 ? 'high' :
                                    score >= 5 ? 'medium' :
                                    score > 0 ? 'low' : 'none';

      if (matches.length > 0) {
        crud[`${operation}_matches`] = matches;
      }
    }

    return crud;
  }

  /**
   * Extract additional details based on type
   */
  extractDetails(content, type) {
    const details = {};

    try {
      // Try to parse as JSON first
      const obj = JSON.parse(content);

      switch (type) {
        case 'business_rule':
          details.when = obj.when;
          details.table = obj.collection;
          details.name = obj.name;
          details.actions = {
            insert: obj.action_insert,
            update: obj.action_update,
            delete: obj.action_delete,
            query: obj.action_query
          };
          break;

        case 'client_script':
          details.scriptType = obj.type;
          details.table = obj.table;
          details.field = obj.field;
          details.uiType = obj.ui_type;
          break;

        case 'ui_action':
          details.table = obj.table;
          details.client = obj.client;
          details.locations = {
            form_button: obj.form_button,
            form_link: obj.form_link,
            list_button: obj.list_button
          };
          break;

        case 'rest_api':
          details.httpMethod = obj.http_method;
          details.uri = obj.operation_uri;
          details.name = obj.name;
          break;
      }

      // Extract script if present
      if (obj.script) {
        details.scriptLength = obj.script.length;
        details.scriptPreview = obj.script.substring(0, 100) + '...';
      }

    } catch (error) {
      // Not JSON, analyze as plain script
      details.scriptLength = content.length;
      details.scriptPreview = content.substring(0, 100) + '...';
    }

    return details;
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(crud, type) {
    const operations = [];

    if (crud.create) operations.push('CREATE');
    if (crud.read) operations.push('READ');
    if (crud.update) operations.push('UPDATE');
    if (crud.delete) operations.push('DELETE');

    if (operations.length === 0) {
      return `No CRUD operations detected (${type})`;
    }

    if (operations.length === 4) {
      return `All CRUD operations (${type})`;
    }

    return `${operations.join(' + ')} operations (${type})`;
  }

  /**
   * Batch analyze multiple files
   */
  async analyzeDirectory(dirPath, options = {}) {
    const results = [];
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.js')) {
        const filePath = path.join(dirPath, file);
        try {
          const analysis = await this.analyze(filePath, options.type || 'auto');
          results.push({
            file,
            ...analysis
          });
        } catch (error) {
          results.push({
            file,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * Generate CRUD configuration from analysis
   */
  generateCRUDConfig(analysis) {
    const config = {
      type: analysis.type,
      crud: analysis.crud,
      recommended: {}
    };

    switch (analysis.type) {
      case 'business_rule':
        config.recommended = {
          action_insert: analysis.crud.create,
          action_update: analysis.crud.update,
          action_delete: analysis.crud.delete,
          action_query: analysis.crud.read
        };
        break;

      case 'rest_api':
        if (analysis.crud.create) config.recommended.http_method = 'POST';
        else if (analysis.crud.read) config.recommended.http_method = 'GET';
        else if (analysis.crud.update) config.recommended.http_method = 'PATCH';
        else if (analysis.crud.delete) config.recommended.http_method = 'DELETE';
        break;

      case 'client_script':
        if (analysis.crud.update && analysis.details.field) {
          config.recommended.type = 'onChange';
        } else if (analysis.crud.create || analysis.crud.read) {
          config.recommended.type = 'onLoad';
        }
        break;
    }

    return config;
  }

  /**
   * Validate CRUD configuration
   */
  validateCRUDConfig(record, type) {
    const errors = [];
    const warnings = [];

    switch (type) {
      case 'business_rule':
        // Check if at least one action is enabled
        if (!record.action_insert && !record.action_update &&
            !record.action_delete && !record.action_query) {
          errors.push('At least one CRUD action must be enabled');
        }

        // Warn if all actions are enabled
        if (record.action_insert && record.action_update &&
            record.action_delete && record.action_query) {
          warnings.push('All CRUD actions enabled - may impact performance');
        }

        // Check when timing matches actions
        if (record.when === 'display' && !record.action_query) {
          warnings.push('when=display usually requires action_query=true');
        }
        break;

      case 'client_script':
        // onChange requires field
        if (record.type === 'onChange' && !record.field) {
          errors.push('onChange scripts require a field name');
        }

        // onCellEdit requires field
        if (record.type === 'onCellEdit' && !record.field) {
          errors.push('onCellEdit scripts require a field name');
        }
        break;

      case 'rest_api':
        // Validate HTTP method
        const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
        if (!validMethods.includes(record.http_method)) {
          errors.push(`Invalid HTTP method: ${record.http_method}`);
        }
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Generate report from batch analysis
   */
  generateReport(results) {
    const report = {
      total: results.length,
      byType: {},
      byCRUD: {
        create: 0,
        read: 0,
        update: 0,
        delete: 0
      },
      errors: 0,
      summary: []
    };

    for (const result of results) {
      if (result.error) {
        report.errors++;
        continue;
      }

      // Count by type
      if (!report.byType[result.type]) {
        report.byType[result.type] = 0;
      }
      report.byType[result.type]++;

      // Count CRUD operations
      if (result.crud.create) report.byCRUD.create++;
      if (result.crud.read) report.byCRUD.read++;
      if (result.crud.update) report.byCRUD.update++;
      if (result.crud.delete) report.byCRUD.delete++;

      // Add to summary
      report.summary.push({
        file: result.file,
        type: result.type,
        operations: result.summary,
        confidence: Object.values(result.crud.confidence).filter(c => c === 'high').length
      });
    }

    return report;
  }

  /**
   * Analyze field-level CRUD operations
   * Tracks which specific fields are accessed and how
   */
  analyzeFieldLevel(script, tableName = null) {
    const fields = {
      read: [],
      write: [],
      calculated: [],
      dependencies: []
    };

    if (!script) {
      return fields;
    }

    // Extract field reads
    const readPatterns = [
      /current\.([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*(?:==|!=|<|>|\)|\||&&|;|\s))/g,  // current.field_name (not assignment)
      /current\.getValue\(['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\)/g,        // current.getValue('field_name')
      /gr\.getValue\(['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\)/g,             // gr.getValue('field_name')
      /gr\.([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*(?:==|!=|<|>|\)|\||&&|;|\s))/g,  // gr.field_name (not assignment)
      /g_form\.getValue\(['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\)/g,         // g_form.getValue('field_name')
      /previous\.([a-zA-Z_][a-zA-Z0-9_]*)/g,                           // previous.field_name
    ];

    // Extract field writes
    const writePatterns = [
      /current\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,                        // current.field_name =
      /current\.setValue\(['"]([a-zA-Z_][a-zA-Z0-9_]*)['"],/g,         // current.setValue('field_name', ...)
      /gr\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,                            // gr.field_name =
      /gr\.setValue\(['"]([a-zA-Z_][a-zA-Z0-9_]*)['"],/g,             // gr.setValue('field_name', ...)
      /g_form\.setValue\(['"]([a-zA-Z_][a-zA-Z0-9_]*)['"],/g,          // g_form.setValue('field_name', ...)
    ];

    // Detect field reads
    for (const pattern of readPatterns) {
      let match;
      while ((match = pattern.exec(script)) !== null) {
        const fieldName = match[1];
        if (fieldName && !fields.read.includes(fieldName) &&
            !this.isCommonMethod(fieldName)) {
          fields.read.push(fieldName);
        }
      }
    }

    // Detect field writes
    for (const pattern of writePatterns) {
      let match;
      while ((match = pattern.exec(script)) !== null) {
        const fieldName = match[1];
        if (fieldName && !fields.write.includes(fieldName) &&
            !this.isCommonMethod(fieldName)) {
          fields.write.push(fieldName);
        }
      }
    }

    // Detect calculated fields (fields that depend on other fields)
    fields.dependencies = this.detectFieldDependencies(script, fields);

    return fields;
  }

  /**
   * Detect field dependencies (which fields depend on which)
   */
  detectFieldDependencies(script, fields) {
    const dependencies = [];

    // For each field that's written to
    for (const writeField of fields.write) {
      // Find the context around this field assignment
      const assignmentPattern = new RegExp(
        `(${writeField}\\s*=\\s*([^;]+))|` +
        `(setValue\\s*\\(['"]${writeField}['"],\\s*([^)]+)\\))`,
        'g'
      );

      let match;
      while ((match = assignmentPattern.exec(script)) !== null) {
        const assignmentContext = match[2] || match[4];
        if (assignmentContext) {
          // Find which read fields are in this assignment
          const dependsOn = fields.read.filter(readField =>
            assignmentContext.includes(readField)
          );

          if (dependsOn.length > 0) {
            dependencies.push({
              field: writeField,
              dependsOn: dependsOn,
              operation: 'calculated'
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Check if a name is a common method (not a field)
   */
  isCommonMethod(name) {
    const commonMethods = [
      'update', 'insert', 'deleteRecord', 'query', 'next', 'get',
      'initialize', 'setAbortAction', 'setWorkflow', 'autoSysFields',
      'setLimit', 'addQuery', 'addEncodedQuery', 'orderBy', 'hasNext',
      'toString', 'getDisplayValue', 'setDisplayValue', 'changes',
      'nil', 'canRead', 'canWrite', 'canCreate', 'canDelete', 'isValid',
      'isValidField', 'isValidRecord', 'getED', 'getElement', 'getLabel',
      'getTableName', 'getRecordClassName', 'getUniqueValue', 'getLocation'
    ];

    return commonMethods.includes(name);
  }

  /**
   * Generate field access report
   */
  generateFieldReport(script, tableName = null) {
    const fieldAnalysis = this.analyzeFieldLevel(script, tableName);
    const crudAnalysis = this.detectCRUD(script);

    const report = {
      tableName: tableName || 'unknown',
      fieldAccess: {
        totalFieldsRead: fieldAnalysis.read.length,
        totalFieldsWritten: fieldAnalysis.write.length,
        fieldsRead: fieldAnalysis.read.sort(),
        fieldsWritten: fieldAnalysis.write.sort(),
        calculatedFields: fieldAnalysis.dependencies.length,
        dependencies: fieldAnalysis.dependencies
      },
      crudOperations: {
        hasCreate: crudAnalysis.create,
        hasRead: crudAnalysis.read,
        hasUpdate: crudAnalysis.update,
        hasDelete: crudAnalysis.delete
      },
      summary: this.summarizeFieldAccess(fieldAnalysis, crudAnalysis)
    };

    return report;
  }

  /**
   * Summarize field access patterns
   */
  summarizeFieldAccess(fieldAnalysis, crudAnalysis) {
    const summary = [];

    if (fieldAnalysis.read.length > 0) {
      summary.push(`Reads ${fieldAnalysis.read.length} field(s): ${fieldAnalysis.read.slice(0, 5).join(', ')}${fieldAnalysis.read.length > 5 ? '...' : ''}`);
    }

    if (fieldAnalysis.write.length > 0) {
      summary.push(`Writes ${fieldAnalysis.write.length} field(s): ${fieldAnalysis.write.slice(0, 5).join(', ')}${fieldAnalysis.write.length > 5 ? '...' : ''}`);
    }

    if (fieldAnalysis.dependencies.length > 0) {
      summary.push(`${fieldAnalysis.dependencies.length} calculated field(s) with dependencies`);
    }

    if (summary.length === 0) {
      summary.push('No field-level operations detected');
    }

    return summary;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  CRUDAnalyzer,
  getInstance: () => {
    if (!instance) {
      instance = new CRUDAnalyzer();
    }
    return instance;
  },
  resetInstance: () => {
    instance = null;
  }
};
