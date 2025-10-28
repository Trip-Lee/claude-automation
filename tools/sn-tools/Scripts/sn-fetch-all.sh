#!/usr/bin/env bash
# ServiceNow Tools v2 - Fetch All Data
# Fetches both data and stories using configured routing

echo "========================================="
echo "    ServiceNow v2 - Fetch All Data"
echo "========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../ServiceNow-Tools"

echo "Fetching ServiceNow data (with instance routing)..."
node sn-operations.js fetch-data
if [ $? -ne 0 ]; then
    echo "Data fetch failed!"
    read -p "Press Enter to continue..."
    exit 1
fi

echo ""
echo "Fetching ServiceNow stories (from configured instance)..."
node sn-operations.js fetch-stories
if [ $? -ne 0 ]; then
    echo "Story fetch failed!"
    read -p "Press Enter to continue..."
    exit 1
fi

cd "$SCRIPT_DIR"

echo ""
echo "========================================="
echo "    All data fetched successfully!"
echo "========================================="
read -p "Press Enter to continue..."