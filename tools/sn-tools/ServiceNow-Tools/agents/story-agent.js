/**
 * Story Analyzer Agent
 * Specializes in analyzing user stories, requirements, and acceptance criteria
 * Can extract implementation details, identify affected components, and suggest test scenarios
 */

const BaseAgent = require('./base-agent');
const path = require('path');
const fs = require('fs');

class StoryAnalyzerAgent extends BaseAgent {
    constructor(config = {}) {
        super('StoryAnalyzer', config);
        
        this.storyPath = path.join(this.rootPath, 'ServiceNow-Data', 'Tenon', 'Stories');
        this.stories = new Map();
        this.epics = new Map();
        this.storyComponentMap = new Map();
        
        // Story analysis patterns
        this.patterns = {
            components: [
                /[Cc]omponent[:\s]+([a-zA-Z0-9-_]+)/g,
                /UI[:\s]+([a-zA-Z0-9-_]+)/g,
                /[Ff]rontend[:\s]+([a-zA-Z0-9-_]+)/g
            ],
            apis: [
                /API[:\s]+([a-zA-Z0-9_/]+)/g,
                /[Ee]ndpoint[:\s]+([a-zA-Z0-9_/]+)/g,
                /REST[:\s]+([a-zA-Z0-9_/]+)/g
            ],
            scriptIncludes: [
                /[Ss]cript [Ii]nclude[:\s]+([a-zA-Z0-9_]+)/g,
                /[Bb]ackend[:\s]+([a-zA-Z0-9_]+)/g,
                /[Ss]erver[:\s]+([a-zA-Z0-9_]+)/g
            ],
            testScenarios: [
                /[Tt]est[:\s]+(.+?)(?:\n|$)/g,
                /[Vv]erify[:\s]+(.+?)(?:\n|$)/g,
                /[Ee]nsure[:\s]+(.+?)(?:\n|$)/g
            ]
        };
    }

    async loadData() {
        this.log('Loading user stories and epics...', 'yellow');
        
        // Load stories
        const storyFiles = this.getAllFiles(this.storyPath, '.json');
        
        for (const file of storyFiles) {
            const data = this.readJSON(file);
            if (data && data.result) {
                const stories = Array.isArray(data.result) ? data.result : [data.result];
                
                stories.forEach(story => {
                    if (story.number) {
                        this.stories.set(story.number, {
                            number: story.number,
                            short_description: story.short_description,
                            description: story.description,
                            acceptance_criteria: story.acceptance_criteria,
                            state: story.state,
                            priority: story.priority,
                            epic: story.epic,
                            assigned_to: story.assigned_to,
                            story_points: story.story_points,
                            sprint: story.sprint,
                            sys_id: story.sys_id,
                            file: file,
                            // Analysis results
                            components: [],
                            apis: [],
                            scriptIncludes: [],
                            testScenarios: []
                        });
                    }
                });
            }
        }
        
        this.log(`Loaded ${this.stories.size} stories`, 'green');
        
        // Pre-analyze all stories
        await this.analyzeAllStories();
    }

    async analyzeAllStories() {
        this.log('Analyzing story content...', 'yellow');
        
        for (const [number, story] of this.stories) {
            const analysis = this.analyzeStoryContent(story);
            
            // Update story with analysis
            story.components = analysis.components;
            story.apis = analysis.apis;
            story.scriptIncludes = analysis.scriptIncludes;
            story.testScenarios = analysis.testScenarios;
            
            // Build component mapping
            analysis.components.forEach(comp => {
                if (!this.storyComponentMap.has(comp)) {
                    this.storyComponentMap.set(comp, []);
                }
                this.storyComponentMap.get(comp).push(number);
            });
        }
        
        this.log('Story analysis complete', 'green');
    }

    analyzeStoryContent(story) {
        const content = `
            ${story.short_description || ''}
            ${story.description || ''}
            ${story.acceptance_criteria || ''}
        `;
        
        const analysis = {
            components: [],
            apis: [],
            scriptIncludes: [],
            testScenarios: []
        };
        
        // Extract components
        this.patterns.components.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (!analysis.components.includes(match[1])) {
                    analysis.components.push(match[1]);
                }
            }
        });
        
        // Extract APIs
        this.patterns.apis.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (!analysis.apis.includes(match[1])) {
                    analysis.apis.push(match[1]);
                }
            }
        });
        
        // Extract Script Includes
        this.patterns.scriptIncludes.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (!analysis.scriptIncludes.includes(match[1])) {
                    analysis.scriptIncludes.push(match[1]);
                }
            }
        });
        
        // Extract test scenarios
        this.patterns.testScenarios.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                analysis.testScenarios.push(match[1].trim());
            }
        });
        
        // Smart detection based on keywords
        const keywords = {
            components: ['kanban', 'calendar', 'form', 'modal', 'list', 'button', 'input', 'dropdown'],
            apis: ['fetch', 'create', 'update', 'delete', 'GET', 'POST', 'PUT', 'DELETE'],
            scriptIncludes: ['Utils', 'Helper', 'Manager', 'Service', 'MS']
        };
        
        // Keyword-based detection
        keywords.components.forEach(keyword => {
            if (content.toLowerCase().includes(keyword.toLowerCase())) {
                const componentName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
                if (!analysis.components.includes(componentName)) {
                    analysis.components.push(componentName);
                }
            }
        });
        
        return analysis;
    }

    async handleRequest(request) {
        switch (request.type) {
            case 'get_story':
                return this.getStory(request.storyNumber);
                
            case 'find_stories_by_component':
                return this.findStoriesByComponent(request.componentName);
                
            case 'analyze_story':
                return this.analyzeStory(request.storyNumber);
                
            case 'get_implementation_guide':
                return this.getImplementationGuide(request.storyNumber);
                
            case 'get_test_scenarios':
                return this.getTestScenarios(request.storyNumber);
                
            case 'find_related_stories':
                return this.findRelatedStories(request.storyNumber);
                
            case 'get_sprint_stories':
                return this.getSprintStories(request.sprint);
                
            case 'search_stories':
                return this.searchStories(request.query);
                
            default:
                throw new Error(`Unknown request type: ${request.type}`);
        }
    }

    getStory(storyNumber) {
        const story = this.stories.get(storyNumber);
        if (!story) {
            throw new Error(`Story ${storyNumber} not found`);
        }
        return story;
    }

    findStoriesByComponent(componentName) {
        const stories = this.storyComponentMap.get(componentName) || [];
        
        return {
            component: componentName,
            storyCount: stories.length,
            stories: stories.map(number => {
                const story = this.stories.get(number);
                return {
                    number: story.number,
                    title: story.short_description,
                    state: story.state,
                    priority: story.priority
                };
            })
        };
    }

    analyzeStory(storyNumber) {
        const story = this.getStory(storyNumber);
        
        return {
            number: story.number,
            title: story.short_description,
            state: story.state,
            analysis: {
                components: story.components,
                apis: story.apis,
                scriptIncludes: story.scriptIncludes,
                testScenarios: story.testScenarios,
                complexity: this.calculateComplexity(story),
                estimatedEffort: this.estimateEffort(story)
            }
        };
    }

    getImplementationGuide(storyNumber) {
        const story = this.getStory(storyNumber);
        
        const guide = {
            story: {
                number: story.number,
                title: story.short_description
            },
            steps: [],
            components: story.components,
            apis: story.apis,
            scriptIncludes: story.scriptIncludes
        };
        
        // Generate implementation steps
        if (story.components.length > 0) {
            guide.steps.push({
                order: 1,
                type: 'frontend',
                description: 'Implement UI components',
                details: story.components.map(c => `- Update/Create ${c} component`)
            });
        }
        
        if (story.apis.length > 0) {
            guide.steps.push({
                order: 2,
                type: 'api',
                description: 'Create/Update API endpoints',
                details: story.apis.map(a => `- Implement ${a} endpoint`)
            });
        }
        
        if (story.scriptIncludes.length > 0) {
            guide.steps.push({
                order: 3,
                type: 'backend',
                description: 'Implement backend logic',
                details: story.scriptIncludes.map(s => `- Update ${s} Script Include`)
            });
        }
        
        if (story.testScenarios.length > 0) {
            guide.steps.push({
                order: 4,
                type: 'testing',
                description: 'Execute test scenarios',
                details: story.testScenarios
            });
        }
        
        return guide;
    }

    getTestScenarios(storyNumber) {
        const story = this.getStory(storyNumber);
        
        const scenarios = [...story.testScenarios];
        
        // Generate additional test scenarios based on components
        story.components.forEach(component => {
            scenarios.push(`Verify ${component} component renders correctly`);
            scenarios.push(`Test ${component} component user interactions`);
        });
        
        story.apis.forEach(api => {
            scenarios.push(`Test ${api} API endpoint response`);
            scenarios.push(`Verify ${api} error handling`);
        });
        
        return {
            story: story.number,
            scenarios: scenarios,
            acceptanceCriteria: story.acceptance_criteria
        };
    }

    findRelatedStories(storyNumber) {
        const story = this.getStory(storyNumber);
        const related = new Map();
        
        // Find stories with similar components
        story.components.forEach(component => {
            const componentStories = this.storyComponentMap.get(component) || [];
            componentStories.forEach(num => {
                if (num !== storyNumber) {
                    if (!related.has(num)) {
                        related.set(num, { reasons: [] });
                    }
                    related.get(num).reasons.push(`Shared component: ${component}`);
                }
            });
        });
        
        // Find stories in same epic
        if (story.epic) {
            for (const [num, s] of this.stories) {
                if (s.epic === story.epic && num !== storyNumber) {
                    if (!related.has(num)) {
                        related.set(num, { reasons: [] });
                    }
                    related.get(num).reasons.push('Same epic');
                }
            }
        }
        
        const relatedStories = [];
        for (const [num, info] of related) {
            const s = this.stories.get(num);
            relatedStories.push({
                number: num,
                title: s.short_description,
                state: s.state,
                reasons: info.reasons
            });
        }
        
        return relatedStories;
    }

    getSprintStories(sprint) {
        const sprintStories = [];
        
        for (const [number, story] of this.stories) {
            if (story.sprint === sprint) {
                sprintStories.push({
                    number: story.number,
                    title: story.short_description,
                    state: story.state,
                    priority: story.priority,
                    points: story.story_points,
                    components: story.components
                });
            }
        }
        
        return {
            sprint: sprint,
            storyCount: sprintStories.length,
            totalPoints: sprintStories.reduce((sum, s) => sum + (s.points || 0), 0),
            stories: sprintStories
        };
    }

    searchStories(query) {
        const queryLower = query.toLowerCase();
        const results = [];
        
        for (const [number, story] of this.stories) {
            const searchText = `
                ${story.short_description || ''}
                ${story.description || ''}
                ${story.acceptance_criteria || ''}
                ${story.components.join(' ')}
                ${story.apis.join(' ')}
                ${story.scriptIncludes.join(' ')}
            `.toLowerCase();
            
            if (searchText.includes(queryLower)) {
                results.push({
                    number: story.number,
                    title: story.short_description,
                    state: story.state,
                    matchedIn: this.getMatchLocation(story, queryLower)
                });
            }
        }
        
        return results;
    }

    getMatchLocation(story, query) {
        const locations = [];
        
        if (story.short_description?.toLowerCase().includes(query)) {
            locations.push('title');
        }
        if (story.description?.toLowerCase().includes(query)) {
            locations.push('description');
        }
        if (story.acceptance_criteria?.toLowerCase().includes(query)) {
            locations.push('acceptance criteria');
        }
        if (story.components.some(c => c.toLowerCase().includes(query))) {
            locations.push('components');
        }
        if (story.apis.some(a => a.toLowerCase().includes(query))) {
            locations.push('apis');
        }
        
        return locations.join(', ');
    }

    calculateComplexity(story) {
        let complexity = 0;
        
        complexity += story.components.length * 2;
        complexity += story.apis.length * 3;
        complexity += story.scriptIncludes.length * 3;
        complexity += story.testScenarios.length;
        
        if (complexity <= 5) return 'Low';
        if (complexity <= 15) return 'Medium';
        return 'High';
    }

    estimateEffort(story) {
        const complexity = this.calculateComplexity(story);
        
        switch (complexity) {
            case 'Low': return '1-2 days';
            case 'Medium': return '3-5 days';
            case 'High': return '1-2 weeks';
            default: return 'Unknown';
        }
    }
}

module.exports = StoryAnalyzerAgent;