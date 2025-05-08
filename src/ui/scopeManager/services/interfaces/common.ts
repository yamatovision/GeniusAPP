import * as vscode from 'vscode';

/**
 * サービス共通の型定義
 */

/**
 * メッセージの基本形式
 */
export interface Message {
  command: string;
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

/**
 * プロジェクトドキュメント情報（ファイルブラウザ用）
 */
export interface IProjectDocument {
  path: string;
  name: string;
  type: string;
  lastModified: Date;
  parentFolder?: string; // オプショナルに変更
  isDirectory?: boolean; // オプショナルに変更
  size?: number; // オプショナルに変更
  children?: IProjectDocument[];
}

/**
 * すべてのサービスのベースとなるインターフェース
 */
export interface IService extends IDisposableService {
  // イベント関連のプロパティやメソッドは各サービスで定義
}