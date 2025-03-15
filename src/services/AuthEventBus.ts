import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * 認証イベントの種類を定義する列挙型
 */
export enum AuthEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  TOKEN_REFRESHED = 'token_refreshed',
  TOKEN_EXPIRED = 'token_expired',
  STATE_CHANGED = 'state_changed',
  AUTH_ERROR = 'auth_error'
}

/**
 * 認証イベントのインターフェース
 */
export interface AuthEvent {
  type: AuthEventType;
  payload?: any;
  timestamp: number;
  source: string;
}

/**
 * 認証状態の定義
 */
export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  username?: string;
  permissions?: string[];
  expiresAt?: number;
  timestamp?: number;
}

/**
 * 認証イベントリスナーの型定義
 */
export type AuthEventListener = (event: AuthEvent) => void;

/**
 * AuthEventBus - 認証関連のイベントを管理するサービス
 * 
 * 認証状態の変更を監視し、拡張機能内の他のコンポーネントに通知します。
 * このクラスは認証関連のイベントの中央ハブとして機能します。
 */
export class AuthEventBus {
  private static instance: AuthEventBus;
  private _listeners: Map<AuthEventType, AuthEventListener[]> = new Map();
  private _currentState: AuthState = {
    isAuthenticated: false,
    timestamp: Date.now()
  };
  private _eventHistory: AuthEvent[] = [];
  private _maxHistoryLength: number = 50;
  private _disposables: vscode.Disposable[] = [];
  
  // イベントエミッター（VSCodeイベント連携用）
  private _onLogin = new vscode.EventEmitter<void>();
  private _onLogout = new vscode.EventEmitter<void>();
  private _onAuthError = new vscode.EventEmitter<string>();
  private _onTokenRefresh = new vscode.EventEmitter<void>();
  
  // VSCodeイベント
  public readonly onLogin = this._onLogin.event;
  public readonly onLogout = this._onLogout.event;
  public readonly onAuthError = this._onAuthError.event;
  public readonly onTokenRefresh = this._onTokenRefresh.event;

  /**
   * コンストラクタ
   */
  private constructor() {
    // イベント履歴を初期化
    this._eventHistory = [];
    Logger.info('認証イベントバスが初期化されました');

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
      } else if (typeof event.payload?.message === 'string') {
        this._onAuthError.fire(event.payload.message);
      }
    });
    this.on(AuthEventType.TOKEN_REFRESHED, () => this._onTokenRefresh.fire());
  }

  /**
   * AuthEventBusのシングルトンインスタンスを取得
   */
  public static getInstance(): AuthEventBus {
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
  public on(eventType: AuthEventType, listener: AuthEventListener): vscode.Disposable {
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
  public once(eventType: AuthEventType, listener: AuthEventListener): vscode.Disposable {
    const onceWrapper: AuthEventListener = (event) => {
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
  public publish(eventType: AuthEventType, payload?: any, source: string = 'unknown'): void {
    const event: AuthEvent = {
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
    
    Logger.debug(`認証イベント発行: ${eventType} from ${source}`);
    
    // リスナーに通知
    const listeners = this._listeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        Logger.error(`認証イベントリスナーでエラーが発生: ${eventType}`, error as Error);
      }
    });
    
    // すべてのイベントを購読しているリスナーに通知
    const allListeners = this._listeners.get(AuthEventType.STATE_CHANGED) || [];
    if (eventType !== AuthEventType.STATE_CHANGED) {
      allListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          Logger.error(`認証状態変更リスナーでエラーが発生: ${eventType}`, error as Error);
        }
      });
    }
  }

  /**
   * 現在の認証状態を取得
   */
  public getAuthState(): AuthState {
    return { ...this._currentState };
  }

  /**
   * 認証状態を更新
   * @param state 新しい認証状態
   * @param source 更新元
   */
  public updateAuthState(state: Partial<AuthState>, source: string = 'unknown'): void {
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
        } else {
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
  public publishError(error: Error, source: string = 'unknown'): void {
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
  public getEventHistory(limit?: number, type?: AuthEventType): AuthEvent[] {
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
  public clearAllListeners(): void {
    this._listeners.clear();
    Logger.info('認証イベントバスのリスナーがクリアされました');
  }

  /**
   * 特定のイベントタイプのリスナーを削除
   * @param eventType 削除するイベントタイプ
   */
  public clearListeners(eventType: AuthEventType): void {
    this._listeners.delete(eventType);
    Logger.info(`認証イベントバス: ${eventType} のリスナーがクリアされました`);
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
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