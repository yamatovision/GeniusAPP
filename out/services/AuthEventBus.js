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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthEventBus = exports.AuthEventType = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
/**
 * 認証イベントの種類を定義する列挙型
 */
var AuthEventType;
(function (AuthEventType) {
    AuthEventType["LOGIN_SUCCESS"] = "login_success";
    AuthEventType["LOGIN_FAILED"] = "login_failed";
    AuthEventType["LOGOUT"] = "logout";
    AuthEventType["TOKEN_REFRESHED"] = "token_refreshed";
    AuthEventType["TOKEN_EXPIRED"] = "token_expired";
    AuthEventType["STATE_CHANGED"] = "state_changed";
    AuthEventType["AUTH_ERROR"] = "auth_error";
})(AuthEventType || (exports.AuthEventType = AuthEventType = {}));
/**
 * AuthEventBus - 認証関連のイベントを管理するサービス
 *
 * 認証状態の変更を監視し、拡張機能内の他のコンポーネントに通知します。
 * このクラスは認証関連のイベントの中央ハブとして機能します。
 */
class AuthEventBus {
    /**
     * コンストラクタ
     */
    constructor() {
        this._listeners = new Map();
        this._currentState = {
            isAuthenticated: false,
            timestamp: Date.now()
        };
        this._eventHistory = [];
        this._maxHistoryLength = 50;
        this._disposables = [];
        // イベントエミッター（VSCodeイベント連携用）
        this._onLogin = new vscode.EventEmitter();
        this._onLogout = new vscode.EventEmitter();
        this._onAuthError = new vscode.EventEmitter();
        this._onTokenRefresh = new vscode.EventEmitter();
        // VSCodeイベント
        this.onLogin = this._onLogin.event;
        this.onLogout = this._onLogout.event;
        this.onAuthError = this._onAuthError.event;
        this.onTokenRefresh = this._onTokenRefresh.event;
        // イベント履歴を初期化
        this._eventHistory = [];
        logger_1.Logger.info('認証イベントバスが初期化されました');
        // 状態変更イベントリスナーを登録
        this.on(AuthEventType.STATE_CHANGED, (event) => {
            if (event.payload) {
                this._currentState = {
                    ...this._currentState,
                    ...event.payload,
                    timestamp: Date.now()
                };
            }
        });
        // VSCodeイベントとの同期
        this.on(AuthEventType.LOGIN_SUCCESS, () => this._onLogin.fire());
        this.on(AuthEventType.LOGOUT, () => this._onLogout.fire());
        this.on(AuthEventType.AUTH_ERROR, (event) => {
            if (event.payload?.error?.message) {
                this._onAuthError.fire(event.payload.error.message);
            }
            else if (typeof event.payload?.message === 'string') {
                this._onAuthError.fire(event.payload.message);
            }
        });
        this.on(AuthEventType.TOKEN_REFRESHED, () => this._onTokenRefresh.fire());
    }
    /**
     * AuthEventBusのシングルトンインスタンスを取得
     */
    static getInstance() {
        if (!AuthEventBus.instance) {
            AuthEventBus.instance = new AuthEventBus();
        }
        return AuthEventBus.instance;
    }
    /**
     * イベントリスナーを登録
     * @param eventType 登録するイベントタイプ
     * @param listener イベントリスナー関数
     * @returns リスナー登録解除用の関数
     */
    on(eventType, listener) {
        if (!this._listeners.has(eventType)) {
            this._listeners.set(eventType, []);
        }
        this._listeners.get(eventType)?.push(listener);
        // 登録解除用のDisposableを返す
        return {
            dispose: () => {
                const listeners = this._listeners.get(eventType) || [];
                const index = listeners.indexOf(listener);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }
    /**
     * 1回だけ実行されるイベントリスナーを登録
     * @param eventType 登録するイベントタイプ
     * @param listener イベントリスナー関数
     * @returns リスナー登録解除用の関数
     */
    once(eventType, listener) {
        const onceWrapper = (event) => {
            removeListener.dispose();
            listener(event);
        };
        const removeListener = this.on(eventType, onceWrapper);
        return removeListener;
    }
    /**
     * イベントを発行
     * @param eventType 発行するイベントタイプ
     * @param payload イベントに含めるデータ
     * @param source イベント発生元
     */
    publish(eventType, payload, source = 'unknown') {
        const event = {
            type: eventType,
            payload,
            timestamp: Date.now(),
            source
        };
        // イベント履歴に追加
        this._eventHistory.push(event);
        if (this._eventHistory.length > this._maxHistoryLength) {
            this._eventHistory.shift(); // 古いイベントを削除
        }
        logger_1.Logger.debug(`認証イベント発行: ${eventType} from ${source}`);
        // リスナーに通知
        const listeners = this._listeners.get(eventType) || [];
        listeners.forEach(listener => {
            try {
                listener(event);
            }
            catch (error) {
                logger_1.Logger.error(`認証イベントリスナーでエラーが発生: ${eventType}`, error);
            }
        });
        // すべてのイベントを購読しているリスナーに通知
        const allListeners = this._listeners.get(AuthEventType.STATE_CHANGED) || [];
        if (eventType !== AuthEventType.STATE_CHANGED) {
            allListeners.forEach(listener => {
                try {
                    listener(event);
                }
                catch (error) {
                    logger_1.Logger.error(`認証状態変更リスナーでエラーが発生: ${eventType}`, error);
                }
            });
        }
    }
    /**
     * 現在の認証状態を取得
     */
    getAuthState() {
        return { ...this._currentState };
    }
    /**
     * 認証状態を更新
     * @param state 新しい認証状態
     * @param source 更新元
     */
    updateAuthState(state, source = 'unknown') {
        const newState = {
            ...this._currentState,
            ...state,
            timestamp: Date.now()
        };
        // 変更があった場合のみイベント発行
        if (JSON.stringify(this._currentState) !== JSON.stringify(newState)) {
            this._currentState = newState;
            // 状態変更イベントを発行
            this.publish(AuthEventType.STATE_CHANGED, newState, source);
            // ログイン状態が変わった場合、追加でイベントを発行
            if (this._currentState.isAuthenticated !== newState.isAuthenticated) {
                if (newState.isAuthenticated) {
                    this.publish(AuthEventType.LOGIN_SUCCESS, {
                        userId: newState.userId,
                        username: newState.username
                    }, source);
                }
                else {
                    this.publish(AuthEventType.LOGOUT, {}, source);
                }
            }
        }
    }
    /**
     * エラーイベントを発行
     * @param error エラーオブジェクト
     * @param source エラー発生元
     */
    publishError(error, source = 'unknown') {
        this.publish(AuthEventType.AUTH_ERROR, {
            message: error.message,
            stack: error.stack
        }, source);
    }
    /**
     * イベント履歴を取得
     * @param limit 取得する履歴の数（デフォルトは全件）
     * @param type フィルタするイベントタイプ（オプション）
     */
    getEventHistory(limit, type) {
        let history = [...this._eventHistory];
        // イベントタイプでフィルタ
        if (type) {
            history = history.filter(event => event.type === type);
        }
        // 最新のイベントを先頭にする
        history.reverse();
        // 指定された数に制限
        if (limit && limit > 0) {
            history = history.slice(0, limit);
        }
        return history;
    }
    /**
     * 全てのリスナーを削除
     */
    clearAllListeners() {
        this._listeners.clear();
        logger_1.Logger.info('認証イベントバスのリスナーがクリアされました');
    }
    /**
     * 特定のイベントタイプのリスナーを削除
     * @param eventType 削除するイベントタイプ
     */
    clearListeners(eventType) {
        this._listeners.delete(eventType);
        logger_1.Logger.info(`認証イベントバス: ${eventType} のリスナーがクリアされました`);
    }
    /**
     * リソースの解放
     */
    dispose() {
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
        this._disposables = [];
        this._onLogin.dispose();
        this._onLogout.dispose();
        this._onAuthError.dispose();
        this._onTokenRefresh.dispose();
        this.clearAllListeners();
    }
}
exports.AuthEventBus = AuthEventBus;
//# sourceMappingURL=AuthEventBus.js.map