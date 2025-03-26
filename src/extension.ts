/**
 * AppGenius VSCode Extension メインエントリーポイント
 * 
 * 【認証システムリファクタリング 2025/03/23】
 * - 現在、2つの認証システムが並行して存在しています：
 *   1. 従来の認証システム: AuthenticationService + TokenManager
 *   2. 新しい認証システム: SimpleAuthManager + SimpleAuthService
 * 
 * - 認証システムリファクタリングにより、SimpleAuthManagerとSimpleAuthServiceを優先使用します
 * - 後方互換性のため、古い認証サービスも維持していますが、将来的には完全に削除します
 * - PermissionManagerは両方の認証サービスに対応するよう更新されています
 * - パネル/コンポーネントは、AuthGuardを通じてPermissionManagerを使用します
 * 
 * 詳細は auth-system-refactoring-scope.md を参照
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { StatusBar } from './ui/statusBar';
import { Logger, LogLevel } from './utils/logger';
import { AIService } from './core/aiService';
import { ProjectAnalyzer } from './core/projectAnalyzer';
import { CodeGenerator } from './core/codeGenerator';
import { GitManager } from './core/gitManager';
import { TerminalInterface } from './ui/TerminalInterface';
import { CommandHandler } from './ui/CommandHandler';
import { FileOperationManager } from './utils/fileOperationManager';
import { MockupGalleryPanel } from './ui/mockupGallery/MockupGalleryPanel';
import { SimpleChatPanel } from './ui/simpleChat';
import { DashboardPanel } from './ui/dashboard/DashboardPanel';
import { ClaudeMdEditorPanel } from './ui/claudeMd/ClaudeMdEditorPanel';
import { ProjectManagementService } from './services/ProjectManagementService';
import { PlatformManager } from './utils/PlatformManager';
import { ScopeExporter } from './utils/ScopeExporter';
import { MessageBroker } from './utils/MessageBroker';
import { ScopeManagerPanel } from './ui/scopeManager/ScopeManagerPanel';
import { DebugDetectivePanel } from './ui/debugDetective/DebugDetectivePanel';
import { EnvironmentVariablesAssistantPanel } from './ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel';
import { TokenManager } from './core/auth/TokenManager';
import { AuthenticationService } from './core/auth/AuthenticationService';
import { SimpleAuthManager } from './core/auth/SimpleAuthManager'; // 新しい認証マネージャー
import { SimpleAuthService } from './core/auth/SimpleAuthService'; // 新しい認証サービス
import { PermissionManager } from './core/auth/PermissionManager';
import { registerAuthCommands } from './core/auth/authCommands';
import { registerPromptLibraryCommands } from './commands/promptLibraryCommands';
import { registerEnvironmentCommands } from './commands/environmentCommands';
import { EnvVariablesPanel } from './ui/environmentVariables/EnvVariablesPanel';
import { AuthGuard } from './ui/auth/AuthGuard';
import { Feature } from './core/auth/roles';
import { AuthStorageManager } from './utils/AuthStorageManager';

// グローバル変数としてExtensionContextを保持（安全対策）
declare global {
	// eslint-disable-next-line no-var
	var __extensionContext: vscode.ExtensionContext;
	// SimpleAuthServiceインスタンスをグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_simple_auth_service: any;
	// AIServiceインスタンスをグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_ai_service: any;
	// 認証トークンをグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_auth_token: string;
	// 認証状態をグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_auth_state: any;
	// 新認証システムのモジュールをグローバルに保持
	// eslint-disable-next-line no-var
	var _appgenius_auth_module: any;
}

export function activate(context: vscode.ExtensionContext) {
	// グローバルコンテキストを設定（安全対策）
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(global as any).__extensionContext = context;
	// 互換性のために両方の変数名を設定
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(global as any).extensionContext = context;
	
	// ロガーの初期化（自動表示をオンにする）
	Logger.initialize('AppGenius AI', LogLevel.DEBUG, true);
	Logger.info('AppGenius AI が起動しました');
	
	// AppGenius AI クイックアクセスステータスバーアイテムを追加
	const appGeniusStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	appGeniusStatusBarItem.text = "$(rocket) AppGenius";
	appGeniusStatusBarItem.tooltip = "AppGenius AIダッシュボードを開く";
	appGeniusStatusBarItem.command = "appgenius-ai.openDevelopmentAssistant";
	appGeniusStatusBarItem.show();
	context.subscriptions.push(appGeniusStatusBarItem);
	
	// AIServiceの初期化（グローバルで利用できるように）
	const aiService = new AIService();
	// グローバル変数に保存してどこからでも参照できるようにする
	(global as any)._appgenius_ai_service = aiService;
	
	// 自動起動設定の確認
	const config = vscode.workspace.getConfiguration('appgeniusAI');
	const autoStartDashboard = config.get('autoStartTerminal', true);
	
	// openDevelopmentAssistantコマンドを登録
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openDevelopmentAssistant', (params?: any) => {
			try {
				Logger.info('開発アシスタントを開くコマンドが実行されました');
				
				// DashboardPanelが実装されていることを確認
				const { DashboardPanel } = require('./ui/dashboard/DashboardPanel');
				DashboardPanel.createOrShow(context.extensionUri, aiService, params);
				
				Logger.info('DashboardPanelを表示しました');
			} catch (error) {
				Logger.error('開発アシスタントを開く際にエラーが発生しました', error as Error);
				vscode.window.showErrorMessage(`開発アシスタントを開けませんでした: ${(error as Error).message}`);
			}
		})
	);
	
	// ログインコマンドを登録
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.login', async () => {
			try {
				Logger.info('ログインコマンドが実行されました');
				// 認証サーバーのヘルスチェック
				vscode.window.showInformationMessage('認証サーバーへの接続をチェック中...');
				
				// 既存のログインコマンドを内部的に実行
				await vscode.commands.executeCommand('appgenius.simpleAuth.login');
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
	
	// 初回インストール時または自動起動が有効な場合にダッシュボードを表示
	if (autoStartDashboard) {
		// 少し遅延させてVSCodeの起動が完了してから表示
		setTimeout(() => {
			// メッセージに自動起動であることを伝える情報を追加（オンボーディング非表示フラグ）
			vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant', { skipOnboarding: true });
			Logger.info('AppGenius AIダッシュボードを自動起動しました（オンボーディング非表示）');
		}, 2000);
	}
	
	// PlatformManagerの初期化
	const platformManager = PlatformManager.getInstance();
	platformManager.setExtensionContext(context);
	Logger.info('PlatformManager initialized successfully');
	
	// ScopeExporterの初期化
	ScopeExporter.getInstance();
	Logger.info('ScopeExporter initialized successfully');
	
	// 認証関連の初期化
	try {
		// AuthStorageManagerの初期化
		const authStorageManager = AuthStorageManager.getInstance(context);
		Logger.info('AuthStorageManager initialized successfully');
		
		// 認証状態変更イベントを監視するコマンド登録
		// !!!重要: このコマンドはSimpleAuthManagerからも使用されています!!!
		// コマンドの登録は必ずSimpleAuthManagerの初期化前に行う必要があります
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius.onAuthStateChanged', (isAuthenticated: boolean) => {
				try {
					Logger.info(`認証状態変更イベント: ${isAuthenticated ? '認証済み' : '未認証'}`);
					Logger.info('【デバッグ】appgenius.onAuthStateChangedコマンドが実行されました');
					// 認証済みの場合、自動的にダッシュボードを表示
					if (isAuthenticated && AuthGuard.checkAccess(Feature.DASHBOARD)) {
						Logger.info('【デバッグ】ダッシュボード表示条件を満たしています - 表示を試みます');
						// グローバル変数からaiServiceを取得（初期化順序の問題を防ぐため）
						const globalAiService = (global as any)._appgenius_ai_service;
						if (globalAiService) {
							DashboardPanel.createOrShow(context.extensionUri, globalAiService, { skipOnboarding: true });
							Logger.info('【デバッグ】ダッシュボード表示を要求しました（グローバルAIサービスを使用、オンボーディング非表示）');
						} else {
							Logger.error('【デバッグ】グローバルAIサービスが見つかりません');
						}
					} else {
						if (!isAuthenticated) {
							Logger.info('【デバッグ】ダッシュボード表示スキップ: 認証されていません');
						}
						if (!AuthGuard.checkAccess(Feature.DASHBOARD)) {
							Logger.info('【デバッグ】ダッシュボード表示スキップ: 権限がありません');
						}
					}
				} catch (error) {
					Logger.error('認証状態変更ハンドラーでエラーが発生しました', error as Error);
				}
			})
		);

		// スコープマネージャーを開くコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openScopeManager', (projectPath: string) => {
				try {
					Logger.info(`スコープマネージャーを開くコマンドが実行されました: ${projectPath}`);
					ScopeManagerPanel.createOrShow(context.extensionUri, projectPath);
				} catch (error) {
					Logger.error('スコープマネージャーを開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`スコープマネージャーを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		
		// 環境変数アシスタントを開くコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openEnvironmentVariablesAssistant', (projectPath?: string) => {
				try {
					Logger.info(`環境変数アシスタントを開くコマンドが実行されました: ${projectPath || 'プロジェクトパスなし'}`);
					EnvironmentVariablesAssistantPanel.createOrShow(context.extensionUri, projectPath);
				} catch (error) {
					Logger.error('環境変数アシスタントを開く際にエラーが発生しました', error as Error, undefined, true);
					vscode.window.showErrorMessage(`環境変数アシスタントを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		
		// 環境変数アシスタントを開くエイリアスコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius.ai.openEnvironmentVariablesAssistant', (projectPath?: string) => {
				try {
					Logger.info(`環境変数アシスタントエイリアスコマンドからリダイレクトします`);
					// 元のコマンドにリダイレクト
					vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant', projectPath);
				} catch (error) {
					Logger.error('環境変数アシスタントエイリアスのリダイレクトに失敗しました', error as Error, undefined, true);
					vscode.window.showErrorMessage(`環境変数アシスタントを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		Logger.info('ScopeManager command registered successfully');
		
		// デバッグ探偵を開くコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openDebugDetective', (providedProjectPath?: string) => {
				try {
					// 引数から提供されたパスを優先
					let projectPath = providedProjectPath;
					
					// パスが提供されていない場合はアクティブプロジェクトから取得
					if (!projectPath) {
						const { AppGeniusStateManager } = require('./services/AppGeniusStateManager');
						const stateManager = AppGeniusStateManager.getInstance();
						projectPath = stateManager.getCurrentProjectPath();
						
						// アクティブプロジェクトパスがない場合は警告
						if (!projectPath) {
							Logger.warn('アクティブプロジェクトがありません。プロジェクトを選択してください。');
							vscode.window.showWarningMessage('プロジェクトが選択されていません。ダッシュボードからプロジェクトを選択してください。');
							return;
						}
					}
					
					Logger.info(`デバッグ探偵を開くコマンドが実行されました: ${projectPath}`);
					DebugDetectivePanel.createOrShow(context.extensionUri, projectPath);
				} catch (error) {
					Logger.error('デバッグ探偵を開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`デバッグ探偵を開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		Logger.info('DebugDetective command registered successfully');
		
		// モックアップギャラリーを開くコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openMockupGallery', (projectPath: string) => {
				try {
					Logger.info(`モックアップギャラリーを開くコマンドが実行されました: ${projectPath}`);
					const globalAiService = (global as any)._appgenius_ai_service;
					if (globalAiService) {
						MockupGalleryPanel.createOrShow(context.extensionUri, globalAiService, projectPath);
						Logger.info('モックアップギャラリーを正常に開きました');
					} else {
						throw new Error('AIサービスが初期化されていません');
					}
				} catch (error) {
					Logger.error('モックアップギャラリーを開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`モックアップギャラリーを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		Logger.info('MockupGallery command registered successfully');
		
		// 要件定義ビジュアライザー（SimpleChatPanel）を開くコマンドの登録
		context.subscriptions.push(
			vscode.commands.registerCommand('appgenius-ai.openSimpleChat', (projectPath?: string) => {
				try {
					Logger.info(`要件定義ビジュアライザーを開くコマンドが実行されました: ${projectPath || 'プロジェクトパスなし'}`);
					const globalAiService = (global as any)._appgenius_ai_service;
					if (globalAiService) {
						SimpleChatPanel.createOrShow(context.extensionUri, globalAiService, projectPath);
						Logger.info('要件定義ビジュアライザーを正常に開きました');
					} else {
						throw new Error('AIサービスが初期化されていません');
					}
				} catch (error) {
					Logger.error('要件定義ビジュアライザーを開く際にエラーが発生しました', error as Error);
					vscode.window.showErrorMessage(`要件定義ビジュアライザーを開けませんでした: ${(error as Error).message}`);
				}
			})
		);
		Logger.info('SimpleChat command registered successfully');
		
		// 新しいシンプル認証マネージャーの初期化（優先使用）
		const simpleAuthManager = SimpleAuthManager.getInstance(context);
		Logger.info('SimpleAuthManager initialized successfully');
		
		// シンプル認証サービスの取得
		const simpleAuthService = simpleAuthManager.getAuthService();
        // グローバル変数に保存（拡張機能全体で参照できるように）
        global._appgenius_simple_auth_service = simpleAuthService;
		
		// 重要: 新認証システムのAuthStoreと連携
		try {
			// AuthStoreインスタンスを取得
			const { AuthStore } = require('./core/auth/new/AuthStore');
			const authStore = AuthStore.getInstance(context);
			
			// 現在の認証状態を即時に同期（初期化時に実行）
			const currentState = simpleAuthService.getCurrentState();
			if (currentState.isAuthenticated) {
				authStore.setAuthenticated({
					id: currentState.userId,
					name: currentState.username,
					role: currentState.role
				}, currentState.expiresAt);
				Logger.info(`初期認証状態をAuthStoreに同期しました: 認証済み (${currentState.username})`);
			} else {
				authStore.setUnauthenticated();
				Logger.info('初期認証状態をAuthStoreに同期しました: 未認証');
			}
			
			// SimpleAuthServiceからの認証状態変更をAuthStoreに反映
			simpleAuthService.onStateChanged(state => {
				// AuthStoreの状態を更新（setStateではなくより明示的なメソッドを使用）
				if (state.isAuthenticated) {
					authStore.setAuthenticated({
						id: state.userId,
						name: state.username,
						role: state.role
					}, state.expiresAt);
				} else {
					authStore.setUnauthenticated();
				}
				
				Logger.info(`認証状態をAuthStoreに同期しました: ${state.isAuthenticated ? '認証済み' : '未認証'}`);
			});
			
			Logger.info('SimpleAuthService と AuthStore の連携を確立しました');
		} catch (error) {
			Logger.error('AuthStoreとの連携に失敗しました', error as Error);
		}
		
		// 新認証システムの初期化
		try {
			// 新認証モジュールのインポート
			const { AuthModule } = require('./core/auth/new/AuthModule');
			
			// 認証モジュールの初期化
			const authModule = AuthModule.getInstance(context);
			
			// グローバル変数に保存
			global._appgenius_auth_module = authModule;
			
			// 重要: 明示的にPermissionServiceのインスタンスも取得して確認
			const permissionService = authModule.getPermissionService();
			Logger.info(`AuthModuleのPermissionServiceインスタンスを取得: 有効=${!!permissionService}`);
			
			// PermissionManagerに明示的にPermissionServiceを設定
			try {
				const PermissionManager = require('./core/auth/PermissionManager').PermissionManager;
				// 直接内部フィールドを設定
				if (PermissionManager.instance) {
					PermissionManager.instance._permissionService = permissionService;
					Logger.info('既存のPermissionManagerインスタンスに直接PermissionServiceを設定しました');
				}
			} catch (pmError) {
				Logger.error('PermissionManagerへの設定エラー:', pmError);
			}
			
			Logger.info('New AuthModule initialized successfully');
		} catch (error) {
			Logger.warn('New AuthModule initialization failed, falling back to legacy auth system', error as Error);
		}
		Logger.info('SimpleAuthService accessed and stored in global variable successfully');
		
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
						
						// エラー発生時はダッシュボードを直接表示
						try {
							Logger.info('【デバッグ】代替手段: ダッシュボードを直接表示します');
							if (AuthGuard.checkAccess(Feature.DASHBOARD)) {
								// グローバル変数からaiServiceを取得
								const globalAiService = (global as any)._appgenius_ai_service;
								if (globalAiService) {
									DashboardPanel.createOrShow(context.extensionUri, globalAiService, { skipOnboarding: true });
									Logger.info('【デバッグ】代替手段で成功: ダッシュボードを表示しました（オンボーディング非表示）');
								} else {
									Logger.error('【デバッグ】グローバルAIサービスが見つかりません（代替手段）');
								}
							}
						} catch (directError) {
							Logger.error('【デバッグ】ダッシュボードの直接表示に失敗しました', directError as Error);
						}
					}
				}
			} catch (error) {
				Logger.error('認証状態変更リスナーでエラーが発生しました', error as Error);
			}
		});
		
		// 従来の認証サービス初期化（後方互換性のために維持）
		const tokenManager = TokenManager.getInstance(context);
		Logger.info('Legacy TokenManager initialized successfully');
		
		const authService = AuthenticationService.getInstance(context);
		Logger.info('Legacy AuthenticationService initialized successfully');
		
		// PermissionManagerの初期化（シンプル認証サービスを優先使用）
		const permissionManager = PermissionManager.getInstance(simpleAuthService);
		Logger.info('PermissionManager initialized with SimpleAuthService');
		
		// 認証コマンドの登録
		registerAuthCommands(context);
		Logger.info('Auth commands registered successfully');
		
		// プロンプトライブラリコマンドの登録
		registerPromptLibraryCommands(context);
		Logger.info('Prompt library commands registered successfully');
		
		// 環境変数管理コマンドの登録
		registerEnvironmentCommands(context);
		
		// コマンドの直接登録を確認
		vscode.commands.getCommands().then(commands => {
			const hasCommand = commands.includes('appgenius-ai.openEnvironmentVariablesAssistant');
			Logger.info(`環境変数アシスタントコマンド登録状態: ${hasCommand ? '登録済み' : '未登録'}`);
			
			// コマンドが登録されていなければ直接登録
			if (!hasCommand) {
				// 環境変数アシスタントコマンドを直接登録
				context.subscriptions.push(
					vscode.commands.registerCommand('appgenius-ai.openEnvironmentVariablesAssistant', async () => {
						Logger.info('環境変数アシスタントを開きます（直接登録されたコマンド）');
						
						try {
							// アクティブなワークスペースを取得
							let projectPath: string | undefined;
							
							if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
								projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
							}
							
							// パネルを表示
							EnvironmentVariablesAssistantPanel.createOrShow(context.extensionUri, projectPath);
						} catch (error) {
							Logger.error('環境変数アシスタントのオープンに失敗しました', error as Error);
							vscode.window.showErrorMessage(`環境変数アシスタントの表示に失敗しました: ${(error as Error).message}`);
						}
					})
				);
				Logger.info('環境変数アシスタントコマンドを直接登録しました');
			}
		});
		
		Logger.info('Environment commands registered successfully');
		
		// ClaudeCode連携コマンドの登録
		import('./commands/claudeCodeCommands').then(({ registerClaudeCodeCommands }) => {
			registerClaudeCodeCommands(context);
			Logger.info('ClaudeCode commands registered successfully');
		}).catch(error => {
			Logger.error(`ClaudeCode commands registration failed: ${(error as Error).message}`);
		});
		
		// AIServiceの初期化の重複を削除（グローバル変数で既に保存済み）
		
	} catch (error) {
		Logger.error('Authentication services initialization failed', error as Error);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
	Logger.info('AppGenius AI を終了しました');
}