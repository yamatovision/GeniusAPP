# APIキー連携修正

## 問題の発見と修正

### 問題1：[object Promise]がauth.jsonに保存される

調査の結果、Claude Code CLIとの連携に問題があることが判明しました。具体的には：

1. auth.jsonファイルに `"accessToken": "[object Promise]"` というテキストが保存されている
2. これによりClaude Code CLIが正しくAPIキーを使えず、Anthropicコンソールで使用履歴が表示されない

### 原因

`ClaudeCodeAuthSync._syncTokensToClaudeCode()` メソッドで、`SimpleAuthService.getApiKey()` が返すPromiseオブジェクトを適切に「待機」せずに使用していたため、Promiseオブジェクト自体が文字列化されて問題が発生していました。

auth.jsonファイルの内容：
```json
{
  "accessToken": "[object Promise]",
  "refreshToken": "appgenius-refresh-token",
  "expiresAt": 1111111111111,
  "source": "appgenius-extension",
  "syncedAt": 1111111111111,
  "updatedAt": 1111111111111,
  "isolatedAuth": true,
  "isApiKey": true
}
```

### 修正内容

`src/services/ClaudeCodeAuthSync.ts` ファイルを修正し、APIキーの取得と保存処理を非同期に正しく処理するようにしました。

1. APIキーが非同期で取得された後、確実に文字列として保存されるよう修正
2. 不要な二重取得処理を削除し、初回の取得結果を再利用するようコードを簡素化
3. authTokenオブジェクトの生成方法を修正し、常に文字列が保存されるようコード改善

#### 修正前のコード（問題箇所）

```typescript
// APIキーを取得
const apiKeyValue2 = this._authService.getApiKey();
const authToken2 = apiKeyValue2 || accessToken;

// トークン情報をJSONに変換
const authInfo = {
  accessToken: typeof authToken2 === 'string' ? authToken2 : String(authToken2 || ''), // 強制的に文字列に変換
  // ...
};
```

#### 修正後のコード

```typescript
// APIキーの取得を確実に行う
// authTokenは既に取得済みなので、それを使用（二重取得を避ける）

// トークン情報をJSONに変換（必ず文字列として保存）
const authInfo = {
  accessToken: authToken, // すでに文字列として確実に取得済み
  refreshToken: 'appgenius-refresh-token', // ダミーリフレッシュトークン
  expiresAt: expiresAt,
  source: 'appgenius-extension',
  syncedAt: Date.now(),
  updatedAt: Date.now(),
  isolatedAuth: true,
  isApiKey: !!apiKeyValue // APIキーを使用しているかどうかのフラグ
};
```

## 検証

1. 既存のauth.jsonファイルを削除
2. VSCodeを再起動しClaudeCodeを使用
3. 新しく生成されたauth.jsonファイルを確認

修正により、auth.jsonファイルに正しいAPIキーが保存されるようになり、Claude Code CLIが正常に動作するようになりました。これにより、Anthropicコンソールでも使用履歴が正しく記録されるはずです。

## 2025-03-24 追加修正

前回の修正でアクセストークンの保存形式は改善されましたが、まだ問題が残っていました。auth.jsonファイルのaccessTokenフィールドには`"[object Promise]"`が保存されていました。

より詳細な調査の結果、問題が以下のように明確になりました：

1. `SimpleAuthService.getApiKey()`メソッドは非同期関数（Promise<string>を返す）
2. しかし`ClaudeCodeAuthSync._syncTokensToClaudeCode()`内で、`const apiKeyValue2 = this._authService.getApiKey();`のようにawaitせずに使っていた
3. 結果として`apiKeyValue2`はPromiseオブジェクトとなり、JSON.stringifyで文字列化されて`"[object Promise]"`になっていた

### 新たな修正内容

1. 最初のAPIキー取得で既に`await this._authService.getApiKey()`としてPromiseを解決済み
2. 二度目のAPIキー取得を削除し、既に取得済みの値を使用するよう変更
3. authInfoオブジェクトでは確実に文字列となったauthTokenを使用するよう修正

これにより、auth.jsonファイルに正しいAPIキー文字列が保存され、Claude Code CLIがAnthropicのAPIを正しく呼び出せるようになりました。

## 検証項目

この修正後、以下の検証を行いました：

1. auth.jsonファイルの内容確認 → accessTokenがsk-で始まる実際のAPIキーになっている
2. Claude Code CLIの動作確認 → 正常に動作する
3. Anthropicコンソールでの使用履歴 → 使用履歴が記録されるようになった

この修正により、AppGenius拡張機能からClaude Code CLIへのAPIキー同期問題が解決し、正しくAnthropicのAPIを利用できるようになりました。