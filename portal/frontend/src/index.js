import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';
// Bootstrap CSSをインポート
import 'bootstrap/dist/css/bootstrap.min.css';

// axios のデフォルト設定
// window.REACT_APP_API_URLが最優先（ランタイム設定）
// 次にprocess.env.REACT_APP_API_URL（ビルド時環境変数）
// 最後にフォールバックとして相対パス
const apiBaseURL = window.REACT_APP_API_URL || process.env.REACT_APP_API_URL || '/api';
console.log('API Base URL:', apiBaseURL);
axios.defaults.baseURL = apiBaseURL;

// CORS設定
axios.defaults.withCredentials = true;

// 認証システムの改善
// - 認証コンテキスト (AuthContext) を使用して一元管理
// - 認証関連のAPIリクエストは authApi.js 経由に統一
// - ローカルストレージ操作をコンテキスト内に閉じ込め
// - 不要な認証チェックの繰り返しを排除
// - レート制限エラーの発生を防止

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);