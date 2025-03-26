
[2025-03-26T13:13:46.999Z] [INFO] PermissionService: 権限チェック - 機能=dashboard, 認証=false, ユーザー=なし, ロール=guest
[2025-03-26T13:13:46.999Z] [INFO] 【デバッグ】ダッシュボード表示条件を満たしています - 表示を試みます
[2025-03-26T13:13:47.000Z] [DEBUG] DashboardPanel: 権限チェックを実行します (dashboard)
[2025-03-26T13:13:47.000Z] [DEBUG] AuthGuard: dashboardへのアクセス権限をチェックします
[2025-03-26T13:13:47.000Z] [INFO] PermissionService: 権限チェック - 機能=dashboard, 認証=false, ユーザー=なし, ロール=guest
[2025-03-26T13:13:47.000Z] [DEBUG] DashboardPanel: 権限チェックOK
[2025-03-26T13:13:47.000Z] [INFO] 【デバッグ】ダッシュボード表示を要求しました（グローバルAIサービスを使用、オンボーディング非表示）
[2025-03-26T13:13:47.000Z] [INFO] 【デバッグ】認証状態変更コマンドを実行しました
[2025-03-26T13:13:47.000Z] [DEBUG] ProtectedPanel: 権限変更を検知しました。UIの更新が必要かもしれません。
[2025-03-26T13:13:47.000Z] [INFO] SimpleAuthService: セッション復元完了, ユーザー=Tatsuya, ロール=super_admin
[2025-03-26T13:13:47.001Z] [INFO] 【認証情報】APIキー取得成功: sk-an...XXXX (18文字)
[2025-03-26T13:13:47.001Z] [INFO] ============================================================
[2025-03-26T13:13:47.001Z] [INFO] SimpleAuthServiceログイン成功: ユーザー=なし, ID=なし, ロール=なし
[2025-03-26T13:13:47.001Z] [INFO] 認証状態: 認証済み
[2025-03-26T13:13:47.001Z] [INFO] ============================================================
[2025-03-26T13:13:47.504Z] [INFO] オンボーディング表示をスキップするように指示しました
[2025-03-26T13:13:47.505Z] [INFO] オンボーディング表示をスキップするように指示しました
[2025-03-26T13:13:50.286Z] [ERROR] SimpleAuth ユーザー情報取得中にエラーが発生しました
[2025-03-26T13:13:50.287Z] [ERROR] Error details: timeout of 10000ms exceeded
[2025-03-26T13:13:50.287Z] [ERROR] Stack trace: AxiosError: timeout of 10000ms exceeded
	at S.<anonymous> (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:834279)
	at S.emit (node:events:518:28)
	at Timeout.<anonymous> (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:474539)
	at listOnTimeout (node:internal/timers:581:17)
	at process.processTimers (node:internal/timers:519:7)
	at cn.request (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:845914)
	at async f._fetchUserInfo (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:624239)
	at async f._initialize (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:616978)
[2025-03-26T13:13:50.288Z] [INFO] SimpleAuth ネットワークエラーが発生しました。リトライします (2/3)
[2025-03-26T13:13:52.290Z] [INFO] SimpleAuth ユーザー情報の取得を開始します
[2025-03-26T13:13:52.293Z] [DEBUG] TokenManager: アクセストークン取得 成功
[2025-03-26T13:14:02.308Z] [ERROR] SimpleAuth ユーザー情報取得中にエラーが発生しました
[2025-03-26T13:14:02.308Z] [ERROR] Error details: timeout of 10000ms exceeded
[2025-03-26T13:14:02.309Z] [ERROR] Stack trace: AxiosError: timeout of 10000ms exceeded
	at S.<anonymous> (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:834279)
	at S.emit (node:events:518:28)
	at Timeout.<anonymous> (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:474539)
	at listOnTimeout (node:internal/timers:581:17)
	at process.processTimers (node:internal/timers:519:7)
	at cn.request (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:845914)
	at async f._fetchUserInfo (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:624239)
	at async f._initialize (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:2:616978)
[2025-03-26T13:14:02.309Z] [INFO] SimpleAuth ネットワークエラーが発生しました。リトライします (3/3)
[2025-03-26T13:14:04.662Z] [DEBUG] Saved metadata for 8 projects
[2025-03-26T13:14:04.663Z] [INFO] Project updated: project_1742164692026
[2025-03-26T13:14:04.663Z] [INFO] プロジェクトをアクティブに設定: project_1742164692026
[2025-03-26T13:14:04.664Z] [DEBUG] Event emitted: project-selected from DashboardPanel for project project_1742164692026
[2025-03-26T13:14:04.664Z] [INFO] プロジェクト選択イベント発火: ID=project_1742164692026, パス=/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius
[2025-03-26T13:14:05.455Z] [INFO] WebViewからのコマンド実行リクエスト: appgenius-ai.openScopeManager, 引数=["/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius"]
[2025-03-26T13:14:05.456Z] [INFO] スコープマネージャーを開くコマンドが実行されました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius
[2025-03-26T13:14:05.457Z] [DEBUG] ScopeManagerPanel: 権限チェックを実行します (scope_manager)
[2025-03-26T13:14:05.457Z] [DEBUG] AuthGuard: scope_managerへのアクセス権限をチェックします
[2025-03-26T13:14:05.457Z] [INFO] PermissionService: 権限チェック - 機能=scope_manager, 認証=false, ユーザー=なし, ロール=guest
[2025-03-26T13:14:05.457Z] [WARN] PermissionService: guestはscope_managerへのアクセス権限がありません
[2025-03-26T13:14:05.458Z] [WARN] ScopeManagerPanel: scope_managerへのアクセスが拒否されました
[2025-03-26T13:14:06.314Z] [INFO] SimpleAuth ユーザー情報の取得を開始します
[2025-03-26T13:14:06.318Z] [DEBUG] TokenManager: アクセストークン取得 成功
