# ServiceNow Agents

**Version**: v0.14.0
**Date**: 2025-10-30

Specialized AI agents for ServiceNow development, optimized for SN-tools testing and ServiceNow platform work.

---

## Available ServiceNow Agents

### 🔌 sn-api - REST API Specialist

**Role**: ServiceNow REST API development and integration

**Capabilities**:
- Scripted REST APIs design and implementation
- Table API operations
- GlideAjax client-server communication
- API authentication and security
- Error handling and response formatting

**Best For**:
- Creating RESTful APIs in ServiceNow
- Building API integrations with external systems
- Implementing GlideAjax for AJAX calls
- API documentation and testing

**Example Usage**:
```bash
dev-tools task sn-project "Create REST API for incident management with CRUD operations"
```

---

### 🔄 sn-flows - Flow Designer Specialist

**Role**: Flow Designer and IntegrationHub automation

**Capabilities**:
- Flow design and implementation
- Custom actions and subflows
- IntegrationHub spoke development
- Flow logic and decision trees
- Trigger condition optimization

**Best For**:
- Building automated workflows
- Creating reusable flow actions
- IntegrationHub integrations
- Process automation

**Example Usage**:
```bash
dev-tools task sn-project "Create flow to automatically assign incidents based on category and urgency"
```

---

### 📜 sn-scripting - Scripting Specialist

**Role**: ServiceNow server and client-side scripting

**Capabilities**:
- Business Rules (before/after, async/sync)
- Client Scripts (onChange, onLoad, onSubmit)
- Script Includes (client-callable & server-side)
- UI Actions and UI Policies
- GlideRecord/GlideQuery optimization

**Best For**:
- Business logic implementation
- Form behavior customization
- Data validation and manipulation
- Performance-critical scripts

**Example Usage**:
```bash
dev-tools task sn-project "Create business rule to validate incident data before submission"
```

---

### 🎨 sn-ui - UI & Portal Specialist

**Role**: Service Portal and UI development

**Capabilities**:
- Service Portal widgets (AngularJS)
- UI Builder components (React/Web Components)
- UI Pages and UI Macros
- Client-side JavaScript
- Responsive design and accessibility

**Best For**:
- Service Portal development
- Custom widget creation
- UI Builder components
- User interface customization

**Example Usage**:
```bash
dev-tools task sn-project "Create Service Portal widget for displaying user's open incidents"
```

---

### 🔗 sn-integration - Integration Specialist

**Role**: External system integration and data synchronization

**Capabilities**:
- REST/SOAP integrations
- Import Sets and Transform Maps
- Scheduled Jobs and Data Sources
- MID Server integrations
- ETL process design

**Best For**:
- Third-party system integrations
- Data imports and exports
- Scheduled data synchronization
- Middleware development

**Example Usage**:
```bash
dev-tools task sn-project "Create integration to sync users from Active Directory using REST API"
```

---

### 🔐 sn-security - Security Specialist

**Role**: Security audit and ACL management

**Capabilities**:
- ACL design and implementation
- Security rule creation
- Vulnerability scanning
- Compliance validation
- Security best practices review

**Best For**:
- Security audits
- ACL troubleshooting
- Compliance checks
- Security hardening

**Example Usage**:
```bash
dev-tools task sn-project "Audit incident table security and recommend ACL improvements"
```

---

### 🧪 sn-testing - Testing Specialist

**Role**: Automated Test Framework (ATF) development

**Capabilities**:
- ATF test creation
- Test suite design
- Server and client-side test steps
- Test data management
- Coverage analysis

**Best For**:
- Creating automated tests
- Test suite organization
- Regression testing
- Quality assurance

**Example Usage**:
```bash
dev-tools task sn-project "Create ATF tests for incident creation workflow"
```

---

### ⚡ sn-performance - Performance Specialist

**Role**: Performance analysis and optimization

**Capabilities**:
- Slow transaction analysis
- Query optimization
- GlideRecord to GlideQuery conversion
- Database indexing recommendations
- Performance profiling

**Best For**:
- Performance troubleshooting
- Query optimization
- Code performance improvement
- Transaction analysis

**Example Usage**:
```bash
dev-tools task sn-project "Analyze and optimize slow-running incident reports"
```

---

## Predefined Task Sequences

The system includes predefined agent sequences for common ServiceNow tasks:

### `sn-full` - Full Implementation
**Sequence**: architect → sn-scripting → sn-security → reviewer

**Use When**: General ServiceNow development with security review

### `sn-api-dev` - API Development
**Sequence**: architect → sn-api → sn-testing → reviewer

**Use When**: Building REST APIs or integrations

### `sn-flow-dev` - Flow Development
**Sequence**: architect → sn-flows → sn-testing → reviewer

**Use When**: Creating flows or automation

### `sn-ui-dev` - UI Development
**Sequence**: architect → sn-ui → sn-testing → reviewer

**Use When**: Building Service Portal widgets or UI components

### `sn-integration-dev` - Integration Development
**Sequence**: architect → sn-integration → sn-security → sn-testing → reviewer

**Use When**: Integrating with external systems

### `sn-security-audit` - Security Audit
**Sequence**: architect → sn-security → reviewer

**Use When**: Security reviews or ACL audits

### `sn-performance` - Performance Optimization
**Sequence**: architect → sn-performance → sn-scripting → sn-performance → reviewer

**Use When**: Optimizing slow code or queries

---

## Automatic Agent Selection

The system automatically selects appropriate ServiceNow agents based on task keywords:

| Keywords | Selected Sequence |
|----------|-------------------|
| "api", "rest", "glideajax" | `sn-api-dev` |
| "flow", "workflow", "integration hub" | `sn-flow-dev` |
| "portal", "widget", "ui builder" | `sn-ui-dev` |
| "integration", "import", "etl" | `sn-integration-dev` |
| "acl", "security", "compliance" | `sn-security-audit` |
| "performance", "slow", "optimize" | `sn-performance` |

---

## Usage Examples

### Example 1: API Development
```bash
dev-tools task sn-tools "Create REST API endpoint for retrieving incident statistics by category"
```
**Selected Agents**: architect → sn-api → sn-testing → reviewer

### Example 2: Flow Automation
```bash
dev-tools task sn-tools "Build flow to notify users when their incidents are updated"
```
**Selected Agents**: architect → sn-flows → sn-testing → reviewer

### Example 3: Security Audit
```bash
dev-tools task sn-tools "Review ACLs on incident table and identify security gaps"
```
**Selected Agents**: architect → sn-security → reviewer

### Example 4: Performance Optimization
```bash
dev-tools task sn-tools "Optimize slow business rule that runs on incident insert"
```
**Selected Agents**: architect → sn-performance → sn-scripting → sn-performance → reviewer

### Example 5: Service Portal Widget
```bash
dev-tools task sn-tools "Create widget showing user's open tasks with filtering"
```
**Selected Agents**: architect → sn-ui → sn-testing → reviewer

---

## Agent Characteristics

| Agent | Read-Only | Cost | Model | Primary Focus |
|-------|-----------|------|-------|---------------|
| sn-api | No | $0.035 | Sonnet | API Implementation |
| sn-flows | No | $0.040 | Sonnet | Flow Design |
| sn-scripting | No | $0.035 | Sonnet | Script Writing |
| sn-ui | No | $0.040 | Sonnet | UI Development |
| sn-integration | No | $0.040 | Sonnet | Integration Work |
| sn-security | Yes | $0.025 | Haiku | Security Analysis |
| sn-testing | No | $0.030 | Sonnet | Test Writing |
| sn-performance | Yes | $0.025 | Haiku | Performance Analysis |

**Notes**:
- **Read-Only agents** (security, performance) use Haiku model for faster, cheaper analysis
- **Implementation agents** use Sonnet model for code generation quality
- Costs are estimates per agent execution

---

## Integration with Standard Agents

ServiceNow agents work alongside standard agents for comprehensive workflows:

```bash
# Complex workflow combining standard and ServiceNow agents
dev-tools task sn-tools "Refactor incident API with improved security and documentation"
```

**Potential Sequence**:
1. architect - Analyze structure
2. sn-api - Implement API changes
3. sn-security - Security review
4. documenter - Update documentation
5. sn-testing - Create tests
6. reviewer - Final review

---

## Best Practices

### 1. Task Description Clarity
Be specific about ServiceNow features you're working with:
- ❌ "Fix the form"
- ✅ "Fix client script on incident form that validates priority field"

### 2. Leverage Agent Expertise
Use specialized agents for their domain:
- Use **sn-api** for REST APIs, not generic **coder**
- Use **sn-flows** for Flow Designer, not **architect**
- Use **sn-security** for ACL reviews, not **security**

### 3. Test Everything
Always include testing agents in your sequences:
```bash
# Good: Includes testing
architect → sn-scripting → sn-testing → reviewer

# Better: Includes security and testing
architect → sn-scripting → sn-security → sn-testing → reviewer
```

### 4. Performance Considerations
For performance-critical work:
```bash
architect → sn-performance → sn-scripting → sn-performance → reviewer
```

The second sn-performance validates optimizations.

---

## Troubleshooting

### Agent Not Selected
If your ServiceNow agent isn't being selected automatically:

1. **Check keywords** - Use ServiceNow-specific terms in task description
2. **Manual selection** - Specify agent sequence in config (future feature)
3. **Review task** - Ensure task is ServiceNow-related

### Integration Failures
If sn-integration agent fails:

1. Check authentication credentials
2. Verify external system accessibility
3. Review REST Message configuration
4. Check MID Server status (if used)

### Test Failures (sn-testing)
If ATF tests fail:

1. Verify test user permissions
2. Check test data availability
3. Review application scope
4. Validate prerequisite steps

---

## Version History

### v0.14.0 (2025-10-30)
- Initial release of ServiceNow agents
- 8 specialized agents for ServiceNow platform
- Automatic agent selection based on keywords
- Predefined task sequences for common scenarios
- Integration with standard agent system

---

## Future Enhancements

### Planned Features
- [ ] CMDB-specific agent for configuration management
- [ ] Service Catalog agent for catalog item development
- [ ] Update Set agent for deployment management
- [ ] Custom agent configuration per ServiceNow instance
- [ ] Agent learning from task history

### Coming Soon
- Agent performance metrics and analytics
- Custom agent sequence configuration in project YAML
- Multi-instance agent support
- ServiceNow-specific cost optimization

---

## Support

For ServiceNow agent issues or questions:
- Review this documentation
- Check agent logs: `~/.claude-logs/<taskId>.log`
- Validate configuration: `dev-tools validate`
- Report issues: https://github.com/Trip-Lee/claude-automation/issues

---

**ServiceNow agents are production-ready and optimized for SN-tools testing.**
