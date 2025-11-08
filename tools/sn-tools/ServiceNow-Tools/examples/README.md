# ServiceNow Tools - End-to-End Examples

Complete walkthrough examples showing how to use sn-tools AI-assisted operations from start to finish.

---

## 📚 Available Examples

### [Example 1: Create Incident Validation Rule](./01-incident-validation-rule.md)
**Difficulty:** Beginner
**Time:** 15-20 minutes
**Operation Type:** Business Rule

**What You'll Learn:**
- Using AI to analyze natural language requests
- Building operation plans with templates
- **CRUD auto-detection in action**
- Validating before deployment
- Optimizing based on recommendations

**Real-World Use Case:**
Create a server-side validation rule that prevents users from creating High severity incidents without setting priority.

---

### [Example 2: Create Priority Escalation Button](./02-priority-escalation-button.md)
**Difficulty:** Intermediate
**Time:** 25-30 minutes
**Operation Type:** UI Action

**What You'll Learn:**
- Creating form buttons with UI Actions
- Client vs Server-side script architecture
- Using GlideAjax for server communication
- Dependency management (Script Includes)
- Error handling and user feedback

**Real-World Use Case:**
Create a one-click button that allows support agents to escalate incident priority to Critical with automatic work note logging.

---

### [Example 3: Build Custom REST API](./03-rest-api-incident-summary.md)
**Difficulty:** Intermediate-Advanced
**Time:** 30-40 minutes
**Operation Type:** REST API

**What You'll Learn:**
- Creating REST API endpoints
- HTTP method validation (GET, POST)
- Read-only API design
- Performance optimization with aggregation
- Rate limiting and authentication
- External integration patterns

**Real-World Use Case:**
Create a REST API endpoint that returns incident statistics by priority and state for external dashboards and reporting tools.

---

### [Example 4: Create ACL Field Protection](./04-acl-field-protection.md)
**Difficulty:** Intermediate
**Time:** 20-25 minutes
**Operation Type:** Access Control List (ACL)

**What You'll Learn:**
- Creating field-level Access Control Lists
- Security best practices for field protection
- Role and group-based access control
- Testing ACL effectiveness
- Audit logging for access decisions

**Real-World Use Case:**
Protect the "Assigned to" field on incidents so only Incident Managers can modify assignments, preventing unauthorized reassignment.

---

### [Example 5: Create Email Notification](./05-email-notification.md)
**Difficulty:** Beginner-Intermediate
**Time:** 15-20 minutes
**Operation Type:** Notification

**What You'll Learn:**
- Creating event-triggered notifications
- Building HTML email templates with variables
- Recipient configuration strategies
- Testing notification delivery
- Variable substitution and dynamic content

**Real-World Use Case:**
Send automated email alerts to incident managers when high-priority incidents are assigned to their groups, including incident details and direct link.

---

### [Example 6: Create Scheduled Cleanup Job](./06-scheduled-cleanup-job.md)
**Difficulty:** Intermediate-Advanced
**Time:** 25-30 minutes
**Operation Type:** Scheduled Job

**What You'll Learn:**
- Creating scheduled jobs with cron-like scheduling
- Writing efficient batch processing scripts
- Implementing safety checks and dry-run mode
- Performance optimization for large datasets
- Email summaries and comprehensive logging

**Real-World Use Case:**
Automatically close resolved incidents that have been in "Resolved" state for more than 7 days, improving data hygiene and reducing manual workload.

---

## 🎯 Quick Start Guide

### Prerequisites
1. ServiceNow instance (dev or personal)
2. sn-tools installed and configured
3. Node.js v22+ installed
4. Basic ServiceNow knowledge

### Setup
```bash
# Navigate to ServiceNow-Tools directory
cd /home/coltrip/claude-automation/tools/sn-tools/ServiceNow-Tools

# Verify installation
npm run test-connections

# Check AI systems are ready
node test-ai-system.js
```

### Your First Example
Start with [Example 1: Incident Validation Rule](./01-incident-validation-rule.md) - it's the most beginner-friendly and demonstrates all core concepts.

---

## 🔑 Key Concepts Demonstrated

### CRUD Auto-Detection
All examples showcase automatic CRUD (Create, Read, Update, Delete) operation detection:

- **Example 1:** Detects READ operations and suggests action flags
- **Example 2:** Identifies mixed client/server code and recommends separation
- **Example 3:** Confirms read-only operations match GET HTTP method

### AI-Assisted Workflow
Every example follows the complete AI-assisted workflow:

1. **Analyze** - Natural language request → Operation suggestion
2. **Guidance** - Get template structure and requirements
3. **Plan** - Build operation plan with CRUD auto-detection
4. **Validate** - Check schema, syntax, and best practices
5. **Refine** - Apply recommendations and optimize
6. **Deploy** - Push to ServiceNow instance
7. **Monitor** - Track usage and errors

### Best Practices
Examples demonstrate ServiceNow development best practices:

- Proper error handling
- Security considerations
- Performance optimization
- Code organization
- Documentation

---

## 📊 Example Comparison

| Example | Type | Difficulty | CRUD Ops | Time | Key Feature |
|---------|------|------------|----------|------|-------------|
| #1 Validation Rule | Business Rule | ⭐ Beginner | READ, UPDATE | 15-20min | CRUD Auto-Detection |
| #2 Escalation Button | UI Action | ⭐⭐ Intermediate | READ, UPDATE, AJAX | 25-30min | Client-Server Architecture |
| #3 REST API | API Endpoint | ⭐⭐⭐ Advanced | READ (Aggregation) | 30-40min | Performance Optimization |
| #4 ACL Protection | Access Control | ⭐⭐ Intermediate | READ (Security) | 20-25min | Field-Level Security |
| #5 Email Notification | Notification | ⭐ Beginner-Int | READ | 15-20min | Event-Driven Automation |
| #6 Scheduled Job | Batch Processing | ⭐⭐⭐ Advanced | READ, UPDATE (Batch) | 25-30min | Large-Scale Automation |

---

## 🛠️ Common Workflows

### Pattern 1: Validation Rules
**When to use:** Enforce data quality, prevent invalid records
**Example:** #1 Incident Validation Rule
**Operations:** Business Rules with READ/UPDATE detection

### Pattern 2: User Actions
**When to use:** Provide one-click workflows for users
**Example:** #2 Priority Escalation Button
**Operations:** UI Actions with client-server communication

### Pattern 3: Integration APIs
**When to use:** External system integration, custom reporting
**Example:** #3 REST API Summary
**Operations:** REST APIs with read-only operations

### Pattern 4: Security Controls
**When to use:** Protect sensitive fields, enforce access policies
**Example:** #4 ACL Field Protection
**Operations:** Access Control Lists with role-based security

### Pattern 5: Event Notifications
**When to use:** Alert stakeholders of important events
**Example:** #5 Email Notification
**Operations:** Notifications with event triggers

### Pattern 6: Automated Maintenance
**When to use:** Recurring data cleanup and batch processing
**Example:** #6 Scheduled Cleanup Job
**Operations:** Scheduled Jobs with batch operations

---

## 📁 Example File Structure

Each example includes:

```
01-example-name.md
├── Step 1: Analyze Request
├── Step 2: Get Guidance
├── Step 3: Build Plan
├── Step 4: Validate
├── Step 5: Refine (Optional)
├── Step 6: Deploy
├── Step 7: Test
├── Monitoring
├── Key Takeaways
├── Troubleshooting
└── Related Examples
```

---

## 🚀 After Completing Examples

### Next Steps

1. **Create Your Own Operations**
   ```bash
   node sn-ai-operations-cli.js analyze "your requirement here"
   ```

2. **Analyze Existing Scripts**
   ```bash
   node sn-crud-analyzer-cli.js file path/to/your/script.js
   ```

3. **Monitor Your Operations**
   ```bash
   node sn-ai-monitor-cli.js summary
   ```

### Advanced Topics

- **Batch Operations:** Process multiple operations at once
- **Custom Templates:** Create your own operation templates
- **CI/CD Integration:** Automate with GitHub Actions
- **Field-Level CRUD:** Track specific field access patterns

---

## 💡 Tips for Success

### 1. Start Simple
Begin with Example 1, even if you're experienced. It establishes the foundational workflow.

### 2. Follow the Steps
Each example is designed to be followed sequentially. Don't skip validation steps.

### 3. Understand CRUD Detection
Pay attention to what operations are auto-detected. This teaches you how the AI analyzes scripts.

### 4. Review Recommendations
When validation provides recommendations, understand WHY before accepting them.

### 5. Test Thoroughly
Always test in a development instance before production deployment.

---

## 🐛 Troubleshooting

### Common Issues

**Problem:** "Command not found: node"
- **Solution:** Install Node.js v22+ or use correct path

**Problem:** "Connection refused" when testing
- **Solution:** Check sn-config.json credentials and instance URL

**Problem:** "CRUD detection returned no results"
- **Solution:** Ensure script field is provided and contains CRUD operations

**Problem:** "Validation failed: Missing required field"
- **Solution:** Review template guidance for required fields

**Problem:** "Operation not found"
- **Solution:** Check available operations with `node sn-ai-operations-cli.js list`

### Getting Help

1. **Check Documentation:**
   - [NEW_FEATURES_GUIDE.md](../NEW_FEATURES_GUIDE.md)
   - [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)
   - [AI_TOOLS_GUIDE.md](../AI_TOOLS_GUIDE.md)

2. **Run Diagnostics:**
   ```bash
   npm run test-connections
   node test-ai-system.js
   ```

3. **View Logs:**
   ```bash
   node sn-ai-monitor-cli.js errors
   ```

---

## 📈 Learning Path

### Beginner Track
1. Complete Example 1 (Validation Rule)
2. Modify Example 1 for different table/fields
3. Create your own validation rule

### Intermediate Track
1. Complete Examples 1-2
2. Combine concepts (Button that validates)
3. Add error handling and logging

### Advanced Track
1. Complete all 3 examples
2. Create multi-step operations
3. Build custom templates
4. Implement CI/CD automation

---

## 🎓 Additional Resources

### Video Tutorials
- Coming soon: 5-minute quick start
- Coming soon: Complete walkthrough series

### External Links
- [ServiceNow Documentation](https://docs.servicenow.com/)
- [ServiceNow Community](https://community.servicenow.com/)
- [GlideAPI Reference](https://developer.servicenow.com/dev.do#!/reference/api/)

### Templates
All operation templates are available in:
```
/templates/
├── create_business_rule.json
├── create_client_script.json
├── create_ui_action.json
└── create_rest_api.json
```

---

## 💬 Feedback

Found an issue with an example? Have a suggestion for a new example?

1. Review the example documentation
2. Check troubleshooting section
3. Report issues with detailed steps to reproduce

---

## ✅ Example Completion Checklist

After completing each example, verify:

- [ ] Analyzed request successfully
- [ ] Built operation plan with correct data
- [ ] CRUD auto-detection ran and provided insights
- [ ] Validated plan (passed or addressed warnings)
- [ ] Deployed to ServiceNow instance
- [ ] Tested all scenarios successfully
- [ ] Monitored for errors
- [ ] Understood key takeaways

---

## 🎉 Success Stories

Share your experience:
- What operations did you create?
- How much time did CRUD auto-detection save?
- What challenges did you encounter?
- What would you like to see in future examples?

---

**Happy Building! 🚀**

For questions or suggestions, consult the main documentation or project README.
