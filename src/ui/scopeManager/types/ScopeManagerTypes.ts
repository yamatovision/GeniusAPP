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