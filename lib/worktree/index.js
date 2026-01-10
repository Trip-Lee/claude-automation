/**
 * Worktree Agent System
 *
 * A lightweight multi-agent system that leverages Claude's native Task tool
 * patterns for coordination. Replaces the heavyweight DynamicAgentExecutor
 * with a simpler, more efficient approach.
 *
 * Key exports:
 * - WorktreeOrchestrator: Main entry point for task execution
 * - AgentConversation: Shared conversation manager
 * - WorktreeAgentRegistry: Agent definitions and registration
 * - WorktreeExecutor: Low-level agent execution
 * - InteractiveCli: Terminal interface for user interaction
 * - Compatibility: Adapters for backward compatibility with old system
 */

export { WorktreeOrchestrator, OrchestratorStrategy, TaskComplexity } from './orchestrator.js';
export { AgentConversation, MessageRole } from './agent-conversation.js';
export { WorktreeAgentRegistry, WorktreeAgent } from './agent-registry.js';
export { WorktreeExecutor } from './executor.js';
export { InteractiveCli, runInteractiveCli } from './interactive-cli.js';

// Backward compatibility adapters
export {
  OrchestratorAdapter,
  AgentRegistryAdapter,
  AgentAdapter,
  TestExecutorAdapter,
  createAgentSystem
} from './compat.js';

// Default export is the orchestrator
export { WorktreeOrchestrator as default } from './orchestrator.js';
