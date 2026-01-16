#!/usr/bin/env node

/**
 * Cache Validation Module (Issue #4 Fix)
 *
 * Provides comprehensive validation for the unified cache system:
 * 1. Data Correctness - Validates data structure and content
 * 2. Data Completeness - Checks for missing expected data
 * 3. Data Consistency - Detects drift between sources
 * 4. Cross-Reference Validation - Verifies relationships are valid
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SN_TOOLS_PATH = path.join(__dirname, '..', '..', 'tools', 'sn-tools', 'ServiceNow-Tools');
const UNIFIED_CACHE_PATH = path.join(SN_TOOLS_PATH, 'cache', 'unified-agent-cache.json');

/**
 * CacheValidator - Validates unified cache data quality
 */
export class CacheValidator {
  constructor(options = {}) {
    this.cachePath = options.cachePath || UNIFIED_CACHE_PATH;
    this.cache = null;
    this.validationResults = {
      timestamp: new Date().toISOString(),
      overall: { valid: true, score: 0 },
      structure: { valid: true, errors: [], warnings: [] },
      completeness: { valid: true, errors: [], warnings: [], missing: [] },
      consistency: { valid: true, errors: [], warnings: [], conflicts: [] },
      crossReferences: { valid: true, errors: [], warnings: [], broken: [] }
    };
  }

  /**
   * Load the unified cache
   */
  async loadCache() {
    try {
      const content = await fs.readFile(this.cachePath, 'utf8');
      this.cache = JSON.parse(content);
      return true;
    } catch (error) {
      this.validationResults.structure.valid = false;
      this.validationResults.structure.errors.push(`Failed to load cache: ${error.message}`);
      return false;
    }
  }

  /**
   * Run all validations
   */
  async validate() {
    console.log('Starting cache validation...\n');

    if (!await this.loadCache()) {
      return this.validationResults;
    }

    // Run all validation checks
    await this.validateStructure();
    await this.validateCompleteness();
    await this.validateConsistency();
    await this.validateCrossReferences();

    // Calculate overall score
    this.calculateOverallScore();

    return this.validationResults;
  }

  /**
   * Validate cache structure
   */
  async validateStructure() {
    const results = this.validationResults.structure;
    console.log('1. Validating cache structure...');

    // Required top-level keys
    const requiredKeys = [
      'version', 'builtAt', 'metadata', 'tableOperations',
      'scriptIncludes', 'apis', 'components', 'businessRules',
      'tableRelationships', 'impactTemplates', 'reverseIndex'
    ];

    for (const key of requiredKeys) {
      if (!(key in this.cache)) {
        results.errors.push(`Missing required key: ${key}`);
        results.valid = false;
      }
    }

    // Validate version format
    if (this.cache.version && !/^\d+\.\d+\.\d+$/.test(this.cache.version)) {
      results.warnings.push(`Invalid version format: ${this.cache.version}`);
    }

    // Validate builtAt is a valid date
    if (this.cache.builtAt) {
      const date = new Date(this.cache.builtAt);
      if (isNaN(date.getTime())) {
        results.errors.push(`Invalid builtAt date: ${this.cache.builtAt}`);
        results.valid = false;
      }
    }

    // Validate table operations structure
    for (const [table, data] of Object.entries(this.cache.tableOperations || {})) {
      if (!data.operations || typeof data.operations !== 'object') {
        results.errors.push(`Table ${table} missing operations object`);
        results.valid = false;
      }

      // Check each operation has required fields
      for (const [op, opData] of Object.entries(data.operations || {})) {
        if (!opData.businessRules && !opData.riskLevel) {
          results.warnings.push(`Table ${table}.${op} missing expected fields`);
        }
      }
    }

    // Validate script includes structure
    for (const [name, si] of Object.entries(this.cache.scriptIncludes || {})) {
      if (!si.name && !si.dependencies) {
        results.warnings.push(`Script Include ${name} has incomplete data`);
      }
    }

    console.log(`   ${results.valid ? '✓' : '✗'} Structure validation: ${results.errors.length} errors, ${results.warnings.length} warnings\n`);
  }

  /**
   * Validate data completeness
   */
  async validateCompleteness() {
    const results = this.validationResults.completeness;
    console.log('2. Validating data completeness...');

    const stats = this.cache.metadata?.stats || {};

    // Check minimum expected counts (adjust based on your codebase)
    const minimums = {
      tables: 50,
      scriptIncludes: 100,
      apis: 50,
      businessRules: 100
    };

    const tableCount = Object.keys(this.cache.tableOperations || {}).length;
    const siCount = Object.keys(this.cache.scriptIncludes || {}).length;
    const apiCount = Object.keys(this.cache.apis || {}).length;
    const brCount = Object.keys(this.cache.businessRules || {}).length;

    if (tableCount < minimums.tables) {
      results.warnings.push(`Only ${tableCount} tables (expected >=${minimums.tables})`);
      results.missing.push({ type: 'tables', expected: minimums.tables, actual: tableCount });
    }

    if (siCount < minimums.scriptIncludes) {
      results.warnings.push(`Only ${siCount} Script Includes (expected >=${minimums.scriptIncludes})`);
      results.missing.push({ type: 'scriptIncludes', expected: minimums.scriptIncludes, actual: siCount });
    }

    if (apiCount < minimums.apis) {
      results.warnings.push(`Only ${apiCount} APIs (expected >=${minimums.apis})`);
      results.missing.push({ type: 'apis', expected: minimums.apis, actual: apiCount });
    }

    // Check for tables without operations
    const tablesWithoutOps = [];
    for (const [table, data] of Object.entries(this.cache.tableOperations || {})) {
      const opCount = Object.keys(data.operations || {}).length;
      if (opCount === 0) {
        tablesWithoutOps.push(table);
      }
    }

    if (tablesWithoutOps.length > 0) {
      results.warnings.push(`${tablesWithoutOps.length} tables have no operations defined`);
    }

    // Check for Script Includes without dependencies
    const siWithoutDeps = [];
    for (const [name, si] of Object.entries(this.cache.scriptIncludes || {})) {
      if (!si.dependencies || Object.keys(si.dependencies).length === 0) {
        siWithoutDeps.push(name);
      }
    }

    if (siWithoutDeps.length > siCount * 0.5) {
      results.warnings.push(`${siWithoutDeps.length}/${siCount} SIs have no dependencies (may indicate incomplete analysis)`);
    }

    // Check CRUD summaries exist
    let crudCount = 0;
    for (const [table, data] of Object.entries(this.cache.tableOperations || {})) {
      if (data.crudSummary?.markdown) crudCount++;
    }

    if (crudCount < tableCount * 0.5) {
      results.warnings.push(`Only ${crudCount}/${tableCount} tables have CRUD summaries`);
    }

    // Check rollback strategies exist
    let rollbackCount = 0;
    for (const [table, data] of Object.entries(this.cache.tableOperations || {})) {
      for (const opData of Object.values(data.operations || {})) {
        if (opData.rollbackStrategy) rollbackCount++;
      }
    }

    const totalOps = Object.values(this.cache.tableOperations || {})
      .reduce((sum, t) => sum + Object.keys(t.operations || {}).length, 0);

    if (rollbackCount < totalOps * 0.5) {
      results.warnings.push(`Only ${rollbackCount}/${totalOps} operations have rollback strategies`);
    }

    results.valid = results.errors.length === 0;
    console.log(`   ${results.valid ? '✓' : '✗'} Completeness validation: ${results.errors.length} errors, ${results.warnings.length} warnings\n`);
  }

  /**
   * Validate data consistency
   */
  async validateConsistency() {
    const results = this.validationResults.consistency;
    console.log('3. Validating data consistency...');

    // Check if business rules in tableOperations match businessRules index
    const brInTables = new Set();
    const brInIndex = new Set(Object.keys(this.cache.businessRules || {}));

    for (const [table, data] of Object.entries(this.cache.tableOperations || {})) {
      for (const opData of Object.values(data.operations || {})) {
        for (const br of opData.businessRules || []) {
          if (br.sys_id) brInTables.add(br.sys_id);
        }
      }
    }

    // Find BRs in tables but not in index
    const missingFromIndex = [...brInTables].filter(id => !brInIndex.has(id));
    if (missingFromIndex.length > 0) {
      results.warnings.push(`${missingFromIndex.length} BRs referenced in tables but missing from BR index`);
      results.conflicts.push({ type: 'br_index_mismatch', count: missingFromIndex.length });
    }

    // Check Script Include references
    const siReferenced = new Set();
    const siIndex = new Set(Object.keys(this.cache.scriptIncludes || {}));

    for (const [apiName, api] of Object.entries(this.cache.apis || {})) {
      for (const si of api.scriptIncludes || []) {
        siReferenced.add(si.name || si);
      }
    }

    const missingSIs = [...siReferenced].filter(name => !siIndex.has(name));
    if (missingSIs.length > 0) {
      results.warnings.push(`${missingSIs.length} SIs referenced by APIs but missing from SI index`);
      results.conflicts.push({ type: 'si_reference_mismatch', count: missingSIs.length, examples: missingSIs.slice(0, 5) });
    }

    // Check reverse index consistency
    const reverseIndex = this.cache.reverseIndex || {};
    let orphanedReferences = 0;

    for (const [key, refs] of Object.entries(reverseIndex)) {
      const [type, name] = key.split(':');

      // Verify the referenced entity exists
      let exists = false;
      switch (type) {
        case 'table':
          exists = name in (this.cache.tableOperations || {});
          break;
        case 'scriptInclude':
          exists = name in (this.cache.scriptIncludes || {});
          break;
        case 'api':
          exists = name in (this.cache.apis || {});
          break;
      }

      if (!exists && refs.length > 0) {
        orphanedReferences++;
      }
    }

    if (orphanedReferences > 0) {
      results.warnings.push(`${orphanedReferences} reverse index entries reference non-existent entities`);
    }

    results.valid = results.errors.length === 0;
    console.log(`   ${results.valid ? '✓' : '✗'} Consistency validation: ${results.errors.length} errors, ${results.warnings.length} warnings\n`);
  }

  /**
   * Validate cross-references
   */
  async validateCrossReferences() {
    const results = this.validationResults.crossReferences;
    console.log('4. Validating cross-references...');

    // Check table relationships reference valid tables
    for (const [table, rels] of Object.entries(this.cache.tableRelationships || {})) {
      if (rels.parentTables) {
        for (const parent of rels.parentTables) {
          if (!(parent in (this.cache.tableOperations || {}))) {
            results.broken.push({ type: 'parent_table', from: table, to: parent });
          }
        }
      }

      if (rels.childTables) {
        for (const child of rels.childTables) {
          if (!(child in (this.cache.tableOperations || {}))) {
            results.broken.push({ type: 'child_table', from: table, to: child });
          }
        }
      }
    }

    if (results.broken.length > 0) {
      results.warnings.push(`${results.broken.length} broken cross-references found`);
    }

    // Check SI dependencies reference valid SIs
    let brokenSIDeps = 0;
    for (const [siName, si] of Object.entries(this.cache.scriptIncludes || {})) {
      const deps = si.dependencies?.scriptIncludes || [];
      for (const dep of deps) {
        const depName = dep.name || dep;
        if (!(depName in (this.cache.scriptIncludes || {}))) {
          brokenSIDeps++;
        }
      }
    }

    if (brokenSIDeps > 0) {
      results.warnings.push(`${brokenSIDeps} SI dependencies reference non-existent SIs`);
    }

    results.valid = results.errors.length === 0;
    console.log(`   ${results.valid ? '✓' : '✗'} Cross-reference validation: ${results.errors.length} errors, ${results.warnings.length} warnings\n`);
  }

  /**
   * Calculate overall validation score
   */
  calculateOverallScore() {
    const weights = {
      structure: 40,
      completeness: 25,
      consistency: 20,
      crossReferences: 15
    };

    let totalScore = 0;
    let maxScore = 0;

    for (const [category, weight] of Object.entries(weights)) {
      maxScore += weight;
      const result = this.validationResults[category];

      if (result.valid && result.errors.length === 0) {
        // Full score if valid with no errors
        let categoryScore = weight;

        // Deduct for warnings (max 50% deduction)
        const warningPenalty = Math.min(result.warnings.length * 2, weight * 0.5);
        categoryScore -= warningPenalty;

        totalScore += Math.max(0, categoryScore);
      } else if (result.errors.length === 0) {
        // Partial score if only warnings
        totalScore += weight * 0.5;
      }
      // No score if errors exist
    }

    this.validationResults.overall.score = Math.round((totalScore / maxScore) * 100);
    this.validationResults.overall.valid = this.validationResults.overall.score >= 70;
  }

  /**
   * Print validation summary
   */
  printSummary() {
    const r = this.validationResults;
    console.log('═'.repeat(60));
    console.log('CACHE VALIDATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Overall Score: ${r.overall.score}% ${r.overall.valid ? '✓' : '✗'}`);
    console.log('');
    console.log(`Structure:       ${r.structure.valid ? 'PASS' : 'FAIL'} (${r.structure.errors.length} errors, ${r.structure.warnings.length} warnings)`);
    console.log(`Completeness:    ${r.completeness.valid ? 'PASS' : 'FAIL'} (${r.completeness.errors.length} errors, ${r.completeness.warnings.length} warnings)`);
    console.log(`Consistency:     ${r.consistency.valid ? 'PASS' : 'FAIL'} (${r.consistency.errors.length} errors, ${r.consistency.warnings.length} warnings)`);
    console.log(`Cross-References: ${r.crossReferences.valid ? 'PASS' : 'FAIL'} (${r.crossReferences.errors.length} errors, ${r.crossReferences.warnings.length} warnings)`);
    console.log('═'.repeat(60));

    if (r.overall.score < 70) {
      console.log('\nRecommendations:');
      if (r.structure.errors.length > 0) {
        console.log('  - Fix structure errors: rebuild cache with "npm run unified-build"');
      }
      if (r.completeness.warnings.length > 0) {
        console.log('  - Address completeness warnings: check source data files');
      }
      if (r.consistency.warnings.length > 0) {
        console.log('  - Fix consistency issues: ensure all referenced entities exist');
      }
    }
  }
}

// CLI support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const validator = new CacheValidator();
  const results = await validator.validate();
  validator.printSummary();
  process.exit(results.overall.valid ? 0 : 1);
}

export default CacheValidator;
