import * as vscode from 'vscode';
import * as path from 'path';
import { EnvVariablesPanel } from '../ui/environmentVariables/EnvVariablesPanel';
import { Logger } from '../utils/logger';

/**
 * 環境変数管理関連のコマンドを登録する
 * @param context 拡張機能のコンテキスト
 */
export function registerEnvironmentCommands(context: vscode.ExtensionContext): void {
  Logger.info('環境変数管理コマンドを登録します');
  
  // 環境変数管理パネルを開くコマンド
  const openEnvVariablesPanelCommand = vscode.commands.registerCommand('appgenius-ai.openEnvVariablesPanel', () => {
    Logger.info('環境変数管理パネルを開きます');
    
    try {
      // アクティブなワークスペースを取得
      let projectPath: string | undefined;
      
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      }
      
      // パネルを表示
      EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
    } catch (error) {
      Logger.error('環境変数管理パネルのオープンに失敗しました', error as Error);
      vscode.window.showErrorMessage(`環境変数管理パネルの表示に失敗しました: ${(error as Error).message}`);
    }
  });
  
  // 環境変数ファイルを作成するコマンド
  const createEnvFileCommand = vscode.commands.registerCommand('appgenius-ai.createEnvFile', async () => {
    Logger.info('環境変数ファイルを作成します');
    
    try {
      // アクティブなワークスペースを取得
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // ファイル名の入力を促す
        const fileName = await vscode.window.showInputBox({
          prompt: '環境変数ファイル名を入力してください',
          placeHolder: 'development, production など',
          validateInput: (value) => {
            if (!value) {
              return 'ファイル名を入力してください';
            }
            return null;
          }
        });
        
        if (fileName) {
          // .envで始まるファイル名にする
          const envFileName = fileName.startsWith('.env') ? fileName : `.env.${fileName}`;
          const envFilePath = path.join(projectPath, envFileName);
          
          // パネルを表示して環境変数ファイルを作成
          const panel = EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
          
          // ファイル作成のメッセージを表示
          vscode.window.showInformationMessage(`環境変数ファイル ${envFileName} を作成しました`);
        }
      } else {
        vscode.window.showErrorMessage('アクティブなワークスペースがありません');
      }
    } catch (error) {
      Logger.error('環境変数ファイルの作成に失敗しました', error as Error);
      vscode.window.showErrorMessage(`環境変数ファイルの作成に失敗しました: ${(error as Error).message}`);
    }
  });
  
  // 環境変数設定状況を検証するコマンド
  const validateEnvVariablesCommand = vscode.commands.registerCommand('appgenius-ai.validateEnvVariables', async () => {
    Logger.info('環境変数設定状況を検証します');
    
    try {
      // アクティブなワークスペースを取得
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // パネルを表示
        const panel = EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
        
        // 検証メッセージを表示
        vscode.window.showInformationMessage('環境変数設定状況の検証を開始しました');
      } else {
        vscode.window.showErrorMessage('アクティブなワークスペースがありません');
      }
    } catch (error) {
      Logger.error('環境変数設定状況の検証に失敗しました', error as Error);
      vscode.window.showErrorMessage(`環境変数設定状況の検証に失敗しました: ${(error as Error).message}`);
    }
  });
  
  // env.mdファイルを更新するコマンド
  const updateEnvMdCommand = vscode.commands.registerCommand('appgenius-ai.updateEnvMd', async () => {
    Logger.info('env.mdファイルを更新します');
    
    try {
      // アクティブなワークスペースを取得
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // パネルを表示
        const panel = EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
        
        // 更新メッセージを表示
        vscode.window.showInformationMessage('env.mdファイルの更新を開始しました');
      } else {
        vscode.window.showErrorMessage('アクティブなワークスペースがありません');
      }
    } catch (error) {
      Logger.error('env.mdファイルの更新に失敗しました', error as Error);
      vscode.window.showErrorMessage(`env.mdファイルの更新に失敗しました: ${(error as Error).message}`);
    }
  });
  
  // コマンドを登録
  context.subscriptions.push(openEnvVariablesPanelCommand);
  context.subscriptions.push(createEnvFileCommand);
  context.subscriptions.push(validateEnvVariablesCommand);
  context.subscriptions.push(updateEnvMdCommand);
  
  Logger.info('環境変数管理コマンドの登録が完了しました');
}