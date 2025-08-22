# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development workflow
npm install          # Install dependencies
npm link            # Make 'rig' command globally available
npm run dev         # Development mode with auto-reload
npm test            # Run tests
npm run lint        # Lint the codebase
npm start           # Run the CLI directly

# CLI usage after linking
rig init            # Initialize and configure cloud providers
rig interactive     # Start interactive mode
rig --version       # Check version
rig --help          # Show available commands
```

## Architecture Overview

Rig CLI is a Node.js ESM-based CLI tool for multi-cloud infrastructure management with AI assistance. The architecture follows a modular design with clear separation of concerns:

### Core Architecture Patterns

**Provider Pattern**: Cloud providers (AWS, GCP, Azure) implement a common interface through `CloudManager`. Currently only GCP is fully implemented, with AWS/Azure commented out in `src/core/cloudManager.js`.

**Command Pattern**: CLI commands are dynamically imported in `src/index.js` using Commander.js, with each command living in `src/commands/`.

**Authentication Strategy**: Uses native cloud SDKs rather than manual credential management. GCP authentication relies on `gcloud` CLI being installed and authenticated, handled by `GCloudAuth` class.

**AI Integration**: Supports multiple AI providers (Ollama, OpenAI, Anthropic) through a unified `AIAssistant` interface that delegates to provider-specific implementations.

### Key Components

**Entry Point** (`src/index.js`): Sets up Commander.js with dynamic imports for commands, displays ASCII art banner, configures dotenv.

**Cloud Management** (`src/core/cloudManager.js`): Central hub that routes cloud operations to appropriate provider implementations. Currently only `GCPProvider` is active.

**Authentication** (`src/auth/gcloudAuth.js`): Handles GCP authentication flow using native `gcloud` commands. Manages project selection, region configuration, and API enablement.

**Interactive Mode** (`src/core/interactive.js`): Provides guided CLI experience with two modes:
- Read-only mode (default): Safe exploration without infrastructure changes
- Management mode (opt-in): Full CRUD operations on cloud resources

**AI Assistant** (`src/core/aiAssistant.js`): Unified interface for AI providers, with fallback to local recommendations. Integrates with `OllamaAI` for local AI processing.

**Provider Implementations** (`src/providers/`): Cloud-specific logic using native SDKs. GCP provider uses `gcloud` CLI commands via `child_process.exec` rather than REST APIs.

### Configuration Management

**Environment-based**: Uses `.env` file for configuration, automatically updated by `gcloud auth` flow. Key variables:
- `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ACCOUNT`
- `AI_PROVIDER` (ollama/openai/anthropic)
- `OLLAMA_MODEL` for local AI

**Read-only First**: Default mode prevents accidental infrastructure changes. Users must explicitly enable management capabilities during init.

**State Management**: User context (provider, region, environment) maintained in interactive sessions.

### Important Implementation Details

**ESM Modules**: Entire codebase uses ES modules (`"type": "module"` in package.json). All imports use `.js` extensions.

**Error Handling**: Centralized logging via Winston (`src/utils/logger.js`). Providers gracefully degrade and provide fallbacks.

**CLI UX**: Extensive use of `inquirer` for interactive prompts, `chalk` for colored output, `ora` for spinners. Navigation includes "back" options throughout.

**Security Model**: No credential storage - relies on native cloud CLI authentication. APIs are enabled only when user explicitly opts into management mode.

### Branch Management

When implementing new features, create branches with descriptive names and commit/push/merge/delete following the established pattern in recent commits.

### Testing & Quality

Currently uses Jest for testing framework, ESLint for linting. Tests directory exists but test implementations need to be added.