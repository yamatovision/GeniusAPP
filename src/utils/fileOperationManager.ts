import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { TerminalInterface } from '../ui/TerminalInterface';

/**
 * ファイル操作を管理するクラス
 * AIによるファイル作成・編集・削除を管理し、UIと連携する
 */
export class FileOperationManager {
  private static instance: FileOperationManager;
  private terminal: TerminalInterface | undefined;

  private constructor() {
    // シングルトンインスタンス
  }

  /**
   * シングルトンインスタンスを取得または作成
   */
  public static getInstance(): FileOperationManager {
    if (!FileOperationManager.instance) {
      FileOperationManager.instance = new FileOperationManager();
    }
    return FileOperationManager.instance;
  }

  /**
   * ターミナルインターフェースを設定
   */
  public setTerminalInterface(terminal: TerminalInterface): void {
    this.terminal = terminal;
  }

  /**
   * ファイルを作成または上書き
   */
  public async createFile(filePath: string, content: string): Promise<boolean> {
    try {
      // ファイル操作開始を通知
      this.notifyFileOperation(filePath, 'create');
      
      // ディレクトリが存在しない場合は作成
      const dirPath = path.dirname(filePath);
      await this.ensureDirectoryExists(dirPath);
      
      // ファイルに書き込み
      fs.writeFileSync(filePath, content, 'utf8');
      
      // ファイル操作完了を通知
      this.notifyFileOperationComplete(filePath, 'create');
      
      // エディタでファイルを開く
      await this.openFileInEditor(filePath);
      
      Logger.info(`ファイルを作成しました: ${filePath}`);
      return true;
    } catch (error) {
      Logger.error(`ファイル作成エラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`ファイル作成エラー: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * ファイルを修正
   */
  public async updateFile(filePath: string, oldContent: string, newContent: string): Promise<boolean> {
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが存在しません: ${filePath}`);
      }
      
      // ファイル操作開始を通知
      this.notifyFileOperation(filePath, 'modify');
      
      // 現在のファイル内容を読み込み
      const currentContent = fs.readFileSync(filePath, 'utf8');
      
      // oldContentが空の場合は、ファイル全体を置き換え
      let updatedContent;
      if (!oldContent) {
        updatedContent = newContent;
      } else {
        // 指定された部分のみを置き換え
        if (!currentContent.includes(oldContent)) {
          throw new Error('指定された内容がファイル内に見つかりません');
        }
        updatedContent = currentContent.replace(oldContent, newContent);
      }
      
      // ファイルに書き込み
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      
      // ファイル操作完了を通知
      this.notifyFileOperationComplete(filePath, 'modify');
      
      // エディタでファイルを開く
      await this.openFileInEditor(filePath);
      
      Logger.info(`ファイルを更新しました: ${filePath}`);
      return true;
    } catch (error) {
      Logger.error(`ファイル更新エラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`ファイル更新エラー: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * ファイルを削除
   */
  public async deleteFile(filePath: string): Promise<boolean> {
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが存在しません: ${filePath}`);
      }
      
      // ファイル操作開始を通知
      this.notifyFileOperation(filePath, 'delete');
      
      // ファイルを削除
      fs.unlinkSync(filePath);
      
      // ファイル操作完了を通知
      this.notifyFileOperationComplete(filePath, 'delete');
      
      Logger.info(`ファイルを削除しました: ${filePath}`);
      return true;
    } catch (error) {
      Logger.error(`ファイル削除エラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`ファイル削除エラー: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * ディレクトリが存在するかチェックし、存在しない場合は作成
   */
  public async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        Logger.debug(`ディレクトリを作成しました: ${dirPath}`);
      } catch (error) {
        Logger.error(`ディレクトリ作成エラー: ${(error as Error).message}`);
        throw error;
      }
    }
  }

  /**
   * ファイル操作の開始を通知
   */
  private notifyFileOperation(filePath: string, operation: 'create' | 'modify' | 'delete'): void {
    if (this.terminal) {
      this.terminal.notifyFileOperation(filePath, operation);
    }
  }

  /**
   * ファイル操作の完了を通知
   */
  private notifyFileOperationComplete(filePath: string, operation: 'create' | 'modify' | 'delete'): void {
    if (this.terminal) {
      this.terminal.notifyFileOperationComplete(filePath, operation);
    }
  }

  /**
   * 指定されたファイルをエディタで開く
   */
  private async openFileInEditor(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
      Logger.debug(`ファイルをエディタで開きました: ${filePath}`);
    } catch (error) {
      Logger.error(`ファイルを開く際にエラーが発生: ${(error as Error).message}`);
    }
  }
  
  /**
   * ファイルを文字列として読み込む
   */
  public async readFileAsString(filePath: string): Promise<string> {
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが存在しません: ${filePath}`);
      }
      
      // ファイルを読み込み
      const content = fs.readFileSync(filePath, 'utf8');
      Logger.info(`ファイルを読み込みました: ${filePath} (サイズ: ${content.length} バイト)`);
      return content;
    } catch (error) {
      Logger.error(`ファイル読み込みエラー: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * プロジェクトルートディレクトリを選択
   */
  public async selectProjectRoot(): Promise<string | undefined> {
    try {
      // フォルダ選択ダイアログを表示
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'プロジェクトルートを選択'
      });
      
      if (folderUri && folderUri.length > 0) {
        const rootPath = folderUri[0].fsPath;
        Logger.info(`プロジェクトルートを選択しました: ${rootPath}`);
        return rootPath;
      }
      
      return undefined;
    } catch (error) {
      Logger.error(`プロジェクトルート選択エラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`プロジェクトルートの選択に失敗しました: ${(error as Error).message}`);
      return undefined;
    }
  }
  
  /**
   * プロジェクト構造を作成
   * @param rootPath プロジェクトルートパス
   * @param files ファイル情報の配列
   * @returns 成功したかどうか
   */
  public async createProjectStructure(
    rootPath: string, 
    files: Array<{ path: string, content: string }>
  ): Promise<boolean> {
    try {
      // 進捗表示を初期化
      const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'プロジェクト構造を作成中...',
        cancellable: false
      }, async (progress) => {
        // 作成したファイル数をカウント
        let createdFiles = 0;
        
        // 既存のディレクトリをセット（重複作成を避けるため）
        const createdDirs = new Set<string>();
        
        // 総ファイル数
        const totalFiles = files.length;
        
        // 各ファイルを作成
        for (const file of files) {
          // ファイルの絶対パスを作成
          const absolutePath = path.join(rootPath, file.path);
          
          // 進捗更新
          progress.report({ 
            message: `ファイル作成中: ${file.path}`,
            increment: (1 / totalFiles) * 100
          });
          
          // ディレクトリが存在するか確認
          const dirPath = path.dirname(absolutePath);
          
          // ディレクトリ階層を確認して、各階層が存在するか確認
          const pathParts = dirPath.split(path.sep);
          let currentPath = '';
          
          // Windowsのドライブ文字を処理
          if (dirPath.match(/^[A-Za-z]:\\/)) {
            currentPath = pathParts[0] + path.sep;
            pathParts.shift();
          }
          
          // 各階層のディレクトリを順番に作成
          for (const part of pathParts) {
            if (!part) continue; // 空の部分をスキップ
            
            currentPath = path.join(currentPath, part);
            
            if (!createdDirs.has(currentPath)) {
              Logger.debug(`ディレクトリを確認/作成: ${currentPath}`);
              await this.ensureDirectoryExists(currentPath);
              createdDirs.add(currentPath);
            }
          }
          
          // 最終的なディレクトリパスを追加
          if (!createdDirs.has(dirPath)) {
            createdDirs.add(dirPath);
          }
          
          // ファイルを作成
          try {
            fs.writeFileSync(absolutePath, file.content, 'utf8');
            createdFiles++;
            
            // ファイル操作完了を通知
            this.notifyFileOperationComplete(absolutePath, 'create');
          } catch (fileError) {
            Logger.error(`ファイル作成エラー (${file.path}): ${(fileError as Error).message}`);
          }
        }
        
        return { createdFiles, totalFiles };
      });
      
      // 結果を表示
      const { createdFiles, totalFiles } = progress;
      if (createdFiles === totalFiles) {
        vscode.window.showInformationMessage(`プロジェクト構造を作成しました。${createdFiles}個のファイルを作成しました。`);
        return true;
      } else {
        vscode.window.showWarningMessage(`プロジェクト構造を作成しました（警告あり）。${createdFiles}/${totalFiles}個のファイルを作成しました。`);
        return createdFiles > 0;
      }
    } catch (error) {
      Logger.error(`プロジェクト構造作成エラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`プロジェクト構造の作成に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
}