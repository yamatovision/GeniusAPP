import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static logLevel: LogLevel = LogLevel.DEBUG; // デバッグレベルを有効化
  private static logFilePath: string | undefined;

  public static initialize(extensionName: string, level: LogLevel = LogLevel.INFO): void {
    this.outputChannel = vscode.window.createOutputChannel(extensionName);
    this.logLevel = level;
    
    // ログファイルのパスを設定
    const homeDir = os.homedir();
    const logDir = path.join(homeDir, '.appgenius-ai', 'logs');
    
    // ログディレクトリが存在しない場合は作成
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch (err) {
        console.error('ログディレクトリの作成に失敗しました:', err);
      }
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    this.logFilePath = path.join(logDir, `appgenius-ai-${timestamp}.log`);
    
    this.info(`Logger initialized with level: ${LogLevel[level]}`);
    this.info(`ログファイル: ${this.logFilePath}`);
    
    // 常にログウィンドウを表示する（デバッグ用）
    this.show();
  }

  public static setLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level set to: ${LogLevel[level]}`);
  }

  public static debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  public static info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, data);
    }
  }

  public static warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, data);
    }
  }

  public static error(message: string, error?: Error, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message);
      if (error) {
        this.log('ERROR', `Error details: ${error.message}`);
        if (error.stack) {
          this.log('ERROR', `Stack trace: ${error.stack}`);
        }
      }
      if (data) {
        this.log('ERROR', 'Additional data:', data);
      }
      
      // エラー時には自動的にログウィンドウを表示
      this.show();
    }
  }

  private static log(level: string, message: string, data?: any): void {
    if (!this.outputChannel) {
      // フォールバック: 初期化前にログが呼ばれた場合
      console.log(`[${level}] ${message}`);
      return;
    }

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      // オブジェクトや配列の場合はJSON文字列化
      if (typeof data === 'object' && data !== null) {
        try {
          logMessage += `\n${JSON.stringify(data, null, 2)}`;
        } catch (e) {
          logMessage += `\n[非シリアル化オブジェクト: ${typeof data}]`;
        }
      } else {
        logMessage += `\n${data}`;
      }
    }
    
    // コンソール出力
    this.outputChannel.appendLine(logMessage);
    
    // ファイル出力
    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, logMessage + '\n');
      } catch (err) {
        console.error('ログファイルへの書き込みに失敗しました:', err);
      }
    }
  }

  public static show(): void {
    if (this.outputChannel) {
      this.outputChannel.show(true); // preserveFocus=true
    }
  }

  public static dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
    }
  }
  
  public static getLogFilePath(): string | undefined {
    return this.logFilePath;
  }
  
  public static async readLogFile(): Promise<string> {
    if (!this.logFilePath) {
      return 'ログファイルが設定されていません';
    }
    
    try {
      return await fs.promises.readFile(this.logFilePath, 'utf-8');
    } catch (err) {
      this.error('ログファイルの読み取りに失敗しました', err as Error);
      return `ログファイルの読み取りに失敗しました: ${(err as Error).message}`;
    }
  }
}