/**
 * API設定 - フロントエンド用
 */

// 新しいバックエンドURL
export const API_URL = process.env.REACT_APP_API_URL || 'https://bluelamp-235426778039.asia-northeast1.run.app/api';

// API URLの取得
export function getApiUrl(endpoint = '') {
  return API_URL + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
}