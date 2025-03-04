#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from './utils/logger';
import { configManager } from './utils/configManager';
import { registerCommands } from './commands';
import { LogLevel } from './types';
import os from 'os';
import path from 'path';
import readline from 'readline';

// 新しいモジュールをインポート
import { PlatformManager } from './utils/platformManager';
import { MessageBroker } from './utils/messageBroker';
import { ScopeExporter } from './utils/scopeExporter';

// バージョン情報
const VERSION = '0.1.0';

/**
 * 独自の入力ハンドラーを作成
 * VSCodeから実行された場合でも正しく動作するように
 */
function createCustomInputHandler() {
  // 標準入力がパイプされているかチェック
  const isStdinPiped = !process.stdin.isTTY;
  
  // VSCodeターミナルからの起動時はカスタム処理
  if (isStdinPiped || process.env.VSCODE_CLI) {
    logger.debug('パイプされた入力または特殊環境を検出しました。カスタム入力ハンドラーを使用します。');
    
    // 歓迎メッセージを直接表示(出力のみ、入力としては解釈されない)
    console.log(chalk.blue('AppGenius AI ターミナルへようこそ！'));
    console.log('コマンドを入力してください（例: /help）');
    console.log('');
    
    // 実際のコマンド解析や実行はここで行う
    // 注意: 標準入出力のリダイレクトが必要になる場合がある
  }
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  try {
    // コマンドオブジェクトの作成
    const program = new Command();
    
    // ロガーの初期化
    const logDir = path.join(os.homedir(), '.appgenius', 'logs');
    const logFile = path.join(logDir, 'appgenius-cli.log');
    logger.setLogFile(logFile);
    
    // 設定に基づいてログレベルを設定
    const config = configManager.getConfig();
    logger.setLogLevel(config.logLevel);
    
    // スタートアップメッセージ
    logger.info(`AppGenius CLI v${VERSION} を起動しています...`);
    
    // 新しいプラットフォーム関連機能の初期化
    try {
      // PlatformManagerを初期化
      PlatformManager.getInstance();
      logger.info('PlatformManager initialized successfully');
      
      // ScopeExporterを初期化
      ScopeExporter.getInstance();
      logger.info('ScopeExporter initialized successfully');
      
      // MessageBrokerを初期化
      MessageBroker.getInstance();
      logger.info('MessageBroker initialized successfully');
    } catch (error) {
      logger.warn('プラットフォーム機能の初期化に一部失敗しました', error as Error);
    }
    
    // VSCode連携の確認
    const platformManager = PlatformManager.getInstance();
    const vscodeEnv = platformManager.getVSCodeEnvironment();
    if (vscodeEnv.projectId) {
      logger.info(`VSCode連携を検出: プロジェクトID=${vscodeEnv.projectId}`);
    }
    
    // カスタム入力ハンドラを設定
    createCustomInputHandler();
    
    // コマンドの登録
    registerCommands(program);
    
    // チャットコマンドが単独で与えられた場合、対話モードを優先
    if (process.argv.length === 3 && process.argv[2] === 'chat') {
      logger.debug('チャットコマンドが検出されました。対話モードを開始します。');
      
      // プロジェクトルートに CLAUDE.md があるか確認
      const config = configManager.getConfig();
      const memoryFilePath = path.join(config.projectRoot, 'CLAUDE.md');
      
      const { InteractiveSession } = require('./services/interactiveSession');
      const session = new InteractiveSession({
        memoryFilePath: memoryFilePath
      });
      
      await session.start();
      return;
    }
    
    // コマンドラインの解析と実行
    await program.parseAsync(process.argv);
  } catch (error) {
    // 未処理のエラーをキャッチしてログに記録
    logger.error('未処理のエラーが発生しました', error as Error);
    console.error(chalk.red('予期しないエラーが発生しました:'), (error as Error).message);
    process.exit(1);
  }
}

// プログラムの実行
main().catch(error => {
  console.error(chalk.red('致命的なエラー:'), error);
  process.exit(1);
});