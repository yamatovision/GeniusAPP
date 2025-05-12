import * as vscode from 'vscode';
import { Logger } from '../../../../utils/logger';
import { IMessageHandler } from './types';

/**
 * ScopeManagerPanelのメッセージハンドリングを担当するクラス
 * 登録された個別ハンドラーにメッセージを振り分ける役割を持つ
 */
export class ScopeManagerMessageHandler {
  private readonly _handlers: IMessageHandler[] = [];
  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: any;

  /**
   * コンストラクタ
   * @param panel WebviewPanel
   * @param context コンテキスト情報
   */
  constructor(
    panel: vscode.WebviewPanel,
    context: {
      projectPath: string,
      showError: (message: string) => void,
      showSuccess: (message: string) => void,
      [key: string]: any
    }
  ) {
    this._panel = panel;
    this._context = context;
  }

  /**
   * ハンドラーを登録
   * @param handler 登録するメッセージハンドラー
   */
  public registerHandler(handler: IMessageHandler): void {
    this._handlers.push(handler);
  }

  /**
   * メッセージレシーバーをセットアップ
   * @returns 登録したリスナーのDisposable
   */
  public setupMessageReceiver(): vscode.Disposable {
    return this._panel.webview.onDidReceiveMessage(
      async message => {
        try {
          // コマンドがない場合は処理できない
          if (!message.command) {
            return;
          }

          Logger.info(`ScopeManagerMessageHandler: ${message.command}のメッセージを受信`);

          // 特殊なケース: launchPromptFromURL
          if (message.command === 'launchPromptFromURL') {
            // ScopeManagerPanelの_handleLaunchPromptFromURLメソッドを呼び出す
            const splitTerminalValue = message.splitTerminal === true ? true : false;
            Logger.info(`【メッセージ変換】splitTerminal: ${message.splitTerminal} => ${splitTerminalValue}`);

            try {
              await this._context.handleLaunchPromptFromURL?.(
                message.url,
                message.index,
                message.name,
                splitTerminalValue
              );
              return;
            } catch (specialError) {
              Logger.error(`launchPromptFromURL処理中にエラー`, specialError as Error);
              this._context.showError(`コマンド実行に失敗しました: ${(specialError as Error).message}`);
              return;
            }
          }

          // 特殊なケース: openMarkdownViewer
          if (message.command === 'openMarkdownViewer') {
            try {
              await this._context.handleOpenMarkdownViewer?.();
              return;
            } catch (specialError) {
              Logger.error(`openMarkdownViewer処理中にエラー`, specialError as Error);
              this._context.showError(`コマンド実行に失敗しました: ${(specialError as Error).message}`);
              return;
            }
          }

          // Webview独自のコマンド: copyToClipboard
          if (message.command === 'copyToClipboard') {
            if (message.text) {
              try {
                await vscode.env.clipboard.writeText(message.text);
                this._context.showSuccess?.('クリップボードにコピーしました');
                return;
              } catch (clipboardError) {
                Logger.error(`クリップボードコピー中にエラー`, clipboardError as Error);
                this._context.showError(`コピーに失敗しました: ${(clipboardError as Error).message}`);
                return;
              }
            } else {
              this._context.showError('コピーするテキストが指定されていません');
              return;
            }
          }

          // 登録ハンドラー内から適切なものを検索
          let handled = false;
          for (const handler of this._handlers) {
            if (handler.canHandle(message.command)) {
              try {
                // ハンドラーでメッセージを処理
                handled = await handler.handleMessage(message, this._panel, this._context);
                if (handled) {
                  break;
                }
              } catch (handlerError) {
                Logger.error(`ハンドラー実行中にエラー: ${message.command}`, handlerError as Error);
                this._context.showError(`処理に失敗しました: ${(handlerError as Error).message}`);
                handled = true;
                break;
              }
            }
          }

          // 処理されなかった場合はログに残す
          if (!handled) {
            Logger.warn(`ScopeManagerMessageHandler: 未処理のコマンド ${message.command}`);
          }
        } catch (error) {
          Logger.error(`メッセージ処理エラー: ${message.command}`, error as Error);
          this._context.showError(`操作に失敗しました: ${(error as Error).message}`);
        }
      }
    );
  }
}