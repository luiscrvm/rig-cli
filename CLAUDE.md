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
rig logs            # Explore application logs
rig --version       # Check version
rig --help          # Show available commands

# Logs Command Usage

## Local Logs (Default Behavior)
```bash
rig logs                    # Display all local logs
rig logs --limit 10         # Display last 10 log entries
rig logs --error            # Display only error logs
rig logs --export json      # Export logs to JSON file
rig logs --export csv       # Export logs to CSV file
rig logs --resource <id>    # Filter logs for specific resource
rig logs --limit 10 --error --resource "compute.googleapis.com"  # Combine filters
```

## GCP Cloud Logging Integration

### Basic Cloud Logging Commands
```bash
# Fetch recent logs from Cloud Logging
rig logs --cloud                           # Last 100 logs from past 24 hours
rig logs --cloud --limit 20                # Limit to 20 most recent entries
rig logs --cloud --since 1h                # Logs from last hour
rig logs --cloud --since 6h                # Logs from last 6 hours
rig logs --cloud --since 3d                # Logs from last 3 days
```

### Filtering by Severity Level
```bash
rig logs --cloud --error                   # ERROR and CRITICAL logs only
rig logs --cloud --severity WARNING        # WARNING, ERROR, and CRITICAL logs
rig logs --cloud --severity INFO           # INFO and above (excludes DEBUG)
rig logs --cloud --severity DEBUG          # All logs including DEBUG
```

### Resource-Based Filtering
```bash
# Filter by GCP resource types
rig logs --cloud --resource cloudsql       # Cloud SQL database logs
rig logs --cloud --resource compute        # Compute Engine logs
rig logs --cloud --resource kubernetes     # GKE cluster logs
rig logs --cloud --resource storage        # Cloud Storage logs

# Filter by specific resource names
rig logs --cloud --resource "my-vm-instance"     # Specific VM instance
rig logs --cloud --resource "my-app-cluster"     # Specific GKE cluster
```

### Advanced Filtering & Export
```bash
# Combine multiple filters
rig logs --cloud --error --since 12h --limit 25              # Recent errors
rig logs --cloud --severity WARNING --resource cloudsql      # SQL warnings
rig logs --cloud --since 2h --resource compute --limit 15    # Recent compute logs

# Export cloud logs
rig logs --cloud --limit 50 --export json     # Export to timestamped JSON file
rig logs --cloud --error --export csv         # Export errors to CSV
```

### Debugging & Analysis
```bash
# Debug mode - see complete log structure
rig logs --cloud --limit 1 --debug            # View raw GCP log entry format
rig logs --cloud --resource cloudsql --debug  # Debug specific resource logs

# Project-specific logging
rig logs --cloud --project my-other-project   # Use different GCP project
```

### Real-World Examples
```bash
# Monitor application health
rig logs --cloud --error --since 1h --limit 10

# Investigate database issues  
rig logs --cloud --resource cloudsql --severity WARNING --since 6h

# Export security audit logs
rig logs --cloud --resource "audit" --since 24h --export json

# Quick infrastructure overview
rig logs --cloud --limit 20

# Troubleshoot recent deployment
rig logs --cloud --resource kubernetes --since 30m --limit 15
```
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