# ServiceNow Test Cleanup Guide

**Purpose**: Safely remove all test artifacts and revert changes made during ServiceNow capability testing

---

## Quick Cleanup

### Clean Everything (Recommended)

```bash
# Preview what will be deleted (safe - nothing deleted)
node test/servicenow-test-cleanup.js --dry-run

# Actually delete everything
node test/servicenow-test-cleanup.js --all

# Force mode (skip confirmation)
node test/servicenow-test-cleanup.js --all --force
```

---

## What Gets Cleaned Up

### 1. Test Artifacts
All files and directories created by tests:
- Business rules
- Client scripts
- Script includes
- REST APIs
- Service Portal widgets
- Flow Designer flows
- Import Sets and Transform Maps
- Scheduled jobs
- ACLs
- Test files
- Documentation files

### 2. Empty Directories
After removing files, empty directories are cleaned up:
- `business-rules/`
- `client-scripts/`
- `script-includes/`
- `rest-apis/`
- `widgets/`
- `flows/`
- `import-sets/`
- `transform-maps/`
- `test-data/`
- `scheduled-jobs/`
- `acls/`
- `tests/`
- `docs/`
- `portal-pages/`
- `spoke/`

### 3. Git Changes
All Git changes are reverted:
- Modified files reset to HEAD
- Untracked files removed
- Directories cleaned

**Result**: sn-tools project is back to clean state ✨

---

## Usage Options

### Selective Cleanup

**Clean specific test**:
```bash
node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-001
node test/servicenow-test-cleanup.js --test-id SN-MEDIUM-002
node test/servicenow-test-cleanup.js --test-id SN-COMPLEX-001
```

**Clean by difficulty level**:
```bash
node test/servicenow-test-cleanup.js --level simple
node test/servicenow-test-cleanup.js --level medium
node test/servicenow-test-cleanup.js --level complex
```

### Safety Options

**Dry run** (see what would be deleted without deleting):
```bash
node test/servicenow-test-cleanup.js --dry-run
node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-001 --dry-run
node test/servicenow-test-cleanup.js --level medium --dry-run
```

**Force mode** (skip confirmation prompts):
```bash
node test/servicenow-test-cleanup.js --force
node test/servicenow-test-cleanup.js --all --force
```

**Help**:
```bash
node test/servicenow-test-cleanup.js --help
```

---

## Command Reference

```
Usage: node test/servicenow-test-cleanup.js [options]

Options:
  --test-id <id>     Clean up specific test (e.g., SN-SIMPLE-001)
  --level <level>    Clean up all tests in level (simple/medium/complex)
  --all              Clean up all tests (default)
  --dry-run          Show what would be deleted without deleting
  --force            Skip confirmation prompts
  --help, -h         Show this help message
```

---

## Test Artifact Mapping

### SIMPLE Tests

**SN-SIMPLE-001** (Business Rule):
- `business-rules/auto_set_critical_priority.js`

**SN-SIMPLE-002** (Client Script):
- `client-scripts/validate_short_description.js`

**SN-SIMPLE-003** (Script Include):
- `script-includes/IncidentUtils.js`

### MEDIUM Tests

**SN-MEDIUM-001** (REST API):
- `rest-apis/incident_management_api.js`
- `rest-apis/incident_management_api_POST.js`

**SN-MEDIUM-002** (Portal Widget):
- `widgets/my_open_incidents/` (entire directory)

**SN-MEDIUM-003** (Flow):
- `flows/incident_escalation_flow.json`
- `flows/incident_escalation_flow_documentation.md`

**SN-MEDIUM-004** (Import Set):
- `import-sets/` (entire directory)
- `transform-maps/` (entire directory)
- `test-data/sample_users.csv`

### COMPLEX Tests

**SN-COMPLEX-001** (Smart Assignment - 11 files):
- `script-includes/SmartAssignmentEngine.js`
- `business-rules/auto_assign_incidents.js`
- `rest-apis/assignment_override_api.js`
- `client-scripts/assignment_feedback.js`
- `scheduled-jobs/assignment_performance_report.js`
- `acls/assignment_override_acl.js`
- `acls/assignment_analytics_acl.js`
- `tests/test_smart_assignment_engine.js`
- `tests/test_auto_assign_business_rule.js`
- `tests/test_assignment_override_api.js`
- `docs/SMART_ASSIGNMENT_SYSTEM.md`

**SN-COMPLEX-002** (Team Dashboard - 25+ files):
- `portal-pages/` (entire directory)
- `widgets/team_metrics/`
- `widgets/activity_feed/`
- `widgets/incident_list/`
- `widgets/charts/`
- `rest-apis/team_dashboard_api.js`
- `script-includes/TeamDashboardUtils.js`
- `script-includes/TeamMetricsCalculator.js`
- `script-includes/AnalyticsEngine.js`
- `scheduled-jobs/cache_team_metrics.js`
- `scheduled-jobs/generate_analytics_snapshots.js`
- `tests/test_team_dashboard_api.js`
- `tests/test_widgets.js`
- `docs/TEAM_DASHBOARD_USER_GUIDE.md`
- `docs/TEAM_DASHBOARD_TECHNICAL_GUIDE.md`

**SN-COMPLEX-003** (Slack Spoke - 22+ files):
- `spoke/slack_integration/` (entire directory with all subdirectories)

---

## Workflow Examples

### Example 1: Safe Testing Workflow

```bash
# 1. Run a test
dev-tools task sn-tools "Create a business rule..."

# 2. Validate results
ls ~/projects/sn-tools/business-rules/

# 3. Record scores
# ... fill in results template ...

# 4. Preview cleanup
node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-001 --dry-run

# 5. Clean up
node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-001

# 6. Verify clean
git status ~/projects/sn-tools/
```

### Example 2: Full Test Suite Workflow

```bash
# 1. Run all SIMPLE tests
# ... run SN-SIMPLE-001, SN-SIMPLE-002, SN-SIMPLE-003 ...

# 2. Clean up SIMPLE tests
node test/servicenow-test-cleanup.js --level simple

# 3. Run all MEDIUM tests
# ... run SN-MEDIUM-001, SN-MEDIUM-002, etc ...

# 4. Clean up MEDIUM tests
node test/servicenow-test-cleanup.js --level medium

# 5. Run all COMPLEX tests
# ... run SN-COMPLEX-001, SN-COMPLEX-002, SN-COMPLEX-003 ...

# 6. Clean up COMPLEX tests
node test/servicenow-test-cleanup.js --level complex

# 7. Final verification
git status ~/projects/sn-tools/
```

### Example 3: One-Shot Testing

```bash
# Run test, score it, clean up immediately
dev-tools task sn-tools "Create a business rule..." && \
  sleep 180 && \
  node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-001 --force
```

### Example 4: Batch Testing with Cleanup

```bash
# Test all simple tests, then clean up all at once
for test in SN-SIMPLE-001 SN-SIMPLE-002 SN-SIMPLE-003; do
  echo "Running $test..."
  dev-tools task sn-tools "[task prompt for $test]"
  # Wait for completion, validate, score...
done

# Clean up all SIMPLE tests
node test/servicenow-test-cleanup.js --level simple
```

---

## Safety Features

### 1. Dry Run Mode
Always preview deletions first:
```bash
node test/servicenow-test-cleanup.js --dry-run
```

Output shows:
- ✓ What files/directories would be deleted
- ✓ Git commands that would run
- ✓ No actual changes made
- ✓ Safe to run anytime

### 2. Confirmation Prompt
Without `--force`, script asks for confirmation:
```
⚠️  WARNING: This will permanently delete test artifacts!
Continue? (yes/no):
```

Type `yes` to proceed, anything else cancels.

### 3. Graceful Handling
- Non-existent files/directories logged but don't error
- Continues cleaning even if some deletions fail
- Reports summary of what was/wasn't deleted

### 4. Git Reset Safety
Git reset uses:
- `git reset --hard HEAD` - resets tracked files
- `git clean -fd` - removes untracked files/directories

Only runs on sn-tools project directory.

---

## Output Examples

### Dry Run Output
```
🧹 ServiceNow Test Cleanup Script

Cleanup Configuration:
  Project: /home/user/projects/sn-tools
  Tests to clean: 3
  Tests: SN-SIMPLE-001, SN-SIMPLE-002, SN-SIMPLE-003
  Dry run: Yes
  Force: No

======================================================================
STARTING CLEANUP
======================================================================

Cleaning up SN-SIMPLE-001...
  [DRY RUN] Would delete file: business-rules/auto_set_critical_priority.js
  Summary: 0 deleted, 0 not found, 0 errors

Cleaning up SN-SIMPLE-002...
  [DRY RUN] Would delete file: client-scripts/validate_short_description.js
  Summary: 0 deleted, 0 not found, 0 errors

Cleaning up SN-SIMPLE-003...
  [DRY RUN] Would delete file: script-includes/IncidentUtils.js
  Summary: 0 deleted, 0 not found, 0 errors

Cleaning up empty directories...
  [DRY RUN] Would delete empty directory: business-rules/

Checking for Git changes...
  Found 3 changed file(s):
     M business-rules/auto_set_critical_priority.js
     M client-scripts/validate_short_description.js
     M script-includes/IncidentUtils.js
  [DRY RUN] Would run: git reset --hard HEAD
  [DRY RUN] Would run: git clean -fd

======================================================================
CLEANUP SUMMARY
======================================================================

[DRY RUN MODE - Nothing was actually deleted]

Artifact Cleanup:
  Tests cleaned: 3
  Artifacts deleted: 0
  Not found: 0
  Errors: 0

Directory Cleanup:
  Empty directories removed: 0

Git Changes:
  Files reverted: 0

Total Time: 0.3s

⊘ Dry run completed (no changes made)

Run without --dry-run to actually delete files.
```

### Actual Cleanup Output
```
🧹 ServiceNow Test Cleanup Script

Cleanup Configuration:
  Project: /home/user/projects/sn-tools
  Tests to clean: 3
  Tests: SN-SIMPLE-001, SN-SIMPLE-002, SN-SIMPLE-003
  Dry run: No
  Force: No

⚠️  WARNING: This will permanently delete test artifacts!
Continue? (yes/no): yes

======================================================================
STARTING CLEANUP
======================================================================

Cleaning up SN-SIMPLE-001...
  ✓ Deleted file: business-rules/auto_set_critical_priority.js
  Summary: 1 deleted, 0 not found, 0 errors

Cleaning up SN-SIMPLE-002...
  ✓ Deleted file: client-scripts/validate_short_description.js
  Summary: 1 deleted, 0 not found, 0 errors

Cleaning up SN-SIMPLE-003...
  ✓ Deleted file: script-includes/IncidentUtils.js
  Summary: 1 deleted, 0 not found, 0 errors

Cleaning up empty directories...
  ✓ Deleted empty directory: business-rules/
  ✓ Deleted empty directory: client-scripts/
  ✓ Deleted empty directory: script-includes/

Checking for Git changes...
  No Git changes to revert

======================================================================
CLEANUP SUMMARY
======================================================================

Artifact Cleanup:
  Tests cleaned: 3
  Artifacts deleted: 3
  Not found: 0
  Errors: 0

Directory Cleanup:
  Empty directories removed: 3

Git Changes:
  Files reverted: 0

Total Time: 0.5s

✓ Cleanup completed successfully!
```

---

## Troubleshooting

### Problem: "Project not found"
**Solution**: Ensure sn-tools project exists:
```bash
ls ~/projects/sn-tools/
```

### Problem: "Permission denied"
**Solution**: Check file permissions:
```bash
chmod +x test/servicenow-test-cleanup.js
```

### Problem: "Git changes not reverted"
**Solution**: Run git commands manually:
```bash
cd ~/projects/sn-tools
git reset --hard HEAD
git clean -fd
```

### Problem: "Some files not deleted"
**Solution**: Check which files had errors in output, delete manually:
```bash
rm -rf ~/projects/sn-tools/[path-to-file]
```

### Problem: "Want to keep some test files"
**Solution**: Use selective cleanup:
```bash
# Only clean specific tests
node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-001
node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-002
# Keep SN-SIMPLE-003 artifacts
```

---

## Best Practices

### 1. Always Dry Run First
```bash
node test/servicenow-test-cleanup.js --dry-run
```
Review what will be deleted before committing to cleanup.

### 2. Clean Between Tests
Don't let artifacts accumulate:
```bash
# After each test
node test/servicenow-test-cleanup.js --test-id [test-id]
```

### 3. Clean By Level
Group cleanups by difficulty:
```bash
# After completing all SIMPLE tests
node test/servicenow-test-cleanup.js --level simple
```

### 4. Save Important Artifacts
If you want to keep some code:
```bash
# Copy before cleanup
cp ~/projects/sn-tools/[file] ~/backups/

# Then clean
node test/servicenow-test-cleanup.js --all
```

### 5. Verify After Cleanup
Always check that cleanup worked:
```bash
git status ~/projects/sn-tools/
ls -la ~/projects/sn-tools/
```

### 6. Use in CI/CD
For automated testing:
```bash
# Clean before test suite
node test/servicenow-test-cleanup.js --all --force

# Run tests
npm run test:servicenow

# Clean after test suite
node test/servicenow-test-cleanup.js --all --force
```

---

## Integration with Test Workflow

### Recommended Workflow

```
1. Run Test
   └─> dev-tools task sn-tools "[prompt]"

2. Monitor
   └─> dev-tools status
   └─> dev-tools logs -f <taskId>

3. Validate
   └─> Check artifacts created
   └─> Review code quality
   └─> Test functionality

4. Score
   └─> Fill in results template
   └─> Record observations

5. Cleanup
   └─> node test/servicenow-test-cleanup.js --test-id [id]
   └─> Verify clean state

6. Next Test
   └─> Repeat from step 1
```

---

## Additional Commands

### Check what files exist before cleanup
```bash
find ~/projects/sn-tools -type f -name "*.js" | grep -E "(business-rules|client-scripts|script-includes)"
```

### Count test artifacts
```bash
find ~/projects/sn-tools -type f | wc -l
```

### See git status
```bash
cd ~/projects/sn-tools && git status
```

### Manual full reset
```bash
cd ~/projects/sn-tools
git reset --hard HEAD
git clean -fdx
```

---

## Summary

**Cleanup Script**: `test/servicenow-test-cleanup.js`

**Key Features**:
- ✓ Deletes all test artifacts
- ✓ Cleans empty directories
- ✓ Reverts Git changes
- ✓ Dry run mode for safety
- ✓ Selective or full cleanup
- ✓ Confirmation prompts
- ✓ Detailed output

**Most Common Commands**:
```bash
# Preview cleanup
node test/servicenow-test-cleanup.js --dry-run

# Clean everything
node test/servicenow-test-cleanup.js --all

# Clean specific test
node test/servicenow-test-cleanup.js --test-id SN-SIMPLE-001

# Clean by level
node test/servicenow-test-cleanup.js --level simple
```

**Result**: Clean sn-tools project ready for next test! ✨

---

**Created**: 2025-11-13
**Version**: 1.0
**Status**: Ready for use
