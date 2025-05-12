import * as vscode from 'vscode';
import { Logger } from '../../../../utils/logger';
import { IMessageHandler } from './types';

/**
 * モックアップ関連メッセージを処理するハンドラー
 */
export class MockupMessageHandler implements IMessageHandler {
  // 処理可能なコマンドリスト
  private static readonly COMMANDS = [
    'openMockupGallery',
    'openOriginalMockupGallery',
    'selectMockup',
    'openInBrowser'
  ];

  /**
   * このハンドラーで処理可能なコマンドかを判定
   * @param command コマンド名
   * @returns 処理可能な場合はtrue
   */
  public canHandle(command: string): boolean {
    return MockupMessageHandler.COMMANDS.includes(command);
  }

  /**
   * メッセージを処理
   * @param message メッセージオブジェクト
   * @param panel WebviewPanel
   * @param context コンテキスト情報
   * @returns 処理が成功した場合はtrue
   */
  public async handleMessage(
    message: any,
    panel: vscode.WebviewPanel,
    context: any
  ): Promise<boolean> {
    switch (message.command) {
      case 'openMockupGallery':
        await this._handleOpenMockupGallery(context);
        return true;

      case 'openOriginalMockupGallery':
        await this._handleOpenOriginalMockupGallery(context, message.filePath);
        return true;

      case 'selectMockup':
        if (message.filePath) {
          await this._handleSelectMockup(context, message.filePath);
          return true;
        }
        context.showError('モックアップ選択に必要な情報が不足しています');
        return true;

      case 'openInBrowser':
        if (message.filePath) {
          await this._handleOpenMockupInBrowser(context, message.filePath);
          return true;
        }
        context.showError('ブラウザで開くために必要な情報が不足しています');
        return true;
    }

    return false;
  }

  /**
   * モックアップギャラリーを開く処理
   */
  private async _handleOpenMockupGallery(context: any): Promise<void> {
    try {
      Logger.info('MockupMessageHandler: モックアップギャラリーを開く処理を開始');
      
      // 別ウィンドウでモックアップギャラリーを開く
      await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', context.projectPath);
      
      context.showSuccess('モックアップギャラリーを開きました');
      Logger.info('MockupMessageHandler: モックアップギャラリーを開く処理完了');
    } catch (error) {
      Logger.error('モックアップギャラリーを開けませんでした', error as Error);
      context.showError(`モックアップギャラリーを開けませんでした: ${(error as Error).message}`);
    }
  }

  /**
   * 元のモックアップギャラリーを開く処理（互換性のため）
   */
  private async _handleOpenOriginalMockupGallery(context: any, filePath?: string): Promise<void> {
    try {
      Logger.info(`MockupMessageHandler: 元のモックアップギャラリーを開く処理を開始${filePath ? ': ' + filePath : ''}`);
      
      // 統合されたメソッドを呼び出す
      return this._handleOpenMockupGallery(context);
    } catch (error) {
      Logger.error('元のモックアップギャラリーを開けませんでした', error as Error);
      context.showError(`モックアップギャラリーを開けませんでした: ${(error as Error).message}`);
    }
  }

  /**
   * 特定のモックアップを選択する処理
   */
  private async _handleSelectMockup(context: any, filePath: string): Promise<void> {
    try {
      Logger.info(`MockupMessageHandler: モックアップ選択処理を開始 - ${filePath}`);
      
      // 特定のファイルを選択してギャラリーを開く
      await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', context.projectPath, filePath);
      
      context.showSuccess('モックアップを開きました');
      Logger.info(`MockupMessageHandler: モックアップ選択処理完了 - ${filePath}`);
    } catch (error) {
      Logger.error(`モックアップの選択中にエラーが発生しました: ${filePath}`, error as Error);
      context.showError(`モックアップを選択できませんでした: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップをブラウザで開く処理
   */
  private async _handleOpenMockupInBrowser(context: any, filePath: string): Promise<void> {
    try {
      Logger.info(`MockupMessageHandler: モックアップをブラウザで開く処理を開始 - ${filePath}`);
      
      // 外部ブラウザでファイルを開く
      await vscode.env.openExternal(vscode.Uri.file(filePath));
      
      context.showSuccess('モックアップをブラウザで開きました');
      Logger.info(`MockupMessageHandler: モックアップをブラウザで開く処理完了 - ${filePath}`);
    } catch (error) {
      Logger.error(`モックアップをブラウザで開く中にエラーが発生しました: ${filePath}`, error as Error);
      context.showError(`モックアップをブラウザで開けませんでした: ${(error as Error).message}`);
    }
  }
}