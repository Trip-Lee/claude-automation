/**
 * Executor Agent - Simple test version
 */

const AutonomousAgent = require('./autonomous-agent');

class ExecutorAgent extends AutonomousAgent {
    constructor(name, config = {}) {
        super(name, config);
    }

    async executeTask(task) {
        console.log(`[ExecutorAgent] Executing: ${task.type}`);
        return { executed: true, task: task.type, timestamp: Date.now() };
    }
}

module.exports = ExecutorAgent;