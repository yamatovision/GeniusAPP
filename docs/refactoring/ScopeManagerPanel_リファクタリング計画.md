更新版 ScopeManagerPanel リファクタリングプラン

  1. 目標と原則

  - 段階的リファクタリング: 一度に大規模な変更を避け、小さなステップで進める
  - 継続的テスト: 各ステップ後に動作確認を行い、問題をすぐに特定・修正
  - クラス分割: 単一責任の原則に基づき、機能ごとにクラスを分割
  - MVVMパターン導入: 状態管理をViewModelに集約し、ビジネスロジックとUIを分離

  2. リファクタリング順序

  フェーズ1: サービスクラスの切り出し

  1. FileSystemService: ファイル操作関連の責務を分離
  2. ProjectService: プロジェクト管理機能を分離
  3. SharingService: 共有機能を分離
  4. AuthenticationHandler: 認証・権限関連を分離

  フェーズ2: MVVMパターン導入

  5. ScopeManagerViewModel: 状態管理とビジネスロジックの集約
  6. WebViewMessageHandler: WebViewとのメッセージ処理を担当

  フェーズ3: 最終調整

  7. ScopeManagerPanel: 最終的にシンプルなコントローラーに

  3. 各フェーズの詳細ステップ

  フェーズ1: サービスクラスの切り出し

  ステップ1: FileSystemService の実装

  1. /services/FileSystemService.ts を作成
  2. ScopeManagerPanel から以下のメソッドを移行:
    - _updateDirectoryStructure
    - _setupFileWatcher
    - _loadStatusFile
    - _handleGetMarkdownContent
  3. イベント発火メカニズムの実装
  4. ScopeManagerPanel から FileSystemService を呼び出すよう変更

  ステップ2: ProjectService の実装

  1. /services/ProjectService.ts を作成
  2. プロジェクト関連メソッドを移行:
    - _handleCreateProject
    - _handleLoadExistingProject
    - _handleSelectProject
    - _handleRemoveProject
  3. ScopeManagerPanel から ProjectService を使用するよう変更

  ステップ3: SharingService の実装

  1. /services/SharingService.ts を作成
  2. 共有機能メソッドを移行:
    - _handleShareText
    - _handleShareImage
    - _handleGetHistory
  3. ScopeManagerPanel から呼び出すよう変更

  ステップ4: AuthenticationHandler の実装

  1. /services/AuthenticationHandler.ts を作成
  2. 認証関連メソッドを移行:
    - _setupTokenExpirationMonitor
  3. 権限チェックロジックを移行

  フェーズ2: MVVMパターン導入

  ステップ5: ScopeManagerViewModel の実装

  1. /viewModel/ScopeManagerViewModel.ts を作成
  2. 状態管理ロジックを移行
  3. 各種サービスを統合
  4. イベント通知メカニズムの実装

  ステップ6: WebViewMessageHandler の実装

  1. /viewModel/WebViewMessageHandler.ts を作成
  2. WebViewメッセージ処理を移行
  3. コマンドパターンの実装

  フェーズ3: 最終調整

  ステップ7: ScopeManagerPanel のシンプル化

  1. ScopeManagerPanel を単純なコントローラーに
  2. ViewModel と WebView の接続のみを担当
  3. 不要なメソッドとプロパティを削除

  4. 各ステップの実装方針

  1. 一つずつ進める: 各サービスを1つずつ実装し、テスト
  2. 直接置き換え: 既存のメソッドを直接サービス呼び出しに置き換え
  3. 並行運用期間: 一時的に古いメソッドと新しいサービスを並行して持つ
  4. 段階的削除: 完全に移行確認したら古いコードを削除

  5. テスト戦略

  1. 各サービス実装後に、ScopeManagerPanel の動作テスト
  2. 特に以下の機能を中心にテスト:
    - プロジェクト作成・読み込み
    - ディレクトリ構造表示
    - マークダウン表示
    - 共有機能

  6. 完了条件

  1. すべてのサービスが独立して動作
  2. ScopeManagerPanel がシンプルなコントローラーになっている
  3. 元の機能がすべて維持されている
  4. コードの量が全体として減少している

  このプランに従って段階的にリファクタリングを進めることで、リスクを最小限に抑えながら、コードベースを改善できると考えます。各ステップ完了ごとに、動作確認とコミットを行うことを推奨します。
