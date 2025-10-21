/**
 * CostMonitor - Tracks Anthropic API costs and enforces limits
 *
 * Pricing (as of 2025):
 * - Claude Sonnet 4: $3/MTok input, $15/MTok output
 * - 1 MTok = 1,000,000 tokens
 */

import chalk from 'chalk';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';

export class CostMonitor {
  constructor(maxCost) {
    this.maxCost = maxCost;
    this.totalCost = 0;
    this.usage = [];

    // Anthropic Claude Sonnet 4 pricing (2025)
    this.pricing = {
      inputCostPerMTok: 3.00,   // $3 per million tokens
      outputCostPerMTok: 15.00  // $15 per million tokens
    };
  }

  /**
   * Add API usage and calculate cost
   * @param {Object} usage - { inputTokens, outputTokens }
   * @throws {Error} - If cost limit exceeded
   */
  addUsage({ inputTokens, outputTokens }) {
    const inputCost = (inputTokens / 1_000_000) * this.pricing.inputCostPerMTok;
    const outputCost = (outputTokens / 1_000_000) * this.pricing.outputCostPerMTok;
    const cost = inputCost + outputCost;

    this.totalCost += cost;
    this.usage.push({
      inputTokens,
      outputTokens,
      cost,
      timestamp: new Date().toISOString()
    });

    // Check if approaching limit (75% threshold)
    if (this.totalCost >= this.maxCost * 0.75 && this.totalCost < this.maxCost) {
      console.log(chalk.yellow(
        `⚠️  Approaching cost limit: $${this.totalCost.toFixed(2)} / $${this.maxCost.toFixed(2)}`
      ));
    }

    // Enforce limit
    if (this.totalCost >= this.maxCost) {
      throw new Error(
        `Cost limit exceeded: $${this.totalCost.toFixed(2)} >= $${this.maxCost.toFixed(2)}\n` +
        `Please increase the max_cost_per_task in your project config or simplify the task.`
      );
    }

    return cost;
  }

  /**
   * Get total cost so far
   * @returns {number} - Total cost in dollars
   */
  getTotalCost() {
    return this.totalCost;
  }

  /**
   * Get detailed usage breakdown
   * @returns {Object} - { total, calls, details }
   */
  getUsageBreakdown() {
    return {
      total: this.totalCost,
      calls: this.usage.length,
      details: this.usage,
      averageCostPerCall: this.usage.length > 0
        ? this.totalCost / this.usage.length
        : 0
    };
  }

  /**
   * Get formatted cost summary
   * @returns {string} - Human-readable cost summary
   */
  getSummary() {
    const totalInputTokens = this.usage.reduce((sum, u) => sum + u.inputTokens, 0);
    const totalOutputTokens = this.usage.reduce((sum, u) => sum + u.outputTokens, 0);

    return [
      `Total Cost: $${this.totalCost.toFixed(4)}`,
      `API Calls: ${this.usage.length}`,
      `Input Tokens: ${totalInputTokens.toLocaleString()}`,
      `Output Tokens: ${totalOutputTokens.toLocaleString()}`,
      `Average per Call: $${(this.totalCost / this.usage.length || 0).toFixed(4)}`,
      `Limit: $${this.maxCost.toFixed(2)} (${((this.totalCost / this.maxCost) * 100).toFixed(1)}% used)`
    ].join('\n');
  }

  /**
   * Check if cost is within budget
   * @param {number} percentThreshold - Percentage threshold (default: 100)
   * @returns {boolean} - True if within budget
   */
  isWithinBudget(percentThreshold = 100) {
    return (this.totalCost / this.maxCost) * 100 < percentThreshold;
  }

  /**
   * Get remaining budget
   * @returns {number} - Remaining budget in dollars
   */
  getRemainingBudget() {
    return Math.max(0, this.maxCost - this.totalCost);
  }

  /**
   * Estimate cost for given token counts
   * @param {number} inputTokens - Estimated input tokens
   * @param {number} outputTokens - Estimated output tokens
   * @returns {number} - Estimated cost in dollars
   */
  estimateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1_000_000) * this.pricing.inputCostPerMTok;
    const outputCost = (outputTokens / 1_000_000) * this.pricing.outputCostPerMTok;
    return inputCost + outputCost;
  }

  /**
   * Save cost data to file
   * @param {string} taskId - Task identifier
   */
  async save(taskId) {
    const costDir = path.join(homedir(), '.claude-logs', 'costs');
    await fs.mkdir(costDir, { recursive: true });

    const data = {
      taskId,
      timestamp: new Date().toISOString(),
      totalCost: this.totalCost,
      maxCost: this.maxCost,
      usage: this.usage,
      breakdown: this.getUsageBreakdown()
    };

    const filePath = path.join(costDir, `${taskId}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    return filePath;
  }

  /**
   * Load cost data from file
   * @param {string} taskId - Task identifier
   * @returns {Promise<CostMonitor>} - Restored CostMonitor instance
   */
  static async load(taskId) {
    const costDir = path.join(homedir(), '.claude-logs', 'costs');
    const filePath = path.join(costDir, `${taskId}.json`);

    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const monitor = new CostMonitor(data.maxCost);
    monitor.totalCost = data.totalCost;
    monitor.usage = data.usage;

    return monitor;
  }

  /**
   * Get historical cost data (all tasks)
   * @returns {Promise<Array>} - Array of cost data objects
   */
  static async getHistory() {
    const costDir = path.join(homedir(), '.claude-logs', 'costs');

    try {
      const files = await fs.readdir(costDir);
      const costFiles = files.filter(f => f.endsWith('.json'));

      const history = [];
      for (const file of costFiles) {
        const content = await fs.readFile(path.join(costDir, file), 'utf-8');
        history.push(JSON.parse(content));
      }

      // Sort by timestamp, newest first
      return history.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      // Directory doesn't exist yet
      return [];
    }
  }

  /**
   * Get cost statistics
   * @returns {Promise<Object>} - Statistics object
   */
  static async getStatistics() {
    const history = await CostMonitor.getHistory();

    if (history.length === 0) {
      return {
        totalTasks: 0,
        totalSpent: 0,
        averageCostPerTask: 0,
        minCost: 0,
        maxCost: 0
      };
    }

    const costs = history.map(h => h.totalCost);
    const totalSpent = costs.reduce((sum, c) => sum + c, 0);

    return {
      totalTasks: history.length,
      totalSpent,
      averageCostPerTask: totalSpent / history.length,
      minCost: Math.min(...costs),
      maxCost: Math.max(...costs),
      last7Days: history
        .filter(h => {
          const age = Date.now() - new Date(h.timestamp).getTime();
          return age < 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        })
        .reduce((sum, h) => sum + h.totalCost, 0)
    };
  }

  /**
   * Display cost summary to console
   */
  display() {
    console.log(chalk.cyan.bold('\n💰 Cost Summary'));
    console.log(chalk.cyan('─'.repeat(50)));
    console.log(this.getSummary());
    console.log(chalk.cyan('─'.repeat(50)));
  }
}
