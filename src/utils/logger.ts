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
  private static logLevel: LogLevel = LogLevel.INFO; // INFO以上のレベルのみ出力するように設定
  private static logFilePath: string | undefined;

  public static initialize(extensionName: string, level: LogLevel = LogLevel.INFO, autoShow: boolean = false): void {
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
    
    // 設定がtrueの場合のみログウィンドウを表示
    if (autoShow) {
      this.show();
    }
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
    // ダッシュボードWebView関連のログはフィルタリング
    if (message.includes('ダッシュボードWebView更新: プロジェクト数=') ||
        message.includes('ダッシュボードWebViewを更新開始') ||
        message.includes('ダッシュボードWebView更新完了') ||
        message.includes('ダッシュボードWebViewからメッセージを受信') ||
        message.includes('拡張されたCURRENT_STATUS.mdファイルの監視を設定')) {
      return;
    }
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, data);
    }
  }

  public static warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, data);
    }
  }

  public static error(message: string, error?: Error, data?: any, autoShow: boolean = false): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message);
      
      if (error) {
        // 詳細なエラー情報をログに記録
        this.log('ERROR', `Error details: ${error.message}`);
        
        // AxiosエラーからHTTPステータスなどの詳細情報を抽出
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const axios = require('axios');
          if (axios && axios.isAxiosError && axios.isAxiosError(error)) {
            // axiosエラーとしてのプロパティにアクセスするため型アサーション
            const axiosError = error as any;
            
            if (axiosError.response) {
              const statusCode = axiosError.response?.status;
              const responseData = axiosError.response?.data;
              const requestUrl = axiosError.config?.url;
              const requestMethod = axiosError.config?.method;
              
              this.log('ERROR', `API Error: ${statusCode} ${requestMethod?.toUpperCase() || 'UNKNOWN'} ${requestUrl || 'UNKNOWN_URL'}`);
              
              if (responseData) {
                try {
                  const formattedData = typeof responseData === 'object' 
                    ? JSON.stringify(responseData, null, 2)
                    : responseData;
                  this.log('ERROR', `Response data: ${formattedData}`);
                } catch (e) {
                  this.log('ERROR', `Response data: [非シリアル化データ]`);
                }
              }
            }
          }
        } catch (e) {
          // axiosモジュールが読み込めない場合は何もしない
        }
        
        if (error.stack) {
          this.log('ERROR', `Stack trace: ${error.stack}`);
        }
      }
      
      if (data) {
        this.log('ERROR', 'Additional data:', data);
      }
      
      // エラー時には設定に応じてログウィンドウを表示（デフォルトで非表示に変更）
      if (autoShow) {
        this.show();
      }
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