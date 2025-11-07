# Example 4: Create ACL Field Protection

## Scenario
Create an Access Control List (ACL) that protects the "Assigned to" field on incidents, allowing only members of the "Incident Managers" group to modify assignments, preventing unauthorized reassignment.

## What You'll Learn
- Creating field-level Access Control Lists (ACLs)
- Security best practices for field protection
- Role and group-based access control
- Testing ACL effectiveness
- CRUD auto-detection for security operations

**Difficulty:** Intermediate
**Time:** 20-25 minutes
**Operation Type:** Access Control List (ACL)

---

## Step 1: Analyze the Request

**Command:**
```bash
node sn-ai-operations-cli.js analyze "create an ACL that protects the assigned_to field on incidents, only incident managers can modify it"
```

**Expected Output:**
```
Analyzing request: create an ACL that protects the assigned_to field on incidents, only incident managers can modify it

Suggested Operations:
  1. create_acl (High confidence)
     Description: Create a new Access Control List for security enforcement
     Complexity: Medium

Analysis complete!
Confidence: high
Suggestion: Use 'create_acl' operation
```

**What Happened:**
- AI detected keywords: "ACL", "protects", "field"
- Matched to `create_acl` operation with high confidence
- Identified field-level protection requirement
- Determined complexity level: Medium

---

## Step 2: Get Operation Guidance

**Command:**
```bash
node sn-ai-operations-cli.js guidance create_acl
```

**Expected Output:**
```
Operation Guidance: create_acl

Template Structure:
  Table: sys_security_acl
  Required Fields:
    - name: ACL name (table.field.operation format)
    - type: ACL type (record, record.field, or None)
    - operation: Operation to control (read, write, create, delete)
    - admin_overrides: Whether admin role bypasses this ACL
    - active: Enable/disable the ACL

  Optional Fields:
    - condition: Script condition for complex logic
    - roles: Comma-separated role names required
    - script: Advanced script for custom logic
    - description: Purpose and usage notes

Available Tools:
  - tableExists(table): Verify table exists
  - getTableSchema(table): Get table field information
  - validatePlan(operation, plan): Validate before execution

Best Practices:
  - Use field-level ACLs for granular control
  - Always test with different user roles
  - Document security requirements
  - Set admin_overrides=false for critical fields
```

**What Happened:**
- Retrieved template structure for ACLs
- Listed security-specific fields and their purposes
- Provided best practices for access control
- Showed validation tools available

---

## Step 3: Build the Operation Plan

**Create input file: `acl-assigned-to-protection.json`**
```json
{
  "name": "incident.assigned_to.write",
  "type": "record.field",
  "operation": "write",
  "table": "incident",
  "field": "assigned_to",
  "admin_overrides": false,
  "active": true,
  "description": "Protect assigned_to field - only Incident Managers can reassign",
  "script": "(function() {\n  // Check if user has incident_manager role\n  if (gs.hasRole('incident_manager')) {\n    return true; // Allow access\n  }\n  \n  // Check if user is current assignee (allow self-assignment)\n  if (current.assigned_to == gs.getUserID()) {\n    return true;\n  }\n  \n  // Deny all other access\n  return false;\n})();"
}
```

**Command:**
```bash
node sn-ai-operations-cli.js plan create_acl --input acl-assigned-to-protection.json
```

**Expected Output:**
```
Building operation plan...

Operation Plan: create_acl
Table: sys_security_acl

Plan Details:
  - Type: Field-level ACL (record.field)
  - Target Table: incident
  - Target Field: assigned_to
  - Operation: write
  - Admin Override: false (admins must also comply)
  - Active: true

CRUD Analysis:
  Operations Detected:
    ✓ READ: Accessing current.assigned_to, gs.getUserID()
    ✓ No WRITE operations (read-only ACL script)

  Recommendations:
    ✓ ACL script is read-only (correct pattern)
    ✓ Uses role-based access control
    ✓ Includes self-assignment exception
    ⚠ Consider: Add audit logging for denied access

Plan ready for validation!
```

**What Happened:**
- Operation plan built with field-level protection
- CRUD auto-detection analyzed the ACL script
- Confirmed read-only pattern (ACLs should not modify data)
- Provided security recommendations

---

## Step 4: Validate the Plan

**Command:**
```bash
node sn-ai-operations-cli.js validate create_acl --input acl-assigned-to-protection.json
```

**Expected Output:**
```
Validating operation plan...

Schema Validation: ✓ PASS
  ✓ Table 'incident' exists
  ✓ Field 'assigned_to' exists on incident table
  ✓ Field type is 'reference' (appropriate for assignment)
  ✓ All required fields present

Security Validation: ✓ PASS
  ✓ ACL name follows convention: table.field.operation
  ✓ Type 'record.field' matches field-level protection
  ✓ Admin overrides disabled (secure setting)
  ✓ Script uses gs.hasRole() for proper role checking

Script Validation: ✓ PASS
  ✓ Script returns boolean value
  ✓ No data modification operations detected
  ✓ Uses approved security APIs
  ✓ Includes proper exception handling

Best Practices: ⚠ WARNINGS
  ⚠ Recommendation: Add gs.log() for audit trail
  ⚠ Recommendation: Consider adding ui_policy for user feedback
  ⚠ Recommendation: Document incident_manager role requirement

Overall: VALID - Ready for deployment
Warnings: 3 (recommendations, not blockers)
```

**What Happened:**
- Schema validation confirmed table and field exist
- Security validation checked ACL naming and structure
- Script validation ensured read-only, safe operations
- Provided recommendations for enhanced security and usability

---

## Step 5: Refine (Optional)

Based on validation recommendations, let's add audit logging:

**Create refined file: `acl-assigned-to-protection-refined.json`**
```json
{
  "name": "incident.assigned_to.write",
  "type": "record.field",
  "operation": "write",
  "table": "incident",
  "field": "assigned_to",
  "admin_overrides": false,
  "active": true,
  "description": "Protect assigned_to field - only Incident Managers can reassign. Includes audit logging.",
  "script": "(function() {\n  // Check if user has incident_manager role\n  if (gs.hasRole('incident_manager')) {\n    gs.log('ACL: User ' + gs.getUserName() + ' granted write access to incident.assigned_to (incident_manager role)', 'ACL Audit');\n    return true;\n  }\n  \n  // Check if user is current assignee (allow self-assignment)\n  if (current.assigned_to == gs.getUserID()) {\n    gs.log('ACL: User ' + gs.getUserName() + ' granted write access to incident.assigned_to (current assignee)', 'ACL Audit');\n    return true;\n  }\n  \n  // Deny all other access\n  gs.log('ACL: User ' + gs.getUserName() + ' DENIED write access to incident.assigned_to', 'ACL Audit');\n  return false;\n})();"
}
```

**Improvements Made:**
- Added audit logging for all access decisions (granted/denied)
- Logs include username and reason for decision
- Uses 'ACL Audit' log source for easy filtering
- Maintains read-only pattern (no data modification)

---

## Step 6: Deploy to ServiceNow

**Command:**
```bash
node sn-operations.js create --table sys_security_acl --input acl-assigned-to-protection-refined.json --instance dev
```

**Expected Output:**
```
Creating ACL on dev instance...

✓ Connection established
✓ Validating ACL structure...
✓ Creating sys_security_acl record...

Success! ACL created:
  Sys ID: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
  Name: incident.assigned_to.write
  Target: incident.assigned_to
  Operation: write
  Status: Active

ACL is now protecting the assigned_to field on incidents.

⚠ IMPORTANT: Test ACL with different user roles before production deployment!
```

**What Happened:**
- Connected to dev instance
- Validated ACL structure
- Created sys_security_acl record
- ACL immediately active (security enforcement begins)

---

## Step 7: Test the ACL

### Test Case 1: User WITHOUT incident_manager Role

**Test Steps:**
1. Log in as a user without incident_manager role (e.g., itil user)
2. Open an existing incident
3. Try to change the "Assigned to" field
4. Attempt to save

**Expected Result:**
```
❌ Access Denied
Field 'Assigned to' cannot be modified.
You do not have permission to change this field.
```

**Log Output:**
```
*** Script: ACL: User john.doe DENIED write access to incident.assigned_to
```

### Test Case 2: User WITH incident_manager Role

**Test Steps:**
1. Log in as a user with incident_manager role
2. Open an existing incident
3. Change the "Assigned to" field
4. Save the record

**Expected Result:**
```
✓ Success
Incident updated successfully.
Assigned to field changed.
```

**Log Output:**
```
*** Script: ACL: User jane.manager granted write access to incident.assigned_to (incident_manager role)
```

### Test Case 3: Current Assignee (Self-Assignment)

**Test Steps:**
1. Log in as the currently assigned user (without incident_manager role)
2. Open an incident assigned to you
3. Change the "Assigned to" field to another user
4. Save the record

**Expected Result:**
```
✓ Success
Incident updated successfully.
You can modify assignments for incidents assigned to you.
```

**Log Output:**
```
*** Script: ACL: User current.assignee granted write access to incident.assigned_to (current assignee)
```

### Test Case 4: Admin Role (Should Also be Denied)

**Test Steps:**
1. Log in as admin user
2. Open an existing incident
3. Try to change the "Assigned to" field (without incident_manager role)
4. Attempt to save

**Expected Result:**
```
❌ Access Denied
Field 'Assigned to' cannot be modified.
You do not have permission to change this field.
(admin_overrides=false applies to all users including admins)
```

---

## Monitoring

### View ACL Audit Logs

**Command:**
```bash
# View system logs for ACL decisions
# In ServiceNow: System Logs > System Log > All
# Filter: Source = "ACL Audit"
```

**Monitor Performance:**
```bash
node sn-ai-monitor-cli.js summary
```

**Expected Metrics:**
```
📊 ACL Operations:
  Total ACL Checks: 245
  Access Granted: 198
  Access Denied: 47
  Performance: avg 12ms per check
```

---

## Key Takeaways

### Security Best Practices
1. **Field-Level ACLs:** More granular than record-level ACLs
2. **Admin Overrides:** Set to false for critical security fields
3. **Audit Logging:** Track all access decisions for compliance
4. **Role-Based Access:** Use gs.hasRole() for proper authorization
5. **Self-Assignment:** Allow users to modify their own assignments

### CRUD Auto-Detection Insights
- **READ Operations:** ACL script reads current.assigned_to and user info
- **No WRITE Operations:** ACLs should never modify data (correct pattern)
- **Security Pattern:** Validation confirms read-only access control

### Performance Considerations
- ACLs are evaluated on every field access
- Keep ACL scripts lightweight (< 50ms execution time)
- Use role checks instead of complex queries
- Cache expensive operations when possible

---

## Troubleshooting

### Problem: ACL Not Enforcing

**Symptoms:**
- Users can still modify the field despite ACL
- No access denied messages appearing

**Solutions:**
1. **Check ACL is Active:**
   ```bash
   # Verify active=true in sys_security_acl record
   ```

2. **Verify ACL Name Format:**
   ```
   Correct: incident.assigned_to.write
   Incorrect: incident.assigned_to (missing operation)
   ```

3. **Check ACL Order:**
   ```
   ACLs are evaluated in order. More specific ACLs should have lower order numbers.
   Field-level ACLs (order 100-300) are evaluated before record-level ACLs (order 400+)
   ```

4. **Clear ACL Cache:**
   ```
   Navigate to: System Security > Debug Security
   Click "Reload ACL Cache"
   ```

---

### Problem: Admin Users Bypassing ACL

**Symptoms:**
- Admin users can modify field despite admin_overrides=false

**Solutions:**
1. **Verify admin_overrides Setting:**
   ```json
   "admin_overrides": false  // Must be boolean false, not string
   ```

2. **Check ACL Type:**
   ```
   Field-level ACLs: type = "record.field"
   Record-level ACLs: type = "record"
   ```

3. **Review Role Hierarchy:**
   ```
   Admin role contains many other roles.
   Check if admin has incident_manager role indirectly.
   ```

---

### Problem: Self-Assignment Not Working

**Symptoms:**
- Current assignee cannot modify their own assignments

**Solutions:**
1. **Check User ID Comparison:**
   ```javascript
   // Correct:
   if (current.assigned_to == gs.getUserID())

   // Incorrect:
   if (current.assigned_to == gs.getUserName())  // Name vs ID mismatch
   ```

2. **Handle Empty Assignments:**
   ```javascript
   // Add nil check:
   if (current.assigned_to && current.assigned_to == gs.getUserID())
   ```

---

## Related Examples

- **[Example 1: Incident Validation Rule](./01-incident-validation-rule.md)** - Business rule validation
- **[Example 5: Email Notification Setup](./05-email-notification.md)** - Automated notifications
- **[Example 6: Scheduled Job for Cleanup](./06-scheduled-cleanup-job.md)** - Automated maintenance

---

## Additional Security Considerations

### 1. Data Policies vs ACLs
- **ACLs:** Control field visibility and editability (security enforcement)
- **Data Policies:** Validate data quality (business logic enforcement)
- **Use Both:** ACLs for security + Data Policies for validation

### 2. UI Policies for User Feedback
Create a complementary UI Policy to grey out the field for unauthorized users:
```json
{
  "table": "incident",
  "field": "assigned_to",
  "condition": "!gs.hasRole('incident_manager') && current.assigned_to != gs.getUserID()",
  "action": "readonly"
}
```

### 3. Notification for Denied Access
Consider adding a notification when users are denied access:
```javascript
// In ACL script (denied case):
gs.addInfoMessage('You do not have permission to reassign this incident. Contact your Incident Manager.');
return false;
```

---

## Next Steps

### Expand Field Protection
1. Protect other critical fields (state, priority, category)
2. Create role hierarchy for different management levels
3. Implement time-based access restrictions

### Create ACL Test Suite
```bash
# Automated ACL testing
node test-acl-protection.js --table incident --field assigned_to --roles incident_manager,admin
```

### Monitor Security Events
```bash
# Track ACL denials over time
node sn-ai-monitor-cli.js security-events --filter denied
```

---

**Congratulations!** 🎉

You've successfully created a field-level ACL that protects critical incident assignment data. This pattern can be applied to any table and field requiring granular access control.

**Time to Complete:** 20-25 minutes
**Security Level:** High
**Production Ready:** Yes (after thorough testing)
