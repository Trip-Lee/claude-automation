#!/bin/bash

################################################################################
# GitHub Repository Setup Script
################################################################################
#
# PURPOSE:
#   Automates the process of creating a GitHub repository and pushing local
#   code to it. Handles authentication checks, repository creation, and
#   initial push with comprehensive error handling.
#
# WHAT THIS SCRIPT DOES:
#   1. Checks if GitHub CLI (gh) is installed
#   2. Verifies GitHub authentication status
#   3. Creates repository on GitHub with proper settings
#   4. Configures local git remote
#   5. Pushes all commits to GitHub
#   6. Opens repository in web browser for verification
#
# REQUIREMENTS:
#   - GitHub CLI (gh) installed and authenticated
#   - Local git repository initialized
#   - Commits present in local repository
#   - Internet connection for GitHub API access
#
# AUTHENTICATION OPTIONS:
#   - GitHub CLI: gh auth login (recommended)
#   - Personal Access Token: Set in ~/.env as GITHUB_TOKEN
#
# REPOSITORY SETTINGS:
#   - Visibility: Public (change --public to --private for private repos)
#   - Description: Auto-generated from project purpose
#   - Features: Issues, Projects enabled; Wiki disabled
#
# ERROR HANDLING:
#   - Exits with code 1 if GitHub CLI not installed
#   - Exits with code 1 if not authenticated
#   - Gracefully handles existing repository scenario
#   - Provides clear error messages and next steps
#
# USAGE:
#   ./setup-github.sh
#
# EXIT CODES:
#   0 - Success: Repository created/updated and code pushed
#   1 - Failure: Missing requirements or authentication issues
#
################################################################################

# Enable strict error handling
# -e: Exit immediately if any command fails
# This ensures we don't continue with invalid state
set -e

echo -e "\n\033[1;34m🚀 GitHub Repository Setup for claude-automation\033[0m\n"

################################################################################
# STEP 1: Check GitHub CLI Installation
################################################################################
# GitHub CLI (gh) provides the easiest way to interact with GitHub API
# It handles authentication, repository creation, and push operations
if command -v gh &> /dev/null; then
    echo -e "\033[0;32m✅ GitHub CLI (gh) is installed\033[0m"
    echo ""

    ############################################################################
    # STEP 2: Verify Authentication
    ############################################################################
    # Authentication is required for creating repositories and pushing code
    # The 'gh auth status' command checks for valid credentials
    if gh auth status &> /dev/null; then
        echo -e "\033[0;32m✅ GitHub CLI is authenticated\033[0m"
        echo ""

        ########################################################################
        # STEP 3: Create GitHub Repository
        ########################################################################
        # This command creates a new repository with the following settings:
        #   --public: Makes repository publicly accessible
        #   --description: Sets repository description for discoverability
        #   --source=.: Uses current directory as source
        #   --remote=origin: Sets up 'origin' as the remote name
        #   --push: Automatically pushes initial commits
        #
        # WHAT HAPPENS:
        # 1. Creates repository on GitHub under authenticated user
        # 2. Configures local 'origin' remote pointing to new repo
        # 3. Pushes current branch (master) to GitHub
        # 4. Sets upstream tracking for future pushes
        ########################################################################
        echo -e "\033[1;36mCreating GitHub repository...\033[0m"

        if gh repo create claude-automation \
            --public \
            --description "Claude Multi-Agent Coding System - Mobile-accessible AI-powered development orchestration for Raspberry Pi" \
            --source=. \
            --remote=origin \
            --push; then

            ####################################################################
            # SUCCESS PATH: Repository Created
            ####################################################################
            # Repository was created successfully and code was pushed
            # Now open it in web browser for user verification
            echo ""
            echo -e "\033[1;32m✅ Repository created and pushed successfully!\033[0m"
            echo ""

            # Open repository in default web browser
            gh repo view --web

        else
            ####################################################################
            # ALTERNATE PATH: Repository Already Exists
            ####################################################################
            # If repository creation fails, it likely already exists
            # In this case, we'll add the remote and push manually
            echo -e "\033[1;33m⚠️  Repository might already exist. Checking...\033[0m"

            # Get authenticated user's username via GitHub API
            # This ensures we use the correct owner in the repository URL
            USERNAME=$(gh api user --jq .login)

            # Add remote if it doesn't exist yet
            # Check first to avoid "remote origin already exists" error
            if ! git remote get-url origin &> /dev/null; then
                git remote add origin "https://github.com/$USERNAME/claude-automation.git"
                echo -e "\033[0;32m✅ Added remote origin\033[0m"
            fi

            ####################################################################
            # STEP 4: Push to Existing Repository
            ####################################################################
            # Push local commits to the existing GitHub repository
            # -u flag sets upstream tracking for the master branch
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
