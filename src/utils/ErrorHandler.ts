import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import { Logger } from './logger';

/**
 * エラー種別を定義する列挙型
 */
export enum ErrorSeverity {
  INFO = 'info',       // 情報提供のみ
  WARNING = 'warning', // 警告（処理は続行可能）
  ERROR = 'error',     // エラー（機能の一部が使用不可）
  CRITICAL = 'critical' // 致命的エラー（アプリケーション全体が影響を受ける）
}

/**
 * エラーカテゴリを定義する列挙型
 */
export enum ErrorCategory {
  NETWORK = 'network',   // ネットワーク関連エラー
  AUTH = 'auth',         // 認証関連エラー
  API = 'api',           // API関連エラー
  VALIDATION = 'validation', // 入力検証エラー
  INTERNAL = 'internal', // 内部エラー
  IO = 'io',             // ファイル操作などのI/Oエラー
  UNKNOWN = 'unknown'    // 未分類エラー
}

/**
 * アプリケーションエラー情報インターフェース
 * 標準のErrorインターフェースに準拠
 */
export interface AppError {
  name: string;           // エラー名（標準Errorインターフェース要件）
  code: string;           // エラーコード
  message: string;        // ユーザー向けエラーメッセージ
  detail?: string;        // 詳細情報（開発者向け）
  severity: ErrorSeverity; // エラーの重大度
  category: ErrorCategory; // エラーのカテゴリ
  timestamp: number;      // エラー発生時刻
  isRetryable: boolean;   // リトライ可能かどうか
  source?: string;        // エラー発生元
  statusCode?: number;    // HTTPステータスコード（APIエラー時）
  originalError?: any;    // 元のエラーオブジェクト（内部利用のみ）
}

/**
 * グローバルエラーハンドラー - アプリケーション全体のエラー処理を一元管理するクラス
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private _errorHistory: AppError[] = [];
  private _maxHistoryLength: number = 50;
  private _lastError: AppError | null = null;
  private _onError = new vscode.EventEmitter<AppError>();
  
  /**
   * ErrorHandlerのシングルトンインスタンスを取得
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * エラー発生時のイベント
   */
  public readonly onError = this._onError.event;
  
  private constructor() {
    Logger.info('グローバルエラーハンドラーが初期化されました');
  }
  
  /**
   * エラー処理メソッド - すべてのエラーはこのメソッドを通じて処理される
   * @param error 処理対象のエラー
   * @param source エラー発生元
   * @returns 標準化されたAppErrorオブジェクト
   */
  public handleError(error: any, source: string = 'unknown'): AppError {
    // エラーの種類によって適切な処理を行う
    const appError = this._normalizeError(error, source);
    
    // エラー履歴に追加
    this._addToHistory(appError);
    
    // 最後のエラーとして記録
    this._lastError = appError;
    
    // ログに出力
    this._logError(appError);
    
    // 通知が必要なエラーの場合はユーザーに通知
    if (appError.severity === ErrorSeverity.ERROR || 
        appError.severity === ErrorSeverity.CRITICAL) {
      this._notifyUser(appError);
    }
    
    // エラーイベントを発行
    this._onError.fire(appError);
    
    return appError;
  }
  
  /**
   * エラーオブジェクトを標準形式に正規化
   * @param error 元のエラーオブジェクト
   * @param source エラー発生元
   * @returns 標準化されたAppErrorオブジェクト
   */
  private _normalizeError(error: any, source: string): AppError {
    // Axiosエラーの場合
    if (axios.isAxiosError(error)) {
      return this._normalizeAxiosError(error as AxiosError, source);
    }
    
    // 一般的なJavaScriptエラーの場合
    if (error instanceof Error) {
      return {
        name: error.name || 'Error',
        code: error.name || 'unknown_error',
        message: error.message || 'エラーが発生しました',
        detail: error.stack,
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.INTERNAL,
        timestamp: Date.now(),
        isRetryable: false,
        source,
        originalError: error
      };
    }
    
    // 文字列の場合
    if (typeof error === 'string') {
      return {
        name: 'StringError',
        code: 'string_error',
        message: error,
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.UNKNOWN,
        timestamp: Date.now(),
        isRetryable: false,
        source
      };
    }
    
    // オブジェクトの場合
    if (typeof error === 'object' && error !== null) {
      const code = error.code || error.errorCode || 'unknown_error';
      return {
        name: `ObjectError_${code}`,
        code: code,
        message: error.message || error.errorMessage || '不明なエラーが発生しました',
        detail: error.detail || error.errorDetail || JSON.stringify(error),
        severity: this._mapSeverity(error.severity),
        category: this._mapCategory(error.category),
        timestamp: Date.now(),
        isRetryable: !!error.isRetryable,
        source,
        statusCode: error.statusCode || error.status,
        originalError: error
      };
    }
    
    // その他の場合 (プリミティブなど)
    return {
      name: 'UnknownError',
      code: 'unknown_error',
      message: '不明なエラーが発生しました',
      detail: String(error),
      severity: ErrorSeverity.ERROR,
      category: ErrorCategory.UNKNOWN,
      timestamp: Date.now(),
      isRetryable: false,
      source
    };
  }
  
  /**
   * Axiosエラーを標準形式に正規化
   * @param error Axiosエラーオブジェクト
   * @param source エラー発生元
   * @returns 標準化されたAppErrorオブジェクト
   */
  private _normalizeAxiosError(error: AxiosError, source: string): AppError {
    const statusCode = error.response?.status;
    const data = error.response?.data as any;
    
    let code = 'network_error';
    let message = 'ネットワークエラーが発生しました';
    let category = ErrorCategory.NETWORK;
    let isRetryable = true;
    
    // レスポンスがある場合はAPIエラー
    if (statusCode) {
      category = ErrorCategory.API;
      
      // ステータスコードに応じた処理
      switch (statusCode) {
        case 400:
          code = data?.code || 'invalid_request';
          message = data?.message || '無効なリクエストです';
          isRetryable = false;
          break;
        case 401:
          code = data?.code || 'unauthorized';
          message = data?.message || '認証が必要です';
          category = ErrorCategory.AUTH;
          isRetryable = false;
          break;
        case 403:
          code = data?.code || 'forbidden';
          message = data?.message || 'アクセス権限がありません';
          category = ErrorCategory.AUTH;
          isRetryable = false;
          break;
        case 404:
          code = data?.code || 'not_found';
          message = data?.message || '要求されたリソースが見つかりません';
          isRetryable = false;
          break;
        case 429:
          code = data?.code || 'rate_limited';
          message = data?.message || 'リクエスト制限を超えました。しばらく待ってから再試行してください';
          isRetryable = true;
          break;
        default:
          if (statusCode >= 500 && statusCode < 600) {
            code = data?.code || 'server_error';
            message = data?.message || 'サーバーエラーが発生しました';
            isRetryable = true;
          } else {
            code = data?.code || `http_${statusCode}`;
            message = data?.message || 'APIエラーが発生しました';
            isRetryable = statusCode < 400 || statusCode >= 500;
          }
      }
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない場合
      code = 'no_response';
      message = 'サーバーからの応答がありません';
      isRetryable = true;
    }
    
    // エラーの重大度を決定
    const severity = statusCode && statusCode >= 500 
      ? ErrorSeverity.ERROR 
      : ErrorSeverity.WARNING;
    
    return {
      name: `AxiosError_${code}`,
      code,
      message,
      detail: JSON.stringify({
        url: error.config?.url,
        method: error.config?.method,
        status: statusCode,
        data: data
      }, null, 2),
      severity,
      category,
      timestamp: Date.now(),
      isRetryable,
      source,
      statusCode,
      originalError: error
    };
  }
  
  /**
   * エラー履歴に追加
   * @param error 追加するエラー
   */
  private _addToHistory(error: AppError): void {
    this._errorHistory.push(error);
    
    // 履歴が最大長を超えた場合は古いものを削除
    if (this._errorHistory.length > this._maxHistoryLength) {
      this._errorHistory.shift();
    }
  }
  
  /**
   * エラーをログに出力
   * @param error ログに出力するエラー
   */
  private _logError(error: AppError): void {
    const logMessage = `[${error.category.toUpperCase()}] ${error.code}: ${error.message}`;
    
    switch (error.severity) {
      case ErrorSeverity.INFO:
        const errorObj = new Error(error.message);
        Logger.info(logMessage, errorObj);
        break;
      case ErrorSeverity.WARNING:
        const warnErrorObj = new Error(error.message);
        Logger.warn(logMessage, warnErrorObj);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        const criticalErrorObj = new Error(error.message);
        Logger.error(logMessage, criticalErrorObj);
        if ((error as any).detail) {
          Logger.debug(`エラー詳細: ${(error as any).detail}`);
        }
        break;
    }
  }
  
  /**
   * ユーザーに通知
   * @param error 通知するエラー
   */
  private _notifyUser(error: AppError): void {
    // VSCodeの通知機能を使用
    const message = `${error.message}${error.code ? ` (${error.code})` : ''}`;
    
    switch (error.severity) {
      case ErrorSeverity.INFO:
        vscode.window.showInformationMessage(message);
        break;
      case ErrorSeverity.WARNING:
        vscode.window.showWarningMessage(message);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        vscode.window.showErrorMessage(message);
        break;
    }
  }
  
  /**
   * エラー履歴を取得
   * @param limit 取得する履歴の数（デフォルトは全件）
   * @param category フィルタするカテゴリ（オプション）
   */
  public getErrorHistory(limit?: number, category?: ErrorCategory): AppError[] {
    let history = [...this._errorHistory];
    
    // カテゴリでフィルタ
    if (category) {
      history = history.filter(error => error.category === category);
    }
    
    // 最新のエラーを先頭にする
    history.reverse();
    
    // 指定された数に制限
    if (limit && limit > 0) {
      history = history.slice(0, limit);
    }
    
    return history;
  }
  
  /**
   * 最後のエラーを取得
   */
  public getLastError(): AppError | null {
    return this._lastError;
  }
  
  /**
   * エラーの重大度をマッピング
   * @param severity 元の重大度
   */
  private _mapSeverity(severity: any): ErrorSeverity {
    if (!severity) return ErrorSeverity.ERROR;
    
    if (typeof severity === 'string') {
      switch (severity.toLowerCase()) {
        case 'info': return ErrorSeverity.INFO;
        case 'warning': return ErrorSeverity.WARNING;
        case 'error': return ErrorSeverity.ERROR;
        case 'critical': return ErrorSeverity.CRITICAL;
      }
    }
    
    return ErrorSeverity.ERROR;
  }
  
  /**
   * エラーのカテゴリをマッピング
   * @param category 元のカテゴリ
   */
  private _mapCategory(category: any): ErrorCategory {
    if (!category) return ErrorCategory.UNKNOWN;
    
    if (typeof category === 'string') {
      switch (category.toLowerCase()) {
        case 'network': return ErrorCategory.NETWORK;
        case 'auth': return ErrorCategory.AUTH;
        case 'api': return ErrorCategory.API;
        case 'validation': return ErrorCategory.VALIDATION;
        case 'internal': return ErrorCategory.INTERNAL;
        case 'io': return ErrorCategory.IO;
      }
    }
    
    return ErrorCategory.UNKNOWN;
  }
  
  /**
   * 特定のエラーコードがリトライ可能かどうかを判定
   * @param code エラーコード
   */
  public isRetryableErrorCode(code: string): boolean {
    const retryableCodes = [
      'network_error',
      'timeout',
      'server_error',
      'rate_limited',
      'no_response',
      'connection_error',
      'temporary_error'
    ];
    
    return retryableCodes.includes(code);
  }
  
  /**
   * APIレスポンスのステータスコードがリトライ可能かどうかを判定
   * @param statusCode HTTPステータスコード
   */
  public isRetryableStatusCode(statusCode: number): boolean {
    // 429: Too Many Requests, 5xx: サーバーエラー
    return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this._onError.dispose();
    this._errorHistory = [];
    this._lastError = null;
  }
}