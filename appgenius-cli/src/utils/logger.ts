import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { LogLevel } from '../types';

/**
 * AppGeniusロガークラス
 * ログレベルに応じたログの出力を管理
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logFile?: string;

  private constructor() {
    // シングルトンインスタンス
  }

  /**
   * ロガーインスタンスを取得
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * ログファイルを設定
   */
  public setLogFile(filePath: string): void {
    this.logFile = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.info(`ログファイルを設定しました: ${filePath}`);
  }

  /**
   * ログレベルを設定
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`ログレベルを設定しました: ${level}`);
  }

  /**
   * デバッグレベルのログを出力
   */
  public debug(message: string, data?: any): void {
    if (this.logLevel === LogLevel.DEBUG) {
      this.log('debug', message, data);
    }
  }

  /**
   * 情報レベルのログを出力
   */
  public info(message: string, data?: any): void {
    if (
      this.logLevel === LogLevel.DEBUG || 
      this.logLevel === LogLevel.INFO
    ) {
      this.log('info', message, data);
    }
  }

  /**
   * 警告レベルのログを出力
   */
  public warn(message: string, data?: any): void {
    if (
      this.logLevel === LogLevel.DEBUG || 
      this.logLevel === LogLevel.INFO || 
      this.logLevel === LogLevel.WARN
    ) {
      this.log('warn', message, data);
    }
  }

  /**
   * エラーレベルのログを出力
   */
  public error(message: string, error?: Error, data?: any): void {
    this.log('error', message, data);
    if (error) {
      this.log('error', `エラー詳細: ${error.message}`);
      if (error.stack) {
        this.log('error', `スタックトレース: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
    }
  }

  /**
   * ログを出力
   */
  private log(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // コンソール出力用のカラー設定
    let colorizedMessage: string;
    switch (level) {
      case 'debug':
        colorizedMessage = chalk.gray(logMessage);
        break;
      case 'info':
        colorizedMessage = chalk.blue(logMessage);
        break;
      case 'warn':
        colorizedMessage = chalk.yellow(logMessage);
        break;
      case 'error':
        colorizedMessage = chalk.red(logMessage);
        break;
      default:
        colorizedMessage = logMessage;
    }
    
    // データオブジェクトの処理
    if (data !== undefined) {
      try {
        if (typeof data === 'object' && data !== null) {
          const dataString = JSON.stringify(data, null, 2);
          logMessage += `\n${dataString}`;
          colorizedMessage += `\n${level === 'error' ? chalk.red(dataString) : dataString}`;
        } else {
          logMessage += ` ${data}`;
          colorizedMessage += ` ${data}`;
        }
      } catch (e) {
        logMessage += ' [シリアライズできないデータ]';
        colorizedMessage += ' [シリアライズできないデータ]';
      }
    }
    
    // コンソール出力
    console.log(colorizedMessage);
    
    // ファイル出力
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, logMessage + '\n');
      } catch (err) {
        console.error('ログファイルへの書き込みに失敗しました:', err);
      }
    }
  }
}

// 簡易アクセス用のエクスポート
export const logger = Logger.getInstance();