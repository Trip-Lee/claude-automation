/**
 * Tool Registry
 *
 * Discovers, validates, and manages external tools available to agents.
 * Tools are mounted read-only in containers and can be executed to extend agent capabilities.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ToolRegistry {
  constructor(toolsDir = null) {
    this.toolsDir = toolsDir || path.join(__dirname, '..', 'tools');
    this.tools = new Map();
    this.loadAllTools();
  }

  /**
   * Load all tools from the tools directory
   */
  loadAllTools() {
    if (!fs.existsSync(this.toolsDir)) {
      console.warn(`Tools directory not found: ${this.toolsDir}`);
      return;
    }

    const entries = fs.readdirSync(this.toolsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'template') {
        const toolPath = path.join(this.toolsDir, entry.name);
        const manifestPath = path.join(toolPath, 'tool-manifest.yaml');

        if (fs.existsSync(manifestPath)) {
          try {
            const tool = this.loadTool(entry.name, manifestPath);
            if (tool) {
              this.tools.set(tool.name, tool);
              console.log(`Loaded tool: ${tool.name} v${tool.version}`);
            }
          } catch (error) {
            console.error(`Failed to load tool ${entry.name}:`, error.message);
          }
        }
      }
    }

    console.log(`Tool registry initialized with ${this.tools.size} tool(s)`);
  }

  /**
   * Load a single tool from its manifest
   */
  loadTool(dirName, manifestPath) {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = yaml.parse(manifestContent);

    // Validate required fields
    this.validateManifest(manifest, manifestPath);

    // Add computed fields
    manifest.directoryName = dirName;
    manifest.manifestPath = manifestPath;
    manifest.toolPath = path.dirname(manifestPath);
    manifest.containerPath = `/tools/${dirName}`;

    return manifest;
  }

  /**
   * Validate tool manifest structure
   */
  validateManifest(manifest, manifestPath) {
    const required = ['name', 'version', 'description', 'type', 'capabilities', 'entry_point'];
    const missing = required.filter(field => !manifest[field]);

    if (missing.length > 0) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: missing required fields: ${missing.join(', ')}`
      );
    }

    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: capabilities must be a non-empty array`
      );
    }

    const validTypes = ['node_script', 'python_script', 'binary', 'shell_script'];
    if (!validTypes.includes(manifest.type)) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: type must be one of: ${validTypes.join(', ')}`
      );
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Get all tools
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool exists
   */
  hasTool(name) {
    return this.tools.has(name);
  }

  /**
   * Get tool names
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool count
   */
  getToolCount() {
    return this.tools.size;
  }

  /**
   * Get formatted tool context for agents
   * This is what agents see to help them decide which tools to use
   */
  getToolContext() {
    const tools = this.getAllTools();

    if (tools.length === 0) {
      return null;
    }

    const context = {
      available_tools: tools.length,
      tools: tools.map(tool => ({
        name: tool.name,
        version: tool.version,
        description: tool.description,
        type: tool.type,
        capabilities: tool.capabilities,
        usage: tool.usage,
        examples: tool.examples || [],
        requires: tool.requires || [],
        environment: tool.environment || [],
        constraints: tool.constraints || {},
        agent_notes: tool.agent_notes || ''
      }))
    };

    return context;
  }

  /**
   * Get formatted tool context as markdown for agent prompts
   */
  getToolContextMarkdown() {
    const context = this.getToolContext();

    if (!context) {
      return '';
    }

    let markdown = `# Available Tools\n\n`;
    markdown += `You have access to ${context.available_tools} external tool(s) mounted at /tools (read-only).\n\n`;

    for (const tool of context.tools) {
      markdown += `## ${tool.name} (v${tool.version})\n\n`;
      markdown += `**Description:** ${tool.description}\n\n`;
      markdown += `**Type:** ${tool.type}\n\n`;

      markdown += `**Capabilities:**\n`;
      for (const capability of tool.capabilities) {
        markdown += `- ${capability}\n`;
      }
      markdown += `\n`;

      if (tool.usage) {
        markdown += `**Usage:**\n\`\`\`\n${tool.usage}\n\`\`\`\n\n`;
      }

      if (tool.examples && tool.examples.length > 0) {
        markdown += `**Examples:**\n\n`;
        for (const example of tool.examples) {
          markdown += `**Example:** ${example.description}\n`;
          markdown += `\`\`\`bash\n${example.command}\n\`\`\`\n`;
          if (example.use_case) {
            markdown += `*Use case: ${example.use_case}*\n`;
          }
          markdown += `\n`;
        }
      }

      if (tool.environment && tool.environment.length > 0) {
        markdown += `**Environment Variables:**\n`;
        for (const env of tool.environment) {
          const reqStr = env.required ? ' (required)' : ' (optional)';
          markdown += `- \`${env.name}\`${reqStr}: ${env.description}\n`;
        }
        markdown += `\n`;
      }

      if (tool.agent_notes) {
        markdown += `**Agent Notes:**\n${tool.agent_notes}\n\n`;
      }

      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Get tool execution info for a specific tool
   */
  getToolExecutionInfo(toolName) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return {
      name: tool.name,
      type: tool.type,
      containerPath: tool.containerPath,
      entryPoint: tool.entry_point,
      workingDirectory: tool.working_directory || tool.containerPath,
      fullPath: path.join(tool.containerPath, tool.entry_point),
      requiresNetwork: tool.constraints?.network || false,
      requiresConfig: tool.constraints?.requires_config || false
    };
  }

  /**
   * Get environment variables for a specific tool
   * Filters host environment to only include tool-namespaced variables
   */
  getToolEnvironmentVars(toolName) {
    const tool = this.getTool(toolName);
    if (!tool || !tool.environment) {
      return {};
    }

    const envVars = {};

    for (const envDef of tool.environment) {
      const varName = envDef.name;
      const hostValue = process.env[varName];

      if (hostValue) {
        envVars[varName] = hostValue;
      } else if (envDef.required) {
        console.warn(`Warning: Required environment variable ${varName} for tool ${toolName} is not set`);
      }
    }

    return envVars;
  }

  /**
   * Get all environment variables for all tools
   */
  getAllToolEnvironmentVars() {
    const allEnvVars = {};

    for (const toolName of this.getToolNames()) {
      const toolEnvVars = this.getToolEnvironmentVars(toolName);
      Object.assign(allEnvVars, toolEnvVars);
    }

    return allEnvVars;
  }

  /**
   * Validate tool execution prerequisites
   */
  validateToolExecution(toolName) {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { valid: false, error: `Tool not found: ${toolName}` };
    }

    // Check required environment variables
    if (tool.environment) {
      for (const envDef of tool.environment) {
        if (envDef.required && !process.env[envDef.name]) {
          return {
            valid: false,
            error: `Missing required environment variable: ${envDef.name}`,
            suggestion: `Set ${envDef.name} in ~/.env. Example: ${envDef.example || 'value'}`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Get tool statistics
   */
  getStats() {
    return {
      total_tools: this.tools.size,
      tools_by_type: this.getToolsByType(),
      tools_requiring_network: this.getToolsRequiringNetwork().length,
      tools_requiring_config: this.getToolsRequiringConfig().length,
      total_capabilities: this.getTotalCapabilities()
    };
  }

  /**
   * Get tools grouped by type
   */
  getToolsByType() {
    const byType = {};

    for (const tool of this.tools.values()) {
      byType[tool.type] = (byType[tool.type] || 0) + 1;
    }

    return byType;
  }

  /**
   * Get tools that require network access
   */
  getToolsRequiringNetwork() {
    return this.getAllTools().filter(tool => tool.constraints?.network === true);
  }

  /**
   * Get tools that require configuration
   */
  getToolsRequiringConfig() {
    return this.getAllTools().filter(tool => tool.constraints?.requires_config === true);
  }

  /**
   * Get total number of capabilities across all tools
   */
  getTotalCapabilities() {
    return this.getAllTools().reduce((sum, tool) => sum + tool.capabilities.length, 0);
  }
}

export { ToolRegistry };
