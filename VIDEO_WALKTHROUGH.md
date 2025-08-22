# Rig CLI Video Walkthrough Script

## Video Flow: "Rig CLI - Multi-Cloud Infrastructure Management with AI Assistance"

**Duration**: ~8-10 minutes  
**Target Audience**: DevOps engineers, Cloud architects, SREs

---

## Opening (30 seconds)

### Scene 1: Introduction
**Action**: Show terminal with clean workspace
```bash
# Start with clean terminal
clear
```

**Narration**: "Meet Rig CLI - a powerful multi-cloud infrastructure management tool with AI assistance. Today I'll show you how to explore cloud logs, manage resources, and troubleshoot issues across your infrastructure."

---

## Section 1: Setup & Initialization (1 minute)

### Scene 2: Show Tool Overview
```bash
# Display the tool banner and help
rig --help
```

**Narration**: "Rig CLI provides a unified interface for managing AWS, GCP, and Azure resources. Let's start by initializing our environment."

### Scene 3: Initialize Tool
```bash
# Initialize and configure
rig init
```
**Action**: Select GCP, choose project, configure region
**Narration**: "The init command walks you through cloud provider setup. I'll select GCP and configure my project settings."

---

## Section 2: Local Logs Exploration (1 minute)

### Scene 4: Local Logs
```bash
# Show local logs first
rig logs --limit 5
```

**Narration**: "Rig CLI can explore both local application logs and cloud infrastructure logs. Here are recent local logs from the CLI itself."

```bash
# Show error logs
rig logs --error --limit 3
```

**Narration**: "We can filter for specific log levels and export data for analysis."

---

## Section 3: Cloud Logging Deep Dive (3 minutes)

### Scene 5: Basic Cloud Logging
```bash
# Basic cloud logging
rig logs --cloud --limit 10
```

**Narration**: "Now let's explore GCP Cloud Logging. This command fetches the 10 most recent logs from our cloud infrastructure."

**Action**: Point out the structured output showing timestamp, severity, resource type, and detailed messages

### Scene 6: Time-based Filtering
```bash
# Recent logs
rig logs --cloud --since 1h --limit 8
```

**Narration**: "We can filter by time periods. Here are logs from the last hour."

```bash
# Longer timeframe
rig logs --cloud --since 6h --limit 15
```

### Scene 7: Severity Filtering
```bash
# Error logs only
rig logs --cloud --error --limit 5
```

**Narration**: "Let's look for any recent errors in our infrastructure."

```bash
# Warning and above
rig logs --cloud --severity WARNING --since 12h --limit 10
```

**Narration**: "We can also filter by severity levels - here are warnings and errors from the last 12 hours."

### Scene 8: Resource-Specific Filtering
```bash
# Database logs
rig logs --cloud --resource cloudsql --limit 8
```

**Narration**: "We can filter by specific GCP resource types. Here are Cloud SQL database logs showing automated backup operations."

```bash
# Compute logs
rig logs --cloud --resource compute --since 2h --limit 5
```

### Scene 9: Debug Mode
```bash
# Debug mode to see raw structure
rig logs --cloud --limit 1 --debug
```

**Narration**: "The debug mode shows the complete log entry structure, perfect for understanding the data format and building custom analysis tools."

---

## Section 4: Advanced Features (2 minutes)

### Scene 10: Complex Filtering
```bash
# Combine multiple filters
rig logs --cloud --error --since 6h --resource cloudsql --limit 5
```

**Narration**: "We can combine multiple filters for precise log exploration. Here we're looking for database errors in the last 6 hours."

```bash
# Real monitoring scenario
rig logs --cloud --severity WARNING --since 2h --limit 12
```

**Narration**: "This is perfect for monitoring - checking for any warnings or errors in the last 2 hours."

### Scene 11: Export Capabilities
```bash
# Export to JSON
rig logs --cloud --limit 25 --export json
```

**Action**: Show the created file
```bash
ls -la logs-export-*.json
```

**Narration**: "All log data can be exported to JSON or CSV for further analysis, reporting, or integration with other tools."

```bash
# Quick look at exported data
head -20 logs-export-*.json
```

### Scene 12: Help & Discovery
```bash
# Show all available options
rig logs --help
```

**Narration**: "The help system shows all available options for filtering, exporting, and customizing your log exploration."

---

## Section 5: Interactive Mode Preview (1 minute)

### Scene 13: Interactive Mode
```bash
# Launch interactive mode
rig interactive
```

**Action**: Navigate through the interactive menus briefly
- Show main menu
- Navigate to Cloud Management
- Show GCP resources briefly
- Return to logs option

**Narration**: "Rig also offers an interactive mode with guided workflows for infrastructure management, but that's a topic for another video."

**Action**: Exit interactive mode

---

## Section 6: Integration & Workflow (1 minute)

### Scene 14: Real-world Workflow
```bash
# Monitoring workflow example
echo "# Daily monitoring workflow"
echo "# 1. Check for any recent errors"
rig logs --cloud --error --since 24h --limit 10
```

```bash
echo "# 2. Review infrastructure warnings"
rig logs --cloud --severity WARNING --since 12h --limit 15
```

```bash
echo "# 3. Export detailed logs for analysis"
rig logs --cloud --since 24h --limit 100 --export json
echo "✅ Logs exported for analysis"
```

**Narration**: "This demonstrates a typical daily monitoring workflow - checking for errors, reviewing warnings, and exporting data for detailed analysis."

---

## Closing (30 seconds)

### Scene 15: Summary
```bash
# Show final command
rig --version
echo "🚀 Rig CLI - Your multi-cloud infrastructure companion"
```

**Narration**: "Rig CLI brings together local and cloud logging, resource management, and AI assistance in one powerful tool. Whether you're troubleshooting issues, monitoring infrastructure health, or analyzing trends, Rig CLI streamlines your DevOps workflows."

**Action**: Show GitHub/documentation link

---

## Technical Setup Notes

### Prerequisites for Recording:
1. **Terminal Setup**:
   - Use a clean terminal with good contrast
   - Font size: 14pt or larger for readability
   - Terminal width: ~120 characters

2. **Environment**:
   - GCP project with some activity/logs
   - `gcloud` CLI authenticated
   - Clean working directory

3. **Timing**:
   - Pause 2-3 seconds after each command for viewers to read output
   - Allow spinners to complete naturally
   - Keep steady pace but don't rush

### Screen Recording Tips:
- Record at 1080p minimum
- Use cursor highlighting for important elements
- Consider picture-in-picture for face cam if desired
- Record audio separately for better quality

### Command Preparation:
```bash
# Pre-test all commands to ensure they work
# Clear terminal history: history -c
# Ensure proper project is selected: gcloud config get-value project
# Verify logs exist: gcloud logging read --limit=1
```

### Backup Commands (if primary demos fail):
```bash
# Alternative time ranges if no recent logs
rig logs --cloud --since 7d --limit 10
rig logs --cloud --since 30d --limit 5

# Alternative resources if cloudsql not available
rig logs --cloud --resource gce_instance
rig logs --cloud --resource global
```

---

## Key Messages to Emphasize:

1. **Unified Interface**: One tool for multiple cloud providers
2. **Powerful Filtering**: Time, severity, resource-based filtering
3. **Developer-Friendly**: Clean output, export capabilities, debug mode
4. **Real-world Utility**: Perfect for monitoring, troubleshooting, analysis
5. **Integration Ready**: Export formats work with existing tools

This walkthrough demonstrates practical DevOps scenarios while showcasing the tool's capabilities progressively from basic to advanced features.