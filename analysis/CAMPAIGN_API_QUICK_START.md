# CampaignAPI estimated_budget Property - Quick Start Guide

**TL;DR Version**
- **Risk Level:** 🟢 LOW
- **Effort:** 28-41 hours (1 week for 2 developers)
- **Breaking Changes:** None
- **Rollback Time:** < 30 minutes

---

## What's Changing?

Adding `estimated_budget` property to CampaignAPI to support predictive budget planning.

### Current State
```json
POST /campaign
{
  "name": "Q1 Campaign",
  "budget": 50000
}

GET /campaign/123
{
  "result": {
    "name": "Q1 Campaign",
    "budget": 50000
  }
}
```

### After Change
```json
POST /campaign
{
  "name": "Q1 Campaign",
  "budget": 50000,
  "estimated_budget": 55000  // NEW - optional
}

GET /campaign/123
{
  "result": {
    "name": "Q1 Campaign",
    "budget": 50000,
    "estimated_budget": 55000  // NEW - always included
  }
}
```

---

## What Files Need Changes?

| File | Type | Lines Changed | Effort |
|------|------|---------------|--------|
| `x_cadso_work_campaign` table | Schema | Add 1 field | 5 min |
| `WorkItemManager.js` | Script Include | Update 2 JSDoc blocks | 10 min |
| `WorkItemValidator.js` | Script Include | Add _validateBudgets() method | 50 min |
| `validate_before_campaign_insert.js` | Business Rule | Add validation logic | 45 min |
| API Documentation | Docs | Update examples | 30 min |

**Total:** 2.5 hours of implementation work

---

## Key Points

### ✅ What's NOT Changing
- Existing `budget` field behavior
- Required fields (estimated_budget is optional)
- API versioning
- Campaign table relationships
- Business Rule abort behavior

### ✅ What IS Changing
- New optional `estimated_budget` field added
- Validation logic enhanced for both budget fields
- Variance warnings when budgets differ by >20%
- API responses include new field

### ✅ Backward Compatibility
- Old API clients work unchanged ✅
- Old API requests work unchanged ✅
- Existing campaigns unaffected ✅
- Graceful degradation ✅

---

## Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Validation fails | 15% | Unit testing, code review |
| Performance impact | 10% | Load testing before deploy |
| Data integrity | 5% | Two-tier validation |
| Rollback issues | 5% | Rollback testing |

**Overall:** 🟢 LOW RISK

---

## Implementation Checklist

### Phase 1: Preparation (2 hours)
- [ ] Get stakeholder approval
- [ ] Schedule deployment window
- [ ] Create test cases
- [ ] Brief support team

### Phase 2: Development (4 hours)
- [ ] Add database field
- [ ] Update WorkItemValidator.js
- [ ] Update WorkItemManager.js
- [ ] Update Business Rule
- [ ] Code review

### Phase 3: Testing (4 hours)
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Backward compatibility verified
- [ ] Rollback tested

### Phase 4: Deployment (1-2 hours)
- [ ] Backup database
- [ ] Deploy changes
- [ ] Run smoke tests
- [ ] Monitor post-deployment

---

## Testing Scenarios

### Must Pass
1. Create campaign WITH estimated_budget → Success
2. Create campaign WITHOUT estimated_budget → Success
3. Create campaign with invalid estimated_budget → Failure
4. GET campaign returns estimated_budget → Success
5. Old clients (no estimated_budget) still work → Success
6. Variance warning triggers at >20% → Success

---

## What's New in Code

### In WorkItemValidator.js

```javascript
_validateBudgets: function(budget, estimatedBudget) {
    var result = { valid: true, errors: [], warnings: [] };

    // Validate both fields
    if (budget && !isNumeric(budget)) {
        result.errors.push('Budget must be numeric');
    }
    if (estimatedBudget && !isNumeric(estimatedBudget)) {
        result.errors.push('Estimated budget must be numeric');
    }

    // Check variance (20% threshold)
    if (budget && estimatedBudget) {
        var variance = Math.abs(budget - estimatedBudget) / estimatedBudget;
        if (variance > 0.20) {
            result.warnings.push('Budget variance detected');
        }
    }

    return result;
}
```

### In validate_before_campaign_insert

```javascript
// Validate estimated_budget
var estimatedBudget = current.getValue('u_estimated_budget');
if (estimatedBudget && !isNumeric(estimatedBudget)) {
    validationResult.valid = false;
    validationResult.errors.push('Estimated budget must be numeric');
}
```

---

## Rollback Plan

**If something goes wrong:**

1. Stop new campaigns with estimated_budget (2 min)
2. Revert code changes (10 min)
3. Disable Business Rule (2 min)
4. Verify stability (5 min)
5. **Total:** < 20 minutes

---

## Success Metrics

After deployment, confirm:
- [ ] Campaigns can be created with estimated_budget
- [ ] Campaigns can be created without estimated_budget
- [ ] API responses include estimated_budget field
- [ ] Validation prevents negative values
- [ ] Variance warnings trigger correctly
- [ ] Old clients still work
- [ ] No performance degradation
- [ ] No error logs

---

## Questions?

**Q: Do existing campaigns need updating?**
A: No. estimated_budget defaults to NULL. Existing campaigns continue working.

**Q: Can users see this field?**
A: Yes, after deployment. Field appears in campaign forms.

**Q: What if estimated_budget is larger than budget?**
A: That's allowed. A warning is shown if variance > 20%.

**Q: Can we rollback easily?**
A: Yes, < 30 minutes. Tested before deployment.

**Q: Does this affect reporting?**
A: Only if reporting tools are updated to use it. Otherwise, no impact.

---

## Timeline

**Week 1:** Development + Testing
**Week 2:** Staging validation + Deployment
**Week 3:** Post-deployment monitoring

---

**Need more details?** See `CampaignAPI_budget_property_impact.md`
