# Changelog

All notable changes to BlueLamp CLI will be documented in this file.

## [1.1.0] - 2025-06-19

### Added
- Phase 1 implementation with 7 basic tools from Claude Code
- **Read Tool**: Read files with line numbers (cat -n format)
- **Write Tool**: Write files with automatic directory creation
- **Edit Tool**: String replacement in files with replace_all option
- **Bash Tool**: Execute commands with security filtering
- **Glob Tool**: Fast file pattern matching using fast-glob
- **Grep Tool**: Content search with regular expressions
- **LS Tool**: Directory listing with detailed file information
- New modular tool architecture with base Tool class
- Tool Manager system for dynamic tool registration
- Security features including command blocking and path validation

### Changed
- Refactored core architecture to support tool plugins
- Updated system prompt to use new tool definitions
- Improved error handling and user feedback

### Technical Details
- TypeScript implementation with strict typing
- Modular design for easy tool addition
- Compatible with Claude Code tool interface

## [1.0.0] - Initial Release

### Added
- Basic BlueLamp CLI functionality
- Simple file operations
- Anthropic Claude integration
- Prompt management system