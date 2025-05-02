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
}

/**
 * ScopeManagerの状態変更イベント
 */
export interface ScopeManagerStateChangeEvent {
  type: ScopeManagerStateChangeType;
  data?: any;
}

/**
 * 状態変更タイプ
 */
export enum ScopeManagerStateChangeType {
  PROJECT_PATH_CHANGED = 'projectPathChanged',
  MARKDOWN_CONTENT_UPDATED = 'markdownContentUpdated',
  DIRECTORY_STRUCTURE_UPDATED = 'directoryStructureUpdated',
  PROJECTS_UPDATED = 'projectsUpdated',
  ACTIVE_PROJECT_CHANGED = 'activeProjectChanged',
  SHARING_HISTORY_UPDATED = 'sharingHistoryUpdated',
  SHARE_RESULT = 'shareResult',
  PROJECT_STATE_SYNC = 'projectStateSync',
}

/**
 * WebViewメッセージ
 */
export interface WebViewMessage {
  command: string;
  [key: string]: any;
}

/**
 * WebViewメッセージハンドラー
 */
export interface IWebViewMessageHandler {
  handleMessage(message: WebViewMessage): Promise<void>;
  registerHandler(command: string, handler: (message: WebViewMessage) => Promise<void>): void;
}