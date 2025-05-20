/**
 * AppGenius VSCode Extension メインエントリーポイント
 * 
 * 【認証システム 2025/05/14】
 * - 認証システムは SimpleAuthManager + SimpleAuthService に完全に移行済み
 * - PermissionManagerは認証サービスと連携して権限管理を行います
 * - パネル/コンポーネントは、AuthGuardを通じてPermissionManagerを使用します
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { StatusBar } from './ui/statusBar';
import { Logger, LogLevel } from './utils/logger';
import { FileOperationManager } from './utils/fileOperationManager';
import { MockupGalleryPanel } from './ui/mockupGallery/MockupGalleryPanel';
import { AppGeniusEventBus, AppGeniusEventType } from './services/AppGeniusEventBus';
import { ClaudeCodeApiClient } from './api/claudeCodeApiClient';
import { ProjectManagementService } from './services/ProjectManagementService';
import { PlatformManager } from './utils/PlatformManager';
import { ScopeExporter } from './utils/ScopeExporter';
import { MessageBroker } from './utils/MessageBroker';
import { ScopeManagerPanel } from './ui/scopeManager/ScopeManagerPanel';
import { SimpleAuthManager } from './core/auth/SimpleAuthManager';
import { SimpleAuthService } from './core/auth/SimpleAuthService';
import { PermissionManager } from './core/auth/PermissionManager';
import { registerAuthCommands } from './core/auth/authCommands';
import { registerFileViewerCommands } from './commands/fileViewerCommands';
import { AuthGuard } from './ui/auth/AuthGuard';
import { Feature } from './core/auth/roles';
import { AuthStorageManager } from './utils/AuthStorageManager';
import { FileViewerPanel } from './ui/fileViewer/FileViewerPanel';
import { NoProjectViewPanel } from './ui/noProjectView/NoProjectViewPanel';

// グローバル変数としてExtensionContextを保持（安全対策）
declare global {
	// eslint-disable-next-line no-var
	var __extensionContext: vscode.ExtensionContext;
	// SimpleAuthServiceインスタンスをグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_simple_auth_service: any;
	// 認証トークンをグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_auth_token: string;
	// 認証状態をグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_auth_state: any;
}

/**
 * グローバルコンテキスト変数をセットアップする
 */
function setupGlobalContext(context: vscode.ExtensionContext): void {
  // グローバルにExtensionContextを保存（複数の方法で参照できるようにする）
  (global as any).__extensionContext = context;
  (global as any).extensionContext = context;
  (global as any).appgeniusContext = context; // 互換性のための追加変数

  Logger.info('グローバルコンテキスト変数が設定されました');
}

/**
 * ロガーを初期化する
 */
function initializeLogger(): void {
  // 開発環境と本番環境で分ける
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  const autoShow = !isProduction; // 開発環境でのみ自動表示
  
  // ロガーの初期化
  Logger.initialize('ブルーランプ', logLevel, autoShow);
  
  // 環境情報をログに出力
  Logger.info(`ブルーランプが起動しました [環境: ${isProduction ? '本番' : '開発'}, ログレベル: ${LogLevel[logLevel]}]`);
  
  // 開発環境では明示的にログを表示
  if (!isProduction) {
    setTimeout(() => {
      Logger.show();
      Logger.info('=== デバッグモード: 詳細ログを表示しています ===');
    }, 1000); // 1秒後に表示（起動処理完了後）
  }
}

/**
 * ステータスバーアイテムをセットアップする
 */
function setupStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  // AppGenius AI クイックアクセスステータスバーアイテムを追加
  const appGeniusStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  appGeniusStatusBarItem.text = "$(rocket) ブルーランプ";
  appGeniusStatusBarItem.tooltip = "ブルーランプ スコープマネージャーを開く";
  appGeniusStatusBarItem.command = "appgenius-ai.openScopeManager";
  appGeniusStatusBarItem.show();
  context.subscriptions.push(appGeniusStatusBarItem);
  
  return appGeniusStatusBarItem;
}

export function activate(context: vscode.ExtensionContext) {
  // グローバルコンテキストの設定
  setupGlobalContext(context);
  
  // ロガーの初期化
  initializeLogger();
  
  // ステータスバーの設定
  const statusBarItem = setupStatusBar(context);
	
	
	/**
	 * 基本コマンドを登録する
	 */
	function registerBasicCommands(context: vscode.ExtensionContext): void {
		// openDevelopmentAssistantコマンドを登録（リファクタリングによりScopeManagerに置き換え）
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openDevelopmentAssistant', (params?: any) => {
				try {
					Logger.info('開発アシスタントを開くコマンドが実行されました（ScopeManagerに転送）');
					
					// DashboardPanel削除のため、代わりにScopeManagerを表示
					let projectPath: string | undefined;
					if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
						projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
					}
					
					// スコープマネージャーコマンドを実行
					vscode.commands.executeCommand('appgenius-ai.openScopeManager', projectPath);
					
					Logger.info('ScopeManagerに転送しました');
				} catch (error) {
					Logger.error('開発アシスタントを開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`開発アシスタントを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		
		Logger.info('基本コマンドが登録されました');
	}
	
	/**
	 * 認証関連コマンドを登録する
	 */
	function registerAuthRelatedCommands(context: vscode.ExtensionContext): void {
		// ログインコマンドを登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.login', async () => {
				try {
					Logger.info('ログインコマンドが実行されました');
					// 認証サーバーのヘルスチェック
					vscode.window.showInformationMessage('認証サーバーへの接続をチェック中...');
					
					// LoginWebviewPanelを使用してログインフォームを表示
					const { LoginWebviewPanel } = require('./ui/auth/LoginWebviewPanel');
					LoginWebviewPanel.createOrShow(context.extensionUri);
				} catch (error) {
					Logger.error('ログイン処理中にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`ログインエラー: ${(error as Error).message}`);
				}
			})
		);
		
		// 認証デバッグコマンドを登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.authDebug', async () => {
				try {
					Logger.info('認証デバッグコマンドが実行されました');
					
					vscode.window.showInformationMessage('認証サーバーを診断中...');
					
					// SimpleAuthManagerのテストコマンドを実行
					await vscode.commands.executeCommand('appgenius.simpleAuth.test');
					
					vscode.window.showInformationMessage('認証サーバーの診断が完了しました。詳細はログを確認してください。');
				} catch (error) {
					Logger.error('認証デバッグ中にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`認証デバッグエラー: ${(error as Error).message}`);
				}
			})
		);
		
		Logger.info('認証関連コマンドが登録されました');
	}
	
	/**
	 * 自動起動処理を行う
	 */
	function handleAutoStart(context: vscode.ExtensionContext): void {
		// 自動起動設定の確認
		const config = vscode.workspace.getConfiguration('appgeniusAI');
		const autoStartDashboard = config.get('autoStartTerminal', true);
		
		// 初回インストール時または自動起動が有効な場合にアプリケーションを起動
		if (autoStartDashboard) {
			// 少し遅延させてVSCodeの起動が完了してから処理
			setTimeout(() => {
				// プロジェクトパスを取得
				let projectPath: string | undefined;
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
				}
				
				// まず認証状態をチェック
				if (!AuthGuard.checkLoggedIn()) {
					// 未認証の場合はログイン画面を表示
					Logger.info('AppGenius AI起動時: 未認証のためログイン画面を表示します');
					// ログイン画面を表示（LoginWebviewPanelを使用）
					const { LoginWebviewPanel } = require('./ui/auth/LoginWebviewPanel');
					LoginWebviewPanel.createOrShow(context.extensionUri);
				} else if (AuthGuard.checkAccess(Feature.SCOPE_MANAGER)) {
					// 認証済みかつ権限がある場合のみスコープマネージャーを開く
					vscode.commands.executeCommand('appgenius-ai.openScopeManager', projectPath);
					Logger.info('AppGenius AIスコープマネージャーを自動起動しました');
				} else {
					// 認証済みだが権限がない場合
					Logger.warn('AppGenius AI起動時: 権限不足のためスコープマネージャーを表示しません');
					vscode.window.showWarningMessage('スコープマネージャーへのアクセス権限がありません。');
				}
			}, 2000);
		}
	}
	
	// 基本コマンドを登録
	registerBasicCommands(context);
	
	// 認証関連コマンドを登録
	registerAuthRelatedCommands(context);
	
	// 自動起動処理
	handleAutoStart(context);
	
	/**
	 * 基本サービス・ユーティリティを初期化する
	 */
	function initializeBasicServices(context: vscode.ExtensionContext): void {
		// PlatformManagerの初期化
		const platformManager = PlatformManager.getInstance();
		platformManager.setExtensionContext(context);
		Logger.info('PlatformManager initialized successfully');
		
		// ScopeExporterの初期化
		ScopeExporter.getInstance();
		Logger.info('ScopeExporter initialized successfully');
	}
	
	// 基本サービス・ユーティリティの初期化
	initializeBasicServices(context);
	
	/**
	 * 認証システムを初期化する
	 */
	function initializeAuthSystem(context: vscode.ExtensionContext): { 
		authStorageManager: any, 
		authStateChangedCommand: vscode.Disposable 
	} {
		// AuthStorageManagerの初期化
		const authStorageManager = AuthStorageManager.getInstance(context);
		Logger.info('AuthStorageManager initialized successfully');
		
		// 認証状態変更イベントを監視するコマンド登録
		// !!!重要: このコマンドはSimpleAuthManagerからも使用されています!!!
		// コマンドの登録は必ずSimpleAuthManagerの初期化前に行う必要があります
		const authStateChangedCommand = vscode.commands.registerCommand(
			'appgenius.onAuthStateChanged', 
			(isAuthenticated: boolean) => {
				try {
					Logger.info(`認証状態変更イベント: ${isAuthenticated ? '認証済み' : '未認証'}`);
					Logger.info('【デバッグ】appgenius.onAuthStateChangedコマンドが実行されました');
					// 認証済みの場合、自動的にスコープマネージャーを表示
					if (isAuthenticated && AuthGuard.checkAccess(Feature.SCOPE_MANAGER)) {
						Logger.info('【デバッグ】スコープマネージャー表示条件を満たしています - 表示を試みます');
						
						// プロジェクトパスを取得
						let projectPath: string | undefined;
						if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
							projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
						}
						
						// スコープマネージャーを開く
						ScopeManagerPanel.createOrShow(context.extensionUri, context, projectPath);
						Logger.info('【デバッグ】スコープマネージャー表示を要求しました');
					} else {
						if (!isAuthenticated) {
							Logger.info('【デバッグ】スコープマネージャー表示スキップ: 認証されていません');
						}
						if (!AuthGuard.checkAccess(Feature.SCOPE_MANAGER)) {
							Logger.info('【デバッグ】スコープマネージャー表示スキップ: 権限がありません');
						}
					}
				} catch (error) {
					Logger.error('認証状態変更ハンドラーでエラーが発生しました', error as Error);
				}
			}
		);
		
		// サブスクリプションに追加
		context.subscriptions.push(authStateChangedCommand);
		
		return { authStorageManager, authStateChangedCommand };
	}
	
	// 認証関連の初期化
	try {
		const { authStorageManager, authStateChangedCommand } = initializeAuthSystem(context);

		// スコープマネージャーを開くコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openScopeManager', (projectPath: string) => {
				try {
					Logger.info(`スコープマネージャーを開くコマンドが実行されました: ${projectPath}`);
					
					// 認証状態を確認
					if (!AuthGuard.checkLoggedIn()) {
						Logger.info('スコープマネージャー: 未認証のためログイン画面に誘導します');
						// ログイン画面を表示（LoginWebviewPanelを使用）
						const { LoginWebviewPanel } = require('./ui/auth/LoginWebviewPanel');
						LoginWebviewPanel.createOrShow(context.extensionUri);
						return;
					}
					
					// 権限チェック
					if (!AuthGuard.checkAccess(Feature.SCOPE_MANAGER)) {
						Logger.warn('スコープマネージャー: 権限不足のためアクセスを拒否します');
						vscode.window.showWarningMessage('スコープマネージャーへのアクセス権限がありません。');
						return;
					}
					
					// 認証済みの場合のみパネルを表示
					ScopeManagerPanel.createOrShow(context.extensionUri, context, projectPath);
				} catch (error) {
					Logger.error('スコープマネージャーを開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`スコープマネージャーを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		
		// ファイルビューワーを開くコマンド（旧マークダウンビューワーの代替）
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openFileViewer', (projectPath?: string) => {
				try {
					Logger.info(`ファイルビューワーを開くコマンドが実行されました: ${projectPath || 'パスなし'}`);
					
					// プロジェクトパスが指定されていない場合は、アクティブプロジェクトまたはワークスペースから取得
					if (!projectPath) {
						// プロジェクト管理サービスからアクティブプロジェクトパスを取得
						const projectService = ProjectManagementService.getInstance();
						const activeProject = projectService.getActiveProject();
						
						if (activeProject && activeProject.path) {
							projectPath = activeProject.path;
						} else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
							projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
						}
					}
					
					// ファイルビューワーパネルを表示
					FileViewerPanel.createOrShow(context.extensionUri);
					Logger.info('ファイルビューワーパネルを表示しました');
				} catch (error) {
					Logger.error('ファイルビューワーを開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`ファイルビューワーを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		
		// マークダウンビューワーを開くコマンド（互換性のため）
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openMarkdownViewer', (projectPath?: string) => {
				try {
					Logger.info(`マークダウンビューワーコマンドを受信 (FileViewerに転送): ${projectPath || 'パスなし'}`);
					// 新しいファイルビューワーコマンドにリダイレクト
					vscode.commands.executeCommand('appgenius-ai.openFileViewer', projectPath);
				} catch (error) {
					Logger.error('マークダウンビューワーリダイレクト中にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`ファイルビューワーを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		
		Logger.info('ScopeManager command registered successfully');
		
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openDebugDetective', (providedProjectPath?: string) => {
				try {
					Logger.info(`デバッグ探偵を開くコマンドが実行されましたが、このコンポーネントはリファクタリングで削除されました`);
					vscode.window.showInformationMessage('デバッグ探偵機能は現在利用できません。代わりにファイルビューワーをご利用ください。');
					
					// 代わりにファイルビューワーを開く
					vscode.commands.executeCommand('appgenius-ai.openFileViewer', providedProjectPath);
				} catch (error) {
					Logger.error('代替機能への転送中にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`エラーが発生しました: ${(error as Error).message}`);
				}
			})
		);
		Logger.info('DebugDetective fallback command registered successfully');
		
		// モックアップギャラリーを開くコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openMockupGallery', (projectPath: string) => {
				try {
					Logger.info(`モックアップギャラリーを開くコマンドが実行されました: ${projectPath}`);
					MockupGalleryPanel.createOrShow(context.extensionUri, projectPath);
					Logger.info('モックアップギャラリーを正常に開きました');
				} catch (error) {
					Logger.error('モックアップギャラリーを開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`モックアップギャラリーを開けませんでした: ${(error as Error).message}`);
				}
			})
		);		
		
		// 要件定義ビジュアライザー（SimpleChatPanel）を開くコマンドの登録
		// リファクタリングによりこの機能はFileViewerに移行しました
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openSimpleChat', (projectPath?: string) => {
				try {
					Logger.info(`要件定義ビジュアライザーコマンドが実行されましたが、リファクタリングにより削除されました`);
					vscode.window.showInformationMessage('要件定義ビジュアライザー機能は現在利用できません。代わりにファイルビューワーをご利用ください。');
					
					// 代わりにファイルビューワーを開く
					vscode.commands.executeCommand('appgenius-ai.openFileViewer', projectPath);
				} catch (error) {
					Logger.error('代替機能への転送中にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`エラーが発生しました: ${(error as Error).message}`);
				}
			})
		);
		Logger.info('SimpleChat fallback command registered successfully');
		
		// 新しいシンプル認証マネージャーの初期化（優先使用）
		const simpleAuthManager = SimpleAuthManager.getInstance(context);
		Logger.info('SimpleAuthManager initialized successfully');
		
		// シンプル認証サービスの取得
		const simpleAuthService = simpleAuthManager.getAuthService();
		// グローバル変数に保存（拡張機能全体で参照できるように）
		global._appgenius_simple_auth_service = simpleAuthService;
		
		Logger.info('SimpleAuthService accessed and stored in global variable successfully');
		
		/**
			 * 認証状態変更時のハンドラーを設定
			 */
			function setupAuthStateChangeListener(context: vscode.ExtensionContext, authService: SimpleAuthService): any {
				// 認証状態変更イベントのリスナーを登録して、ダッシュボード自動表示のトリガーにする
		simpleAuthService.onStateChanged(state => {
			try {
				Logger.info(`認証状態が変更されました: ${state.isAuthenticated ? '認証済み' : '未認証'}`);
				
				// この時点でコマンドが登録されていることを検証
				if (state.isAuthenticated) {
					// 認証状態変更を通知
					try {
						Logger.info('【デバッグ】認証状態変更を通知します - コマンド実行前');
						vscode.commands.executeCommand('appgenius.onAuthStateChanged', true);
						Logger.info('【デバッグ】認証状態変更コマンドを実行しました');
					} catch (cmdError) {
						Logger.error('【デバッグ】認証状態変更コマンド実行中にエラーが発生しました', cmdError as Error);
						
						// エラー発生時はスコープマネージャーを直接表示
						try {
							Logger.info('【デバッグ】代替手段: スコープマネージャーを直接表示します');
							if (AuthGuard.checkAccess(Feature.SCOPE_MANAGER)) {
								// プロジェクトパスを取得
								let projectPath: string | undefined;
								if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
									projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
								}
								
								// スコープマネージャーを開く
								ScopeManagerPanel.createOrShow(context.extensionUri, context, projectPath);
								Logger.info('【デバッグ】代替手段で成功: スコープマネージャーを表示しました');
							}
						} catch (directError) {
							Logger.error('【デバッグ】スコープマネージャーの直接表示に失敗しました', directError as Error);
						}
					}
				}
			} catch (error) {
				Logger.error('認証状態変更リスナーでエラーが発生しました', error as Error);
			}
		});
		
						
				return authService.onStateChanged;
			}
			
			// 認証状態変更リスナーの設定
			const authStateChangeListener = setupAuthStateChangeListener(context, simpleAuthService);
			
			// 従来の認証サービスは不要になったため削除

		/**
			 * PermissionManagerを初期化する
			 */
			function initializePermissionManager(authService: SimpleAuthService): PermissionManager {
				// PermissionManagerの初期化（シンプル認証サービスを使用）
		const permissionManager = PermissionManager.getInstance(simpleAuthService);
		Logger.info('PermissionManager initialized with SimpleAuthService');
				
				return permissionManager;
			}
			
			// PermissionManagerの初期化
			const permissionManager = initializePermissionManager(simpleAuthService);
		
		/**
			 * 拡張機能のコマンド類を登録する
			 */
			function registerExtensionCommands(context: vscode.ExtensionContext): void {
				// 認証コマンドの登録
		registerAuthCommands(context);
		Logger.info('Auth commands registered successfully');
		
		// プロンプトライブラリコマンドは削除済み
		Logger.info('Prompt library commands have been removed');
		
		// ファイルビューワーコマンドの登録
		registerFileViewerCommands(context);
		Logger.info('File viewer commands registered successfully');
		
		// 環境変数アシスタントは不要なため、チェックと登録部分を削除
		
		Logger.info('Environment commands registered successfully');
			}
			
			// 拡張機能コマンドの登録
			registerExtensionCommands(context);
		
		/**
			 * ClaudeCode連携機能を初期化する
			 */
			function initializeClaudeCodeIntegration(context: vscode.ExtensionContext): void {
				// ClaudeCode連携コマンドの登録
		import('./commands/claudeCodeCommands').then(({ registerClaudeCodeCommands }) => {
			registerClaudeCodeCommands(context);
			Logger.info('ClaudeCode commands registered successfully');
			
			// ClaudeCode起動カウントイベントを監視してバックエンドに通知
			const claudeCodeLaunchCountListener = AppGeniusEventBus.getInstance().onEventType(
				AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
				async (event) => {
					try {
						Logger.info('【デバッグ】ClaudeCode起動カウンター: イベントを受信しました');
						Logger.info(`【デバッグ】ClaudeCode起動カウンター: イベントデータ=${JSON.stringify(event.data)}`);
						
						// イベントデータからユーザーIDを取得
						let userId = null;
						
						// 方法1: イベントデータに直接ユーザーIDが含まれている場合
						if (event.data && event.data.userId) {
							userId = event.data.userId;
							Logger.info(`【デバッグ】ClaudeCode起動カウンター: イベントデータからユーザーIDを取得: ${userId}`);
							
							// このユーザーIDを直接使用してカウンターを更新
							// バックエンドAPIを呼び出してカウンターをインクリメント
							Logger.info(`【デバッグ】ClaudeCode起動カウンター: イベントデータのユーザーIDでAPI呼び出し: ユーザーID=${userId}`);
							const claudeCodeApiClient = ClaudeCodeApiClient.getInstance();
							const result = await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userId);
							
							if (result && result.success) {
								const newCount = result.data?.claudeCodeLaunchCount || 'N/A';
								Logger.info(`【デバッグ】ClaudeCode起動カウンター: 更新成功: 新しいカウント値 = ${newCount}`);
								Logger.info(`ClaudeCode起動カウンターが更新されました: ユーザーID ${userId}, 新しい値=${newCount}`);
								return; // これ以上の処理は不要なのでここで終了
							}
						}
						
						// 方法2: 通常の処理（イベントデータにユーザーIDがない場合のバックアップ）
						// 認証サービスの状態を確認
						const authService = SimpleAuthService.getInstance();
						const isAuthenticated = authService.isAuthenticated();
						Logger.info(`【デバッグ】ClaudeCode起動カウンター: 認証状態=${isAuthenticated}`);
						
						// 現在ログイン中のユーザーIDを取得
						Logger.info('【デバッグ】ClaudeCode起動カウンター: ユーザー情報を取得します');
						const userData = await authService.getCurrentUser();
						
						if (userData) {
							Logger.info(`【デバッグ】ClaudeCode起動カウンター: ユーザー情報取得成功`);
							Logger.info(`【デバッグ】ClaudeCode起動カウンター: ユーザー名=${userData.name || 'なし'}, メール=${userData.email || 'なし'}`);
							Logger.info(`【デバッグ】ClaudeCode起動カウンター: ユーザーID=${userData.id || 'なし'}, _id=${userData._id || 'なし'}`);
							
							// idプロパティがない場合は_idを使用する
							const userId = userData.id || userData._id;
							
							if (userId) {
								Logger.info(`【デバッグ】ClaudeCode起動カウンター: 有効なユーザーID=${userId}`);
								// バックエンドAPIを呼び出してカウンターをインクリメント
								Logger.info(`【デバッグ】ClaudeCode起動カウンター: APIクライアントを初期化します`);
								const claudeCodeApiClient = ClaudeCodeApiClient.getInstance();
								
								Logger.info(`【デバッグ】ClaudeCode起動カウンター: カウンター更新APIを呼び出します: ユーザーID=${userId}`);
								const result = await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userId);
								
								if (result && result.success) {
									const newCount = result.data?.claudeCodeLaunchCount || 'N/A';
									Logger.info(`【デバッグ】ClaudeCode起動カウンター: 更新成功: 新しいカウント値 = ${newCount}`);
									Logger.info(`ClaudeCode起動カウンターが更新されました: ユーザーID ${userId}, 新しい値=${newCount}`);
								} else {
									Logger.warn(`【デバッグ】ClaudeCode起動カウンター: API呼び出しは成功しましたが、レスポンスが期待と異なります:`, result);
								}
							} else {
								Logger.warn('【デバッグ】ClaudeCode起動カウンター: ユーザー情報にIDが含まれていません');
							}
						} else {
							Logger.warn('【デバッグ】ClaudeCode起動カウンター: ユーザー情報が取得できませんでした');
						}
					} catch (error) {
						Logger.error('【デバッグ】ClaudeCode起動カウンター更新エラー:', error as Error);
						// エラーのスタックトレースも出力
						if (error instanceof Error) {
							Logger.error(`【デバッグ】ClaudeCode起動カウンター: エラースタック=${error.stack}`);
						}
					}
				}
			);
			
			// コンテキストに登録して適切に破棄できるようにする
			context.subscriptions.push(claudeCodeLaunchCountListener);
			Logger.info('ClaudeCode起動カウントイベントリスナーが登録されました');
		}).catch(error => {
					Logger.error(`ClaudeCode commands registration failed: ${(error as Error).message}`);
				});
			}
			
			// ClaudeCode連携機能の初期化
			initializeClaudeCodeIntegration(context);
		
	} catch (error) {
		Logger.error('Authentication services initialization failed', error as Error);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
	Logger.info('AppGenius AI を終了しました');
}