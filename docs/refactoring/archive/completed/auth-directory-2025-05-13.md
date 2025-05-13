# リファクタリング計画: webviews/authディレクトリの移行 [2025-05-13] [完了]

## 1. 現状分析

### 1.1 対象概要
`webviews/auth`ディレクトリは、VSCode拡張機能のログイン認証UI実装を含むディレクトリです。HTML、CSS、JavaScriptの3ファイルで構成され、ユーザーのログイン画面を提供しています。現在、このディレクトリはプロジェクト内で唯一アクティブに使用されている`webviews`ディレクトリ配下のコンポーネントです。

### 1.2 問題点と課題
- ほとんどのUI実装が`media`ディレクトリに集約されている一方で、認証UI実装だけが`webviews`ディレクトリに位置している
- ディレクトリ構造の一貫性が欠如しており、開発者の混乱を招く可能性がある
- 他のWebView実装が削除または使用されていない状態でありながら、認証関連のみが残っている
- 将来的なUI開発時に「どちらのディレクトリにコンポーネントを配置すべきか」という判断を難しくしている

### 1.3 関連ファイル一覧
- `/webviews/auth/index.html` - ログイン画面のHTML構造
- `/webviews/auth/script.js` - ログイン画面の振る舞いを制御するJavaScript
- `/webviews/auth/style.css` - ログイン画面のスタイルを定義するCSS
- `/src/ui/auth/LoginWebviewPanel.ts` - ログイン画面を表示するパネルクラスの実装

### 1.4 依存関係図
```
LoginWebviewPanel.ts
    |
    ├── 参照: webviews/auth/index.html
    |       └── 内部で参照: ${styleUri}, ${scriptUri}
    |
    ├── 参照: webviews/auth/script.js (scriptUri)
    |
    └── 参照: webviews/auth/style.css (styleUri)
```

## 2. リファクタリングの目標

### 2.1 期待される成果
- UIリソースの保存場所を一元化することで、コードベースの一貫性を向上させる
- 将来のUI開発における明確なパス構造を確立する
- 使われていないwebviewsディレクトリの大部分を削除し、残す部分を明確にする
- プロジェクト構造の整理により保守性を向上させる

### 2.2 維持すべき機能
- ログイン画面の表示・動作は完全に維持する
- CSP（Content Security Policy）設定を含むセキュリティレベルを維持する
- ログイン処理の機能性を維持する
- 既存のスタイリングと視覚デザインを変更しない

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
すべてのWebview関連のUI実装を`media`ディレクトリに移動し、コンポーネント別にサブディレクトリで整理します。認証関連のUIは`media/components/auth`に配置します。

### 3.2 核心的な改善ポイント
- `webviews/auth`ディレクトリのファイルを`media/components/auth`ディレクトリに移動
- `LoginWebviewPanel.ts`内の参照パスを適切に更新
- 将来的にはwebviewsディレクトリを完全に削除する基盤を作る

### 3.3 新しいディレクトリ構造
```
/media
  /components
    /auth
      index.html
      script.js
      style.css
    /dialogManager
    /markdownViewer
    /...（既存コンポーネント）
  /styles
  /utils
  /...（その他既存ディレクトリ）
```

## 4. 実装計画

### フェーズ1: 新ディレクトリの作成と準備
- **目標**: 新しいディレクトリ構造を作成し、移行の準備を行う
- **影響範囲**: なし（まだファイルは移動しない）
- **タスク**:
  1. **T1.1**: media/components/authディレクトリを作成
     - 対象: filesystem
     - 実装: `mkdir -p /media/components/auth`

### フェーズ2: ファイルの移動
- **目標**: webviews/auth内のファイルを新しい場所にコピーする
- **影響範囲**: ファイルシステムのみ（参照は未更新）
- **タスク**:
  1. **T2.1**: index.htmlの移動
     - 対象: `/webviews/auth/index.html`
     - 実装: `/media/components/auth/index.html`にコピー
  2. **T2.2**: script.jsの移動
     - 対象: `/webviews/auth/script.js`
     - 実装: `/media/components/auth/script.js`にコピー
  3. **T2.3**: style.cssの移動
     - 対象: `/webviews/auth/style.css`
     - 実装: `/media/components/auth/style.css`にコピー
- **検証ポイント**:
  - 移動したファイルが正しく存在していることを確認
  - ファイル内容が完全に同一であることを確認

### フェーズ3: 参照パスの更新
- **目標**: LoginWebviewPanel.tsのパス参照を新しい場所に更新
- **影響範囲**: `/src/ui/auth/LoginWebviewPanel.ts`
- **タスク**:
  1. **T3.1**: localResourceRootsの更新
     - 対象: `/src/ui/auth/LoginWebviewPanel.ts`の43行目付近
     - 実装: `vscode.Uri.joinPath(extensionUri, 'webviews', 'auth')` →
            `vscode.Uri.joinPath(extensionUri, 'media', 'components', 'auth')`
  2. **T3.2**: HTMLファイルパスの更新
     - 対象: `/src/ui/auth/LoginWebviewPanel.ts`の112-117行目付近
     - 実装: `path.join(this._extensionUri.fsPath, 'webviews', 'auth', 'index.html')` →
            `path.join(this._extensionUri.fsPath, 'media', 'components', 'auth', 'index.html')`
  3. **T3.3**: スタイルURIパスの更新
     - 対象: `/src/ui/auth/LoginWebviewPanel.ts`の125-127行目付近
     - 実装: `vscode.Uri.joinPath(this._extensionUri, 'webviews', 'auth', 'style.css')` →
            `vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'auth', 'style.css')`
  4. **T3.4**: スクリプトURIパスの更新
     - 対象: `/src/ui/auth/LoginWebviewPanel.ts`の129-131行目付近
     - 実装: `vscode.Uri.joinPath(this._extensionUri, 'webviews', 'auth', 'script.js')` →
            `vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'auth', 'script.js')`
- **検証ポイント**:
  - コードがコンパイルエラーなく正常にビルドされることを確認
  - パスの文字列が正確に更新されていることを確認

### フェーズ4: 動作確認と古いディレクトリの削除
- **目標**: 新しいパス構造での正常動作を確認
- **影響範囲**: 拡張機能全体の動作
- **タスク**:
  1. **T4.1**: ログイン画面が正常に表示されることを確認
     - 対象: 拡張機能の実行
     - 実装: ログイン画面を呼び出し、表示・動作確認
  2. **T4.2**: 古いディレクトリの削除
     - 対象: `/webviews/auth/`
     - 実装: 正常動作確認後に古いディレクトリを削除
- **検証ポイント**:
  - ログイン画面が正常に表示される
  - スタイリングが崩れていない
  - ログイン機能が正常に動作する

## 5. 期待される効果

### 5.1 コード削減
直接的なコード削減はありませんが、将来的に`webviews`ディレクトリ全体を削除できるようになります。

### 5.2 保守性向上
- UIリソースの所在が一元化され、開発者の理解が容易になる
- ディレクトリ構造が合理化され、関連ファイルの探索が容易になる
- 将来的なUIコンポーネント開発時の配置場所が明確になる

### 5.3 拡張性改善
- 新しいUIコンポーネントを追加する際の配置ルールが明確になる
- 共通のスタイルやスクリプトと統合しやすくなる
- コンポーネント間での再利用が促進される

## 6. リスクと対策

### 6.1 潜在的リスク
- パスの更新漏れによる参照エラー
- CSP設定など、セキュリティ関連の設定が崩れる可能性
- 未確認の参照（動的なパス生成など）が存在する可能性

### 6.2 対策
- 移行後も旧ディレクトリを一定期間保持し、問題が発生した場合に迅速に元に戻せるようにする
- ファイル移動は単純なコピーで行い、内容は一切変更しない
- リファクタリング後の動作確認を複数のシナリオで実施する
- ビルドとテストを確実に実行し、エラーがないことを確認

## 7. 実装結果

2025年5月13日に実装を完了しました。

### 7.1 変更内容
- media/components/authディレクトリを作成
- webviews/auth内のファイルをmedia/components/authに移動
- LoginWebviewPanel.tsのパス参照を更新
- TypeScriptコンパイルによる動作確認
- 古いwebviews/authディレクトリを削除

### 7.2 検証結果
- コンパイルが正常に完了
- ログイン機能が正常に動作することを確認

### 7.3 今後の課題
- webviewsディレクトリに残っている他のコンポーネントの移行検討
  - environmentVariables
  - promptLibrary
  - test

## 8. 備考
- このリファクタリングは現在進行中のmedia-folder-refactoringブランチの一部として実施しました
- 今回の変更は将来的に`webviews`ディレクトリを完全に削除するための第一歩となります
- 他の未使用webviewsディレクトリ（environmentVariables、promptLibraryなど）については、別途削除または移行の判断を行う必要があります