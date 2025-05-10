import * as vscode from 'vscode';
import { MarkdownViewerPanel } from '../ui/markdownViewer/MarkdownViewerPanel';
import { Logger } from '../utils/logger';

/**
 * マークダウンビューワー関連のコマンド登録
 * @param context 拡張機能のコンテキスト
 */
export function registerMarkdownViewerCommands(context: vscode.ExtensionContext): void {
  // マークダウンビューワーを開くコマンド (パレット表示用)
  const openMarkdownViewerFromPaletteCommand = vscode.commands.registerCommand(
    'appgenius.openMarkdownViewerFromPalette',
    async () => {
      try {
        Logger.info('コマンドパレットからマークダウンビューワーを開きます');

        // ワークスペースフォルダがある場合はそれを使用
        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
          projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        // マークダウンビューワーを直接開く
        MarkdownViewerPanel.createOrShow(context.extensionUri);

        Logger.info('コマンドパレットからマークダウンビューワーを開きました');
        vscode.window.showInformationMessage('マークダウンビューワーを開きました');
      } catch (error) {
        Logger.error('コマンドパレットからマークダウンビューワーを開く際にエラーが発生しました', error as Error);
        vscode.window.showErrorMessage('マークダウンビューワーを開けませんでした');
      }
    }
  );

  // 通常のマークダウンビューワーを開くコマンド (内部使用)
  const openMarkdownViewerCommand = vscode.commands.registerCommand(
    'appgenius.openMarkdownViewer',
    (projectPath?: string) => {
      try {
        // デバッグログを追加
        Logger.info(`マークダウンビューワーを開く: コマンド実行開始 (projectPath=${projectPath || 'なし'})`);

        // マークダウンビューワーを開く (プロジェクトパスを設定)
        const panel = MarkdownViewerPanel.createOrShow(context.extensionUri);

        // プロジェクトパスが指定されている場合は、そのパスを設定
        if (projectPath && panel) {
          Logger.info(`マークダウンビューワーを開くコマンドがプロジェクトパス付きで実行されました: ${projectPath}`);
          // 明示的にパネル側のprojectPathを設定 (関数を公開する必要あり)
          if (typeof panel.setCurrentProjectPath === 'function') {
            panel.setCurrentProjectPath(projectPath);
          }
        } else {
          Logger.info('マークダウンビューワーを開くコマンドが実行されました');
        }
      } catch (error) {
        Logger.error('マークダウンビューワーを開く際にエラーが発生しました', error as Error);
        // 無限ループ防止のため特定のクライアントエラーメッセージのみ送信
        const isScopeManagerActive = vscode.window.visibleTextEditors.some(
          editor => editor.document.fileName.includes('scopeManager')
        );
        if (!isScopeManagerActive) {
          vscode.window.showErrorMessage('マークダウンビューワーを開けませんでした: VSCode API通信エラー');
        } else {
          Logger.warn('ScopeManagerがアクティブなため、エラーメッセージ表示を抑制しました');
        }
      }
    }
  );

  // マークダウンファイルをビューワーで開くコマンド
  const openMarkdownFileCommand = vscode.commands.registerCommand(
    'appgenius.openMarkdownFile',
    (uri: vscode.Uri) => {
      try {
        const panel = MarkdownViewerPanel.createOrShow(context.extensionUri);
        // パネルが初期化された後にファイルを開くためのメッセージを送信
        setTimeout(() => {
          vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }, 300);
        Logger.info(`マークダウンファイルをビューワーで開くコマンドが実行されました: ${uri.fsPath}`);
      } catch (error) {
        Logger.error(`マークダウンファイルを開く際にエラーが発生しました: ${uri.fsPath}`, error as Error);
        // 無限ループ防止のため特定のクライアントエラーメッセージのみ送信
        const isScopeManagerActive = vscode.window.visibleTextEditors.some(
          editor => editor.document.fileName.includes('scopeManager')
        );
        if (!isScopeManagerActive) {
          vscode.window.showErrorMessage('マークダウンファイルを開けませんでした: VSCode API通信エラー');
        } else {
          Logger.warn('ScopeManagerがアクティブなため、エラーメッセージ表示を抑制しました');
        }
      }
    }
  );

  // コマンドをコンテキストに登録
  context.subscriptions.push(openMarkdownViewerFromPaletteCommand);
  context.subscriptions.push(openMarkdownViewerCommand);
  context.subscriptions.push(openMarkdownFileCommand);
}