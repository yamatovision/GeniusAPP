/**
 * AuthService.js - 認証システムの中核となるサービス
 * 
 * このサービスは認証関連のすべての状態管理とロジックを担当し、
 * 「単一の信頼できる情報源」として機能します。
 */

// APIのベースURL
const API_URL = '/api/v1'; 
const SIMPLE_API_URL = '/api/simple';

class AuthService {
  // シングルトンインスタンス
  static instance = null;
  
  // プライベート状態
  #authenticated = false;
  #user = null;
  #loading = true;
  #error = null;
  #accessToken = null;
  
  // シンプルなリフレッシュサイクル
  #refreshInterval = 60 * 1000; // 1分
  #refreshTimer = null;
  
  // シングルトンインスタンスの取得
  static getInstance() {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  // 初期化
  constructor() {
    this.init();
  }
  
  // 初期化処理
  async init() {
    console.log('AuthService: 初期化開始');
    this.#loading = true;
    
    // ローカルストレージから認証情報を取得
    try {
      const userData = this.#loadUserData();
      if (userData && userData.accessToken) {
        console.log('AuthService: 保存された認証情報を検出');
        this.#user = userData;
        this.#authenticated = true;
        this.#accessToken = userData.accessToken;
        this.#startRefreshCycle();
      } else {
        console.log('AuthService: 認証情報がありません');
        this.#authenticated = false;
        this.#user = null;
      }
    } catch (e) {
      console.error('AuthService: 認証初期化エラー:', e);
      this.#error = e.message;
    } finally {
      this.#loading = false;
      this.#notifyStateChange();
    }
  }
  
  // ログイン
  async login(email, password) {
    console.log('AuthService: ログイン開始');
    this.#loading = true;
    this.#error = null;
    this.#notifyStateChange();
    
    try {
      // APIリクエスト
      const response = await fetch(`${SIMPLE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'ログインに失敗しました');
      }
      
      console.log('AuthService: ログイン成功');
      
      // 認証情報を保存
      this.#user = data.data;
      this.#authenticated = true;
      this.#accessToken = data.data.accessToken;
      this.#saveUserData(data.data);
      this.#startRefreshCycle();
      
      // ログインイベントを発行
      window.dispatchEvent(new CustomEvent('auth:login', {
        detail: { timestamp: Date.now() }
      }));
      
      return data;
    } catch (error) {
      console.error('AuthService: ログインエラー:', error);
      this.#error = error.message;
      throw error;
    } finally {
      this.#loading = false;
      this.#notifyStateChange();
    }
  }
  
  // ログアウト
  async logout() {
    console.log('AuthService: ログアウト開始');
    
    try {
      // リフレッシュサイクルを停止
      this.#stopRefreshCycle();
      
      // ユーザー情報を取得（サーバーログアウト用）
      const refreshToken = this.#user?.refreshToken;
      
      // ローカルでの状態クリア
      this.#clearUserData();
      this.#authenticated = false;
      this.#user = null;
      this.#accessToken = null;
      
      // 状態変更を通知
      this.#notifyStateChange();
      
      // ログアウトイベントを発行
      window.dispatchEvent(new CustomEvent('auth:logout', {
        detail: { reason: 'user_logout', timestamp: Date.now() }
      }));
      
      // サーバーへのログアウトは非同期で行い、クライアント側では結果を待たない
      if (refreshToken) {
        try {
          fetch(`${SIMPLE_API_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          }).catch(e => console.warn('AuthService: サーバーログアウトエラー:', e));
        } catch (e) {
          // エラーを無視（ログアウトは既に完了しているため）
          console.warn('AuthService: サーバーログアウト要求エラー:', e);
        }
      }
      
      console.log('AuthService: ログアウト完了');
      return { success: true };
    } catch (error) {
      console.error('AuthService: ログアウトエラー:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 認証状態の取得
  getAuthState() {
    return {
      isAuthenticated: this.#authenticated,
      user: this.#user,
      loading: this.#loading,
      error: this.#error
    };
  }
  
  // 認証状態の確認
  checkAuth() {
    console.log('AuthService: 認証状態確認');
    this.#verifyAuth().catch(e => {
      console.warn('AuthService: 認証状態確認エラー:', e);
    });
  }
  
  // 認証ヘッダーの取得
  getAuthHeader() {
    return this.#accessToken 
      ? { 'Authorization': `Bearer ${this.#accessToken}` }
      : {};
  }
  
  // プライベートメソッド: ユーザーデータの保存
  #saveUserData(userData) {
    try {
      localStorage.setItem('simpleUser', JSON.stringify(userData));
      // 冗長性のため主要トークンを別途保存
      localStorage.setItem('accessToken', userData.accessToken);
    } catch (e) {
      console.error('AuthService: ユーザーデータ保存エラー:', e);
    }
  }
  
  // プライベートメソッド: ユーザーデータの読み込み
  #loadUserData() {
    try {
      const data = localStorage.getItem('simpleUser');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('AuthService: ユーザーデータ読み込みエラー:', e);
      return null;
    }
  }
  
  // プライベートメソッド: ユーザーデータのクリア
  #clearUserData() {
    try {
      // すべての認証関連ストレージをクリア
      localStorage.removeItem('simpleUser');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      sessionStorage.removeItem('simpleUser');
      sessionStorage.removeItem('auth_state');
      
      // その他のキャッシュもクリア
      localStorage.removeItem('last_auth_check');
      localStorage.removeItem('auth_cache');
    } catch (e) {
      console.error('AuthService: ユーザーデータクリアエラー:', e);
    }
  }
  
  // プライベートメソッド: 状態変更通知
  #notifyStateChange() {
    // カスタムイベントで状態変更を通知
    window.dispatchEvent(new CustomEvent('auth:stateChanged', {
      detail: this.getAuthState()
    }));
  }
  
  // プライベートメソッド: リフレッシュサイクル開始
  #startRefreshCycle() {
    console.log('AuthService: リフレッシュサイクル開始');
    this.#stopRefreshCycle();
    this.#refreshTimer = setInterval(() => {
      this.#verifyAuth();
    }, this.#refreshInterval);
  }
  
  // プライベートメソッド: リフレッシュサイクル停止
  #stopRefreshCycle() {
    if (this.#refreshTimer) {
      console.log('AuthService: リフレッシュサイクル停止');
      clearInterval(this.#refreshTimer);
      this.#refreshTimer = null;
    }
  }
  
  // プライベートメソッド: 認証検証
  async #verifyAuth() {
    if (!this.#authenticated || !this.#accessToken) return false;
    
    try {
      console.log('AuthService: 認証状態検証');
      const response = await fetch(`${SIMPLE_API_URL}/auth/check`, {
        headers: { 'Authorization': `Bearer ${this.#accessToken}` }
      });
      
      if (!response.ok) {
        console.warn('AuthService: トークンが無効です');
        // トークンが無効な場合はログアウト
        this.logout();
        return false;
      }
      
      console.log('AuthService: トークンは有効です');
      return true;
    } catch (e) {
      console.warn('AuthService: 認証検証エラー:', e);
      return false;
    }
  }
}

export default AuthService;