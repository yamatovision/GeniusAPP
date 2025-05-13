# ポータル認証エラー修正

## 問題概要

ポータル側のログイン処理において、存在しないモジュール`'../models/simpleApiKey.model'`を参照していたためにエラーが発生していました。

```
AuthContext.js:111 
POST http://localhost:3000/api/simple/auth/login 500 (Internal Server Error)

Login.js:136 ログインエラー: 
AxiosError {message: 'Request failed with status code 500', name: 'AxiosError', code: 'ERR_BAD_RESPONSE', config: {…}, request: XMLHttpRequest, …}

Login.js:168 認証エラー詳細: 
{success: false, message: 'ログイン処理中にエラーが発生しました', error: "Cannot find module '../models/simpleApiKey.model'\n…ktop/システム開発/AppGenius2/AppGenius/portal/server.js"}
```

## 調査結果

1. simpleUser.controller.jsでは、存在しないSimpleApiKeyモデルを参照していました。
2. VSCode側とポータル側のログイン処理は異なります：
   - VSCode側（SimpleAuthService.ts）: APIキー取得に重点を置いている（ClaudeCode起動のため）
   - ポータル側（simpleAuth.service.js）: 基本的な認証に重点を置いている

3. ポータル側では、APIキーに関する詳細な処理は必要なく、単純に認証状態を管理するだけで十分です。

## 修正内容

simpleUser.controller.jsの`getUserProfile`関数を修正しました：

```javascript
// 修正前:
// APIキー情報を取得（必要に応じて）
let apiKey = null;
if (user.apiKeyId) {
  apiKey = await SimpleApiKey.findOne({ id: user.apiKeyId });
}

// APIキー情報を準備
let apiKeyInfo = null;

// 新方式：ユーザーに直接保存されているAPIキー値を優先
if (user.apiKeyValue) {
  apiKeyInfo = {
    id: user.apiKeyId || 'direct_key',
    key: user.apiKeyValue,  // 直接保存されているAPIキー値も含める
    status: 'active'
  };
} 
// 旧方式：APIキーテーブルからの情報
else if (apiKey) {
  apiKeyInfo = {
    id: apiKey.id,
    key: apiKey.keyValue,  // APIキー値も含める
    status: apiKey.status
  };
  
  // 見つかったAPIキー値をユーザーモデルにも保存（移行処理）
  if (apiKey.keyValue) {
    user.apiKeyValue = apiKey.keyValue;
    await user.save();
    console.log(`ユーザープロフィール取得中にユーザー ${user.name} (${user._id}) のAPIキー値をユーザーモデルに保存しました`);
  }
}

// 修正後:
// Portal側では基本的にAPIキー情報は不要
// 必要に応じてユーザー自身のAPIキー情報のみ返す
let apiKeyInfo = null;

// ユーザーに直接保存されているAPIキー値があれば、それを使用
if (user.apiKeyValue) {
  apiKeyInfo = {
    id: user.apiKeyId || 'direct_key',
    key: user.apiKeyValue,  // 直接保存されているAPIキー値
    status: 'active'
  };
}
```

## 検証方法

1. Portalアプリケーションにログインして、エラーが発生しないことを確認
2. ダッシュボード画面が正常に表示されることを確認

## 注意点

1. この修正は、VSCode側のSimpleAuthService.tsには影響しません。VSCode側では引き続きAPIキーの詳細な取得処理が行われます。
2. ポータル側でもAPIキー値をユーザー情報とともに取得する場合は、別途AnthropicApiKeyモデルを参照するよう変更が必要です。

---

## VSCodeとポータルの認証処理の違い

### VSCode側（SimpleAuthService.ts）
- 認証だけでなく、APIキーの取得と保存に重点を置いている
- ClaudeCodeを起動するために、様々な方法でAPIキーを取得しようとする
- AnthropicApiKeyモデルからAPIキーを取得する専用のエンドポイントを使用
- 認証情報を安全に保存するためのSecureStorageを使用

### ポータル側（simpleAuth.service.js）
- 主に認証とトークン管理に注力している
- APIキー取得に特化した処理はあまりない
- ローカルストレージを使用して認証情報を保存
- シンプルなログイン・ログアウト処理に集中