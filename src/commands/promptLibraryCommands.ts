import * as vscode from 'vscode';
import { PromptLibraryPanel } from '../ui/promptLibrary/PromptLibraryPanel';
import { PromptImportExport } from '../ui/promptLibrary/PromptImportExport';

/**
 * プロンプトライブラリ関連のコマンドを登録する
 * @param context 拡張機能のコンテキスト
 */
export function registerPromptLibraryCommands(context: vscode.ExtensionContext): void {
  // プロンプトライブラリを表示するコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.openPromptLibrary', () => {
      PromptLibraryPanel.createOrShow(context.extensionUri);
    })
  );

  // プロンプトエディタを開くコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.editPrompt', (promptId?: string) => {
      PromptLibraryPanel.createOrShow(context.extensionUri, promptId ? { mode: 'edit', promptId } : undefined);
    })
  );

  // 新規プロンプトを作成するコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.createNewPrompt', () => {
      PromptLibraryPanel.createOrShow(context.extensionUri, { mode: 'create' });
    })
  );

  // プロンプトをエクスポートするコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.exportPrompts', async () => {
      const promptImportExport = new PromptImportExport();
      await promptImportExport.exportPrompts();
    })
  );

  // プロンプトをインポートするコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.importPrompts', async () => {
      const promptImportExport = new PromptImportExport();
      await promptImportExport.importPrompts();
    })
  );
}