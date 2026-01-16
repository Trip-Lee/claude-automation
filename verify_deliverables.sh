#!/bin/bash

echo "==================================================================="
echo "Work Item Validation System - Deliverables Verification"
echo "==================================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
total=0
passed=0
failed=0

check_file() {
    total=$((total + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        passed=$((passed + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $2 (MISSING: $1)"
        failed=$((failed + 1))
        return 1
    fi
}

echo "Checking Script Includes..."
check_file "script-includes/WorkItemValidator.js" "WorkItemValidator Script Include"
check_file "script-includes/WorkItemManager.js" "WorkItemManager Script Include"
echo ""

echo "Checking Business Rules..."
check_file "business-rules/validate_before_campaign_insert.js" "Validate Before Campaign Insert BR"
check_file "business-rules/validate_before_project_insert.js" "Validate Before Project Insert BR"
echo ""

echo "Checking Unit Tests..."
check_file "tests/test_work_item_validator.js" "WorkItemValidator Unit Tests"
check_file "tests/test_work_item_manager.js" "WorkItemManager Unit Tests"
echo ""

echo "Checking Documentation..."
check_file "docs/WORK_ITEM_VALIDATION_SYSTEM.md" "Main System Documentation"
check_file "docs/WorkItemValidator_DOCUMENTATION.md" "WorkItemValidator API Documentation"
check_file "docs/WorkItemManager_DOCUMENTATION.md" "WorkItemManager API Documentation"
echo ""

echo "Checking Delivery Files..."
check_file "WORK_ITEM_SYSTEM_DELIVERY.md" "Delivery Summary"
check_file "WORK_ITEM_SYSTEM_INDEX.md" "Documentation Index"
echo ""

echo "==================================================================="
echo "Verification Summary"
echo "==================================================================="
echo "Total Checks: $total"
echo -e "${GREEN}Passed: $passed${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}Failed: $failed${NC}"
else
    echo -e "${GREEN}Failed: $failed${NC}"
fi
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ ALL DELIVERABLES PRESENT - READY FOR DELIVERY${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Review documentation files"
    echo "2. Run unit tests"
    echo "3. Deploy to ServiceNow development instance"
    echo "4. Follow deployment checklist in WORK_ITEM_SYSTEM_DELIVERY.md"
else
    echo -e "${RED}❌ MISSING DELIVERABLES - REVIEW REQUIRED${NC}"
    echo ""
    echo "Please create missing files before deployment"
fi

echo ""
echo "==================================================================="

exit $failed
