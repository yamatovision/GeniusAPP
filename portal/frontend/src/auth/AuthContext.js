/**
 * AuthContext.js - 認証関連のReactコンテキスト
 * 
 * AuthServiceのシンプルなラッパーとして機能し、
 * Reactコンポーネントに認証状態と機能を提供します。
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import AuthService from './AuthService';

// 認証コンテキストの作成
const AuthContext = createContext(null);

// 認証プロバイダーコンポーネント
export const AuthProvider = ({ children }) => {
  // AuthServiceのシングルトンインスタンス
  const authService = AuthService.getInstance();
  
  // 認証状態 
  const [authState, setAuthState] = useState(authService.getAuthState());
  
  // 認証状態変更イベントのリスナー
  useEffect(() => {
    console.log('AuthContext: イベントリスナー登録');
    
    // 認証状態変更時の処理
    const handleAuthChange = (event) => {
      console.log('AuthContext: 認証状態変更イベント検出', event.type);
      setAuthState(authService.getAuthState());
    };
    
    // タブがアクティブになった時の処理
    const handleFocus = () => {
      console.log('AuthContext: タブがアクティブになりました、認証状態を再確認');
      authService.checkAuth();
    };
    
    // イベントリスナーを登録
    window.addEventListener('auth:stateChanged', handleAuthChange);
    window.addEventListener('auth:logout', handleAuthChange);
    window.addEventListener('auth:login', handleAuthChange);
    window.addEventListener('focus', handleFocus);
    
    // クリーンアップ
    return () => {
      console.log('AuthContext: イベントリスナー削除');
      window.removeEventListener('auth:stateChanged', handleAuthChange);
      window.removeEventListener('auth:logout', handleAuthChange);
      window.removeEventListener('auth:login', handleAuthChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  // 最小限の認証API
  const contextValue = {
    // 状態
    ...authState,
    
    // メソッド
    login: async (email, password) => {
      try {
        return await authService.login(email, password);
      } catch (error) {
        console.error('AuthContext: ログインエラー:', error);
        throw error;
      }
    },
    
    logout: async () => {
      try {
        return await authService.logout();
      } catch (error) {
        console.error('AuthContext: ログアウトエラー:', error);
        throw error;
      }
    },
    
    getAuthHeader: () => authService.getAuthHeader()
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// シンプルなカスタムフック
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;