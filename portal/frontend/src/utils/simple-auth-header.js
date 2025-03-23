/**
 * シンプルモード用認証ヘッダーを生成するユーティリティ
 * APIリクエスト時の認証ヘッダーを一元管理します
 */

/**
 * シンプルモード用認証ヘッダーを取得
 * @param {boolean} includeContentType - ContentTypeヘッダーを含めるかどうか
 * @returns {Object} 認証情報を含むヘッダーオブジェクト
 */
export default function simpleAuthHeader(includeContentType = true) {
  // ローカルストレージからシンプルユーザー情報を取得
  try {
    const user = JSON.parse(localStorage.getItem('simpleUser') || '{}');
    const token = user.accessToken;
    
    const headers = {};
    
    // トークンがあれば認証ヘッダーを追加
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // コンテンツタイプを含める場合
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    // デバッグ用コメント
    console.debug('simpleAuthHeader: ヘッダー生成', { hasToken: !!token, headers });
    
    return headers;
  } catch (error) {
    console.error('simpleAuthHeader: ヘッダー生成エラー', error);
    
    // エラー時は最低限のヘッダーを返す
    const fallbackHeaders = includeContentType 
      ? { 'Content-Type': 'application/json' } 
      : {};
    
    return fallbackHeaders;
  }
}