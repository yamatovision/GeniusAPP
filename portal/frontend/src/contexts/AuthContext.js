import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getCurrentUserFromStorage } from '../services/simple/simpleAuth.service';

/**
 * 認証コンテキスト
 * アプリケーション全体で認証状態を共有するためのコンテキスト
 */
const AuthContext = createContext(null);

/**
 * 簡素化された認証リフレッシュインターバル（ミリ秒）
 * キャッシュ間隔を5分に設定（秒数*1000）
 */
const AUTH_REFRESH_INTERVAL = 300 * 1000; // 5分

/**
 * 認証プロバイダーコンポーネント
 * 認証状態とロジックを一元管理し、子コンポーネントに提供
 */
export const AuthProvider = ({ children }) => {
  // 認証状態
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 認証状態の初期化
  useEffect(() => {
    const initAuth = async () => {
      try {
        // ローカルストレージからユーザー情報を取得
        const storedUser = getCurrentUserFromStorage();
        
        if (storedUser && storedUser.accessToken) {
          setUser(storedUser);
          setIsAuthenticated(true);
          
          // バックグラウンドで最新のユーザー情報を取得（オプショナル）
          refreshUserInfo();
        }
      } catch (err) {
        console.error('認証初期化エラー:', err);
        setError('認証情報の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // セッション無効化イベントのリスナー設定
  useEffect(() => {
    // カスタムイベントのリスナー
    const handleSessionTerminated = (event) => {
      console.log('セッション終了イベント検出:', event.detail);
      
      // エラーメッセージを設定
      setError('別の場所からログインされたため、セッションが終了しました');
      
      // ログアウト処理
      handleLogout();
      
      // ログインページへリダイレクト
      setTimeout(() => {
        window.location.href = '/simple/login?error=session_terminated';
      }, 1000);
    };
    
    // auth:logoutイベントのリスナー
    const handleAuthLogout = (event) => {
      console.log('認証ログアウトイベント検出:', event.detail);
      
      // エラーメッセージを設定
      if (event.detail?.message) {
        setError(event.detail.message);
      }
      
      // ログアウト処理
      handleLogout();
      
      // ログインページへリダイレクト
      if (event.detail?.requireRelogin) {
        setTimeout(() => {
          window.location.href = '/simple/login?error=' + (event.detail.reason || 'session_expired');
        }, 1000);
      }
    };
    
    // イベントリスナーを登録
    window.addEventListener('session:terminated', handleSessionTerminated);
    window.addEventListener('auth:logout', handleAuthLogout);
    
    // クリーンアップ
    return () => {
      window.removeEventListener('session:terminated', handleSessionTerminated);
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  // 定期的なユーザー情報の更新（オプショナル）
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // 認証情報を定期的に更新する間隔タイマー
    const refreshTimer = setInterval(() => {
      refreshUserInfo();
    }, AUTH_REFRESH_INTERVAL);
    
    return () => clearInterval(refreshTimer);
  }, [isAuthenticated]);

  /**
   * サーバーから最新のユーザー情報を取得
   * エラー時にはキャッシュを維持
   */
  const refreshUserInfo = async (force = false) => {
    if (!isAuthenticated && !force) return;
    
    try {
      const response = await axios.get('/simple/auth/check', {
        headers: { Authorization: `Bearer ${user?.accessToken}` }
      });
      
      if (response.data?.success && response.data?.data?.user) {
        // 現在のトークンを保持したまま更新
        const updatedUser = {
          ...response.data.data.user,
          accessToken: user?.accessToken,
          refreshToken: user?.refreshToken
        };
        
        setUser(updatedUser);
        
        // ストレージも更新
        localStorage.setItem('simpleUser', JSON.stringify(updatedUser));
      }
    } catch (err) {
      // エラー時はサイレントに失敗（既存の認証情報を維持）
      console.warn('静かな認証チェック失敗:', err);
      
      // セッション終了エラーの場合
      if (err.response?.data?.error?.code === 'SESSION_TERMINATED') {
        // セッション終了イベントを発行
        window.dispatchEvent(new CustomEvent('session:terminated', {
          detail: { 
            reason: 'session_terminated',
            message: '別の場所からログインされたため、セッションが終了しました'
          }
        }));
        return;
      }
      
      // 401エラーの場合はログアウト
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  };

  /**
   * ログイン処理
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   */
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/simple/auth/login', { email, password });
      
      if (response.data?.success && response.data?.data?.accessToken) {
        // 認証情報を保存
        localStorage.setItem('simpleUser', JSON.stringify(response.data.data));
        
        // 状態を更新
        setUser(response.data.data);
        setIsAuthenticated(true);
        
        return response.data;
      } else {
        throw new Error('無効なレスポンス形式です');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'ログインに失敗しました';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * ログアウト処理
   * ローカルとサーバー両方のセッションをクリア
   */
  const handleLogout = async () => {
    setLoading(true);
    
    try {
      if (user?.refreshToken) {
        // サーバーサイドのセッションをクリア（失敗しても続行）
        try {
          await axios.post('/simple/auth/logout', { refreshToken: user.refreshToken });
        } catch (err) {
          console.warn('サーバーログアウトエラー:', err);
        }
      }
    } finally {
      // ローカルストレージをクリア
      localStorage.removeItem('simpleUser');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      // 状態をリセット
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  // コンテキスト値
  const contextValue = {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    logout: handleLogout,
    refreshUserInfo
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// カスタムフック
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth は AuthProvider 内で使用する必要があります');
  }
  
  return context;
};

export default AuthContext;