import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IFileWatcherService } from '../interfaces/IFileWatcherService';
import { Logger } from '../../../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../../services/AppGeniusEventBus';

/**
 * ファイル監視サービスの実装クラス
 * ScopeManagerPanelのファイル監視関連の責務を担当
 */
export class FileWatcherServiceImpl implements IFileWatcherService {
  private static instance: FileWatcherServiceImpl;
  private disposables: vscode.Disposable[] = [];

  public static getInstance(): FileWatcherServiceImpl {
    if (!FileWatcherServiceImpl.instance) {
      FileWatcherServiceImpl.instance = new FileWatcherServiceImpl();
    }
    return FileWatcherServiceImpl.instance;
  }

  private constructor() {}

  /**
   * プロジェクトパスからプロジェクトIDを取得する（補助メソッド）
   * @param projectPath プロジェクトパス
   * @returns プロジェクトID（パスから抽出）
   */
  private _getProjectIdFromPath(projectPath: string): string {
    if (!projectPath) {
      return '';
    }

    // パスの最後の部分をプロジェクトIDとして使用
    const parts = projectPath.split(/[/\\]/);
    const lastPart = parts[parts.length - 1];

    // IDとして使えるように整形（空白を削除し、特殊文字を置き換え）
    return lastPart.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * プロジェクトのファイル監視を設定
   */
  public setupProjectFileWatchers(
    projectPath: string,
    onProgressFileChanged: (filePath: string) => Promise<void>,
    onRequirementsFileChanged: (filePath: string) => Promise<void>,
    options?: {
      fileSystemService?: any,
      eventBus?: any,
      activeTab?: string
    }
  ): vscode.Disposable {
    // 既存の監視を破棄
    this.dispose();

    if (!projectPath) {
      return { dispose: () => {} };
    }

    // 監視するウォッチャーを保持する配列
    const watchers: vscode.Disposable[] = [];

    const fileSystemService = options?.fileSystemService;
    const eventBus = options?.eventBus || AppGeniusEventBus.getInstance();

    try {
      // 1. 進捗ファイルの監視設定
      this.setupProgressFileWatcher(projectPath, fileSystemService, onProgressFileChanged, watchers);

      // 2. 要件定義ファイルの監視設定
      this.setupRequirementsFileWatcher(projectPath, fileSystemService, onRequirementsFileChanged, watchers);

      // 3. イベントリスナー設定
      this.setupEventListeners(projectPath, fileSystemService, onRequirementsFileChanged, eventBus, watchers);

      // 重要：初期読み込み（特に要件定義タブ対応）
      this.initializeInitialFileContent(projectPath, fileSystemService, onProgressFileChanged, onRequirementsFileChanged, { activeTab: options?.activeTab });

      // ローカル変数からクラスのdisposablesに移動
      this.disposables = watchers;

      // ウォッチャーのDisposableを返す
      return {
        dispose: () => this.dispose()
      };
    } catch (error) {
      Logger.error('FileWatcherService: ファイル監視の設定中にエラーが発生しました', error as Error);
      return {
        dispose: () => {
          // 作成済みのウォッチャーをすべて破棄
          for (const watcher of watchers) {
            watcher.dispose();
          }
        }
      };
    }
  }
  
  /**
   * docsディレクトリの監視を設定
   * ファイルビューワー用にdocsディレクトリ全体（サブディレクトリを含む）の変更を監視する
   * 
   * @param projectPath プロジェクトパス
   * @param fileSystemService FileSystemServiceのインスタンス
   * @param onFileChanged ファイル変更時のコールバック
   * @param options 追加オプション（delayedReadTime等）
   * @returns ディスポーザブルオブジェクト
   */
  public setupDocsDirectoryWatcher(
    projectPath: string,
    fileSystemService: any,
    onFileChanged: (filePath: string) => void,
    options?: { delayedReadTime?: number }
  ): vscode.Disposable {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      if (!fileSystemService) {
        throw new Error('fileSystemServiceが提供されていません');
      }

      Logger.info(`FileWatcherService: docsディレクトリの監視を設定します: ${projectPath}`);
      
      // docsディレクトリのパスを取得
      const docsDir = path.join(projectPath, 'docs');
      
      // ディレクトリの存在を確認
      if (!fs.existsSync(docsDir)) {
        Logger.warn(`FileWatcherService: docsディレクトリが存在しません: ${docsDir}`);
        return { dispose: () => {} };
      }
      
      // FileSystemServiceImpl.setupDocsDirectoryWatcherを使って監視を設定
      const docsWatcher = fileSystemService.setupDocsDirectoryWatcher(
        projectPath,
        (filePath: string) => {
          Logger.info(`FileWatcherService: docsディレクトリ内のファイル変更を検出: ${filePath}`);
          
          try {
            // ファイル変更イベントをコールバックに通知
            onFileChanged(filePath);
            
            // イベントバスにも通知
            const eventBus = AppGeniusEventBus.getInstance();
            eventBus.emit(
              AppGeniusEventType.DOCS_FILE_CHANGED,
              {
                path: filePath,
                timestamp: Date.now()
              }, 
              'FileWatcherService', 
              this._getProjectIdFromPath(projectPath)
            );
            
            Logger.info(`FileWatcherService: ファイル変更イベントを送信しました: ${filePath}`);
          } catch (error) {
            Logger.error(`FileWatcherService: ファイル変更イベント処理中にエラーが発生しました: ${filePath}`, error as Error);
          }
        },
        { delayedReadTime: options?.delayedReadTime || 500 }
      );
      
      Logger.info(`FileWatcherService: docsディレクトリの監視を設定しました: ${docsDir}`);
      return docsWatcher;
    } catch (error) {
      Logger.error('FileWatcherService: docsディレクトリ監視の設定中にエラーが発生しました', error as Error);
      return { dispose: () => {} };
    }
  }

  /**
   * 初期ファイル内容の読み込み（要件定義タブ対応）
   */
  private async initializeInitialFileContent(
    projectPath: string,
    fileSystemService: any,
    onProgressFileChanged: (filePath: string) => Promise<void>,
    onRequirementsFileChanged: (filePath: string) => Promise<void>,
    options?: { activeTab?: string }
  ): Promise<void> {
    try {
      // activeTabがオプションで直接指定されていればそれを優先使用
      let activeTab = options?.activeTab || 'scope-progress';

      // オプションで指定されていない場合のみプロジェクト情報から取得を試みる
      if (!options?.activeTab) {
        try {
          if (typeof fileSystemService.getActiveProject === 'function') {
            const activeProject = fileSystemService.getActiveProject();
            if (activeProject?.metadata?.activeTab) {
              activeTab = activeProject.metadata.activeTab;
            }
          }
        } catch (err) {
          // 取得できない場合は無視してデフォルト値を使用
        }
      }

      Logger.info(`FileWatcherService: 初期化時のアクティブタブ=${activeTab}`);

      // アクティブタブに応じた初期処理
      if (activeTab === 'requirements') {
        // 要件定義タブが選択されている場合は要件定義ファイルを読み込む
        await this.loadRequirementsFileNow(projectPath, onRequirementsFileChanged, { fileSystemService });
      } else if (activeTab === 'scope-progress') {
        // 進捗ファイルが選択されている場合は進捗ファイルを読み込む
        // (通常は自動的に行われるが、念のため明示的に実行)
        const progressFilePath = fileSystemService.getProgressFilePath(projectPath);
        if (progressFilePath && await fileSystemService.fileExists(progressFilePath)) {
          await onProgressFileChanged(progressFilePath);
        }
      }
    } catch (error) {
      Logger.error('FileWatcherService: 初期ファイル内容の読み込みに失敗しました', error as Error);
    }
  }

  /**
   * 要件定義ファイルを明示的に読み込む（初期表示用）
   */
  public async loadRequirementsFileNow(
    projectPath: string,
    callback: (filePath: string) => Promise<void>,
    options?: { fileSystemService?: any }
  ): Promise<string> {
    try {
      Logger.info(`FileWatcherService: 要件定義ファイルを明示的に読み込みます：${projectPath}`);
      const fileSystemService = options?.fileSystemService;
      if (!fileSystemService) {
        throw new Error('fileSystemServiceが提供されていません');
      }

      // 要件定義ファイルのパスを取得
      // 進捗ファイルと同様にサービスのメソッドを経由してパスを取得
      const requirementsFilePath = fileSystemService.getRequirementsFilePath(projectPath);

      // デバッグログを追加
      Logger.info(`FileWatcherService: 取得した要件定義ファイルパス: ${requirementsFilePath}`);

      if (requirementsFilePath && await fileSystemService.fileExists(requirementsFilePath)) {
        // ファイル内容をコールバック経由で読み込む
        await callback(requirementsFilePath);
        Logger.info(`FileWatcherService: 要件定義ファイルを初期読み込みしました: ${requirementsFilePath}`);
      } else {
        Logger.warn('FileWatcherService: 要件定義ファイルが見つかりません');
      }

      return requirementsFilePath;
    } catch (error) {
      Logger.error('FileWatcherService: 要件定義ファイルの読み込みに失敗しました', error as Error);
      throw error;
    }
  }

  /**
   * 進捗ファイルの監視を設定
   */
  private setupProgressFileWatcher(
    projectPath: string,
    fileSystemService: any,
    onProgressFileChanged: (filePath: string) => Promise<void>,
    watchers: vscode.Disposable[]
  ): void {
    try {
      Logger.info(`FileWatcherService: 進捗ファイルの監視を設定します`);
      const progressFilePath = fileSystemService.getProgressFilePath(projectPath);

      // デバッグログ
      Logger.info(`FileWatcherService: 進捗ファイル監視設定: ${progressFilePath}`);

      // 進捗ファイルの監視設定
      const progressWatcher = fileSystemService.setupEnhancedFileWatcher(
        progressFilePath,
        async (filePath: string) => {
          Logger.info(`FileWatcherService: 進捗ファイル変更を検出: ${filePath}`);
          try {
            // 進捗ファイル変更をコールバックに通知
            await onProgressFileChanged(filePath);

            // 特別なイベントメッセージを発行（要件定義ファイルと同様の処理）
            if (fileSystemService.dispatchMessage && typeof fileSystemService.dispatchMessage === 'function') {
              // messageDispatchServiceを使用して特別な更新メッセージを送信
              fileSystemService.dispatchMessage({
                command: 'progressFileChanged',
                filePath: filePath,
                timestamp: Date.now()
              });
              Logger.info(`FileWatcherService: 進捗ファイル変更イベントを送信しました: ${filePath}`);
            }
          } catch (readError) {
            Logger.error(`FileWatcherService: 進捗ファイル読み込みエラー: ${readError}`);
          }
        },
        { delayedReadTime: 500 } // 500ms後に遅延読み込み
      );

      watchers.push(progressWatcher);
      Logger.info(`FileWatcherService: 進捗ファイルの監視を設定しました: ${progressFilePath}`);
    } catch (error) {
      Logger.error('FileWatcherService: 進捗ファイル監視設定中にエラーが発生しました', error as Error);
    }
  }

  /**
   * 要件定義ファイルの監視を設定
   */
  private setupRequirementsFileWatcher(
    projectPath: string,
    fileSystemService: any,
    onRequirementsFileChanged: (filePath: string) => Promise<void>,
    watchers: vscode.Disposable[]
  ): void {
    try {
      Logger.info(`FileWatcherService: 要件定義ファイルの監視を設定します`);
      // 進捗ファイルと同様にサービスのメソッドを経由してパスを取得
      const requirementsFilePath = fileSystemService.getRequirementsFilePath(projectPath);

      // デバッグログ
      Logger.info(`FileWatcherService: 要件定義ファイル監視設定: ${requirementsFilePath}`);

      // 要件定義ファイルの監視設定 - 進捗ファイルと同じく条件付き分岐でsetupRequirementsWatcherを使用
      // ただし必ず遅延読み込みオプションを適用
      const delayReadTimeOption = { delayedReadTime: 500 }; // 500ms後に遅延読み込み（進捗ファイルと同様）
      const requirementsWatcher = fileSystemService.setupRequirementsWatcher && typeof fileSystemService.setupRequirementsWatcher === 'function'
        ? fileSystemService.setupRequirementsWatcher(
            requirementsFilePath,
            async (filePath: string) => {
              Logger.info(`FileWatcherService: 要件定義ファイル変更を検出: ${filePath}`);
              try {
                // 要件定義ファイル変更をコールバックに通知
                await onRequirementsFileChanged(filePath);

                // 特別なイベントメッセージを発行（進捗ファイルと同様の処理）
                if (fileSystemService.dispatchMessage && typeof fileSystemService.dispatchMessage === 'function') {
                  // messageDispatchServiceを使用して特別な更新メッセージを送信
                  fileSystemService.dispatchMessage({
                    command: 'requirementsFileChanged',
                    filePath: filePath,
                    timestamp: Date.now()
                  });
                  Logger.info(`FileWatcherService: 要件定義ファイル変更イベントを送信しました: ${filePath}`);
                }
              } catch (readError) {
                Logger.error(`FileWatcherService: 要件定義ファイル読み込みエラー: ${readError}`);
              }
            },
            delayReadTimeOption // 遅延読み込み設定を明示的に渡す
          )
        : fileSystemService.setupEnhancedFileWatcher(
            requirementsFilePath,
            async (filePath: string) => {
              Logger.info(`FileWatcherService: 要件定義ファイル変更を検出（fallback）: ${filePath}`);
              try {
                await onRequirementsFileChanged(filePath);
                if (fileSystemService.dispatchMessage && typeof fileSystemService.dispatchMessage === 'function') {
                  fileSystemService.dispatchMessage({
                    command: 'requirementsFileChanged',
                    filePath: filePath,
                    timestamp: Date.now()
                  });
                }
              } catch (readError) {
                Logger.error(`FileWatcherService: 要件定義ファイル読み込みエラー（fallback）: ${readError}`);
              }
            },
            delayReadTimeOption // 遅延読み込み設定を共通化
          );

      watchers.push(requirementsWatcher);
      Logger.info(`FileWatcherService: 要件定義ファイルの監視を設定しました: ${requirementsFilePath}`);
    } catch (error) {
      Logger.error(`FileWatcherService: 要件定義ファイル監視設定中にエラーが発生しました`, error as Error);
    }
  }

  /**
   * 従来の方法で要件定義ファイルの監視を設定
   */
  private async setupLegacyRequirementsFileWatcher(
    projectPath: string,
    fileSystemService: any,
    onRequirementsFileChanged: (filePath: string) => Promise<void>,
    watchers: vscode.Disposable[]
  ): Promise<void> {
    try {
      // 要件定義ファイルのパスを取得
      let requirementsFilePath = null;

      // getRequirementsFilePathメソッドが利用可能な場合はそれを使用
      if (typeof fileSystemService.getRequirementsFilePath === 'function') {
        requirementsFilePath = await fileSystemService.getRequirementsFilePath(projectPath);
      } else if (typeof fileSystemService.findRequirementsFile === 'function') {
        // 代わりにfindRequirementsFileメソッドを使用
        requirementsFilePath = await fileSystemService.findRequirementsFile(projectPath);
      }

      if (requirementsFilePath) {
        // 通常のファイルウォッチャーを使用
        const requirementsWatcher = fileSystemService.setupEnhancedFileWatcher(
          requirementsFilePath,
          async (filePath: string) => {
            Logger.info(`FileWatcherService: 要件定義ファイル変更を検出: ${filePath} (従来方式)`);
            try {
              // 即時反映するようにする
              await onRequirementsFileChanged(filePath);

              // イベントバスを通じて他のコンポーネントに通知
              const eventBus = AppGeniusEventBus.getInstance();
              eventBus.emit(AppGeniusEventType.REQUIREMENTS_UPDATED, {
                path: filePath,
                timestamp: Date.now()
              }, 'FileWatcherService', this._getProjectIdFromPath(projectPath));
            } catch (readError) {
              Logger.error(`FileWatcherService: 要件定義ファイル読み込みエラー: ${readError}`);
            }
          },
          { delayedReadTime: 500 } // 500ms後に遅延読み込み
        );

        watchers.push(requirementsWatcher);
        Logger.info(`FileWatcherService: 要件定義ファイルの監視を設定しました (従来方式): ${requirementsFilePath}`);
      } else {
        Logger.warn(`FileWatcherService: 要件定義ファイルが見つからないため監視を設定できませんでした`);
      }
    } catch (error) {
      Logger.error(`FileWatcherService: 要件定義ファイル監視の従来方式での設定中にエラー`, error as Error);
    }
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(
    projectPath: string,
    fileSystemService: any,
    onRequirementsFileChanged: (filePath: string) => Promise<void>,
    eventBus: any,
    watchers: vscode.Disposable[]
  ): void {
    // 要件定義ファイル更新イベントをリッスン
    const requirementsUpdateListener = eventBus.onEventType(
      AppGeniusEventType.REQUIREMENTS_UPDATED,
      async (event: any) => {
        // 自分自身が送信したイベントは無視
        if (event.source === 'FileWatcherService') {
          return;
        }

        Logger.info(`FileWatcherService: 要件定義ファイル更新イベントを受信: ${(event.data as any).path || 'undefined'}`);

        // 要件定義ファイルの内容を更新
        const requirementsPath = (event.data as any).path;
        if (requirementsPath && await fileSystemService.fileExists(requirementsPath)) {
          // 要件定義ファイルの変更を即時反映
          await onRequirementsFileChanged(requirementsPath);
          Logger.info(`FileWatcherService: 要件定義ファイルを更新しました: ${requirementsPath}`);

          // タブの状態に関係なく要件定義ファイルを更新するよう促す
          if (fileSystemService.dispatchMessage && typeof fileSystemService.dispatchMessage === 'function') {
            try {
              // messageDispatchServiceを使用して特別な更新メッセージを送信
              fileSystemService.dispatchMessage({
                command: 'requirementsFileChanged',
                filePath: requirementsPath,
                timestamp: Date.now()
              });
              Logger.info(`FileWatcherService: requirementsFileChangedメッセージを送信しました: ${requirementsPath}`);
            } catch (dispatchError) {
              Logger.error(`FileWatcherService: メッセージ送信エラー`, dispatchError as Error);
            }
          }
        }
      }
    );

    // リスナーの追加
    watchers.push(requirementsUpdateListener);
  }

  /**
   * すべての監視を破棄
   */
  public dispose(): void {
    try {
      for (const disposable of this.disposables) {
        disposable.dispose();
      }
      this.disposables = [];

      Logger.info('FileWatcherService: すべての監視を破棄しました');
    } catch (error) {
      Logger.error('FileWatcherService: 監視破棄中にエラーが発生しました', error as Error);
    }
  }
}