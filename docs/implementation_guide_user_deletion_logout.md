# ユーザー削除時の強制ログアウト機能実装ガイド

## 概要

ユーザーがダッシュボードから削除された際に、そのユーザーのアクティブなAppGeniusスコープマネージャーセッションを強制的にログアウトさせる機能を実装します。この機能により、削除されたユーザーがスコープマネージャーを継続して使用できなくなります。

## 現状の問題

現在、ユーザーがポータルのダッシュボードから削除されても、そのユーザーが既にログインしているスコープマネージャーセッションは影響を受けず、セッションが維持されたままになっています。これはセキュリティリスクであり、アクセス権限管理の観点から改善が必要です。

## 実装アプローチ

以下の２つのアプローチが考えられます：

### 1. 定期的な認証検証の改善（推奨アプローチ）

現在のシステムでは、`AuthenticationHandler`が1分ごとに認証状態をチェックする機能がすでに実装されています。この仕組みを利用して、認証チェック時にユーザーが削除されたことを検出する機能を追加します。

**メリット：**
- 既存の仕組みを活用するため、実装が比較的シンプル
- 追加のインフラやプロトコルが不要
- ユーザー削除から最大1分以内にログアウトが発生

### 2. リアルタイム通知システム

WebSocketなどを使用して、ユーザー削除時にリアルタイムで通知を送信する仕組みを構築します。

**デメリット：**
- 実装が複雑
- インフラの追加が必要
- パフォーマンスに影響を与える可能性がある

## 実装手順（推奨アプローチ）

### 1. バックエンド側の修正

`simpleUser.controller.js`の`deleteUser`メソッドを修正し、ユーザーが削除された際のレスポンスに明確な識別子を含めます。

```javascript
// portal/backend/controllers/simpleUser.controller.js

exports.deleteUser = async (req, res) => {
  try {
    // 既存のコード...
    
    // ユーザーを無効化
    targetUser.status = 'disabled';
    targetUser.refreshToken = null;
    // 削除フラグを追加
    targetUser.deleted = true;
    targetUser.deletedAt = new Date();
    await targetUser.save();
    
    return res.status(200).json({
      success: true,
      message: 'ユーザーが正常に削除されました',
      userStatus: 'deleted' // この識別子を追加
    });
  } catch (error) {
    // エラーハンドリング...
  }
};
```

### 2. フロントエンド側の修正

認証チェックエンドポイント(`/simple/auth/check`)のレスポンスハンドリングを修正し、ユーザーのステータスが`disabled`または`deleted`の場合に特殊なエラーコードを返すようにします。

```javascript
// portal/backend/controllers/simpleAuth.controller.js

exports.checkAuth = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await SimpleUser.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        errorCode: 'USER_NOT_FOUND'
      });
    }
    
    // ユーザーが無効化または削除された場合
    if (user.status === 'disabled' || user.deleted === true) {
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化または削除されました',
        errorCode: 'ACCOUNT_DELETED'
      });
    }
    
    // 正常なレスポンス...
  } catch (error) {
    // エラーハンドリング...
  }
};
```

### 3. スコープマネージャーでの処理

VSCode拡張機能側で認証チェック時のエラーコードをハンドリングし、`ACCOUNT_DELETED`の場合は特別な通知でログアウトします。

```typescript
// src/core/auth/SimpleAuthService.ts

private async _verifyTokenWithServer(): Promise<boolean> {
  try {
    // 既存のコード...
    
    if (response.data && response.data.success) {
      Logger.info('SimpleAuthService: サーバー検証成功');
      return true;
    }
    
    Logger.info('SimpleAuthService: サーバー検証失敗', response.data);
    return false;
  } catch (error: any) {
    // エラーレスポンスが特定のエラーコードを持つか確認
    if (error?.response?.data?.errorCode === 'ACCOUNT_DELETED') {
      Logger.warn('SimpleAuthService: ユーザーアカウントが削除されました');
      
      // 専用のログアウト通知を表示
      const LogoutNotification = (await import('../../ui/auth/LogoutNotification')).LogoutNotification;
      LogoutNotification.getInstance().showLogoutNotification('ACCOUNT_DELETED');
      
      // トークンをクリアしてログアウト
      await this._clearTokens();
      this._updateAuthState(AuthStateBuilder.guest().build());
      this._onLogout.fire();
      
      return false;
    }
    
    // その他のエラーハンドリング...
  }
}
```

### 4. ログアウト通知の改善

`LogoutNotification`クラスに削除されたユーザー専用の通知タイプを追加します：

```typescript
// src/ui/auth/LogoutNotification.ts

export class LogoutNotification {
  // シングルトンパターン実装...
  
  /**
   * ログアウト通知を表示
   * @param reason ログアウト理由
   */
  public showLogoutNotification(reason: 'EXPIRED' | 'TIMEOUT' | 'ACCOUNT_DELETED' | 'MANUAL' = 'MANUAL'): void {
    try {
      let message = 'ログアウトしました';
      let detail = '';
      
      switch (reason) {
        case 'EXPIRED':
          message = 'セッションの有効期限が切れました';
          detail = '再度ログインしてください。';
          break;
        case 'TIMEOUT':
          message = 'サーバー接続がタイムアウトしました';
          detail = 'ネットワーク接続を確認し、再度ログインしてください。';
          break;
        case 'ACCOUNT_DELETED':
          message = 'アカウントが削除されました';
          detail = 'このアカウントは管理者によって削除されました。別のアカウントでログインするか、管理者に連絡してください。';
          break;
        case 'MANUAL':
        default:
          message = 'ログアウトしました';
          detail = '再度ログインするには認証してください。';
          break;
      }
      
      // 通知表示...
    } catch (error) {
      // エラーハンドリング...
    }
  }
}
```

## テスト手順

1. テスト用のユーザーを作成し、スコープマネージャーにログインします
2. ダッシュボードでそのユーザーを削除します
3. スコープマネージャーが1分以内に自動的にログアウトし、「アカウントが削除されました」という通知が表示されることを確認します

## 補足: 即時反映のための改善案

待ち時間を短縮するために、認証チェックの間隔を短くすることも可能です。

```typescript
// src/ui/scopeManager/services/AuthenticationHandler.ts

public setupTokenExpirationMonitor(onExpired: () => void, onPermissionLost: () => void): vscode.Disposable {
  try {
    // チェック間隔を30秒に短縮（1分から変更）
    const interval = setInterval(() => {
      try {
        // ログイン状態をチェック...
      } catch (checkError) {
        // エラーハンドリング...
      }
    }, 30000); // 30秒ごとにチェック
    
    // 他のコード...
  } catch (error) {
    // エラーハンドリング...
  }
}
```

また、ユーザー削除後に追加のAPIコールを行って、アクティブなセッションに対して即時通知を送信することも検討できます。

## 実装上の注意点

1. エラーハンドリングを適切に行い、ネットワーク問題や一時的なサーバーエラーとユーザー削除を区別するようにしてください
2. ユーザーに対して、なぜログアウトされたのかを明確に伝える通知メッセージを表示してください
3. セキュリティ上の理由から、削除されたユーザーが再ログインを試みた際にも専用のエラーメッセージを表示するようにしてください

この実装により、ユーザーアカウント管理の一貫性が向上し、不要なセッションが迅速に終了されるようになります。