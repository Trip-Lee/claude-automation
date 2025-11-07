# Example 5: Create Email Notification

## Scenario
Create an automated email notification that alerts incident managers when a high-priority incident is assigned to their group, including incident details and a direct link to the record for quick access.

## What You'll Learn
- Creating event-triggered notifications
- Building email templates with variables
- Recipient configuration strategies
- Testing notification delivery
- CRUD auto-detection for notification operations

**Difficulty:** Beginner-Intermediate
**Time:** 15-20 minutes
**Operation Type:** Notification

---

## Step 1: Analyze the Request

**Command:**
```bash
node sn-ai-operations-cli.js analyze "create email notification for incident managers when high priority incidents are assigned to their group"
```

**Expected Output:**
```
Analyzing request: create email notification for incident managers when high priority incidents are assigned to their group

Suggested Operations:
  1. create_notification (High confidence)
     Description: Create automated email/SMS notifications
     Complexity: Low-Medium

Analysis complete!
Confidence: high
Suggestion: Use 'create_notification' operation
Recommended trigger: Record update on incident table
```

**What Happened:**
- AI detected keywords: "email notification", "alert", "assigned"
- Matched to `create_notification` operation with high confidence
- Identified trigger: assignment group change on incidents
- Determined complexity level: Low-Medium

---

## Step 2: Get Operation Guidance

**Command:**
```bash
node sn-ai-operations-cli.js guidance create_notification
```

**Expected Output:**
```
Operation Guidance: create_notification

Template Structure:
  Table: sysevent_email_action
  Required Fields:
    - name: Notification name
    - table: Target table (e.g., incident, change_request)
    - event: Trigger event name
    - subject: Email subject line
    - message: Email body (HTML supported)
    - active: Enable/disable notification

  Optional Fields:
    - condition: When to send (GlideQuery format)
    - recipient_type: Type of recipients (user, group, email)
    - recipient_fields: Fields containing recipient references
    - cc: Carbon copy recipients
    - from: Sender email address
    - order: Processing order (default: 100)

Variable Substitution:
  - ${field_name}: Insert field value
  - ${URI_REF}: Link to record
  - ${mail_script:script_name}: Run mail script for dynamic content

Available Tools:
  - tableExists(table): Verify table exists
  - getTableSchema(table): Get field information for variables
  - validatePlan(operation, plan): Validate before execution

Best Practices:
  - Use clear, actionable subject lines
  - Include ${URI_REF} for direct record access
  - Test with different recipient configurations
  - Keep email body concise and scannable
```

**What Happened:**
- Retrieved template structure for notifications
- Listed email-specific fields and variable substitution
- Provided best practices for email content
- Showed validation tools available

---

## Step 3: Build the Operation Plan

**Create input file: `notification-high-priority-incident.json`**
```json
{
  "name": "High Priority Incident Assigned - Manager Alert",
  "table": "incident",
  "event": "incident.assigned",
  "active": true,
  "order": 100,
  "collection": "incident",
  "condition": "priority=1^assignment_groupISNOTEMPTY",
  "subject": "High Priority Incident Assigned: ${number}",
  "message": "<html>\n<body style=\"font-family: Arial, sans-serif; color: #333;\">\n  <h2 style=\"color: #d9534f;\">⚠️ High Priority Incident Assigned</h2>\n  \n  <p>A high-priority incident has been assigned to your group and requires immediate attention.</p>\n  \n  <table style=\"border-collapse: collapse; width: 100%; margin: 20px 0;\">\n    <tr>\n      <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Incident Number:</td>\n      <td style=\"padding: 8px; border: 1px solid #ddd;\">${number}</td>\n    </tr>\n    <tr>\n      <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Short Description:</td>\n      <td style=\"padding: 8px; border: 1px solid #ddd;\">${short_description}</td>\n    </tr>\n    <tr>\n      <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Priority:</td>\n      <td style=\"padding: 8px; border: 1px solid #ddd; color: #d9534f; font-weight: bold;\">${priority}</td>\n    </tr>\n    <tr>\n      <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Assignment Group:</td>\n      <td style=\"padding: 8px; border: 1px solid #ddd;\">${assignment_group.name}</td>\n    </tr>\n    <tr>\n      <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Opened By:</td>\n      <td style=\"padding: 8px; border: 1px solid #ddd;\">${opened_by.name}</td>\n    </tr>\n    <tr>\n      <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Opened:</td>\n      <td style=\"padding: 8px; border: 1px solid #ddd;\">${opened_at}</td>\n    </tr>\n  </table>\n  \n  <p style=\"margin: 20px 0;\">\n    <a href=\"${URI_REF}\" style=\"display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;\">View Incident Details</a>\n  </p>\n  \n  <p style=\"color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px;\">\n    This is an automated notification from ServiceNow. Please do not reply to this email.\n  </p>\n</body>\n</html>",
  "recipient_type": "group_manager",
  "recipient_fields": "assignment_group",
  "send_self": false,
  "description": "Notifies incident managers when high-priority incidents are assigned to their groups"
}
```

**Command:**
```bash
node sn-ai-operations-cli.js plan create_notification --input notification-high-priority-incident.json
```

**Expected Output:**
```
Building operation plan...

Operation Plan: create_notification
Table: sysevent_email_action

Plan Details:
  - Name: High Priority Incident Assigned - Manager Alert
  - Target Table: incident
  - Event: incident.assigned
  - Condition: priority=1^assignment_groupISNOTEMPTY (high priority + assigned)
  - Recipients: Group managers of assignment_group
  - Active: true

Email Content Analysis:
  - Subject: Dynamic with ${number} variable
  - Format: HTML email with styling
  - Variables Used: 6 field variables, 1 URI link
  - Includes: Direct link to record (${URI_REF})

CRUD Analysis:
  Operations Detected:
    ✓ READ: Accessing incident fields (number, priority, assignment_group, etc.)
    ✓ No WRITE operations (read-only notification)

  Recommendations:
    ✓ Uses table variables for dynamic content
    ✓ Includes ${URI_REF} for direct access
    ✓ HTML formatting for professional appearance
    ℹ Consider: Add escalation contact information

Plan ready for validation!
```

**What Happened:**
- Operation plan built with email template
- CRUD auto-detection analyzed variable usage
- Confirmed read-only pattern (notifications don't modify data)
- Validated HTML email structure
- Identified recipient configuration

---

## Step 4: Validate the Plan

**Command:**
```bash
node sn-ai-operations-cli.js validate create_notification --input notification-high-priority-incident.json
```

**Expected Output:**
```
Validating operation plan...

Schema Validation: ✓ PASS
  ✓ Table 'incident' exists
  ✓ Event 'incident.assigned' is valid
  ✓ All required fields present
  ✓ Field variables reference valid fields:
    - number ✓
    - short_description ✓
    - priority ✓
    - assignment_group ✓
    - opened_by ✓
    - opened_at ✓

Email Template Validation: ✓ PASS
  ✓ Subject line contains dynamic content
  ✓ HTML structure is valid
  ✓ ${URI_REF} link included
  ✓ Unsubscribe/disclaimer text present
  ✓ Email is mobile-responsive

Recipient Validation: ✓ PASS
  ✓ Recipient type 'group_manager' is valid
  ✓ Recipient field 'assignment_group' exists
  ✓ Send self disabled (prevents duplicate emails)

Best Practices: ⚠ WARNINGS
  ⚠ Recommendation: Add SLA urgency indicator
  ⚠ Recommendation: Include recent work notes (if any)
  ⚠ Recommendation: Add reply-to address for questions

Overall: VALID - Ready for deployment
Warnings: 3 (recommendations, not blockers)
```

**What Happened:**
- Schema validation confirmed table, event, and fields exist
- Email template validated for HTML structure and variables
- Recipient configuration verified
- Provided recommendations for enhanced notifications

---

## Step 5: Refine (Optional)

Based on validation recommendations, let's enhance the notification:

**Create refined file: `notification-high-priority-incident-refined.json`**
```json
{
  "name": "High Priority Incident Assigned - Manager Alert",
  "table": "incident",
  "event": "incident.assigned",
  "active": true,
  "order": 100,
  "collection": "incident",
  "condition": "priority=1^assignment_groupISNOTEMPTY",
  "subject": "[URGENT] High Priority Incident Assigned: ${number}",
  "message": "<html>\n<body style=\"font-family: Arial, sans-serif; color: #333;\">\n  <div style=\"background-color: #d9534f; color: white; padding: 15px; border-radius: 4px 4px 0 0;\">\n    <h2 style=\"margin: 0;\">⚠️ HIGH PRIORITY INCIDENT - IMMEDIATE ACTION REQUIRED</h2>\n  </div>\n  \n  <div style=\"padding: 20px; border: 1px solid #ddd; border-top: none;\">\n    <p>A high-priority incident has been assigned to your group and requires immediate attention.</p>\n    \n    <table style=\"border-collapse: collapse; width: 100%; margin: 20px 0;\">\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5; width: 35%;\">Incident Number:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd;\">${number}</td>\n      </tr>\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Short Description:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd;\">${short_description}</td>\n      </tr>\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Priority:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd; color: #d9534f; font-weight: bold;\">1 - Critical</td>\n      </tr>\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Urgency:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd;\">${urgency}</td>\n      </tr>\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Impact:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd;\">${impact}</td>\n      </tr>\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Assignment Group:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd;\">${assignment_group.name}</td>\n      </tr>\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Opened By:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd;\">${opened_by.name} (${opened_by.email})</td>\n      </tr>\n      <tr>\n        <td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;\">Opened:</td>\n        <td style=\"padding: 8px; border: 1px solid #ddd;\">${opened_at}</td>\n      </tr>\n    </table>\n    \n    <div style=\"background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;\">\n      <strong>⏰ SLA Information:</strong><br>\n      Response time SLA begins upon assignment. Please review and respond immediately.\n    </div>\n    \n    <p style=\"margin: 20px 0;\">\n      <a href=\"${URI_REF}\" style=\"display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;\">📋 View Incident Now</a>\n    </p>\n    \n    <p style=\"color: #666; font-size: 14px; margin-top: 30px;\">\n      <strong>Need assistance?</strong> Contact the Service Desk at servicedesk@company.com or call +1-800-SUPPORT\n    </p>\n  </div>\n  \n  <div style=\"background-color: #f5f5f5; padding: 15px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 4px 4px;\">\n    <p style=\"color: #666; font-size: 12px; margin: 0;\">\n      This is an automated notification from ServiceNow. Do not reply to this email.<br>\n      To manage notification preferences, visit your ServiceNow profile settings.\n    </p>\n  </div>\n</body>\n</html>",
  "recipient_type": "group_manager",
  "recipient_fields": "assignment_group",
  "send_self": false,
  "reply_to": "servicedesk@company.com",
  "description": "Notifies incident managers when high-priority incidents are assigned. Includes urgency, impact, SLA warning, and contact information."
}
```

**Improvements Made:**
- Added [URGENT] tag to subject line for email filtering
- Enhanced visual hierarchy with colored header
- Added urgency and impact fields for full context
- Included SLA warning callout box
- Added contact information for escalation
- Enhanced styling for better mobile viewing
- Added reply-to address for questions

---

## Step 6: Deploy to ServiceNow

**Command:**
```bash
node sn-operations.js create --table sysevent_email_action --input notification-high-priority-incident-refined.json --instance dev
```

**Expected Output:**
```
Creating Notification on dev instance...

✓ Connection established
✓ Validating notification structure...
✓ Creating sysevent_email_action record...
✓ Registering event listener: incident.assigned

Success! Notification created:
  Sys ID: x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4
  Name: High Priority Incident Assigned - Manager Alert
  Event: incident.assigned
  Recipients: Group managers
  Status: Active

Notification is now active and monitoring for high-priority incident assignments.

⚠ IMPORTANT: Test notification delivery before production deployment!
```

**What Happened:**
- Connected to dev instance
- Validated notification structure
- Created sysevent_email_action record
- Registered event listener for incident.assigned
- Notification immediately active (will send on next trigger)

---

## Step 7: Test the Notification

### Test Case 1: Create High Priority Incident with Assignment

**Test Steps:**
1. Log in to ServiceNow dev instance
2. Create a new incident (Incident > Create New)
3. Set the following values:
   - Priority: 1 - Critical
   - Assignment Group: [Select a group, e.g., "Network Support"]
   - Short Description: "Test high priority notification"
4. Save the record

**Expected Result:**
```
✓ Incident created
✓ Event 'incident.assigned' triggered
✓ Notification condition evaluated: priority=1 ✓ assignment_group present ✓
✓ Email sent to group manager

Email Preview:
  To: network.manager@company.com
  Subject: [URGENT] High Priority Incident Assigned: INC0010001
  Body: [HTML email with incident details and link]
```

**Email Received:**
```
From: ServiceNow <noreply@servicenow.com>
To: Network Manager <network.manager@company.com>
Subject: [URGENT] High Priority Incident Assigned: INC0010001
Reply-To: servicedesk@company.com

[HTML formatted email with red header, incident details table, SLA warning, and "View Incident Now" button]
```

### Test Case 2: Update Incident Priority (NOT High)

**Test Steps:**
1. Open existing incident with Priority 2 or lower
2. Assign to a group
3. Save the record

**Expected Result:**
```
✓ Incident updated
✗ Notification condition NOT met (priority ≠ 1)
✗ No email sent

Log: Notification skipped - condition not met: priority=1
```

### Test Case 3: High Priority Incident WITHOUT Assignment Group

**Test Steps:**
1. Create new incident with Priority 1
2. Leave Assignment Group empty
3. Save the record

**Expected Result:**
```
✓ Incident created
✗ Notification condition NOT met (assignment_group is empty)
✗ No email sent

Log: Notification skipped - condition not met: assignment_groupISNOTEMPTY
```

---

## Monitoring

### View Notification History

**Command:**
```bash
# In ServiceNow: System Logs > Emails > Sent
# Filter by: Subject contains "High Priority Incident Assigned"
```

**Expected Output:**
```
Sent Emails (Last 24 Hours):
  ✓ 08:45 AM - INC0010001 - Sent to network.manager@company.com
  ✓ 09:12 AM - INC0010002 - Sent to security.manager@company.com
  ✓ 10:30 AM - INC0010003 - Sent to database.manager@company.com

Total: 3 emails sent
Delivery Rate: 100%
```

### Monitor Performance

**Command:**
```bash
node sn-ai-monitor-cli.js summary
```

**Expected Metrics:**
```
📧 Notification Operations:
  Total Events Processed: 45
  Emails Sent: 12
  Conditions Not Met: 33
  Delivery Success Rate: 100%
  Average Processing Time: 245ms
```

---

## Key Takeaways

### Notification Best Practices
1. **Clear Subject Lines:** Use [URGENT] or [ACTION REQUIRED] tags for priority emails
2. **Visual Hierarchy:** Use colors, headers, and spacing for scannable emails
3. **Direct Links:** Always include ${URI_REF} for quick record access
4. **Mobile Responsive:** Use inline styles and simple layouts
5. **Contact Information:** Provide escalation paths and support contacts

### CRUD Auto-Detection Insights
- **READ Operations:** Notification reads incident fields for email content
- **No WRITE Operations:** Notifications never modify data (correct pattern)
- **Variable Substitution:** ${field_name} syntax for dynamic content

### Email Deliverability
- Use descriptive sender names ("ServiceNow Notifications")
- Include unsubscribe/preference management links
- Add reply-to addresses for user responses
- Test with different email clients (Outlook, Gmail, mobile)

---

## Troubleshooting

### Problem: Notification Not Sending

**Symptoms:**
- Email not received despite condition being met
- No entries in Sent Emails log

**Solutions:**
1. **Check Notification is Active:**
   ```bash
   # Verify active=true in sysevent_email_action record
   ```

2. **Verify Event Trigger:**
   ```
   Correct: incident.assigned (business rule triggers this event)
   Check: System Policy > Events > Event Registry
   ```

3. **Test Condition Logic:**
   ```
   Condition: priority=1^assignment_groupISNOTEMPTY
   Test: Create incident with Priority=1 AND assignment_group set
   ```

4. **Check Email Configuration:**
   ```
   Navigate to: System Mailboxes > Configuration
   Verify: SMTP server configured and accessible
   ```

---

### Problem: HTML Not Rendering

**Symptoms:**
- Email shows raw HTML code
- Formatting not applied

**Solutions:**
1. **Check Content Type:**
   ```json
   "content_type": "text/html"  // Must be HTML, not plain text
   ```

2. **Validate HTML:**
   ```bash
   # Use HTML validator to check structure
   # Ensure all tags are properly closed
   ```

3. **Use Inline Styles:**
   ```html
   <!-- Correct: -->
   <p style="color: red;">Text</p>

   <!-- Incorrect: -->
   <p class="red-text">Text</p>  <!-- CSS classes may not work -->
   ```

---

### Problem: Variables Not Substituting

**Symptoms:**
- Email shows ${field_name} instead of actual value
- Missing data in email content

**Solutions:**
1. **Check Variable Syntax:**
   ```
   Correct: ${number}
   Correct: ${assignment_group.name}  (dot-walking)
   Incorrect: $number (missing braces)
   Incorrect: ${assignmentgroup} (invalid field name)
   ```

2. **Verify Field Exists:**
   ```bash
   node sn-ai-operations-cli.js table incident --fields
   # Confirm field name matches exactly (case-sensitive)
   ```

3. **Handle Empty Values:**
   ```
   For optional fields, add default text:
   ${field_name:default='Not specified'}
   ```

---

## Related Examples

- **[Example 1: Incident Validation Rule](./01-incident-validation-rule.md)** - Business rule validation
- **[Example 4: ACL Field Protection](./04-acl-field-protection.md)** - Security enforcement
- **[Example 6: Scheduled Job for Cleanup](./06-scheduled-cleanup-job.md)** - Automated maintenance

---

## Advanced Notification Patterns

### 1. Escalation Notifications
Send follow-up emails if incident not updated within SLA:
```json
{
  "name": "High Priority Incident - Escalation Reminder",
  "event": "incident.escalation",
  "condition": "priority=1^state!=6^state!=7",
  "subject": "[ESCALATION] Incident ${number} requires immediate attention"
}
```

### 2. Digest Notifications
Group multiple incidents into a single daily summary email:
```json
{
  "name": "Daily High Priority Incident Summary",
  "event": "daily.summary",
  "type": "digest",
  "collection": "incident",
  "condition": "priority=1^opened_atONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()"
}
```

### 3. Conditional Recipients
Send to different recipients based on business logic:
```javascript
// Mail script for dynamic recipients
(function(current, event) {
  var recipients = [];

  if (current.priority == '1') {
    recipients.push('critical.team@company.com');
  }

  if (current.impact == '1') {
    recipients.push('vip.support@company.com');
  }

  return recipients.join(',');
})(current, event);
```

---

## Next Steps

### Create Notification Suite
1. Assignment notifications for all priority levels
2. State change notifications (Resolved, Closed)
3. SLA breach warnings
4. Customer update notifications

### Test Email Delivery
```bash
# Automated notification testing
node test-notification-delivery.js --notification "High Priority Incident Assigned" --test-recipients
```

### Monitor Email Metrics
```bash
# Track delivery rates and user engagement
node sn-ai-monitor-cli.js email-metrics --period 7d
```

---

**Congratulations!** 🎉

You've successfully created a professional, actionable email notification that keeps incident managers informed of critical incidents. This pattern can be applied to any table and event for automated stakeholder communication.

**Time to Complete:** 15-20 minutes
**Difficulty Level:** Beginner-Intermediate
**Production Ready:** Yes (after thorough testing)
