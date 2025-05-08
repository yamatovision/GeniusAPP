import * as vscode from 'vscode';
import { IService, IProjectInfo } from './common';

/**
 * プロジェクト管理サービスインターフェース
 * プロジェクトの状態管理に関する責務を担当
 */
export interface IProjectService extends IService {
  // プロジェクト操作
  createProject(name: string, description: string): Promise<string>;
  loadExistingProject(projectPath?: string): Promise<IProjectInfo>;
  selectProject(name: string, path: string, activeTab?: string): Promise<void>;
  removeProject(name: string, path: string, id?: string): Promise<boolean>;
  
  // プロジェクト情報取得
  getActiveProject(): IProjectInfo | null;
  getAllProjects(): IProjectInfo[];
  getActiveProjectPath(): string;
  
  // プロジェクトパス関連
  setProjectPath(projectPath: string): Promise<void>;
  getProgressFilePath(): string;
  
  // タブ状態管理
  saveTabState(projectId: string, tabId: string): Promise<void>;
  
  // UI状態管理サポート
  refreshProjectsList(): Promise<IProjectInfo[]>;
  syncProjectUIState(projectPath: string): Promise<{
    allProjects: IProjectInfo[];
    activeProject: IProjectInfo | null;
    progressFilePath: string;
    progressFileExists: boolean;
  }>;
  
  // プロジェクト状態検証・修正
  ensureActiveProject(name: string, path: string, activeTab?: string): Promise<boolean>;
  
  // イベント
  onProjectSelected: vscode.Event<IProjectInfo>;
  onProjectCreated: vscode.Event<IProjectInfo>;
  onProjectRemoved: vscode.Event<IProjectInfo>;
  onProjectsUpdated: vscode.Event<IProjectInfo[]>;
  onProjectUIStateUpdated: vscode.Event<{
    allProjects: IProjectInfo[];
    activeProject: IProjectInfo | null;
    progressFilePath: string;
    progressFileExists: boolean;
  }>;
}