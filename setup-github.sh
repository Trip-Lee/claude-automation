#!/bin/bash

# Setup GitHub Repository for claude-automation
# This script helps you create and connect to a GitHub repository

set -e

echo -e "\n\033[1;34m🚀 GitHub Repository Setup for claude-automation\033[0m\n"

# Check if gh CLI is installed
if command -v gh &> /dev/null; then
    echo -e "\033[0;32m✅ GitHub CLI (gh) is installed\033[0m"
    echo ""

    # Check if authenticated
    if gh auth status &> /dev/null; then
        echo -e "\033[0;32m✅ GitHub CLI is authenticated\033[0m"
        echo ""

        # Create repository
        echo -e "\033[1;36mCreating GitHub repository...\033[0m"

        if gh repo create claude-automation \
            --public \
            --description "Claude Multi-Agent Coding System - Mobile-accessible AI-powered development orchestration for Raspberry Pi" \
            --source=. \
            --remote=origin \
            --push; then

            echo ""
            echo -e "\033[1;32m✅ Repository created and pushed successfully!\033[0m"
            echo ""
            gh repo view --web

        else
            echo -e "\033[1;33m⚠️  Repository might already exist. Checking...\033[0m"

            # Get GitHub username
            USERNAME=$(gh api user --jq .login)

            # Add remote if it doesn't exist
            if ! git remote get-url origin &> /dev/null; then
                git remote add origin "https://github.com/$USERNAME/claude-automation.git"
                echo -e "\033[0;32m✅ Added remote origin\033[0m"
            fi

            # Push to GitHub
            echo -e "\033[1;36mPushing to GitHub...\033[0m"
            git push -u origin master

            echo ""
            echo -e "\033[1;32m✅ Pushed to GitHub successfully!\033[0m"
            echo ""
            echo -e "\033[0;36mRepository URL:\033[0m"
            echo "https://github.com/$USERNAME/claude-automation"
        fi

    else
        echo -e "\033[1;33m⚠️  GitHub CLI is not authenticated\033[0m"
        echo ""
        echo "Please authenticate with GitHub CLI:"
        echo -e "\033[0;37m  gh auth login\033[0m"
        echo ""
        echo "Then run this script again."
        exit 1
    fi

else
    echo -e "\033[1;33m⚠️  GitHub CLI (gh) is not installed\033[0m"
    echo ""
    echo "You have two options:"
    echo ""
    echo -e "\033[1;36mOption 1: Install GitHub CLI (Recommended)\033[0m"
    echo "  sudo apt update"
    echo "  sudo apt install gh"
    echo "  gh auth login"
    echo "  ./setup-github.sh"
    echo ""
    echo -e "\033[1;36mOption 2: Manual Setup\033[0m"
    echo "  1. Go to https://github.com/new"
    echo "  2. Repository name: claude-automation"
    echo "  3. Description: Claude Multi-Agent Coding System - Mobile-accessible AI-powered development orchestration for Raspberry Pi"
    echo "  4. Choose Public or Private"
    echo "  5. Do NOT initialize with README, .gitignore, or license"
    echo "  6. Click 'Create repository'"
    echo ""
    echo "  Then run these commands (replace YOUR_USERNAME):"
    echo ""
    echo -e "\033[0;37m  git remote add origin https://github.com/YOUR_USERNAME/claude-automation.git\033[0m"
    echo -e "\033[0;37m  git push -u origin master\033[0m"
    echo ""
fi
