import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../../../../shared/index';
import AuthAPI from '@features/auth/api';
import { authStorage } from '@common/utils/api';

/**
 * 認証コンテキストの型定義
 */
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string, organizationName: string) => Promise<void>;
  clearError: () => void;
}

/**
 * 認証コンテキストの作成
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 認証プロバイダーコンポーネント
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * トークンが存在する場合はユーザー情報を取得する
   */
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      
      try {
        const { token } = authStorage.getAuthInfo();
        
        if (token && !authStorage.isTokenExpired()) {
          const user = await AuthAPI.getCurrentUser();
          setUser(user);
        }
      } catch (error) {
        console.error('認証初期化エラー:', error);
        authStorage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);

  /**
   * ログイン処理
   */
  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await AuthAPI.login({ email, password, rememberMe });
      setUser(response.user);
    } catch (error) {
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ログアウト処理
   */
  const logout = async () => {
    setIsLoading(true);
    
    try {
      await AuthAPI.logout();
      setUser(null);
    } catch (error) {
      console.error('ログアウトエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ユーザー登録処理
   */
  const register = async (name: string, email: string, password: string, organizationName: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await AuthAPI.register({ name, email, password, organizationName });
      setUser(response.user);
    } catch (error) {
      setError('登録に失敗しました。入力内容を確認してください。');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * エラーをクリアする
   */
  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    register,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * 認証コンテキストを使用するカスタムフック
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default useAuth;