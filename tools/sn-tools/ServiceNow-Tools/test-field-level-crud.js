#!/usr/bin/env node
/**
 * Test Field-Level CRUD Analysis
 */

const { getInstance } = require('./sn-crud-analyzer');
const chalk = require('chalk');

console.log(chalk.blue.bold('\n╔════════════════════════════════════════════╗'));
console.log(chalk.blue.bold('║  Field-Level CRUD Analysis Test Suite     ║'));
console.log(chalk.blue.bold('╚════════════════════════════════════════════╝\n'));

const analyzer = getInstance();

// Test 1: Simple field reads and writes
const test1Script = `
if (current.severity == 1 && current.priority == 5) {
  current.priority = 1;
  current.urgency = 1;
  gs.addInfoMessage('Priority escalated');
}
`;

console.log(chalk.cyan('Test 1: Simple field reads and writes'));
const test1Result = analyzer.generateFieldReport(test1Script, 'incident');
console.log('Fields Read:', chalk.yellow(test1Result.fieldAccess.fieldsRead.join(', ')));
console.log('Fields Written:', chalk.green(test1Result.fieldAccess.fieldsWritten.join(', ')));
console.log('Summary:', test1Result.summary.join('; '));
console.log();

// Test 2: Field dependencies (calculated fields)
const test2Script = `
current.total_cost = current.unit_price * current.quantity;
current.tax_amount = current.total_cost * 0.08;
current.final_amount = current.total_cost + current.tax_amount;
`;

console.log(chalk.cyan('Test 2: Calculated fields with dependencies'));
const test2Result = analyzer.generateFieldReport(test2Script, 'purchase_order');
console.log('Fields Read:', chalk.yellow(test2Result.fieldAccess.fieldsRead.join(', ')));
console.log('Fields Written:', chalk.green(test2Result.fieldAccess.fieldsWritten.join(', ')));
console.log('Dependencies:');
test2Result.fieldAccess.dependencies.forEach(dep => {
  console.log(`  ${chalk.green(dep.field)} ← depends on: ${chalk.yellow(dep.dependsOn.join(', '))}`);
});
console.log('Summary:', test2Result.summary.join('; '));
console.log();

// Test 3: getValue/setValue patterns
const test3Script = `
var priority = current.getValue('priority');
var severity = current.getValue('severity');
if (priority == '5' && severity == '1') {
  current.setValue('priority', '1');
  current.setValue('state', '2');
}
`;

console.log(chalk.cyan('Test 3: getValue/setValue patterns'));
const test3Result = analyzer.generateFieldReport(test3Script, 'incident');
console.log('Fields Read:', chalk.yellow(test3Result.fieldAccess.fieldsRead.join(', ')));
console.log('Fields Written:', chalk.green(test3Result.fieldAccess.fieldsWritten.join(', ')));
console.log('Summary:', test3Result.summary.join('; '));
console.log();

// Test 4: Client script (g_form)
const test4Script = `
function onChange(control, oldValue, newValue, isLoading) {
  if (isLoading) return;
  var priority = g_form.getValue('priority');
  var urgency = g_form.getValue('urgency');
  
  if (priority == '1' || urgency == '1') {
    g_form.setValue('impact', '1');
    g_form.setMandatory('assigned_to', true);
  }
}
`;

console.log(chalk.cyan('Test 4: Client script (g_form API)'));
const test4Result = analyzer.generateFieldReport(test4Script, 'incident');
console.log('Fields Read:', chalk.yellow(test4Result.fieldAccess.fieldsRead.join(', ')));
console.log('Fields Written:', chalk.green(test4Result.fieldAccess.fieldsWritten.join(', ')));
console.log('Summary:', test4Result.summary.join('; '));
console.log();

// Test 5: Complex business rule
const test5Script = `
(function executeRule(current, previous) {
  // Read current and previous values
  var oldState = previous.state;
  var newState = current.state;
  var assignedTo = current.assigned_to;
  var assignmentGroup = current.assignment_group;
  
  // Update based on conditions
  if (newState == '3' && !assignedTo && assignmentGroup) {
    current.assigned_to = assignmentGroup.manager;
    current.work_notes = 'Auto-assigned to group manager';
  }
  
  // Calculate escalation
  if (current.severity == '1' && current.days_open > 7) {
    current.escalation = current.escalation + 1;
    current.priority = '1';
  }
})(current, previous);
`;

console.log(chalk.cyan('Test 5: Complex business rule with previous values'));
const test5Result = analyzer.generateFieldReport(test5Script, 'incident');
console.log('Fields Read:', chalk.yellow(test5Result.fieldAccess.fieldsRead.join(', ')));
console.log('Fields Written:', chalk.green(test5Result.fieldAccess.fieldsWritten.join(', ')));
console.log('Dependencies:');
test5Result.fieldAccess.dependencies.forEach(dep => {
  console.log(`  ${chalk.green(dep.field)} ← depends on: ${chalk.yellow(dep.dependsOn.join(', '))}`);
});
console.log('Summary:', test5Result.summary.join('; '));
console.log();

console.log(chalk.green.bold('✓ All field-level CRUD analysis tests completed!\n'));

process.exit(0);
