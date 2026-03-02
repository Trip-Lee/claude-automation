# Consolidated TODO List

**Last Updated:** 2026-03-02
**Projects:** claude-automation, sn-tools

---

## Claude-Automation

### High Priority

- [ ] **Performance Optimization** - Model selection strategy for cost/speed balance
- [ ] **Unit Test Coverage** - Increase to 50-60% (Orchestrator, ConfigManager)
- [ ] **Integration Tests** - Full workflow validation tests

### Medium Priority

- [ ] Parse git diff for actual file changes (orchestrator.js:713)
- [ ] Parse test output for test counts (orchestrator.js:784)
- [ ] Add rate limiting for API calls
- [ ] Improve error recovery in multi-agent workflows

### Low Priority

- [ ] Web UI dashboard for task monitoring
- [ ] Email notifications on task completion/failure
- [ ] Historical cost analytics

---

## SN-Tools (v3.0.0)

### High Priority

- [ ] **Cache Freshness** - Automated cache refresh when >72 hours old
- [ ] **Flow Operation Detection** - Improve "unknown" operation classification for referencing flows

### Medium Priority

- [ ] **Simulation Accuracy** - Dynamic table name resolution (currently LOW confidence)
- [ ] **Chain Analysis** - Extend async event tracing (gs.eventQueue -> Script Action)
- [ ] **Visualization Performance** - Optimize for large apps (>500 artifacts)

### Low Priority

- [ ] GraphViz PNG/SVG rendering for dependency graphs
- [ ] Investigate 166 orphaned Script Includes (code health)
- [ ] Web UI for cache exploration
- [ ] RAG Provider implementation (semantic search)
- [ ] CI/CD integration for automated cache builds

---

## Code TODOs (from source)

| File | Line | Description |
|------|------|-------------|
| `orchestrator.js` | 713 | Parse git diff for file changes |
| `orchestrator.js` | 784 | Parse test output for counts |
| `sn-context-cache.js` | 3603 | Integrate sn-flow-tracer for component analysis |
| `sn-enhanced-record-creator.js` | 1529 | Load actual choice options |

---

## Completed (Recent)

- [x] Impact Chain Analysis with referencing flows (2026-03-02)
- [x] MCP QueryExecutionContextHandler impact_chain integration (2026-03-02)
- [x] Agent system prompts with Impact Chain checklist (2026-03-02)
- [x] Enhanced Execution Simulator v2.0 (2026-02-23)
- [x] Trigger Chain Visualization with Dual-View (2026-02-23)
- [x] Architecture HTML output with D3.js (2026-02-23)
- [x] Full-stack tracing ~90% coverage (2026-02-25)

---

**Note:** This consolidates all previous TODO files. Legacy TODO files have been archived.
