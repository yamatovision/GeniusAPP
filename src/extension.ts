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

export function activate(context: vscode.ExtensionContext) {
	// ロガーの初期化
	Logger.initialize('AppGenius AI', LogLevel.DEBUG);
	Logger.info('AppGenius AI が起動しました');
	
	// PlatformManagerの初期化
	const platformManager = PlatformManager.getInstance();
	platformManager.setExtensionContext(context);
	Logger.info('PlatformManager initialized successfully');
	
	// ScopeExporterの初期化
	ScopeExporter.getInstance();
	Logger.info('ScopeExporter initialized successfully');
	
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
						'リファレンスマネージャーを開く'
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
				} else if (selection === 'リファレンスマネージャーを開く') {
					vscode.commands.executeCommand('appgenius-ai.openReferenceManager');
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
						
						const analysis = await projectAnalyzer.analyzeProject();
						
						progress.report({ increment: 100 });
						
						// 分析結果を表示
						let resultMessage = `
プロジェクト分析結果:
- ファイル数: ${analysis.stats.totalFiles}
- ディレクトリ数: ${analysis.stats.totalDirectories}
- 推定コード行数: ${analysis.stats.lineCount}

言語別ファイル数:
${Object.entries(analysis.stats.languageBreakdown)
	.sort(([, a], [, b]) => (b as number) - (a as number))
	.map(([lang, count]) => `- ${lang}: ${count}`)
	.join('\n')}
`;
						
						// 分析結果をターミナルに表示
						terminalInterface.processQuery(resultMessage);
					}
				);
			} catch (error) {
				vscode.window.showErrorMessage(`プロジェクト分析エラー: ${(error as Error).message}`);
			}
		})
	);

	// ファイル作成コマンド（ターミナルからの自動実行用）
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.createFile', async (filePath: string, content: string) => {
			await fileOperationManager.createFile(filePath, content);
		})
	);
	
	// ファイル更新コマンド（ターミナルからの自動実行用）
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.updateFile', async (filePath: string, oldContent: string, newContent: string) => {
			await fileOperationManager.updateFile(filePath, oldContent, newContent);
		})
	);
	
	// ファイル削除コマンド（ターミナルからの自動実行用）
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.deleteFile', async (filePath: string) => {
			await fileOperationManager.deleteFile(filePath);
		})
	);

	// ウェルカムメッセージ表示コマンド - 削除済み
	
	// ダッシュボードを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openDashboard', () => {
			try {
				Logger.info('ダッシュボードを開きます');
				DashboardPanel.createOrShow(context.extensionUri, aiService);
			} catch (error) {
				Logger.error(`ダッシュボード起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`ダッシュボードの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);

	// コマンドが登録されたことを確認するためにログ出力
	const commands = vscode.commands.getCommands();
	commands.then(commandList => {
		const appGeniusCommands = commandList.filter(cmd => cmd.startsWith('appgenius-ai.'));
		Logger.info(`AppGenius AI コマンド一覧: ${appGeniusCommands.join(', ')}`);
	});

	// APIキーの確認（環境変数からの読み込みは自動的に試みられる）
	if (!aiService.hasApiKey()) {
		// API キーが設定されていない場合は通知
		vscode.window.showWarningMessage(
			'Claude API キーが設定されていません。再試行します。',
			'API キーを設定'
		).then(selection => {
			if (selection === 'API キーを設定') {
				vscode.commands.executeCommand('appgenius-ai.setApiKey');
			}
		});
		
		// 環境変数からの自動ロードを試みる
		setTimeout(async () => {
			// 少し待ってからAPIキーの存在を再確認
			if (!aiService.hasApiKey()) {
				try {
					// APIキーを設定ファイルから再ロード
					const success = await aiService.setApiKey();
					if (success) {
						Logger.info('API キーを設定しました');
						vscode.window.showInformationMessage('Claude API キーが設定されました');
					} else {
						// ユーザーが入力をキャンセルした場合
						Logger.warn('API キーの設定がキャンセルされました');
					}
				} catch (error) {
					Logger.error(`API キーの設定中にエラー: ${(error as Error).message}`);
				}
			} else {
				// 自動的にAPIキーが読み込まれた場合
				Logger.info('API キーが自動的に設定されました');
				vscode.window.showInformationMessage('Claude API キーが自動的に設定されました');
			}
		}, 1000);
	}

	// モックアップデザイナーを開くコマンド（廃止予定）
	/* 
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openMockupDesigner', () => {
			try {
				Logger.info('モックアップデザイナーを開きます');
				MockupDesignerPanel.createOrShow(context.extensionUri, aiService);
			} catch (error) {
				Logger.error(`モックアップデザイナー起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`モックアップデザイナーの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	*/
	
	// モックアップギャラリーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openMockupEditor', (mockupId?: string, projectPath?: string) => {
			try {
				Logger.info('モックアップギャラリーを開きます');
				
				if (mockupId) {
					// 特定のモックアップを開く
					MockupGalleryPanel.openWithMockup(context.extensionUri, aiService, mockupId, projectPath);
				} else {
					// 通常のモックアップギャラリーを開く
					MockupGalleryPanel.createOrShow(context.extensionUri, aiService, projectPath);
				}
			} catch (error) {
				Logger.error(`モックアップギャラリー起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`モックアップギャラリーの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);


	// 要件定義ビジュアライザーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openSimpleChat', (projectPath?: string) => {
			try {
				Logger.info('要件定義ビジュアライザーを開きます');
				if (projectPath) {
					Logger.info(`プロジェクトパス指定あり: ${projectPath}`);
				}
				SimpleChatPanel.createOrShow(context.extensionUri, aiService, projectPath);
			} catch (error) {
				Logger.error(`要件定義ビジュアライザー起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`要件定義ビジュアライザーの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	
	// 実装スコープ選択コマンドは削除済み（スコープマネージャーに統合）

	// ディレクトリ構造取得コマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.getDirectoryStructure', async () => {
			try {
				// ワークスペースのルートパスを取得
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (!workspaceFolders) {
					return 'ワークスペースが開かれていません';
				}
				
				const rootPath = workspaceFolders[0].uri.fsPath;
				
				// プロジェクト分析器を使用してディレクトリ構造を取得
				Logger.info('ディレクトリ構造を取得します');
				const structure = await projectAnalyzer.analyzeProject();
				
				// 簡易表示用の文字列を生成
				let structureText = `プロジェクトディレクトリ構造:\n${rootPath}\n\n`;
				structureText += `言語別ファイル数:\n`;
				
				Object.entries(structure.stats.languageBreakdown)
					.sort(([, a], [, b]) => (b as number) - (a as number))
					.forEach(([lang, count]) => {
						structureText += `- ${lang}: ${count}\n`;
					});
					
				structureText += `\n主要ディレクトリ:\n`;
				// ディレクトリ情報が存在する場合のみ処理
				if (structure.directories && Array.isArray(structure.directories)) {
					structure.directories.slice(0, 10).forEach((dir: string) => {
						structureText += `- ${dir}\n`;
					});
				}
				
				return structureText;
			} catch (error) {
				Logger.error(`ディレクトリ構造取得エラー: ${(error as Error).message}`);
				return `ディレクトリ構造の取得に失敗しました: ${(error as Error).message}`;
			}
		})
	);

	// ウェルカムメッセージは削除済み
	
	// リファレンスマネージャーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openReferenceManager', async () => {
			try {
				// 現在のワークスペースパスを取得
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (!workspaceFolders) {
					vscode.window.showErrorMessage('プロジェクトが開かれていません');
					return;
				}
				const workspacePath = workspaceFolders[0].uri.fsPath;
				
				// パネルを作成
				const { ReferenceManagerPanel } = await import('./ui/referenceManager/ReferenceManagerPanel');
				ReferenceManagerPanel.createOrShow(context.extensionUri, workspacePath);
				Logger.info('リファレンスマネージャーを起動しました');
			} catch (error) {
				Logger.error('リファレンスマネージャーの起動に失敗しました', error as Error);
				vscode.window.showErrorMessage(`リファレンスマネージャーの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	
	// ツールキットダッシュボードを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openToolkitDashboard', async () => {
			try {
				const { ToolkitManager } = await import('./utils/ToolkitManager');
				const toolkitManager = ToolkitManager.getInstance();
				
				// ダッシュボードの更新
				await toolkitManager.updateDashboard();
				
				// 拡張機能のパスを取得
				const platformManager = PlatformManager.getInstance();
				const extensionPath = platformManager.getExtensionPath();
				const dashboardPath = path.join(extensionPath, 'toolkit-dashboard.html');
				
				// ファイルURI形式に変換
				const dashboardUri = vscode.Uri.file(dashboardPath);
				
				// ブラウザで開く
				vscode.env.openExternal(dashboardUri);
				
				Logger.info('ツールキットダッシュボードを起動しました');
			} catch (error) {
				Logger.error('ツールキットダッシュボードの起動に失敗しました', error as Error);
				vscode.window.showErrorMessage(`ツールキットダッシュボードの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	
	// ツールキットを更新するコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.updateToolkit', async () => {
			try {
				const { ToolkitUpdater, UpdateStatus } = await import('./utils/ToolkitUpdater');
				const toolkitUpdater = ToolkitUpdater.getInstance();
				
				// ツールキットの更新
				const result = await toolkitUpdater.updateToolkit();
				
				if (result.status === UpdateStatus.COMPLETED) {
					vscode.window.showInformationMessage('ツールキットの更新が完了しました');
				} else if (result.status === UpdateStatus.FAILED) {
					vscode.window.showErrorMessage(`ツールキットの更新に失敗しました: ${result.errorMessage || '不明なエラー'}`);
				}
				
				Logger.info(`ツールキット更新結果: ${result.status}`);
			} catch (error) {
				Logger.error('ツールキットの更新に失敗しました', error as Error);
				vscode.window.showErrorMessage(`ツールキットの更新に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	
	// ツールキットの整合性を検証するコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.validateToolkit', async () => {
			try {
				const { ToolkitManager } = await import('./utils/ToolkitManager');
				const toolkitManager = ToolkitManager.getInstance();
				
				// 依存関係の分析
				const result = toolkitManager.analyzeDependencies();
				
				// 結果表示
				let message = '';
				
				if (result.missingDependencies.length > 0) {
					message += `見つからない依存関係: ${result.missingDependencies.join(', ')}\n`;
				}
				
				if (result.circularDependencies.length > 0) {
					message += `循環依存関係: ${result.circularDependencies.join(', ')}\n`;
				}
				
				if (result.outdatedDependencies.length > 0) {
					message += `古い依存関係: ${result.outdatedDependencies.join(', ')}\n`;
				}
				
				if (message === '') {
					vscode.window.showInformationMessage('ツールキットの整合性検証に成功しました。問題は見つかりませんでした。');
				} else {
					// 詳細メッセージをアウトプットパネルに表示
					const outputChannel = vscode.window.createOutputChannel('AppGenius ツールキット検証');
					outputChannel.clear();
					outputChannel.appendLine('# ツールキット整合性検証結果');
					outputChannel.appendLine(message);
					outputChannel.show();
					
					vscode.window.showWarningMessage('ツールキットの整合性検証で問題が見つかりました。詳細はアウトプットパネルをご確認ください。');
				}
				
				Logger.info('ツールキットの整合性検証が完了しました');
			} catch (error) {
				Logger.error('ツールキットの整合性検証に失敗しました', error as Error);
				vscode.window.showErrorMessage(`ツールキットの整合性検証に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	
	// スコープマネージャーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openScopeManager', (projectPath?: string) => {
			try {
				Logger.info('スコープマネージャーを開きます');
				if (projectPath) {
					Logger.info(`プロジェクトパス指定あり: ${projectPath}`);
				}
				ScopeManagerPanel.createOrShow(context.extensionUri, projectPath);
			} catch (error) {
				Logger.error(`スコープマネージャー起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`スコープマネージャーの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	
	// デバッグ探偵を開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openDebugDetective', (projectPath?: string) => {
			try {
				Logger.info('デバッグ探偵を開きます');
				
				// プロジェクトパスの取得
				if (!projectPath) {
					// アクティブなプロジェクトを確認
					const projectService = ProjectManagementService.getInstance();
					const activeProject = projectService.getActiveProject();
					
					if (activeProject && activeProject.path) {
						projectPath = activeProject.path;
						Logger.info(`アクティブプロジェクトのパスを使用: ${projectPath}`);
					} else {
						// ワークスペースのパスを使用
						const workspaceFolders = vscode.workspace.workspaceFolders;
						if (workspaceFolders && workspaceFolders.length > 0) {
							projectPath = workspaceFolders[0].uri.fsPath;
							Logger.info(`ワークスペースのパスを使用: ${projectPath}`);
						} else {
							throw new Error('プロジェクトパスが指定されていません。ダッシュボードからプロジェクトを選択してください。');
						}
					}
				} else {
					Logger.info(`プロジェクトパス指定あり: ${projectPath}`);
				}
				
				// デバッグ探偵パネルを表示
				DebugDetectivePanel.createOrShow(context.extensionUri, projectPath);
			} catch (error) {
				Logger.error(`デバッグ探偵起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`デバッグ探偵の起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);

	// 環境変数アシスタントを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openEnvironmentVariablesAssistant', (projectPath?: string) => {
			try {
				Logger.info('環境変数アシスタントを開きます');
				
				// プロジェクトパスの取得
				if (!projectPath) {
					// アクティブなプロジェクトを確認
					const projectService = ProjectManagementService.getInstance();
					const activeProject = projectService.getActiveProject();
					
					if (activeProject && activeProject.path) {
						projectPath = activeProject.path;
						Logger.info(`アクティブプロジェクトのパスを使用: ${projectPath}`);
					} else {
						// ワークスペースのパスを使用
						const workspaceFolders = vscode.workspace.workspaceFolders;
						if (workspaceFolders && workspaceFolders.length > 0) {
							projectPath = workspaceFolders[0].uri.fsPath;
							Logger.info(`ワークスペースのパスを使用: ${projectPath}`);
						} else {
							throw new Error('プロジェクトパスが指定されていません。ダッシュボードからプロジェクトを選択してください。');
						}
					}
				} else {
					Logger.info(`プロジェクトパス指定あり: ${projectPath}`);
				}
				
				// 環境変数アシスタントパネルを表示
				EnvironmentVariablesAssistantPanel.createOrShow(context.extensionUri, projectPath);
			} catch (error) {
				Logger.error(`環境変数アシスタント起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`環境変数アシスタントの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);

	// AppGeniusEventBusとStateManagerを初期化
	try {
		// AppGeniusEventBusを初期化
		import('./services/AppGeniusEventBus').then(({ AppGeniusEventBus }) => {
			AppGeniusEventBus.getInstance();
			Logger.info('AppGeniusEventBus initialized successfully');
		});
		
		// AppGeniusStateManagerを初期化
		import('./services/AppGeniusStateManager').then(({ AppGeniusStateManager }) => {
			AppGeniusStateManager.getInstance();
			Logger.info('AppGeniusStateManager initialized successfully');
		});
		
		// ClaudeCode関連サービスの初期化
		const isClaudeCodeEnabled = vscode.workspace.getConfiguration('appgeniusAI').get<boolean>('enableClaudeCode', true);
		if (isClaudeCodeEnabled) {
			// ClaudeCodeLauncherServiceを初期化
			import('./services/ClaudeCodeLauncherService').then(({ ClaudeCodeLauncherService }) => {
				ClaudeCodeLauncherService.getInstance();
				Logger.info('ClaudeCodeLauncherService initialized successfully');
			});
			
			// CLI起動コマンドを登録（ClaudeCodeを起動）
			context.subscriptions.push(
				vscode.commands.registerCommand('appgenius-ai.launchCli', async () => {
					try {
						// 現在のプロジェクトIDを取得
						const projectId = vscode.workspace.getConfiguration('appgeniusAI').get<string>('currentProjectId');
						
						if (!projectId) {
							vscode.window.showWarningMessage('プロジェクトが選択されていません。先にダッシュボードからプロジェクトを選択してください。');
							return;
						}
						
						// ステートマネージャーとClaudeCodeランチャーを動的にロード
						const { AppGeniusStateManager } = await import('./services/AppGeniusStateManager');
						const { ClaudeCodeLauncherService } = await import('./services/ClaudeCodeLauncherService');
						
						const stateManager = AppGeniusStateManager.getInstance();
						const claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
						
						// 実装スコープを取得
						const scope = await stateManager.getImplementationScope(projectId);
						
						if (!scope) {
							vscode.window.showWarningMessage('実装スコープが設定されていません。先に実装スコープを選択してください。');
							return;
						}
						
						// ClaudeCodeを起動
						const success = await claudeCodeLauncher.launchClaudeCode(scope);
						
						if (success) {
							vscode.window.showInformationMessage('ClaudeCodeを起動しました');
						}
					} catch (error) {
						Logger.error('ClaudeCodeの起動に失敗しました', error as Error);
						vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
					}
				})
			);
			
			// CLI停止コマンドを登録（ClaudeCodeをリセット）
			context.subscriptions.push(
				vscode.commands.registerCommand('appgenius-ai.stopCli', async () => {
					try {
						const { ClaudeCodeLauncherService } = await import('./services/ClaudeCodeLauncherService');
						const claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
						
						// resetStatusメソッドを使用
						claudeCodeLauncher.resetStatus();
						vscode.window.showInformationMessage('ClaudeCodeの状態をリセットしました');
					} catch (error) {
						Logger.error('ClaudeCodeの停止に失敗しました', error as Error);
						vscode.window.showErrorMessage(`ClaudeCodeの停止に失敗しました: ${(error as Error).message}`);
					}
				})
			);
			
			// CLI進捗表示コマンドを登録（ClaudeCodeの進捗表示）
			context.subscriptions.push(
				vscode.commands.registerCommand('appgenius-ai.showCliProgress', async () => {
					try {
						vscode.window.showInformationMessage('ClaudeCodeの進捗状況をVSCode上で表示します');
						
						// ステータスの取得
						const { ClaudeCodeLauncherService } = await import('./services/ClaudeCodeLauncherService');
						const claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
						
						const status = claudeCodeLauncher.getStatus();
						vscode.window.showInformationMessage(`現在のClaudeCode状態: ${status}`);
					} catch (error) {
						Logger.error('ClaudeCode進捗表示に失敗しました', error as Error);
						vscode.window.showErrorMessage(`ClaudeCode進捗表示に失敗しました: ${(error as Error).message}`);
					}
				})
			);
		}
	} catch (error) {
		Logger.error(`Failed to initialize AppGenius services: ${(error as Error).message}`);
	}
	
	// 起動時に自動的にターミナルを表示（遅延させて他の初期化が完了してから実行）
	const shouldAutoStart = vscode.workspace.getConfiguration('appgeniusAI').get('autoStartTerminal', true);
	if (shouldAutoStart) {
		Logger.debug('自動起動設定が有効です。ターミナルを表示します。');
		setTimeout(() => {
			try {
				statusBar.update('Active');
				vscode.commands.executeCommand('appgenius-ai.showTerminal');
				Logger.info('AppGenius AI ターミナルを自動的に表示しました');
			} catch (error) {
				Logger.error(`ターミナル自動表示中にエラーが発生: ${(error as Error).message}`);
			}
		}, 1500);
	}
	
	// 拡張機能起動時、ダッシュボードを自動的に開くオプション
	const shouldAutoOpenDashboard = vscode.workspace.getConfiguration('appgeniusAI').get('autoOpenDashboard', true);
	if (shouldAutoOpenDashboard) {
		Logger.debug('ダッシュボード自動起動設定が有効です。ダッシュボードを表示します。');
		setTimeout(() => {
			try {
				vscode.commands.executeCommand('appgenius-ai.openDashboard');
				Logger.info('ダッシュボードを自動的に表示しました');
			} catch (error) {
				Logger.error(`ダッシュボード自動表示中にエラーが発生: ${(error as Error).message}`);
			}
		}, 2000); // ターミナル表示の後に遅延して実行
	}
}

export function deactivate() {
	Logger.info('AppGenius AI が停止しました');
	
	// ClaudeCode関連サービスの停止
	try {
		import('./services/ClaudeCodeLauncherService').then(({ ClaudeCodeLauncherService }) => {
			try {
				ClaudeCodeLauncherService.getInstance().dispose();
				Logger.info('ClaudeCodeLauncherService disposed successfully');
			} catch (e) {
				// 既に破棄されている可能性があるため、エラーは無視
			}
		}).catch(() => {
			// モジュールロードエラーは無視
		});
	} catch (error) {
		// 終了処理のエラーは無視
	}
	
	Logger.dispose();
}