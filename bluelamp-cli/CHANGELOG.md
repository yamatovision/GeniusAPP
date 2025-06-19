# Changelog

All notable changes to BlueLamp CLI will be documented in this file.

## [1.2.0] - 2025-06-19

### Added
- **統合アーキテクチャ**: すべてのエージェントを`bluelamp`コマンドで統一
- **16個のエージェント定義**: 開発、デザイン、計画、分析、テスト、ドキュメントの各カテゴリ
- **コマンドライン引数サポート**: 
  - `bluelamp agent <name>` - 特定のエージェントを起動
  - `bluelamp list` - エージェント一覧表示
  - `bluelamp list --category <category>` - カテゴリでフィルタ
- **エイリアスサポート**: `bluelamp mock`のような短縮形で起動可能
- **Commander.js統合**: より高度なCLI機能

### Changed
- アーキテクチャを統合型に変更（UnifiedCLIクラス）
- mockup-analyzer.tsを統合し、単一のエントリポイントに
- エージェント定義を`config/agents.ts`に一元化

### Removed
- `bluelamp-mockup`コマンド（`bluelamp agent mockup`に統合）
- 不要な個別ファイル（mockup-analyzer.ts、autonomous-agent.tsなど）

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