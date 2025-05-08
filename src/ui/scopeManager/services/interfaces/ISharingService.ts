import * as vscode from 'vscode';
import { IService } from './common';

/**
 * 共有サービスインターフェース
 * ファイル共有機能に関する責務を担当
 */
export interface ISharingService extends IService {
  // 履歴管理
  getHistory(): any[];
  deleteFromHistory(fileId: string): boolean;
  recordAccess(fileId: string): void;
  
  // コマンド生成
  generateCommand(file: any): string;
  
  // イベント
  onHistoryUpdated: vscode.Event<any[]>;
}