/**
 * 認証トークン検証スクリプト
 * 
 * このスクリプトはローカルストレージからJWTトークンを取得し、
 * デコードしてユーザーロールと発行者、対象者情報を確認します。
 * 両方の認証システム（従来型・シンプル型）に対応しています。
 */

// 通常の認証トークン検証
function checkUserRole() {
  console.log("=== 通常認証システム検証 ===");
  
  const token = localStorage.getItem('jwtToken') || localStorage.getItem('accessToken');
  if (!token) {
    console.log("通常の認証トークンが見つかりません");
    return null;
  }
  
  try {
    // JWTのペイロード部分（2番目の部分）を取得
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Base64をデコードしてJSONに変換
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const decoded = JSON.parse(jsonPayload);
    console.log("JWT トークン:", token.substring(0, 20) + "...");
    console.log("デコード結果:", decoded);
    console.log("ユーザーID:", decoded.id);
    console.log("ユーザーロール:", decoded.role);
    
    // 発行者と対象者の確認
    if (decoded.iss) console.log("発行者(iss):", decoded.iss);
    if (decoded.aud) console.log("対象者(aud):", decoded.aud);
    
    // ロールの検証
    if (decoded.role === 'super_admin') {
      console.log("✅ 検証成功: ユーザーは正しくスーパー管理者として認識されています");
    } else if (decoded.role === 'admin') {
      console.log("❌ 検証失敗: スーパー管理者が通常の管理者(admin)として認識されています");
      console.log("    - これは認証システムの問題である可能性があります");
      console.log("    - ユーザーのロールがDBで'super_admin'でもトークンでは'admin'になっています");
    } else {
      console.log(`❓ ユーザーのロールは ${decoded.role} です（スーパー管理者ではありません）`);
    }
    
    // 有効期限のチェック
    if (decoded.exp) {
      const expDate = new Date(decoded.exp * 1000);
      const now = new Date();
      const timeLeft = (expDate - now) / 1000 / 60; // 分単位
      
      console.log(`トークン有効期限: ${expDate.toLocaleString()}`);
      console.log(`残り有効時間: 約${Math.round(timeLeft)}分`);
    }
    
    return decoded;
  } catch (e) {
    console.error("トークンのデコードに失敗しました:", e);
    return null;
  }
}

// シンプル認証トークンの検証
function checkSimpleUserRole() {
  console.log("\n=== シンプル認証トークン検証 ===");
  
  try {
    // シンプル認証の情報を取得
    const simpleUser = JSON.parse(localStorage.getItem('simpleUser') || '{}');
    console.log('シンプルユーザー基本情報:', simpleUser.user ? {
      name: simpleUser.user.name,
      email: simpleUser.user.email,
      role: simpleUser.user.role,
      id: simpleUser.user.id
    } : 'なし');
    
    // トークンの有無を確認
    const token = simpleUser.accessToken;
    if (!token) {
      console.error('シンプル認証のアクセストークンが見つかりません');
      return null;
    }
    
    console.log('シンプル認証トークン:', token.substring(0, 20) + "...");
    
    // トークンの内容を解析
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('トークンの形式が不正です (JWT形式ではありません)');
      return null;
    }
    
    // Base64デコードしてペイロード部分を取得
    const payload = JSON.parse(atob(parts[1]));
    console.log('トークンの内容:', payload);
    
    // 重要なフィールドを個別に表示
    console.log(`ユーザーID: ${payload.id || 'なし'}`);
    console.log(`ユーザーロール: ${payload.role || 'なし'}`);
    console.log(`発行者(iss): ${payload.iss || 'なし'}`);
    console.log(`対象者(aud): ${payload.aud || 'なし'}`);
    
    // 期待値との比較
    const expectedIssuer = 'appgenius-simple-auth';
    const expectedAudience = 'appgenius-simple-users';
    
    if (payload.iss !== expectedIssuer) {
      console.error(`❌ 発行者が一致しません: 期待値=${expectedIssuer}, 実際値=${payload.iss}`);
    } else {
      console.log('✅ 発行者(iss)は正しい値です');
    }
    
    if (payload.aud !== expectedAudience) {
      console.error(`❌ 対象者が一致しません: 期待値=${expectedAudience}, 実際値=${payload.aud}`);
    } else {
      console.log('✅ 対象者(aud)は正しい値です');
    }
    
    // 有効期限の確認
    if (payload.exp) {
      const expTime = new Date(payload.exp * 1000);
      const now = new Date();
      const diffMinutes = Math.floor((expTime - now) / 1000 / 60);
      
      console.log(`有効期限: ${expTime.toLocaleString()}`);
      
      if (expTime < now) {
        console.error('❌ トークンの有効期限が切れています');
      } else if (diffMinutes < 60) {
        console.warn(`⚠️ トークンの有効期限まであと ${diffMinutes} 分です`);
      } else {
        console.log(`✅ トークンの有効期限まであと ${Math.floor(diffMinutes / 60)} 時間 ${diffMinutes % 60} 分です`);
      }
    } else {
      console.warn('⚠️ トークンに有効期限が設定されていません');
    }
    
    return payload;
  } catch (e) {
    console.error('トークン解析中にエラーが発生しました:', e);
    return null;
  }
}

// トークンを強制的にクリアする関数
function clearAuthTokens() {
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  console.log('通常の認証トークンをクリアしました');
}

// シンプルトークンをクリアする関数
function clearSimpleAuthTokens() {
  localStorage.removeItem('simpleUser');
  sessionStorage.removeItem('simpleUser');
  console.log('シンプル認証トークンをクリアしました');
  console.log('ページをリロードしてください...');
  setTimeout(() => {
    window.location.href = '/simple/login';
  }, 1500);
}

// すべてのトークンをクリアする関数
function clearAllTokens() {
  clearAuthTokens();
  clearSimpleAuthTokens();
}

// 実行
const normalAuth = checkUserRole();
const simpleAuth = checkSimpleUserRole();

// トークンが見つからない場合のメッセージ
if (!normalAuth && !simpleAuth) {
  console.warn('どちらの認証システムでもトークンが見つかりませんでした。ログインが必要です。');
}

console.log("\n=== 操作方法 ===");
console.log('通常の認証トークンをクリア: clearAuthTokens()');
console.log('シンプル認証トークンをクリア: clearSimpleAuthTokens()');
console.log('すべての認証トークンをクリア: clearAllTokens()');
console.log("\n検証完了!");