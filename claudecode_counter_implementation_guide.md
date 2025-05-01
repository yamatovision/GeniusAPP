# ClaudeCode起動回数カウンター実装ガイド

このガイドでは、ダッシュボードのユーザー一覧に「ClaudeCode起動回数」を追加するための実装手順を説明します。

## 1. データモデルの修正

### portal/backend/models/simpleUser.model.js

SimpleUserモデルに`claudeCodeLaunchCount`フィールドを追加します。

```javascript
// ===== 組織・APIキー情報 ===== セクション付近に追加
// クラウドCode起動回数カウンター
claudeCodeLaunchCount: {
  type: Number,
  default: 0
},
```

## 2. バックエンドAPIエンドポイントの実装

### portal/backend/controllers/simpleUser.controller.js

カウンターをインクリメントするコントローラー関数を追加します。

```javascript
/**
 * ClaudeCode起動カウンターをインクリメント
 * @route POST /api/simple/users/:id/increment-claude-code-launch
 */
exports.incrementClaudeCodeLaunchCount = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // ユーザー情報を取得
    const user = await SimpleUser.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // カウンターをインクリメント
    if (typeof user.claudeCodeLaunchCount !== 'number') {
      user.claudeCodeLaunchCount = 1;
    } else {
      user.claudeCodeLaunchCount++;
    }
    
    // 保存
    await user.save();
    
    return res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        claudeCodeLaunchCount: user.claudeCodeLaunchCount
      }
    });
  } catch (error) {
    console.error('ClaudeCode起動カウンター更新エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ClaudeCode起動カウンターの更新中にエラーが発生しました',
      error: error.message
    });
  }
};
```

### portal/backend/routes/simple.routes.js

ルーティング設定にAPIエンドポイントを追加します。

```javascript
// ClaudeCode起動カウンターをインクリメント
router.post(
  "/users/:id/increment-claude-code-launch",
  [simpleAuthMiddleware.verifyToken],
  simpleUserController.incrementClaudeCodeLaunchCount
);
```

## 3. フロントエンドAPIクライアント関数の実装

### portal/frontend/src/services/simple/simpleUser.service.js

APIを呼び出すクライアント関数を追加します。

```javascript
// ClaudeCode起動カウンターをインクリメント
export const incrementClaudeCodeLaunchCount = async (userId) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/users/${userId}/increment-claude-code-launch`, 
      {}, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};
```

## 4. ダッシュボード表示の修正

### portal/frontend/src/components/simple/SimpleDashboard.js

ユーザー一覧テーブルに新しいカラムを追加します。

```jsx
// テーブルヘッダーに追加 (404行目付近)
<TableHead>
  <TableRow>
    <TableCell>名前</TableCell>
    <TableCell>メールアドレス</TableCell>
    <TableCell>役割</TableCell>
    <TableCell>ClaudeCode起動回数</TableCell> {/* 新規追加 */}
    <TableCell>操作</TableCell>
  </TableRow>
</TableHead>

// テーブル行にもカラムを追加 (メールアドレスセルの次)
<TableCell>{userData.email}</TableCell>
<TableCell>{userData.claudeCodeLaunchCount || 0}</TableCell> {/* 新規追加 */}
<TableCell>{userData.role}</TableCell>
```

## 5. ClaudeCode起動イベントの実装

### src/services/ClaudeCodeLauncherService.ts

ClaudeCode起動時にイベントを発行するよう修正します（各起動メソッドに追加）。

```typescript
// launchClaudeCode関数を修正
public async launchClaudeCode(scope: ImplementationScope): Promise<boolean> {
  // 起動前にカウンターイベントを発行
  this.eventBus.emit(
    AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
    { scope },
    'ClaudeCodeLauncherService'
  );
  
  return this.coreLauncher.launchClaudeCode({ scope });
}

// 同様に他の起動メソッドにも追加
```

### src/services/AppGeniusEventBus.ts

必要に応じて新しいイベントタイプを追加します。

```typescript
export enum AppGeniusEventType {
  // 既存のイベント...
  
  // ClaudeCodeイベント
  CLAUDE_CODE_LAUNCH_COUNTED = 'claude-code-launch-counted' // 追加
}
```

### src/api/claudeCodeApiClient.ts

APIクライアントに関数を追加します。

```typescript
/**
 * ClaudeCode起動カウンターをインクリメント
 * @param userId ユーザーID
 */
public async incrementClaudeCodeLaunchCount(userId: string): Promise<any> {
  try {
    const url = `${this.apiBaseUrl}/simple/users/${userId}/increment-claude-code-launch`;
    const headers = this.getAuthHeaders();
    
    const response = await axios.post(url, {}, { headers });
    return response.data;
  } catch (error) {
    Logger.error('ClaudeCode起動カウンターAPI呼び出しエラー:', error);
    throw error;
  }
}
```

### src/extension.ts

イベントリスナーを追加します。

```typescript
// ClaudeCode起動カウントイベントを監視してバックエンドに通知
const claudeCodeLaunchCountListener = AppGeniusEventBus.getInstance().onEventType(
  AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
  async (event) => {
    try {
      // 現在ログイン中のユーザーIDを取得
      const authService = SimpleAuthService.getInstance();
      const userData = await authService.getCurrentUser();
      
      if (userData && userData.id) {
        // バックエンドAPIを呼び出してカウンターをインクリメント
        const claudeCodeApiClient = ClaudeCodeApiClient.getInstance();
        await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userData.id);
        Logger.info(`ClaudeCode起動カウンターが更新されました: ユーザーID ${userData.id}`);
      }
    } catch (error) {
      Logger.error('ClaudeCode起動カウンター更新エラー:', error);
    }
  }
);

// コンテキストに登録して適切に破棄できるようにする
context.subscriptions.push(claudeCodeLaunchCountListener);
```

## 6. テスト

実装後は以下のステップでテストを行います：

1. モデルに新しいフィールドを追加した後、データベースを確認
2. テストスクリプト `test_claudecode_counter.js` を実行してカウンターが正常に動作するか確認
3. ClaudeCodeを実際に起動し、カウンターが増加するか確認
4. ダッシュボード画面で新しいカラムが表示されることを確認

## 注意点

- モデルの変更後は既存のデータにも新しいフィールドが追加されますが、既定値は0になります
- 実装の一部はプロジェクトの実際の構造に合わせて調整が必要な場合があります
- イベントバスを使った方法は、ユーザーIDの取得が可能な場合に機能します