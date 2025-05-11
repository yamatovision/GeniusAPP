import * as vscode from 'vscode';

/**
 * ファイル監視サービスインターフェース
 * ScopeManagerPanelのファイル監視関連の責務を分離
 */
export interface IFileWatcherService {
  /**
   * プロジェクトのファイル監視を設定
   * @param projectPath プロジェクトのルートパス
   * @param onProgressFileChanged 進捗ファイル変更時のコールバック
   * @param onRequirementsFileChanged 要件定義ファイル変更時のコールバック
   * @param options 追加オプション（ファイルシステムサービスなど）
   * @returns ファイル監視を解除するためのDisposable
   */
  setupProjectFileWatchers(
    projectPath: string,
    onProgressFileChanged: (filePath: string) => Promise<void>,
    onRequirementsFileChanged: (filePath: string) => Promise<void>,
    options?: {
      fileSystemService?: any,
      eventBus?: any,
      activeTab?: string
    }
  ): vscode.Disposable;

  /**
   * 要件定義ファイルを明示的に読み込む（初期表示用）
   * @param projectPath プロジェクトパス
   * @param callback 読み込んだファイルパスを処理するコールバック
   * @param options オプション
   * @returns 要件定義ファイルのパス、見つからない場合はnull
   */
  loadRequirementsFileNow(
    projectPath: string,
    callback: (filePath: string) => Promise<void>,
    options?: { fileSystemService?: any }
  ): Promise<string | null>;

  /**
   * すべてのファイル監視を破棄
   */
  dispose(): void;
}