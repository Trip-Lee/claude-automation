#!/usr/bin/env bash
# ServiceNow Tools - Cross Platform
# Unified launcher that works consistently across platforms

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../ServiceNow-Tools"

# Use NVM Node if available, otherwise use system Node
if [ -x "$SCRIPT_DIR/../nvm/v22.11.0/bin/node" ]; then
    "$SCRIPT_DIR/../nvm/v22.11.0/bin/node" sn-launcher.js "$@"
else
    node sn-launcher.js "$@"
fi