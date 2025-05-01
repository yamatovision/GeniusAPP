/**
 * AuthGuard.js - 認証が必要なルートを保護するコンポーネント
 * 
 * 認証されていないユーザーをログインページにリダイレクトします。
 * シンプルで明確な責任を持ち、React Routerと統合されています。
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * 認証保護コンポーネント
 * 
 * @param {Object} props - コンポーネントのプロパティ
 * @param {React.ReactNode} props.children - 子コンポーネント
 * @param {string} [props.redirectTo='/login'] - リダイレクト先のパス
 */
const AuthGuard = ({ children, redirectTo = '/login' }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  // ローディング中
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>読み込み中...</p>
      </div>
    );
  }
  
  // 未認証ならリダイレクト
  if (!isAuthenticated) {
    // 現在のパスを記録してリダイレクト
    console.log('AuthGuard: 未認証ユーザー、リダイレクト', location.pathname);
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }
  
  // 認証済みなら子要素を表示
  return children;
};

/**
 * ログイン済みユーザー用の保護コンポーネント
 * ログイン済みユーザーをダッシュボードなどにリダイレクトします。
 * 
 * @param {Object} props - コンポーネントのプロパティ
 * @param {React.ReactNode} props.children - 子コンポーネント
 * @param {string} [props.redirectTo='/dashboard'] - リダイレクト先のパス
 */
export const LoginGuard = ({ children, redirectTo = '/dashboard' }) => {
  const { isAuthenticated, loading } = useAuth();
  
  // ローディング中
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>読み込み中...</p>
      </div>
    );
  }
  
  // 認証済みならリダイレクト
  if (isAuthenticated) {
    console.log('LoginGuard: すでに認証済み、リダイレクト', redirectTo);
    return <Navigate to={redirectTo} replace />;
  }
  
  // 未認証なら子要素を表示
  return children;
};

export default AuthGuard;