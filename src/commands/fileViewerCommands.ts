import * as vscode from 'vscode';
import { FileViewerPanel } from '../ui/fileViewer/FileViewerPanel';
import { Logger } from '../utils/logger';

/**
 * ファイルビューワー関連のコマンド登録
 * @param context 拡張機能のコンテキスト
 */
export function registerFileViewerCommands(context: vscode.ExtensionContext): void {
  // ファイルビューワーを開くコマンド (パレット表示用)
  const openFileViewerFromPaletteCommand = vscode.commands.registerCommand(
    'appgenius.openFileViewerFromPalette',
    async () => {
      try {
        Logger.info('コマンドパレットからファイルビューワーを開きます');

        // 現在のアクティブなプロジェクトパスを取得
        let projectPath = '';
        try {
          // ProjectServiceImplを動的にインポート
          const { ProjectServiceImpl } = await import('../ui/scopeManager/services/implementations/ProjectServiceImpl');
          // FileSystemServiceImplを動的にインポート
          const { FileSystemServiceImpl } = await import('../ui/scopeManager/services/implementations/FileSystemServiceImpl');

          // FileSystemServiceを初期化
          const fileSystemService = FileSystemServiceImpl.getInstance();

          // ProjectServiceを初期化してアクティブプロジェクトパスを取得
          const projectService = ProjectServiceImpl.getInstance(fileSystemService);
          const activeProjectPath = projectService.getActiveProjectPath();

          if (activeProjectPath) {
            projectPath = activeProjectPath;
            Logger.info(`コマンドパレットからファイルビューワーを開く: アクティブプロジェクトパス=${projectPath}`);
          } else {
            Logger.info('コマンドパレットからファイルビューワーを開く: アクティブプロジェクトが見つかりません');
          }
        } catch (projectError) {
          Logger.warn('アクティブプロジェクトの取得に失敗しました、ワークスペースフォルダを使用します', projectError as Error);
        }

        // ProjectServiceから取得できなかった場合はワークスペースフォルダを使用
        if (!projectPath && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
          projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
          Logger.info(`コマンドパレットからファイルビューワーを開く: ワークスペースフォルダを使用=${projectPath}`);
        }

        // ファイルビューワーを直接開く（プロジェクトパスを渡す）
        FileViewerPanel.createOrShow(context.extensionUri, undefined, projectPath);

        Logger.info('コマンドパレットからファイルビューワーを開きました');
        vscode.window.showInformationMessage('ファイルビューワーを開きました');
      } catch (error) {
        Logger.error('コマンドパレットからファイルビューワーを開く際にエラーが発生しました', error as Error);
        vscode.window.showErrorMessage('ファイルビューワーを開けませんでした');
      }
    }
  );

  // 通常のファイルビューワーを開くコマンド (内部使用)
  const openFileViewerCommand = vscode.commands.registerCommand(
    'appgenius.openFileViewer',
    async (projectPath?: string) => {
      try {
        // デバッグログを追加
        Logger.info(`ファイルビューワーを開く: コマンド実行開始 (projectPath=${projectPath || 'なし'})`);

        // グローバル変数からプロジェクトパスを取得（ScopeManagerPanelから設定された場合）
        if (!projectPath && (global as any).__lastSelectedProjectPath) {
          projectPath = (global as any).__lastSelectedProjectPath;
          Logger.info(`ファイルビューワーを開く: グローバル変数から取得したパス=${projectPath}`);

          // グローバル変数をクリア（1回限りの使用）
          (global as any).__lastSelectedProjectPath = undefined;
        }

        // プロジェクトパスが指定されていない場合は、現在のアクティブプロジェクトパスを取得
        if (!projectPath) {
          try {
            // ProjectServiceImplを動的にインポート
            const { ProjectServiceImpl } = await import('../ui/scopeManager/services/implementations/ProjectServiceImpl');
            // FileSystemServiceImplを動的にインポート
            const { FileSystemServiceImpl } = await import('../ui/scopeManager/services/implementations/FileSystemServiceImpl');

            // FileSystemServiceを初期化
            const fileSystemService = FileSystemServiceImpl.getInstance();

            // ProjectServiceを初期化
            const projectService = ProjectServiceImpl.getInstance(fileSystemService);

            // まずアクティブなプロジェクトオブジェクトを取得
            const activeProject = projectService.getActiveProject();
            if (activeProject && activeProject.path) {
              projectPath = activeProject.path;
              Logger.info(`ファイルビューワーを開く: アクティブプロジェクト(${activeProject.name})から取得したパス=${projectPath}`);
            } else {
              // フォールバック: getActiveProjectPathを使用
              const activeProjectPath = projectService.getActiveProjectPath();
              if (activeProjectPath) {
                projectPath = activeProjectPath;
                Logger.info(`ファイルビューワーを開く: getActiveProjectPathから取得したパス=${projectPath}`);
              }
            }
          } catch (projectError) {
            Logger.warn('アクティブプロジェクトの取得に失敗しました', projectError as Error);
          }
        }

        // ファイルビューワーを開く (プロジェクトパスを直接渡す)
        const panel = FileViewerPanel.createOrShow(context.extensionUri, undefined, projectPath);
        Logger.info(`ファイルビューワーを開くコマンドが実行されました${projectPath ? `: プロジェクトパス=${projectPath}` : ''}`);
      } catch (error) {
        Logger.error('ファイルビューワーを開く際にエラーが発生しました', error as Error);
        // 無限ループ防止のため特定のクライアントエラーメッセージのみ送信
        const isScopeManagerActive = vscode.window.visibleTextEditors.some(
          editor => editor.document.fileName.includes('scopeManager')
        );
        if (!isScopeManagerActive) {
          vscode.window.showErrorMessage('ファイルビューワーを開けませんでした: VSCode API通信エラー');
        } else {
          Logger.warn('ScopeManagerがアクティブなため、エラーメッセージ表示を抑制しました');
        }
      }
    }
  );

  // ファイルをビューワーで開くコマンド
  const openFileCommand = vscode.commands.registerCommand(
    'appgenius.openFile',
    async (uri: vscode.Uri) => {
      try {
        // ファイルのプロジェクトパスを取得
        const filePath = uri.fsPath;
        let projectPath = '';

        try {
          // ProjectServiceImplを動的にインポート
          const { ProjectServiceImpl } = await import('../ui/scopeManager/services/implementations/ProjectServiceImpl');
          // FileSystemServiceImplを動的にインポート
          const { FileSystemServiceImpl } = await import('../ui/scopeManager/services/implementations/FileSystemServiceImpl');

          // FileSystemServiceを初期化
          const fileSystemService = FileSystemServiceImpl.getInstance();

          // ProjectServiceを初期化してアクティブプロジェクトパスを取得
          const projectService = ProjectServiceImpl.getInstance(fileSystemService);
          const activeProjectPath = projectService.getActiveProjectPath();

          if (activeProjectPath) {
            projectPath = activeProjectPath;
            Logger.info(`ファイルをビューワーで開く: アクティブプロジェクトパス=${projectPath}`);
          }
        } catch (projectError) {
          Logger.warn('アクティブプロジェクトの取得に失敗しました', projectError as Error);
        }

        // ファイルビューワーを直接開く（プロジェクトパスを渡す）
        const panel = FileViewerPanel.createOrShow(context.extensionUri, undefined, projectPath);

        // パネルが初期化された後にファイルを開くためのメッセージを送信
        setTimeout(() => {
          vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }, 300);

        Logger.info(`ファイルをビューワーで開くコマンドが実行されました: ${uri.fsPath}`);
      } catch (error) {
        Logger.error(`ファイルを開く際にエラーが発生しました: ${uri.fsPath}`, error as Error);
        // 無限ループ防止のため特定のクライアントエラーメッセージのみ送信
        const isScopeManagerActive = vscode.window.visibleTextEditors.some(
          editor => editor.document.fileName.includes('scopeManager')
        );
        if (!isScopeManagerActive) {
          vscode.window.showErrorMessage('ファイルを開けませんでした: VSCode API通信エラー');
        } else {
          Logger.warn('ScopeManagerがアクティブなため、エラーメッセージ表示を抑制しました');
        }
      }
    }
  );

  // コマンドをコンテキストに登録
  context.subscriptions.push(openFileViewerFromPaletteCommand);
  context.subscriptions.push(openFileViewerCommand);
  context.subscriptions.push(openFileCommand);
}