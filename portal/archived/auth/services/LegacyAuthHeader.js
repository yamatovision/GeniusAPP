/**
 * 認証ヘッダーを生成するユーティリティ
 * APIリクエスト時の認証ヘッダーを一元管理します
 */

/**
 * 認証ヘッダーを取得
 * @param {boolean} includeContentType - ContentTypeヘッダーを含めるか
 * @returns {Object} 認証情報を含むヘッダーオブジェクト
 */
export default function authHeader(includeContentType = true) {
  const token = localStorage.getItem('accessToken');
  
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  
  return headers;
}