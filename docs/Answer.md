
[2025-03-17T09:15:27.125Z] [INFO] プロキシサーバーを起動しました（ポート: 54321）
[2025-03-17T09:15:27.125Z] [INFO] プロンプト同期を開始しました
[2025-03-17T09:15:27.125Z] [INFO] ClaudeCode統合機能を開始しました
[2025-03-17T09:15:28.303Z] [INFO] ログイン処理を開始します
[2025-03-17T09:15:29.302Z] [DEBUG] AuthStorageManager: データを保存しました (キー: appgenius.accessToken)
[2025-03-17T09:15:29.305Z] [DEBUG] AuthStorageManager: データを保存しました (キー: appgenius.tokenExpiry)
[2025-03-17T09:15:29.317Z] [INFO] AuthStorageManager: アクセストークンを保存しました (有効期限: 2025/3/18 18:15:29)
[2025-03-17T09:15:29.319Z] [DEBUG] AuthStorageManager: データを保存しました (キー: appgenius.refreshToken)
[2025-03-17T09:15:29.319Z] [DEBUG] AuthStorageManager: リフレッシュトークンを保存しました
[2025-03-17T09:15:29.320Z] [DEBUG] AuthStorageManager: データを保存しました (キー: appgenius.userData)
[2025-03-17T09:15:29.320Z] [DEBUG] AuthStorageManager: ユーザーデータを保存しました
[2025-03-17T09:15:29.321Z] [INFO] 認証状態が変更されました: expiresAt
[2025-03-17T09:15:29.321Z] [DEBUG] ProtectedPanel: 権限変更を検知しました。UIの更新が必要かもしれません。
[2025-03-17T09:15:29.321Z] [DEBUG] PermissionManager: 権限変更イベントを発行しました
[2025-03-17T09:15:29.321Z] [INFO] プロキシサーバーは既に起動しています（ポート: 54321）
[2025-03-17T09:15:29.321Z] [INFO] 認証チェックインターバルを停止しました
[2025-03-17T09:15:29.321Z] [INFO] 認証チェックインターバルを開始しました（300秒間隔）
[2025-03-17T09:15:29.321Z] [INFO] ログインに成功しました: Test User
[2025-03-17T09:15:29.322Z] [INFO] プロンプト同期を開始しました
[2025-03-17T09:15:29.322Z] [INFO] ClaudeCode統合機能を開始しました

ステム開発/AppGenius2/AppGenius/dist/extension.js:19224:30)
	at async AuthenticationService._initialize (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:18961:17)
[2025-03-17T09:49:49.695Z] [INFO] サーバーエラーが発生しました。リトライします (2/3)
[2025-03-17T09:49:51.699Z] [INFO] ユーザー情報の取得を開始します
[2025-03-17T09:49:52.499Z] [ERROR] ユーザー情報取得中にエラーが発生しました
[2025-03-17T09:49:52.499Z] [ERROR] Error details: Request failed with status code 500
[2025-03-17T09:49:52.500Z] [ERROR] Stack trace: AxiosError: Request failed with status code 500
	at settle (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:4692:12)
	at IncomingMessage.handleStreamEnd (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:5809:11)
	at IncomingMessage.emit (node:events:530:35)
	at endReadableNT (node:internal/streams/readable:1698:12)
	at process.processTicksAndRejections (node:internal/process/task_queues:82:21)
	at Axios.request (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:6919:41)
	at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
	at async AuthenticationService._fetchUserInfo (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:19224:30)
	at async AuthenticationService._initialize (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:18961:17)
[2025-03-17T09:49:52.500Z] [INFO] サーバーエラーが発生しました。リトライします (3/3)
[2025-03-17T09:49:56.506Z] [INFO] ユーザー情報の取得を開始します
[2025-03-17T09:49:57.454Z] [ERROR] ユーザー情報取得中にエラーが発生しました
[2025-03-17T09:49:57.454Z] [ERROR] Error details: Request failed with status code 500
[2025-03-17T09:49:57.455Z] [ERROR] Stack trace: AxiosError: Request failed with status code 500
	at settle (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:4692:12)
	at IncomingMessage.handleStreamEnd (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:5809:11)
	at IncomingMessage.emit (node:events:530:35)
	at endReadableNT (node:internal/streams/readable:1698:12)
	at process.processTicksAndRejections (node:internal/process/task_queues:82:21)
	at Axios.request (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:6919:41)
	at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
	at async AuthenticationService._fetchUserInfo (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:19224:30)
	at async AuthenticationService._initialize (/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/dist/extension.js:18961:17)
[2025-03-17T09:49:57.455Z] [INFO] サーバーとの通信に失敗しました。ローカルデータを使用して認証状態を維持します
[2025-03-17T09:49:57.455Z] [INFO] フォールバック認証を試みます: ローカルに保存されたユーザー情報を確認
[2025-03-17T09:49:57.457Z] [INFO] フォールバック認証: ローカルユーザーデータを使用します (Test User)
[2025-03-17T09:49:57.457Z] [INFO] 認証状態が変更されました: isAuthenticated, username, role
[2025-03-17T09:49:57.457Z] [DEBUG] ProtectedPanel: 権限変更を検知しました。UIの更新が必要かもしれません。
[2025-03-17T09:49:57.457Z] [DEBUG] PermissionManager: 権限変更イベントを発行しました
[2025-03-17T09:49:57.458Z] [INFO] フォールバック認証に成功しました: Test User (admin)
[2025-03-17T09:49:57.458Z] [INFO] 認証チェックインターバルを開始しました（300秒間隔）
[2025-03-17T09:49:57.458Z] [INFO] 認証サービスの初期化が完了しました
[2025-03-17T09:49:57.458Z] [INFO] プロキシサーバーを起動しました（ポート: 54321）
[2025-03-17T09:49:57.459Z] [INFO] プロンプト同期を開始しました
[2025-03-17T09:49:57.459Z] [INFO] ClaudeCode統合機能を開始しました
