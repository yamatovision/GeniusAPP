import * as vscode from 'vscode';
import { Logger } from '../../../../utils/logger';
import { IMessageHandler } from './types';
import { ISharingService } from '../interfaces/ISharingService';
import { FileSaveOptions } from '../../../../types/SharingTypes';

/**
 * 共有関連メッセージを処理するハンドラー
 */
export class SharingMessageHandler implements IMessageHandler {
  private readonly _sharingService: ISharingService;

  // 処理可能なコマンドリスト
  private static readonly COMMANDS = [
    'shareText',
    'shareImage',
    'getHistory',
    'deleteFromHistory',
    'copyCommand',
    'reuseHistoryItem',
    'saveSharedTextContent'
  ];

  /**
   * コンストラクタ
   * @param sharingService 共有サービス
   */
  constructor(sharingService: ISharingService) {
    this._sharingService = sharingService;
  }

  /**
   * このハンドラーで処理可能なコマンドかを判定
   * @param command コマンド名
   * @returns 処理可能な場合はtrue
   */
  public canHandle(command: string): boolean {
    return SharingMessageHandler.COMMANDS.includes(command);
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
      case 'shareText':
        await this._handleShareText(panel, context, message.text, message.suggestedFilename);
        return true;

      case 'shareImage':
        // message.imageDataまたはmessage.dataのどちらかを使用（互換性のため）
        const imageData = message.imageData || message.data;
        if (!imageData) {
          context.showError('画像データが見つかりません');
          return true;
        }

        await this._handleShareImage(panel, context, imageData, message.fileName);
        return true;

      case 'getHistory':
        await this._handleGetHistory(panel, context);
        return true;

      case 'deleteFromHistory':
        if (message.fileId) {
          await this._handleDeleteFromHistory(panel, context, message.fileId);
          return true;
        }
        context.showError('履歴から削除に必要な情報が不足しています');
        return true;

      case 'copyCommand':
        if (message.fileId) {
          await this._handleCopyCommand(context, message.fileId);
          return true;
        }
        context.showError('コマンドのコピーに必要な情報が不足しています');
        return true;

      case 'reuseHistoryItem':
        if (message.fileId) {
          await this._handleReuseHistoryItem(panel, context, message.fileId);
          return true;
        }
        context.showError('履歴項目の再利用に必要な情報が不足しています');
        return true;

      case 'saveSharedTextContent':
        if (message.content) {
          await this._handleSaveSharedTextContent(panel, context, message.content, message.options);
          return true;
        }
        context.showError('共有テキストの保存に必要な情報が不足しています');
        return true;
    }

    return false;
  }

  /**
   * テキスト共有処理
   */
  private async _handleShareText(
    panel: vscode.WebviewPanel,
    context: any,
    text: string,
    suggestedFilename?: string
  ): Promise<void> {
    try {
      Logger.info('SharingMessageHandler: テキスト共有処理を開始');

      if (!text || text.trim() === '') {
        context.showError('共有するテキストが空です');
        return;
      }

      // テキストを共有
      const options: FileSaveOptions = {
        type: 'text',
        title: suggestedFilename
      };

      const result = await this._sharingService.shareText(text, options);
      
      // 履歴を更新
      const history = await this._sharingService.getHistory();
      
      // WebViewに履歴を送信
      panel.webview.postMessage({
        command: 'updateSharingHistory',
        history
      });
      
      // シェアコマンドをクリップボードにコピー
      const command = this._sharingService.generateCommand(result);
      await vscode.env.clipboard.writeText(command);
      
      context.showSuccess('テキストを共有し、コマンドをクリップボードにコピーしました');
      Logger.info('SharingMessageHandler: テキスト共有処理完了');
    } catch (error) {
      Logger.error('テキスト共有中にエラーが発生しました', error as Error);
      context.showError(`テキスト共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 画像共有処理
   */
  private async _handleShareImage(
    panel: vscode.WebviewPanel,
    context: any,
    imageData: string,
    fileName: string
  ): Promise<void> {
    try {
      Logger.info('SharingMessageHandler: 画像共有処理を開始');

      if (!imageData) {
        context.showError('共有する画像データが無効です');
        return;
      }

      // 画像を共有
      const result = await this._sharingService.shareImage(imageData, fileName);
      
      // 履歴を更新
      const history = await this._sharingService.getHistory();
      
      // WebViewに履歴を送信
      panel.webview.postMessage({
        command: 'updateSharingHistory',
        history
      });
      
      // シェアコマンドをクリップボードにコピー
      const command = this._sharingService.generateCommand(result);
      await vscode.env.clipboard.writeText(command);
      
      context.showSuccess('画像を共有し、コマンドをクリップボードにコピーしました');
      Logger.info('SharingMessageHandler: 画像共有処理完了');
    } catch (error) {
      Logger.error('画像共有中にエラーが発生しました', error as Error);
      context.showError(`画像共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 履歴取得処理
   */
  private async _handleGetHistory(panel: vscode.WebviewPanel, context: any): Promise<void> {
    try {
      Logger.info('SharingMessageHandler: 履歴取得処理を開始');
      
      // 履歴を取得
      const history = await this._sharingService.getHistory();
      
      // WebViewに履歴を送信
      panel.webview.postMessage({
        command: 'updateSharingHistory',
        history
      });
      
      Logger.info('SharingMessageHandler: 履歴取得処理完了');
    } catch (error) {
      Logger.error('履歴取得中にエラーが発生しました', error as Error);
      context.showError(`履歴取得に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 履歴削除処理
   */
  private async _handleDeleteFromHistory(
    panel: vscode.WebviewPanel,
    context: any,
    fileId: string
  ): Promise<void> {
    try {
      Logger.info(`SharingMessageHandler: 履歴削除処理を開始 - ${fileId}`);
      
      // 履歴から削除
      await this._sharingService.deleteFromHistory(fileId);
      
      // 履歴を更新
      const history = await this._sharingService.getHistory();
      
      // WebViewに履歴を送信
      panel.webview.postMessage({
        command: 'updateSharingHistory',
        history
      });
      
      context.showSuccess('履歴から項目を削除しました');
      Logger.info(`SharingMessageHandler: 履歴削除処理完了 - ${fileId}`);
    } catch (error) {
      Logger.error(`履歴削除中にエラーが発生しました: ${fileId}`, error as Error);
      context.showError(`履歴削除に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * コマンドコピー処理
   */
  private async _handleCopyCommand(context: any, fileId: string): Promise<void> {
    try {
      Logger.info(`SharingMessageHandler: コマンドコピー処理を開始 - ${fileId}`);
      
      // コマンドを取得
      const command = await this._sharingService.getCommandByFileId(fileId);
      
      if (!command) {
        context.showError('指定されたファイルのコマンドが見つかりません');
        return;
      }
      
      // クリップボードにコピー
      await vscode.env.clipboard.writeText(command);
      
      // アクセス記録を更新
      await this._sharingService.recordAccess(fileId);
      
      context.showSuccess('コマンドをクリップボードにコピーしました');
      Logger.info(`SharingMessageHandler: コマンドコピー処理完了 - ${fileId}`);
    } catch (error) {
      Logger.error(`コマンドコピー中にエラーが発生しました: ${fileId}`, error as Error);
      context.showError(`コマンドコピーに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 履歴項目再利用処理
   */
  private async _handleReuseHistoryItem(
    panel: vscode.WebviewPanel,
    context: any,
    fileId: string
  ): Promise<void> {
    try {
      Logger.info(`SharingMessageHandler: 履歴項目再利用処理を開始 - ${fileId}`);
      
      // 履歴を取得
      const history = await this._sharingService.getHistory();
      
      // 指定されたIDのファイルを検索
      const file = history.find(item => item.id === fileId);
      
      if (!file) {
        context.showError('指定された履歴項目が見つかりません');
        return;
      }
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // クリップボードにコピー
      await vscode.env.clipboard.writeText(command);
      
      // アクセス記録を更新
      await this._sharingService.recordAccess(fileId);
      
      // 履歴を更新
      const updatedHistory = await this._sharingService.getHistory();
      
      // WebViewに履歴を送信
      panel.webview.postMessage({
        command: 'updateSharingHistory',
        history: updatedHistory
      });
      
      context.showSuccess('コマンドをクリップボードにコピーしました');
      Logger.info(`SharingMessageHandler: 履歴項目再利用処理完了 - ${fileId}`);
    } catch (error) {
      Logger.error(`履歴項目再利用中にエラーが発生しました: ${fileId}`, error as Error);
      context.showError(`履歴項目再利用に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 共有テキスト保存処理
   */
  private async _handleSaveSharedTextContent(
    panel: vscode.WebviewPanel,
    context: any,
    content: string,
    options?: FileSaveOptions
  ): Promise<void> {
    try {
      Logger.info('SharingMessageHandler: 共有テキスト保存処理を開始');
      
      if (!content || content.trim() === '') {
        context.showError('保存するテキストが空です');
        return;
      }
      
      // テキストを共有
      const saveOptions: FileSaveOptions = {
        type: 'text',
        ...options
      };
      
      const result = await this._sharingService.shareText(content, saveOptions);
      
      // 履歴を更新
      const history = await this._sharingService.getHistory();
      
      // WebViewに履歴を送信
      panel.webview.postMessage({
        command: 'updateSharingHistory',
        history
      });
      
      // シェアコマンドをクリップボードにコピー
      const command = this._sharingService.generateCommand(result);
      await vscode.env.clipboard.writeText(command);
      
      context.showSuccess('テキストを保存し、コマンドをクリップボードにコピーしました');
      Logger.info('SharingMessageHandler: 共有テキスト保存処理完了');
    } catch (error) {
      Logger.error('共有テキスト保存中にエラーが発生しました', error as Error);
      context.showError(`テキスト保存に失敗しました: ${(error as Error).message}`);
    }
  }
}