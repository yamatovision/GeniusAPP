import * as vscode from 'vscode';
import { IService } from './common';

/**
 * UI状態管理サービスインターフェース
 * WebViewのUI状態管理に関する責務を担当
 */
export interface IUIStateService extends IService {
  // UI状態の更新
  updateUIState(projectId: string, state: any): void;
  getUIState(projectId: string): any;
  
  // 通知メソッド
  showSuccess(message: string): void;
  showError(message: string): void;
  
  // イベント
  onUIStateChanged: vscode.Event<{ projectId: string, state: any }>;
}