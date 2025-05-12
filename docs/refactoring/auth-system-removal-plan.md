# 旧認証システム削除計画

## 概要

AppGeniusアプリケーションでは現在、2つの認証システムが並行して存在しています：

1. 旧認証システム（AuthenticationService）
2. 新認証システム（SimpleAuthService）

ログや動作分析から、実際に認証に使用されているのは「SimpleAuthService」の方であり、旧システムは初期化されるものの実際には機能していないことが確認されました。この計画書では、旧認証システムを安全に削除するための手順を記述します。

## 問題点

1. ユーザーインターフェース上の「未ログイン」表示とログ出力の認証状態に不一致がある
2. 2つの認証システムが並存することで、コードの複雑さが増加している
3. リソースが無駄に消費されている
4. 将来的なメンテナンスが複雑になる

## 影響範囲

旧認証システムに関連するコードは以下のファイルに存在します：

1. `/src/core/auth/AuthenticationService.ts` - 旧認証サービスのメインクラス
2. `/src/core/auth/TokenManager.ts` - 旧システムのトークン管理クラス
3. `/src/ui/auth/AuthStatusBar.ts` - ステータスバーの表示を管理するクラス（現在の問題の原因）
4. `/src/ui/auth/LogoutNotification.ts` - ログアウト通知を管理するクラス
5. `/src/core/auth/authCommands.ts` - 認証関連のコマンド
6. `/src/core/auth/PermissionManager.ts` - 権限管理
7. `/src/extension.ts` - 初期化部分
8. その他参照している複数のファイル

## 削除計画

### フェーズ1: 認証状態表示の修正（緊急対応）

現在、`AuthStatusBar.ts`が古い認証システムの状態を参照して「未ログイン」と表示している問題を修正します。

1. `AuthStatusBar.ts`を修正して、新しい認証システム（SimpleAuthService）の状態のみを参照するようにする

```typescript
// _updateAuthStatus メソッド内の条件式を修正
private _updateAuthStatus(): void {
  // SimpleAuthServiceのみを参照
  if (this._simpleAuthService && this._simpleAuthService.isAuthenticated()) {
    this._useSimpleAuth = true;
    this._updateStatusBarForSimpleAuth();
  } else {
    // 未ログイン状態
    this._updateStatusBarForLoggedOut();
  }
}
```

### フェーズ2: 参照関係の切り替え

1. 全ファイルをスキャンし、`AuthenticationService`の代わりに`SimpleAuthService`を使用するように変更
2. `PermissionManager`が`AuthenticationService`を参照している箇所を`SimpleAuthService`を使うように変更
3. `extension.ts`から旧認証システムの初期化コードを削除

### フェーズ3: 未使用コードの削除

1. `TokenManager.ts`を削除（使用されなくなったため）
2. `AuthenticationService.ts`を削除
3. バックアップ用に`backup/auth_legacy`ディレクトリを作成し、削除前のファイルを移動

### フェーズ4: インターフェース統一

1. `SimpleAuthService`の名前を`AuthService`に変更し、インターフェースを統一する
2. 参照しているすべてのファイルで、名前の変更を反映

### フェーズ5: テストと検証

1. ユニットテストの更新
2. E2Eテストで認証フローが正常に動作することを確認
3. すべての認証関連機能が期待通りに動作することを確認

## 実装戦略

### 1. AuthStatusBar.tsの修正

```typescript
// 現在：
if (this._simpleAuthService && this._simpleAuthService.isAuthenticated()) {
  this._useSimpleAuth = true;
  this._updateStatusBarForSimpleAuth();
} else if (this._authService.isAuthenticated()) {
  this._useSimpleAuth = false;
  this._updateStatusBarForLegacyAuth();
} else {
  this._updateStatusBarForLoggedOut();
}

// 変更後：
if (this._simpleAuthService && this._simpleAuthService.isAuthenticated()) {
  this._useSimpleAuth = true;
  this._updateStatusBarForSimpleAuth();
} else {
  this._updateStatusBarForLoggedOut();
}
```

### 2. 認証ステータス更新ロジックの修正

```typescript
// コンストラクタでの初期化
private constructor() {
  this._simpleAuthService = SimpleAuthService.getInstance(global.appgeniusContext);
  
  // 古い認証サービスの参照を削除
  // this._authService = AuthenticationService.getInstance();
  
  // ...他のコード
}

// イベントリスナーの削除
private _registerAuthEventListeners(): void {
  // レガシー認証サービスのイベントリスナーを削除
  // this._disposables.push(
  //   this._authService.onStateChanged(state => {
  //     // ...
  //   }),
  //   // ...他のリスナー
  // );
  
  // SimpleAuthServiceのリスナーのみ残す
  if (this._simpleAuthService) {
    // ...イベントリスナー
  }
}
```

## リスクと対策

1. **リスク**: 認証状態の取得がエラーになる可能性
   **対策**: 部分的に変更し、都度テストする

2. **リスク**: ユーザー体験の中断
   **対策**: メンテナンスモードを導入し、計画的に実施する

3. **リスク**: 予期しない依存関係
   **対策**: 削除前にすべての依存関係を特定し、慎重に進める

## タイムライン

1. フェーズ1（緊急対応）: 1日以内
2. フェーズ2: 2-3日
3. フェーズ3: 1-2日
4. フェーズ4: 2-3日
5. フェーズ5: 2-3日

合計: 約1-2週間

## 結論

この計画を実施することで、認証システムが統一され、コードの複雑さが軽減され、将来的なメンテナンスが容易になります。また、現在の「未ログイン」表示の問題も解決されます。

計画の実施にあたっては、慎重なテストと段階的なアプローチを取り、ユーザーエクスペリエンスへの影響を最小限に抑えることが重要です。