/**
 * ウェブストレージをデバッグするスクリプト
 * ブラウザのLocalStorageに保存されているアクセストークンを検証します
 * 
 * このスクリプトをブラウザのコンソールで実行してください
 */

// デバッグ情報ヘッダー
console.log('=== ウェブストレージデバッグ情報 ===');

// 従来の認証情報を表示
console.log('--- 従来の認証情報 ---');
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('ユーザー情報:', user);
console.log('ユーザーロール:', user.role);

// シンプル認証の情報を表示
console.log('--- シンプル認証情報 ---');
const simpleUser = JSON.parse(localStorage.getItem('simpleUser') || '{}');
console.log('シンプルユーザー情報:', simpleUser);
if (simpleUser.user) {
  console.log('シンプルユーザーロール:', simpleUser.user.role);
}

// シンプル認証のアクセストークンを取得
const simpleAccessToken = simpleUser.accessToken;

// シンプルトークンの分析
if (!simpleAccessToken) {
  console.error('シンプルアクセストークンが見つかりません。シンプルログインしてください。');
} else {
  console.log('シンプルアクセストークン:', simpleAccessToken.substring(0, 20) + '...');
  
  // トークンの内容を表示
  try {
    // JWTはヘッダー.ペイロード.署名の形式
    const parts = simpleAccessToken.split('.');
    if (parts.length !== 3) {
      console.error('シンプルトークンの形式が不正です');
    } else {
      // Base64デコード
      const payload = JSON.parse(atob(parts[1]));
      console.log('シンプルトークンの内容:');
      console.log(payload);
      
      // トークン発行元と対象
      console.log(`発行元(iss): ${payload.iss || 'なし'}`);
      console.log(`対象(aud): ${payload.aud || 'なし'}`);
      
      // トークン検証の問題を確認
      if (payload.iss !== 'appgenius-simple-auth' || payload.aud !== 'appgenius-simple-users') {
        console.error('トークンの発行元または対象が最新の設定と一致しません');
        console.log('古いトークンが使用されています。クリアして再ログインしてください。');
      }
      
      // ロール情報の確認
      if (payload.role) {
        console.log(`シンプルトークン内のユーザーロール: ${payload.role}`);
      } else {
        console.error('シンプルトークンにロール情報がありません');
      }
      
      // 有効期限の確認
      if (payload.exp) {
        const expiry = new Date(payload.exp * 1000);
        const now = new Date();
        console.log(`有効期限: ${expiry.toLocaleString()}`);
        if (expiry < now) {
          console.error('トークンの有効期限が切れています');
        } else {
          console.log(`有効期限まであと ${Math.floor((expiry - now) / 1000 / 60)} 分`);
        }
      }
    }
  } catch (e) {
    console.error('シンプルトークンのデコードに失敗しました:', e);
  }
}

// 従来の認証トークンを強制的に削除するためのヘルパー関数
function clearAuthTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  console.log('従来の認証トークンを削除しました。ページをリロードしてください。');
}

// シンプル認証トークンを強制的に削除するためのヘルパー関数
function clearSimpleAuthTokens() {
  localStorage.removeItem('simpleUser');
  sessionStorage.removeItem('simpleUser');
  console.log('シンプル認証トークンを削除しました。');
  console.log('ページをリロードして再ログインしてください...');
  setTimeout(() => {
    window.location.href = '/simple/login';
  }, 1500);
}

// 両方のトークンをクリアするためのヘルパー関数
function clearAllTokens() {
  clearAuthTokens();
  clearSimpleAuthTokens();
}

console.log('=== 利用可能なコマンド ===');
console.log('従来の認証トークンをクリア: clearAuthTokens()');
console.log('シンプル認証トークンをクリア: clearSimpleAuthTokens()');
console.log('すべての認証トークンをクリア: clearAllTokens()');
