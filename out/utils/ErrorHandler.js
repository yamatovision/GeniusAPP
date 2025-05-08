"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.ErrorCategory = exports.ErrorSeverity = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
/**
 * エラー種別を定義する列挙型
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "info";
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["CRITICAL"] = "critical"; // 致命的エラー（アプリケーション全体が影響を受ける）
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * エラーカテゴリを定義する列挙型
 */
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["AUTH"] = "auth";
    ErrorCategory["API"] = "api";
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["INTERNAL"] = "internal";
    ErrorCategory["IO"] = "io";
    ErrorCategory["UNKNOWN"] = "unknown"; // 未分類エラー
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
/**
 * グローバルエラーハンドラー - アプリケーション全体のエラー処理を一元管理するクラス
 */
class ErrorHandler {
    /**
     * ErrorHandlerのシングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    constructor() {
        this._errorHistory = [];
        this._maxHistoryLength = 50;
        this._lastError = null;
        this._onError = new vscode.EventEmitter();
        /**
         * エラー発生時のイベント
         */
        this.onError = this._onError.event;
        logger_1.Logger.info('グローバルエラーハンドラーが初期化されました');
    }
    /**
     * エラー処理メソッド - すべてのエラーはこのメソッドを通じて処理される
     * @param error 処理対象のエラー
     * @param source エラー発生元
     * @returns 標準化されたAppErrorオブジェクト
     */
    handleError(error, source = 'unknown') {
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
    _normalizeError(error, source) {
        // Axiosエラーの場合
        if (axios_1.default.isAxiosError(error)) {
            return this._normalizeAxiosError(error, source);
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
    _normalizeAxiosError(error, source) {
        const statusCode = error.response?.status;
        const data = error.response?.data;
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
                    }
                    else {
                        code = data?.code || `http_${statusCode}`;
                        message = data?.message || 'APIエラーが発生しました';
                        isRetryable = statusCode < 400 || statusCode >= 500;
                    }
            }
        }
        else if (error.request) {
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
    _addToHistory(error) {
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
    _logError(error) {
        const logMessage = `[${error.category.toUpperCase()}] ${error.code}: ${error.message}`;
        switch (error.severity) {
            case ErrorSeverity.INFO:
                const errorObj = new Error(error.message);
                logger_1.Logger.info(logMessage, errorObj);
                break;
            case ErrorSeverity.WARNING:
                const warnErrorObj = new Error(error.message);
                logger_1.Logger.warn(logMessage, warnErrorObj);
                break;
            case ErrorSeverity.ERROR:
            case ErrorSeverity.CRITICAL:
                const criticalErrorObj = new Error(error.message);
                logger_1.Logger.error(logMessage, criticalErrorObj);
                if (error.detail) {
                    logger_1.Logger.debug(`エラー詳細: ${error.detail}`);
                }
                break;
        }
    }
    /**
     * ユーザーに通知
     * @param error 通知するエラー
     */
    _notifyUser(error) {
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
    getErrorHistory(limit, category) {
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
    getLastError() {
        return this._lastError;
    }
    /**
     * エラーの重大度をマッピング
     * @param severity 元の重大度
     */
    _mapSeverity(severity) {
        if (!severity)
            return ErrorSeverity.ERROR;
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
    _mapCategory(category) {
        if (!category)
            return ErrorCategory.UNKNOWN;
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
    isRetryableErrorCode(code) {
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
    isRetryableStatusCode(statusCode) {
        // 429: Too Many Requests, 5xx: サーバーエラー
        return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
    }
    /**
     * リソースの解放
     */
    dispose() {
        this._onError.dispose();
        this._errorHistory = [];
        this._lastError = null;
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=ErrorHandler.js.map