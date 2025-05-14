/**
 * API設定ファイル - バックエンドURL参照の一元管理
 */
export const API_CONFIG = {
  // バックエンドURL
  API_URL: process.env.BLUELAMP_API_URL || 'https://bluelamp-235426778039.asia-northeast1.run.app/api',
  
  // ヘルパー関数: APIエンドポイントを取得
  getApiUrl: function(endpoint: string = ''): string {
    return this.API_URL + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
  }
};