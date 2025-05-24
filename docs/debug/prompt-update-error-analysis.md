# プロンプト更新エラー解析ドキュメント

## エラー概要
- **エラーコード**: 400 Bad Request
- **エラーメッセージ**: `プロンプト内容は10000文字以内で指定してください`
- **発生箇所**: PUT `/prompts/67e34f27e4b15d4bee45e9fa`
- **報告日**: 2025/05/24

## 依存関係マップ

### フロントエンド
1. **エントリーポイント**: `portal/frontend/src/components/prompts/PromptForm.js`
   - プロンプト更新フォーム
   - バリデーション処理（文字数制限なし）
   
2. **API呼び出し**: `portal/frontend/src/services/prompt.service.js`
   - `updatePrompt`メソッド

### バックエンド
1. **ルーティング**: `portal/backend/routes/prompt.routes.js`
   - PUT `/prompts/:id`
   
2. **コントローラー**: `portal/backend/controllers/prompt.controller.js`
   - `updatePrompt`メソッド (235-294行目)
   
3. **モデル**: `portal/backend/models/prompt.model.js`
   - content: maxlength 30000文字

## 問題の特定

### 矛盾点
- **モデル定義**: 30,000文字制限
- **エラーメッセージ**: 10,000文字制限
- **フロントエンド**: 文字数制限なし

### 調査すべき箇所
1. データベースのスキーマ定義
2. ミドルウェアでの追加バリデーション
3. APIゲートウェイ/プロキシの設定
4. 環境別の設定差異

## 根本原因の特定

### 問題の原因
`portal/backend/app.js` の75行目で、Express.jsのJSON設定にサイズ制限が明示的に設定されていない：
```javascript
app.use(express.json());
```

これにより、Express.jsのデフォルトボディサイズ制限（100KB）が適用されている。

### なぜ10,000文字でエラーになるのか
- 日本語文字は通常3バイト（UTF-8）
- 10,000文字 × 3バイト = 約30KB
- JSONのオーバーヘッド（キー名、エスケープ等）を含めると100KBを超える

## 解決策

### 即座の修正
`portal/backend/app.js` の75-76行目を以下のように修正：
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

### 追加の改善案
1. フロントエンドに文字数カウンターを追加
2. クライアント側バリデーションの実装
3. エラーメッセージの改善