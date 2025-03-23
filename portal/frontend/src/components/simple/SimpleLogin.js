import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login } from '../../services/simple/simpleAuth.service';
import './SimpleLogin.css';

/**
 * シンプルログインコンポーネント
 * 独立した認証システムのログイン処理を担当
 */
const SimpleLogin = () => {
  // 状態管理
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  // React Router
  const navigate = useNavigate();
  const location = useLocation();
  
  // 初期化時の処理
  useEffect(() => {
    // 保存されたメールアドレスを読み込む
    const savedEmail = localStorage.getItem('simpleRememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
    }
    
    // URLからエラーメッセージを取得
    const params = new URLSearchParams(location.search);
    const errorMsg = params.get('error');
    
    if (errorMsg) {
      switch (errorMsg) {
        case 'account_disabled':
          setError('アカウントが無効化されています。管理者にお問い合わせください。');
          break;
        case 'session_expired':
          setError('セッションの有効期限が切れました。再度ログインしてください。');
          break;
        default:
          setError(decodeURIComponent(errorMsg));
      }
    }
  }, [location]);
  
  // 入力検証
  const validateInput = () => {
    // メールアドレス必須
    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return false;
    }
    
    // パスワード必須
    if (!password.trim()) {
      setError('パスワードを入力してください');
      return false;
    }
    
    // メールアドレス形式チェック
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
    
    // ローディング状態に設定
    setLoading(true);
    
    try {
      console.log('SimpleLogin: ログイン処理開始');
      
      // 既存のトークンで問題が発生する可能性があるため、ストレージをクリア
      localStorage.removeItem('simpleUser');
      sessionStorage.removeItem('simpleUser');
      
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
      
      console.log('SimpleLogin: ログイン成功');
      
      // トークンの内容をデバッグ表示
      try {
        const simpleUser = JSON.parse(localStorage.getItem('simpleUser') || '{}');
        const token = simpleUser.accessToken;
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('SimpleLogin: トークン内容確認', {
              issuer: payload.iss,
              audience: payload.aud,
              userId: payload.id,
              role: payload.role
            });
          }
        }
      } catch (tokenErr) {
        console.error('SimpleLogin: トークン解析エラー', tokenErr);
      }
      
      // ダッシュボードへリダイレクト
      setTimeout(() => {
        navigate('/simple/dashboard', { replace: true });
      }, 100);
    } catch (err) {
      console.error('SimpleLogin: ログインエラー', err);
      
      // エラーメッセージを設定
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
        </div>
        
        {/* エラーメッセージ表示 */}
        {error && (
          <div className="simple-error-message">{error}</div>
        )}
        
        {/* ログインフォーム */}
        <form onSubmit={handleLogin} className="simple-login-form">
          {/* メールアドレス入力 */}
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
              minLength="5"
            />
          </div>
          
          {/* パスワード入力 */}
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
              minLength="4"
            />
          </div>
          
          {/* メールアドレス記憶チェックボックス */}
          <div className="simple-form-check">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe">メールアドレスを記憶する</label>
          </div>
          
          {/* ログインボタン */}
          <button 
            type="submit" 
            className="simple-button primary" 
            disabled={loading}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        
        {/* フッター */}
        <div className="simple-login-footer">
          <p>
            アカウントをお持ちでない場合は
            <Link to="/simple/register">新規登録</Link>
            してください
          </p>
        </div>
      </div>
      
      {/* コピーライト */}
      <div className="simple-login-copyright">
        AppGenius © {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default SimpleLogin;