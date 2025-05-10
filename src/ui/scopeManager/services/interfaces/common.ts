import * as vscode from 'vscode';

/**
 * サービス共通の型定義
 */

/**
 * メッセージの基本形式
 */
export interface Message {
  command: string;
  serviceType?: string;  // サービスタイプ（直接サービス呼び出し用）
  requestId?: string;    // リクエストID（非同期リクエスト用）
  [key: string]: any;
}

/**
 * ディスポーザブルなサービスのベースインターフェース
 */
export interface IDisposableService extends vscode.Disposable {
  dispose(): void;
}

/**
 * プロジェクト情報
 */
export interface IProjectInfo {
  id: string;
  name: string;
  path: string;
  metadata?: {
    activeTab?: string;
    created?: string;
    lastOpened?: string;
    [key: string]: any;
  };
  description?: string;
}

// ファイルブラウザ機能削除に伴い、IProjectDocumentインターフェースも削除

/**
 * すべてのサービスのベースとなるインターフェース
 */
export interface IService extends IDisposableService {
  // イベント関連のプロパティやメソッドは各サービスで定義
}