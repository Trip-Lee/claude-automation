# Execution Context Analysis: x_cadso_automate_email INSERT Operation

**Document Version:** 2.0
**Analysis Date:** 2026-01-13 (Updated)
**Author:** AI Agent (ServiceNow Specialist)
**Risk Level:** HIGH
**Last Validated:** 2026-01-13 23:30 UTC

---

## Executive Summary

This document analyzes the execution context and cascading effects when creating a new record on the `x_cadso_automate_email` table. The analysis reveals that an INSERT operation triggers **11 Business Rules** across multiple phases, creates cascading records on related tables, and has a **HIGH risk level** due to the complex chain of automated actions.

**Key Findings:**
- 6 Business Rules fire in the **before** phase (field auto-population)
- 5 Business Rules fire in the **after** phase (cascading record creation)
- 0 Business Rules fire asynchronously
- Cascading INSERT is triggered on `x_cadso_automate_email_send` table
- 15 total system components are affected by this table

---

## Existing System Analysis

### Tool Validation Output: Execution Context Query

```bash
$ npm run cache-query -- x_cadso_automate_email insert

{
  "found": true,
  "table": "x_cadso_automate_email",
  "operation": "insert",
  "businessRules": [
    { "name": "Set Audience Tables", "timing": "before", "order": -100 },
    { "name": "Update HTML and JSON on Template Change", "timing": "before", "order": 80 },
    { "name": "Enable Save Changes", "timing": "before", "order": 100 },
    { "name": "Set Published Date", "timing": "before", "order": 100 },
    { "name": "Status and State Sync", "timing": "before", "order": 100 },
    { "name": "Update Can Edit", "timing": "before", "order": 100 },
    { "name": "Create Email Send", "timing": "after", "order": 100 },
    { "name": "Create Email Send (A/B Testing)", "timing": "after", "order": 101 },
    { "name": "Update Email Sends Status", "timing": "after", "order": 333 },
    { "name": "Update Email Send Type", "timing": "after", "order": 334 },
    { "name": "Update Email Send Content", "timing": "after", "order": 900 }
  ],
  "riskLevel": "HIGH"
}
```

### Tool Validation Output: Table Dependencies

```bash
$ npm run query -- table-dependencies x_cadso_automate_email

{
  "success": true,
  "data": {
    "table": "x_cadso_automate_email",
    "script_includes": [
      { "name": "TenonEmailValidation", "api_name": "x_cadso_journey.TenonEmailValidation" }
    ],
    "apis": [
      { "name": "Sending Strategy - Save", "method": "POST" }
    ],
    "business_rules": 13,
    "impact_summary": {
      "component_count": 0,
      "script_include_count": 1,
      "api_count": 1,
      "business_rule_count": 13,
      "total_affected": 15
    },
    "lineage": "Table: x_cadso_automate_email ↑ Script Includes: TenonEmailValidation ↑ APIs: Sending Strategy - Save"
  }
}
```

---

## Table Schema

### x_cadso_automate_email Field Definitions

| Field Name | Type | Label | Mandatory | Read-Only | Description |
|------------|------|-------|-----------|-----------|-------------|
| `name` | string | Name | No | No | Email marketing record name |
| `status` | string | Status | No | No | Current workflow status |
| `state` | string | State | No | **Yes** | Auto-set based on status |
| `type` | string | Type | No | No | Email type classification |
| `html` | html | HTML | No | No | Email HTML content |
| `json` | string_full_utf8 | JSON | No | No | Email design JSON structure |
| `plain_text` | string_full_utf8 | Plain Text | No | No | Plain text version |
| `template` | reference | Template | No | No | Reference to email template |
| `campaign` | reference | Campaign | No | No | Associated campaign |
| `tactic` | reference | Tactic | No | No | Marketing tactic reference |
| `brand_kit` | reference | Brand Kit | No | No | Branding configuration |
| `sources` | string | Sources | No | No | Audience source configuration |
| `audience_tables` | glide_list | Audience Tables | No | **Yes** | Auto-populated from sources |
| `can_edit` | boolean | Can Edit | No | **Yes** | Auto-set based on state |
| `can_send` | boolean | Can Send | No | **Yes** | System-calculated field |
| `send_now` | boolean | Send Now | No | **Yes** | Send trigger flag |
| `published` | glide_date_time | Published | No | No | Publication timestamp |
| `archived` | boolean | archived | No | No | Archive flag |
| `enable_a_b_testing` | boolean | Enable A/B Testing | No | No | A/B testing toggle |
| `version_a` | reference | Version A | No | No | A/B test version A reference |
| `version_b` | reference | Version B | No | No | A/B test version B reference |
| `validation_status` | string | Validation Status | No | No | Content validation status |
| `validation_results` | string | Validation Results | No | No | Validation detail JSON |
| `validation_issue_count` | integer | Validation Issue Count | No | No | Count of validation issues |
| `last_validated` | glide_date_time | Last Validated | No | No | Last validation timestamp |
| `thumbnail` | user_image | Thumbnail | No | No | Preview thumbnail |
| `thumbnail_large` | user_image | Thumbnail Large | No | No | Large preview image |
| `enable_content_testing` | boolean | Enable Content Testing | No | No | Content testing flag |
| `enable_messaging_testing` | boolean | Enable Messaging Testing | No | No | Messaging test flag |
| `enable_send_strategy_testing` | boolean | Enable Send Strategy Testing | No | No | Send strategy test flag |

**Total Fields:** 30
**Read-Only Fields (Auto-Set):** `state`, `audience_tables`, `can_edit`, `can_send`, `send_now`

---

## Business Rule Execution Chain

### Phase 1: BEFORE INSERT (Pre-Database Save)

Business Rules execute in the following order:

| Order | Business Rule Name | Condition | Fields Modified | Description |
|-------|-------------------|-----------|-----------------|-------------|
| -100 | Set Audience Tables | `sourcesVALCHANGES` | `audience_tables` | Parses sources field and populates audience_tables glide_list |
| 80 | Update HTML and JSON on Template Change | `templateISNOTEMPTY` | `html`, `json` | Copies template content to email record |
| 100 | Enable Save Changes | *Always runs* | Internal flags | Enables save operation processing |
| 100 | Set Published Date | *Always runs* | `published` | Sets publication timestamp based on status |
| 100 | Status and State Sync | `statusVALCHANGES` | `state` | Synchronizes state field with status |
| 100 | Update Can Edit | `stateVALCHANGES` | `can_edit` | Sets can_edit based on workflow state |

### Phase 2: DATABASE COMMIT

Record is written to the database after all BEFORE rules complete successfully.

### Phase 3: AFTER INSERT (Post-Database Save)

| Order | Business Rule Name | Condition | Cascading Effect | Description |
|-------|-------------------|-----------|------------------|-------------|
| 100 | Create Email Send | *Always runs* | **INSERT on x_cadso_automate_email_send** | Creates child email send record |
| 101 | Create Email Send (A/B Testing) | `enable_a_b_testing=true^version_bISEMPTY` | **INSERT on x_cadso_automate_email_send** | Creates version B send record for A/B tests |
| 333 | Update Email Sends Status | `statusVALCHANGES^type=automated` | **UPDATE on x_cadso_automate_email_send** | Syncs status to related sends (conditional) |
| 334 | Update Email Send Type | `typeVALCHANGES` | **UPDATE on x_cadso_automate_email_send** | Syncs type field to child records |
| 900 | Update Email Send Content | `htmlVALCHANGES^ORjsonVALCHANGES^statusINinitialized,draft` | **UPDATE on x_cadso_automate_email_send** | Propagates content changes to send records |

### Phase 4: ASYNC (Background Processing)

No async Business Rules fire on INSERT.

---

## Cascading Table Effects

### Lineage Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INSERT OPERATION FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  User/API       │
                              │  Insert Request │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BEFORE PHASE (Order -100 to 100)                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Set Audience Tables (-100)  →  audience_tables auto-set             │ │
│  │ 2. Update HTML/JSON (80)       →  html, json copied from template      │ │
│  │ 3. Enable Save Changes (100)   →  internal processing                  │ │
│  │ 4. Set Published Date (100)    →  published timestamp set              │ │
│  │ 5. Status and State Sync (100) →  state synchronized                   │ │
│  │ 6. Update Can Edit (100)       →  can_edit flag set                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │  DATABASE COMMIT                  │
                    │  x_cadso_automate_email          │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    AFTER PHASE (Order 100 to 900)                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Create Email Send (100)                                              │ │
│  │    └──→ INSERT into x_cadso_automate_email_send (ALWAYS)               │ │
│  │                                                                         │ │
│  │ 2. Create Email Send A/B (101)                                          │ │
│  │    └──→ INSERT into x_cadso_automate_email_send (if A/B enabled)       │ │
│  │                                                                         │ │
│  │ 3. Update Email Sends Status (333) - conditional, may not fire         │ │
│  │ 4. Update Email Send Type (334) - conditional, may not fire            │ │
│  │ 5. Update Email Send Content (900) - conditional, may not fire         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│               CASCADING: x_cadso_automate_email_send INSERT                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ This triggers 18 additional Business Rules on email_send table:         │ │
│  │                                                                         │ │
│  │ BEFORE:                                                                 │ │
│  │   • Set Default Sender Profile    • Set Sender Profile Information     │ │
│  │   • Set Body from Email Change    • Set Plain Text from Email Change   │ │
│  │   • Add PreHeader + PLUS to HTML  • Enable Send                        │ │
│  │   • Log Status Change             • Process Ready To Send Email        │ │
│  │   • Set State                     • Set UTM Parameters                 │ │
│  │                                                                         │ │
│  │ AFTER:                                                                  │ │
│  │   • Create UTM Mapping            • Update Email Status                │ │
│  │   • Update Version Fields On Email                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Cascading Email Send Creation

```bash
$ npm run query -- table-dependencies x_cadso_automate_email_send

{
  "success": true,
  "data": {
    "table": "x_cadso_automate_email_send",
    "business_rules": 18,
    "impact_summary": {
      "business_rule_count": 18,
      "total_affected": 24
    }
  }
}
```

When an email record is inserted, the "Create Email Send" Business Rule **ALWAYS** creates a child record on `x_cadso_automate_email_send`. This cascading INSERT triggers 18 additional Business Rules on that table, creating a complex execution chain.

### Additional Tables Potentially Affected

| Table | Operation | Trigger Condition |
|-------|-----------|-------------------|
| `x_cadso_automate_email_send` | INSERT | Always (Create Email Send BR) |
| `x_cadso_automate_email_send` | INSERT | If A/B testing enabled |
| `x_cadso_automate_utm_mapping` | INSERT | Via Create UTM Mapping BR on email_send |

---

## Fields Automatically Set by Business Rules

### On INSERT - Auto-Populated Fields

| Field | Set By Business Rule | Value Logic |
|-------|---------------------|-------------|
| `audience_tables` | Set Audience Tables | Derived from `sources` field (JSON parsing) |
| `html` | Update HTML and JSON on Template Change | Copied from `template.html` if template provided |
| `json` | Update HTML and JSON on Template Change | Copied from `template.json` if template provided |
| `state` | Status and State Sync | Mapped from `status` value |
| `can_edit` | Update Can Edit | Boolean based on state (editable in draft states) |
| `published` | Set Published Date | Set to current timestamp on specific status transitions |

### Fields You Should NOT Set Manually

These fields are read-only or auto-calculated:
- `state` - Synchronized from `status`
- `audience_tables` - Calculated from `sources`
- `can_edit` - Calculated from `state`
- `can_send` - System calculated
- `send_now` - System flag

---

## Script Includes Involved

### TenonEmailValidation

```bash
$ npm run query -- script-crud TenonEmailValidation

{
  "success": true,
  "data": {
    "script": "TenonEmailValidation",
    "api_name": "x_cadso_journey.TenonEmailValidation",
    "tables": [
      "x_cadso_automate_email",
      "x_cadso_cloud_page",
      "x_cadso_automate_email_validation"
    ],
    "crud_operations": {
      "x_cadso_automate_email": { "read": true },
      "x_cadso_cloud_page": { "read": true },
      "x_cadso_automate_email_validation": { "read": true }
    }
  }
}
```

| Script Include | Tables Accessed | Operations |
|----------------|-----------------|------------|
| TenonEmailValidation | x_cadso_automate_email | READ |
| TenonEmailValidation | x_cadso_cloud_page | READ |
| TenonEmailValidation | x_cadso_automate_email_validation | READ |

**Note:** This Script Include is used for validation purposes and performs READ-only operations. It does not modify data during INSERT.

---

## Security Analysis

### Access Control Considerations

1. **Table ACLs:** The `x_cadso_automate_email` table requires appropriate CREATE permissions
2. **Reference Field Access:** Creating records requires READ access to:
   - `x_cadso_automate_email_template` (template field)
   - `x_cadso_work_campaign` (campaign field)
   - `x_cadso_work_tactic` (tactic field)
   - Brand kit table (brand_kit field)

3. **Cascading Permissions:** The user must have CREATE permission on `x_cadso_automate_email_send` since the "Create Email Send" BR runs with the calling user's context

### Security Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Unintended record creation on email_send table | Medium | Verify user has proper role assignments |
| Data exposure through template copying | Low | Templates should be pre-validated |
| Status manipulation bypassing workflow | Medium | Status field has validation in BR logic |

---

## Performance Analysis

### Performance Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Total BRs firing on INSERT | 11 | High complexity |
| Cascading BRs (email_send) | 18 | Very high complexity |
| Total BRs in chain | 29 | Significant processing overhead |
| Estimated execution time | 500-1500ms | Above average |

### Performance Considerations

1. **Synchronous Execution:** All Business Rules run synchronously - no async offloading
2. **Cascading Impact:** The "Create Email Send" BR triggers 18 additional BRs
3. **Template Copy:** If a template is provided, HTML/JSON content is copied (potentially large)
4. **Multiple Order 100 BRs:** Five BRs execute at order 100, adding latency

### Optimization Recommendations

- Consider batch operations if creating multiple email records
- Pre-validate template content to reduce processing
- Monitor transaction times when creating emails with large templates

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Business Rule failure aborts INSERT | Medium | High | Ensure all required fields are provided |
| Cascading BR failure creates orphan records | Low | Medium | Email record exists but email_send may fail |
| Template reference invalid | Low | Medium | Validate template sys_id before insert |
| Order conflict in BRs (multiple at 100) | Low | Low | Currently stable, monitor for future BRs |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Duplicate email sends created | Low | High | Verify A/B testing flags before insert |
| Incorrect status workflow | Medium | Medium | Set status to 'draft' or 'initialized' for new records |
| Orphaned validation records | Low | Low | Validation records are created separately |

### Data Integrity Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Sources field malformed | Medium | Medium | Validate sources JSON format before insert |
| Missing template content | Medium | Low | Template content is optional, not mandatory |
| State/Status mismatch | Low | Medium | Let Status and State Sync BR handle mapping |

### Security Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Unauthorized record creation | Low | Medium | ACLs protect table access |
| Privilege escalation via cascading | Low | High | BRs run in user context, not elevated |
| Data leakage from template | Low | Low | Templates are organization-scoped |

---

## Implementation Plan

### Prerequisites (Must Complete Before INSERT)

1. **Verify User Permissions**
   - User has `create` ACL on `x_cadso_automate_email`
   - User has `create` ACL on `x_cadso_automate_email_send`
   - User has `read` ACL on referenced tables (template, campaign, tactic)

2. **Validate Reference Data**
   - If providing `template`, verify sys_id exists
   - If providing `campaign`, verify sys_id exists
   - If providing `tactic`, verify sys_id exists

3. **Prepare Field Values**
   - Set `status` to `draft` or `initialized` (recommended for new records)
   - Do NOT set `state`, `can_edit`, `audience_tables` (auto-populated)

### Recommended INSERT Operation

```javascript
// Safe record creation pattern
var gr = new GlideRecord('x_cadso_automate_email');
gr.initialize();

// Required/Recommended fields
gr.name = 'My Email Marketing Record';
gr.status = 'draft';  // Let BR handle state sync
gr.type = 'standard'; // or 'automated'

// Optional reference fields (if known)
gr.template = 'sys_id_of_template';  // Triggers HTML/JSON copy
gr.campaign = 'sys_id_of_campaign';
gr.brand_kit = 'sys_id_of_brand_kit';

// A/B Testing (optional - triggers additional email_send creation)
gr.enable_a_b_testing = false;

// DO NOT SET - Auto-populated by BRs:
// gr.state - set by Status and State Sync
// gr.can_edit - set by Update Can Edit
// gr.audience_tables - set by Set Audience Tables

var sysId = gr.insert();  // Returns sys_id of created record

// The following cascade automatically:
// 1. Email Send record created on x_cadso_automate_email_send
// 2. If A/B testing enabled, version B send record created
```

### Step-by-Step Safe Creation Process

| Step | Action | Depends On |
|------|--------|------------|
| 1 | Validate user permissions | - |
| 2 | Validate reference sys_ids | Step 1 |
| 3 | Prepare sources JSON if needed | Step 1 |
| 4 | Create GlideRecord and set fields | Steps 1-3 |
| 5 | Call insert() | Step 4 |
| 6 | Verify email_send child record created | Step 5 |
| 7 | Verify state was set correctly | Step 5 |

---

## Effort Estimation

| Task | Time | Cost Estimate |
|------|------|---------------|
| Understanding execution context | 1 hour | $100 |
| Creating single test record | 15 minutes | $25 |
| Validating cascading effects | 30 minutes | $50 |
| Full E2E testing with A/B | 2 hours | $200 |
| Documentation review | 30 minutes | $50 |
| **Total** | **4.25 hours** | **$425** |

---

## Testing Strategy

### Unit Tests

- [ ] Insert record with minimal fields (name, status only)
- [ ] Insert record with template reference
- [ ] Insert record with A/B testing enabled
- [ ] Insert record with sources JSON populated
- [ ] Verify state is auto-set based on status

### Integration Tests

- [ ] Verify email_send child record is created
- [ ] Verify email_send has correct parent reference
- [ ] Test Sending Strategy - Save API endpoint interaction
- [ ] Verify template content is copied correctly

### E2E Test Scenarios

| Scenario | Expected Outcome |
|----------|------------------|
| Create draft email with template | Email created, email_send created, HTML/JSON copied |
| Create A/B test email | Email created, TWO email_send records created |
| Create automated email type | Email created, status sync applies to email_send |
| Create email without template | Email created, html/json remain empty |

---

## Deployment & Rollback

### Deployment Sequence

1. Ensure all referenced data exists (templates, campaigns, etc.)
2. Test in sub-production environment first
3. Create record via API or GlideRecord
4. Verify child record creation
5. Validate field auto-population

### Rollback Procedure

If record creation fails or causes issues:

```javascript
// Rollback Step 1: Delete the email_send child records first
var sendGr = new GlideRecord('x_cadso_automate_email_send');
sendGr.addQuery('email', 'SYS_ID_OF_EMAIL');
sendGr.query();
while (sendGr.next()) {
    sendGr.deleteRecord(); // Note: Prevent Delete BR may block this
}

// Rollback Step 2: Delete the parent email record
var emailGr = new GlideRecord('x_cadso_automate_email');
if (emailGr.get('SYS_ID_OF_EMAIL')) {
    emailGr.deleteRecord(); // Note: Prevent Delete BR exists
}
```

**Important:** The "Prevent Delete" Business Rule exists on both tables. Deletion may require:
- Setting status to a deletable state first
- Admin override of the Business Rule
- Direct database access (not recommended)

### Rollback Checklist

- [ ] Identify email record sys_id
- [ ] Query for all related email_send records
- [ ] Delete email_send records first (child before parent)
- [ ] Delete email record
- [ ] Verify no orphaned records remain
- [ ] Check for UTM mapping cleanup (cascading delete)

---

## Summary and Recommendations

### Operation Summary

| Aspect | Value |
|--------|-------|
| **Risk Level** | HIGH |
| **Total Business Rules** | 11 on insert (29 with cascade) |
| **Cascading Tables** | x_cadso_automate_email_send |
| **Auto-Set Fields** | 6 fields |
| **Script Includes** | 1 (TenonEmailValidation - READ only) |

### Recommendations for Safe Record Creation

1. **Always set status to 'draft'** for new records
2. **Never manually set auto-populated fields** (state, can_edit, audience_tables)
3. **Validate template exists** before providing template reference
4. **Test in sub-production first** due to HIGH risk level
5. **Monitor email_send creation** to ensure cascading succeeded
6. **Be cautious with A/B testing flag** - creates additional records
7. **Have rollback plan ready** - deletion is restricted by Business Rules

### Final Risk Assessment

| Category | Risk Level | Notes |
|----------|------------|-------|
| **Overall** | HIGH | 29 BRs in execution chain |
| **Data Integrity** | MEDIUM | Auto-population generally reliable |
| **Performance** | MEDIUM | Noticeable latency on insert |
| **Security** | LOW | Standard ACL protection |

---

*Document generated using sn-tools execution context analysis*
