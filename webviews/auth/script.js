(function() {
  // vscode APIの取得
  const vscode = acquireVsCodeApi();
  
  // DOM要素
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const resetPasswordLink = document.getElementById('resetPassword');
  const loginError = document.getElementById('login-error');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const successContainer = document.getElementById('success-container');
  const loggedUserName = document.getElementById('logged-user-name');
  const loggedUserEmail = document.getElementById('logged-user-email');
  const backButton = document.getElementById('back-button');
  const logoutLink = document.getElementById('logout-link');
  
  // API URL (テンプレート変数で置換)
  const apiBaseUrl = '${apiBaseUrl}';
  
  // 初期化
  init();
  
  /**
   * 初期化関数
   */
  function init() {
    // サーバー接続確認
    checkServerConnection();
    
    // イベントリスナー設定
    setupEventListeners();
  }
  
  /**
   * イベントリスナーの設定
   */
  function setupEventListeners() {
    // ログインフォーム送信
    loginForm.addEventListener('submit', handleLoginSubmit);
    
    // パスワードリセットリンク
    resetPasswordLink.addEventListener('click', handleResetPassword);
    
    // VSCodeに戻るボタン
    if (backButton) {
      backButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'close' });
      });
    }
    
    // ログアウトリンク
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        vscode.postMessage({ command: 'logout' });
      });
    }
    
    // メッセージ受信イベント
    window.addEventListener('message', handleMessages);
  }
  
  /**
   * サーバー接続確認
   */
  function checkServerConnection() {
    // サーバー接続状態のアイコンを更新
    updateServerStatus('checking');
    
    // 接続確認（実際の実装では実際にAPIエンドポイントにpingを送信）
    setTimeout(() => {
      // 仮の実装: サーバーが接続されているものとして表示
      updateServerStatus('connected');
    }, 1500);
  }
  
  /**
   * ログインフォーム送信ハンドラー
   */
  function handleLoginSubmit(e) {
    e.preventDefault();
    
    // 入力値の検証
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // 入力検証
    if (!validateLoginInput(email, password)) {
      return;
    }
    
    // ログイン処理
    vscode.postMessage({
      command: 'login',
      email,
      password
    });
    
    // ログイン中表示
    updateServerStatus('loading', 'ログイン中...');
  }
  
  /**
   * パスワードリセットリンクハンドラー
   */
  function handleResetPassword(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    if (!email || !isValidEmail(email)) {
      showError('email-error', 'パスワードリセットには有効なメールアドレスを入力してください');
      return;
    }
    
    vscode.postMessage({
      command: 'reset-password',
      email
    });
  }
  
  /**
   * メッセージ受信ハンドラー
   */
  function handleMessages(event) {
    const message = event.data;
    
    switch (message.type) {
      case 'login-result':
        handleLoginResult(message);
        break;
        
      case 'reset-password-result':
        handleResetPasswordResult(message);
        break;
        
      case 'show-user-info':
        showUserInfo(message.user);
        break;
    }
  }
  
  /**
   * ログイン結果ハンドラー
   */
  function handleLoginResult(message) {
    if (message.success) {
      // ログイン成功
      updateServerStatus('connected');
      
      // ユーザー情報がある場合は表示
      if (message.user) {
        showUserInfo(message.user);
      }
      
      // 成功画面表示（または自動的に閉じる）
      document.querySelector('.auth-container').style.display = 'none';
      successContainer.style.display = 'block';
      successContainer.classList.add('fade-in');
      
      // パネルを自動的に閉じる（オプション）
      if (message.autoClose) {
        setTimeout(() => {
          vscode.postMessage({ command: 'close' });
        }, 2000);
      }
    } else {
      // ログイン失敗
      updateServerStatus('connected');
      showError('login-error', message.error || 'ログインに失敗しました');
    }
  }
  
  /**
   * パスワードリセット結果ハンドラー
   */
  function handleResetPasswordResult(message) {
    if (message.success) {
      // リセットメール送信成功
      showSuccessMessage('パスワードリセット手順をメールで送信しました');
    } else {
      // リセット失敗
      showError('email-error', message.error || 'パスワードリセットに失敗しました');
    }
  }
  
  /**
   * ログイン入力検証
   */
  function validateLoginInput(email, password) {
    let isValid = true;
    
    // メールアドレス検証
    if (!email) {
      showError('email-error', 'メールアドレスを入力してください');
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError('email-error', '有効なメールアドレスを入力してください');
      isValid = false;
    }
    
    // パスワード検証
    if (!password) {
      showError('password-error', 'パスワードを入力してください');
      isValid = false;
    }
    
    return isValid;
  }
  
  /**
   * メール形式チェック
   */
  function isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  }
  
  /**
   * エラー表示関数
   */
  function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // 3秒後に消える
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 3000);
  }
  
  /**
   * 成功メッセージ表示
   */
  function showSuccessMessage(message) {
    // 一時的な成功メッセージ要素を作成
    const successElement = document.createElement('div');
    successElement.className = 'success-message-popup';
    successElement.textContent = message;
    successElement.style = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #4CAF50;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1000;
      animation: fadeIn 0.3s ease-in-out;
    `;
    
    document.body.appendChild(successElement);
    
    // 3秒後に消える
    setTimeout(() => {
      successElement.style.opacity = '0';
      successElement.style.transition = 'opacity 0.3s ease-in-out';
      
      setTimeout(() => {
        document.body.removeChild(successElement);
      }, 300);
    }, 3000);
  }
  
  /**
   * サーバー接続状態の更新
   */
  function updateServerStatus(status, message) {
    switch (status) {
      case 'checking':
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'サーバーに接続中...';
        break;
        
      case 'connected':
        statusDot.className = 'status-dot connected';
        statusText.textContent = message || '接続済み';
        break;
        
      case 'disconnected':
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = message || '接続エラー';
        break;
        
      case 'loading':
        statusDot.className = 'status-dot connected';
        statusText.textContent = message || '処理中...';
        break;
    }
  }
  
  /**
   * ユーザー情報表示
   */
  function showUserInfo(user) {
    if (!user) return;
    
    if (loggedUserName) {
      loggedUserName.textContent = user.name || 'ユーザー';
    }
    
    if (loggedUserEmail) {
      loggedUserEmail.textContent = user.email || '';
    }
  }
})();