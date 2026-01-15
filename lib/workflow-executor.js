/**
 * Workflow Executor
 *
 * Executes multi-step workflows with conversation-based context management
 * and prompt caching. This is a more sophisticated approach than the simple
 * test executor, designed for complex tasks that benefit from step-by-step
 * guidance with cached context.
 */

import { ConversationContext, TaskWorkflow, StepType } from './conversation-context.js';
import { promises as fs } from 'fs';
import path from 'path';

export class WorkflowExecutor {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.workingDir = options.workingDir || process.cwd();
    this.enableCaching = options.enableCaching !== false;
  }

  /**
   * Execute a task using a defined workflow
   */
  async executeWorkflow(agent, workflow, options = {}) {
    const context = new ConversationContext({
      taskId: workflow.id,
      enableCaching: this.enableCaching,
      workingDir: this.workingDir
    });

    const taskWorkflow = new TaskWorkflow(workflow.id, workflow.steps);

    if (this.verbose) {
      console.log(`\n[WorkflowExecutor] Starting workflow: ${workflow.name}`);
      console.log(`[WorkflowExecutor] Steps: ${workflow.steps.length}`);
    }

    // Add agent system prompt to context (CACHED)
    context.addSystem(agent.systemPrompt || '');

    // Execute each step in the workflow
    let stepResults = [];
    let stepIndex = 0;

    while (!taskWorkflow.isComplete()) {
      const step = taskWorkflow.getCurrentStep();
      const isFirstStep = stepIndex === 0;

      if (this.verbose) {
        const progress = taskWorkflow.getProgress();
        console.log(`\n[WorkflowExecutor] Step ${progress.current}/${progress.total}: ${step.name}`);
      }

      try {
        const stepResult = await this.executeStep(agent, step, context, options, isFirstStep);
        stepResults.push(stepResult);

        if (!stepResult.success) {
          if (this.verbose) {
            console.error(`[WorkflowExecutor] Step failed: ${stepResult.error}`);
          }

          return {
            success: false,
            workflow: workflow.id,
            stepsFailed: stepResults.filter(r => !r.success).length,
            error: stepResult.error,
            context: context.export()
          };
        }

        // Move to next step
        taskWorkflow.nextStep();
        stepIndex++;

      } catch (error) {
        if (this.verbose) {
          console.error(`[WorkflowExecutor] Step error: ${error.message}`);
        }

        return {
          success: false,
          workflow: workflow.id,
          error: error.message,
          context: context.export()
        };
      }
    }

    if (this.verbose) {
      console.log(`\n[WorkflowExecutor] Workflow complete!`);
      console.log(context.getSummary());
    }

    return {
      success: true,
      workflow: workflow.id,
      steps: stepResults,
      context: context.export(),
      stats: context.getStats()
    };
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(agent, step, context, options = {}, isFirstStep = false) {
    const startTime = Date.now();

    try {
      // Build the prompt for this step
      let stepPrompt;
      if (typeof step.prompt === 'function') {
        // Dynamic prompt based on context
        stepPrompt = step.prompt(context);
      } else {
        stepPrompt = step.prompt;
      }

      // Add step prompt to context for tracking
      context.addUser(stepPrompt, {
        cache: stepPrompt.length > 1000
      });

      // Execute agent using session continuation
      // Claude Code CLI maintains conversation history when using --resume
      if (!isFirstStep) {
        agent.resumeSession = true; // Use --resume for steps after first
      }

      const result = await agent.query(stepPrompt);

      // Extract response string from result object
      const response = result.response || result;

      // Add response to context
      context.addAssistant(response);

      // If this step should capture sn-tools outputs, extract them
      if (step.captureSnTools) {
        await this.captureSnToolsOutputs(response, context);
      }

      // Validate step completion
      const valid = step.validate ? step.validate(response) : true;

      const duration = Date.now() - startTime;

      if (this.verbose) {
        console.log(`[WorkflowExecutor]   ✓ Step completed in ${Math.round(duration/1000)}s`);
      }

      return {
        success: valid,
        stepName: step.name,
        stepType: step.type,
        duration,
        response
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.verbose) {
        console.error(`[WorkflowExecutor]   ✗ Step failed after ${Math.round(duration/1000)}s`);
      }

      return {
        success: false,
        stepName: step.name,
        stepType: step.type,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Extract and capture sn-tools command outputs from agent response
   * This is the critical piece - we parse bash outputs and cache them
   */
  async captureSnToolsOutputs(response, context) {
    // Pattern to match bash command outputs in response
    const bashBlockPattern = /```bash\s*\n([\s\S]*?)\n```/g;

    let match;
    while ((match = bashBlockPattern.exec(response)) !== null) {
      const bashContent = match[1];

      // Extract command and output
      const lines = bashContent.split('\n');
      let command = '';
      let output = [];
      let inOutput = false;

      for (const line of lines) {
        // Command lines start with $ or #
        if (line.trim().startsWith('$') || line.trim().startsWith('#')) {
          if (command && output.length > 0) {
            // Save previous command/output pair
            context.captureSnToolsOutput(command, output.join('\n'));
          }
          command = line.replace(/^[$#]\s*/, '').trim();
          output = [];
          inOutput = true;
        } else if (inOutput && line.trim()) {
          output.push(line);
        }
      }

      // Capture last command/output
      if (command && output.length > 0) {
        context.captureSnToolsOutput(command, output.join('\n'));
      }
    }

    // Also check for inline bash execution results
    const inlinePattern = /(?:npm run|cd.*&&\s*npm run)\s+([^\s]+)\s+--\s+([^\n]+)/g;
    while ((match = inlinePattern.exec(response)) !== null) {
      const command = `npm run ${match[1]} -- ${match[2]}`;

      // Try to find the output in the response after this command
      const commandIndex = response.indexOf(match[0]);
      const afterCommand = response.substring(commandIndex + match[0].length, commandIndex + 2000);

      // Look for output in code blocks or structured sections
      const outputMatch = afterCommand.match(/```(?:bash|json)?\s*\n([\s\S]*?)\n```/);
      if (outputMatch) {
        context.captureSnToolsOutput(command, outputMatch[1]);
      }
    }

    if (this.verbose && context.snToolsOutputs.size > 0) {
      console.log(`[WorkflowExecutor]   📋 Captured ${context.snToolsOutputs.size} sn-tools outputs`);
    }
  }
}
