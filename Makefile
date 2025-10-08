# opencode-codex-provider Makefile
# Zero-patch plugin for opencode CLI

.PHONY: help build test test-watch test-unit test-integration test-coverage lint lint-fix typecheck clean install dev benchmark agents docs publish publish-beta

# Default target
help:
	@echo "opencode-codex-provider - Zero-Patch Plugin"
	@echo ""
	@echo "Available commands:"
	@echo "  help           - Show this help message"
	@echo "  install        - Install dependencies"
	@echo "  build          - Build TypeScript to JavaScript"
	@echo "  test           - Run all tests"
	@echo "  test-watch     - Run tests in watch mode"
	@echo "  test-unit      - Run unit tests only"
	@echo "  test-integration - Run integration tests only"
	@echo "  test-coverage  - Run tests with coverage report"
	@echo "  lint           - Run linter"
	@echo "  lint-fix       - Fix linting issues automatically"
	@echo "  typecheck      - Run TypeScript type checking"
	@echo "  clean          - Clean build artifacts"
	@echo "  dev            - Start development mode"
	@echo "  benchmark      - Run performance benchmarks"
	@echo "  agents         - Show agent configuration"
	@echo "  docs           - Generate documentation"
	@echo "  publish        - Publish package to npm"
	@echo "  publish-beta   - Publish package to npm with beta tag"
	@echo ""
	@echo "Examples:"
	@echo "  make install && make test"
	@echo "  make dev"
	@echo "  make build && make lint"

# Install dependencies
install:
	@echo "Installing dependencies..."
	bun install

# Build TypeScript
build:
	@echo "Building TypeScript..."
	bun build ./index.ts --outdir ./dist --target node --format esm
	@echo "Build complete"

# Run all tests
test:
	@echo "Running all tests..."
	bun test
	@echo "All tests complete"

# Run tests in watch mode
test-watch:
	@echo "Running tests in watch mode..."
	bun test --watch

# Run unit tests only
test-unit:
	@echo "Running unit tests..."
	bun test tests/unit

# Run integration tests only
test-integration:
	@echo "Running integration tests..."
	bun test tests/integration

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	bun test --coverage

# Run linter
lint:
	@echo "Running linter..."
	bun run lint

# Fix linting issues
lint-fix:
	@echo "Fixing linting issues..."
	bun run lint:fix

# Run TypeScript type checking
typecheck:
	@echo "Running TypeScript type checking..."
	bun run typecheck

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf node_modules/.cache
	@echo "Clean complete"

# Development mode
dev:
	@echo "Starting development mode..."
	bun run dev

# Run performance benchmarks
benchmark:
	@echo "Running performance benchmarks..."
	bun test tests/performance

# Quick validation (build + test + lint)
validate: build test lint
	@echo "Validation complete"

# Release preparation
prep-release: clean install build test
	@echo "Release preparation complete"

# Show test status
status:
	@echo "Test Status:"
	@bun test --reporter=verbose 2>/dev/null | grep -E "(pass|fail|✓|✗)" || echo "Run 'make test' to see status"

# Install plugin in local opencode workspace
install-local:
	@echo "Installing plugin in local opencode workspace..."
	@if [ -d "../opencode" ]; then \
		cd ../opencode && \
		bun add file:../opencode-codex-provider && \
		echo "Plugin installed in opencode workspace"; \
	else \
		echo "Error: opencode workspace not found at ../opencode"; \
		exit 1; \
	fi

# Uninstall plugin from local opencode workspace
uninstall-local:
	@echo "Uninstalling plugin from local opencode workspace..."
	@if [ -d "../opencode" ]; then \
		cd ../opencode && \
		bun remove opencode-codex-provider && \
		echo "Plugin uninstalled from opencode workspace"; \
	else \
		echo "Error: opencode workspace not found at ../opencode"; \
		exit 1; \
	fi

# Run integration with local opencode
test-integration-local:
	@echo "Testing integration with local opencode..."
	@if [ -d "../opencode/opencode" ]; then \
		cd ../opencode/opencode && \
		bun run dev --print-logs --log-level DEBUG run "test integration" && \
		echo "Integration test complete"; \
	else \
		echo "Error: opencode binary not found at ../opencode/opencode"; \
		exit 1; \
	fi

# Show agent configuration
agents:
	@echo "Agent Configuration:"
	@echo "==================="
	@cat AGENTS.md

# Generate documentation
docs:
	@echo "Generating documentation..."
	@if [ -f "package.json" ]; then \
		echo "README.md - Main documentation" && \
		echo "AGENTS.md - Agent configuration" && \
		echo "Available docs:" && \
		ls -la *.md 2>/dev/null || echo "No markdown files found"; \
	else \
		echo "Error: package.json not found"; \
	fi

# Publish to npm
publish: prep-release
	@echo "Publishing to npm..."
	npm publish
	@echo "Published successfully"

# Publish to npm with beta tag
publish-beta: prep-release
	@echo "Publishing to npm with beta tag..."
	npm publish --tag beta
	@echo "Published successfully as beta"
