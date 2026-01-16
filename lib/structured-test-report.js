/**
 * Structured Test Report Generator
 *
 * Generates comprehensive test reports that include:
 * - MCP tool calls with parameters and results
 * - Agent decision audit trails
 * - Success criteria mapping to specific actions
 * - Performance metrics and cost analysis
 * - Visual decision flow diagrams
 *
 * Priority 3: Structured Test Reports Implementation
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Report section types
 */
export const SectionType = {
  SUMMARY: 'summary',
  MCP_CALLS: 'mcp_calls',
  DECISION_TRAIL: 'decision_trail',
  CRITERIA_MAPPING: 'criteria_mapping',
  ARTIFACTS: 'artifacts',
  METRICS: 'metrics',
  TIMELINE: 'timeline',
  RECOMMENDATIONS: 'recommendations'
};

/**
 * Structured Test Report class
 */
export class StructuredTestReport {
  constructor(testConfig) {
    this.testId = testConfig.testId || `test-${Date.now()}`;
    this.testName = testConfig.testName || 'Unnamed Test';
    this.description = testConfig.description || '';
    this.startedAt = new Date().toISOString();
    this.completedAt = null;
    this.status = 'running';

    // Test configuration
    this.config = {
      taskPrompt: testConfig.taskPrompt,
      expectedArtifacts: testConfig.expectedArtifacts || [],
      successCriteria: testConfig.successCriteria || [],
      requiredSnTools: testConfig.requiredSnTools || [],
      estimatedTime: testConfig.estimatedTime,
      estimatedCost: testConfig.estimatedCost
    };

    // Report sections
    this.sections = {
      summary: null,
      mcpCalls: [],
      decisionTrail: [],
      criteriaMapping: [],
      artifacts: [],
      metrics: {
        totalDurationMs: 0,
        totalCost: 0,
        conversationTurns: 0,
        mcpToolCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        truncatedResponses: 0
      },
      timeline: [],
      recommendations: []
    };

    // Raw data for detailed analysis
    this.rawData = {
      conversationHistory: [],
      mcpTraces: [],
      auditDecisions: [],
      agentResponses: []
    };
  }

  /**
   * Add an MCP tool call to the report
   */
  addMcpCall(mcpCallData) {
    const call = {
      id: mcpCallData.id || `mcp-${Date.now()}`,
      timestamp: mcpCallData.timestamp || new Date().toISOString(),
      toolName: mcpCallData.toolName,
      parameters: mcpCallData.parameters,
      result: {
        success: mcpCallData.success,
        responseSizeKB: mcpCallData.responseSizeKB,
        truncated: mcpCallData.truncated,
        executionTimeMs: mcpCallData.executionTimeMs
      },
      aiContext: mcpCallData.aiContext || null,
      relatedDecisionId: mcpCallData.relatedDecisionId || null
    };

    this.sections.mcpCalls.push(call);

    // Update metrics
    this.sections.metrics.mcpToolCalls++;
    if (call.result.success) {
      this.sections.metrics.successfulCalls++;
    } else {
      this.sections.metrics.failedCalls++;
    }
    if (call.result.truncated) {
      this.sections.metrics.truncatedResponses++;
    }

    // Add to timeline
    this.addTimelineEvent('mcp_call', `Tool: ${call.toolName}`, call.timestamp);

    return call;
  }

  /**
   * Add a decision from the audit trail
   */
  addDecision(decisionData) {
    const decision = {
      id: decisionData.id,
      timestamp: decisionData.timestamp,
      type: decisionData.type,
      agentRole: decisionData.agentRole,
      action: decisionData.decision?.action,
      target: decisionData.decision?.target,
      reasoning: decisionData.decision?.reasoning,
      outcome: decisionData.outcome?.status,
      durationMs: decisionData.outcome?.durationMs,
      context: {
        promptSummary: decisionData.context?.promptSummary?.slice(0, 200),
        conversationTurn: decisionData.context?.conversationTurn
      }
    };

    this.sections.decisionTrail.push(decision);

    // Add to timeline
    this.addTimelineEvent('decision', `${decision.action} → ${decision.target}`, decision.timestamp);

    return decision;
  }

  /**
   * Add a conversation turn
   */
  addConversationTurn(turnData) {
    this.rawData.conversationHistory.push({
      turn: turnData.turn,
      timestamp: turnData.timestamp || new Date().toISOString(),
      promptSummary: this._summarizeText(turnData.prompt, 300),
      responseSummary: this._summarizeText(turnData.response, 500),
      mcpCallsInTurn: turnData.mcpCalls || [],
      decisionsInTurn: turnData.decisions || []
    });

    this.sections.metrics.conversationTurns++;
  }

  /**
   * Map success criteria to actions
   */
  mapCriteriaToActions(criteria, actions) {
    const mapping = {
      criterion: criteria,
      matched: false,
      matchedActions: [],
      evidence: []
    };

    // Search for evidence in MCP calls
    for (const call of this.sections.mcpCalls) {
      if (this._criterionMatchesMcpCall(criteria, call)) {
        mapping.matched = true;
        mapping.matchedActions.push({
          type: 'mcp_call',
          id: call.id,
          toolName: call.toolName,
          timestamp: call.timestamp
        });
        mapping.evidence.push(`MCP tool ${call.toolName} was called`);
      }
    }

    // Search for evidence in decisions
    for (const decision of this.sections.decisionTrail) {
      if (this._criterionMatchesDecision(criteria, decision)) {
        mapping.matched = true;
        mapping.matchedActions.push({
          type: 'decision',
          id: decision.id,
          action: decision.action,
          timestamp: decision.timestamp
        });
        mapping.evidence.push(`Decision made: ${decision.action}`);
      }
    }

    // Search for evidence in artifacts
    for (const artifact of this.sections.artifacts) {
      if (this._criterionMatchesArtifact(criteria, artifact)) {
        mapping.matched = true;
        mapping.matchedActions.push({
          type: 'artifact',
          path: artifact.path,
          timestamp: artifact.created
        });
        mapping.evidence.push(`Artifact created: ${artifact.path}`);
      }
    }

    this.sections.criteriaMapping.push(mapping);
    return mapping;
  }

  /**
   * Check if criterion matches an MCP call
   */
  _criterionMatchesMcpCall(criterion, call) {
    const criterionLower = criterion.toLowerCase();
    const toolLower = call.toolName.toLowerCase();

    // Direct tool name match
    if (criterionLower.includes(toolLower) || criterionLower.includes(toolLower.replace(/_/g, ' '))) {
      return true;
    }

    // Common patterns
    const patterns = {
      'trace': ['trace_component_impact', 'trace_table_dependencies', 'trace_full_lineage'],
      'impact': ['trace_component_impact', 'validate_change_impact'],
      'dependency': ['trace_table_dependencies', 'trace_full_lineage'],
      'schema': ['query_table_schema'],
      'crud': ['analyze_script_crud'],
      'validate': ['validate_change_impact'],
      'api': ['trace_component_impact', 'trace_full_lineage'],
      'table': ['trace_table_dependencies', 'query_table_schema']
    };

    for (const [keyword, tools] of Object.entries(patterns)) {
      if (criterionLower.includes(keyword) && tools.includes(call.toolName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if criterion matches a decision
   */
  _criterionMatchesDecision(criterion, decision) {
    const criterionLower = criterion.toLowerCase();

    if (decision.action && criterionLower.includes(decision.action.toLowerCase())) {
      return true;
    }

    if (decision.target && criterionLower.includes(decision.target.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Check if criterion matches an artifact
   */
  _criterionMatchesArtifact(criterion, artifact) {
    const criterionLower = criterion.toLowerCase();
    const pathLower = artifact.path.toLowerCase();

    // Check for file path mentions
    if (criterionLower.includes(path.basename(pathLower))) {
      return true;
    }

    // Check for document type mentions
    if (criterionLower.includes('analysis') && pathLower.includes('analysis')) {
      return true;
    }
    if (criterionLower.includes('report') && pathLower.includes('report')) {
      return true;
    }
    if (criterionLower.includes('document') && (pathLower.endsWith('.md') || pathLower.endsWith('.txt'))) {
      return true;
    }

    return false;
  }

  /**
   * Add an artifact
   */
  addArtifact(artifactData) {
    const artifact = {
      path: artifactData.path,
      type: this._getArtifactType(artifactData.path),
      size: artifactData.size,
      created: artifactData.created || new Date().toISOString(),
      contentSummary: artifactData.contentSummary || null,
      expected: this.config.expectedArtifacts.some(e =>
        artifactData.path.includes(e) || e.includes(path.basename(artifactData.path))
      )
    };

    this.sections.artifacts.push(artifact);

    // Add to timeline
    this.addTimelineEvent('artifact', `Created: ${path.basename(artifact.path)}`, artifact.created);

    return artifact;
  }

  /**
   * Get artifact type from path
   */
  _getArtifactType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.md': 'markdown',
      '.json': 'json',
      '.txt': 'text',
      '.html': 'html',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python'
    };
    return types[ext] || 'unknown';
  }

  /**
   * Add a timeline event
   */
  addTimelineEvent(type, description, timestamp) {
    this.sections.timeline.push({
      type,
      description,
      timestamp: timestamp || new Date().toISOString()
    });

    // Sort timeline by timestamp
    this.sections.timeline.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  /**
   * Add a recommendation
   */
  addRecommendation(recommendation) {
    this.sections.recommendations.push({
      id: `rec-${this.sections.recommendations.length + 1}`,
      type: recommendation.type || 'general',
      priority: recommendation.priority || 'medium',
      title: recommendation.title,
      description: recommendation.description,
      evidence: recommendation.evidence || []
    });
  }

  /**
   * Set final metrics
   */
  setMetrics(metricsData) {
    this.sections.metrics = {
      ...this.sections.metrics,
      ...metricsData
    };
  }

  /**
   * Complete the report
   */
  complete(success, summary = null) {
    this.completedAt = new Date().toISOString();
    this.status = success ? 'passed' : 'failed';

    // Calculate duration
    this.sections.metrics.totalDurationMs =
      new Date(this.completedAt) - new Date(this.startedAt);

    // Generate summary
    this.sections.summary = summary || this._generateSummary();

    // Generate recommendations based on analysis
    this._generateRecommendations();

    // Map all criteria
    for (const criterion of this.config.successCriteria) {
      if (!this.sections.criteriaMapping.find(m => m.criterion === criterion)) {
        this.mapCriteriaToActions(criterion, []);
      }
    }
  }

  /**
   * Generate automatic summary
   */
  _generateSummary() {
    const criteriaMatched = this.sections.criteriaMapping.filter(m => m.matched).length;
    const totalCriteria = this.config.successCriteria.length;

    return {
      testId: this.testId,
      testName: this.testName,
      status: this.status,
      duration: `${Math.round(this.sections.metrics.totalDurationMs / 1000)}s`,
      cost: `$${this.sections.metrics.totalCost.toFixed(4)}`,
      criteriaScore: `${criteriaMatched}/${totalCriteria}`,
      criteriaPercentage: totalCriteria > 0 ? Math.round((criteriaMatched / totalCriteria) * 100) : 0,
      mcpToolCalls: this.sections.metrics.mcpToolCalls,
      conversationTurns: this.sections.metrics.conversationTurns,
      artifactsCreated: this.sections.artifacts.length,
      expectedArtifacts: this.config.expectedArtifacts.length,
      keyFindings: this._extractKeyFindings()
    };
  }

  /**
   * Extract key findings from the report
   */
  _extractKeyFindings() {
    const findings = [];

    // Check for truncation issues
    if (this.sections.metrics.truncatedResponses > 0) {
      findings.push({
        type: 'warning',
        message: `${this.sections.metrics.truncatedResponses} MCP responses were truncated due to size`
      });
    }

    // Check for failed calls
    if (this.sections.metrics.failedCalls > 0) {
      findings.push({
        type: 'error',
        message: `${this.sections.metrics.failedCalls} MCP tool calls failed`
      });
    }

    // Check for missing criteria
    const unmatchedCriteria = this.sections.criteriaMapping.filter(m => !m.matched);
    if (unmatchedCriteria.length > 0) {
      findings.push({
        type: 'warning',
        message: `${unmatchedCriteria.length} success criteria could not be mapped to actions`
      });
    }

    // Check for missing expected artifacts
    const missingArtifacts = this.config.expectedArtifacts.filter(expected =>
      !this.sections.artifacts.some(a => a.path.includes(expected) || expected.includes(path.basename(a.path)))
    );
    if (missingArtifacts.length > 0) {
      findings.push({
        type: 'error',
        message: `${missingArtifacts.length} expected artifacts were not created`
      });
    }

    return findings;
  }

  /**
   * Generate recommendations based on analysis
   */
  _generateRecommendations() {
    // Check for high truncation rate
    if (this.sections.metrics.mcpToolCalls > 0) {
      const truncationRate = this.sections.metrics.truncatedResponses / this.sections.metrics.mcpToolCalls;
      if (truncationRate > 0.3) {
        this.addRecommendation({
          type: 'performance',
          priority: 'high',
          title: 'High MCP Response Truncation Rate',
          description: `${Math.round(truncationRate * 100)}% of MCP responses were truncated. Consider using more targeted queries or increasing response size limits.`,
          evidence: this.sections.mcpCalls.filter(c => c.result.truncated).map(c => c.toolName)
        });
      }
    }

    // Check for low criteria match rate
    const matchedCriteria = this.sections.criteriaMapping.filter(m => m.matched);
    if (this.config.successCriteria.length > 0) {
      const matchRate = matchedCriteria.length / this.config.successCriteria.length;
      if (matchRate < 0.7) {
        this.addRecommendation({
          type: 'coverage',
          priority: 'high',
          title: 'Low Success Criteria Coverage',
          description: `Only ${Math.round(matchRate * 100)}% of success criteria were matched to actions. Review unmatched criteria to improve test coverage.`,
          evidence: this.sections.criteriaMapping.filter(m => !m.matched).map(m => m.criterion)
        });
      }
    }

    // Check for long execution time
    if (this.sections.metrics.totalDurationMs > 300000) { // > 5 minutes
      this.addRecommendation({
        type: 'performance',
        priority: 'medium',
        title: 'Long Test Execution Time',
        description: `Test took ${Math.round(this.sections.metrics.totalDurationMs / 60000)} minutes to complete. Consider optimizing prompts or breaking into smaller tests.`
      });
    }
  }

  /**
   * Summarize text to a max length
   */
  _summarizeText(text, maxLength) {
    if (!text) return null;
    if (typeof text !== 'string') text = JSON.stringify(text);
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  /**
   * Export report as JSON
   */
  toJSON() {
    return {
      testId: this.testId,
      testName: this.testName,
      description: this.description,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      config: this.config,
      sections: this.sections
    };
  }

  /**
   * Export report as Markdown
   */
  toMarkdown() {
    let md = '';

    // Header
    md += `# Test Report: ${this.testName}\n\n`;
    md += `**Test ID:** ${this.testId}\n`;
    md += `**Status:** ${this.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
    md += `**Duration:** ${Math.round(this.sections.metrics.totalDurationMs / 1000)}s\n`;
    md += `**Cost:** $${this.sections.metrics.totalCost.toFixed(4)}\n\n`;

    // Summary
    if (this.sections.summary) {
      md += `## Summary\n\n`;
      md += `- **Criteria Score:** ${this.sections.summary.criteriaScore} (${this.sections.summary.criteriaPercentage}%)\n`;
      md += `- **MCP Tool Calls:** ${this.sections.summary.mcpToolCalls}\n`;
      md += `- **Conversation Turns:** ${this.sections.summary.conversationTurns}\n`;
      md += `- **Artifacts Created:** ${this.sections.summary.artifactsCreated}/${this.sections.summary.expectedArtifacts}\n\n`;

      if (this.sections.summary.keyFindings.length > 0) {
        md += `### Key Findings\n\n`;
        for (const finding of this.sections.summary.keyFindings) {
          const icon = finding.type === 'error' ? '❌' : finding.type === 'warning' ? '⚠️' : 'ℹ️';
          md += `- ${icon} ${finding.message}\n`;
        }
        md += '\n';
      }
    }

    // MCP Tool Calls
    if (this.sections.mcpCalls.length > 0) {
      md += `## MCP Tool Calls\n\n`;
      md += `| Tool | Parameters | Success | Time | Size |\n`;
      md += `|------|------------|---------|------|------|\n`;
      for (const call of this.sections.mcpCalls) {
        const params = JSON.stringify(call.parameters).slice(0, 50);
        const success = call.result.success ? '✅' : '❌';
        md += `| ${call.toolName} | ${params}... | ${success} | ${call.result.executionTimeMs}ms | ${call.result.responseSizeKB}KB |\n`;
      }
      md += '\n';
    }

    // Decision Trail
    if (this.sections.decisionTrail.length > 0) {
      md += `## Decision Trail\n\n`;
      for (const decision of this.sections.decisionTrail) {
        const outcome = decision.outcome === 'success' ? '✅' : decision.outcome === 'failed' ? '❌' : '○';
        md += `### ${outcome} ${decision.action} → ${decision.target}\n\n`;
        md += `- **Type:** ${decision.type}\n`;
        md += `- **Agent:** ${decision.agentRole}\n`;
        md += `- **Duration:** ${decision.durationMs}ms\n`;
        if (decision.reasoning) {
          md += `- **Reasoning:** ${decision.reasoning.slice(0, 200)}...\n`;
        }
        md += '\n';
      }
    }

    // Criteria Mapping
    if (this.sections.criteriaMapping.length > 0) {
      md += `## Success Criteria Mapping\n\n`;
      for (const mapping of this.sections.criteriaMapping) {
        const icon = mapping.matched ? '✅' : '❌';
        md += `### ${icon} ${mapping.criterion}\n\n`;
        if (mapping.matched) {
          md += `**Evidence:**\n`;
          for (const evidence of mapping.evidence) {
            md += `- ${evidence}\n`;
          }
        } else {
          md += `*No matching actions found*\n`;
        }
        md += '\n';
      }
    }

    // Artifacts
    if (this.sections.artifacts.length > 0) {
      md += `## Artifacts\n\n`;
      md += `| Path | Type | Size | Expected |\n`;
      md += `|------|------|------|----------|\n`;
      for (const artifact of this.sections.artifacts) {
        const expected = artifact.expected ? '✅' : '➕';
        md += `| ${artifact.path} | ${artifact.type} | ${artifact.size} | ${expected} |\n`;
      }
      md += '\n';
    }

    // Timeline
    if (this.sections.timeline.length > 0) {
      md += `## Timeline\n\n`;
      md += '```\n';
      for (const event of this.sections.timeline) {
        const time = new Date(event.timestamp).toISOString().slice(11, 19);
        md += `[${time}] ${event.type}: ${event.description}\n`;
      }
      md += '```\n\n';
    }

    // Recommendations
    if (this.sections.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      for (const rec of this.sections.recommendations) {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        md += `### ${priority} ${rec.title}\n\n`;
        md += `${rec.description}\n\n`;
        if (rec.evidence && rec.evidence.length > 0) {
          md += `**Evidence:**\n`;
          for (const e of rec.evidence.slice(0, 5)) {
            md += `- ${e}\n`;
          }
          md += '\n';
        }
      }
    }

    return md;
  }

  /**
   * Save report to file
   */
  async saveToFile(outputDir, format = 'both') {
    const basePath = path.join(outputDir, `test-report-${this.testId}`);

    const savedFiles = [];

    if (format === 'json' || format === 'both') {
      const jsonPath = `${basePath}.json`;
      await fs.writeFile(jsonPath, JSON.stringify(this.toJSON(), null, 2));
      savedFiles.push(jsonPath);
    }

    if (format === 'markdown' || format === 'both') {
      const mdPath = `${basePath}.md`;
      await fs.writeFile(mdPath, this.toMarkdown());
      savedFiles.push(mdPath);
    }

    return savedFiles;
  }
}

/**
 * Report generator that integrates with test execution
 */
export class TestReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || process.cwd();
    this.reports = new Map();
  }

  /**
   * Create a new report for a test
   */
  createReport(testConfig) {
    const report = new StructuredTestReport(testConfig);
    this.reports.set(report.testId, report);
    return report;
  }

  /**
   * Get a report by test ID
   */
  getReport(testId) {
    return this.reports.get(testId);
  }

  /**
   * Populate report from conversation history and audit trail
   */
  populateFromExecution(report, executionData) {
    // Add MCP calls from traces
    if (executionData.mcpTraces) {
      for (const trace of executionData.mcpTraces) {
        report.addMcpCall({
          id: trace.id,
          timestamp: trace.timestamp,
          toolName: trace.toolName,
          parameters: trace.params,
          success: trace.status === 'completed',
          responseSizeKB: trace.metrics?.responseSizeKB || 0,
          truncated: trace.metrics?.truncated || false,
          executionTimeMs: trace.metrics?.executionTimeMs || 0,
          aiContext: trace.context?.aiContext
        });
      }
    }

    // Add decisions from audit trail
    if (executionData.auditDecisions) {
      for (const decision of executionData.auditDecisions) {
        report.addDecision(decision);
      }
    }

    // Add conversation turns
    if (executionData.conversationHistory) {
      for (const turn of executionData.conversationHistory) {
        report.addConversationTurn(turn);
      }
    }

    // Add artifacts
    if (executionData.artifacts) {
      for (const artifact of executionData.artifacts) {
        report.addArtifact(artifact);
      }
    }

    // Set metrics
    if (executionData.metrics) {
      report.setMetrics(executionData.metrics);
    }

    return report;
  }

  /**
   * Generate summary report for multiple tests
   */
  generateSummaryReport() {
    const reports = Array.from(this.reports.values());

    const summary = {
      generatedAt: new Date().toISOString(),
      totalTests: reports.length,
      passed: reports.filter(r => r.status === 'passed').length,
      failed: reports.filter(r => r.status === 'failed').length,
      running: reports.filter(r => r.status === 'running').length,
      totalDurationMs: reports.reduce((sum, r) => sum + (r.sections.metrics?.totalDurationMs || 0), 0),
      totalCost: reports.reduce((sum, r) => sum + (r.sections.metrics?.totalCost || 0), 0),
      totalMcpCalls: reports.reduce((sum, r) => sum + (r.sections.mcpCalls?.length || 0), 0),
      reports: reports.map(r => ({
        testId: r.testId,
        testName: r.testName,
        status: r.status,
        durationMs: r.sections.metrics?.totalDurationMs,
        cost: r.sections.metrics?.totalCost,
        criteriaMatched: r.sections.criteriaMapping?.filter(m => m.matched).length || 0,
        totalCriteria: r.config.successCriteria?.length || 0
      }))
    };

    return summary;
  }
}

export default StructuredTestReport;
