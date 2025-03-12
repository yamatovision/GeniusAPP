// デバッグ探偵 JavaScript

(function() {
  // VSCode WebView API
  const vscode = acquireVsCodeApi();
  
  // 状態の初期化
  let state = {
    projectPath: ''
  };
  
  // DOM要素の取得
  const errorLogTextarea = document.getElementById('error-log');
  const investigateErrorBtn = document.getElementById('investigate-error-btn');
  
  
  // 初期化
  function initialize() {
    // イベントリスナーの登録
    investigateErrorBtn.addEventListener('click', investigateError);
    
    // メッセージハンドラの登録
    window.addEventListener('message', handleMessages);
  }
  
  // メッセージハンドラ
  function handleMessages(event) {
    const message = event.data;
    
    switch (message.command) {
      case 'showError':
        showError(message.message);
        break;
    }
  }
  
  
  
  
  
  // エラーの調査依頼
  function investigateError() {
    const errorLog = errorLogTextarea.value.trim();
    
    if (!errorLog) {
      showError('エラーログを入力してください');
      return;
    }
    
    vscode.postMessage({
      command: 'investigateError',
      errorLog
    });
  }
  
  
  
  // エラーセッション作成完了ハンドラ
  function handleErrorSessionCreated(message) {
    // エラーログをクリア
    errorLogTextarea.value = '';
    
    // 完了メッセージ
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.innerHTML = `
      <div class="success-icon">✅</div>
      <div class="success-text">エラーの調査を依頼しました。ClaudeCodeが起動します。</div>
    `;
    
    // 既存のメッセージがあれば削除
    const existingMessage = document.querySelector('.success-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // メッセージを表示
    document.querySelector('.error-input').appendChild(successMessage);
    
    // VSCodeの通知も表示
    vscode.postMessage({
      command: 'showVSCodeMessage',
      type: 'info',
      message: 'エラーの調査を依頼しました。ClaudeCodeが起動します。'
    });
    
    // 3秒後にメッセージを消す
    setTimeout(() => {
      const message = document.querySelector('.success-message');
      if (message) {
        message.style.opacity = '0';
        setTimeout(() => message.remove(), 500);
      }
    }, 3000);
  }
  
  
  
  // エラーメッセージの表示
  function showError(message) {
    // VSCodeの通知API
    vscode.postMessage({
      command: 'showVSCodeMessage',
      type: 'error',
      message
    });
  }
  
  // 初期化を実行
  initialize();
})();