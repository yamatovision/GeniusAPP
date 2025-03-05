# モックアップギャラリー実装計画

## 概要

既存のモックアップエディター機能をより使いやすく拡張した「モックアップギャラリー」の実装計画です。非技術者でも直感的に操作でき、要件定義やディレクトリ構造から自動的にモックアップを生成・管理できるインターフェースを提供します。

## 主要機能

1. **要件定義/ディレクトリ構造からの自動モックアップ提案**
2. **複数モックアップの並列生成**
3. **シンプルなフィードバックと更新機能**
4. **モックアップ承認フロー**
5. **プロジェクトごとのモックアップ管理**

## 技術スタック

- **フロントエンド**: HTML, CSS, JavaScript (既存のWebViewシステム)
- **バックエンド**: TypeScript (VSCode拡張のAPIを利用)
- **AI連携**: Claude APIを利用したモックアップ生成とフィードバック処理

## ファイル変更計画

### 1. モックアップギャラリーパネル

**ファイル**: `src/ui/mockupGallery/MockupGalleryPanel.ts`

現状では基本的なモックアップ表示機能が実装されていますが、以下の拡張が必要です：

```typescript
// 追加すべき主要メソッド:

// 要件定義・ディレクトリ構造からページ一覧を取得
private async _extractPagesFromRequirements(): Promise<string[]>

// 複数モックアップの並列生成
private async _generateMultipleMockups(pages: string[]): Promise<void>

// モックアップの承認ステータス管理
private async _updateMockupStatus(mockupId: string, status: 'pending' | 'generating' | 'review' | 'approved'): Promise<void>

// モックアップキューの処理
private async _processQueue(): Promise<void>
```

### 2. モックアップストレージサービス

**ファイル**: `src/services/mockupStorageService.ts`

現在のサービスを拡張して以下の機能を追加します：

```typescript
// モックアップのステータス情報を追加
export interface Mockup {
  // 既存のプロパティ...
  status: 'pending' | 'generating' | 'review' | 'approved';
  feedback?: string[]; // フィードバック履歴
  implementationNotes?: string; // 実装メモ
}

// 新たに追加するメソッド:
public async updateMockupStatus(id: string, status: string): Promise<void>
public async addFeedback(id: string, feedback: string): Promise<void>
public async saveImplementationNotes(id: string, notes: string): Promise<void>
public async getQueueStatus(): Promise<{pending: number, generating: number, completed: number, total: number}>
```

### 3. メディアファイル

新たなUIに対応するCSSとJavaScriptファイルが必要です。

**ファイル**: `media/mockupGallery.css`
**ファイル**: `media/mockupGallery.js`

既存の`simpleMockupEditor.css`と`simpleMockupEditor.js`をベースに、新しいレイアウトとインタラクションを実装します。

### 4. AIサービス拡張

**ファイル**: `src/core/aiService.ts`

モックアップの一括生成用に拡張します：

```typescript
// 追加するメソッド:
public async generateMockupForPage(pageName: string, requirements: string): Promise<string>
public async updateMockupWithFeedback(html: string, feedback: string): Promise<string>
```

## 実装手順

### フェーズ1: 基本構造の実装

1. **プロジェクト構造の変更**
   - mockupGalleryフォルダにすでに移行済み
   - メディアファイル参照更新

2. **モックアップギャラリーUI実装**
   - HTML/CSSの実装（mockupGallery.html参照）
   - 3パネルレイアウト構築
   - ステータス表示機能の実装

### フェーズ2: 自動提案機能

1. **要件定義/ディレクトリ構造のパーサー実装**
   - requirements.mdからページ情報を抽出
   - structure.mdからページ構造を抽出
   - AIに適切なプロンプト生成

2. **AIとの連携強化**
   - ページ情報からモックアップ生成のプロンプト作成
   - フィードバックの効率的処理

### フェーズ3: 並列処理システム

1. **生成キュー管理**
   - ページリストからキュー作成
   - 同時実行制御 (2-3ページ同時生成)
   - 進捗表示システム

2. **ステータス管理**
   - モックアップのライフサイクル管理
   - 承認フローの実装

## コアロジック

### モックアップ生成フロー

```
requirements.md/structure.md読み込み
    ↓
ページリスト抽出
    ↓
一括生成リクエスト
    ↓
キューに追加
    ↓
並列処理（最大3同時）
    ↓
生成完了→レビュー状態へ
    ↓
フィードバック→更新
    ↓
承認→実装フェーズへ
```

### 実装のポイント

1. **効率的なAIプロンプト**
   - モックアップ生成はトークンを多く消費するため、効率的なプロンプト設計が重要
   - フィードバック時は差分更新を基本とし、完全な再生成を避ける

2. **状態管理**
   - すべてのモックアップの状態をメタデータで管理
   - モックアップディレクトリと同期を維持

3. **エラーハンドリング**
   - AI生成の失敗時に適切に再試行
   - ユーザーへのフィードバック提供

## 必要なシステムプロンプト変更

AIにモックアップを生成させるためのシステムプロンプトを更新し、効率的な生成と更新を可能にします。

```
あなたはウェブアプリケーションモックアップ作成の専門家です。
要件定義とページ名から、機能的で美しいHTMLモックアップを作成してください。

重要なポイント:
1. シンプルで見やすいデザインを心がける
2. 必要最小限のスタイリングを含める (インラインスタイル推奨)
3. 複雑なJavaScriptは避け、見た目のデモンストレーションを優先
4. レスポンシブデザインを考慮する
5. フィードバックが与えられた場合は部分的な修正を行い、全体を再生成しない

必要な情報:
- ページ名: モックアップを作成するページの名前
- 要件: この画面に必要な機能や要素

出力形式:
<モックアップHTML>
<!DOCTYPE html>
<html>
...
</html>
</モックアップHTML>
```

## UI/UXガイドライン

1. **シンプルさの優先**
   - 非技術者でも直感的に操作できるよう、複雑な操作を避ける
   - ビジュアル要素で状態や操作を表現

2. **待ち時間の活用**
   - 生成中も他のモックアップを確認・編集できるようにする
   - 進捗状況を常に視覚的に表示

3. **承認フローの明確化**
   - モックアップの状態が常に明確にわかるようにする
   - 「次に何をすべきか」がわかりやすいガイダンス

## 移行計画

既存のモックアップエディターからの移行を段階的に行います：

1. 新機能の実装とテスト
2. 既存データの互換性確保
3. UIの切り替え
4. ユーザーフィードバックと調整

## タイムライン見積り

- **基本構造の実装**: 2-3日
- **自動提案機能**: 2-3日
- **並列処理システム**: 3-4日
- **テストと調整**: 2-3日

合計: 約2週間

## 結論

この実装計画に従うことで、非技術者でも直感的に操作でき、要件からモックアップを素早く作成できる強力なツールを実現できます。複数ページの並行処理により、待ち時間のストレスを最小化し、効率的なモックアップ作成フローを提供します。