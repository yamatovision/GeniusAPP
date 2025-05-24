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
  try {
    // simpleUser方式でトークンを取得
    const user = JSON.parse(localStorage.getItem('simpleUser') || '{}');
    const token = user.accessToken;
    
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  } catch (error) {
    console.error('authHeader: ヘッダー生成エラー', error);
    return includeContentType ? { 'Content-Type': 'application/json' } : {};
  }
}