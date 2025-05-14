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
    this.statusBarItem.text = '$(robot) ブルーランプ';
    this.statusBarItem.tooltip = 'ブルーランプ: 準備完了';
    this.statusBarItem.command = 'appgenius-ai.showMainMenu';
    this.statusBarItem.show();
    
    Logger.debug('ステータスバーにブルーランプアイコンを表示しました');
  }

  /**
   * ステータスバーの表示を更新
   */
  public update(state: string): void {
    switch (state) {
      case 'Active':
        this.statusBarItem.text = '$(radio-tower) ブルーランプ';
        this.statusBarItem.tooltip = 'ブルーランプ: アクティブ';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case 'Busy':
        this.statusBarItem.text = '$(sync~spin) ブルーランプ';
        this.statusBarItem.tooltip = 'ブルーランプ: 処理中...';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case 'Ready':
        this.statusBarItem.text = '$(robot) ブルーランプ';
        this.statusBarItem.tooltip = 'ブルーランプ: 準備完了';
        this.statusBarItem.backgroundColor = undefined;
        break;
      default:
        this.statusBarItem.text = '$(robot) ブルーランプ';
        this.statusBarItem.tooltip = 'ブルーランプ: 準備完了';
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