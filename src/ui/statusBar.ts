import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export class StatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private commandItem: vscode.StatusBarItem;
  private requirementsItem: vscode.StatusBarItem;
  private mockupItem: vscode.StatusBarItem;
  private implementationItem: vscode.StatusBarItem;
  private assistantItem: vscode.StatusBarItem;

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
    
    // コマンド入力用のステータスバーアイテム（非表示）
    this.commandItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this.commandItem.text = '$(terminal) コマンド入力';
    this.commandItem.tooltip = 'AppGenius AI: コマンドを入力';
    this.commandItem.command = 'appgenius-ai.executeCommand';
    // this.commandItem.show(); // コマンド入力を非表示に

    // 要件定義ビジュアライザー用のステータスバーアイテム
    this.requirementsItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      98
    );
    this.requirementsItem.text = '$(book) 要件定義';
    this.requirementsItem.tooltip = '要件定義ビジュアライザーを開く';
    this.requirementsItem.command = 'appgenius-ai.openSimpleChat';
    this.requirementsItem.show();

    // モックアップエディター用のステータスバーアイテム
    this.mockupItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      97.5
    );
    this.mockupItem.text = '$(preview) モックアップ';
    this.mockupItem.tooltip = 'モックアップエディターを開く';
    this.mockupItem.command = 'appgenius-ai.openMockupEditor';
    this.mockupItem.show();

    // 実装スコープ選択用のステータスバーアイテム
    this.implementationItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      97
    );
    this.implementationItem.text = '$(code) 実装スコープ';
    this.implementationItem.tooltip = '実装スコープ選択を開く';
    this.implementationItem.command = 'appgenius-ai.openImplementationSelector';
    this.implementationItem.show();

    // 開発アシスタント用のステータスバーアイテム
    this.assistantItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      96
    );
    this.assistantItem.text = '$(tools) 開発アシスタント';
    this.assistantItem.tooltip = '開発アシスタントを開く';
    this.assistantItem.command = 'appgenius-ai.openDevelopmentAssistant';
    this.assistantItem.show();
    
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
    this.commandItem.dispose();
    this.requirementsItem.dispose();
    this.mockupItem.dispose();
    this.implementationItem.dispose();
    this.assistantItem.dispose();
  }
}