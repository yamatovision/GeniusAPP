import * as vscode from 'vscode';
import { AIService } from '../core/aiService';
import { Logger } from '../utils/logger';

/**
 * AppGenius AIのターミナルインターフェースを管理するクラス
 * ユーザー入力の受付とAI応答の表示を担当
 */
export class TerminalInterface {
  private terminal: vscode.Terminal | undefined;
  private aiService: AIService;
  private static instance: TerminalInterface;

  private constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * シングルトンインスタンスを取得または作成
   */
  public static getInstance(aiService: AIService): TerminalInterface {
    if (!TerminalInterface.instance) {
      TerminalInterface.instance = new TerminalInterface(aiService);
    }
    return TerminalInterface.instance;
  }

  /**
   * ターミナルを表示し、初期化する
   */
  public showTerminal(): void {
    try {
      if (!this.terminal) {
        // ターミナル作成をデバッグログに記録
        Logger.debug('ターミナルを作成しています...');
        
        // 新しいターミナルインスタンスを作成
        this.terminal = vscode.window.createTerminal({
          name: 'AppGenius AI',
          hideFromUser: false,
          isTransient: false
        });
        
        Logger.info('AppGenius AI ターミナルを作成しました');
        
        // 1秒待ってからメッセージを表示（ターミナル初期化待ち）
        setTimeout(() => {
          try {
            // 初期メッセージを表示
            if (this.terminal) {
              // シンプルな初期メッセージ
              this.terminal.sendText(`AppGenius AI ターミナルへようこそ！`);
              this.terminal.sendText(`コマンドを入力してください（例: /help）`);
              this.terminal.sendText(``);
              Logger.debug('ターミナルに初期メッセージを送信しました');
              
              // シンプルなプロンプト
              this.terminal.sendText(`> `);
            }
          } catch (error) {
            Logger.error(`ターミナルメッセージ表示中にエラー: ${(error as Error).message}`);
            vscode.window.showErrorMessage(`ターミナル初期化エラー: ${(error as Error).message}`);
          }
        }, 1000);
      }
      
      // ターミナルを前面に表示
      this.terminal.show(true);
      Logger.debug('ターミナルを表示しました');
      
      // ターミナルのフォーカスを明示的に設定
      vscode.commands.executeCommand('workbench.action.terminal.focus');
    } catch (error) {
      Logger.error(`ターミナル表示中にエラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`ターミナルエラー: ${(error as Error).message}`);
      
      // エラー発生時はステータスバーに通知
      vscode.window.setStatusBarMessage(`AppGenius AI ターミナルエラー`, 5000);
    }
  }

  /**
   * AIへの問い合わせを処理し、結果をターミナルに表示
   */
  public async processQuery(query: string): Promise<void> {
    try {
      // ターミナルがなければ作成
      if (!this.terminal) {
        this.showTerminal();
        // ターミナル初期化待ち
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      Logger.debug(`ユーザーからのクエリを処理: ${query}`);
      
      // ユーザー入力を入力欄として直接表示（echo コマンドを使わない）
      this.terminal?.sendText(query);
      
      try {
        // AIの処理を開始 - 処理中表示は簡潔に
        this.terminal?.sendText(`処理中...`);
        
        // AIサービスからの応答を取得
        const response = await this.aiService.processMessage(query);
        
        // 応答をターミナルに直接表示（echo コマンドを使わない）
        this.terminal?.sendText(`${response}`);
        
        // プロンプト表示も簡潔に
        this.terminal?.sendText(`> `);
        
        Logger.debug('AI応答を表示しました');
      } catch (error) {
        Logger.error(`AI処理中にエラーが発生: ${(error as Error).message}`);
        this.terminal?.sendText(`エラー: ${(error as Error).message}`);
        this.terminal?.sendText(`> `);
      }
    } catch (error) {
      Logger.error(`クエリ処理中にエラーが発生: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`AI応答エラー: ${(error as Error).message}`);
    }
  }

  /**
   * ファイル操作の開始を通知
   */
  public notifyFileOperation(filePath: string, operation: 'create' | 'modify' | 'delete'): void {
    try {
      if (!this.terminal) {
        this.showTerminal();
      }
  
      const operationText = {
        'create': '作成',
        'modify': '修正',
        'delete': '削除'
      }[operation];
  
      this.terminal?.sendText(`ファイルを${operationText}しています: ${filePath}`);
      Logger.debug(`ファイル${operationText}開始: ${filePath}`);
    } catch (error) {
      Logger.error(`ファイル操作通知エラー: ${(error as Error).message}`);
    }
  }

  /**
   * ファイル操作の完了を通知
   */
  public notifyFileOperationComplete(filePath: string, operation: 'create' | 'modify' | 'delete'): void {
    try {
      if (!this.terminal) {
        this.showTerminal();
      }
  
      const operationText = {
        'create': '作成',
        'modify': '修正',
        'delete': '削除'
      }[operation];
  
      this.terminal?.sendText(`ファイルの${operationText}が完了しました: ${filePath}`);
      Logger.debug(`ファイル${operationText}完了: ${filePath}`);
      
      // ファイルをエディタで開く（create か modify の場合のみ）
      if (operation === 'create' || operation === 'modify') {
        this.openFileInEditor(filePath);
      }
    } catch (error) {
      Logger.error(`ファイル操作完了通知エラー: ${(error as Error).message}`);
    }
  }

  /**
   * 指定されたファイルをエディタで開く
   */
  private async openFileInEditor(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
      Logger.debug(`ファイルをエディタで開きました: ${filePath}`);
    } catch (error) {
      Logger.error(`ファイルを開く際にエラーが発生: ${(error as Error).message}`);
    }
  }

  /**
   * AIからのレスポンスを処理し表示
   * @param result 表示する結果
   */
  public processResult(result: string): void {
    try {
      if (!this.terminal) {
        this.showTerminal();
      }
      this.terminal?.sendText(result);
      this.terminal?.sendText(`> `);
      Logger.debug('処理結果を表示しました');
    } catch (error) {
      Logger.error(`結果表示中にエラーが発生: ${(error as Error).message}`);
    }
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = undefined;
    }
  }
}