import * as vscode from 'vscode';
import { Feature } from '../../../core/auth/roles';
import { SharedFile, FileSaveOptions } from '../../../types/SharingTypes';

/**
 * プロジェクト情報インターフェース
 */
export interface IProjectInfo {
  id: string;
  name: string;
  path: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
  metadata?: {
    activeTab?: string;
    [key: string]: any;
  };
}

/**
 * 認証状態インターフェース
 */
export interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    roles?: string[];
  };
  
  // 追加の適合プロパティ
  [key: string]: any;
}

/**
 * プロジェクトドキュメント情報インターフェース
 * ファイルブラウザ機能で使用する
 */
export interface IProjectDocument {
  path: string;        // ファイルの絶対パス
  name: string;        // ファイル名
  type: string;        // ファイルの種類（markdown、json、その他など）
  lastModified: Date;  // 最終更新日時
  parentFolder?: string; // 親フォルダパス（階層表示用）
  isDirectory?: boolean; // ディレクトリかどうか
  children?: IProjectDocument[]; // ディレクトリの場合の子要素
  size?: number;       // ファイルサイズ
}

/**
 * タブ状態インターフェース
 */
export interface ITabState {
  id: string;          // タブID（current-status, requirements, file-browser等）
  title: string;       // タブタイトル
  active: boolean;     // アクティブ状態
  data?: any;          // タブに関連する追加データ
}

/**
 * ファイルブラウザの状態インターフェース
 */
export interface IFileBrowserState {
  currentPath: string;  // 現在のパス
  selectedFile: string; // 選択されているファイル
  fileList: IProjectDocument[]; // ファイル一覧
  expandedFolders: string[]; // 展開されているフォルダのパス
}