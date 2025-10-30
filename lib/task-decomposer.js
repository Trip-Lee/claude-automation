/**
 * TaskDecomposer - Analyzes tasks to determine if they can be parallelized
 *
 * Responsibilities:
 * - Consult with architect agent about task decomposition
 * - Identify non-overlapping work units
 * - Validate that parts are truly independent
 * - Detect file conflicts between parts
 */

export class TaskDecomposer {
  constructor(architectAgent) {
    this.architect = architectAgent;
    this.minPartsForParallel = 2;
    this.maxPartsForParallel = 5;
    this.minComplexityThreshold = 3; // 1-10 scale
  }

  /**
   * Analyze task and determine if it can be parallelized
   * @param {string} description - Task description
   * @returns {Object} Analysis result with canParallelize and parts
   */
  async analyzeTask(description) {
    const prompt = `Analyze this coding task and determine if it can be split into independent parallel subtasks.

Task Description:
${description}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "complexity": <number 1-10, where 1=trivial, 10=very complex>,
  "canParallelize": <boolean>,
  "reasoning": "<why or why not>",
  "parts": [
    {
      "role": "<coder|tester|documenter>",
      "description": "<specific subtask description>",
      "files": ["<estimated files to create/modify>"],
      "dependencies": ["<indices of other parts this depends on, e.g., [0,1] or []>"]
    }
  ]
}

Requirements for parallelization:
1. Parts must be truly independent (no file conflicts)
2. Each part should be substantial enough to warrant a separate agent
3. Must have 2-5 parts total (not too few, not too many)
4. If a part depends on another, list the dependency
5. Complexity must be >= ${this.minComplexityThreshold} to warrant parallelization

Examples of parallelizable tasks:
- "Add 3 new API endpoints: /users, /posts, /comments" → 3 parts, each endpoint in separate file
- "Add user authentication (backend) and login UI (frontend)" → 2 parts, backend vs frontend

Examples of NON-parallelizable tasks:
- "Fix bug in user login" → too simple, single part
- "Refactor authentication system" → all files interdependent
- "Add error handling to all API endpoints" → would touch same files

Respond with the JSON object:`;

    try {
      // Query architect agent
      const response = await this.architect.query(prompt);

      // Parse response (handle markdown-wrapped JSON)
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
                       response.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) {
        throw new Error('Could not parse JSON response from architect');
      }

      const analysis = JSON.parse(jsonMatch[1]);

      // Validate and enhance analysis
      return this.validateAnalysis(analysis, description);

    } catch (error) {
      // If analysis fails, default to sequential
      console.warn(`Task analysis failed: ${error.message}`);
      console.warn('Defaulting to sequential execution');

      return {
        complexity: 5,
        canParallelize: false,
        reasoning: `Analysis failed: ${error.message}. Defaulting to sequential execution.`,
        parts: []
      };
    }
  }

  /**
   * Validate that analysis meets requirements for parallelization
   * @param {Object} analysis - Raw analysis from architect
   * @param {string} originalTask - Original task description
   * @returns {Object} Validated analysis
   */
  validateAnalysis(analysis, originalTask) {
    // Check if analysis has required fields
    if (!analysis.hasOwnProperty('canParallelize') || !Array.isArray(analysis.parts)) {
      return {
        complexity: analysis.complexity || 5,
        canParallelize: false,
        reasoning: 'Invalid analysis format from architect',
        parts: []
      };
    }

    // If architect says no, respect it
    if (!analysis.canParallelize) {
      return analysis;
    }

    // Check complexity threshold
    if (analysis.complexity < this.minComplexityThreshold) {
      return {
        ...analysis,
        canParallelize: false,
        reasoning: `Task complexity (${analysis.complexity}) below threshold (${this.minComplexityThreshold}). Not worth parallelizing.`
      };
    }

    // Check number of parts
    if (analysis.parts.length < this.minPartsForParallel) {
      return {
        ...analysis,
        canParallelize: false,
        reasoning: `Only ${analysis.parts.length} parts identified. Need at least ${this.minPartsForParallel} for parallelization.`
      };
    }

    if (analysis.parts.length > this.maxPartsForParallel) {
      return {
        ...analysis,
        canParallelize: false,
        reasoning: `Too many parts (${analysis.parts.length}). Maximum is ${this.maxPartsForParallel} to avoid excessive overhead.`
      };
    }

    // Check for file conflicts
    const fileConflict = this.detectFileConflicts(analysis.parts);
    if (fileConflict) {
      return {
        ...analysis,
        canParallelize: false,
        reasoning: `File conflict detected: "${fileConflict.file}" would be modified by parts ${fileConflict.parts.join(' and ')}`
      };
    }

    // Check for circular dependencies
    const circularDep = this.detectCircularDependencies(analysis.parts);
    if (circularDep) {
      return {
        ...analysis,
        canParallelize: false,
        reasoning: `Circular dependency detected: ${circularDep}`
      };
    }

    // Check if any part has dependencies (for now, we only support fully independent parts)
    const hasDependencies = analysis.parts.some(p =>
      Array.isArray(p.dependencies) && p.dependencies.length > 0
    );

    if (hasDependencies) {
      return {
        ...analysis,
        canParallelize: false,
        reasoning: 'Parts have dependencies on each other. Only fully independent tasks can be parallelized in this version.'
      };
    }

    // Validate each part has required fields
    for (let i = 0; i < analysis.parts.length; i++) {
      const part = analysis.parts[i];

      if (!part.role || !part.description || !Array.isArray(part.files)) {
        return {
          ...analysis,
          canParallelize: false,
          reasoning: `Part ${i + 1} is missing required fields (role, description, or files)`
        };
      }

      // Ensure role is valid
      if (!['coder', 'tester', 'documenter'].includes(part.role)) {
        return {
          ...analysis,
          canParallelize: false,
          reasoning: `Invalid role "${part.role}" in part ${i + 1}. Must be coder, tester, or documenter.`
        };
      }
    }

    // All validations passed
    return analysis;
  }

  /**
   * Detect file conflicts between parts
   * @param {Array} parts - Array of task parts
   * @returns {Object|null} Conflict info or null if no conflict
   */
  detectFileConflicts(parts) {
    const fileMap = new Map();

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      for (const file of part.files) {
        // Normalize file path
        const normalizedFile = file.trim().toLowerCase();

        if (fileMap.has(normalizedFile)) {
          return {
            file,
            parts: [fileMap.get(normalizedFile) + 1, i + 1]
          };
        }

        fileMap.set(normalizedFile, i);
      }
    }

    return null;
  }

  /**
   * Detect circular dependencies between parts
   * @param {Array} parts - Array of task parts
   * @returns {string|null} Description of circular dependency or null
   */
  detectCircularDependencies(parts) {
    // Build dependency graph
    const graph = parts.map(p => p.dependencies || []);

    // Check each node for cycles using DFS
    for (let start = 0; start < parts.length; start++) {
      const visited = new Set();
      const stack = [start];

      while (stack.length > 0) {
        const node = stack.pop();

        if (visited.has(node)) {
          // Cycle detected
          return `Part ${start + 1} has a circular dependency chain`;
        }

        visited.add(node);

        // Add dependencies to stack
        const deps = graph[node] || [];
        for (const dep of deps) {
          if (dep === start) {
            return `Part ${start + 1} depends on part ${dep + 1} which creates a cycle`;
          }
          stack.push(dep);
        }
      }
    }

    return null;
  }

  /**
   * Get a human-readable summary of the analysis
   * @param {Object} analysis - Analysis result
   * @returns {string} Summary string
   */
  getSummary(analysis) {
    if (!analysis.canParallelize) {
      return `Sequential execution (${analysis.reasoning})`;
    }

    const partDescriptions = analysis.parts
      .map((p, i) => `${i + 1}. ${p.role}: ${p.description}`)
      .join('\n  ');

    return `Parallel execution with ${analysis.parts.length} parts:\n  ${partDescriptions}`;
  }
}
