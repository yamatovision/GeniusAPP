import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login } from '../../services/simple/simpleAuth.service';
import './SimpleLogin.css';

// VSCode環境からのログインかを判定する関数
const isVSCodeClient = () => {
  return window.location.href.includes('vscode-webview') || 
         navigator.userAgent.includes('VSCode') ||
         window.name.includes('vscode');
};

const SimpleLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  // 保存されたメールアドレスを読み込む
  useEffect(() => {
    const savedEmail = localStorage.getItem('simpleRememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
    }
    
    // URLからエラーメッセージを取得
    const params = new URLSearchParams(location.search);
    const errorMsg = params.get('error');
    if (errorMsg) {
      if (errorMsg === 'account_disabled') {
        setError('アカウントが無効化されています。管理者にお問い合わせください。');
      } else if (errorMsg === 'session_expired') {
        setError('セッションの有効期限が切れました。再度ログインしてください。');
      } else {
        setError(decodeURIComponent(errorMsg));
      }
    }
  }, [location]);

  // 入力検証
  const validateInput = () => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return false;
    }
    
    if (!password) {
      setError('パスワードを入力してください');
      return false;
    }
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setError('有効なメールアドレスを入力してください');
      return false;
    }
    
    return true;
  };

  // ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // エラー初期化
    setError('');
    
    // 入力検証
    if (!validateInput()) {
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('シンプルログイン処理開始');
      
      // メールアドレス記憶
      if (rememberMe) {
        localStorage.setItem('simpleRememberedEmail', email);
      } else {
        localStorage.removeItem('simpleRememberedEmail');
      }
      
      // ログイン実行
      const response = await login(email, password);
      
      if (!response.success) {
        throw new Error(response.message || 'ログインに失敗しました');
      }
      
      console.log('ログイン成功:', response);
      
      // VSCodeの場合は閉じる指示を表示
      if (isVSCodeClient()) {
        // VSCode拡張にメッセージを送信
        try {
          if (window.acquireVsCodeApi) {
            const vscode = window.acquireVsCodeApi();
            vscode.postMessage({ type: 'simple-login-success' });
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
      console.error('ログインエラー:', err);
      setError(
        err.message || 
        'ログイン中にエラーが発生しました。後でもう一度お試しください。'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simple-login-container">
      <div className="simple-login-card">
        <div className="simple-login-header">
          <h1>AppGenius</h1>
          <p>シンプル版ログイン</p>
          {isVSCodeClient() && (
            <p className="simple-vscode-notice">VSCode拡張用ログイン画面</p>
          )}
        </div>
        
        {error && (
          <div className="simple-error-message">{error}</div>
        )}
        
        <form onSubmit={handleLogin} className="simple-login-form">
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
            <label htmlFor="password">パスワード</label>
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
          
          <div className="simple-form-check">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe">メールアドレスを記憶する</label>
          </div>
          
          <button 
            type="submit" 
            className="simple-button primary" 
            disabled={loading}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        
        <div className="simple-login-footer">
          <p>
            アカウントをお持ちでない場合は
            <Link to="/simple/register">新規登録</Link>
            してください
          </p>
        </div>
      </div>
      
      <div className="simple-login-copyright">
        AppGenius © {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default SimpleLogin;