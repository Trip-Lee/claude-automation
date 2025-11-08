# Example 6: Create Scheduled Cleanup Job

## Scenario
Create a scheduled job that runs nightly to automatically close resolved incidents that have been in "Resolved" state for more than 7 days, improving data hygiene and reducing manual workload for incident managers.

## What You'll Learn
- Creating scheduled jobs with cron-like scheduling
- Writing efficient batch processing scripts
- Implementing safety checks and logging
- Performance optimization for large datasets
- CRUD auto-detection for scheduled operations

**Difficulty:** Intermediate-Advanced
**Time:** 25-30 minutes
**Operation Type:** Scheduled Job

---

## Step 1: Analyze the Request

**Command:**
```bash
node sn-ai-operations-cli.js analyze "create a scheduled job that automatically closes resolved incidents after 7 days"
```

**Expected Output:**
```
Analyzing request: create a scheduled job that automatically closes resolved incidents after 7 days

Suggested Operations:
  1. create_scheduled_job (High confidence)
     Description: Create scheduled/automated job for recurring tasks
     Complexity: Medium-High

Analysis complete!
Confidence: high
Suggestion: Use 'create_scheduled_job' operation
Recommended schedule: Daily (nightly execution)
Performance consideration: Batch processing with limits
```

**What Happened:**
- AI detected keywords: "scheduled job", "automatically", "after 7 days"
- Matched to `create_scheduled_job` operation with high confidence
- Identified pattern: Time-based cleanup/maintenance task
- Flagged performance consideration for batch processing
- Determined complexity level: Medium-High

---

## Step 2: Get Operation Guidance

**Command:**
```bash
node sn-ai-operations-cli.js guidance create_scheduled_job
```

**Expected Output:**
```
Operation Guidance: create_scheduled_job

Template Structure:
  Table: sysauto_script
  Required Fields:
    - name: Job name
    - script: JavaScript code to execute
    - run_dayofweek: Days to run (0=Sunday, 1=Monday, etc.)
    - run_period: Run frequency (daily, weekly, monthly, periodically)
    - run_time: Execution time (HH:MM:SS format)
    - active: Enable/disable job

  Optional Fields:
    - run_start: Start date for job
    - run_end: End date for job (optional)
    - conditional: Additional execution conditions
    - run_as: User context for execution

Performance Fields:
    - query_limit: Max records to process per run
    - timeout: Maximum execution time

Available Tools:
  - tableExists(table): Verify table exists
  - getTableSchema(table): Get field information
  - validatePlan(operation, plan): Validate before execution

Best Practices:
  - Use GlideAggregate for counting
  - Implement batch limits (e.g., 500-1000 records)
  - Add comprehensive logging
  - Include error handling
  - Test with small datasets first
  - Schedule during off-peak hours
```

**What Happened:**
- Retrieved template structure for scheduled jobs
- Listed scheduling-specific fields and options
- Emphasized performance considerations for batch jobs
- Provided best practices for reliable execution

---

## Step 3: Build the Operation Plan

**Create input file: `scheduled-job-auto-close-resolved.json`**
```json
{
  "name": "Auto-Close Resolved Incidents (7 Days)",
  "run_period": "daily",
  "run_time": "02:00:00",
  "run_dayofweek": "0123456",
  "active": true,
  "script": "(function() {\n  try {\n    // Configuration\n    var DAYS_BEFORE_CLOSE = 7;\n    var BATCH_LIMIT = 500;\n    var RESOLVED_STATE = '6'; // Resolved state\n    var CLOSED_STATE = '7'; // Closed state\n    \n    // Calculate cutoff date (7 days ago)\n    var cutoffDate = new GlideDateTime();\n    cutoffDate.addDaysLocalTime(-DAYS_BEFORE_CLOSE);\n    \n    gs.info('Starting auto-close job for resolved incidents older than ' + DAYS_BEFORE_CLOSE + ' days');\n    gs.info('Cutoff date: ' + cutoffDate.getDisplayValue());\n    \n    // Count total eligible incidents\n    var countGA = new GlideAggregate('incident');\n    countGA.addQuery('state', RESOLVED_STATE);\n    countGA.addQuery('resolved_at', '<=', cutoffDate);\n    countGA.addAggregate('COUNT');\n    countGA.query();\n    \n    var totalCount = 0;\n    if (countGA.next()) {\n      totalCount = parseInt(countGA.getAggregate('COUNT'));\n    }\n    \n    gs.info('Found ' + totalCount + ' incidents eligible for auto-close');\n    \n    if (totalCount === 0) {\n      gs.info('No incidents to close. Exiting.');\n      return;\n    }\n    \n    // Process incidents in batches\n    var gr = new GlideRecord('incident');\n    gr.addQuery('state', RESOLVED_STATE);\n    gr.addQuery('resolved_at', '<=', cutoffDate);\n    gr.setLimit(BATCH_LIMIT);\n    gr.query();\n    \n    var closedCount = 0;\n    var errorCount = 0;\n    var startTime = new GlideDateTime();\n    \n    while (gr.next()) {\n      try {\n        // Store incident number for logging\n        var incidentNumber = gr.number.toString();\n        \n        // Update incident state to Closed\n        gr.state = CLOSED_STATE;\n        gr.close_code = 'Resolved';\n        gr.close_notes = 'Automatically closed after ' + DAYS_BEFORE_CLOSE + ' days in Resolved state by scheduled job on ' + new GlideDateTime().getDisplayValue();\n        gr.closed_at = new GlideDateTime();\n        gr.closed_by = gs.getUserID(); // System user\n        \n        // Update the record\n        gr.update();\n        \n        closedCount++;\n        \n        // Log every 50 records for progress tracking\n        if (closedCount % 50 === 0) {\n          gs.info('Progress: Closed ' + closedCount + ' incidents so far...');\n        }\n        \n      } catch (ex) {\n        errorCount++;\n        gs.error('Error closing incident ' + incidentNumber + ': ' + ex.message);\n      }\n    }\n    \n    var endTime = new GlideDateTime();\n    var duration = GlideDateTime.subtract(startTime, endTime);\n    \n    // Final summary\n    gs.info('='.repeat(60));\n    gs.info('Auto-Close Job Summary:');\n    gs.info('  Total Eligible: ' + totalCount);\n    gs.info('  Successfully Closed: ' + closedCount);\n    gs.info('  Errors: ' + errorCount);\n    gs.info('  Batch Limit: ' + BATCH_LIMIT);\n    gs.info('  Remaining: ' + Math.max(0, totalCount - closedCount));\n    gs.info('  Execution Time: ' + duration.getDisplayValue());\n    gs.info('='.repeat(60));\n    \n    // Alert if there are more records to process\n    if (totalCount > closedCount) {\n      gs.warn('More incidents remaining. Job will continue on next execution.');\n    }\n    \n    // Alert if errors occurred\n    if (errorCount > 0) {\n      gs.error('Errors occurred during execution. Check system logs for details.');\n    }\n    \n  } catch (ex) {\n    gs.error('Fatal error in auto-close scheduled job: ' + ex.message);\n    gs.error('Stack trace: ' + ex.stack);\n  }\n})();",
  "description": "Automatically closes incidents that have been in Resolved state for 7+ days. Runs daily at 2:00 AM with batch processing and comprehensive logging."
}
```

**Command:**
```bash
node sn-ai-operations-cli.js plan create_scheduled_job --input scheduled-job-auto-close-resolved.json
```

**Expected Output:**
```
Building operation plan...

Operation Plan: create_scheduled_job
Table: sysauto_script

Plan Details:
  - Name: Auto-Close Resolved Incidents (7 Days)
  - Schedule: Daily at 2:00 AM (all days)
  - Batch Limit: 500 records per execution
  - Performance: Includes counting, progress logging, timing
  - Error Handling: Try-catch blocks, error logging
  - Active: true

Script Analysis:
  - Lines: 95
  - Functions: Batch processing with GlideRecord
  - Queries: 2 (count + batch query)
  - Performance: Uses GlideAggregate for counting
  - Logging: Comprehensive (info, warn, error levels)

CRUD Analysis:
  Operations Detected:
    ✓ READ: Querying incidents (state, resolved_at)
    ✓ UPDATE: Modifying incident fields (state, close_code, close_notes, closed_at, closed_by)
    ✓ Batch Processing: 500 records per run
    ✓ No DELETE operations

  Recommendations:
    ✓ Uses batch limits for performance
    ✓ Includes comprehensive logging
    ✓ Has error handling with try-catch
    ✓ Uses GlideAggregate for efficient counting
    ℹ Consider: Add email notification for completion summary
    ℹ Consider: Add dry-run mode for testing

Plan ready for validation!
```

**What Happened:**
- Operation plan built with scheduled job configuration
- CRUD auto-detection analyzed READ and UPDATE operations
- Identified batch processing pattern (500 record limit)
- Validated performance optimizations (GlideAggregate)
- Confirmed error handling and logging

---

## Step 4: Validate the Plan

**Command:**
```bash
node sn-ai-operations-cli.js validate create_scheduled_job --input scheduled-job-auto-close-resolved.json
```

**Expected Output:**
```
Validating operation plan...

Schema Validation: ✓ PASS
  ✓ Table 'incident' exists
  ✓ Fields used are valid:
    - state ✓
    - resolved_at ✓
    - close_code ✓
    - close_notes ✓
    - closed_at ✓
    - closed_by ✓
  ✓ Schedule format valid (daily, 02:00:00)

Script Validation: ✓ PASS
  ✓ No syntax errors detected
  ✓ Uses GlideRecord properly
  ✓ Uses GlideAggregate for counting (efficient)
  ✓ Implements batch limits (500)
  ✓ Has error handling (try-catch)
  ✓ Includes comprehensive logging

Performance Validation: ✓ PASS
  ✓ Batch limit prevents timeouts (500 records)
  ✓ Uses setLimit() for query optimization
  ✓ Counting with GlideAggregate (not GlideRecord)
  ✓ Progress logging every 50 records
  ✓ Tracks execution time

Safety Validation: ✓ PASS
  ✓ Only updates records matching criteria
  ✓ Includes close notes with audit trail
  ✓ Does not delete records
  ✓ Runs during off-peak hours (2:00 AM)
  ✓ Error handling prevents cascade failures

Best Practices: ⚠ WARNINGS
  ⚠ Recommendation: Add email notification to admins on completion
  ⚠ Recommendation: Add dry-run mode for testing
  ⚠ Recommendation: Consider adding skip_weekends option

Overall: VALID - Ready for deployment
Warnings: 3 (recommendations, not blockers)
```

**What Happened:**
- Schema validation confirmed table and fields exist
- Script validation checked syntax and API usage
- Performance validation verified batch processing and optimization
- Safety validation confirmed audit trail and error handling
- Provided recommendations for enhanced operation

---

## Step 5: Refine (Optional)

Based on validation recommendations, let's add email notification and dry-run mode:

**Create refined file: `scheduled-job-auto-close-resolved-refined.json`**

Add to the beginning of script (after configuration section):
```javascript
// Additional configuration
var DRY_RUN = false; // Set to true for testing without updates
var SEND_EMAIL_SUMMARY = true;
var ADMIN_EMAIL = 'incident.admins@company.com';
```

Add before the final summary section:
```javascript
// Send email summary if enabled
if (SEND_EMAIL_SUMMARY) {
  var email = new GlideEmailOutbound();
  email.setSubject('[ServiceNow] Auto-Close Job Summary - ' + new GlideDateTime().getDisplayValue());
  email.setFrom('noreply@servicenow.com');
  email.setRecipients(ADMIN_EMAIL);

  var emailBody = '<html><body>';
  emailBody += '<h2>Auto-Close Resolved Incidents - Job Summary</h2>';
  emailBody += '<table border="1" cellpadding="8" style="border-collapse: collapse;">';
  emailBody += '<tr><td><strong>Execution Date:</strong></td><td>' + new GlideDateTime().getDisplayValue() + '</td></tr>';
  emailBody += '<tr><td><strong>Total Eligible:</strong></td><td>' + totalCount + '</td></tr>';
  emailBody += '<tr><td><strong>Successfully Closed:</strong></td><td>' + closedCount + '</td></tr>';
  emailBody += '<tr><td><strong>Errors:</strong></td><td>' + errorCount + '</td></tr>';
  emailBody += '<tr><td><strong>Remaining:</strong></td><td>' + Math.max(0, totalCount - closedCount) + '</td></tr>';
  emailBody += '<tr><td><strong>Execution Time:</strong></td><td>' + duration.getDisplayValue() + '</td></tr>';
  emailBody += '<tr><td><strong>Mode:</strong></td><td>' + (DRY_RUN ? 'DRY RUN (No changes)' : 'LIVE') + '</td></tr>';
  emailBody += '</table>';
  emailBody += '</body></html>';

  email.setBody(emailBody);
  email.send();

  gs.info('Email summary sent to ' + ADMIN_EMAIL);
}
```

Modify the update section for dry-run mode:
```javascript
if (DRY_RUN) {
  gs.info('[DRY RUN] Would close incident: ' + incidentNumber);
  closedCount++; // Count for reporting
} else {
  // Actual update code here
  gr.state = CLOSED_STATE;
  // ... rest of update code
  gr.update();
  closedCount++;
}
```

**Improvements Made:**
- Added DRY_RUN mode for safe testing
- Added email summary notification to admins
- Enhanced logging with dry-run indicators
- Email includes HTML table with job metrics
- Maintains all existing safety and performance features

---

## Step 6: Deploy to ServiceNow

**Command:**
```bash
node sn-operations.js create --table sysauto_script --input scheduled-job-auto-close-resolved-refined.json --instance dev
```

**Expected Output:**
```
Creating Scheduled Job on dev instance...

✓ Connection established
✓ Validating scheduled job structure...
✓ Creating sysauto_script record...
✓ Configuring schedule: Daily at 02:00:00
✓ Setting batch limit: 500 records

Success! Scheduled Job created:
  Sys ID: q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6
  Name: Auto-Close Resolved Incidents (7 Days)
  Schedule: Daily at 2:00 AM
  Status: Active
  Next Run: Tomorrow at 02:00:00

Scheduled Job is now active and will execute at next scheduled time.

⚠ IMPORTANT:
  1. Test with DRY_RUN=true first!
  2. Monitor system logs during first execution
  3. Review email summaries for any issues
  4. Adjust BATCH_LIMIT if execution times out
```

**What Happened:**
- Connected to dev instance
- Validated scheduled job structure and schedule
- Created sysauto_script record
- Job scheduled to run daily at 2:00 AM
- Scheduled job immediately active (will execute on next trigger)

---

## Step 7: Test the Scheduled Job

### Test Case 1: Manual Execution (Dry Run)

**Test Steps:**
1. Navigate to: System Definition > Scheduled Jobs
2. Find "Auto-Close Resolved Incidents (7 Days)"
3. Set DRY_RUN = true in script
4. Click "Execute Now"

**Expected Result:**
```
✓ Job started
⏱ Execution time: ~5-30 seconds (depending on data volume)

System Logs (System Logs > System Log > All):
*** Script: Starting auto-close job for resolved incidents older than 7 days
*** Script: Cutoff date: 2024-01-08 02:00:00
*** Script: Found 87 incidents eligible for auto-close
*** Script: Progress: Closed 50 incidents so far...
*** Script: [DRY RUN] Would close incident: INC0010001
*** Script: [DRY RUN] Would close incident: INC0010002
... (repeated for each incident)
*** Script: ============================================================
*** Script: Auto-Close Job Summary:
*** Script:   Total Eligible: 87
*** Script:   Successfully Closed: 87 (DRY RUN - no actual changes)
*** Script:   Errors: 0
*** Script:   Batch Limit: 500
*** Script:   Remaining: 0
*** Script:   Execution Time: 00:00:08
*** Script: ============================================================
*** Script: Email summary sent to incident.admins@company.com

✓ No incidents actually modified (DRY RUN mode)
✓ Email summary received with job metrics
```

### Test Case 2: Live Execution (Small Dataset)

**Test Steps:**
1. Set DRY_RUN = false
2. Create 5-10 test incidents in Resolved state with resolved_at date > 7 days ago
3. Execute job manually
4. Verify incidents closed correctly

**Expected Result:**
```
✓ Job executed successfully

Before:
  INC0010001: State = 6 (Resolved), Resolved: 2024-01-01
  INC0010002: State = 6 (Resolved), Resolved: 2024-01-02
  ... (5 more)

After:
  INC0010001: State = 7 (Closed), Closed: 2024-01-15 02:00:00
    Close Code: Resolved
    Close Notes: "Automatically closed after 7 days in Resolved state by scheduled job on 2024-01-15 02:00:00"
  INC0010002: State = 7 (Closed), Closed: 2024-01-15 02:00:00
    Close Code: Resolved
    Close Notes: "Automatically closed after 7 days..."
  ... (5 more)

System Logs:
*** Script: Auto-Close Job Summary:
*** Script:   Total Eligible: 7
*** Script:   Successfully Closed: 7
*** Script:   Errors: 0

✓ All eligible incidents closed
✓ Close notes added with audit trail
✓ Email summary received
```

### Test Case 3: Batch Processing (Large Dataset)

**Test Steps:**
1. Create 600 test resolved incidents (exceeds BATCH_LIMIT of 500)
2. Execute job manually
3. Verify only 500 closed on first run
4. Execute again to close remaining 100

**Expected Result:**
```
First Execution:
*** Script: Found 600 incidents eligible for auto-close
*** Script: Progress: Closed 50 incidents so far...
*** Script: Progress: Closed 100 incidents so far...
...
*** Script: Progress: Closed 500 incidents so far...
*** Script:   Successfully Closed: 500
*** Script:   Remaining: 100
⚠ Script: More incidents remaining. Job will continue on next execution.

Second Execution:
*** Script: Found 100 incidents eligible for auto-close
*** Script:   Successfully Closed: 100
*** Script:   Remaining: 0

✓ Batch processing working correctly
✓ Job processes maximum 500 per run (prevents timeout)
✓ Multiple executions handled safely
```

---

## Monitoring

### View Scheduled Job History

**Command:**
```bash
# In ServiceNow: System Scheduler > Scheduled Jobs > Scheduled Job History
# Filter: Name = "Auto-Close Resolved Incidents (7 Days)"
```

**Expected Output:**
```
Execution History (Last 7 Days):
  ✓ 2024-01-15 02:00:00 - Completed - 87 closed, 0 errors - Duration: 8.2s
  ✓ 2024-01-14 02:00:00 - Completed - 45 closed, 0 errors - Duration: 5.1s
  ✓ 2024-01-13 02:00:00 - Completed - 0 closed, 0 errors - Duration: 0.3s
  ✓ 2024-01-12 02:00:00 - Completed - 123 closed, 0 errors - Duration: 12.7s
  ✓ 2024-01-11 02:00:00 - Completed - 67 closed, 0 errors - Duration: 7.4s

Average: 64 incidents/day
Success Rate: 100%
Average Duration: 6.7 seconds
```

### Monitor Performance

**Command:**
```bash
node sn-ai-monitor-cli.js summary
```

**Expected Metrics:**
```
⏰ Scheduled Job Operations:
  Total Executions: 30 (last 30 days)
  Success Rate: 100%
  Total Records Processed: 1,847
  Average per Execution: 61 records
  Average Duration: 6.8 seconds
  Peak Duration: 15.2 seconds
  Errors: 0
```

---

## Key Takeaways

### Scheduled Job Best Practices
1. **Batch Processing:** Always use setLimit() to prevent timeouts
2. **Off-Peak Scheduling:** Run intensive jobs during low-usage hours (2:00-4:00 AM)
3. **Comprehensive Logging:** Log start, progress, summary, and errors
4. **Error Handling:** Wrap in try-catch to prevent cascade failures
5. **Email Summaries:** Alert admins of job completion and any issues
6. **Dry-Run Mode:** Test without making actual changes first

### CRUD Auto-Detection Insights
- **READ Operations:** Querying for eligible incidents
- **UPDATE Operations:** Modifying state, close_code, close_notes, dates
- **Batch Pattern:** Processing records in chunks (500 at a time)
- **No DELETE:** Closing records, not deleting (data retention)

### Performance Optimization
- **GlideAggregate for Counting:** Much faster than counting with GlideRecord
- **Batch Limits:** Prevents query timeouts and system impact
- **Progress Logging:** Track execution without excessive log entries
- **Query Optimization:** Use indexed fields (state, resolved_at)

---

## Troubleshooting

### Problem: Job Times Out

**Symptoms:**
- Job execution exceeds maximum time limit
- Incomplete processing (some records not updated)
- Error logs show timeout messages

**Solutions:**
1. **Reduce Batch Limit:**
   ```javascript
   var BATCH_LIMIT = 250; // Reduce from 500
   ```

2. **Optimize Queries:**
   ```javascript
   // Add indexed query first
   gr.addQuery('state', RESOLVED_STATE); // Indexed field
   gr.addQuery('resolved_at', '<=', cutoffDate);
   ```

3. **Remove Unnecessary Operations:**
   ```javascript
   // Minimize field updates
   gr.setValue('state', CLOSED_STATE);
   gr.setValue('close_notes', 'Auto-closed');
   gr.update(); // Don't query additional data
   ```

---

### Problem: Email Summaries Not Sending

**Symptoms:**
- Job executes successfully but no email received
- No email entries in System Mailboxes > Sent

**Solutions:**
1. **Check SMTP Configuration:**
   ```
   Navigate to: System Mailboxes > Properties
   Verify: SMTP server configured and active
   ```

2. **Verify Email Address:**
   ```javascript
   var ADMIN_EMAIL = 'valid.email@company.com'; // Must be valid
   ```

3. **Check Email Logs:**
   ```
   Navigate to: System Logs > Emails > Sent
   Look for: Failed delivery or bounce messages
   ```

---

### Problem: Job Closing Wrong Incidents

**Symptoms:**
- Incidents closed that shouldn't be
- Recently resolved incidents being closed

**Solutions:**
1. **Verify Date Logic:**
   ```javascript
   // Ensure addDaysLocalTime uses negative value
   cutoffDate.addDaysLocalTime(-7); // MUST be negative

   // Verify query logic
   gr.addQuery('resolved_at', '<=', cutoffDate); // <=  not >=
   ```

2. **Check System Time Zone:**
   ```
   Navigate to: System Properties > System
   Verify: Time zone matches expected behavior
   ```

3. **Add Safety Check:**
   ```javascript
   // Calculate days in resolved state
   var daysSinceResolved = GlideDateTime.subtract(gr.resolved_at, new GlideDateTime()).getDayPart();

   if (daysSinceResolved >= DAYS_BEFORE_CLOSE) {
     // Safe to close
   }
   ```

---

## Related Examples

- **[Example 1: Incident Validation Rule](./01-incident-validation-rule.md)** - Business rule validation
- **[Example 4: ACL Field Protection](./04-acl-field-protection.md)** - Security enforcement
- **[Example 5: Email Notification Setup](./05-email-notification.md)** - Automated notifications

---

## Advanced Scheduled Job Patterns

### 1. Multi-Table Cleanup
Process multiple tables in single job:
```javascript
var tables = ['incident', 'problem', 'change_request'];
tables.forEach(function(table) {
  processTable(table);
});
```

### 2. Conditional Execution
Skip execution based on business logic:
```javascript
// Don't run on holidays
var today = new GlideDateTime();
if (isHoliday(today)) {
  gs.info('Skipping execution - today is a holiday');
  return;
}
```

### 3. Progressive Batch Sizes
Adjust batch size based on system load:
```javascript
var currentHour = new GlideDateTime().getHourLocalTime();
var batchLimit = (currentHour >= 2 && currentHour <= 5) ? 1000 : 250;
```

### 4. Data Export Jobs
Export data to external systems:
```javascript
var incidents = [];
while (gr.next()) {
  incidents.push({
    number: gr.number.toString(),
    state: gr.state.toString(),
    priority: gr.priority.toString()
  });
}

// Send to external API
var restMessage = new sn_ws.RESTMessageV2();
restMessage.setEndpoint('https://external-system.com/api/incidents');
restMessage.setRequestBody(JSON.stringify(incidents));
var response = restMessage.execute();
```

---

## Next Steps

### Create Job Suite
1. Auto-resolve stale incidents (inactive > 30 days)
2. Archive old closed records
3. Clean up orphaned attachments
4. Generate weekly reports
5. Sync data with external systems

### Automated Testing
```bash
# Test scheduled jobs automatically
node test-scheduled-job.js --job "Auto-Close Resolved Incidents" --dry-run
```

### Monitor Job Performance
```bash
# Track execution metrics over time
node sn-ai-monitor-cli.js scheduled-jobs --period 30d
```

---

**Congratulations!** 🎉

You've successfully created a robust, production-ready scheduled job that automates incident cleanup with comprehensive logging, batch processing, error handling, and email notifications. This pattern can be applied to any recurring maintenance or automation task.

**Time to Complete:** 25-30 minutes
**Difficulty Level:** Intermediate-Advanced
**Production Ready:** Yes (after thorough testing with dry-run mode)
