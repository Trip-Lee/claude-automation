/**
 * Interactive Replay System
 *
 * Enables stepping through agent decisions and conversations post-hoc:
 * - Load and replay test sessions
 * - Step through conversation turns
 * - Inspect MCP tool calls and responses
 * - Analyze decision points
 * - Export filtered views
 *
 * Priority 4: Interactive Replay Implementation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * Replay event types
 */
export const ReplayEventType = {
  CONVERSATION_TURN: 'conversation_turn',
  MCP_CALL: 'mcp_call',
  DECISION: 'decision',
  ARTIFACT_CREATED: 'artifact_created',
  ERROR: 'error',
  CHECKPOINT: 'checkpoint'
};

/**
 * Replay state
 */
export const ReplayState = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STEPPING: 'stepping',
  COMPLETED: 'completed'
};

/**
 * Single replay event
 */
class ReplayEvent {
  constructor(type, data, timestamp) {
    this.id = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.timestamp = timestamp || new Date().toISOString();
    this.timestampMs = new Date(this.timestamp).getTime();
    this.data = data;
    this.metadata = {};
  }

  /**
   * Add metadata to event
   */
  addMetadata(key, value) {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Get a summary of the event
   */
  getSummary() {
    switch (this.type) {
      case ReplayEventType.CONVERSATION_TURN:
        return `Turn ${this.data.turn}: ${this.data.promptSummary?.slice(0, 50) || 'No prompt'}...`;
      case ReplayEventType.MCP_CALL:
        return `MCP: ${this.data.toolName}(${JSON.stringify(this.data.parameters).slice(0, 30)}...)`;
      case ReplayEventType.DECISION:
        return `Decision: ${this.data.action} → ${this.data.target}`;
      case ReplayEventType.ARTIFACT_CREATED:
        return `Artifact: ${this.data.path}`;
      case ReplayEventType.ERROR:
        return `Error: ${this.data.message?.slice(0, 50)}`;
      case ReplayEventType.CHECKPOINT:
        return `Checkpoint: ${this.data.name}`;
      default:
        return `Event: ${this.type}`;
    }
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      timestampMs: this.timestampMs,
      data: this.data,
      metadata: this.metadata,
      summary: this.getSummary()
    };
  }
}

/**
 * Interactive Replay Session
 */
export class ReplaySession extends EventEmitter {
  constructor(options = {}) {
    super();

    this.sessionId = options.sessionId || `replay-${Date.now()}`;
    this.sourceFile = options.sourceFile || null;
    this.events = [];
    this.currentIndex = -1;
    this.state = ReplayState.IDLE;

    // Playback options
    this.playbackSpeed = options.playbackSpeed || 1.0;
    this.autoAdvance = options.autoAdvance || false;

    // Filters
    this.filters = {
      eventTypes: null,  // null = all types
      timeRange: null,   // { start, end } timestamps
      searchQuery: null
    };

    // Bookmarks
    this.bookmarks = [];

    // Loaded data references
    this.loadedData = {
      conversationHistory: null,
      mcpTraces: null,
      auditDecisions: null,
      structuredReport: null
    };
  }

  /**
   * Load replay data from a test output directory
   */
  async loadFromDirectory(outputDir) {
    this.events = [];

    // Try to load various data sources
    const files = await fs.readdir(outputDir);

    // Load conversation history
    if (files.includes('conversation.json')) {
      const content = await fs.readFile(path.join(outputDir, 'conversation.json'), 'utf-8');
      this.loadedData.conversationHistory = JSON.parse(content);
      this._processConversationHistory(this.loadedData.conversationHistory);
    }

    // Load MCP metrics
    if (files.includes('mcp-metrics.json')) {
      const content = await fs.readFile(path.join(outputDir, 'mcp-metrics.json'), 'utf-8');
      const metrics = JSON.parse(content);
      // MCP metrics are aggregate, individual calls are in conversation
    }

    // Load structured report
    const reportFiles = files.filter(f => f.startsWith('test-report-') && f.endsWith('.json'));
    if (reportFiles.length > 0) {
      const content = await fs.readFile(path.join(outputDir, reportFiles[0]), 'utf-8');
      this.loadedData.structuredReport = JSON.parse(content);
      this._processStructuredReport(this.loadedData.structuredReport);
    }

    // Load audit trail if present
    const auditFiles = files.filter(f => f.startsWith('agent-audit-') && f.endsWith('.json'));
    if (auditFiles.length > 0) {
      const content = await fs.readFile(path.join(outputDir, auditFiles[0]), 'utf-8');
      this.loadedData.auditDecisions = JSON.parse(content);
      this._processAuditDecisions(this.loadedData.auditDecisions);
    }

    // Load MCP traces if present
    const traceFiles = files.filter(f => f.startsWith('mcp-traces-') && f.endsWith('.json'));
    if (traceFiles.length > 0) {
      const content = await fs.readFile(path.join(outputDir, traceFiles[0]), 'utf-8');
      this.loadedData.mcpTraces = JSON.parse(content);
      this._processMcpTraces(this.loadedData.mcpTraces);
    }

    // Sort events by timestamp
    this.events.sort((a, b) => a.timestampMs - b.timestampMs);

    this.sourceFile = outputDir;
    this.state = ReplayState.IDLE;

    this.emit('loaded', {
      eventCount: this.events.length,
      sourceFile: outputDir
    });

    return this;
  }

  /**
   * Process conversation history into events
   */
  _processConversationHistory(history) {
    for (const turn of history) {
      const event = new ReplayEvent(
        ReplayEventType.CONVERSATION_TURN,
        {
          turn: turn.turn,
          promptSummary: this._summarize(turn.prompt, 200),
          responseSummary: this._summarize(
            turn.response?.response || turn.response,
            500
          ),
          fullPrompt: turn.prompt,
          fullResponse: turn.response,
          cost: turn.response?.cost,
          mcpToolCalls: turn.response?.mcpToolCalls
        },
        turn.timestamp
      );

      this.events.push(event);

      // Extract MCP calls from turn
      if (turn.response?.mcpToolCalls) {
        for (const call of turn.response.mcpToolCalls) {
          const mcpEvent = new ReplayEvent(
            ReplayEventType.MCP_CALL,
            {
              ...call,
              conversationTurn: turn.turn
            },
            call.timestamp || turn.timestamp
          );
          this.events.push(mcpEvent);
        }
      }
    }
  }

  /**
   * Process structured report into events
   */
  _processStructuredReport(report) {
    // Process MCP calls
    if (report.sections?.mcpCalls) {
      for (const call of report.sections.mcpCalls) {
        // Avoid duplicates if already added from conversation
        const exists = this.events.find(e =>
          e.type === ReplayEventType.MCP_CALL && e.data.id === call.id
        );
        if (!exists) {
          this.events.push(new ReplayEvent(
            ReplayEventType.MCP_CALL,
            call,
            call.timestamp
          ));
        }
      }
    }

    // Process decisions
    if (report.sections?.decisionTrail) {
      for (const decision of report.sections.decisionTrail) {
        this.events.push(new ReplayEvent(
          ReplayEventType.DECISION,
          decision,
          decision.timestamp
        ));
      }
    }

    // Process artifacts
    if (report.sections?.artifacts) {
      for (const artifact of report.sections.artifacts) {
        this.events.push(new ReplayEvent(
          ReplayEventType.ARTIFACT_CREATED,
          artifact,
          artifact.created
        ));
      }
    }

    // Process timeline events as checkpoints
    if (report.sections?.timeline) {
      for (const event of report.sections.timeline) {
        this.events.push(new ReplayEvent(
          ReplayEventType.CHECKPOINT,
          { name: event.description, type: event.type },
          event.timestamp
        ));
      }
    }
  }

  /**
   * Process audit decisions into events
   */
  _processAuditDecisions(auditData) {
    if (auditData.decisions) {
      for (const decision of auditData.decisions) {
        const exists = this.events.find(e =>
          e.type === ReplayEventType.DECISION && e.data.id === decision.id
        );
        if (!exists) {
          this.events.push(new ReplayEvent(
            ReplayEventType.DECISION,
            decision,
            decision.timestamp
          ));
        }
      }
    }
  }

  /**
   * Process MCP traces into events
   */
  _processMcpTraces(traceData) {
    if (traceData.traces) {
      for (const trace of traceData.traces) {
        const exists = this.events.find(e =>
          e.type === ReplayEventType.MCP_CALL && e.data.id === trace.id
        );
        if (!exists) {
          this.events.push(new ReplayEvent(
            ReplayEventType.MCP_CALL,
            {
              id: trace.id,
              toolName: trace.toolName,
              parameters: trace.params,
              result: trace.response,
              metrics: trace.metrics,
              context: trace.context
            },
            trace.timestamp
          ));
        }
      }
    }
  }

  /**
   * Summarize text
   */
  _summarize(text, maxLength) {
    if (!text) return null;
    if (typeof text !== 'string') text = JSON.stringify(text);
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  /**
   * Get filtered events
   */
  getFilteredEvents() {
    let filtered = [...this.events];

    // Filter by event types
    if (this.filters.eventTypes && this.filters.eventTypes.length > 0) {
      filtered = filtered.filter(e => this.filters.eventTypes.includes(e.type));
    }

    // Filter by time range
    if (this.filters.timeRange) {
      const { start, end } = this.filters.timeRange;
      filtered = filtered.filter(e => {
        if (start && e.timestampMs < start) return false;
        if (end && e.timestampMs > end) return false;
        return true;
      });
    }

    // Filter by search query
    if (this.filters.searchQuery) {
      const query = this.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(e => {
        const summary = e.getSummary().toLowerCase();
        const dataStr = JSON.stringify(e.data).toLowerCase();
        return summary.includes(query) || dataStr.includes(query);
      });
    }

    return filtered;
  }

  /**
   * Set event type filter
   */
  setEventTypeFilter(types) {
    this.filters.eventTypes = types;
    this.emit('filterChanged', { eventTypes: types });
    return this;
  }

  /**
   * Set time range filter
   */
  setTimeRangeFilter(start, end) {
    this.filters.timeRange = { start, end };
    this.emit('filterChanged', { timeRange: this.filters.timeRange });
    return this;
  }

  /**
   * Set search query filter
   */
  setSearchFilter(query) {
    this.filters.searchQuery = query;
    this.emit('filterChanged', { searchQuery: query });
    return this;
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.filters = {
      eventTypes: null,
      timeRange: null,
      searchQuery: null
    };
    this.emit('filterChanged', { cleared: true });
    return this;
  }

  /**
   * Get current event
   */
  getCurrentEvent() {
    const filtered = this.getFilteredEvents();
    if (this.currentIndex >= 0 && this.currentIndex < filtered.length) {
      return filtered[this.currentIndex];
    }
    return null;
  }

  /**
   * Move to first event
   */
  first() {
    this.currentIndex = 0;
    this.state = ReplayState.STEPPING;
    const event = this.getCurrentEvent();
    this.emit('step', { event, index: this.currentIndex });
    return event;
  }

  /**
   * Move to last event
   */
  last() {
    this.currentIndex = this.getFilteredEvents().length - 1;
    this.state = ReplayState.STEPPING;
    const event = this.getCurrentEvent();
    this.emit('step', { event, index: this.currentIndex });
    return event;
  }

  /**
   * Step to next event
   */
  next() {
    const filtered = this.getFilteredEvents();
    if (this.currentIndex < filtered.length - 1) {
      this.currentIndex++;
      this.state = ReplayState.STEPPING;
      const event = this.getCurrentEvent();
      this.emit('step', { event, index: this.currentIndex });
      return event;
    }
    this.state = ReplayState.COMPLETED;
    this.emit('completed');
    return null;
  }

  /**
   * Step to previous event
   */
  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.state = ReplayState.STEPPING;
      const event = this.getCurrentEvent();
      this.emit('step', { event, index: this.currentIndex });
      return event;
    }
    return null;
  }

  /**
   * Go to specific event by index
   */
  goTo(index) {
    const filtered = this.getFilteredEvents();
    if (index >= 0 && index < filtered.length) {
      this.currentIndex = index;
      this.state = ReplayState.STEPPING;
      const event = this.getCurrentEvent();
      this.emit('step', { event, index: this.currentIndex });
      return event;
    }
    return null;
  }

  /**
   * Go to event by ID
   */
  goToById(eventId) {
    const filtered = this.getFilteredEvents();
    const index = filtered.findIndex(e => e.id === eventId);
    if (index >= 0) {
      return this.goTo(index);
    }
    return null;
  }

  /**
   * Add bookmark at current position
   */
  addBookmark(name) {
    const event = this.getCurrentEvent();
    if (event) {
      this.bookmarks.push({
        id: `bookmark-${Date.now()}`,
        name,
        eventId: event.id,
        index: this.currentIndex,
        timestamp: new Date().toISOString()
      });
      this.emit('bookmarkAdded', { name, eventId: event.id });
      return true;
    }
    return false;
  }

  /**
   * Go to bookmark
   */
  goToBookmark(bookmarkId) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      return this.goToById(bookmark.eventId);
    }
    return null;
  }

  /**
   * Get event details
   */
  getEventDetails(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return null;

    return {
      ...event.toJSON(),
      fullData: event.data,
      relatedEvents: this._findRelatedEvents(event)
    };
  }

  /**
   * Find events related to a given event
   */
  _findRelatedEvents(event) {
    const related = [];

    switch (event.type) {
      case ReplayEventType.CONVERSATION_TURN:
        // Find MCP calls in this turn
        related.push(...this.events.filter(e =>
          e.type === ReplayEventType.MCP_CALL &&
          e.data.conversationTurn === event.data.turn
        ));
        // Find decisions in this turn
        related.push(...this.events.filter(e =>
          e.type === ReplayEventType.DECISION &&
          e.data.context?.conversationTurn === event.data.turn
        ));
        break;

      case ReplayEventType.MCP_CALL:
        // Find related decision
        if (event.data.relatedDecisionId) {
          related.push(...this.events.filter(e =>
            e.type === ReplayEventType.DECISION &&
            e.data.id === event.data.relatedDecisionId
          ));
        }
        break;

      case ReplayEventType.DECISION:
        // Find related MCP call
        related.push(...this.events.filter(e =>
          e.type === ReplayEventType.MCP_CALL &&
          e.data.relatedDecisionId === event.data.id
        ));
        break;
    }

    return related.map(e => ({ id: e.id, type: e.type, summary: e.getSummary() }));
  }

  /**
   * Get timeline view
   */
  getTimeline() {
    const filtered = this.getFilteredEvents();

    return {
      totalEvents: filtered.length,
      currentIndex: this.currentIndex,
      events: filtered.map((e, i) => ({
        index: i,
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        summary: e.getSummary(),
        isCurrent: i === this.currentIndex,
        isBookmarked: this.bookmarks.some(b => b.eventId === e.id)
      }))
    };
  }

  /**
   * Get statistics for the session
   */
  getStats() {
    const byType = {};
    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
    }

    const timeRange = this.events.length > 0 ? {
      start: this.events[0].timestamp,
      end: this.events[this.events.length - 1].timestamp,
      durationMs: this.events[this.events.length - 1].timestampMs - this.events[0].timestampMs
    } : null;

    return {
      totalEvents: this.events.length,
      filteredEvents: this.getFilteredEvents().length,
      byType,
      timeRange,
      bookmarks: this.bookmarks.length,
      currentIndex: this.currentIndex,
      state: this.state
    };
  }

  /**
   * Export filtered events to JSON
   */
  exportToJSON() {
    return {
      sessionId: this.sessionId,
      sourceFile: this.sourceFile,
      exportedAt: new Date().toISOString(),
      filters: this.filters,
      stats: this.getStats(),
      events: this.getFilteredEvents().map(e => e.toJSON()),
      bookmarks: this.bookmarks
    };
  }

  /**
   * Export timeline to text format
   */
  exportTimelineText() {
    const filtered = this.getFilteredEvents();
    let text = `Replay Timeline: ${this.sessionId}\n`;
    text += `Source: ${this.sourceFile}\n`;
    text += '='.repeat(60) + '\n\n';

    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      const time = new Date(e.timestamp).toISOString().slice(11, 23);
      const marker = i === this.currentIndex ? '>>>' : '   ';
      const bookmark = this.bookmarks.some(b => b.eventId === e.id) ? ' [★]' : '';

      text += `${marker} [${String(i).padStart(3, '0')}] ${time} | ${e.type.padEnd(20)} | ${e.getSummary()}${bookmark}\n`;
    }

    text += '\n' + '='.repeat(60) + '\n';
    text += `Total: ${filtered.length} events\n`;

    return text;
  }

  /**
   * Save session to file
   */
  async saveSession(filePath) {
    const data = this.exportToJSON();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }
}

/**
 * Create a replay session from a test output directory
 */
export async function createReplaySession(outputDir, options = {}) {
  const session = new ReplaySession(options);
  await session.loadFromDirectory(outputDir);
  return session;
}

/**
 * Interactive CLI for replay (can be used in Node REPL or as standalone)
 */
export class ReplayCLI {
  constructor(session) {
    this.session = session;
  }

  /**
   * Print current status
   */
  status() {
    const stats = this.session.getStats();
    const current = this.session.getCurrentEvent();

    console.log('\n=== Replay Status ===');
    console.log(`Session: ${this.session.sessionId}`);
    console.log(`State: ${this.session.state}`);
    console.log(`Events: ${stats.filteredEvents}/${stats.totalEvents}`);
    console.log(`Position: ${this.session.currentIndex + 1}/${stats.filteredEvents}`);
    if (current) {
      console.log(`Current: ${current.getSummary()}`);
    }
    console.log('');
    return this;
  }

  /**
   * Show timeline
   */
  timeline(count = 20) {
    const timeline = this.session.getTimeline();
    const start = Math.max(0, this.session.currentIndex - Math.floor(count / 2));
    const end = Math.min(timeline.events.length, start + count);

    console.log('\n=== Timeline ===');
    for (let i = start; i < end; i++) {
      const e = timeline.events[i];
      const marker = e.isCurrent ? '>>>' : '   ';
      const bookmark = e.isBookmarked ? ' [★]' : '';
      console.log(`${marker} [${String(i).padStart(3, '0')}] ${e.summary}${bookmark}`);
    }
    console.log('');
    return this;
  }

  /**
   * Show current event details
   */
  details() {
    const current = this.session.getCurrentEvent();
    if (!current) {
      console.log('No current event. Use first() to start.');
      return this;
    }

    console.log('\n=== Event Details ===');
    console.log(`ID: ${current.id}`);
    console.log(`Type: ${current.type}`);
    console.log(`Time: ${current.timestamp}`);
    console.log(`Summary: ${current.getSummary()}`);
    console.log('\nData:');
    console.log(JSON.stringify(current.data, null, 2));
    console.log('');
    return this;
  }

  /**
   * Navigation shortcuts
   */
  n() { this.session.next(); return this.status(); }
  p() { this.session.previous(); return this.status(); }
  f() { this.session.first(); return this.status(); }
  l() { this.session.last(); return this.status(); }
  g(index) { this.session.goTo(index); return this.status(); }

  /**
   * Filter shortcuts
   */
  filterMcp() {
    this.session.setEventTypeFilter([ReplayEventType.MCP_CALL]);
    console.log('Filtered to MCP calls only');
    return this.status();
  }

  filterDecisions() {
    this.session.setEventTypeFilter([ReplayEventType.DECISION]);
    console.log('Filtered to decisions only');
    return this.status();
  }

  filterConversation() {
    this.session.setEventTypeFilter([ReplayEventType.CONVERSATION_TURN]);
    console.log('Filtered to conversation turns only');
    return this.status();
  }

  clearFilter() {
    this.session.clearFilters();
    console.log('Filters cleared');
    return this.status();
  }

  /**
   * Search
   */
  search(query) {
    this.session.setSearchFilter(query);
    console.log(`Searching for: ${query}`);
    return this.status();
  }

  /**
   * Bookmark current position
   */
  bookmark(name) {
    this.session.addBookmark(name);
    console.log(`Bookmarked as: ${name}`);
    return this;
  }

  /**
   * Show help
   */
  help() {
    console.log(`
=== Replay CLI Commands ===

Navigation:
  n()        - Next event
  p()        - Previous event
  f()        - First event
  l()        - Last event
  g(index)   - Go to specific index

Display:
  status()   - Show current status
  timeline() - Show timeline around current position
  details()  - Show current event details

Filters:
  filterMcp()          - Show only MCP calls
  filterDecisions()    - Show only decisions
  filterConversation() - Show only conversation turns
  clearFilter()        - Clear all filters
  search(query)        - Search in events

Bookmarks:
  bookmark(name)       - Bookmark current position

Help:
  help()               - Show this help
`);
    return this;
  }
}

export default ReplaySession;
