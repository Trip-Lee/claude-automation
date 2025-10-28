#!/usr/bin/env bash
# ServiceNow Setup Wizard - Root Level Unix Launcher
# Cross-platform entry point for Unix systems

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Execute the setup wizard launcher
exec "$SCRIPT_DIR/Scripts/sn-setup.sh" "$@"