#!/bin/bash
# Reset test project to clean state
# Run this between tests to ensure a clean starting point

set -e

PROJECT_PATH="$HOME/projects/test-project"

echo "🔄 Resetting test project..."

# Check if project exists
if [ ! -d "$PROJECT_PATH" ]; then
  echo "❌ Test project not found at $PROJECT_PATH"
  echo "Run: node test/test-full-workflow.js to create it"
  exit 1
fi

cd "$PROJECT_PATH"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Not a git repository"
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# If not on master, switch to master
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "📍 Switching to master branch..."
  git checkout master
fi

# Delete all claude/* branches
echo "🧹 Cleaning up claude/* branches..."
git branch | grep 'claude/' | xargs -r git branch -D || true

# Reset to initial commit (discard any uncommitted changes)
echo "♻️  Resetting to clean state..."
git reset --hard HEAD
git clean -fd

# Show status
echo ""
echo "✅ Test project reset complete!"
echo ""
git status --short
git log --oneline -n 3

echo ""
echo "Ready for testing!"
