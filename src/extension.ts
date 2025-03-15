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
// import { MockupDesignerPanel } from './ui/mockupDesigner/MockupDesignerPanel'; // 廃止予定
import { MockupGalleryPanel } from './ui/mockupGallery/MockupGalleryPanel';
// 開発アシスタントは削除済み
import { SimpleChatPanel } from './ui/simpleChat';
// ImplementationSelectorPanel は削除済み（スコープマネージャーに統合）
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
import { PermissionManager } from './core/auth/PermissionManager';
import { registerAuthCommands } from './core/auth/authCommands';
import { registerPromptLibraryCommands } from './commands/promptLibraryCommands';
import { registerEnvironmentCommands } from './commands/environmentCommands';
import { EnvVariablesPanel } from './ui/environmentVariables/EnvVariablesPanel';
import { AuthGuard } from './ui/auth/AuthGuard';
import { Feature } from './core/auth/roles';

// グローバル変数としてExtensionContextを保持（安全対策）
declare global {
	// eslint-disable-next-line no-var
	var __extensionContext: vscode.ExtensionContext;
}

export function activate(context: vscode.ExtensionContext) {
	// グローバルコンテキストを設定（安全対策）
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(global as any).__extensionContext = context;
	
	// ロガーの初期化（自動表示をオフにする）
	Logger.initialize('AppGenius AI', LogLevel.DEBUG, false);
	Logger.info('AppGenius AI が起動しました');
	
	// PlatformManagerの初期化
	const platformManager = PlatformManager.getInstance();
	platformManager.setExtensionContext(context);
	Logger.info('PlatformManager initialized successfully');
	
	// ScopeExporterの初期化
	ScopeExporter.getInstance();
	Logger.info('ScopeExporter initialized successfully');
	
	// 認証関連の初期化
	try {
		// TokenManagerの初期化
		TokenManager.getInstance(context);
		Logger.info('TokenManager initialized successfully');
		
		// AuthenticationServiceの初期化
		AuthenticationService.getInstance();
		Logger.info('AuthenticationService initialized successfully');
		
		// PermissionManagerの初期化
		PermissionManager.getInstance();
		Logger.info('PermissionManager initialized successfully');
		
		// 認証コマンドの登録
		registerAuthCommands(context);
		Logger.info('Auth commands registered successfully');
		
		// プロンプトライブラリコマンドの登録
		registerPromptLibraryCommands(context);
		Logger.info('Prompt library commands registered successfully');
		
		// 環境変数管理コマンドの登録
		registerEnvironmentCommands(context);
		Logger.info('Environment commands registered successfully');
		
		// ClaudeCode連携コマンドの登録
		import('./commands/claudeCodeCommands').then(({ registerClaudeCodeCommands }) => {
			registerClaudeCodeCommands(context);
			Logger.info('ClaudeCode commands registered successfully');
		}).catch(error => {
			Logger.error(`ClaudeCode commands registration failed: ${(error as Error).message}`);
		});
		
		// URLプロトコルハンドラーの登録
		context.subscriptions.push(
			vscode.window.registerUriHandler({
				handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
					if (uri.path === '/launch-claude-code') {
						try {
							// URLパラメータからプロンプトURLを取得
							const queryParams = new URLSearchParams(uri.query);
							const promptUrl = queryParams.get('url');
							
							if (promptUrl) {
								// デコードしてURLを取得
								const decodedUrl = decodeURIComponent(promptUrl);
								Logger.info(`外部URLからClaudeCodeを起動: ${decodedUrl}`);
								
								// ClaudeCodeを起動
								vscode.commands.executeCommand('appgenius.claudeCode.launchFromUrl', decodedUrl);
							} else {
								Logger.error('URLパラメータが指定されていません');
								vscode.window.showErrorMessage('URLパラメータが指定されていません');
							}
						} catch (error) {
							Logger.error(`URLプロトコルハンドリングエラー: ${(error as Error).message}`);
							vscode.window.showErrorMessage(`URLプロトコルハンドリングエラー: ${(error as Error).message}`);
						}
					}
				}
			})
		);
		Logger.info('URL protocol handler registered successfully');
	} catch (error) {
		Logger.error(`Authentication initialization failed: ${(error as Error).message}`);
	}
	
	// ToolkitManagerとToolkitUpdaterの初期化
	import('./utils/ToolkitManager').then(({ ToolkitManager }) => {
		ToolkitManager.getInstance();
		Logger.info('ToolkitManager initialized successfully');
		
		import('./utils/ToolkitUpdater').then(({ ToolkitUpdater }) => {
			const toolkitUpdater = ToolkitUpdater.getInstance();
			toolkitUpdater.setup();
			Logger.info('ToolkitUpdater initialized successfully');
		}).catch(error => {
			Logger.error(`ToolkitUpdater initialization failed: ${(error as Error).message}`);
		});
	}).catch(error => {
		Logger.error(`ToolkitManager initialization failed: ${(error as Error).message}`);
	});
	
	// デバッグモードを無効化して実際のAPIを使用する
	vscode.workspace.getConfiguration('appgeniusAI').update('debugMode', false, true);
	vscode.workspace.getConfiguration('appgeniusAI').update('useRealApi', true, true);
	Logger.info('デバッグモードが無効化されました');

	// AIサービスの初期化
	const aiService = new AIService();
	
	// MockupStorageServiceを早期に初期化（プロジェクトパスはcommandで渡す設計に変更）
	const { MockupStorageService } = require('./services/mockupStorageService');
	const mockupStorageService = MockupStorageService.getInstance();
	
	context.subscriptions.push({
		dispose: () => {
			// クリーンアップが必要な場合は追加
		}
	});
	
	// コア機能を初期化
	const projectAnalyzer = new ProjectAnalyzer();
	const codeGenerator = new CodeGenerator(aiService);
	const gitManager = new GitManager();
	
	// ステータスバーの初期化
	const statusBar = new StatusBar();
	context.subscriptions.push(statusBar);

	// ターミナルインターフェースを初期化
	const terminalInterface = TerminalInterface.getInstance(aiService);
	
	// ファイル操作マネージャーを初期化
	const fileOperationManager = FileOperationManager.getInstance();
	fileOperationManager.setTerminalInterface(terminalInterface);
	
	// コマンドハンドラーを初期化
	const commandHandler = new CommandHandler(aiService);
	context.subscriptions.push(commandHandler);

	// メインメニュー表示コマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.showMainMenu', async () => {
			try {
				const selection = await vscode.window.showQuickPick(
					[
						'APIキーを設定',
						'AppGenius ダッシュボードを開く',
						'要件定義ビジュアライザーを開く',
						'モックアップギャラリーを開く',
						'実装スコープ選択を開く',
						'スコープマネージャーを開く',
						'デバッグ探偵を開く',
						'環境変数アシスタントを開く',
						'環境変数管理を開く',
						'リファレンスマネージャーを開く',
						'プロンプトライブラリを開く'
					],
					{
						placeHolder: 'AppGenius AI メニュー'
					}
				);

				if (selection === 'APIキーを設定') {
					vscode.commands.executeCommand('appgenius-ai.setApiKey');
				} else if (selection === 'AppGenius ダッシュボードを開く') {
					vscode.commands.executeCommand('appgenius-ai.openDashboard');
				} else if (selection === '要件定義ビジュアライザーを開く') {
					vscode.commands.executeCommand('appgenius-ai.openSimpleChat');
				} else if (selection === 'モックアップギャラリーを開く') {
					vscode.commands.executeCommand('appgenius-ai.openMockupGallery');
				} else if (selection === '実装スコープ選択を開く') {
					vscode.commands.executeCommand('appgenius-ai.openImplementationSelector');
				} else if (selection === 'スコープマネージャーを開く') {
					vscode.commands.executeCommand('appgenius-ai.openScopeManager');
				} else if (selection === '開発アシスタントを開く') {
					vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
				} else if (selection === 'デバッグ探偵を開く') {
					vscode.commands.executeCommand('appgenius-ai.openDebugDetective');
				} else if (selection === '環境変数アシスタントを開く') {
					vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant');
				} else if (selection === '環境変数管理を開く') {
					vscode.commands.executeCommand('appgenius-ai.openEnvVariablesPanel');
				} else if (selection === 'リファレンスマネージャーを開く') {
					vscode.commands.executeCommand('appgenius-ai.openReferenceManager');
				} else if (selection === 'プロンプトライブラリを開く') {
					vscode.commands.executeCommand('appgenius.openPromptLibrary');
				}
			} catch (error) {
				Logger.error(`メインメニュー表示エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`メインメニュー表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// API キー設定コマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.setApiKey', async () => {
			try {
				const success = await aiService.setApiKey();
				if (success) {
					vscode.window.showInformationMessage('Claude API キーが設定されました');
				}
			} catch (error) {
				vscode.window.showErrorMessage(`API キー設定エラー: ${(error as Error).message}`);
			}
		})
	);

	// プロジェクト分析コマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.analyzeProject', async () => {
			try {
				terminalInterface.showTerminal();
				terminalInterface.processQuery("プロジェクトを分析中...");
				
				vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'プロジェクトを分析中...',
						cancellable: false
					},
					async (progress) => {
						progress.report({ increment: 0 });
						
						// プロジェクト分析
						const result = await projectAnalyzer.analyzeProject();
						
						progress.report({ increment: 50 });
						
						// 分析結果をターミナルに表示
						terminalInterface.processResult(JSON.stringify(result, null, 2));
						
						progress.report({ increment: 50 });
						
						return result;
					}
				);
			} catch (error) {
				vscode.window.showErrorMessage(`プロジェクト分析エラー: ${(error as Error).message}`);
			}
		})
	);

	// コード生成コマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.generateCode', async () => {
			try {
				const query = await vscode.window.showInputBox({
					prompt: '生成するコードの説明を入力してください',
					placeHolder: '例: React コンポーネントを作成して...'
				});
				
				if (query) {
					terminalInterface.showTerminal();
					terminalInterface.processQuery(query);
					
					vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: 'コードを生成中...',
							cancellable: false
						},
						async (progress) => {
							progress.report({ increment: 0 });
							
							// コード生成
							const options: {
								language: string;
								description: string;
							} = {
								language: "javascript",
								description: query
							};
							const result = await codeGenerator.generateCode(options);
							
							progress.report({ increment: 100 });
							
							// 生成結果をターミナルに表示
							terminalInterface.processResult(JSON.stringify(result, null, 2));
							
							return result;
						}
					);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`コード生成エラー: ${(error as Error).message}`);
			}
		})
	);
	
	// Git 操作コマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.executeGitCommand', async () => {
			try {
				const command = await vscode.window.showInputBox({
					prompt: '実行する Git コマンドを入力してください',
					placeHolder: '例: git status'
				});
				
				if (command) {
					terminalInterface.showTerminal();
					terminalInterface.processQuery(command);
					
					// Git コマンド実行
					const result = await gitManager.executeCommand(command);
					
					// 実行結果をターミナルに表示
					terminalInterface.processResult(JSON.stringify(result, null, 2));
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Git コマンド実行エラー: ${(error as Error).message}`);
			}
		})
	);

	// ダッシュボードを開くコマンド（権限チェック付き）
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openDashboard', () => {
			try {
				// 権限チェック済みの基底クラスメソッドを呼び出す
				DashboardPanel.createOrShow(context.extensionUri, aiService);
			} catch (error) {
				vscode.window.showErrorMessage(`ダッシュボード表示エラー: ${(error as Error).message}`);
			}
		})
	);
	
	// 拡張機能起動時に自動でダッシュボードを開く（権限チェック付き）
	// ゲストユーザーもダッシュボードは閲覧可能
	if (AuthGuard.checkAccess(Feature.DASHBOARD)) {
		DashboardPanel.createOrShow(context.extensionUri, aiService);
	}

	// Claude MD エディタを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openClaudeMdEditor', () => {
			try {
				ClaudeMdEditorPanel.createOrShow(context.extensionUri);
			} catch (error) {
				vscode.window.showErrorMessage(`Claude MD エディタ表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// モックアップギャラリーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openMockupGallery', (projectPath?: string) => {
			try {
				Logger.info(`モックアップギャラリーを開きます: ${projectPath || 'プロジェクトパスなし'}`);
				// 権限チェックを行う
				if (AuthGuard.checkAccess(Feature.MOCKUP_GALLERY)) {
					MockupGalleryPanel.createOrShow(context.extensionUri, aiService, projectPath);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`モックアップギャラリー表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// スコープマネージャーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openScopeManager', (providedProjectPath?: string) => {
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
					}
				}
				
				// パスが有効かログ出力
				Logger.debug(`スコープマネージャーパネル起動: projectPath=${projectPath}`);
				// 詳細なデバッグ情報
				Logger.info(`[Debug] スコープマネージャーコマンド: 引数=${providedProjectPath}, 使用パス=${projectPath}`);
				
				// 権限チェックを行う
				if (AuthGuard.checkAccess(Feature.SCOPE_MANAGER)) {
					ScopeManagerPanel.createOrShow(context.extensionUri, projectPath);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`スコープマネージャー表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// 要件定義チャットを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openSimpleChat', (projectPath?: string) => {
			try {
				SimpleChatPanel.createOrShow(context.extensionUri, aiService, projectPath);
			} catch (error) {
				vscode.window.showErrorMessage(`要件定義チャット表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// デバッグ探偵を開くコマンド
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
					}
				}
				
				// パスが有効かログ出力
				Logger.debug(`デバッグ探偵パネル起動: projectPath=${projectPath}`);
				
				DebugDetectivePanel.createOrShow(context.extensionUri, projectPath);
			} catch (error) {
				vscode.window.showErrorMessage(`デバッグ探偵表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// 環境変数アシスタントを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openEnvironmentVariablesAssistant', (providedProjectPath?: string) => {
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
					}
				}
				
				// パスが有効かログ出力
				Logger.debug(`環境変数アシスタントパネル起動: projectPath=${projectPath}`);
				
				// 権限チェックを行う
				if (AuthGuard.checkAccess(Feature.ENV_ASSISTANT)) {
					EnvironmentVariablesAssistantPanel.createOrShow(context.extensionUri, projectPath);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`環境変数アシスタント表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// リファレンスマネージャーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openReferenceManager', async (providedProjectPath?: string) => {
			try {
				// ダイナミックインポートで遅延ロード
				const { ReferenceManagerPanel } = await import('./ui/referenceManager/ReferenceManagerPanel');
				
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
					}
				}
				
				// パスが有効かログ出力
				Logger.debug(`リファレンスマネージャーパネル起動: projectPath=${projectPath}`);
					
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
					}
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
					}
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
					// 権限チェックを行う
					if (AuthGuard.checkAccess(Feature.REFERENCE_MANAGER)) {
						ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
					}
			} catch (error) {
				vscode.window.showErrorMessage(`リファレンスマネージャー表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// ワークスペースルートのCurrentStatusを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openCurrentStatus', async () => {
			try {
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
					const currentStatusPath = path.join(workspaceRoot, 'docs', 'CURRENT_STATUS.md');
					
					const currentStatusUri = vscode.Uri.file(currentStatusPath);
					await vscode.commands.executeCommand('vscode.open', currentStatusUri);
				} else {
					vscode.window.showErrorMessage('ワークスペースが開かれていません');
				}
			} catch (error) {
				vscode.window.showErrorMessage(`CurrentStatus表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// サーフコマンド設定コマンド (Claude Code CLI 連携)
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.configureSurfCommand', async () => {
			try {
				const { ToolkitManager } = await import('./utils/ToolkitManager');
				const toolkitManager = ToolkitManager.getInstance();
				const result = await toolkitManager.configureSurfCommand();
				
				if (result.success) {
					vscode.window.showInformationMessage('surf コマンドが正常に設定されました');
				} else {
					vscode.window.showErrorMessage(`surf コマンド設定エラー: ${result.message}`);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`surf コマンド設定エラー: ${(error as Error).message}`);
			}
		})
	);
	
	// ClaudeCode連携UI
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius.openClaudeCodePanel', () => {
			try {
				const { ClaudeCodePanel } = require('./ui/claudeCode/ClaudeCodePanel');
				ClaudeCodePanel.createOrShow(context.extensionUri);
			} catch (error) {
				vscode.window.showErrorMessage(`ClaudeCode連携表示エラー: ${(error as Error).message}`);
			}
		})
	);

	// 環境変数パネルコマンドはcommands/environmentCommands.tsで登録されているため
	// ここでの重複登録は削除

	Logger.info('AppGenius AI の初期化が完了しました');
}

// this method is called when your extension is deactivated
export function deactivate() {
	Logger.info('AppGenius AI を終了しました');
}