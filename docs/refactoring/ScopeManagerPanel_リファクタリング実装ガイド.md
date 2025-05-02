# ScopeManagerPanel リファクタリング実装ガイド

本ドキュメントでは、ScopeManagerPanelのリファクタリング実装の手順と注意点について説明します。

## 1. 実装の概要

ScopeManagerPanelのリファクタリングは以下の段階で進めています：

1. 基盤となるサービスクラスの作成
2. 状態管理の一元化（ViewModelパターンの導入）
3. 段階的なメソッド移行
4. インターフェース調整と非同期処理の改善
5. 最終クリーンアップ

## 2. ディレクトリ構造

リファクタリング後のコード構造は以下の通りです：

```
/ui/scopeManager/
  |- ScopeManagerPanel.ts        # 既存のパネルクラス（リファクタリング前）
  |- ScopeManagerPanel.new.ts    # 新しいパネルクラス
  |- ScopeManagerPanelProxy.ts   # 移行用プロキシクラス
  |- viewModel/
  |  |- ScopeManagerViewModel.ts # UI状態管理
  |  |- WebViewMessageHandler.ts # メッセージ処理
  |- services/
  |  |- ProjectService.ts        # プロジェクト管理
  |  |- FileSystemService.ts     # ファイル操作
  |  |- SharingService.ts        # 共有機能
  |  |- AuthenticationHandler.ts # 認証管理
  |- types/
  |  |- ScopeManagerTypes.ts     # 型定義
  |- utils/
     |- WebViewUtils.ts          # WebView共通機能
```

## 3. リファクタリングの段階的移行手順

### 3.1 環境変数による切り替え

リファクタリングの移行は、環境変数 `SCOPE_MANAGER_USE_NEW_IMPL` を使用して制御します。この環境変数を設定することで、既存の実装と新しい実装を切り替えることができます。

```
SCOPE_MANAGER_USE_NEW_IMPL=true  # 新しい実装を使用
SCOPE_MANAGER_USE_NEW_IMPL=false # 既存の実装を使用（デフォルト）
```

環境変数の設定は、提供されたテストスクリプトを使用して行うことができます：

```bash
# 新しい実装を使用
node test_script/scope_manager_refactoring_test.js --use-new

# 既存の実装を使用
node test_script/scope_manager_refactoring_test.js --use-old
```

### 3.2 移行手順

1. **ScopeManagerPanelProxyの統合**:
   - `extension.ts` で直接 `ScopeManagerPanel` をインポートしている箇所を `ScopeManagerPanelProxy` に変更します
   - 既存のAPI呼び出しはそのまま維持されます（プロキシが適切な実装に転送）

2. **機能の段階的テスト**:
   - 環境変数を切り替えて、最初は特定の機能（例：プロジェクト管理）のみテスト
   - 問題がなければ、徐々に他の機能もテスト

3. **完全移行**:
   - すべての機能が正常に動作することを確認後、環境変数をデフォルトで `true` に設定
   - 最終的に `ScopeManagerPanel.ts` を `ScopeManagerPanel.new.ts` で置き換え

### 3.3 テスト項目

リファクタリング中に以下の機能が正常に動作することを確認してください：

1. **プロジェクト機能**:
   - 新規プロジェクト作成
   - 既存プロジェクトの読み込み
   - プロジェクト切り替え
   - プロジェクト削除

2. **ファイル操作**:
   - CURRENT_STATUS.mdの表示
   - ディレクトリ構造の表示
   - ファイル変更の監視

3. **共有機能**:
   - テキスト共有
   - 画像共有
   - 共有履歴表示
   - コマンドコピー

4. **その他の機能**:
   - ClaudeCodeの起動
   - モックアップギャラリー表示

## 4. 注意点

### 4.1 既存の動作を維持する

- ScopeManagerPanelProxyは、既存のAPIと完全に互換性があります
- 新しい実装でも既存の機能がすべて動作することを確認してください

### 4.2 エラーハンドリング

- 新しい実装では、エラーハンドリングを統一しています
- エラーは常にViewModelで捕捉し、適切なイベントを発火させてください

### 4.3 状態管理

- ViewModel中心の状態管理を採用しています
- 各サービスから状態変更イベントを発火し、ViewModelで一元管理します

## 5. 将来の拡張

このリファクタリングにより、以下の拡張が容易になります：

1. **新機能の追加**:
   - 単一責任の原則に沿ったサービスに機能を追加
   - ViewModelに新しいメソッドを追加するだけで、UIとの連携が実現

2. **テスト容易性**:
   - 各サービスは独立してテスト可能
   - ViewModelも状態とイベントのテストが容易

3. **パフォーマンス最適化**:
   - 不要な状態更新の削減
   - より効率的なUI更新の実現

## 6. トラブルシューティング

### 6.1 環境変数が反映されない場合

以下のように環境変数を直接設定することもできます：

```javascript
// ScopeManagerPanelProxy.ts内で
ScopeManagerPanelProxy.setUseNewImplementation(true); // 新実装を使用
```

### 6.2 移行中の問題

移行中に問題が発生した場合は、以下のステップを試してください：

1. ログ出力で問題を特定
2. 必要に応じて既存の実装に戻す
3. 問題を修正して再度テスト

## 7. 完了基準

リファクタリングが完了したと判断するための基準：

1. すべての機能が正常に動作することを確認
2. コードの再利用性と保守性が向上していること
3. 新しい実装に関するテストがすべて成功すること
4. パフォーマンスが維持または向上していること

以上の条件を満たしたら、最終的に `ScopeManagerPanel.new.ts` を `ScopeManagerPanel.ts` にリネームし、既存のファイルを削除または `.bak` としてアーカイブしてください。

## 8. 実装状況と今後の計画

### 8.1 現在の実装状況 (2025年5月2日)

以下の作業が完了しています：

1. ✅ extension.tsの修正：ScopeManagerPanelの代わりにScopeManagerPanelProxyを使用するように変更
2. ✅ 環境変数を設定してテストスクリプトを実行（--use-old）：既存機能が正常に動作することを確認
3. ✅ 環境変数を設定してテストスクリプトを実行（--use-new）：新実装でも全機能が正常に動作することを確認
4. ✅ ScopeManagerPanel.new.tsをScopeManagerPanel.tsにリネームして完全移行
5. ✅ 不要になったバックアップファイルをarchiveディレクトリに移動

現在、ScopeManagerPanelProxyはシンプルなパススルー実装として動作しており、すべての機能は新しい実装に移行されています。

### 8.2 今後の課題と計画

ScopeManagerPanelProxyを安全に削除するための判断基準と手順：

1. **安定稼働期間の確保**
   - 新しい実装に切り替えた後、少なくとも1-2ヶ月程度の安定稼働期間を確保
   - この間、バグや問題が報告されていないことを確認

2. **依存関係の確認**
   - 以下のコマンドでScopeManagerPanelProxy以外の場所からScopeManagerPanelProxyへの直接参照があるか調査:
     ```bash
     cd /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius
     grep -r "ScopeManagerPanelProxy" --include="*.ts" src/ | grep -v "src/ui/scopeManager/ScopeManagerPanelProxy.ts"
     ```
   - extension.tsだけでなく、他のファイルからの参照も確認

3. **段階的削除プロセス**
   - テスト環境で、まずScopeManagerPanelProxyをdeprecatedとしてマークし、警告メッセージを出すように修正
   - しばらく様子を見て、警告が出ていないことを確認した後に実際に削除
   - 依存箇所がある場合は、それぞれの箇所をScopeManagerPanelに直接参照するように修正

4. **最終確認**
   - ScopeManagerPanelProxyを完全に削除したテストブランチで、すべての機能を検証
   - エラーログを監視し、関連するエラーがないことを確認

以上の手順を踏んで、安全にScopeManagerPanelProxyを削除できると判断できれば、完全に削除することを検討します。