#!/usr/bin/env bash
# ServiceNow Tools - Root Level Unix Launcher
# Cross-platform entry point for Unix systems

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Execute the main launcher script
exec "$SCRIPT_DIR/Scripts/sn-tools.sh" "$@"