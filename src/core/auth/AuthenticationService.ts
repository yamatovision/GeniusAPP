import * as vscode from 'vscode';
import axios from 'axios';
import { TokenManager } from './TokenManager';
import { Logger } from '../../utils/logger';
import { Role } from './roles';
import { AuthState, AuthStateBuilder, compareAuthStates } from './AuthState';
import { AuthStorageManager } from '../../utils/AuthStorageManager';

/**
 * ユーザー情報の型定義
 */
export interface UserData {
  id: string;
  name: string;
  role: string;
  permissions?: string[];
  email?: string;
  [key: string]: any; // その他のプロパティを許可
}

/**
 * 認証イベントの型
 */
export enum AuthEventType {
  STATE_CHANGED = 'state_changed',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  TOKEN_REFRESHED = 'token_refreshed'
}

/**
 * 認証エラーの型
 */
export interface AuthError {
  code: string;
  message: string;
  statusCode?: number;
}

/**
 * 認証モードの情報
 */
export interface AuthModeInfo {
  /** 分離認証モードが有効かどうか */
  isIsolatedAuthEnabled: boolean;
  /** 認証モードを決定した方法 */
  detectionMethod: string;
  /** 認証ファイルのパス */
  authFilePath?: string;
}

/**
 * AuthenticationService - 認証状態を一元管理するサービス
 * 
 * ユーザーの認証状態を管理し、認証関連のイベントを発行します。
 * このクラスはVSCodeのEventEmitterを使用して、状態変更を通知します。
 */
export class AuthenticationService {
  private static instance: AuthenticationService;
  private _tokenManager: TokenManager;
  private _storageManager: AuthStorageManager;
  private _currentState: AuthState;
  private _lastError: AuthError | null = null;
  private _authCheckInterval: NodeJS.Timer | null = null;
  private _authModeInfo: AuthModeInfo | null = null;
  
  // イベントエミッター
  private _onStateChanged = new vscode.EventEmitter<AuthState>();
  private _onLoginSuccess = new vscode.EventEmitter<void>();
  private _onLoginFailed = new vscode.EventEmitter<AuthError>();
  private _onLogout = new vscode.EventEmitter<void>();
  private _onTokenRefreshed = new vscode.EventEmitter<void>();
  
  // 公開イベント
  public readonly onStateChanged = this._onStateChanged.event;
  public readonly onLoginSuccess = this._onLoginSuccess.event;
  public readonly onLoginFailed = this._onLoginFailed.event;
  public readonly onLogout = this._onLogout.event;
  public readonly onTokenRefreshed = this._onTokenRefreshed.event;
  
  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this._tokenManager = TokenManager.getInstance(context);
    this._storageManager = AuthStorageManager.getInstance(context);
    this._currentState = AuthStateBuilder.guest().build();
    
    this._initialize();
  }
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(context?: vscode.ExtensionContext): AuthenticationService {
    if (!AuthenticationService.instance) {
      if (!context) {
        throw new Error('AuthenticationServiceの初期化時にはExtensionContextが必要です');
      }
      AuthenticationService.instance = new AuthenticationService(context);
    }
    return AuthenticationService.instance;
  }
  
  /**
   * 初期化処理
   */
  private async _initialize(): Promise<void> {
    try {
      Logger.info('認証サービスの初期化を開始');
      
      // 保存されているトークンを確認
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        Logger.info('保存されたトークンがありません。未認証状態で初期化します');
        return;
      }
      
      Logger.info('保存されたトークンを確認しています');
      
      // トークンの有効期限をチェック
      const isValid = await this._tokenManager.isTokenValid();
      if (!isValid) {
        Logger.info('トークンの有効期限が切れています。リフレッシュを試みます');
        const refreshed = await this.refreshToken(true); // 静かに失敗するオプションを設定
        if (!refreshed) {
          Logger.warn('トークンのリフレッシュに失敗しました。認証が必要です');
          // トークンをクリアし、未認証状態で初期化
          await this._tokenManager.clearTokens();
          return;
        }
      }
      
      try {
        // ユーザー情報を取得
        Logger.info('ユーザー情報を取得します');
        await this._fetchUserInfo();
        
        // 権限チェックインターバルを開始
        this._startAuthCheckInterval();
        
        Logger.info('認証サービスの初期化が完了しました');
      } catch (fetchError) {
        Logger.error('ユーザー情報の取得中にエラーが発生しました', fetchError as Error);
        
        // サーバーエラーやネットワークエラーの場合、明確なエラーメッセージを表示
        if (axios.isAxiosError(fetchError)) {
          if (fetchError.response?.status === 401) {
            Logger.warn('認証エラーが発生しました。再ログインが必要です');
            // トークンをクリアし、未認証状態にする
            await this._tokenManager.clearTokens();
            const newState = AuthStateBuilder.guest().build();
            this._updateState(newState);
            // ユーザーへの通知は初期化中は控えめに
            return;
          } else if (fetchError.response?.status === 500) {
            Logger.warn('サーバーエラーが発生しました。しばらく経ってから再試行してください');
            // ユーザーへの通知は初期化中は控えめに
          } else if (!fetchError.response) {
            Logger.warn('ネットワークエラーが発生しました。インターネット接続を確認してください');
            // ユーザーへの通知は初期化中は控えめに
          }
        }
        
        // 認証エラー以外の場合は、権限チェックは開始する（次回の自動チェックでリカバリー可能にする）
        this._startAuthCheckInterval();
        
        Logger.info('認証サービスの初期化が完了しました（一部エラーあり）');
      }
    } catch (error) {
      Logger.error('認証サービスの初期化中にエラーが発生しました', error as Error);
      
      // 致命的なエラーでも認証状態の回復を試みる
      try {
        const recoverySuccess = await this._recoverUserState();
        if (recoverySuccess) {
          Logger.info('エラー発生後、ローカルデータによる認証状態の回復に成功しました');
        }
      } catch (recoveryError) {
        Logger.error('認証状態の回復中にエラーが発生しました', recoveryError as Error);
      }
      
      // 基本的な機能は提供できるようにする
      this._startAuthCheckInterval();
    }
  }
  
  /**
   * ユーザーログイン
   */
  public async login(email: string, password: string): Promise<boolean> {
    try {
      Logger.info('ログイン処理を開始します');
      
      // 環境変数から認証APIのエンドポイントを取得
      const apiUrl = this._getAuthApiUrl();
      const clientId = this._getClientId();
      const clientSecret = this._getClientSecret();
      
      if (!clientId || !clientSecret) {
        this._setLastError({
          code: 'missing_credentials',
          message: 'クライアントID/シークレットが設定されていません'
        });
        return false;
      }
      
      // 認証APIを呼び出し
      const response = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password,
        clientId,
        clientSecret
      }, {
        timeout: 10000
      });
      
      if (response.status === 200 && response.data.accessToken && response.data.refreshToken) {
        // トークンの有効期限を取得
        const expiresIn = response.data.expiresIn || 86400;
        
        // トークンを保存
        await this._tokenManager.setAccessToken(response.data.accessToken, expiresIn);
        await this._tokenManager.setRefreshToken(response.data.refreshToken);
        
        // ユーザーデータを保存
        await this._storageManager.setUserData(response.data.user);
        
        // 認証状態を更新
        const newState = AuthStateBuilder.fromState(this._currentState)
          .setAuthenticated(true)
          .setUserId(response.data.user.id)
          .setUsername(response.data.user.name)
          .setRole(this._mapUserRole(response.data.user.role))
          .setPermissions(response.data.user.permissions || [])
          .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
          .build();
        
        // 状態を更新し、イベントを発行
        this._updateState(newState);
        
        // 認証チェックインターバルを開始
        this._startAuthCheckInterval();
        
        // ログイン成功イベントを発行
        this._onLoginSuccess.fire();
        
        Logger.info(`ログインに成功しました: ${response.data.user.name}`);
        return true;
      }
      
      Logger.warn('ログインに失敗しました: レスポンスが無効です');
      return false;
    } catch (error) {
      Logger.error('ログイン中にエラーが発生しました', error as Error);
      
      // エラー情報を設定
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        let errorMessage = '認証に失敗しました';
        let errorCode = 'login_failed';
        
        // ステータスコードに応じたメッセージ
        if (statusCode === 401) {
          errorMessage = 'メールアドレスまたはパスワードが正しくありません';
          errorCode = 'invalid_credentials';
        } else if (statusCode === 403) {
          errorMessage = 'アクセスが拒否されました';
          errorCode = 'access_denied';
        }
        
        const authError = {
          code: errorCode,
          message: errorMessage,
          statusCode
        };
        
        this._setLastError(authError);
        this._onLoginFailed.fire(authError);
      } else {
        const authError = {
          code: 'unknown_error',
          message: `ログイン中に予期しないエラーが発生しました: ${(error as Error).message}`
        };
        
        this._setLastError(authError);
        this._onLoginFailed.fire(authError);
      }
      
      return false;
    }
  }
  
  /**
   * ユーザーログアウト
   */
  public async logout(): Promise<void> {
    try {
      // ログアウトイベントをサーバーに送信（省略可能）
      const refreshToken = await this._tokenManager.getRefreshToken();
      const apiUrl = this._getAuthApiUrl();
      
      if (refreshToken) {
        try {
          // リフレッシュトークンが有効な形式であるか確認
          const isValidToken = refreshToken.split('.').length === 3; // JWTの基本的な形式チェック
          
          if (isValidToken) {
            try {
              await axios.post(`${apiUrl}/auth/logout`, { refreshToken }, {
                timeout: 5000 // タイムアウトを5秒に設定
              });
            } catch (error) {
              // エラーをログに記録するだけで、ログアウト処理は続行
              if (axios.isAxiosError(error) && error.response?.status === 400) {
                Logger.warn('サーバーへのログアウトリクエストが拒否されました（既にログアウト済みの可能性があります）');
              } else {
                Logger.warn('サーバーへのログアウトリクエスト送信中にエラーが発生しました', error as Error);
              }
            }
          } else {
            Logger.warn('無効な形式のリフレッシュトークンのため、サーバーへのログアウトリクエストをスキップします');
          }
        } catch (error) {
          // トークン形式チェックでエラーが発生した場合も、ログアウト処理は続行
          Logger.warn('リフレッシュトークンの検証中にエラーが発生しました', error as Error);
        }
      }
      
      // 認証チェックインターバルを停止
      this._stopAuthCheckInterval();
      
      // トークンを削除
      await this._tokenManager.clearTokens();
      
      // 認証状態をリセット
      const newState = AuthStateBuilder.guest().build();
      this._updateState(newState);
      
      // ログアウトイベントを発行
      this._onLogout.fire();
      
      Logger.info('ログアウトが完了しました');
    } catch (error) {
      Logger.error('ログアウト中にエラーが発生しました', error as Error);
      
      // 致命的なエラーが発生しても、トークンと認証状態のクリアを試みる
      try {
        await this._tokenManager.clearTokens();
        const newState = AuthStateBuilder.guest().build();
        this._updateState(newState);
        this._onLogout.fire();
        Logger.info('エラー発生後、強制的にログアウト処理を完了しました');
      } catch (clearError) {
        Logger.error('強制ログアウト処理中にエラーが発生しました', clearError as Error);
      }
    }
  }
  
  /**
   * トークンのリフレッシュ
   * @param {boolean} silentOnError - エラー時に静かに失敗するかどうか
   * @param {number} retryCount - リトライ回数（最大3回まで）
   */
  public async refreshToken(silentOnError: boolean = false, retryCount: number = 0): Promise<boolean> {
    try {
      Logger.info('トークンのリフレッシュを開始します');
      
      const refreshToken = await this._tokenManager.getRefreshToken();
      if (!refreshToken) {
        Logger.warn('リフレッシュトークンが見つかりません');
        return false;
      }
      
      const apiUrl = this._getAuthApiUrl();
      const clientId = this._getClientId();
      const clientSecret = this._getClientSecret();
      
      Logger.debug(`認証情報確認: リフレッシュトークン長=${refreshToken.length}, クライアントID=${clientId}`);
      
      // トークンリフレッシュAPIを呼び出し
      const response = await axios.post(`${apiUrl}/auth/refresh-token`, {
        refreshToken,
        clientId,
        clientSecret
      }, {
        // タイムアウト設定を増やして信頼性を向上
        timeout: 30000
      });
      
      if (response.status === 200 && response.data.accessToken) {
        // トークンの有効期限を取得 - バックエンドから提供されるようになった
        const expiresIn = response.data.expiresIn || 86400;
        
        // 新しいアクセストークンを保存
        await this._tokenManager.setAccessToken(response.data.accessToken, expiresIn);
        
        // リフレッシュトークンも更新される場合は保存（セキュリティのためローテーション）
        if (response.data.refreshToken) {
          Logger.info('新しいリフレッシュトークンを保存します');
          await this._tokenManager.setRefreshToken(response.data.refreshToken);
        }
        
        // 有効期限を更新
        const newState = AuthStateBuilder.fromState(this._currentState)
          .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
          .build();
        
        this._updateState(newState);
        
        // トークンリフレッシュイベントを発行
        this._onTokenRefreshed.fire();
        
        Logger.info(`トークンのリフレッシュに成功しました（有効期限: ${new Date((Math.floor(Date.now() / 1000) + expiresIn) * 1000).toLocaleString()}）`);
        return true;
      }
      
      Logger.warn('トークンリフレッシュのレスポンスが無効です');
      return false;
    } catch (error) {
      Logger.error('トークンリフレッシュ中にエラーが発生しました', error as Error);
      
      // ネットワークエラーの場合はリトライを試みる（最大5回まで - 増加）
      if (axios.isAxiosError(error) && !error.response && retryCount < 5) {
        const retryDelayMs = 1000 * Math.pow(2, retryCount); // 指数バックオフ（1秒、2秒、4秒、8秒、16秒）
        Logger.info(`ネットワークエラー発生。${retryDelayMs/1000}秒後にリトライします (${retryCount + 1}/5)`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        return this.refreshToken(silentOnError, retryCount + 1);
      }
      
      // トークンが無効な場合は明示的にログアウトを要求する
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Logger.warn('リフレッシュトークンが無効です。ログアウトが必要です');
        
        // silentOnErrorがtrueの場合、サイレントに処理
        if (!silentOnError) {
          // ユーザーに通知してからログアウト
          vscode.window.showWarningMessage(
            'ログインセッションの有効期限が切れました。再ログインしてください。',
            '再ログイン'
          ).then(async selection => {
            if (selection === '再ログイン') {
              // ログアウト後、ログイン画面を表示
              await this.logout();
              // ログイン画面表示のイベントを発行
              vscode.commands.executeCommand('appgenius.showLogin');
            } else {
              await this.logout();
            }
          });
        } else {
          // 静かにトークンをクリアするだけ
          await this._tokenManager.clearTokens();
          const newState = AuthStateBuilder.guest().build();
          this._updateState(newState);
          Logger.info('認証トークンが無効です。ログアウトしました');
        }
      }
      // サーバーエラー（500）が発生した場合は、現在のトークンの有効性をチェック
      else if (axios.isAxiosError(error) && error.response?.status === 500) {
        Logger.warn('トークンリフレッシュ中にサーバーエラーが発生しました。現在のトークンの有効性をチェックします');
        
        // サーバーエラーの原因がアカウント無効化の場合
        if (error.response?.data?.error?.details === 'アカウントが無効化されています') {
          Logger.warn('アカウントが無効化されています。ログアウトします');
          if (!silentOnError) {
            await this.logout();
            vscode.window.showErrorMessage('アカウントが無効化されています。管理者にお問い合わせください。');
          } else {
            // 静かにトークンをクリアするだけ
            await this._tokenManager.clearTokens();
            const newState = AuthStateBuilder.guest().build();
            this._updateState(newState);
          }
          return false;
        }
        
        try {
          // 現在のトークンの有効期限をチェック
          const isValid = await this._tokenManager.isTokenValid();
          if (isValid) {
            Logger.info('現在のトークンはまだ有効です。リフレッシュを中断して現在のトークンを使用します');
            
            // ユーザー情報を取得して認証状態を回復
            const recovered = await this._recoverUserState();
            
            // 回復に成功した場合
            if (recovered) {
              // サーバーエラーでも認証状態を維持
              // 5分後に再度リフレッシュを試みる
              this._scheduleRefreshRetry(5 * 60 * 1000);
              return true;
            } else {
              Logger.warn('認証状態の回復に失敗しました');
            }
          } else {
            Logger.warn('現在のトークンも有効期限切れです。リフレッシュに失敗しました');
            if (!silentOnError) {
              // エラーメッセージを表示
              vscode.window.showWarningMessage('認証サーバーとの通信でエラーが発生しました。一部機能が制限される場合があります');
            }
          }
        } catch (validationError) {
          Logger.error('トークン検証中にエラーが発生しました', validationError as Error);
        }
      }
      
      return false;
    }
  }
  
  /**
   * トークンリフレッシュのリトライをスケジュール
   * ネットワークエラーなどの一時的な問題から回復するため
   * 
   * @param {number} delayMs - 再試行までの待機時間（ミリ秒）
   * @param {number} maxRetries - 最大リトライ回数
   * @param {number} currentRetry - 現在のリトライ回数
   */
  private _scheduleRefreshRetry(delayMs: number, maxRetries: number = 5, currentRetry: number = 0): void {
    setTimeout(async () => {
      try {
        // 現在のトークンが有効期限切れかどうかを確認
        const isValid = await this._tokenManager.isTokenValid();
        if (!isValid) {
          Logger.info(`スケジュールされたトークンリフレッシュを実行します (${currentRetry + 1}/${maxRetries})`);
          const refreshed = await this.refreshToken(true);
          
          // リフレッシュに失敗し、リトライ回数が残っている場合は再度スケジュール
          if (!refreshed && currentRetry < maxRetries - 1) {
            Logger.info(`トークンリフレッシュに失敗しました。再試行をスケジュールします (${currentRetry + 2}/${maxRetries})`);
            // 指数バックオフでリトライ間隔を増加（例: 5分、10分、20分...）
            const nextDelay = delayMs * 2;
            this._scheduleRefreshRetry(nextDelay, maxRetries, currentRetry + 1);
          } else if (!refreshed) {
            Logger.warn(`最大リトライ回数に達しました (${maxRetries}回)。リフレッシュ試行を終了します`);
          } else {
            Logger.info('トークンリフレッシュ成功');
          }
        } else {
          Logger.info('トークンはまだ有効です。リフレッシュは不要です');
        }
      } catch (error) {
        Logger.error('スケジュールされたトークンリフレッシュに失敗しました', error as Error);
        
        // エラーが発生した場合も、リトライ回数が残っていれば再試行
        if (currentRetry < maxRetries - 1) {
          Logger.info(`エラーが発生しましたが、再試行をスケジュールします (${currentRetry + 2}/${maxRetries})`);
          const nextDelay = delayMs * 2;
          this._scheduleRefreshRetry(nextDelay, maxRetries, currentRetry + 1);
        }
      }
    }, delayMs);
  }
  
  /**
   * ユーザー情報を取得
   * @param retryCount リトライ回数
   */
  private async _fetchUserInfo(retryCount: number = 0): Promise<void> {
    try {
      Logger.info('ユーザー情報の取得を開始します');
      
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        Logger.warn('アクセストークンが見つかりません');
        return;
      }
      
      const apiUrl = this._getAuthApiUrl();
      
      // ユーザー情報取得APIを呼び出し - 正しいパスを使用（/auth/users/me）
      const response = await axios.get(`${apiUrl}/auth/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        // タイムアウト設定を追加
        timeout: 10000
      });
      
      if (response.status === 200 && response.data.user) {
        // ユーザーデータを保存
        await this._storageManager.setUserData(response.data.user);
        
        // 認証状態を更新
        const newState = AuthStateBuilder.fromState(this._currentState)
          .setAuthenticated(true)
          .setUserId(response.data.user.id)
          .setUsername(response.data.user.name)
          .setRole(this._mapUserRole(response.data.user.role))
          .setPermissions(response.data.user.permissions || [])
          .build();
        
        this._updateState(newState);
        
        Logger.info(`ユーザー情報を取得しました: ${response.data.user.name}`);
      } else {
        Logger.warn('ユーザー情報の取得に失敗しました: レスポンスが無効です');
        await this._tryFallbackAuthentication();
      }
    } catch (error) {
      Logger.error('ユーザー情報取得中にエラーが発生しました', error as Error);
      
      // トークンが無効な場合はリフレッシュを試みる
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Logger.info('アクセストークンが無効です。リフレッシュを試みます');
        const refreshed = await this.refreshToken(true); // 静かに失敗するように変更
        if (refreshed) {
          Logger.info('トークンリフレッシュに成功しました。ユーザー情報を再取得します');
          await this._fetchUserInfo();
        } else {
          Logger.warn('トークンリフレッシュに失敗しました。ローカルデータによるフォールバック認証を試みます');
          // ローカルデータによるフォールバック認証を試みる
          const fallbackSuccess = await this._tryFallbackAuthentication();
          if (!fallbackSuccess) {
            Logger.warn('フォールバック認証に失敗しました。認証状態は未認証になります');
          }
        }
      }
      // サーバーエラーの場合、一定回数リトライ
      else if (axios.isAxiosError(error) && error.response?.status === 500 && retryCount < 3) {
        Logger.info(`サーバーエラーが発生しました。リトライします (${retryCount + 1}/3)`);
        // 指数バックオフでリトライ（1秒、2秒、4秒）
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return this._fetchUserInfo(retryCount + 1);
      } 
      // ネットワークエラーの場合も、リトライを試みる
      else if (axios.isAxiosError(error) && !error.response && retryCount < 3) {
        Logger.info(`ネットワークエラーが発生しました。リトライします (${retryCount + 1}/3)`);
        // 指数バックオフでリトライ（1秒、2秒、4秒）
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return this._fetchUserInfo(retryCount + 1);
      }
      // すべてのリトライが失敗、または他のエラーの場合はフォールバック認証を試みる
      else {
        Logger.info('サーバーとの通信に失敗しました。ローカルデータを使用して認証状態を維持します');
        await this._tryFallbackAuthentication();
      }
    }
  }
  
  /**
   * サーバー接続エラー時に、ローカルに保存されたユーザーデータを使用した認証フォールバック
   * このメソッドは、サーバーエラーが発生した場合でも、ユーザーがローカルで作業を継続できるようにします
   */
  private async _tryFallbackAuthentication(): Promise<boolean> {
    try {
      Logger.info('フォールバック認証を試みます: ローカルに保存されたユーザー情報を確認');
      
      // トークンの存在を確認（最低限の認証チェック）
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        Logger.warn('フォールバック認証: アクセストークンが見つかりません');
        return false;
      }
      
      // ローカルに保存されたユーザーデータを取得
      const userData = await this._storageManager.getUserData<UserData>();
      if (!userData) {
        Logger.warn('フォールバック認証: 保存されたユーザーデータが見つかりません');
        return false;
      }
      
      Logger.info(`フォールバック認証: ローカルユーザーデータを使用します (${userData.name})`);
      
      // 認証状態を更新（ローカルデータを使用）
      const newState = AuthStateBuilder.fromState(this._currentState)
        .setAuthenticated(true)
        .setUserId(userData.id)
        .setUsername(userData.name)
        .setRole(this._mapUserRole(userData.role))
        .setPermissions(userData.permissions || [])
        .build();
      
      this._updateState(newState);
      
      Logger.info(`フォールバック認証に成功しました: ${userData.name} (${this._mapUserRole(userData.role)})`);
      return true;
    } catch (error) {
      Logger.error('フォールバック認証に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * 認証状態を更新し、変更があればイベントを発行
   */
  private _updateState(newState: AuthState): void {
    // 状態の変更点を確認
    const changes = compareAuthStates(this._currentState, newState);
    
    if (changes.length > 0) {
      // 変更があった場合、状態を更新してイベントを発行
      this._currentState = newState;
      
      // 変更内容をログに出力
      Logger.info(`認証状態が変更されました: ${changes.join(', ')}`);
      
      // 状態変更イベントを発行
      this._onStateChanged.fire(newState);
    }
  }
  
  /**
   * 認証チェックインターバルを開始
   * トークンの有効期限をチェックし、必要に応じてリフレッシュを行う
   */
  private _startAuthCheckInterval(): void {
    // 既存のインターバルがあれば停止
    this._stopAuthCheckInterval();
    
    // 環境変数からチェック間隔を取得（デフォルトは30分 - 延長）
    const checkIntervalSeconds = Math.min(
      parseInt(process.env.CHECK_INTERVAL || '1800', 10),
      3600 // 最大1時間
    );
    
    // トークンの有効期限を事前に計算（予測値）
    let tokenExpiryTime: number | null = null;
    try {
      const state = this.getCurrentState();
      if (state.expiresAt) {
        tokenExpiryTime = state.expiresAt;
        const expiryDate = new Date(tokenExpiryTime * 1000);
        Logger.info(`トークン有効期限の予測: ${expiryDate.toLocaleString()}`);
      }
    } catch (e) {
      Logger.warn('トークン有効期限の予測に失敗しました', e as Error);
    }
    
    // 定期的なトークン検証を設定
    this._authCheckInterval = setInterval(async () => {
      try {
        // 現在の時刻とトークン有効期限を比較（既知の場合）
        const now = Math.floor(Date.now() / 1000);
        
        // 有効期限が既知で、有効期限まで1時間以上ある場合はスキップ（最適化）
        if (tokenExpiryTime && tokenExpiryTime - now > 3600) {
          Logger.info(`トークン有効期限まで十分な時間があります (${Math.floor((tokenExpiryTime - now) / 3600)}時間以上)。チェックをスキップします`);
          return;
        }
        
        // トークンの有効期限をチェック
        Logger.info('トークン有効性チェックを実行します');
        const isValid = await this._tokenManager.isTokenValid();
        
        if (!isValid) {
          Logger.info('トークンの有効期限が近づいているか、期限切れです。リフレッシュを試みます');
          
          // トークンリフレッシュを試みる
          const refreshed = await this.refreshToken(true); // サイレントモード
          if (refreshed) {
            // 更新成功した場合、新しい有効期限を取得
            const newState = this.getCurrentState();
            tokenExpiryTime = newState.expiresAt || null;
            if (tokenExpiryTime) {
              const expiryDate = new Date(tokenExpiryTime * 1000);
              Logger.info(`トークンリフレッシュ成功。新しい有効期限: ${expiryDate.toLocaleString()}`);
            }
          } else {
            // 重要な操作時のみ自動ログアウト
            Logger.warn('トークンのリフレッシュに失敗しましたが、自動ログアウトは行いません。現在の認証状態を維持します');
            
            // オフラインとして扱い、随時リトライ
            this._recoverUserState();
            
            // 1時間後に再試行
            this._scheduleRefreshRetry(3600 * 1000);
          }
        } else {
          Logger.info('トークンは有効です');
        }
      } catch (error) {
        Logger.error('認証チェック中にエラーが発生しました', error as Error);
        
        // エラーが発生しても完全失敗にせず、ローカルデータでの回復を試みる
        try {
          await this._recoverUserState();
        } catch (recoveryError) {
          Logger.error('認証状態の回復に失敗しました', recoveryError as Error);
        }
      }
    }, checkIntervalSeconds * 1000);
    
    Logger.info(`認証チェックインターバルを開始しました（${checkIntervalSeconds}秒間隔）`);
  }
  
  /**
   * 認証チェックインターバルを停止
   */
  private _stopAuthCheckInterval(): void {
    if (this._authCheckInterval) {
      clearInterval(this._authCheckInterval);
      this._authCheckInterval = null;
      Logger.info('認証チェックインターバルを停止しました');
    }
  }
  
  /**
   * APIのエンドポイントURL取得
   */
  private _getAuthApiUrl(): string {
    return 'https://geniemon-portal-backend-production.up.railway.app/api';
  }
  
  /**
   * クライアントID取得
   */
  private _getClientId(): string {
    return 'appgenius_vscode_client_29a7fb3e';
  }
  
  /**
   * クライアントシークレット取得
   * 本番環境と一致する値
   */
  private _getClientSecret(): string {
    return 'appgenius_refresh_token_secret_key_for_production';
  }
  
  /**
   * ユーザーロールのマッピング
   */
  private _mapUserRole(roleStr?: string): Role {
    if (!roleStr) {
      return Role.GUEST;
    }
    
    switch (roleStr) {
      case 'admin':
        return Role.ADMIN;
      case 'user':
        return Role.USER;
      default:
        return Role.GUEST;
    }
  }
  
  /**
   * エラー情報を設定
   */
  private _setLastError(error: AuthError): void {
    this._lastError = error;
    Logger.error(`認証エラー: [${error.code}] ${error.message}`);
  }
  
  /**
   * 現在の認証状態を取得
   */
  public getCurrentState(): AuthState {
    return { ...this._currentState };
  }
  
  /**
   * 現在のユーザー情報を取得
   */
  public getCurrentUser(): any {
    if (!this._currentState.isAuthenticated) {
      return null;
    }
    
    return {
      id: this._currentState.userId,
      name: this._currentState.username,
      role: this._currentState.role
    };
  }
  
  /**
   * 認証ヘッダーを取得
   */
  public async getAuthHeader(): Promise<Record<string, string> | undefined> {
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      return undefined;
    }
    
    return {
      'Authorization': `Bearer ${token}`
    };
  }
  
  /**
   * 認証状態変更通知の別名（互換性維持のため）
   */
  public get onAuthStateChanged(): vscode.Event<AuthState> {
    return this.onStateChanged;
  }
  
  /**
   * ユーザー情報を取得するAPI呼び出し
   */
  public async getUserInfo(): Promise<any> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        throw new Error('認証されていません');
      }
      
      const apiUrl = this._getAuthApiUrl();
      const response = await axios.get(`${apiUrl}/auth/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data.user;
    } catch (error) {
      Logger.error('ユーザー情報の取得に失敗しました', error as Error);
      throw error;
    }
  }
  
  /**
   * ユーザープロファイルを更新
   */
  public async updateProfile(profileData: any): Promise<boolean> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        throw new Error('認証されていません');
      }
      
      const apiUrl = this._getAuthApiUrl();
      const response = await axios.put(`${apiUrl}/users/profile`, profileData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 200) {
        // ユーザー情報を再取得して状態を更新
        await this._fetchUserInfo();
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('プロファイル更新に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * パスワード変更
   */
  public async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        throw new Error('認証されていません');
      }
      
      const apiUrl = this._getAuthApiUrl();
      const response = await axios.post(`${apiUrl}/users/change-password`, {
        currentPassword,
        newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.status === 200;
    } catch (error) {
      Logger.error('パスワード変更に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * ローカルに保存されたユーザー情報を使用して認証状態を回復する
   * サーバーエラーやネットワーク接続問題などでAPIにアクセスできない場合のフォールバックとして使用
   */
  private async _recoverUserState(): Promise<boolean> {
    try {
      Logger.info('ローカルデータを使用して認証状態を回復します');
      
      // ローカルに保存されたユーザーデータを取得
      const userData = await this._storageManager.getUserData<UserData>();
      if (!userData) {
        Logger.warn('ローカルに保存されたユーザーデータが見つかりません');
        return false;
      }
      
      // トークンの存在を確認
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        Logger.warn('アクセストークンが見つかりません');
        return false;
      }
      
      // 認証状態を更新（ローカルデータを使用）
      const newState = AuthStateBuilder.fromState(this._currentState)
        .setAuthenticated(true)
        .setUserId(userData.id)
        .setUsername(userData.name)
        .setRole(this._mapUserRole(userData.role))
        .setPermissions(userData.permissions || [])
        .build();
      
      this._updateState(newState);
      
      Logger.info(`認証状態を回復しました: ${userData.name} (${this._mapUserRole(userData.role)})`);
      return true;
    } catch (error) {
      Logger.error('認証状態の回復に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * 最後のエラーを取得
   */
  public getLastError(): AuthError | null {
    return this._lastError ? { ...this._lastError } : null;
  }
  
  /**
   * 現在認証済みかどうかを確認
   */
  public isAuthenticated(): boolean {
    return this._currentState.isAuthenticated;
  }
  
  /**
   * 分離認証モードの情報を取得
   * 認証モードの状態と詳細情報を返す
   */
  public getAuthModeInfo(): AuthModeInfo {
    // 既に検出済みの場合はそのまま返す
    if (this._authModeInfo) {
      return { ...this._authModeInfo };
    }
    
    // 分離認証モードの検出ロジック
    const info: AuthModeInfo = {
      isIsolatedAuthEnabled: false,
      detectionMethod: 'unknown'
    };
    
    try {
      // 1. 環境変数から直接検出（最優先）
      const envVar = process.env.APPGENIUS_USE_ISOLATED_AUTH;
      if (envVar !== undefined) {
        info.isIsolatedAuthEnabled = envVar.toLowerCase() === 'true';
        info.detectionMethod = 'environment_variable';
        Logger.info(`分離認証モード環境変数: ${envVar} (${info.isIsolatedAuthEnabled ? '有効' : '無効'})`);
        
        // 認証ファイルパスも設定
        if (info.isIsolatedAuthEnabled) {
          info.authFilePath = this._getIsolatedAuthFilePath();
        }
        
        this._authModeInfo = info;
        return { ...info };
      }
      
      // 2. VSCode API環境の検出
      try {
        const isVSCodeEnv = !!vscode.env.appName;
        const appName = isVSCodeEnv ? vscode.env.appName : 'unknown';
        Logger.info(`VSCode環境検出: ${isVSCodeEnv}, アプリ名: ${appName}`);
        
        // VSCode環境では分離認証をデフォルトで有効化
        if (isVSCodeEnv) {
          info.isIsolatedAuthEnabled = true;
          info.detectionMethod = 'vscode_api';
          info.authFilePath = this._getIsolatedAuthFilePath();
          
          Logger.info('VSCode環境で実行中のため、分離認証モードをデフォルトで有効化します');
          this._authModeInfo = info;
          return { ...info };
        }
      } catch (error) {
        Logger.warn(`VSCode環境の検出中にエラー発生: ${(error as Error).message}`);
      }
      
      // 3. VSCode関連の環境変数から検出
      try {
        // VSCode関連の環境変数があればVSCode環境と判断
        const hasVSCodeEnv = Object.keys(process.env).some(key => 
          key.toLowerCase().includes('vscode') || 
          key.toLowerCase().includes('code_')
        );
        
        if (hasVSCodeEnv) {
          info.isIsolatedAuthEnabled = true;
          info.detectionMethod = 'vscode_environment_vars';
          info.authFilePath = this._getIsolatedAuthFilePath();
          
          Logger.info('VSCode関連の環境変数が検出されたため、分離認証モードを有効化します');
          this._authModeInfo = info;
          return { ...info };
        }
      } catch (error) {
        Logger.warn(`環境変数検出中にエラー発生: ${(error as Error).message}`);
      }
      
      // 4. 設定ファイルから検出
      try {
        const config = vscode.workspace.getConfiguration('appgeniusAI');
        const configValue = config.get<boolean>('useIsolatedAuth');
        
        if (configValue !== undefined) {
          info.isIsolatedAuthEnabled = configValue;
          info.detectionMethod = 'vscode_settings';
          if (info.isIsolatedAuthEnabled) {
            info.authFilePath = this._getIsolatedAuthFilePath();
          }
          
          Logger.info(`設定から分離認証モード設定を検出: ${info.isIsolatedAuthEnabled ? '有効' : '無効'}`);
          this._authModeInfo = info;
          return { ...info };
        }
      } catch (error) {
        Logger.warn(`設定検出中にエラー発生: ${(error as Error).message}`);
      }
      
      // デフォルトは安全策として有効に設定
      info.isIsolatedAuthEnabled = true;
      info.detectionMethod = 'default';
      info.authFilePath = this._getIsolatedAuthFilePath();
      
      Logger.info('明示的な設定が見つからないため、デフォルトで分離認証モードを有効化します');
      this._authModeInfo = info;
      return { ...info };
    } catch (error) {
      // エラー発生時もデフォルト値を返す
      Logger.error('認証モード検出中にエラーが発生しました', error as Error);
      
      const defaultInfo: AuthModeInfo = {
        isIsolatedAuthEnabled: true, // 安全策としてデフォルトは有効
        detectionMethod: 'error_fallback',
        authFilePath: this._getIsolatedAuthFilePath()
      };
      
      this._authModeInfo = defaultInfo;
      return { ...defaultInfo };
    }
  }
  
  /**
   * 分離認証モードのファイルパスを取得
   */
  private _getIsolatedAuthFilePath(): string {
    // 環境変数で明示的に指定されている場合はそれを使用
    if (process.env.CLAUDE_AUTH_FILE) {
      return process.env.CLAUDE_AUTH_FILE;
    }
    
    // OSに応じた標準的なパスを構築
    const homeDir = require('os').homedir();
    const fs = require('fs');
    const path = require('path');
    
    // 標準的な場所（.appgenius）を確認
    const dotAppGeniusDir = path.join(homeDir, '.appgenius');
    
    // ディレクトリが存在するか、作成可能な場合は.appgeniusを使用
    try {
      if (fs.existsSync(dotAppGeniusDir)) {
        return path.join(dotAppGeniusDir, 'auth.json');
      }
      
      // プラットフォーム固有のパス
      if (process.platform === 'win32') {
        // Windowsでの代替設定ディレクトリ
        const appDataDir = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
        return path.join(appDataDir, 'appgenius', 'auth.json');
      } else if (process.platform === 'darwin') {
        // macOSでの代替設定ディレクトリ
        return path.join(homeDir, 'Library', 'Application Support', 'appgenius', 'auth.json');
      } else {
        // Linux/Unixでの代替設定ディレクトリ
        const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
        return path.join(xdgConfigHome, 'appgenius', 'auth.json');
      }
    } catch (error) {
      // エラー発生時はホームディレクトリの.appgenius/auth.jsonをデフォルトとして返す
      Logger.warn(`認証ファイルパス検出中にエラー発生: ${(error as Error).message}`);
      return path.join(homeDir, '.appgenius', 'auth.json');
    }
  }
  
  /**
   * 分離認証モードが有効かどうかを返す（シンプルな形式）
   */
  public isIsolatedAuthEnabled(): boolean {
    return this.getAuthModeInfo().isIsolatedAuthEnabled;
  }

  public dispose(): void {
    this._stopAuthCheckInterval();
    this._onStateChanged.dispose();
    this._onLoginSuccess.dispose();
    this._onLoginFailed.dispose();
    this._onLogout.dispose();
    this._onTokenRefreshed.dispose();
  }
}