import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export class StatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    // メインのステータスバーアイテム
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.text = '$(robot) AppGenius AI';
    this.statusBarItem.tooltip = 'AppGenius AI: 準備完了';
    this.statusBarItem.command = 'appgenius-ai.showMainMenu';
    this.statusBarItem.show();
    
    Logger.debug('ステータスバーにAppGenius AIアイコンを表示しました');
  }

  /**
   * ステータスバーの表示を更新
   */
  public update(state: string): void {
    switch (state) {
      case 'Active':
        this.statusBarItem.text = '$(radio-tower) AppGenius AI';
        this.statusBarItem.tooltip = 'AppGenius AI: アクティブ';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case 'Busy':
        this.statusBarItem.text = '$(sync~spin) AppGenius AI';
        this.statusBarItem.tooltip = 'AppGenius AI: 処理中...';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case 'Ready':
        this.statusBarItem.text = '$(robot) AppGenius AI';
        this.statusBarItem.tooltip = 'AppGenius AI: 準備完了';
        this.statusBarItem.backgroundColor = undefined;
        break;
      default:
        this.statusBarItem.text = '$(robot) AppGenius AI';
        this.statusBarItem.tooltip = 'AppGenius AI: 準備完了';
        this.statusBarItem.backgroundColor = undefined;
    }
  }

  /**
   * リソースを解放
   */
  dispose() {
    this.statusBarItem.dispose();
  }
}