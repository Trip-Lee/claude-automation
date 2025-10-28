/**
 * Learner Agent - Simple test version
 */

const AutonomousAgent = require('./autonomous-agent');

class LearnerAgent extends AutonomousAgent {
    constructor(name, config = {}) {
        super(name, config);
    }

    async performLearningCycle() {
        console.log('[LearnerAgent] Performing learning cycle...');
        return { learned: true, timestamp: Date.now() };
    }
}

module.exports = LearnerAgent;