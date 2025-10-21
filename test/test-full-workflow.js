/**
 * Full Workflow End-to-End Test
 *
 * Tests the complete orchestrator workflow from start to finish:
 * 1. Load project configuration
 * 2. Setup git environment
 * 3. Create Docker container
 * 4. Run agent system (mock or real)
 * 5. Execute tests
 * 6. Generate summary
 * 7. Save task data
 *
 * This test uses the test-project in ~/projects/test-project/
 *
 * Run with:
 *   node test/test-full-workflow.js
 *
 * The system automatically tries to use real agents if API key is present,
 * and falls back to mock mode if credits are insufficient.
 */

import { Orchestrator } from '../lib/orchestrator.js';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

const PROJECT_NAME = 'test-project';
const PROJECT_PATH = path.join(homedir(), 'projects', PROJECT_NAME);

async function runFullWorkflowTest() {
  console.log(chalk.cyan.bold('\n🧪 Full Workflow End-to-End Test\n'));
  console.log(chalk.gray('Testing complete orchestrator workflow with test-project\n'));

  let orchestrator = null;
  let taskId = null;

  try {
    // Step 1: Verify test project exists
    console.log(chalk.blue('Step 1/8: Verifying test project...'));
    try {
      await fs.access(PROJECT_PATH);
      console.log(chalk.green(`  ✅ Test project found: ${PROJECT_PATH}\n`));
    } catch {
      console.log(chalk.red(`  ❌ Test project not found at ${PROJECT_PATH}`));
      console.log(chalk.yellow('  Run setup first to create test project\n'));
      process.exit(1);
    }

    // Step 2: Check configuration
    console.log(chalk.blue('Step 2/8: Checking configuration...'));
    const configPath = path.join(homedir(), '.claude-projects', `${PROJECT_NAME}.yaml`);
    try {
      await fs.access(configPath);
      console.log(chalk.green(`  ✅ Configuration found: ${configPath}\n`));
    } catch {
      console.log(chalk.red(`  ❌ Configuration not found at ${configPath}`));
      console.log(chalk.yellow('  Run setup first to create configuration\n'));
      process.exit(1);
    }

    // Step 3: Initialize orchestrator
    console.log(chalk.blue('Step 3/8: Initializing orchestrator...'));
    const githubToken = process.env.GITHUB_TOKEN;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      console.log(chalk.yellow('  ⚠️  No Anthropic API key - will use mock agent'));
    } else {
      console.log(chalk.green('  ✅ API key found - will try real agents (auto-fallback if insufficient credits)'));
    }

    orchestrator = new Orchestrator(githubToken, anthropicApiKey);

    console.log(chalk.green('  ✅ Orchestrator initialized\n'));

    // Step 4: Define test task
    console.log(chalk.blue('Step 4/8: Defining test task...'));
    const task = `Add a new function called 'multiply(a, b)' to main.py that multiplies two numbers.
Also add a test for this function in test_main.py.`;

    console.log(chalk.gray(`  Task: ${task.substring(0, 80)}...\n`));

    // Step 5: Execute task
    console.log(chalk.blue('Step 5/8: Executing task through orchestrator...'));
    console.log(chalk.gray('  This will run through all 7 workflow steps\n'));

    const startTime = Date.now();
    const result = await orchestrator.executeTask(PROJECT_NAME, task);
    const duration = Date.now() - startTime;

    taskId = result.taskId;

    console.log(chalk.green(`\n  ✅ Task execution complete in ${(duration / 1000).toFixed(2)}s`));
    console.log(chalk.gray(`  Task ID: ${taskId}`));
    console.log(chalk.gray(`  Branch: ${result.branchName}`));
    console.log(chalk.gray(`  Cost: $${result.cost.toFixed(4)}\n`));

    // Step 6: Verify task data saved
    console.log(chalk.blue('Step 6/8: Verifying task data...'));
    const taskDataPath = path.join(homedir(), '.claude-tasks', `${taskId}.json`);
    try {
      const taskData = JSON.parse(await fs.readFile(taskDataPath, 'utf-8'));
      console.log(chalk.green('  ✅ Task data saved successfully'));
      console.log(chalk.gray(`  Status: ${taskData.status}`));
      console.log(chalk.gray(`  Timestamp: ${taskData.timestamp}\n`));
    } catch (error) {
      console.log(chalk.red(`  ❌ Task data not found: ${error.message}\n`));
    }

    // Step 7: Verify branch created
    console.log(chalk.blue('Step 7/8: Verifying git branch...'));
    const { GitManager } = await import('../lib/git-manager.js');
    const gitManager = new GitManager();

    try {
      const branches = await gitManager.getStatus(PROJECT_PATH);
      if (branches.includes(result.branchName)) {
        console.log(chalk.green(`  ✅ Branch created: ${result.branchName}\n`));
      } else {
        console.log(chalk.yellow(`  ⚠️  Branch not found in git status\n`));
      }
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Could not verify branch: ${error.message}\n`));
    }

    // Step 8: Display summary
    console.log(chalk.blue('Step 8/8: Displaying task summary...'));
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(result.summary);
    console.log(chalk.gray('─'.repeat(60) + '\n'));

    // Generate test report
    console.log(chalk.blue('Generating test report...'));
    const report = {
      test: 'Full Workflow',
      timestamp: new Date().toISOString(),
      success: true,
      taskId,
      branchName: result.branchName,
      cost: result.cost,
      duration,
      mode: anthropicApiKey ? 'real-or-auto-fallback' : 'mock-agent',
      task
    };

    const reportPath = path.join(homedir(), '.claude-logs', 'full-workflow-test.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`  ✅ Report saved: ${reportPath}\n`));

    console.log(chalk.green.bold('✅ Full Workflow Test Complete!\n'));

    // Show next steps
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray('  1. Review the changes in the branch:'));
    console.log(chalk.white(`     cd ${PROJECT_PATH} && git diff master...${result.branchName}`));
    console.log(chalk.gray('\n  2. View task status:'));
    console.log(chalk.white(`     ./cli.js status ${taskId}`));
    console.log(chalk.gray('\n  3. Approve or reject the task:'));
    console.log(chalk.white(`     ./cli.js approve ${taskId}`));
    console.log(chalk.white(`     ./cli.js reject ${taskId}`));
    console.log(chalk.gray('\n  4. Clean up test branch (if needed):'));
    console.log(chalk.white(`     cd ${PROJECT_PATH} && git checkout master && git branch -D ${result.branchName}`));
    console.log('');

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(chalk.gray(error.stack));

    // Try to show status if we have a taskId
    if (taskId && orchestrator) {
      console.log(chalk.yellow('\nAttempting to show task status...'));
      try {
        await orchestrator.showStatus(taskId);
      } catch (statusError) {
        console.log(chalk.gray('Could not show status'));
      }
    }

    process.exit(1);
  }
}

// Run test
runFullWorkflowTest().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});
