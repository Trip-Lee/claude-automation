# Tools Directory

This directory contains external tools that agents can use to extend their capabilities.

## Overview

Tools are mounted read-only into agent containers at `/tools` and can be executed by agents to perform specialized operations beyond their core capabilities.

## Tool Structure

Each tool should have:
- **tool-manifest.yaml** - Required manifest describing the tool
- **README.md** - Documentation for human readers
- Tool code and dependencies
- Any required configuration files

## Tool Manifest Format

```yaml
name: tool-name
version: 1.0.0
description: Brief description
type: node_script | python_script | binary | shell_script

capabilities:
  - List of what the tool can do

entry_point: path/to/main/executable
working_directory: /tools/tool-name

usage: |
  How to execute this tool

examples:
  - command: "example command"
    description: "what it does"
    use_case: "when to use it"

requires:
  - Dependencies

environment:
  - name: ENV_VAR_NAME
    description: What it's for
    required: true/false

constraints:
  read_only: true          # Tool code is read-only
  executable: true         # Tool can be executed
  network: true/false      # Needs network access
  requires_config: true/false

metadata:
  author: Name
  license: License type
```

## Available Tools

### sn-tools (ServiceNow Tools v2.1.0)
**Purpose:** ServiceNow development and automation toolkit

**Capabilities:**
- Query and modify ServiceNow records
- Multi-instance support (dev/prod)
- Dependency tracking and impact analysis
- Real-time file watching and syncing
- Flow tracing and analysis

**Usage:**
```bash
cd /tools/sn-tools/ServiceNow-Tools
npm run test-connections  # Test connectivity
npm run fetch-data        # Fetch ServiceNow data
npm run dependency-scan   # Scan dependencies
```

**Requirements:**
- ServiceNow instance credentials
- Node.js 12+

## Adding New Tools

1. **Create tool directory:**
   ```bash
   mkdir -p tools/my-tool
   ```

2. **Copy template manifest:**
   ```bash
   cp tools/template/tool-manifest.yaml tools/my-tool/
   ```

3. **Fill in accurate tool information:**
   - Update name, version, description
   - List all capabilities (what it can do)
   - Provide clear usage examples
   - Specify all requirements
   - Define environment variables

4. **Add tool code:**
   - Place executable scripts
   - Include dependencies (package.json, requirements.txt, etc.)
   - Add README documentation

5. **Test tool:**
   - Verify manifest accuracy
   - Test execution in Docker container
   - Ensure read-only mount works
   - Validate environment variable passing

## Tool Execution in Containers

Tools are mounted into agent containers with these characteristics:

**Mount Point:** `/tools` (read-only)

**Execution Methods:**
1. **Dedicated Tool Interface (Primary):**
   ```javascript
   // Agents can use tool execution interface
   executeTool('sn-tools', 'test-connections', options)
   ```

2. **Bash Fallback (Secondary):**
   ```bash
   # Agents can use Bash tool directly
   cd /tools/sn-tools/ServiceNow-Tools && npm run test-connections
   ```

**Permissions:**
- ✅ Read tool files
- ✅ Execute tool scripts
- ❌ Modify tool code
- ❌ Delete tool files

## Environment Variables

Tools should use namespaced environment variables:

**Pattern:** `TOOLNAME_VAR_NAME`

**Examples:**
- `SNTOOL_DEV_URL` - ServiceNow dev instance URL
- `SNTOOL_DEV_USERNAME` - ServiceNow username
- `JIRA_API_TOKEN` - Jira API token
- `SLACK_WEBHOOK` - Slack webhook URL

**Benefits:**
- Prevents variable name conflicts
- Clear tool ownership
- Easy to filter and pass to containers

## Security Considerations

1. **Read-Only Mounting:**
   - Tool code cannot be modified by agents
   - Prevents malicious code injection
   - Protects tool integrity

2. **Credential Isolation:**
   - Each tool gets only its namespaced env vars
   - Agents don't see all environment variables
   - Credentials stay in host ~/.env

3. **Network Controls:**
   - Tools declare network requirements in manifest
   - Docker network policies can be enforced
   - Outbound connections can be monitored

## Tool Registry

The tool registry (`lib/tool-registry.js`) automatically:
- Discovers all tools by scanning for `tool-manifest.yaml`
- Validates tool manifests
- Builds agent context with tool descriptions
- Handles tool execution with proper permissions

## Best Practices

1. **Accurate Descriptions:**
   - Describe exactly what the tool does
   - Don't promise capabilities it doesn't have
   - Update manifest when tool capabilities change

2. **Clear Examples:**
   - Provide concrete command examples
   - Include expected outcomes
   - Document error cases

3. **Explicit Requirements:**
   - List all dependencies
   - Specify version requirements
   - Document configuration needs

4. **Namespaced Variables:**
   - Use tool-specific prefixes
   - Document all environment variables
   - Provide example values

5. **Testing:**
   - Test in Docker containers
   - Verify read-only execution
   - Check environment variable passing
   - Validate error handling

## Troubleshooting

### Tool Not Found
- Check tool-manifest.yaml exists
- Verify manifest is valid YAML
- Ensure tool directory is in tools/

### Execution Errors
- Check tool dependencies are installed
- Verify environment variables are set
- Test tool outside container first
- Check file permissions

### Permission Denied
- Tools must have execute permissions (chmod +x)
- Scripts need proper shebang (#!/usr/bin/env node)
- Working directory must be accessible

### Environment Variables Not Available
- Check variable is in ~/.env on host
- Verify variable uses tool namespace
- Confirm Docker env var passing
- Check manifest environment section

## Future Enhancements

- [ ] Tool versioning and updates
- [ ] Tool dependency management
- [ ] Tool usage analytics
- [ ] Tool output caching
- [ ] Tool execution quotas
- [ ] Tool performance monitoring

---

**Last Updated:** 2025-10-27
**Version:** 1.0.0
