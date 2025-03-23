import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/simple/simpleAuth.service';
import './SimpleRegister.css';

// VSCode環境からのログインかを判定する関数
const isVSCodeClient = () => {
  return window.location.href.includes('vscode-webview') || 
         navigator.userAgent.includes('VSCode') ||
         window.name.includes('vscode');
};

const SimpleRegister = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // 入力検証
  const validateInput = () => {
    if (!name) {
      setError('ユーザー名を入力してください');
      return false;
    }
    
    if (!email) {
      setError('メールアドレスを入力してください');
      return false;
    }
    
    if (!password) {
      setError('パスワードを入力してください');
      return false;
    }
    
    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return false;
    }
    
    if (password.length < 8) {
      setError('パスワードは8文字以上である必要があります');
      return false;
    }
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setError('有効なメールアドレスを入力してください');
      return false;
    }
    
    return true;
  };

  // ユーザー登録処理
  const handleRegister = async (e) => {
    e.preventDefault();
    
    // エラー初期化
    setError('');
    
    // 入力検証
    if (!validateInput()) {
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('シンプルユーザー登録処理開始');
      
      // ユーザー登録実行
      const response = await register(name, email, password);
      
      if (!response.success) {
        throw new Error(response.message || 'ユーザー登録に失敗しました');
      }
      
      console.log('ユーザー登録成功:', response);
      
      // VSCodeの場合は閉じる指示を表示
      if (isVSCodeClient()) {
        // VSCode拡張にメッセージを送信
        try {
          if (window.acquireVsCodeApi) {
            const vscode = window.acquireVsCodeApi();
            vscode.postMessage({ type: 'simple-register-success' });
          }
        } catch (e) {
          console.error('VSCode API呼び出しエラー:', e);
        }
        
        // メッセージを表示（VSCode拡張が処理を続行）
        setError('');
        return;
      }
      
      // 通常のウェブアプリの場合はシンプルダッシュボードにリダイレクト
      console.log('シンプルダッシュボードへリダイレクト');
      
      // リダイレクトを遅延させて確実に状態を更新
      setTimeout(() => {
        navigate('/simple/dashboard', { replace: true });
      }, 100);
    } catch (err) {
      console.error('ユーザー登録エラー:', err);
      setError(
        err.message || 
        'ユーザー登録中にエラーが発生しました。後でもう一度お試しください。'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simple-register-container">
      <div className="simple-register-card">
        <div className="simple-register-header">
          <h1>AppGenius</h1>
          <p>シンプル版ユーザー登録</p>
          {isVSCodeClient() && (
            <p className="simple-vscode-notice">VSCode拡張用登録画面</p>
          )}
        </div>
        
        {error && (
          <div className="simple-error-message">{error}</div>
        )}
        
        <form onSubmit={handleRegister} className="simple-register-form">
          <div className="simple-form-group">
            <label htmlFor="name">ユーザー名</label>
            <input
              type="text"
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="ユーザー名"
              required
            />
          </div>
          
          <div className="simple-form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="example@example.com"
              required
            />
          </div>
          
          <div className="simple-form-group">
            <label htmlFor="password">パスワード (8文字以上)</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div className="simple-form-group">
            <label htmlFor="confirmPassword">パスワード (確認)</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="simple-button primary" 
            disabled={loading}
          >
            {loading ? '登録中...' : 'ユーザー登録'}
          </button>
        </form>
        
        <div className="simple-register-footer">
          <p>
            既にアカウントをお持ちの場合は
            <Link to="/simple/login">ログイン</Link>
            してください
          </p>
        </div>
      </div>
      
      <div className="simple-register-copyright">
        AppGenius © {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default SimpleRegister;