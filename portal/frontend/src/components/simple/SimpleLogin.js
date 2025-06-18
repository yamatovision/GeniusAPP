import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login, forceLogin } from '../../services/simple/simpleAuth.service';
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
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  
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
      
      // アクティブセッションエラーの場合
      if (err.code === 'ACTIVE_SESSION_EXISTS') {
        setSessionInfo(err.sessionInfo);
        setShowSessionDialog(true);
        setLoading(false);
        return;
      }
      
      // エラーメッセージを設定
      setError(
        err.message || 
        'ログイン中にエラーが発生しました。後でもう一度お試しください。'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // 強制ログイン処理
  const handleForceLogin = async () => {
    setShowSessionDialog(false);
    setError('');
    setLoading(true);
    
    try {
      console.log('SimpleLogin: 強制ログイン処理開始');
      
      // 強制ログイン実行
      const response = await forceLogin(email, password);
      
      if (!response.success) {
        throw new Error(response.message || '強制ログインに失敗しました');
      }
      
      console.log('SimpleLogin: 強制ログイン成功');
      
      // ダッシュボードへリダイレクト
      setTimeout(() => {
        navigate('/simple/dashboard', { replace: true });
      }, 100);
    } catch (err) {
      console.error('SimpleLogin: 強制ログインエラー', err);
      
      // エラーメッセージを設定
      setError(
        err.message || 
        '強制ログイン中にエラーが発生しました。後でもう一度お試しください。'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // ダイアログキャンセル処理
  const handleCancelDialog = () => {
    setShowSessionDialog(false);
    setSessionInfo(null);
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
      
      {/* セッション確認ダイアログ */}
      {showSessionDialog && (
        <div className="simple-modal-overlay">
          <div className="simple-modal">
            <div className="simple-modal-header">
              <h3>別の場所からログインされています</h3>
            </div>
            <div className="simple-modal-body">
              <p>このアカウントは別の場所で使用中です。</p>
              {sessionInfo && (
                <div className="session-info">
                  <p>
                    <strong>ログイン時刻:</strong> {new Date(sessionInfo.loginTime).toLocaleString('ja-JP')}
                  </p>
                  {sessionInfo.ipAddress && (
                    <p>
                      <strong>IPアドレス:</strong> {sessionInfo.ipAddress}
                    </p>
                  )}
                </div>
              )}
              <p className="warning-text">
                こちらにログインすると、以前のセッションは自動的にログアウトされます。続けますか？
              </p>
            </div>
            <div className="simple-modal-footer">
              <button
                className="simple-button secondary"
                onClick={handleCancelDialog}
                disabled={loading}
              >
                キャンセル
              </button>
              <button
                className="simple-button primary"
                onClick={handleForceLogin}
                disabled={loading}
              >
                {loading ? 'ログイン中...' : '続ける'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleLogin;