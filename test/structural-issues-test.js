#!/usr/bin/env node

/**
 * Structural Issues Test Suite
 *
 * Tests the fixes for the 4 structural issues identified:
 * - Issue #1: Duplicate Data Sources - Data source tracking and validation
 * - Issue #2: MCP Handler Caching - Singleton pattern for cache
 * - Issue #3: Error Context in Rollback - Enhanced rollback strategies
 * - Issue #4: Test Coverage Validation - Cache validation module
 */

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SN_TOOLS_PATH = path.join(__dirname, '..', 'tools', 'sn-tools', 'ServiceNow-Tools');
const UNIFIED_CACHE_PATH = path.join(SN_TOOLS_PATH, 'cache', 'unified-agent-cache.json');

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, details = null) {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    console.log(chalk.green(`  ✓ ${name}`));
  } else {
    testResults.failed++;
    console.log(chalk.red(`  ✗ ${name}`));
    if (details) console.log(chalk.gray(`    ${details}`));
  }
}

// ============================================================================
// ISSUE #1 TESTS: Data Source Consolidation
// ============================================================================

async function testIssue1_DataSourceConfig() {
  console.log(chalk.yellow('\n━━━ Issue #1: Data Source Consolidation ━━━\n'));

  // Test 1.1: DATA_SOURCE_CONFIG exists in cache module
  try {
    const cacheContent = await fs.readFile(
      path.join(SN_TOOLS_PATH, 'src', 'sn-context-cache.js'),
      'utf8'
    );

    const hasConfig = cacheContent.includes('DATA_SOURCE_CONFIG');
    recordTest('1.1 DATA_SOURCE_CONFIG defined in module', hasConfig);

    const hasSourcePriorities = /priority:\s*\d+/.test(cacheContent);
    recordTest('1.2 Source priorities defined', hasSourcePriorities);

    const hasCanonicalFlag = cacheContent.includes('isCanonical');
    recordTest('1.3 Canonical source flags defined', hasCanonicalFlag);

    const hasTestDataSource = cacheContent.includes("'test-data'");
    recordTest('1.4 Test data source separated from production', hasTestDataSource);

  } catch (err) {
    recordTest('1.1 DATA_SOURCE_CONFIG defined', false, err.message);
  }

  // Test 1.5: validateDataSources method exists
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { UnifiedCache } = require(path.join(SN_TOOLS_PATH, 'src', 'sn-context-cache.js'));

    const cache = new UnifiedCache({ rootPath: SN_TOOLS_PATH });
    const hasValidateMethod = typeof cache.validateDataSources === 'function';
    recordTest('1.5 validateDataSources() method exists', hasValidateMethod);

    if (hasValidateMethod) {
      await cache.initialize();
      const report = cache.validateDataSources();

      const hasSourcesChecked = Array.isArray(report.sourcesChecked);
      recordTest('1.6 validateDataSources returns sourcesChecked array', hasSourcesChecked);

      const hasWarningsArray = Array.isArray(report.warnings);
      recordTest('1.7 validateDataSources returns warnings array', hasWarningsArray);

      const hasValidFlag = typeof report.valid === 'boolean';
      recordTest('1.8 validateDataSources returns valid flag', hasValidFlag);
    }

  } catch (err) {
    recordTest('1.5 validateDataSources() method', false, err.message);
  }

  // Test 1.9: Cache metadata includes data source tracking
  try {
    const cacheData = JSON.parse(await fs.readFile(UNIFIED_CACHE_PATH, 'utf8'));

    const hasDataSources = cacheData.metadata?.dataSources !== undefined;
    recordTest('1.9 Cache metadata includes dataSources field', hasDataSources);

    const hasVersion21 = cacheData.version === '2.1.0';
    recordTest('1.10 Cache version updated to 2.1.0', hasVersion21);

  } catch (err) {
    recordTest('1.9 Cache metadata check', false, err.message);
  }
}

// ============================================================================
// ISSUE #2 TESTS: Singleton Cache Pattern
// ============================================================================

async function testIssue2_SingletonCache() {
  console.log(chalk.yellow('\n━━━ Issue #2: Singleton Cache Pattern ━━━\n'));

  try {
    // Import the handlers and cache manager
    const {
      cacheManager,
      QueryExecutionContextHandler,
      QueryUnifiedContextHandler,
      QueryCrudSummaryHandler,
      GetCacheStatsHandler
    } = await import('../mcp/tool-handlers.js');

    // Test 2.1: cacheManager is exported
    recordTest('2.1 cacheManager singleton is exported', cacheManager !== undefined);

    // Test 2.2: cacheManager has required methods
    const hasGetCache = typeof cacheManager.getCache === 'function';
    recordTest('2.2 cacheManager.getCache() method exists', hasGetCache);

    const hasReload = typeof cacheManager.reload === 'function';
    recordTest('2.3 cacheManager.reload() method exists', hasReload);

    const hasGetStats = typeof cacheManager.getStats === 'function';
    recordTest('2.4 cacheManager.getStats() method exists', hasGetStats);

    // Test 2.5: Force reload to reset stats and get fresh baseline
    await cacheManager.reload();
    let stats = cacheManager.getStats();
    const loadCountAfterReload = stats.loadCount;
    const hitsAfterReload = stats.hits;

    // Test 2.6: First handler call after reload uses the already-loaded cache (hit)
    const h1 = new QueryExecutionContextHandler();
    await h1.handle({ table_name: 'x_cadso_work_campaign', operation: 'insert' });

    stats = cacheManager.getStats();
    // After reload, cache is already loaded, so this should be a hit (no new load)
    const firstCallNoNewLoad = stats.loadCount === loadCountAfterReload;
    recordTest('2.5 Handler uses existing cache (no unnecessary reload)', firstCallNoNewLoad);

    // Test 2.7: Second handler call is cache hit (no new load)
    const hitsBeforeSecond = stats.hits;
    const h2 = new QueryUnifiedContextHandler();
    await h2.handle({ entity_type: 'table', entity_name: 'x_cadso_work_campaign' });

    stats = cacheManager.getStats();
    const secondCallHit = stats.loadCount === loadCountAfterReload && stats.hits > hitsBeforeSecond;
    recordTest('2.6 Second handler call is cache hit', secondCallHit);

    // Test 2.8: Third handler call is also cache hit
    const hitsBeforeThird = stats.hits;
    const h3 = new QueryCrudSummaryHandler();
    await h3.handle({ entity_type: 'table', entity_name: 'x_cadso_work_campaign' });

    stats = cacheManager.getStats();
    const thirdCallHit = stats.loadCount === loadCountAfterReload && stats.hits > hitsBeforeThird;
    recordTest('2.7 Third handler call is cache hit', thirdCallHit);

    // Test 2.9: Stats tracking works
    const hasHitRate = stats.hitRate !== 'N/A';
    recordTest('2.8 Hit rate is being calculated', hasHitRate);

    const hasAvgLoadTime = stats.avgLoadTimeMs > 0;
    recordTest('2.9 Average load time is tracked', hasAvgLoadTime);

    // Test 2.10: GetCacheStatsHandler works
    const statsHandler = new GetCacheStatsHandler();
    const statsResult = await statsHandler.handle({});
    const statsHandlerWorks = statsResult.data?.success && statsResult.data?.cache_stats;
    recordTest('2.10 GetCacheStatsHandler returns stats', statsHandlerWorks);

    // Test 2.11: Cache loaded property works
    const cacheLoaded = stats.cacheLoaded === true;
    recordTest('2.11 cacheLoaded flag is true after initialization', cacheLoaded);

  } catch (err) {
    recordTest('Issue #2 Tests', false, err.message);
  }
}

// ============================================================================
// ISSUE #3 TESTS: Error Context in Rollback Strategies
// ============================================================================

async function testIssue3_ErrorContext() {
  console.log(chalk.yellow('\n━━━ Issue #3: Error Context in Rollback Strategies ━━━\n'));

  try {
    const cacheData = JSON.parse(await fs.readFile(UNIFIED_CACHE_PATH, 'utf8'));

    // Find a table with rollback strategies
    let rollbackFound = null;
    let tableWithRollback = null;

    for (const [tableName, tableData] of Object.entries(cacheData.tableOperations || {})) {
      for (const [op, opData] of Object.entries(tableData.operations || {})) {
        if (opData.rollbackStrategy) {
          rollbackFound = opData.rollbackStrategy;
          tableWithRollback = `${tableName}.${op}`;
          break;
        }
      }
      if (rollbackFound) break;
    }

    // Test 3.1: Rollback strategies exist
    recordTest('3.1 Rollback strategies found in cache', rollbackFound !== null,
      rollbackFound ? `Found in ${tableWithRollback}` : 'No rollback strategies found');

    if (rollbackFound) {
      // Test 3.2: errorScenarios field exists
      const hasErrorScenarios = rollbackFound.errorScenarios !== undefined;
      recordTest('3.2 errorScenarios field exists in rollback', hasErrorScenarios);

      if (hasErrorScenarios) {
        // Test 3.3: partialFailure scenario exists
        const hasPartialFailure = rollbackFound.errorScenarios.partialFailure !== undefined;
        recordTest('3.3 partialFailure scenario defined', hasPartialFailure);

        // Test 3.4: cascadeFailure scenario exists
        const hasCascadeFailure = rollbackFound.errorScenarios.cascadeFailure !== undefined;
        recordTest('3.4 cascadeFailure scenario defined', hasCascadeFailure);

        // Test 3.5: asyncFailure scenario exists
        const hasAsyncFailure = rollbackFound.errorScenarios.asyncFailure !== undefined;
        recordTest('3.5 asyncFailure scenario defined', hasAsyncFailure);

        // Test 3.6: Each scenario has required fields
        if (hasPartialFailure) {
          const pf = rollbackFound.errorScenarios.partialFailure;
          const hasLikelihood = pf.likelihood !== undefined;
          const hasDetection = Array.isArray(pf.detection);
          const hasRecovery = Array.isArray(pf.recovery);
          recordTest('3.6 partialFailure has likelihood field', hasLikelihood);
          recordTest('3.7 partialFailure has detection array', hasDetection);
          recordTest('3.8 partialFailure has recovery array', hasRecovery);
        }

        // Test 3.9: Detection steps are meaningful
        if (rollbackFound.errorScenarios.partialFailure?.detection?.length > 0) {
          const hasRealDetectionSteps = rollbackFound.errorScenarios.partialFailure.detection.some(
            step => step.length > 10
          );
          recordTest('3.9 Detection steps contain meaningful guidance', hasRealDetectionSteps);
        }

        // Test 3.10: Recovery steps are meaningful
        if (rollbackFound.errorScenarios.partialFailure?.recovery?.length > 0) {
          const hasRealRecoverySteps = rollbackFound.errorScenarios.partialFailure.recovery.some(
            step => step.length > 10
          );
          recordTest('3.10 Recovery steps contain meaningful guidance', hasRealRecoverySteps);
        }
      }
    }

    // Test 3.11: Check source code has error scenarios implementation
    const cacheContent = await fs.readFile(
      path.join(SN_TOOLS_PATH, 'src', 'sn-context-cache.js'),
      'utf8'
    );

    const hasErrorScenariosCode = cacheContent.includes('errorScenarios');
    recordTest('3.11 errorScenarios implemented in generateRollbackStrategy', hasErrorScenariosCode);

    const hasPartialFailureCode = cacheContent.includes('partialFailure');
    recordTest('3.12 partialFailure scenario implemented in code', hasPartialFailureCode);

    const hasCascadeFailureCode = cacheContent.includes('cascadeFailure');
    recordTest('3.13 cascadeFailure scenario implemented in code', hasCascadeFailureCode);

  } catch (err) {
    recordTest('Issue #3 Tests', false, err.message);
  }
}

// ============================================================================
// ISSUE #4 TESTS: Test Coverage Validation
// ============================================================================

async function testIssue4_CacheValidation() {
  console.log(chalk.yellow('\n━━━ Issue #4: Test Coverage Validation ━━━\n'));

  try {
    // Test 4.1: CacheValidator module exists
    const validatorPath = path.join(__dirname, 'lib', 'cache-validation.js');
    const validatorExists = await fs.access(validatorPath).then(() => true).catch(() => false);
    recordTest('4.1 CacheValidator module exists', validatorExists);

    if (validatorExists) {
      // Test 4.2: Import CacheValidator
      const { CacheValidator } = await import('./lib/cache-validation.js');
      recordTest('4.2 CacheValidator can be imported', CacheValidator !== undefined);

      // Test 4.3: Create instance
      const validator = new CacheValidator();
      recordTest('4.3 CacheValidator instance created', validator !== null);

      // Test 4.4: Run validation
      const results = await validator.validate();
      recordTest('4.4 validate() returns results', results !== null);

      // Test 4.5: Structure validation runs
      const hasStructure = results.structure !== undefined;
      recordTest('4.5 Structure validation included', hasStructure);

      // Test 4.6: Completeness validation runs
      const hasCompleteness = results.completeness !== undefined;
      recordTest('4.6 Completeness validation included', hasCompleteness);

      // Test 4.7: Consistency validation runs
      const hasConsistency = results.consistency !== undefined;
      recordTest('4.7 Consistency validation included', hasConsistency);

      // Test 4.8: Cross-reference validation runs
      const hasCrossRefs = results.crossReferences !== undefined;
      recordTest('4.8 Cross-reference validation included', hasCrossRefs);

      // Test 4.9: Overall score calculated
      const hasScore = typeof results.overall?.score === 'number';
      recordTest('4.9 Overall score calculated', hasScore);

      // Test 4.10: Score is reasonable (>= 0 and <= 100)
      const scoreReasonable = results.overall?.score >= 0 && results.overall?.score <= 100;
      recordTest('4.10 Score is in valid range (0-100)', scoreReasonable);

      // Test 4.11: Validation passes for current cache
      const validationPasses = results.overall?.valid === true;
      recordTest('4.11 Current cache passes validation', validationPasses,
        `Score: ${results.overall?.score}%`);

      // Test 4.12: Each category has errors and warnings arrays
      const categoriesHaveArrays =
        Array.isArray(results.structure?.errors) &&
        Array.isArray(results.structure?.warnings) &&
        Array.isArray(results.completeness?.errors) &&
        Array.isArray(results.completeness?.warnings);
      recordTest('4.12 Categories have errors/warnings arrays', categoriesHaveArrays);
    }

  } catch (err) {
    recordTest('Issue #4 Tests', false, err.message);
  }
}

// ============================================================================
// INTEGRATION TESTS: End-to-end validation
// ============================================================================

async function testIntegration() {
  console.log(chalk.yellow('\n━━━ Integration Tests ━━━\n'));

  try {
    // Test I.1: Full workflow - Load, Query, Validate
    const { cacheManager, QueryExecutionContextHandler } = await import('../mcp/tool-handlers.js');

    // Reset cache
    await cacheManager.reload();

    // Query execution context
    const handler = new QueryExecutionContextHandler();
    const result = await handler.handle({
      table_name: 'x_cadso_work_campaign',
      operation: 'insert',
      include_crud_summary: true
    });

    const querySuccess = result.data?.success === true;
    recordTest('I.1 Query execution context succeeds', querySuccess);

    // Check result includes expected data
    const hasExecutionContext = result.data?.execution_context !== undefined;
    recordTest('I.2 Result includes execution_context', hasExecutionContext);

    const hasRollbackStrategy = result.data?.rollback_strategy !== undefined;
    recordTest('I.3 Result includes rollback_strategy (with error scenarios)', hasRollbackStrategy);

    const hasCrudSummary = result.data?.crud_summary !== undefined;
    recordTest('I.4 Result includes crud_summary', hasCrudSummary);

    // Check source is unified_cache
    const fromUnifiedCache = result.data?.metadata?.source === 'unified_cache';
    recordTest('I.5 Data served from unified_cache', fromUnifiedCache);

    // Test I.6: Cache stats after workflow
    const stats = cacheManager.getStats();
    const statsReasonable = stats.loadCount >= 1 && stats.cacheLoaded === true;
    recordTest('I.6 Cache stats are reasonable after workflow', statsReasonable);

    // Test I.7: Validate the cache being used
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { UnifiedCache } = require(path.join(SN_TOOLS_PATH, 'src', 'sn-context-cache.js'));

    const cache = new UnifiedCache({ rootPath: SN_TOOLS_PATH });
    await cache.initialize();
    const validation = cache.validateDataSources();

    const validationPasses = validation.valid === true || validation.errors.length === 0;
    recordTest('I.7 Data source validation passes', validationPasses);

  } catch (err) {
    recordTest('Integration Tests', false, err.message);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║     STRUCTURAL ISSUES TEST SUITE                       ║'));
  console.log(chalk.cyan.bold('║     Testing fixes for Issues #1, #2, #3, #4            ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════╝'));

  await testIssue1_DataSourceConfig();
  await testIssue2_SingletonCache();
  await testIssue3_ErrorContext();
  await testIssue4_CacheValidation();
  await testIntegration();

  // Summary
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                    TEST SUMMARY                        ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════╝\n'));

  console.log(`  Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(chalk.green(`  Passed: ${testResults.passed}`));
  console.log(chalk.red(`  Failed: ${testResults.failed}`));

  const passRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);
  console.log(`  Pass Rate: ${passRate}%`);

  // Group results by issue
  const issueGroups = {
    'Issue #1': testResults.tests.filter(t => t.name.startsWith('1.')),
    'Issue #2': testResults.tests.filter(t => t.name.startsWith('2.')),
    'Issue #3': testResults.tests.filter(t => t.name.startsWith('3.')),
    'Issue #4': testResults.tests.filter(t => t.name.startsWith('4.')),
    'Integration': testResults.tests.filter(t => t.name.startsWith('I.'))
  };

  console.log('\n  By Issue:');
  for (const [issue, tests] of Object.entries(issueGroups)) {
    const passed = tests.filter(t => t.passed).length;
    const total = tests.length;
    const status = passed === total ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${status} ${issue}: ${passed}/${total} passed`);
  }

  console.log('');

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(chalk.red('Test suite failed:'), err);
  process.exit(1);
});
