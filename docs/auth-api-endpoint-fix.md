# 認証APIエンドポイント修正ドキュメント

## 問題概要

AppGeniusの認証サービスにおいて、以下の2つの問題が確認されました：

1. **API接続先の不一致**:
   - 一部の認証処理が本番環境URLを使用する一方、別の処理がローカルホスト（`localhost:5000`または`localhost:3000`）を参照
   - これにより、認証フローが正常に完了せず、ユーザー体験に影響

2. **コマンド二重登録エラー**:
   - 起動時に `command 'appgenius.simpleAuth.showMenu' already exists` エラーが発生
   - `SimpleAuthManager`の初期化と`registerAuthCommands`の両方が同一コマンドを登録

## 修正内容

### 1. API接続先の統一化

以下のファイルのAPIベースURLを修正しました：

**`src/core/auth/new/AuthService.ts`**:
```diff
- private readonly API_BASE_URL = 'http://localhost:5000/api/simple';
+ // 常に本番環境URLを使用
+ private readonly API_BASE_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/simple';
```

**`src/api/claudeCodeApiClient.ts`**:
```diff
- // API URLを環境変数から取得、またはデフォルト値を使用
- this._baseUrl = process.env.PORTAL_API_URL || 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api';
+ // 常に本番環境URLを使用（環境変数よりも優先）
+ this._baseUrl = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api';
```

### 2. コマンド二重登録の修正

**`src/core/auth/authCommands.ts`**:
- SimpleAuthコマンドを含まない認証コマンド登録関数を追加：
```javascript
/**
 * registerAuthCommandsWithoutSimple - SimpleAuthコマンドを除く認証関連のコマンドを登録する関数
 * 
 * 二重登録問題を回避するため、SimpleAuth関連のコマンド登録をスキップするバージョン
 */
export function registerAuthCommandsWithoutSimple(context: vscode.ExtensionContext): void {
  // ... 既存コードと同様だが、registerSimpleAuthCommands(context)を呼び出さない ...
}
```

**`extension.ts`** (パッチファイル経由で修正):
```diff
- // 認証コマンドの登録
- registerAuthCommands(context);
- Logger.info('Auth commands registered successfully');
+ // 認証コマンドの登録（二重登録を防ぐバージョンを使用）
+ const { registerAuthCommandsWithoutSimple } = require('./core/auth/authCommands');
+ registerAuthCommandsWithoutSimple(context);
+ Logger.info('Auth commands registered successfully (without SimpleAuth commands)');
```

## 実装されたソリューション

### パッチファイル
拡張機能の再ビルドに必要なパッチファイル `api_auth_fix.patch.js` を作成しました。このファイルを実行すると、`extension.ts` に必要な変更が適用されます。

### 今後の開発向け推奨事項

1. **環境変数の標準化**:
   - 本番/開発環境切り替えに一貫した方法を使用
   - デフォルト値は常に本番環境を参照するよう設定

2. **コマンド登録の一元化**:
   - 認証関連コマンドの登録プロセスを単一の場所に統合
   - 重複登録を防ぐためのチェック機構を追加

3. **起動フローの最適化**:
   - 拡張機能起動時の初期化順序を明確に定義
   - 依存関係のある機能はその順序に従って初期化

これらの修正により、認証フローの安定性が向上し、ユーザー体験が改善されます。