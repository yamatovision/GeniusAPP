#!/usr/bin/env node

/**
 * AppGenius高度なツール使用CLI実行スクリプト - ClaudeCode互換版
 * 
 * 非技術者でも使いやすいように強化された拡張版ツールCLI
 * CLAUDE.md統合と拡張思考モードをサポート
 */
const { startEnhancedToolSession } = require('./commands/tool-cli');

// グローバルエラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
  process.exit(1);
});

// 引数処理
const args = process.argv.slice(2);
const useThinking = args.includes('--thinking') || args.includes('-t');
const useMemory = !args.includes('--no-memory');
const verbose = args.includes('--verbose') || args.includes('-v');
const offline = args.includes('--offline');

// CLI実行オプション
const options = {
  useThinking,  // 拡張思考モード
  useMemory,    // CLAUDE.md統合
  verbose,      // 詳細ログ
  offline       // オフラインモード
};

// 強化版CLI実行
startEnhancedToolSession(options)
  .then(() => {
    console.log('セッション終了 - AppGenius CLI');
    process.exit(0);
  })
  .catch((error) => {
    console.error('致命的なエラー:', error);
    process.exit(1);
  });