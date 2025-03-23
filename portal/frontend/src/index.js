import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';
// Bootstrap CSSをインポート
import 'bootstrap/dist/css/bootstrap.min.css';
// シンプル認証用のトークンリフレッシュをインポート
import './utils/token-refresh';

// axios のデフォルト設定
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// 古い認証システムのレスポンスインターセプターを削除 (2025/3/23)
// シンプルモードのみを使用するように統一
// すべてのリクエストは token-refresh.js で対応

// 古い認証システムのリクエストインターセプターを削除 (2025/3/23)
// すべてのリクエストはtoken-refresh.jsで対応するように変更

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);