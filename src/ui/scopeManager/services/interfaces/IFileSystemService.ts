import * as vscode from 'vscode';
import { IService, IProjectDocument } from './common';

/**
 * ファイルシステムサービスインターフェース
 * ファイル操作関連の責務を担当
 */
export interface IFileSystemService extends IService {
  // ファイル操作
  readFile(filePath: string, fileType?: string): Promise<string>;
  readMarkdownFile(filePath: string): Promise<string>;
  createProgressFile(projectPath: string, projectName?: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  
  // ディレクトリ操作
  getDirectoryStructure(projectPath: string): Promise<string>;
  updateDirectoryStructure(projectPath: string): Promise<string>;
  ensureDirectoryExists(dirPath: string): Promise<void>;
  listDirectory(directoryPath: string, recursive?: boolean): Promise<IProjectDocument[]>;
  
  // ファイル監視
  setupFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void): vscode.Disposable;
  setupEnhancedFileWatcher(
    statusFilePath: string, 
    onFileChanged: (filePath: string) => void,
    options?: { delayedReadTime?: number }
  ): vscode.Disposable;
  setupStatusFileEventListener(
    projectPath: string, 
    statusFilePath: string, 
    onStatusUpdate: (filePath: string) => void
  ): vscode.Disposable;
  setupProjectFileWatcher(
    projectPath: string, 
    outputCallback: (filePath: string) => void
  ): vscode.Disposable;
  
  // ファイルパスとテンプレート取得
  getProgressFilePath(projectPath: string): string;
  findRequirementsFile(projectPath: string): Promise<string | null>;
  getFileType(filePath: string): string;
  
  // スコープマネージャーパネルから移行するファイル操作メソッド
  openFileInEditor(filePath: string): Promise<void>;
  navigateDirectory(dirPath: string, panel: vscode.WebviewPanel): Promise<void>;
  openFile(filePath: string, panel: vscode.WebviewPanel): Promise<void>;
  refreshFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void>;
  initializeFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void>;
  
  // 新規メソッド
  loadProgressFile(projectPath: string, outputCallback?: (content: string) => void): Promise<string>;
  
  // イベント
  onProgressFileChanged: vscode.Event<string>;
  onDirectoryStructureUpdated: vscode.Event<string>;
  onFileBrowserUpdated: vscode.Event<IProjectDocument[]>;
}