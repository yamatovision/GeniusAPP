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
import { MockupDesignerPanel } from './ui/mockupDesigner/MockupDesignerPanel';
import { SimpleMockupEditorPanel } from './ui/mockupEditor/SimpleMockupEditorPanel';
import { DevelopmentAssistantPanel } from './ui/developmentAssistant/DevelopmentAssistantPanel';
import { SimpleChatPanel } from './ui/simpleChat';
import { ImplementationSelectorPanel } from './ui/implementationSelector/ImplementationSelectorPanel';

export function activate(context: vscode.ExtensionContext) {
	// ロガーの初期化
	Logger.initialize('AppGenius AI', LogLevel.DEBUG);
	Logger.info('AppGenius AI が起動しました');
	
	// デバッグモードを無効化して実際のAPIを使用する
	vscode.workspace.getConfiguration('appgeniusAI').update('debugMode', false, true);
	vscode.workspace.getConfiguration('appgeniusAI').update('useRealApi', true, true);
	Logger.info('デバッグモードが無効化されました');

	// AIサービスの初期化
	const aiService = new AIService();
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
						'要件定義ビジュアライザーを開く',
						'モックアップエディターを開く',
						'実装スコープ選択を開く',
						'開発アシスタントを開く'
					],
					{
						placeHolder: 'AppGenius AI メニュー'
					}
				);

				if (selection === 'APIキーを設定') {
					vscode.commands.executeCommand('appgenius-ai.setApiKey');
				} else if (selection === '要件定義ビジュアライザーを開く') {
					vscode.commands.executeCommand('appgenius-ai.openSimpleChat');
				} else if (selection === 'モックアップエディターを開く') {
					vscode.commands.executeCommand('appgenius-ai.openMockupEditor');
				} else if (selection === '実装スコープ選択を開く') {
					vscode.commands.executeCommand('appgenius-ai.openImplementationSelector');
				} else if (selection === '開発アシスタントを開く') {
					vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
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

	// ウェルカムメッセージ表示コマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.showWelcomeMessage', () => {
			vscode.window.showInformationMessage('AppGenius AI へようこそ！Ctrl+Shift+P を押して "AppGenius AI: コマンドを実行" を選択してください。');
			Logger.info('ウェルカムメッセージを表示しました');
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

	// モックアップデザイナーを開くコマンド
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
	
	// モックアップエディターを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openMockupEditor', (mockupId?: string) => {
			try {
				Logger.info('モックアップエディターを開きます');
				if (mockupId) {
					// 特定のモックアップを開く
					SimpleMockupEditorPanel.openWithMockup(context.extensionUri, aiService, mockupId);
				} else {
					// 通常のモックアップエディターを開く
					SimpleMockupEditorPanel.createOrShow(context.extensionUri, aiService);
				}
			} catch (error) {
				Logger.error(`モックアップエディター起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`モックアップエディターの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);

	// 開発アシスタントを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openDevelopmentAssistant', () => {
			try {
				Logger.info('開発アシスタントを開きます');
				DevelopmentAssistantPanel.createOrShow(context.extensionUri, aiService);
			} catch (error) {
				Logger.error(`開発アシスタント起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`開発アシスタントの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);

	// 要件定義ビジュアライザーを開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openSimpleChat', () => {
			try {
				Logger.info('要件定義ビジュアライザーを開きます');
				SimpleChatPanel.createOrShow(context.extensionUri, aiService);
			} catch (error) {
				Logger.error(`要件定義ビジュアライザー起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`要件定義ビジュアライザーの起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);
	
	// 実装スコープ選択を開くコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('appgenius-ai.openImplementationSelector', () => {
			try {
				Logger.info('実装スコープ選択を開きます');
				ImplementationSelectorPanel.createOrShow(context.extensionUri, aiService);
			} catch (error) {
				Logger.error(`実装スコープ選択起動エラー: ${(error as Error).message}`);
				vscode.window.showErrorMessage(`実装スコープ選択の起動に失敗しました: ${(error as Error).message}`);
			}
		})
	);

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

	// 拡張機能起動時にウェルカムメッセージを表示
	vscode.window.showInformationMessage(
		'AppGenius AI が起動しました。Ctrl+Shift+P を押して "AppGenius AI: コマンドを実行" を選択して開始してください。',
		'APIキーを設定',
		'要件定義ビジュアライザーを開く',
		'モックアップエディターを開く',
		'実装スコープ選択を開く',
		'開発アシスタントを開く'
	).then(selection => {
		if (selection === 'APIキーを設定') {
			vscode.commands.executeCommand('appgenius-ai.setApiKey');
		} else if (selection === "要件定義ビジュアライザーを開く") {
			vscode.commands.executeCommand('appgenius-ai.openSimpleChat');
		} else if (selection === "モックアップエディターを開く") {
			vscode.commands.executeCommand('appgenius-ai.openMockupEditor');
		} else if (selection === '実装スコープ選択を開く') {
			vscode.commands.executeCommand('appgenius-ai.openImplementationSelector');
		} else if (selection === '開発アシスタントを開く') {
			vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
		}
	});
	
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
}

export function deactivate() {
	Logger.info('AppGenius AI が停止しました');
	Logger.dispose();
}