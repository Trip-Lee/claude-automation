#!/usr/bin/env bash
# ServiceNow Development Tools - Root Level Unix Launcher
# Cross-platform entry point for Unix systems

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Execute the development tools launcher
exec "$SCRIPT_DIR/Scripts/sn-dev.sh" "$@"