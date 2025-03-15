import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';
// Bootstrap CSSをインポート
import 'bootstrap/dist/css/bootstrap.min.css';

// axios のデフォルト設定
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// レスポンスインターセプター（トークンリフレッシュのため）
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // トークン期限切れエラーの場合でリトライフラグがない場合
    if (error.response?.status === 401 && 
        error.response?.data?.error?.code === 'TOKEN_EXPIRED' && 
        !originalRequest._retry) {
      
      originalRequest._retry = true;
      
      try {
        // リフレッシュトークンから新しいアクセストークンを取得
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          // リフレッシュトークンがない場合は再ログインが必要
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(error);
        }
        
        const res = await axios.post('/auth/refresh-token', { refreshToken });
        
        if (res.data.accessToken) {
          // 新しいトークンを保存
          localStorage.setItem('accessToken', res.data.accessToken);
          
          // 元のリクエストのヘッダーを更新
          axios.defaults.headers.common['Authorization'] = 'Bearer ' + res.data.accessToken;
          originalRequest.headers['Authorization'] = 'Bearer ' + res.data.accessToken;
          
          // 元のリクエストを再試行
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // リフレッシュに失敗した場合は再ログインが必要
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// リクエストインターセプター（トークンを自動付与）
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);