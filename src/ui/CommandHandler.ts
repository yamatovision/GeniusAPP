import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { TerminalInterface } from './TerminalInterface';
import { AIService } from '../core/aiService';

/**
 * VSCodeのコマンドハンドラークラス
 * ユーザーのコマンド入力を受け付け、AIに転送する
 */
export class CommandHandler {
  private terminalInterface: TerminalInterface;
  private disposables: vscode.Disposable[] = [];
  private lastQuery: string = '';

  constructor(
    private aiService: AIService
  ) {
    this.terminalInterface = TerminalInterface.getInstance(aiService);
    this.registerCommands();
  }

  /**
   * コマンドを登録
   */
  private registerCommands(): void {
    // AIコマンド実行
    this.disposables.push(
      vscode.commands.registerCommand('appgenius-ai.executeCommand', async () => {
        try {
          const query = await vscode.window.showInputBox({
            prompt: 'AIへのコマンドまたは質問を入力',
            placeHolder: 'AIへの指示を入力してください...',
            value: this.lastQuery
          });

          if (query) {
            this.lastQuery = query;
            this.terminalInterface.showTerminal();
            await this.terminalInterface.processQuery(query);
          }
        } catch (error) {
          Logger.error(`コマンド実行エラー: ${(error as Error).message}`);
          vscode.window.showErrorMessage(`コマンド実行エラー: ${(error as Error).message}`);
        }
      })
    );

    // ターミナルを表示
    this.disposables.push(
      vscode.commands.registerCommand('appgenius-ai.showTerminal', () => {
        this.terminalInterface.showTerminal();
      })
    );

    // ヘルプを表示
    this.disposables.push(
      vscode.commands.registerCommand('appgenius-ai.showHelp', async () => {
        this.terminalInterface.showTerminal();
        await this.terminalInterface.processQuery('/help');
      })
    );
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.terminalInterface.dispose();
  }
}