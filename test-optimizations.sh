#!/bin/bash
# Test performance improvements from optimized prompts

echo "🧪 Testing Optimized System Prompts"
echo "===================================="
echo ""

# Reset test project
echo "1. Resetting test project..."
cd /home/coltrip/claude-automation
./test/reset-test-project.sh

# Run test task
echo ""
echo "2. Running test task with optimized prompts..."
echo "   Task: Add square(n) function"
echo ""

START_TIME=$(date +%s)

./cli.js task test-project "Add a simple square(n) function that returns n*n with tests" 2>&1 | tee /tmp/optimization-test.log

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "📊 Results:"
echo "   Total Duration: ${DURATION}s"
echo ""

# Extract performance data if available
if grep -q "Performance Summary" /tmp/optimization-test.log; then
    echo "   Detailed Breakdown:"
    grep -A 5 "Performance Summary" /tmp/optimization-test.log | sed 's/^/   /'
fi

echo ""
echo "💾 Full log saved to: /tmp/optimization-test.log"
echo ""

# Compare with baseline
echo "📈 Comparison with Baseline:"
echo "   Baseline (cube test):     150-180s"
echo "   Current (square test):    ${DURATION}s"

if [ $DURATION -lt 150 ]; then
    IMPROVEMENT=$(( 100 - (DURATION * 100 / 165) ))
    echo "   ✅ Improvement: ~${IMPROVEMENT}% faster"
else
    echo "   ⚠️  No significant improvement yet"
fi

echo ""
echo "✅ Test complete!"
