/**
 * ConversationThread - Manages shared conversation history across agents
 *
 * Enables collaborative communication where all agents can see the full context
 * of what has been discussed, decided, and implemented.
 */

import chalk from 'chalk';

export class ConversationThread {
  constructor() {
    this.messages = [];
    this.startTime = Date.now();
    this.fileCache = new Map(); // Cache file contents to avoid redundant reads
  }

  /**
   * Add a message to the conversation
   * @param {string} role - Who is speaking (orchestrator, architect, coder, reviewer)
   * @param {string} content - What they're saying
   * @param {Object} metadata - Optional metadata (duration, cost, etc.)
   * @param {boolean} display - Whether to display immediately (default: false)
   */
  add(role, content, metadata = {}, display = false) {
    this.messages.push({
      role,
      content,
      metadata,
      timestamp: Date.now()
    });

    // Display message immediately if requested
    if (display) {
      this.displayMessage(this.messages[this.messages.length - 1]);
    }
  }

  /**
   * Display a single message
   * @param {Object} msg - Message to display
   */
  displayMessage(msg) {
    const relativeTime = ((msg.timestamp - this.startTime) / 1000).toFixed(1);
    const timeStr = chalk.gray(`[${relativeTime}s]`);

    let roleStr;
    switch (msg.role) {
      case 'orchestrator':
        roleStr = chalk.blue('🎯 Orchestrator');
        break;
      case 'architect':
        roleStr = chalk.magenta('🏗️  Architect');
        break;
      case 'coder':
        roleStr = chalk.green('👨‍💻 Coder');
        break;
      case 'reviewer':
        roleStr = chalk.yellow('👁️  Reviewer');
        break;
      default:
        roleStr = chalk.white(msg.role);
    }

    // Truncate long messages for real-time display
    const preview = msg.content.length > 200
      ? msg.content.substring(0, 200) + '...'
      : msg.content;

    console.log(`${timeStr} ${roleStr}:`);
    console.log(chalk.gray(`  ${preview}\n`));
  }

  /**
   * Get the full conversation history as a formatted string
   * @returns {string} - Formatted conversation
   */
  getHistory() {
    return this.messages
      .map(msg => {
        const relativeTime = ((msg.timestamp - this.startTime) / 1000).toFixed(1);
        return `[${relativeTime}s] [${msg.role}]: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Get conversation history formatted for agent consumption
   * @param {string} forAgent - Which agent is requesting (optional filtering)
   * @returns {Array} - Array of message objects
   */
  getContextFor(forAgent = null) {
    // For now, return all messages
    // In future: Could filter sensitive info per agent
    return this.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Get last N messages
   * @param {number} n - Number of recent messages to get
   * @returns {Array} - Recent messages
   */
  getRecent(n = 5) {
    return this.messages.slice(-n);
  }

  /**
   * Get all messages from a specific agent
   * @param {string} role - Agent role to filter by
   * @returns {Array} - Messages from that agent
   */
  getByRole(role) {
    return this.messages.filter(msg => msg.role === role);
  }

  /**
   * Format conversation for display to user
   * @returns {string} - Pretty-printed conversation
   */
  formatForDisplay() {
    let output = chalk.cyan.bold('\n📝 COLLABORATIVE CONVERSATION\n');
    output += chalk.gray('═'.repeat(70)) + '\n\n';

    for (const msg of this.messages) {
      const relativeTime = ((msg.timestamp - this.startTime) / 1000).toFixed(1);
      const timeStr = chalk.gray(`[${relativeTime}s]`);

      let roleStr;
      switch (msg.role) {
        case 'orchestrator':
          roleStr = chalk.blue('🎯 Orchestrator');
          break;
        case 'architect':
          roleStr = chalk.magenta('🏗️  Architect');
          break;
        case 'coder':
          roleStr = chalk.green('👨‍💻 Coder');
          break;
        case 'reviewer':
          roleStr = chalk.yellow('👁️  Reviewer');
          break;
        default:
          roleStr = chalk.white(msg.role);
      }

      output += `${timeStr} ${roleStr}:\n`;
      output += chalk.white(`  ${msg.content}\n\n`);
    }

    output += chalk.gray('═'.repeat(70)) + '\n';
    return output;
  }

  /**
   * Check if any recent messages contain questions
   * @param {number} lookback - How many recent messages to check
   * @returns {boolean} - True if questions found
   */
  hasRecentQuestions(lookback = 3) {
    const recent = this.getRecent(lookback);
    return recent.some(msg =>
      msg.content.includes('?') ||
      msg.content.toLowerCase().includes('question') ||
      msg.content.toLowerCase().includes('clarify')
    );
  }

  /**
   * Extract questions from recent messages
   * @param {number} lookback - How many recent messages to check
   * @returns {Array} - Array of questions found
   */
  extractQuestions(lookback = 3) {
    const recent = this.getRecent(lookback);
    const questions = [];

    for (const msg of recent) {
      const lines = msg.content.split('\n');
      for (const line of lines) {
        if (line.includes('?')) {
          questions.push({
            from: msg.role,
            question: line.trim()
          });
        }
      }
    }

    return questions;
  }

  /**
   * Get summary statistics
   * @returns {Object} - Stats about the conversation
   */
  getStats() {
    const roleCount = {};
    let totalDuration = Date.now() - this.startTime;
    let totalCost = 0;

    for (const msg of this.messages) {
      roleCount[msg.role] = (roleCount[msg.role] || 0) + 1;
      if (msg.metadata.cost) {
        totalCost += msg.metadata.cost;
      }
    }

    return {
      totalMessages: this.messages.length,
      roleCount,
      duration: totalDuration,
      cost: totalCost
    };
  }

  /**
   * Save conversation to file
   * @param {string} filePath - Where to save
   */
  async saveToFile(filePath) {
    const fs = await import('fs/promises');
    const content = this.formatForDisplay();
    await fs.writeFile(filePath, content);
  }

  /**
   * CONSENSUS DETECTION METHODS
   */

  /**
   * Check if coder is ready to implement (after Q&A with architect)
   * @returns {boolean} - True if coder explicitly said ready
   */
  isReadyToImplement() {
    const coderMessages = this.getByRole('coder');
    if (coderMessages.length === 0) return false;

    const lastCoderMsg = coderMessages[coderMessages.length - 1].content.toLowerCase();

    const readyPhrases = [
      'ready to implement',
      'ready to proceed',
      'ready to start',
      'everything is clear',
      'all clear',
      'no further questions',
      'looks good to me'
    ];

    return readyPhrases.some(phrase => lastCoderMsg.includes(phrase));
  }

  /**
   * Check if reviewer approved the implementation
   * @returns {boolean} - True if reviewer approved
   */
  isApproved() {
    const reviewerMessages = this.getByRole('reviewer');
    if (reviewerMessages.length === 0) return false;

    const lastReviewMsg = reviewerMessages[reviewerMessages.length - 1].content.toLowerCase();

    const approvalPhrases = [
      'approved',
      'lgtm',
      'looks good to me',
      'no issues',
      'passes all criteria',
      'excellent work',
      'ready to merge',
      'implementation is correct'
    ];

    return approvalPhrases.some(phrase => lastReviewMsg.includes(phrase));
  }

  /**
   * Check if there are unresolved issues in reviewer feedback
   * @returns {boolean} - True if issues found
   */
  hasUnresolvedIssues() {
    const reviewerMessages = this.getByRole('reviewer');
    if (reviewerMessages.length === 0) return false;

    const lastReviewMsg = reviewerMessages[reviewerMessages.length - 1].content.toLowerCase();

    const issuePhrases = [
      'issue',
      'problem',
      'bug',
      'incorrect',
      'missing',
      'needs to be fixed',
      'must fix',
      'should fix',
      'error',
      'doesn\'t work',
      'fails',
      'revision needed'
    ];

    return issuePhrases.some(phrase => lastReviewMsg.includes(phrase));
  }

  /**
   * Detect general consensus across recent messages
   * @param {number} lookback - How many messages to analyze
   * @returns {Object} - { hasConsensus, confidence, reason }
   */
  detectConsensus(lookback = 5) {
    const recent = this.getRecent(lookback);

    // No consensus if we don't have enough messages
    if (recent.length < 2) {
      return { hasConsensus: false, confidence: 0, reason: 'Insufficient messages' };
    }

    const allContent = recent.map(m => m.content.toLowerCase()).join(' ');

    // Positive agreement patterns
    const agreementPhrases = [
      'agreed',
      'sounds good',
      'perfect',
      'excellent',
      'exactly',
      'correct',
      'yes',
      'absolutely'
    ];

    // Disagreement/uncertainty patterns
    const disagreementPhrases = [
      'however',
      'but',
      'concern',
      'worried',
      'not sure',
      'unclear',
      'confused',
      'disagree'
    ];

    const agreementCount = agreementPhrases.filter(p => allContent.includes(p)).length;
    const disagreementCount = disagreementPhrases.filter(p => allContent.includes(p)).length;
    const hasQuestions = this.hasRecentQuestions(lookback);

    // Calculate confidence
    let confidence = 0;
    let reason = '';

    if (agreementCount > 0 && disagreementCount === 0 && !hasQuestions) {
      confidence = Math.min(agreementCount * 0.3, 1.0);
      reason = 'Agreement detected, no questions or concerns';
    } else if (disagreementCount > 0 || hasQuestions) {
      confidence = 0;
      reason = 'Questions or concerns remain';
    } else {
      confidence = 0.3;
      reason = 'Neutral - no clear signals';
    }

    return {
      hasConsensus: confidence >= 0.6,
      confidence,
      reason
    };
  }

  /**
   * Determine if collaboration should continue for another round
   * @returns {Object} - { shouldContinue, reason }
   */
  shouldContinueCollaboration() {
    // Check if we're in implementation phase (has reviewer messages)
    const hasReviewer = this.getByRole('reviewer').length > 0;

    if (hasReviewer) {
      // After review phase
      if (this.isApproved()) {
        return { shouldContinue: false, reason: 'Reviewer approved implementation' };
      }

      if (this.hasUnresolvedIssues()) {
        return { shouldContinue: true, reason: 'Reviewer found issues needing fixes' };
      }
    }

    // Check if coder is ready after architect brief
    const hasCoder = this.getByRole('coder').length > 0;
    const hasArchitect = this.getByRole('architect').length > 0;

    if (hasArchitect && hasCoder) {
      if (this.isReadyToImplement()) {
        return { shouldContinue: false, reason: 'Coder ready to implement' };
      }

      if (this.hasRecentQuestions(2)) {
        return { shouldContinue: true, reason: 'Coder has questions for architect' };
      }
    }

    // Default: continue if uncertain
    return { shouldContinue: true, reason: 'Insufficient signals for consensus' };
  }

  /**
   * AGENT-TO-AGENT COMMUNICATION METHODS
   */

  /**
   * Check if recent message is a question directed at a specific agent
   * @param {number} lookback - How many recent messages to check
   * @returns {Object|null} - { from, to, content } or null
   */
  detectAgentQuestion(lookback = 2) {
    const recent = this.getRecent(lookback);

    for (const msg of recent.reverse()) {
      // Skip orchestrator messages
      if (msg.role === 'orchestrator') continue;

      const content = msg.content.toLowerCase();

      // Detect questions with agent addressing
      const patterns = [
        { pattern: /reviewer.*\?|@reviewer/i, to: 'reviewer' },
        { pattern: /coder.*\?|@coder/i, to: 'coder' },
        { pattern: /architect.*\?|@architect/i, to: 'architect' }
      ];

      for (const { pattern, to } of patterns) {
        if (pattern.test(msg.content) && msg.content.includes('?')) {
          return {
            from: msg.role,
            to: to,
            content: msg.content,
            timestamp: msg.timestamp
          };
        }
      }

      // Generic question detection (addressed to most recent other agent)
      if (msg.content.includes('?')) {
        // Find the agent they're responding to (previous non-same-role message)
        const previousAgents = recent
          .filter(m => m.role !== msg.role && m.role !== 'orchestrator' && m.timestamp < msg.timestamp);

        if (previousAgents.length > 0) {
          const targetAgent = previousAgents[previousAgents.length - 1];
          return {
            from: msg.role,
            to: targetAgent.role,
            content: msg.content,
            timestamp: msg.timestamp
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect if agents need to have a direct dialogue
   * @returns {Object|null} - { agent1, agent2, reason } or null
   */
  needsAgentDialogue() {
    const agentQuestion = this.detectAgentQuestion(3);

    if (agentQuestion) {
      return {
        agent1: agentQuestion.from,
        agent2: agentQuestion.to,
        reason: `${agentQuestion.from} has question for ${agentQuestion.to}`,
        question: agentQuestion
      };
    }

    // Check if reviewer has concerns that need clarification from coder
    const reviewerMessages = this.getByRole('reviewer');
    const coderMessages = this.getByRole('coder');

    if (reviewerMessages.length > 0 && coderMessages.length > 0) {
      const lastReview = reviewerMessages[reviewerMessages.length - 1];
      const concernPhrases = [
        'concern',
        'unclear',
        'not sure',
        'could you',
        'can you explain',
        'why did you',
        'question about'
      ];

      const hasConcerns = concernPhrases.some(phrase =>
        lastReview.content.toLowerCase().includes(phrase)
      );

      if (hasConcerns && !this.isApproved()) {
        return {
          agent1: 'reviewer',
          agent2: 'coder',
          reason: 'Reviewer has concerns needing clarification',
          question: null
        };
      }
    }

    return null;
  }

  /**
   * Format conversation context for agent-to-agent dialogue
   * @param {string} fromAgent - Agent initiating dialogue
   * @param {string} toAgent - Agent being addressed
   * @returns {string} - Formatted context
   */
  getAgentDialogueContext(fromAgent, toAgent) {
    const history = this.getHistory();
    const fromMessages = this.getByRole(fromAgent);
    const toMessages = this.getByRole(toAgent);

    return `**Full Conversation History:**
${history}

**Direct Dialogue Context:**
You (${toAgent}) are responding to ${fromAgent}.

Recent messages from ${fromAgent}:
${fromMessages.slice(-2).map(m => m.content).join('\n\n')}

Recent messages from you (${toAgent}):
${toMessages.slice(-2).map(m => m.content).join('\n\n')}

Please respond directly to ${fromAgent}'s questions or concerns.`;
  }

  /**
   * CONTEXT CACHING METHODS
   */

  /**
   * Cache a file's contents
   * @param {string} filePath - Path to the file
   * @param {string} content - File contents
   */
  cacheFile(filePath, content) {
    if (this.fileCache.has(filePath)) {
      // Update read count
      const cached = this.fileCache.get(filePath);
      cached.reads++;
      cached.lastRead = Date.now();
    } else {
      // First time caching this file
      this.fileCache.set(filePath, {
        content,
        firstRead: Date.now(),
        lastRead: Date.now(),
        reads: 1
      });
    }
  }

  /**
   * Get cached file contents
   * @param {string} filePath - Path to retrieve
   * @returns {string|null} - File contents or null if not cached
   */
  getCachedFile(filePath) {
    const cached = this.fileCache.get(filePath);
    if (cached) {
      cached.reads++;
      cached.lastRead = Date.now();
      return cached.content;
    }
    return null;
  }

  /**
   * Get cache statistics
   * @returns {Object} - Stats about cached files
   */
  getFileCacheStats() {
    const files = Array.from(this.fileCache.entries());
    return {
      totalFiles: files.length,
      totalReads: files.reduce((sum, [, data]) => sum + data.reads, 0),
      files: files.map(([path, data]) => ({
        path,
        size: data.content.length,
        reads: data.reads,
        saved: data.reads > 1 ? data.reads - 1 : 0 // How many redundant reads avoided
      }))
    };
  }

  /**
   * Get formatted cache summary for agents
   * @returns {string} - Human-readable cache summary
   */
  getFileCacheSummary() {
    const stats = this.getFileCacheStats();

    if (stats.totalFiles === 0) {
      return 'No files cached yet.';
    }

    let summary = `**Cached Files (${stats.totalFiles} total):**\n`;
    for (const file of stats.files) {
      const size = (file.size / 1024).toFixed(1);
      summary += `- ${file.path} (${size}KB, read ${file.reads}x`;
      if (file.saved > 0) {
        summary += `, saved ${file.saved} redundant read${file.saved > 1 ? 's' : ''}`;
      }
      summary += `)\n`;
    }

    return summary;
  }

  /**
   * Clear the file cache
   */
  clearFileCache() {
    this.fileCache.clear();
  }
}
