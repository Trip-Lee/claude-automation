/**
 * Git Integration Agent
 * Handles version control operations tied to ServiceNow changes
 * Manages branches, commits, and pull requests based on stories
 */

const BaseAgent = require('./base-agent');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = util.promisify(exec);

class GitIntegrationAgent extends BaseAgent {
    constructor(config = {}) {
        super('GitIntegration', config);
        
        this.activeStory = null;
        this.activeBranch = null;
        this.repoPath = this.rootPath;
        
        // Git configuration
        this.gitConfig = {
            defaultBranch: 'main',
            branchPrefix: 'story/',
            commitPrefix: '[ServiceNow]',
            autoCommit: true,
            autoPush: false
        };
    }

    async loadData() {
        this.log('Checking git repository status...', 'yellow');
        
        try {
            // Check if we're in a git repo
            const { stdout: gitStatus } = await execAsync('git status', { cwd: this.repoPath });
            
            // Get current branch
            const { stdout: branch } = await execAsync('git branch --show-current', { cwd: this.repoPath });
            this.activeBranch = branch.trim();
            
            this.log(`Current branch: ${this.activeBranch}`, 'green');
        } catch (error) {
            this.log('Not in a git repository or git not configured', 'yellow');
        }
    }

    async handleRequest(request) {
        switch (request.type) {
            case 'create_story_branch':
                return this.createStoryBranch(request.storyNumber, request.storyTitle);
                
            case 'commit_servicenow_changes':
                return this.commitServiceNowChanges(request.message, request.files);
                
            case 'create_pull_request':
                return this.createPullRequest(request.storyNumber, request.description);
                
            case 'sync_with_servicenow':
                return this.syncWithServiceNow(request.changes);
                
            case 'get_uncommitted_changes':
                return this.getUncommittedChanges();
                
            case 'auto_commit_update':
                return this.autoCommitUpdate(request.updateInfo);
                
            case 'validate_branch_clean':
                return this.validateBranchClean();
                
            case 'merge_story_branch':
                return this.mergeStoryBranch(request.storyNumber);
                
            default:
                throw new Error(`Unknown request type: ${request.type}`);
        }
    }

    async createStoryBranch(storyNumber, storyTitle) {
        const branchName = `${this.gitConfig.branchPrefix}${storyNumber}`;
        
        try {
            // Check for uncommitted changes
            const { stdout: status } = await execAsync('git status --porcelain', { cwd: this.repoPath });
            if (status.trim()) {
                throw new Error('Uncommitted changes detected. Please commit or stash them first.');
            }
            
            // Create and checkout new branch
            await execAsync(`git checkout -b ${branchName}`, { cwd: this.repoPath });
            
            this.activeBranch = branchName;
            this.activeStory = storyNumber;
            
            this.log(`Created and switched to branch: ${branchName}`, 'green');
            
            // Create initial commit for the story
            const commitMessage = `${this.gitConfig.commitPrefix} Start work on ${storyNumber}: ${storyTitle}`;
            
            // Create a marker file to track story work
            const markerPath = path.join(this.repoPath, '.story-marker', `${storyNumber}.json`);
            const markerDir = path.dirname(markerPath);
            
            if (!fs.existsSync(markerDir)) {
                fs.mkdirSync(markerDir, { recursive: true });
            }
            
            fs.writeFileSync(markerPath, JSON.stringify({
                storyNumber,
                storyTitle,
                branch: branchName,
                startedAt: new Date().toISOString(),
                status: 'in-progress'
            }, null, 2));
            
            await execAsync(`git add ${markerPath}`, { cwd: this.repoPath });
            await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.repoPath });
            
            return {
                branch: branchName,
                story: storyNumber,
                status: 'created'
            };
        } catch (error) {
            this.logError(`Failed to create branch: ${error.message}`);
            throw error;
        }
    }

    async commitServiceNowChanges(message, files = []) {
        try {
            // Stage files
            if (files.length > 0) {
                for (const file of files) {
                    await execAsync(`git add "${file}"`, { cwd: this.repoPath });
                }
            } else {
                // Stage all ServiceNow-related changes
                await execAsync('git add ServiceNow-Data/', { cwd: this.repoPath }).catch(() => {});
                await execAsync('git add ServiceNow-Tools/temp_updates/', { cwd: this.repoPath }).catch(() => {});
                await execAsync('git add ServiceNow-Tools/backups/', { cwd: this.repoPath }).catch(() => {});
            }
            
            // Check if there are changes to commit
            const { stdout: staged } = await execAsync('git diff --cached --name-only', { cwd: this.repoPath });
            
            if (!staged.trim()) {
                this.log('No changes to commit', 'yellow');
                return {
                    committed: false,
                    message: 'No changes detected'
                };
            }
            
            // Commit with ServiceNow prefix
            const fullMessage = `${this.gitConfig.commitPrefix} ${message}`;
            await execAsync(`git commit -m "${fullMessage}"`, { cwd: this.repoPath });
            
            this.log(`Committed: ${fullMessage}`, 'green');
            
            // Auto-push if configured
            if (this.gitConfig.autoPush) {
                await execAsync(`git push origin ${this.activeBranch}`, { cwd: this.repoPath });
                this.log('Pushed to remote', 'green');
            }
            
            return {
                committed: true,
                message: fullMessage,
                branch: this.activeBranch,
                pushed: this.gitConfig.autoPush
            };
        } catch (error) {
            this.logError(`Commit failed: ${error.message}`);
            throw error;
        }
    }

    async createPullRequest(storyNumber, description) {
        try {
            const branchName = `${this.gitConfig.branchPrefix}${storyNumber}`;
            
            // First, push the branch if not already pushed
            await execAsync(`git push -u origin ${branchName}`, { cwd: this.repoPath });
            
            // Use GitHub CLI if available
            const prTitle = `[${storyNumber}] Complete implementation`;
            const prBody = `## Story: ${storyNumber}\n\n${description}\n\n### Changes\n- ServiceNow components updated\n- Frontend components modified\n- Backend scripts updated\n\n### Testing\n- [ ] Unit tests pass\n- [ ] Integration tests pass\n- [ ] Manual testing complete`;
            
            try {
                const { stdout } = await execAsync(
                    `gh pr create --title "${prTitle}" --body "${prBody}" --base ${this.gitConfig.defaultBranch}`,
                    { cwd: this.repoPath }
                );
                
                this.log('Pull request created successfully', 'green');
                return {
                    created: true,
                    url: stdout.trim()
                };
            } catch (ghError) {
                // If gh CLI not available, provide manual instructions
                this.log('GitHub CLI not available. Please create PR manually:', 'yellow');
                return {
                    created: false,
                    branch: branchName,
                    title: prTitle,
                    body: prBody,
                    instruction: `Push branch and create PR from ${branchName} to ${this.gitConfig.defaultBranch}`
                };
            }
        } catch (error) {
            this.logError(`Failed to create PR: ${error.message}`);
            throw error;
        }
    }

    async syncWithServiceNow(changes) {
        const syncResults = [];
        
        for (const change of changes) {
            try {
                // Stage the changed file
                await execAsync(`git add "${change.file}"`, { cwd: this.repoPath });
                
                // Create a sync commit
                const commitMessage = `Sync ${change.type}: ${change.name} (${change.sysId})`;
                await execAsync(`git commit -m "${this.gitConfig.commitPrefix} ${commitMessage}"`, { cwd: this.repoPath });
                
                syncResults.push({
                    file: change.file,
                    status: 'synced',
                    commit: commitMessage
                });
            } catch (error) {
                syncResults.push({
                    file: change.file,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        return {
            synced: syncResults.filter(r => r.status === 'synced').length,
            failed: syncResults.filter(r => r.status === 'failed').length,
            results: syncResults
        };
    }

    async getUncommittedChanges() {
        try {
            const { stdout: status } = await execAsync('git status --porcelain', { cwd: this.repoPath });
            
            if (!status.trim()) {
                return {
                    hasChanges: false,
                    files: []
                };
            }
            
            const files = status.trim().split('\n').map(line => {
                const [status, ...pathParts] = line.trim().split(/\s+/);
                const filepath = pathParts.join(' ');
                
                return {
                    status: status,
                    path: filepath,
                    isServiceNow: filepath.includes('ServiceNow-Data') || filepath.includes('ServiceNow-Tools')
                };
            });
            
            return {
                hasChanges: true,
                files: files,
                serviceNowFiles: files.filter(f => f.isServiceNow)
            };
        } catch (error) {
            this.logError(`Failed to get uncommitted changes: ${error.message}`);
            throw error;
        }
    }

    async autoCommitUpdate(updateInfo) {
        if (!this.gitConfig.autoCommit) {
            return {
                committed: false,
                reason: 'Auto-commit disabled'
            };
        }
        
        try {
            const message = `Update ${updateInfo.type}: ${updateInfo.name}`;
            const files = updateInfo.files || [];
            
            return await this.commitServiceNowChanges(message, files);
        } catch (error) {
            this.logError(`Auto-commit failed: ${error.message}`);
            return {
                committed: false,
                error: error.message
            };
        }
    }

    async validateBranchClean() {
        try {
            const { stdout: status } = await execAsync('git status --porcelain', { cwd: this.repoPath });
            
            return {
                isClean: !status.trim(),
                uncommittedFiles: status.trim().split('\n').filter(l => l).length
            };
        } catch (error) {
            this.logError(`Failed to validate branch: ${error.message}`);
            throw error;
        }
    }

    async mergeStoryBranch(storyNumber) {
        const branchName = `${this.gitConfig.branchPrefix}${storyNumber}`;
        
        try {
            // Switch to main branch
            await execAsync(`git checkout ${this.gitConfig.defaultBranch}`, { cwd: this.repoPath });
            
            // Pull latest changes
            await execAsync(`git pull origin ${this.gitConfig.defaultBranch}`, { cwd: this.repoPath });
            
            // Merge story branch
            await execAsync(`git merge ${branchName} --no-ff -m "${this.gitConfig.commitPrefix} Merge ${storyNumber}"`, 
                          { cwd: this.repoPath });
            
            // Push to remote
            await execAsync(`git push origin ${this.gitConfig.defaultBranch}`, { cwd: this.repoPath });
            
            // Delete local and remote branch
            await execAsync(`git branch -d ${branchName}`, { cwd: this.repoPath });
            await execAsync(`git push origin --delete ${branchName}`, { cwd: this.repoPath });
            
            // Update story marker
            const markerPath = path.join(this.repoPath, '.story-marker', `${storyNumber}.json`);
            if (fs.existsSync(markerPath)) {
                const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
                marker.status = 'completed';
                marker.completedAt = new Date().toISOString();
                fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2));
            }
            
            this.log(`Merged and cleaned up ${branchName}`, 'green');
            
            return {
                merged: true,
                branch: branchName,
                status: 'completed'
            };
        } catch (error) {
            this.logError(`Failed to merge branch: ${error.message}`);
            throw error;
        }
    }
}

module.exports = GitIntegrationAgent;