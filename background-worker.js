#!/usr/bin/env node

/**
 * Background Worker - Runs tasks in detached background process
 * 
 * Usage: node background-worker.js <taskId> <project> <description>
 * 
 * Responsibilities:
 * - Execute orchestrator with task parameters
 * - Update task state file as progress occurs
 * - Redirect all output to log file
 * - Handle errors and update state accordingly
 */

import { Orchestrator } from './lib/orchestrator.js';
import { TaskStateManager } from './lib/task-state-manager.js';
import { getGlobalConfig } from './lib/global-config.js';
import dotenv from 'dotenv';
import { homedir } from 'os';
import path from 'path';

// Load environment
dotenv.config({ path: path.join(homedir(), '.env') });

const [taskId, project, description] = process.argv.slice(2);

if (!taskId || !project || !description) {
  console.error('Usage: background-worker.js <taskId> <project> <description>');
  process.exit(1);
}

const stateManager = new TaskStateManager();
const globalConfig = getGlobalConfig();

/**
 * Log with timestamp
 */
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Main background task runner
 */
async function runTask() {
  try {
    log(`Background task started: ${taskId}`);
    log(`  Project: ${project}`);
    log(`  Description: ${description}`);
    
    // Initialize orchestrator
    const orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
    
    // Track completed agents for progress
    const completedAgents = [];
    
    // Update state: starting
    await stateManager.updateTaskState(taskId, {
      status: 'running',
      currentAgent: 'architect',
      completedAgents: [],
      progress: {
        percent: 0,
        eta: stateManager.estimateETA('architect', [])
      }
    });
    
    log('Executing task...');
    
    // Execute task
    // Note: We'll need to modify orchestrator to accept progress callbacks
    // For now, we'll just run it and update state at the end
    const result = await orchestrator.executeTask(project, description);
    
    // Task completed successfully
    await stateManager.updateTaskState(taskId, {
      status: 'completed',
      currentAgent: null,
      completedAgents: ['architect', 'coder', 'reviewer'],
      progress: {
        percent: 100,
        eta: 0
      },
      result: {
        taskId: result.taskId,
        branchName: result.branchName,
        cost: result.cost
      },
      completedAt: new Date().toISOString()
    });
    
    log('Task completed successfully');
    log(`  Task ID: ${result.taskId}`);
    log(`  Branch: ${result.branchName}`);
    log(`  Cost: $${result.cost.toFixed(4)}`);
    
    process.exit(0);
    
  } catch (error) {
    log(`Task failed: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
    
    // Update state: failed
    await stateManager.updateTaskState(taskId, {
      status: 'failed',
      error: {
        message: error.message,
        stack: error.stack
      },
      completedAt: new Date().toISOString()
    });
    
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  log(`Uncaught exception: ${error.message}`);
  
  await stateManager.updateTaskState(taskId, {
    status: 'failed',
    error: {
      message: error.message,
      stack: error.stack
    },
    completedAt: new Date().toISOString()
  });
  
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  log(`Unhandled rejection: ${error.message}`);
  
  await stateManager.updateTaskState(taskId, {
    status: 'failed',
    error: {
      message: error.message,
      stack: error.stack
    },
    completedAt: new Date().toISOString()
  });
  
  process.exit(1);
});

// Run the task
runTask().catch(async (error) => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});
