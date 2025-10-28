/**
 * AgentRegistry - Central registry for all available agents
 *
 * Manages agent definitions, capabilities, and instantiation.
 * Enables dynamic agent discovery and selection.
 */

export class AgentRegistry {
  constructor() {
    this.agents = new Map();
  }

  /**
   * Register an agent with its configuration
   * @param {Object} config - Agent configuration
   * @param {string} config.name - Unique agent name
   * @param {string} config.description - What the agent does
   * @param {Array<string>} config.capabilities - Agent capabilities
   * @param {Array<string>} config.tools - Allowed tools
   * @param {number} config.estimatedCost - Estimated cost per execution
   * @param {Function} config.factory - Factory function to create agent instance
   */
  register(config) {
    if (!config.name) {
      throw new Error('Agent name is required');
    }

    if (!config.factory || typeof config.factory !== 'function') {
      throw new Error('Agent factory function is required');
    }

    this.agents.set(config.name, {
      name: config.name,
      description: config.description || 'No description provided',
      capabilities: config.capabilities || [],
      tools: config.tools || [],
      estimatedCost: config.estimatedCost || 0.02,
      factory: config.factory,
      metadata: config.metadata || {}
    });

    return this;
  }

  /**
   * Get agent configuration by name
   * @param {string} name - Agent name
   * @returns {Object|null} - Agent configuration or null if not found
   */
  get(name) {
    return this.agents.get(name) || null;
  }

  /**
   * Check if agent exists
   * @param {string} name - Agent name
   * @returns {boolean}
   */
  has(name) {
    return this.agents.has(name);
  }

  /**
   * Find agents by capability
   * @param {string} capability - Capability to search for
   * @returns {Array<Object>} - Array of matching agent configs
   */
  findByCapability(capability) {
    return Array.from(this.agents.values())
      .filter(agent => agent.capabilities.includes(capability));
  }

  /**
   * Find agents by multiple capabilities (AND logic)
   * @param {Array<string>} capabilities - Capabilities required
   * @returns {Array<Object>} - Agents with ALL capabilities
   */
  findByCapabilities(capabilities) {
    return Array.from(this.agents.values())
      .filter(agent =>
        capabilities.every(cap => agent.capabilities.includes(cap))
      );
  }

  /**
   * List all registered agents
   * @returns {Array<Object>} - All agent configurations
   */
  listAll() {
    return Array.from(this.agents.values());
  }

  /**
   * Get summary of all agents for display
   * @returns {string} - Formatted list of agents
   */
  getSummary() {
    return this.listAll()
      .map(agent => {
        const caps = agent.capabilities.join(', ') || 'none';
        return `  - ${agent.name}: ${agent.description}\n    Capabilities: ${caps}\n    Est. Cost: $${agent.estimatedCost.toFixed(4)}`;
      })
      .join('\n\n');
  }

  /**
   * Unregister an agent
   * @param {string} name - Agent name to remove
   * @returns {boolean} - True if removed, false if not found
   */
  unregister(name) {
    return this.agents.delete(name);
  }

  /**
   * Clear all registered agents
   */
  clear() {
    this.agents.clear();
  }

  /**
   * Get total number of registered agents
   * @returns {number}
   */
  count() {
    return this.agents.size;
  }

  /**
   * Validate that all required agents exist
   * @param {Array<string>} requiredAgents - Agent names that must exist
   * @returns {Object} - { valid: boolean, missing: Array<string> }
   */
  validateAgents(requiredAgents) {
    const missing = requiredAgents.filter(name => !this.has(name));
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get estimated total cost for a sequence of agents
   * @param {Array<string>} agentSequence - Agent names in order
   * @returns {number} - Total estimated cost
   */
  estimateCost(agentSequence) {
    return agentSequence.reduce((total, name) => {
      const agent = this.get(name);
      return total + (agent ? agent.estimatedCost : 0);
    }, 0);
  }
}
