/**
 * AppGenius用ロガークラス
 * VSCode出力チャネルへのロギングを提供
 */

import * as vscode from 'vscode';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * ダッシュボードWebView更新ログをフィルタするための文字列
 */
const DASHBOARD_UPDATE_LOG_FILTER = 'ダッシュボードWebView更新: プロジェクト数=';

/**
 * アプリケーション全体で使用するロガー
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static debugChannel: vscode.OutputChannel;
  private static name: string = 'AppGenius';
  private static level: LogLevel = LogLevel.INFO;
  private static autoShowOnError: boolean = true;
  private static initialized: boolean = false;

  /**
   * ロガーを初期化
   */
  public static initialize(
    name: string, 
    level: LogLevel = LogLevel.INFO, 
    autoShowOnError: boolean = true
  ): void {
    this.name = name;
    this.level = level;
    this.autoShowOnError = autoShowOnError;
    this.outputChannel = vscode.window.createOutputChannel(`${name} Log`);
    this.debugChannel = vscode.window.createOutputChannel(`${name} Debug`);
    this.initialized = true;
  }

  /**
   * デバッグレベルのログを出力
   */
  public static debug(message: string): void {
    this.ensureInitialized();
    if (this.level <= LogLevel.DEBUG) {
      // ダッシュボードWebView更新ログはフィルタリング
      if (message.includes(DASHBOARD_UPDATE_LOG_FILTER)) {
        return;
      }
      
      const logMessage = this.formatMessage(message, 'DEBUG');
      this.outputChannel.appendLine(logMessage);
      this.debugChannel.appendLine(logMessage);
    }
  }

  /**
   * 情報レベルのログを出力
   */
  public static info(message: string): void {
    this.ensureInitialized();
    if (this.level <= LogLevel.INFO) {
      // ダッシュボードWebView更新ログはフィルタリング
      if (message.includes(DASHBOARD_UPDATE_LOG_FILTER)) {
        return;
      }
      
      const logMessage = this.formatMessage(message, 'INFO');
      this.outputChannel.appendLine(logMessage);
      this.debugChannel.appendLine(logMessage);
    }
  }

  /**
   * 警告レベルのログを出力
   */
  public static warn(message: string, error?: Error): void {
    this.ensureInitialized();
    if (this.level <= LogLevel.WARN) {
      let logMessage = this.formatMessage(message, 'WARN');
      
      if (error) {
        logMessage += `\n${error.stack || error.message}`;
      }
      
      this.outputChannel.appendLine(logMessage);
      this.debugChannel.appendLine(logMessage);
    }
  }

  /**
   * エラーレベルのログを出力
   */
  public static error(message: string, error?: Error): void {
    this.ensureInitialized();
    if (this.level <= LogLevel.ERROR) {
      let logMessage = this.formatMessage(message, 'ERROR');
      
      if (error) {
        logMessage += `\n${error.stack || error.message}`;
      }
      
      this.outputChannel.appendLine(logMessage);
      this.debugChannel.appendLine(logMessage);
      
      if (this.autoShowOnError) {
        this.outputChannel.show(true);
      }
    }
  }

  /**
   * ログメッセージを整形
   */
  private static formatMessage(message: string, level: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  /**
   * ロガーが初期化されていることを確認
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize(this.name);
    }
  }

  /**
   * 出力チャネルを表示
   */
  public static show(): void {
    this.ensureInitialized();
    this.outputChannel.show();
  }

  /**
   * 出力チャネルを隠す
   */
  public static hide(): void {
    this.ensureInitialized();
    this.outputChannel.hide();
  }

  /**
   * ログレベルを設定
   */
  public static setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 現在のログレベルを取得
   */
  public static getLevel(): LogLevel {
    return this.level;
  }

  /**
   * エラー時に自動表示するかどうかを設定
   */
  public static setAutoShowOnError(autoShow: boolean): void {
    this.autoShowOnError = autoShow;
  }
}