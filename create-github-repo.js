#!/usr/bin/env node

/**
 * Create GitHub Repository
 *
 * One-time script to create the claude-automation repository on GitHub
 */

import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error(chalk.red('Error: GITHUB_TOKEN not found in ~/.env file'));
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function createRepository() {
  const repoName = 'claude-automation';
  const description = 'Claude Multi-Agent Coding System - Mobile-accessible AI-powered development orchestration for Raspberry Pi';

  console.log(chalk.blue.bold('\n🚀 Creating GitHub Repository\n'));
  console.log(chalk.gray(`Repository: ${repoName}`));
  console.log(chalk.gray(`Description: ${description}\n`));

  try {
    // Check if repository already exists
    try {
      const { data: existingRepo } = await octokit.rest.repos.get({
        owner: (await octokit.rest.users.getAuthenticated()).data.login,
        repo: repoName
      });

      console.log(chalk.yellow(`⚠️  Repository already exists:`));
      console.log(chalk.blue(`   ${existingRepo.html_url}`));
      console.log(chalk.gray(`\nSkipping creation. Use this URL to add as remote:\n`));
      console.log(chalk.white(`   git remote add origin ${existingRepo.clone_url}`));
      console.log(chalk.white(`   git push -u origin master\n`));
      return existingRepo;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      // Repository doesn't exist, continue with creation
    }

    // Create the repository
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: description,
      private: false, // Make it public (change to true for private)
      auto_init: false, // Don't auto-initialize (we have local code)
      has_issues: true,
      has_projects: true,
      has_wiki: true
    });

    console.log(chalk.green('✅ Repository created successfully!\n'));
    console.log(chalk.blue(`   ${repo.html_url}`));
    console.log(chalk.gray(`\nNext steps:\n`));
    console.log(chalk.white(`   git remote add origin ${repo.clone_url}`));
    console.log(chalk.white(`   git push -u origin master\n`));

    return repo;

  } catch (error) {
    console.error(chalk.red(`\n❌ Error creating repository: ${error.message}`));
    if (error.status === 401) {
      console.error(chalk.yellow('   Check that your GITHUB_TOKEN has the required permissions (repo scope)'));
    }
    process.exit(1);
  }
}

createRepository();
