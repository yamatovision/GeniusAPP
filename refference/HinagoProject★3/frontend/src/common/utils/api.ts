import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_PATHS, ApiResponse } from '../../../../shared/index';

/**
 * API基本設定
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const DEFAULT_TIMEOUT = 15000; // 15秒

/**
 * カスタムAxiosインスタンスの作成
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 認証トークンを取得する
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * 認証関連のストレージ操作
 */
export const authStorage = {
  /**
   * トークンを保存する
   */
  saveTokens: (token: string, refreshToken: string, expiresAt: string, rememberMe: boolean = false): void => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('expiresAt', expiresAt);
    localStorage.setItem('rememberMe', String(rememberMe));
  },

  /**
   * トークンを削除する
   */
  clearTokens: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('expiresAt');
    localStorage.removeItem('rememberMe');
  },

  /**
   * トークンの有効期限をチェックする
   */
  isTokenExpired: (): boolean => {
    const expiresAt = localStorage.getItem('expiresAt');
    if (!expiresAt) return true;
    
    return new Date(expiresAt).getTime() <= new Date().getTime();
  },

  /**
   * すべての認証情報を取得する
   */
  getAuthInfo: () => {
    return {
      token: localStorage.getItem('token'),
      refreshToken: localStorage.getItem('refreshToken'),
      expiresAt: localStorage.getItem('expiresAt'),
      rememberMe: localStorage.getItem('rememberMe') === 'true',
    };
  }
};

/**
 * リクエストインターセプター: 認証トークンを追加
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * レスポンスインターセプター: エラーハンドリングとトークン更新
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 標準APIレスポンス構造に変換
    return response.data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    
    // 認証エラー（401）かつリトライしていない場合で、更新トークンが存在する場合
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem('refreshToken')
    ) {
      originalRequest._retry = true;
      
      try {
        // トークン更新APIを呼び出し
        const refreshToken = localStorage.getItem('refreshToken');
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        
        const response = await axios.post<ApiResponse<{ token: string; refreshToken: string; expiresAt: string }>>(
          `${API_BASE_URL}${API_PATHS.AUTH.REFRESH}`,
          { refreshToken, rememberMe }
        );
        
        if (response.data.success && response.data.data) {
          const { token, refreshToken, expiresAt } = response.data.data;
          
          // 新しいトークンを保存
          authStorage.saveTokens(token, refreshToken, expiresAt, rememberMe);
          
          // 元のリクエストに新しいトークンを設定して再試行
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // リフレッシュトークンが無効な場合は認証情報をクリア
        authStorage.clearTokens();
        
        // ログインページへリダイレクト
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    // API形式のエラーレスポンスの場合
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }
    
    // その他のエラー
    return Promise.reject({
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'ネットワークエラーが発生しました',
        details: error.message,
      },
    });
  }
);

/**
 * API呼び出しラッパー
 */
export const api = {
  /**
   * GET リクエスト
   */
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return apiClient.get(url, config);
  },
  
  /**
   * POST リクエスト
   */
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return apiClient.post(url, data, config);
  },
  
  /**
   * PUT リクエスト
   */
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return apiClient.put(url, data, config);
  },
  
  /**
   * DELETE リクエスト
   */
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return apiClient.delete(url, config);
  },
};

export default api;