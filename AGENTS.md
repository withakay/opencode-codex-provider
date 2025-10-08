# opencode-codex-provider - Agent Configuration

This document outlines the specialized agents used for developing and maintaining the opencode-codex-provider plugin.

## Available Agents

### TypeScript Engineering Agents

#### `typescript-engineer`
**Purpose**: Core TypeScript implementation and feature development  
**Responsibilities**:
- Implement new features and functionality
- Write production-ready TypeScript code
- Handle complex logic and algorithms
- Ensure code follows project conventions
- Optimize performance and memory usage

**Typical Tasks**:
- Implement provider loading logic
- Create monkey patching functionality
- Build streaming and event handling
- Develop configuration management

#### `typescript-test-engineer`
**Purpose**: Test-driven development and comprehensive test coverage  
**Responsibilities**:
- Write failing tests first (RED phase)
- Design test scenarios and edge cases
- Create unit and integration tests
- Ensure test coverage and quality
- Document behavior through tests

**Typical Tasks**:
- Write unit tests for factory extraction
- Create integration tests for provider loading
- Design error handling test scenarios
- Build performance benchmarks

#### `typescript-code-reviewer`
**Purpose**: Code quality review and best practices enforcement  
**Responsibilities**:
- Review code for correctness and maintainability
- Ensure adherence to TypeScript best practices
- Identify potential bugs and security issues
- Suggest improvements and optimizations
- Validate architectural decisions

**Review Focus Areas**:
- Type safety and interface design
- Error handling patterns
- Performance considerations
- Code organization and readability
- Security implications

#### `typescript-quality-checker`
**Purpose**: Code quality assurance and refactoring guidance  
**Responsibilities**:
- Assess code quality metrics
- Identify refactoring opportunities
- Ensure maintainability standards
- Validate documentation completeness
- Check for code smells and technical debt

**Quality Checks**:
- Cyclomatic complexity analysis
- Code duplication detection
- Naming convention compliance
- Documentation coverage
- Performance bottleneck identification

### General Engineering Agents

#### `general`
**Purpose**: Research, analysis, and cross-cutting concerns  
**Responsibilities**:
- Conduct technical research
- Analyze codebase structure
- Investigate integration patterns
- Document findings and recommendations
- Handle multi-step coordination tasks

**Typical Tasks**:
- Research opencode plugin architecture
- Analyze existing patch implementations
- Investigate import resolution strategies
- Document technical decisions

## Agent Workflow

### Test-Driven Development (TDD) Cycle

1. **RED Phase** (`typescript-test-engineer`)
   - Write failing tests for new functionality
   - Define clear acceptance criteria
   - Cover edge cases and error scenarios
   - Review: `typescript-code-reviewer`
   - Quality Check: `typescript-quality-checker`

2. **GREEN Phase** (`typescript-engineer`)
   - Implement minimum code to pass tests
   - Focus on functionality over optimization
   - Ensure all tests pass
   - Review: `typescript-code-reviewer`
   - Quality Check: `typescript-quality-checker`

3. **REFACTOR Phase** (`typescript-quality-checker`)
   - Improve code quality while maintaining tests
   - Extract helper functions and constants
   - Enhance documentation and type safety
   - Review: `typescript-code-reviewer`

### Code Review Process

All code changes follow this review sequence:

1. **Implementation Review** (`typescript-code-reviewer`)
   - Correctness and logic validation
   - TypeScript best practices
   - Security considerations
   - Performance implications

2. **Quality Assessment** (`typescript-quality-checker`)
   - Code quality metrics
   - Maintainability score
   - Documentation completeness
   - Refactoring recommendations

## Agent Specializations

### By Task Type

| Task Type | Primary Agent | Supporting Agents |
|-----------|---------------|-------------------|
| Feature Implementation | `typescript-engineer` | `typescript-code-reviewer`, `typescript-quality-checker` |
| Test Writing | `typescript-test-engineer` | `typescript-code-reviewer`, `typescript-quality-checker` |
| Code Review | `typescript-code-reviewer` | `typescript-quality-checker` |
| Refactoring | `typescript-quality-checker` | `typescript-code-reviewer` |
| Research | `general` | `typescript-engineer` |

### By Complexity Level

| Complexity | Recommended Agent(s) |
|------------|---------------------|
| Simple bug fixes | `typescript-engineer` |
| New features | `typescript-engineer` + `typescript-test-engineer` |
| Architecture changes | `typescript-engineer` + `typescript-code-reviewer` + `typescript-quality-checker` |
| Research tasks | `general` + `typescript-engineer` |

## Agent Coordination

### Parallel Execution

Some tasks can be executed in parallel for efficiency:

```bash
# Parallel test writing and implementation planning
typescript-test-engineer: Write unit tests
typescript-engineer: Plan implementation approach
```

### Sequential Dependencies

Most tasks require sequential execution:

```bash
# TDD workflow
typescript-test-engineer → typescript-engineer → typescript-quality-checker
```

### Handoff Criteria

Each agent has specific handoff criteria:

- **Test Engineer**: Tests written and failing as expected
- **Implementation Engineer**: All tests passing with minimal code
- **Quality Checker**: Code quality standards met, documentation complete

## Agent Configuration

### Environment Setup

Each agent expects:

```typescript
// Project structure
src/
├── monkeyPatch.ts      # Core patching logic
├── codexProvider.ts    # Provider implementation
├── types.ts           # Type definitions
└── utils.ts           # Helper functions

tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
└── fixtures/          # Test fixtures
```

### Tool Access

All agents have access to:
- File system operations (read, write, edit)
- Test execution (bun test)
- Build tools (bun build)
- Linting and type checking
- Git operations

### Communication Protocol

Agents communicate through:
- Code comments and documentation
- Test descriptions and expectations
- Review comments and suggestions
- Commit messages and pull requests

## Quality Standards

### Code Quality Metrics

- **Test Coverage**: >90%
- **TypeScript Strict Mode**: Enabled
- **Lint Rules**: No warnings
- **Documentation**: All public APIs documented
- **Performance**: No regressions vs baseline

### Review Checklist

Each agent follows specific checklists:

#### `typescript-engineer`
- [ ] Implementation meets requirements
- [ ] Code follows project conventions
- [ ] Error handling is comprehensive
- [ ] Performance is acceptable
- [ ] Security considerations addressed

#### `typescript-test-engineer`
- [ ] Tests cover all scenarios
- [ ] Test descriptions are clear
- [ ] Edge cases are included
- [ ] Tests are maintainable
- [ ] Coverage targets met

#### `typescript-code-reviewer`
- [ ] Code is correct and safe
- [ ] TypeScript best practices followed
- [ ] Architecture is sound
- [ ] No obvious bugs or issues
- [ ] Integration points are proper

#### `typescript-quality-checker`
- [ ] Code quality standards met
- [ ] Documentation is complete
- [ ] Refactoring opportunities identified
- [ ] Maintainability is high
- [ ] Technical debt is minimal

## Agent Evolution

### Learning and Adaptation

Agents improve over time by:
- Learning from code review patterns
- Adapting to project conventions
- Incorporating feedback from previous tasks
- Staying updated with TypeScript best practices

### Customization

Agent behavior can be customized through:
- Project-specific configuration
- Custom review criteria
- Specialized test patterns
- Tailored quality metrics

---

This agent configuration ensures consistent, high-quality development of the opencode-codex-provider plugin while maintaining strict adherence to test-driven development principles and TypeScript best practices.