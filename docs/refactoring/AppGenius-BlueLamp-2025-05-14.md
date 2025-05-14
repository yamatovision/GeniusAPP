# リファクタリング計画: AppGenius → ブルーランプ名称変更 2025-05-14

## 1. 現状分析

### 1.1 対象概要
現在、VSCode拡張機能は「AppGenius AI」という名称で実装されており、内部コードとVSCode Marketplaceでの表示名が一致しています。この拡張機能を「ブルーランプ」としてVSCode Marketplaceに登録するための変更計画です。

### 1.2 問題点と課題
- 現在「AppGenius AI」の名称がUI表示やコード内に多数存在している
- VSCode Marketplaceでの登録名と内部実装名のミスマッチが発生する可能性がある
- ユーザー体験の一貫性を維持しながら外部向け名称を変更する必要がある

### 1.3 関連ファイル一覧
- `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/package.json`
- `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/media/noProjectView/noProjectView.html`
- `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/ui/scopeManager/ScopeManagerPanel.ts`
- `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/ui/scopeManager/templates/ScopeManagerTemplate.ts`
- `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/deployment/deploy.md`

## 2. リファクタリングの目標

### 2.1 期待される成果
- VSCode Marketplaceでの表示名が「ブルーランプ」に変更される
- ユーザーに表示されるUI要素が一貫して「ブルーランプ」を表示する
- 内部コードの互換性を維持し、最小限の変更で名称変更を実現する

### 2.2 維持すべき機能
- 既存の全機能の正常動作
- ユーザー設定や拡張機能構成の互換性
- 既存のコマンドIDと内部参照構造（最小限の変更）

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
基本的に現在のアーキテクチャを維持し、表面的なUI表示と公開用メタデータのみを変更します。

### 3.2 核心的な改善ポイント
- package.jsonの`name`と`displayName`を変更し、VSCode Marketplaceでの表示名を更新
- ユーザーに表示されるUI要素（タブ名、ウェルカムメッセージなど）を「ブルーランプ」に統一
- 内部コマンドIDや設定名は後方互換性のために現状維持

### 3.3 新しいディレクトリ構造
ディレクトリ構造に変更はありません。

## 4. 実装計画

### フェーズ1: package.jsonの更新
- **目標**: VSCode Marketplaceへの公開用メタデータを更新
- **影響範囲**: package.json
- **タスク**:
  1. **T1.1**: package.jsonの`displayName`を変更
     - 対象: `/package.json`
     - 実装: `"displayName": "AppGenius AI"` → `"displayName": "ブルーランプ"`
  2. **T1.2**: [オプション] package.jsonの`name`を変更
     - 対象: `/package.json`
     - 実装: `"name": "appgenius-ai"` → `"name": "bluelamp"`
     - 注意: 後方互換性のため、この変更はマーケットプレイス公開直前のみに行う
- **検証ポイント**:
  - VSCodeでの拡張機能のローカルインストール
  - 拡張機能の基本機能が正常に動作することの確認

### フェーズ2: UIテキストの変更
- **目標**: ユーザーに表示される「AppGenius」の表記を「ブルーランプ」に変更
- **影響範囲**: HTML/TSファイル内のテキスト
- **タスク**:
  1. **T2.1**: ウェルカムメッセージの更新
     - 対象: `/media/noProjectView/noProjectView.html:88`
     - 実装: `AppGenius AI` → `ブルーランプ`
  2. **T2.2**: スコープマネージャーパネルのタイトル変更
     - 対象: `/src/ui/scopeManager/ScopeManagerPanel.ts:153`
     - 実装: `'AppGenius スコープマネージャー'` → `'ブルーランプ スコープマネージャー'`
  3. **T2.3**: スコープマネージャーテンプレートのタイトル変更
     - 対象: `/src/ui/scopeManager/templates/ScopeManagerTemplate.ts:74`
     - 実装: `<title>AppGenius スコープマネージャー</title>` → `<title>ブルーランプ スコープマネージャー</title>`
- **検証ポイント**:
  - UIに表示されるテキストが一貫して「ブルーランプ」になっていることの確認
  - 変更したパネルやビューが正常に表示・機能することの確認

### フェーズ3: デプロイ文書の更新
- **目標**: VSCode Marketplaceへの公開手順の更新
- **影響範囲**: ドキュメント
- **タスク**:
  1. **T3.1**: デプロイドキュメントの更新
     - 対象: `/docs/deployment/deploy.md`
     - 実装: Marketplaceへの公開手順の該当部分を更新
     ```
     ... 略 ...
     "name": "bluelamp",              // 一意の識別子
     "displayName": "ブルーランプ",     // マーケットプレイスでの表示名
     ... 略 ...
     ```
     ```
     vsce publish -p <your-personal-access-token>
     ```
- **検証ポイント**:
  - ドキュメントが正確に更新されていることの確認

## 5. 期待される効果

### 5.1 コード削減
コード削減は最小限で、変更はテキスト文字列の置換のみを行います。

### 5.2 保守性向上
- VSCode Marketplaceに登録されている名称とUI表示の一貫性が確保される
- 将来的な名称変更の手順が明確になる

### 5.3 拡張性改善
- ブランド名変更に対応しやすい実装構造の確立

## 6. リスクと対策

### 6.1 潜在的リスク
- 拡張機能IDの変更によるユーザー設定互換性の問題
- 内部コマンドIDに依存した機能の互換性問題
- 名称変更の不整合によるユーザー混乱

### 6.2 対策
- 拡張機能の内部ID（package.jsonの`name`）は公開直前のみ変更し、それまでは開発中は現状維持する
- コマンドIDや設定キーは変更せず、表示名のみを変更して互換性を確保する
- リリースノートで名称変更について明確に説明する

## 7. 備考
- この変更は主に表面的なUI要素の変更であり、内部実装の変更は最小限に抑える
- VSCode拡張機能のパブリッシャーID（`mikoto`）は維持する
- マーケットプレイスへの公開前に最終的な名称とURL確認を行う