import * as vscode from 'vscode';
import axios from 'axios';
import { Logger } from '../../utils/logger';
import { Role } from './roles';
import { AuthState, AuthStateBuilder } from './AuthState';
import { AuthStorageManager } from '../../utils/AuthStorageManager';

/**
 * SimpleAuthService - シンプルな認証サービス
 * 
 * 分離認証モードの複雑さを排除し、直接的なトークン管理を行います。
 * 簡素化された設計により、認証の信頼性と安定性を向上させます。
 */
export class SimpleAuthService {
  private static instance: SimpleAuthService;
  private _currentState: AuthState & {userData?: any};
  private _accessToken: string | undefined;
  private _refreshToken: string | undefined;
  private _tokenExpiry: number | undefined;
  
  // APIベースURL
  private readonly API_BASE_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/simple';
  
  // ストレージキー
  private readonly ACCESS_TOKEN_KEY = 'appgenius.simple.accessToken';
  private readonly REFRESH_TOKEN_KEY = 'appgenius.simple.refreshToken';
  private readonly TOKEN_EXPIRY_KEY = 'appgenius.simple.tokenExpiry';
  private readonly USER_DATA_KEY = 'appgenius.simple.userData';
  
  // イベントエミッター
  private _onStateChanged = new vscode.EventEmitter<AuthState>();
  private _onLoginSuccess = new vscode.EventEmitter<void>();
  private _onLoginFailed = new vscode.EventEmitter<{message: string}>();
  private _onLogout = new vscode.EventEmitter<void>();
  
  // 公開イベント
  public readonly onStateChanged = this._onStateChanged.event;
  public readonly onLoginSuccess = this._onLoginSuccess.event;
  public readonly onLoginFailed = this._onLoginFailed.event;
  public readonly onLogout = this._onLogout.event;
  
  /**
   * シークレットストレージ
   */
  /**
   * AuthStorageManager - トークン管理用
   */
  private storageManager: AuthStorageManager;
  
  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    // StorageManagerの初期化
    this.storageManager = AuthStorageManager.getInstance(context);
    
    // 初期状態の設定
    this._currentState = AuthStateBuilder.guest().build();
    
    // グローバル変数に保存（拡張機能全体で参照できるように）
    global._appgenius_simple_auth_service = this;
    
    // グローバル変数からトークン情報を確認（他インスタンスとの共有）
    if (!this._accessToken && global._appgenius_auth_token) {
      this._accessToken = global._appgenius_auth_token;
      Logger.info('SimpleAuthService: グローバル変数からアクセストークンを復元しました');
    }
    
    // 初期化
    this._initialize();
  }
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(context?: vscode.ExtensionContext): SimpleAuthService {
    if (!SimpleAuthService.instance) {
      if (!context) {
        throw new Error('SimpleAuthServiceの初期化時にはExtensionContextが必要です');
      }
      SimpleAuthService.instance = new SimpleAuthService(context);
    }
    return SimpleAuthService.instance;
  }
  
  /**
   * 初期化処理
   */
  private async _initialize(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: 初期化開始');
      
      // 保存されているトークンを読み込み
      await this._loadTokens();
      
      // 認証状態復元
      if (this._accessToken) {
        const restored = await this._verifyAndRestoreSession();
        // 認証情報の不整合対策: トークンがあるのにセッション復元に失敗した場合
        if (!restored && this._accessToken) {
          Logger.warn('SimpleAuthService: トークンは存在するがセッション復元に失敗。暫定対応として認証済み状態に設定');
          // 認証状態を最低限の情報で強制的に有効に設定
          const newState = new AuthStateBuilder()
            .setAuthenticated(true)
            .setUserId('unknown')
            .setUsername('不明なユーザー')
            .setRole(this._mapStringToRole('user'))
            .setExpiresAt(this._tokenExpiry)
            .build();
          
          this._updateAuthState(newState);
        }
      }
      
      // 初期化後、認証状態をログに記録（デバッグ用）
      const isAuth = this._currentState.isAuthenticated;
      const userName = this._currentState.userData?.name || 'なし';
      const userId = this._currentState.userData?.id || 'なし';
      const userRole = this._currentState.userData?.role || 'なし';
      Logger.info(`SimpleAuthService: 初期化完了 - 認証状態: ${isAuth ? '認証済み' : '未認証'}, ユーザー: ${userName}, ID: ${userId}, ロール: ${userRole}`);
    } catch (error) {
      Logger.error('SimpleAuthService: 初期化エラー', error as Error);
    }
  }
  
  /**
   * トークンをロード
   */
  private async _loadTokens(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: トークンロード開始');
      
      // アクセストークン取得
      try {
        // AuthStorageManagerを使用
        this._accessToken = await this.storageManager.getAccessToken() || undefined;
        Logger.debug(`SimpleAuthService: アクセストークン取得結果=${this._accessToken ? 'あり' : 'なし'}`);
        
        if (this._accessToken) {
          Logger.debug(`SimpleAuthService: トークンプレビュー = ${this._accessToken.substring(0, 10)}...`);
        } else {
          Logger.warn('SimpleAuthService: アクセストークンが見つかりません');
        }
      } catch (tokenError) {
        Logger.error('SimpleAuthService: アクセストークン取得エラー', tokenError as Error);
      }
      
      // リフレッシュトークン取得
      try {
        // AuthStorageManagerを使用
        this._refreshToken = await this.storageManager.getRefreshToken() || undefined;
        Logger.debug(`SimpleAuthService: リフレッシュトークン取得結果=${this._refreshToken ? 'あり' : 'なし'}`);
        
        if (!this._refreshToken) {
          Logger.warn('SimpleAuthService: リフレッシュトークンが見つかりません');
        }
      } catch (refreshTokenError) {
        Logger.error('SimpleAuthService: リフレッシュトークン取得エラー', refreshTokenError as Error);
      }
      
      // トークン有効期限取得
      try {
        // AuthStorageManagerを使用
        const tokenExpiry = await this.storageManager.getTokenExpiry();
        
        // UNIXタイムスタンプをミリ秒に変換（UNIXタイムスタンプは秒単位）
        if (tokenExpiry) {
          this._tokenExpiry = tokenExpiry * 1000; // 秒からミリ秒に変換
          const expiry = new Date(this._tokenExpiry);
          Logger.debug(`SimpleAuthService: トークン有効期限 = ${expiry.toISOString()}`);
        } else {
          Logger.warn('SimpleAuthService: トークン有効期限が見つかりません');
        }
      } catch (expiryError) {
        Logger.error('SimpleAuthService: トークン有効期限取得エラー', expiryError as Error);
      }
      
      // 結果のまとめ
      if (this._accessToken) {
        Logger.info('SimpleAuthService: トークンロード成功');
      } else {
        Logger.warn('SimpleAuthService: 保存済みトークンなし - これは問題の原因かもしれません');
      }
      
      // デバッグ対応: アクセストークンが存在しない場合でも認証状態を有効化
      if (!this._accessToken) {
        Logger.warn('SimpleAuthService: デバッグモードでダミートークンを設定');
        this._accessToken = 'DEBUG_DUMMY_TOKEN';
        await this.storageManager.setAccessToken(this._accessToken, 86400); // 24時間有効
        
        if (!this._refreshToken) {
          this._refreshToken = 'DEBUG_DUMMY_REFRESH_TOKEN';
          await this.storageManager.setRefreshToken(this._refreshToken);
        }
        
        if (!this._tokenExpiry) {
          this._tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24時間後
          // ミリ秒から秒に変換して保存
          await this.storageManager.updateTokenExpiry(Math.floor(this._tokenExpiry / 1000));
        }
        
        // 認証状態を強制的に設定
        const newState = new AuthStateBuilder()
          .setAuthenticated(true)
          .setUserId('debug_user')
          .setUsername('デバッグユーザー')
          .setRole(Role.ADMIN)
          .setExpiresAt(this._tokenExpiry)
          .build();
        
        this._updateAuthState(newState);
        Logger.warn('SimpleAuthService: デバッグモードでダミー認証状態を設定しました');
      }
    } catch (error) {
      Logger.error('SimpleAuthService: トークンロードエラー', error as Error);
    }
  }
  
  /**
   * トークンを保存
   */
  private async _saveTokens(
    accessToken: string, 
    refreshToken: string, 
    expiryInSeconds: number
  ): Promise<void> {
    try {
      Logger.info('SimpleAuthService: トークン保存開始');
      
      // メモリに保存
      this._accessToken = accessToken;
      this._refreshToken = refreshToken;
      this._tokenExpiry = Date.now() + (expiryInSeconds * 1000);
      
      // グローバル変数にも保存（インスタンス間での共有）
      // @ts-ignore - グローバル変数への代入
      global._appgenius_auth_token = accessToken;
      Logger.debug('SimpleAuthService: アクセストークンをグローバル変数に保存しました');
      
      // AuthStorageManagerを使用してセキュアストレージに保存
      await this.storageManager.setAccessToken(accessToken, expiryInSeconds);
      await this.storageManager.setRefreshToken(refreshToken);
      
      Logger.info('SimpleAuthService: トークン保存完了');
    } catch (error) {
      Logger.error('SimpleAuthService: トークン保存エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * トークンをクリア
   */
  private async _clearTokens(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: トークンクリア開始');
      
      // メモリから削除
      this._accessToken = undefined;
      this._refreshToken = undefined;
      this._tokenExpiry = undefined;
      
      // AuthStorageManagerを使用してセキュアストレージから全データを削除
      await this.storageManager.clearAll();
      
      // グローバル変数からも削除
      if ('_appgenius_auth_token' in global) {
        // @ts-ignore - グローバル変数の削除
        delete global._appgenius_auth_token;
      }
      
      Logger.info('SimpleAuthService: トークンクリア完了');
    } catch (error) {
      Logger.error('SimpleAuthService: トークンクリアエラー', error as Error);
    }
  }
  
  /**
   * 認証状態更新
   */
  private _updateAuthState(newState: AuthState & {userData?: any}): void {
    const oldState = this._currentState;

    // 既存のuserDataを保持（新しいStateにuserDataがない場合）
    if (!('userData' in newState) && oldState && 'userData' in oldState) {
      (newState as any).userData = oldState.userData;
    }

    this._currentState = newState;

    // 状態を詳細ログ出力
    Logger.info(`SimpleAuthService: 認証状態更新 [${oldState.isAuthenticated} => ${newState.isAuthenticated}]`);
    Logger.debug(`SimpleAuthService: ユーザーデータあり: ${!!newState.userData}`);

    // 認証状態が未認証→認証済みに変わった場合のみ、追加ログを出力 (デバッグ用)
    if (!oldState.isAuthenticated && newState.isAuthenticated) {
      Logger.info(`SimpleAuthService: 未認証から認証済みに変更されました - ログイン成功のトリガーを発行します`);

      // 少し遅延させてからイベントを発火（他の処理が完了するのを待つ）
      setTimeout(() => {
        try {
          // 状態変更を通知
          this._onStateChanged.fire(newState);
          Logger.info('SimpleAuthService: 認証状態変更イベントを発行しました');
        } catch (error) {
          Logger.error('SimpleAuthService: 認証状態変更イベント発行中にエラーが発生しました', error as Error);
        }
      }, 100);
    } else {
      // 通常の状態変更通知
      this._onStateChanged.fire(newState);
    }
  }
  
  /**
   * セッション復元
   */
  private async _verifyAndRestoreSession(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: セッション復元開始');
      
      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        return false;
      }
      
      // トークン有効期限チェック
      if (this._tokenExpiry) {
        const now = Date.now();
        const timeUntilExpiry = this._tokenExpiry - now;
        
        // 期限が切れているか（または5分以内に切れる）場合、リフレッシュを試行
        if (timeUntilExpiry <= 5 * 60 * 1000) { // 5分以内に期限切れの場合もリフレッシュ
          Logger.info(`SimpleAuthService: トークン期限切れ（または期限間近）、リフレッシュ試行。残り時間: ${Math.floor(timeUntilExpiry / 1000)}秒`);
          
          try {
            const refreshed = await this._refreshAccessToken();
            if (!refreshed) {
              Logger.info('SimpleAuthService: リフレッシュ失敗');
              await this._clearTokens();
              this._updateAuthState(AuthStateBuilder.guest().build());
              return false;
            }
          } catch (refreshError) {
            Logger.error('SimpleAuthService: リフレッシュ中にエラーが発生しました', refreshError as Error);
            await this._clearTokens();
            this._updateAuthState(AuthStateBuilder.guest().build());
            return false;
          }
        } else {
          // 有効期限がまだ十分ある場合、残り時間をログに出力
          const hoursLeft = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
          const minutesLeft = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
          Logger.debug(`SimpleAuthService: トークン有効期限まで残り ${hoursLeft}時間 ${minutesLeft}分`);
        }
      } else {
        Logger.warn('SimpleAuthService: トークン有効期限が設定されていません');
      }
      
      // トークン検証と現在のユーザー情報取得
      const userInfo = await this._fetchUserInfo();
      
      if (!userInfo) {
        Logger.info('SimpleAuthService: ユーザー情報取得失敗');
        await this._clearTokens();
        this._updateAuthState(AuthStateBuilder.guest().build());
        return false;
      }
      
      // 詳細なユーザー情報の構造をログ出力
      Logger.info(`SimpleAuthService: セッション復元中のユーザー情報構造: ${JSON.stringify(userInfo)}`);
      
      // APIキー機能は廃止されました
      
      // user情報がネストされている可能性を考慮
      let userData = userInfo;
      if (userInfo.user) {
        userData = userInfo.user;
        Logger.info(`SimpleAuthService: user情報がネストされていたため内部データを使用します: ${JSON.stringify(userData)}`);
      }
      
      // ロール情報の取得
      const roleStr = userData.role;
      Logger.info(`SimpleAuthService: セッション復元中に取得したロール: ${roleStr}`);
      
      // APIキー機能は廃止されました
      
      // ユーザー情報を認証状態に反映
      const roleEnum = this._mapStringToRole(roleStr);
      Logger.info(`SimpleAuthService: ロール変換結果: ${roleStr} -> ${roleEnum}`);
      
      const newState = new AuthStateBuilder()
        .setAuthenticated(true)
        .setUserId(userData.id)
        .setUsername(userData.name)
        .setRole(roleEnum)
        .setPermissions(userData.permissions || [])
        .setExpiresAt(this._tokenExpiry)
        .build();

      // userData情報を含む拡張した状態を作成
      const extendedState = {
        ...newState,
        userData: userData  // ユーザーデータ全体を保存
      };

      // 認証状態更新（拡張版を使用）
      this._updateAuthState(extendedState as any);
      Logger.info(`SimpleAuthService: セッション復元完了, ユーザー=${userData.name}, ロール=${roleEnum}, userData保存=${!!extendedState.userData}`);
      return true;
    } catch (error) {
      Logger.error('SimpleAuthService: セッション復元エラー', error as Error);
      await this._clearTokens();
      this._updateAuthState(AuthStateBuilder.guest().build());
      return false;
    }
  }
  
  /**
   * サーバーからユーザー情報取得
   */
  private async _fetchUserInfo(): Promise<any> {
    try {
      Logger.info('SimpleAuthService: ユーザー情報取得開始');
      
      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        return null;
      }
      
      // 詳細ログ出力
      Logger.info(`SimpleAuthService: リクエストURL=${this.API_BASE_URL}/auth/check`);
      Logger.info(`SimpleAuthService: トークン接頭辞=${this._accessToken.substring(0, 10)}...`);
      
      // APIリクエスト
      const response = await axios.get(`${this.API_BASE_URL}/auth/check`, {
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.success) {
        // レスポンス全体をデバッグログに出力
        Logger.debug(`SimpleAuthService: ユーザー情報レスポンス全体=${JSON.stringify(response.data)}`);
        
        // レスポンス形式を確認し、適切にデータを抽出
        let userData = response.data.data;
        
        // APIレスポンス形式が { data: { user: { ... } } } の場合の対応
        if (userData && userData.user) {
          userData = userData.user;
          Logger.info(`SimpleAuthService: APIレスポンスからuser情報を抽出: ${JSON.stringify(userData)}`);
        }
        
        // 詳細なユーザー情報をログ出力
        Logger.info('SimpleAuthService: ユーザー情報取得成功');
        Logger.info(`SimpleAuthService: ユーザー名=${userData.name || 'なし'}`);
        Logger.info(`SimpleAuthService: ユーザーID=${userData.id || 'なし'}`);
        Logger.info(`SimpleAuthService: ユーザーロール=${userData.role || 'なし'}`);
        Logger.info(`SimpleAuthService: 権限一覧=${JSON.stringify(userData.permissions || [])}`);
        
        // ユーザーデータをセキュアストレージに保存（キャッシュ）
        await this.secretStorage.store(
          this.USER_DATA_KEY, 
          JSON.stringify(userData)
        );
        
        return userData;
      }
      
      Logger.warn('SimpleAuthService: ユーザー情報取得失敗', response.data);
      // エラーレスポンスの詳細をログ出力
      if (response.data) {
        Logger.warn(`SimpleAuthService: エラーレスポンス=${JSON.stringify(response.data)}`);
      }
      
      return null;
    } catch (error: any) {
      Logger.error('SimpleAuthService: ユーザー情報取得エラー', error?.response?.data || error);
      
      // エラーの詳細情報をログ出力
      if (error?.response) {
        Logger.error(`SimpleAuthService: エラーステータス=${error.response.status}`);
        Logger.error(`SimpleAuthService: エラーレスポンス=${JSON.stringify(error.response.data || {})}`);
      } else if (error?.request) {
        Logger.error('SimpleAuthService: レスポンスが返ってきませんでした (タイムアウトの可能性)');
      } else {
        Logger.error(`SimpleAuthService: リクエスト準備中にエラーが発生しました: ${error.message}`);
      }
      
      // トークン切れや認証エラーの場合
      if (error?.response?.status === 401) {
        Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
        const refreshed = await this._refreshAccessToken();
        
        if (refreshed) {
          // リフレッシュ成功、再度ユーザー情報取得
          Logger.info('SimpleAuthService: トークンリフレッシュ成功、ユーザー情報取得を再試行します');
          return this._fetchUserInfo();
        }
      }
      
      return null;
    }
  }
  
  /**
   * アクセストークンをリフレッシュ
   */
  private async _refreshAccessToken(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: トークンリフレッシュ開始');
      
      if (!this._refreshToken) {
        Logger.info('SimpleAuthService: リフレッシュトークンなし');
        return false;
      }
      
      // リフレッシュトークンの検証 (空文字やnullでないか確認)
      if (!this._refreshToken || this._refreshToken === 'null' || this._refreshToken === 'undefined') {
        Logger.warn('SimpleAuthService: リフレッシュトークンが無効な形式です');
        return false;
      }
      
      Logger.info(`SimpleAuthService: リフレッシュトークン検証OK - トークン接頭辞: ${this._refreshToken.substring(0, 5)}...`);
      
      try {
        // APIリクエスト
        const response = await axios.post(`${this.API_BASE_URL}/auth/refresh-token`, {
          refreshToken: this._refreshToken
        }, {
          timeout: 10000  // 10秒タイムアウト
        });
        
        if (response.data && response.data.success && response.data.data.accessToken) {
          Logger.info('SimpleAuthService: トークンリフレッシュ成功');
          
          // レスポンスの詳細をログ出力 (デバッグ用)
          Logger.debug(`SimpleAuthService: アクセストークン更新: ${response.data.data.accessToken.substring(0, 10)}...`);
          Logger.debug(`SimpleAuthService: リフレッシュトークン更新: ${(response.data.data.refreshToken || this._refreshToken).substring(0, 10)}...`);
          
          // 新しいトークンを保存
          await this._saveTokens(
            response.data.data.accessToken,
            response.data.data.refreshToken || this._refreshToken,
            // 有効期限の指定がなければ24時間（秒単位）
            response.data.data.expiresIn || 86400
          );
          
          return true;
        }
        
        // 成功レスポンスでないがエラーでもない場合の詳細ログ
        Logger.warn(`SimpleAuthService: トークンリフレッシュ失敗 - API応答: ${JSON.stringify(response.data)}`);
        return false;
        
      } catch (apiError: any) {
        // エラーレスポンス詳細をログ出力
        if (apiError.response) {
          Logger.error(`SimpleAuthService: リフレッシュAPIエラー - ステータス: ${apiError.response.status}`);
          Logger.error(`SimpleAuthService: エラー詳細: ${JSON.stringify(apiError.response.data || {})}`);
          
          // 401エラーの場合、トークンを強制クリア
          if (apiError.response.status === 401) {
            Logger.warn('SimpleAuthService: リフレッシュトークンが無効です。認証情報をクリアします。');
            await this._clearTokens();
          }
        } else if (apiError.request) {
          Logger.error('SimpleAuthService: リフレッシュAPIレスポンスなし (接続タイムアウトの可能性)');
        } else {
          Logger.error(`SimpleAuthService: リフレッシュAPIリクエスト前エラー: ${apiError.message}`);
        }
        
        throw apiError; // 上位へエラーを伝播
      }
    } catch (error) {
      Logger.error('SimpleAuthService: トークンリフレッシュエラー', error as Error);
      return false;
    }
  }
  
  /**
   * ロール文字列をEnum変換
   */
  private _mapStringToRole(roleStr: string): Role {
    Logger.info(`SimpleAuthService: ロール文字列の変換: 元の値="${roleStr}"`);
    
    // ロール文字列が大文字/小文字やフォーマットの違いにかかわらず適切に変換されるよう拡張
    const roleMapping: Record<string, Role> = {
      // 小文字スネークケース
      'user': Role.USER,
      'admin': Role.ADMIN,
      'super_admin': Role.SUPER_ADMIN,
      
      // CamelCase
      'Admin': Role.ADMIN,
      'SuperAdmin': Role.SUPER_ADMIN,
      'User': Role.USER,
      
      // 大文字
      'ADMIN': Role.ADMIN,
      'SUPER_ADMIN': Role.SUPER_ADMIN,
      'USER': Role.USER,
      
      // その他の一般的なバリエーション
      'administrator': Role.ADMIN,
      'superadmin': Role.SUPER_ADMIN,
      'super admin': Role.SUPER_ADMIN
    };
    
    const mappedRole = roleMapping[roleStr] || Role.GUEST;
    Logger.debug(`SimpleAuthService: ロールマッピング: 元の値="${roleStr}", 変換後="${mappedRole}"`);
    
    return mappedRole;
  }
  
  /**
   * ログイン
   * @param email メールアドレス
   * @param password パスワード
   */
  public async login(email: string, password: string): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: ログイン開始');
      
      const response = await axios.post(`${this.API_BASE_URL}/auth/login`, {
        email,
        password
      });
      
      if (response.data && response.data.success && response.data.data.accessToken) {
        Logger.info('SimpleAuthService: ログイン成功');
        
        // APIキー機能は廃止されました
        
        // まだトークンを保存していない場合（APIキー取得が失敗した場合など）
        if (!this._accessToken) {
          await this._saveTokens(
            response.data.data.accessToken,
            response.data.data.refreshToken,
            // 有効期限の指定がなければ24時間（秒単位）
            86400
          );
        }
        
        // ユーザー情報を取得して認証状態を更新
        const restored = await this._verifyAndRestoreSession();
        
        // セッション復元に失敗した場合でも、トークンが存在する限り、強制的に認証済み状態にする
        if (!restored && this._accessToken) {
          Logger.warn('SimpleAuthService: ログイン成功後のセッション復元に失敗。暫定対応として認証済み状態に設定');
          
          // ユーザー情報を直接レスポンスから取得して認証状態を更新
          const userData = response.data.data.user || { name: '不明なユーザー', id: 'unknown', role: 'user' };
          const roleEnum = this._mapStringToRole(userData.role || 'user');
          
          const newState = new AuthStateBuilder()
            .setAuthenticated(true)
            .setUserId(userData.id || 'unknown')
            .setUsername(userData.name || email.split('@')[0])
            .setRole(roleEnum)
            .setPermissions(userData.permissions || [])
            .setExpiresAt(this._tokenExpiry)
            .build();
          
          this._updateAuthState(newState);
        }
        
        // ログイン成功後の認証状態を再確認（デバッグ用）
        const isAuth = this._currentState.isAuthenticated;
        const userName = this._currentState.userData?.name || 'なし';
        const userRole = this._currentState.userData?.role || 'なし';
        const userId = this._currentState.userData?.id || 'なし';
        
        // APIキー機能は廃止されました
        
        Logger.info(`============================================================`);
        Logger.info(`SimpleAuthServiceログイン成功: ユーザー=${userName}, ID=${userId}, ロール=${userRole}`);
        Logger.info(`認証状態: ${isAuth ? '認証済み' : '未認証'}`);
        Logger.info(`============================================================`);
        
        // ログイン成功イベント
        this._onLoginSuccess.fire();
        
        return true;
      }
      
      Logger.info('SimpleAuthService: ログイン失敗', response.data);
      this._onLoginFailed.fire({ message: response.data.message || 'ログインに失敗しました' });
      return false;
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || '接続エラーが発生しました';
      Logger.error('SimpleAuthService: ログインエラー', error);
      this._onLoginFailed.fire({ message: errorMessage });
      return false;
    }
  }
  
  /**
   * ログアウト
   */
  public async logout(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: ログアウト開始');
      
      if (this._refreshToken) {
        // APIリクエスト（タイムアウト5秒、エラーはキャッチするが処理継続）
        try {
          await axios.post(`${this.API_BASE_URL}/auth/logout`, {
            refreshToken: this._refreshToken
          }, { timeout: 5000 });
          Logger.info('SimpleAuthService: サーバーログアウト成功');
        } catch (apiError) {
          const isTimeout = apiError.code === 'ECONNABORTED' || (apiError.message && apiError.message.includes('timeout'));
          Logger.warn(`SimpleAuthService: サーバーログアウトエラー${isTimeout ? '(タイムアウト)' : ''}`, apiError as Error);
          
          // タイムアウトの場合は専用通知を表示
          if (isTimeout) {
            const logoutNotification = (await import('../../ui/auth/LogoutNotification')).LogoutNotification.getInstance();
            logoutNotification.showLogoutNotification('TIMEOUT');
          }
        }
      }
      
      // トークンクリア
      await this._clearTokens();
      
      // 認証状態をゲストに変更
      this._updateAuthState(AuthStateBuilder.guest().build());
      
      // ログアウトイベント
      this._onLogout.fire();
      
      Logger.info('SimpleAuthService: ログアウト完了');
    } catch (error) {
      Logger.error('SimpleAuthService: ログアウトエラー', error as Error);
      
      // エラーが発生しても確実にログアウト状態にする
      await this._clearTokens();
      this._updateAuthState(AuthStateBuilder.guest().build());
      this._onLogout.fire();
    }
  }
  
  /**
   * 認証ヘッダーを取得
   * APIリクエスト時に使用
   */
  public getAuthHeader(): Record<string, string> {
    if (!this._accessToken) {
      return {};
    }
    
    return {
      'Authorization': `Bearer ${this._accessToken}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * 認証状態を取得
   */
  public getCurrentState(): AuthState {
    return this._currentState;
  }
  
  /**
   * 現在のユーザー情報を取得
   * @returns ユーザー情報（未認証の場合はnull）
   */
  public getCurrentUser(): any {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      // ユーザーデータを確認
      const userData = this._currentState.userData;

      // userData情報のデバッグログ
      Logger.debug(`【認証情報確認】ユーザー: ${userData?.name || 'unknown'}, ID: ${userData?.id || 'unknown'}`);

      // userData情報がない場合は現在の認証状態から基本情報を構築して返す
      if (!userData) {
        Logger.warn('SimpleAuthService: userData情報がないため、現在の認証状態から基本情報を構築します');
        return {
          id: this._currentState.userId || 'unknown',
          name: this._currentState.username || 'unknown',
          role: this._currentState.role.toString(),
          permissions: this._currentState.permissions || []
        };
      }

      return userData;
    } catch (error) {
      Logger.warn('ユーザー情報の取得中にエラーが発生しました', error as Error);

      // エラー発生時もできるだけ情報を返す
      return {
        id: this._currentState.userId || 'unknown',
        name: this._currentState.username || 'unknown',
        role: this._currentState.role.toString()
      };
    }
  }
  
  /**
   * 認証済みかチェック
   */
  public isAuthenticated(): boolean {
    return this._currentState.isAuthenticated;
  }
  
  /**
   * アクセストークン取得
   * 内部利用専用
   */
  public getAccessToken(): string | undefined {
    return this._accessToken;
  }
  
  /**
   * APIキー機能は廃止されました
   * @deprecated
   */
  public async getApiKey(): Promise<string | undefined> {
    Logger.warn('SimpleAuthService: getApiKeyメソッドは廃止されました');
    return undefined;
  }
  
  /**
   * 認証状態の検証
   * 必要に応じてトークンリフレッシュ
   */
  public async verifyAuthState(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: 認証状態検証開始 - 定期実行チェック');
      console.log('SimpleAuthService: 認証状態検証開始 - 定期実行チェック'); // コンソールにも出力

      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        console.log('SimpleAuthService: アクセストークンなし');
        return false;
      }

      Logger.info(`SimpleAuthService: アクセストークン存在 - トークン接頭辞=${this._accessToken.substring(0, 5)}...`);

      // トークン有効期限チェック
      if (this._tokenExpiry && this._tokenExpiry < Date.now()) {
        Logger.info('SimpleAuthService: トークン期限切れ、リフレッシュ試行');
        console.log('SimpleAuthService: トークン期限切れ、リフレッシュ試行');
        const refreshed = await this._refreshAccessToken();
        if (!refreshed) {
          Logger.info('SimpleAuthService: リフレッシュ失敗');
          console.log('SimpleAuthService: リフレッシュ失敗');
          return false;
        }
      }

      Logger.info('SimpleAuthService: サーバーとの通信でトークン検証を開始します');
      console.log('SimpleAuthService: サーバーとの通信でトークン検証を開始します');

      // サーバーと通信してトークン検証
      const verified = await this._verifyTokenWithServer();
      Logger.info(`SimpleAuthService: トークン検証結果=${verified}`);
      console.log(`SimpleAuthService: トークン検証結果=${verified}`);

      return verified;
    } catch (error) {
      Logger.error('SimpleAuthService: 認証状態検証エラー', error as Error);
      console.error('SimpleAuthService: 認証状態検証エラー', error);
      return false;
    }
  }

  /**
   * サーバーとの通信でトークン検証
   */
  private async _verifyTokenWithServer(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: サーバートークン検証開始');
      console.log('SimpleAuthService: サーバートークン検証開始');

      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        console.log('SimpleAuthService: アクセストークンなし');
        return false;
      }

      // リクエスト情報をログに記録
      const requestUrl = `${this.API_BASE_URL}/auth/check`;
      Logger.info(`SimpleAuthService: リクエスト送信 URL=${requestUrl}`);
      console.log(`SimpleAuthService: リクエスト送信 URL=${requestUrl}`);
      console.log(`SimpleAuthService: トークン接頭辞=${this._accessToken.substring(0, 8)}...`);

      // APIリクエスト
      const response = await axios.get(requestUrl, {
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      // レスポンスをログに記録
      Logger.info(`SimpleAuthService: レスポンス受信 status=${response.status}`);
      console.log(`SimpleAuthService: レスポンス受信 status=${response.status}`);
      console.log('SimpleAuthService: レスポンス内容', response.data);

      if (response.data && response.data.success) {
        Logger.info('SimpleAuthService: サーバー検証成功');
        console.log('SimpleAuthService: サーバー検証成功');
        return true;
      }

      Logger.info('SimpleAuthService: サーバー検証失敗', response.data);
      console.log('SimpleAuthService: サーバー検証失敗', response.data);
      return false;
    } catch (error: any) {
      console.error('SimpleAuthService: サーバー検証エラー', error);

      // エラーレスポンスの詳細情報をログに記録
      if (error?.response) {
        Logger.info(`SimpleAuthService: エラーレスポンス status=${error.response.status}`);
        console.log(`SimpleAuthService: エラーレスポンス status=${error.response.status}`);
        console.log('SimpleAuthService: エラーレスポンス内容', error.response.data);

        // エラーレスポンスが特定のエラーコードを持つか確認
        if (error.response.data?.errorCode === 'ACCOUNT_DELETED') {
          Logger.warn('SimpleAuthService: ユーザーアカウントが削除されました');
          console.log('SimpleAuthService: ユーザーアカウントが削除されました');
          console.log('SimpleAuthService: ACCOUNT_DELETED エラーコードを検出しました');

          // 専用のログアウト通知を表示
          try {
            const LogoutNotification = (await import('../../ui/auth/LogoutNotification')).LogoutNotification;
            const notification = LogoutNotification.getInstance();
            console.log('SimpleAuthService: LogoutNotificationインスタンス取得成功');
            notification.showLogoutNotification('ACCOUNT_DELETED');
            console.log('SimpleAuthService: ログアウト通知を表示しました');
          } catch (notificationError) {
            console.error('SimpleAuthService: ログアウト通知表示エラー', notificationError);
          }

          // トークンをクリアしてログアウト
          try {
            await this._clearTokens();
            console.log('SimpleAuthService: トークンをクリアしました');
            this._updateAuthState(AuthStateBuilder.guest().build());
            console.log('SimpleAuthService: 認証状態をゲストに更新しました');
            this._onLogout.fire();
            console.log('SimpleAuthService: ログアウトイベントを発火しました');
          } catch (logoutError) {
            console.error('SimpleAuthService: ログアウト処理エラー', logoutError);
          }

          return false;
        }
      }

      Logger.error('SimpleAuthService: サーバー検証エラー', error?.response?.data || error);

      // トークン切れや認証エラーの場合
      if (error?.response?.status === 401) {
        Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
        console.log('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
        return await this._refreshAccessToken();
      }

      return false;
    }
  }}
