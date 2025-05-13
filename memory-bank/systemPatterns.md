# System Patterns

This file documents the architectural patterns and design decisions used in the project.

[Initialized on 12.5.2025 13:07]
[2025-12-05 18:32:58] - Documentation Pattern:
When any file is modified, the Memory Bank must be updated with:
1. Timestamp in format [YYYY-MM-DD HH:MM:SS]
2. Description of changes
3. Files affected
4. Impact on system functionality

This ensures consistent tracking of all modifications and maintains a clear history of system evolution. Documentation updates should be reflected in memory-bank/progress.md with the same timestamp format.

Example format:
[YYYY-MM-DD HH:MM:SS] - Documentation Update:
- Files modified: [list of files]
- Changes made: [description]
- System impact: [impact details]