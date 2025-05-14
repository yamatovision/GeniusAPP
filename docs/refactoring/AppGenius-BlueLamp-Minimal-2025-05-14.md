# 最小変更による名称変更計画: AppGenius → ブルーランプ 2025-05-14

## 変更概要

VSCode Marketplaceへの公開時に「ブルーランプ」という名称で公開するために、最小限の変更を行う計画です。
内部コードの互換性を最大限維持しながら、ユーザーに表示される名称のみを変更します。

## 変更対象

### 1. package.jsonの変更（公開時のみ）

```json
// package.json （変更箇所のみ抜粋）
{
  "name": "appgenius-ai", // オプション: 変更が必要な場合のみ "bluelamp" に変更
  "displayName": "ブルーランプ", // "AppGenius AI" から変更
  // 他は変更なし
}
```

### 2. ユーザーインターフェース変更（最小限）

#### 2.1 スコープマネージャーパネルのタイトル変更

```typescript
// src/ui/scopeManager/ScopeManagerPanel.ts:153 付近
const panel = vscode.window.createWebviewPanel(
  ScopeManagerPanel.viewType,
  'ブルーランプ', // 'AppGenius スコープマネージャー' から変更
  column || vscode.ViewColumn.One,
  webviewOptions
);
```

#### 2.2 ウェルカムメッセージの変更（オプション）

```html
<!-- media/noProjectView/noProjectView.html:88 付近 -->
<p class="no-project-text">
  ブルーランプを使うには、プロジェクトを選択するか新しいプロジェクトを作成してください。
  プロジェクトを選択すると、開発状況の管理や各種AIプロンプトを利用できるようになります。
</p>
```

#### 2.3 スコープマネージャーテンプレートのタイトル変更（オプション）

```html
<!-- src/ui/scopeManager/templates/ScopeManagerTemplate.ts:74 付近 -->
<title>ブルーランプ</title>
```

## 実装手順

1. パッケージング直前のみpackage.jsonの`displayName`を「ブルーランプ」に変更
2. スコープマネージャーパネルのタイトルを「ブルーランプ」に変更
3. （オプション）その他のUI表示テキストを変更

## 注意点

- 内部コードのコマンドID、設定名、ファイル名などは変更せず、互換性を維持
- 開発中は内部名称（appgenius-ai）を変更せず、公開時のみ表示名を変更
- テスト時に表示が適切に変更されていることを確認

## 検証方法

1. package.jsonを変更してVSCodeに開発版としてインストール
2. 拡張機能ペインで表示名が「ブルーランプ」になっていることを確認
3. スコープマネージャーを開いて、タイトルが「ブルーランプ」になっていることを確認
4. 他の機能が正常に動作することを確認

この最小限の変更により、内部互換性を維持しながらVSCode Marketplaceでの表示名を「ブルーランプ」に変更できます。