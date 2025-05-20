import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../utils/logger';
import { FileOperationManager } from '../../../../utils/fileOperationManager';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../../services/AppGeniusEventBus';
import { IFileSystemService } from '../interfaces';
import { IProjectDocument } from '../../types/ScopeManagerTypes';
import { IWebViewCommunication } from '../interfaces/IWebViewCommunication';
import { IMessageDispatchService } from '../interfaces/IMessageDispatchService';
import { Message } from '../interfaces/common';

/**
 * ファイルシステムサービス実装
 * IFileSystemServiceインターフェースとIWebViewCommunicationインターフェースの実装
 */
export class FileSystemServiceImpl implements IFileSystemService, IWebViewCommunication {
  private _onProgressFileChanged = new vscode.EventEmitter<string>();
  public readonly onProgressFileChanged = this._onProgressFileChanged.event;

  private _onDirectoryStructureUpdated = new vscode.EventEmitter<string>();
  public readonly onDirectoryStructureUpdated = this._onDirectoryStructureUpdated.event;

  private _onFileBrowserUpdated = new vscode.EventEmitter<IProjectDocument[]>();
  public readonly onFileBrowserUpdated = this._onFileBrowserUpdated.event;

  private _disposables: vscode.Disposable[] = [];
  private _fileManager: FileOperationManager;
  private _fileWatcher: vscode.Disposable | null = null;
  private _docsDirWatcher: fs.FSWatcher | null = null;
  private _extensionPath: string;
  private _currentFileList: IProjectDocument[] = [];
  private _messageDispatchService: IMessageDispatchService | null = null;

  /**
   * メッセージをディスパッチする（パネルが必要ない場合のメッセージ送信用）
   * 任意のコマンドを登録されたメッセージハンドラに送信する
   * @param message 送信するメッセージ
   */
  public dispatchMessage(message: Message): void {
    try {
      if (this._messageDispatchService) {
        // 登録されているパネルに送信（デフォルトパネルがあれば使用）
        const activePanel = this._getPanelFromMessageDispatchService();
        if (activePanel) {
          this._messageDispatchService.handleMessage(message, activePanel);
          Logger.info(`FileSystemService: メッセージをディスパッチしました: ${message.command}`);
        } else {
          Logger.warn(`FileSystemService: アクティブパネルが見つかりません: ${message.command}`);
        }
      } else {
        Logger.warn(`FileSystemService: messageDispatchServiceが設定されていないため、メッセージをディスパッチできません: ${message.command}`);
      }
    } catch (error) {
      Logger.error(`FileSystemService: メッセージディスパッチエラー: ${message.command}`, error as Error);
    }
  }

  /**
   * MessageDispatchServiceからパネルを取得する（内部ヘルパー）
   * @returns 利用可能なWebViewパネル、見つからない場合はnull
   */
  private _getPanelFromMessageDispatchService(): vscode.WebviewPanel | null {
    try {
      // MessageDispatchServiceImpl実装の内部構造に依存する実装（注意が必要）
      if (this._messageDispatchService) {
        // @ts-ignore - MessageDispatchServiceImplの内部プロパティにアクセス
        const activePanel = (this._messageDispatchService as any)._activePanel || null;
        if (activePanel) {
          return activePanel;
        }

        // UIStateServiceから取得を試みる
        // @ts-ignore - MessageDispatchServiceImplの内部プロパティにアクセス
        const uiStateService = (this._messageDispatchService as any)._uiStateService;
        if (uiStateService && typeof uiStateService.getPanel === 'function') {
          return uiStateService.getPanel();
        }
      }
      return null;
    } catch (error) {
      Logger.warn('FileSystemService: パネル取得中にエラー', error as Error);
      return null;
    }
  }
  
  // シングルトンインスタンス
  private static _instance: FileSystemServiceImpl;
  
  /**
   * シングルトンインスタンスの取得
   * @returns FileSystemServiceImplのインスタンス
   */
  public static getInstance(): FileSystemServiceImpl {
    if (!FileSystemServiceImpl._instance) {
      FileSystemServiceImpl._instance = new FileSystemServiceImpl();
    }
    return FileSystemServiceImpl._instance;
  }
  
  private constructor() {
    this._fileManager = FileOperationManager.getInstance();
    // 拡張機能のパスを取得
    this._extensionPath = vscode.extensions.getExtension('mikoto.appgenius-ai')?.extensionPath || '';
  }
  
  /**
   * マークダウンファイルを読み込む
   * @param filePath ファイルパス
   */
  public async readMarkdownFile(filePath: string): Promise<string> {
    // ファイル読み込みを完全にFileOperationManagerに委譲
    const content = await this._fileManager.readFileAsString(filePath);
    
    // イベント通知のみをこのレイヤーで処理
    this._onProgressFileChanged.fire(filePath);
    
    return content;
  }
  
  /**
   * ファイルを読み込む
   * @param filePath ファイルパス
   * @param fileType ファイルのタイプ（オプション）
   */
  public async readFile(filePath: string, fileType?: string): Promise<string> {
    // ファイルのタイプが指定されていない場合は拡張子から判定
    const type = fileType || this.getFileType(filePath);
    
    // マークダウンファイルの場合はイベント通知付きの処理を使用
    if (type === 'markdown') {
      return await this.readMarkdownFile(filePath);
    }
    
    // 通常のファイル読み込みは完全に委譲
    return await this._fileManager.readFileAsString(filePath);
  }
  
  /**
   * ディレクトリ構造を取得
   * @param projectPath プロジェクトのパス
   * @returns ディレクトリ構造のJSONシリアライズ文字列
   */
  public async getDirectoryStructure(projectPath: string): Promise<string> {
    if (!projectPath) {
      throw new Error('プロジェクトパスが指定されていません');
    }
    
    try {
      // ディレクトリが存在するか確認
      if (!fs.existsSync(projectPath)) {
        return '{}';
      }
      
      // ディレクトリ構造を再帰的に読み込む
      const structure = await this._readDirectoryStructure(projectPath);
      
      // 構造をJSON形式でシリアライズ
      const structureJson = JSON.stringify(structure);
      
      // ディレクトリ構造が更新されたことをイベントとして通知
      this._onDirectoryStructureUpdated.fire(structureJson);
      
      return structureJson;
    } catch (error) {
      // エラーログをシンプルに
      throw error;
    }
  }
  
  /**
   * ディレクトリ構造を更新
   * @param projectPath プロジェクトのパス
   * @returns ディレクトリ構造のJSONシリアライズ文字列
   */
  public async updateDirectoryStructure(projectPath: string): Promise<string> {
    // getDirectoryStructureのエイリアス（直接委譲）
    return await this.getDirectoryStructure(projectPath);
  }
  
  /**
   * ディレクトリが存在しない場合は作成する
   * @param dirPath ディレクトリのパス
   */
  public async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!dirPath) {
      throw new Error('ディレクトリパスが指定されていません');
    }
    
    // FileOperationManagerに完全に委譲
    return this._fileManager.ensureDirectoryExists(dirPath);
  }
  
  /**
   * 進捗ファイルのパスを取得
   * @param projectPath オプショナル - 指定しない場合はProjectServiceImplから最新のパスを取得
   * @returns 進捗ファイルのパス
   */
  public getProgressFilePath(projectPath?: string): string {
    // プロジェクトパスが指定されていない場合はProjectServiceImplから最新のパスを取得
    if (!projectPath) {
      try {
        // ProjectServiceImplのインスタンスを取得
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ProjectServiceImpl } = require('../implementations/ProjectServiceImpl');
        const projectService = ProjectServiceImpl.getInstance();
        
        // 最新のアクティブプロジェクトパスを取得
        projectPath = projectService.getActiveProjectPath();
        
        Logger.info(`FileSystemService: ProjectServiceImplから最新プロジェクトパスを取得: ${projectPath}`);
      } catch (error) {
        Logger.error('FileSystemService: ProjectServiceImplからのパス取得に失敗', error as Error);
        throw new Error('有効なプロジェクトが選択されていません');
      }
    }
    
    if (!projectPath) {
      throw new Error('プロジェクトパスが取得できません');
    }
    
    // docs/SCOPE_PROGRESS.mdというパスを構築
    const docsDir = path.join(projectPath, 'docs');
    return path.join(docsDir, 'SCOPE_PROGRESS.md');
  }
  
  /**
   * 進捗ファイルを作成（存在しない場合）
   * @param projectPath プロジェクトパス
   * @param projectName プロジェクト名（オプション）
   */
  public async createProgressFile(projectPath: string, projectName?: string): Promise<void> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // docs ディレクトリのパスを構築
      const docsDir = path.join(projectPath, 'docs');
      
      // docs ディレクトリが存在することを確認し、なければ作成
      await this.ensureDirectoryExists(docsDir);
      
      // 進捗ファイルのパスを構築
      const progressFilePath = this.getProgressFilePath(projectPath);
      
      // 進捗ファイルが既に存在する場合は何もしない
      if (await this.fileExists(progressFilePath)) {
        return;
      }
      
      // プロジェクト名が指定されていない場合はディレクトリ名を使用
      const name = projectName || path.basename(projectPath);
      
      // テンプレート内容を構築
      const templateContent = this._createProgressTemplate(name);
      
      // ファイルを書き込み
      await this._fileManager.writeFile(progressFilePath, templateContent);
      
      Logger.info(`FileSystemService: 進捗ファイルを作成しました: ${progressFilePath}`);
    } catch (error) {
      Logger.error(`FileSystemService: 進捗ファイル作成中にエラーが発生しました: ${projectPath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * 進捗ファイルのテンプレートを作成
   * @param projectName プロジェクト名
   * @returns テンプレート内容
   */
  private _createProgressTemplate(projectName: string): string {
    try {
      // TemplateServiceを使用してテンプレートを取得
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TemplateService } = require('../../../../utils/TemplateService');
      const templateService = TemplateService.getInstance();
      const template = templateService.getScopeProgressTemplate();
      
      // プロジェクト名を置換
      return templateService.processTemplate(template, {
        'プロジェクト名': projectName
      });
    } catch (error) {
      // エラー時はロガーに記録して元の実装にフォールバック
      Logger.error('テンプレート処理中にエラーが発生しました', error as Error);
      
      // フォールバック: 直接テンプレートを生成
      const today = new Date().toISOString().split('T')[0];
      return `# ${projectName} 開発プロセス進捗状況

**バージョン**: 0.1 (初期版)  
**最終更新日**: ${today}  
**ステータス**: プロジェクト作成完了・要件定義開始段階

## 1. 基本情報

- **ステータス**: 開始段階 (5% 完了)
- **完了タスク数**: 1/20
- **進捗率**: 5%
- **次のマイルストーン**: 要件定義完了 (目標: [日付])`;
    }
  }
  
  /**
   * ファイルが存在するか確認する
   * @param filePath ファイルパス
   * @returns ファイルが存在する場合はtrue、それ以外はfalse
   */
  public async fileExists(filePath: string): Promise<boolean> {
    try {
      if (!filePath) {
        return false;
      }
      
      return new Promise<boolean>((resolve) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
          resolve(!err);
        });
      });
    } catch (error) {
      Logger.error(`FileSystemService: ファイル存在確認に失敗しました: ${filePath}`, error as Error);
      return false;
    }
  }
  
  /**
   * 拡張されたファイル監視機能
   * ファイル変更時の遅延読み込みオプションなど追加機能を提供
   * @param statusFilePath 監視対象のステータスファイルパス
   * @param onFileChanged ファイル変更時のコールバック
   * @param options オプション設定（遅延読み込み時間など）
   */
  public setupEnhancedFileWatcher(
    statusFilePath: string, 
    onFileChanged: (filePath: string) => void,
    options?: { delayedReadTime?: number }
  ): vscode.Disposable {
    try {
      // 基本的なファイル監視を設定
      const baseWatcher = this.setupFileWatcher(statusFilePath, async (filePath) => {
        // ファイル変更時に即時通知
        Logger.info(`FileSystemService(Enhanced): ファイル変更検出: ${filePath}`);
        
        try {
          // 即時読み込みと通知
          await this.readMarkdownFile(filePath);
          onFileChanged(filePath);
          
          // 遅延読み込みオプションが有効な場合は2回目の読み込みを実行
          const delayTime = options?.delayedReadTime || 100;
          if (delayTime > 0) {
            setTimeout(async () => {
              Logger.info(`FileSystemService(Enhanced): 遅延読み込み(${delayTime}ms後): ${filePath}`);
              
              try {
                await this.readMarkdownFile(filePath);
                onFileChanged(filePath);
              } catch (delayedError) {
                Logger.warn(`FileSystemService(Enhanced): 遅延読み込み中にエラー: ${filePath}`, delayedError as Error);
              }
            }, delayTime);
          }
        } catch (readError) {
          Logger.warn(`FileSystemService(Enhanced): 読み込み中にエラー: ${filePath}`, readError as Error);
        }
      });
      
      return baseWatcher;
    } catch (error) {
      Logger.error(`FileSystemService: 拡張ファイル監視の設定に失敗しました: ${statusFilePath}`, error as Error);
      // エラー時は空のDisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * ファイル監視を設定
   * @param statusFilePath 監視対象のステータスファイルパス
   * @param onFileChanged ファイル変更時のコールバック
   */
  public setupFileWatcher(
    statusFilePath: string,
    onFileChanged: (filePath: string) => void
  ): vscode.Disposable {
    try {
      if (!statusFilePath) {
        throw new Error('ファイルパスが指定されていません');
      }
      
      // VSCodeのファイルシステムウォッチャーを使用
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.file(path.dirname(statusFilePath)),
          path.basename(statusFilePath)
        )
      );
      
      // ファイル変更イベントをハンドリング
      watcher.onDidChange((uri) => {
        Logger.info(`FileSystemService: ファイル変更を検出: ${uri.fsPath}`);
        onFileChanged(uri.fsPath);
      });
      
      // ファイル作成イベントをハンドリング
      watcher.onDidCreate((uri) => {
        Logger.info(`FileSystemService: ファイル作成を検出: ${uri.fsPath}`);
        onFileChanged(uri.fsPath);
      });
      
      // ディスポーザブルリストに追加して管理
      this._disposables.push(watcher);
      Logger.info(`FileSystemService: ファイルウォッチャーを設定しました: ${statusFilePath}`);
      
      return watcher;
    } catch (error) {
      Logger.error(`FileSystemService: ファイルウォッチャーの設定中にエラーが発生しました: ${statusFilePath}`, error as Error);
      // エラー時は空のDisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * ステータスファイルの変更イベントリスナーを設定
   * @param projectPath プロジェクトのパス
   * @param statusFilePath ステータスファイルのパス
   * @param onStatusUpdate ステータス更新時のコールバック
   */
  public setupStatusFileEventListener(
    projectPath: string,
    statusFilePath: string,
    onStatusUpdate: (filePath: string) => void
  ): vscode.Disposable {
    try {
      // ファイル監視を設定
      const fileWatcher = this.setupFileWatcher(statusFilePath, onStatusUpdate);
      
      Logger.info(`FileSystemService: ステータスファイルイベントリスナーを設定しました: ${statusFilePath}`);
      return fileWatcher;
    } catch (error) {
      Logger.error(`FileSystemService: ステータスファイルイベントリスナーの設定中にエラーが発生しました: ${statusFilePath}`, error as Error);
      // エラー時は空のDisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * プロジェクトファイルの監視を設定
   * @param projectPath オプショナル - 指定しない場合はProjectServiceImplから最新のパスを取得
   * @param outputCallback ファイル変更時のコールバック
   */
  public setupProjectFileWatcher(
    projectPath?: string,
    outputCallback?: (filePath: string) => void
  ): vscode.Disposable {
    try {
      // プロジェクトパスが指定されていない場合はProjectServiceImplから最新のパスを取得
      if (!projectPath) {
        try {
          // ProjectServiceImplのインスタンスを取得
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { ProjectServiceImpl } = require('../implementations/ProjectServiceImpl');
          const projectService = ProjectServiceImpl.getInstance();
          
          // 最新のアクティブプロジェクトパスを取得
          projectPath = projectService.getActiveProjectPath();
          
          Logger.info(`FileSystemService: ProjectServiceImplから最新プロジェクトパスを取得: ${projectPath}`);
        } catch (error) {
          Logger.error('FileSystemService: ProjectServiceImplからのパス取得に失敗', error as Error);
          throw new Error('有効なプロジェクトが選択されていません');
        }
      }
      
      if (!projectPath) {
        throw new Error('プロジェクトパスが取得できません');
      }
      
      // outputCallbackが指定されていない場合のデフォルト処理
      const callback = outputCallback || ((filePath: string) => {
        Logger.info(`FileSystemService: ファイル変更を検出: ${filePath} (デフォルトハンドラ)`);
      });
      
      // docs ディレクトリのパスを構築
      const docsDir = path.join(projectPath, 'docs');
      
      // 進捗ファイルのパスを構築
      const progressFilePath = this.getProgressFilePath(projectPath);
      
      // ファイルウォッチャーを設定
      const fileWatcher = this.setupEnhancedFileWatcher(
        progressFilePath,
        callback,
        { delayedReadTime: 500 }  // 500ms後に遅延読み込み
      );
      
      Logger.info(`FileSystemService: プロジェクトファイルウォッチャーを設定しました: ${progressFilePath}`);
      return fileWatcher;
    } catch (error) {
      Logger.error(`FileSystemService: プロジェクトファイルウォッチャーの設定中にエラーが発生しました: ${projectPath || '不明'}`, error as Error);
      // エラー時は空のDisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * プロジェクト全体の監視を設定
   * プロジェクト内のすべてのファイル（サブディレクトリ含む）の変更を監視
   * @param projectPath プロジェクトのパス
   * @param outputCallback ファイル変更時のコールバック
   * @param options 追加オプション（遅延読み込み時間など）
   */
  public setupDocsDirectoryWatcher(
    projectPath: string,
    outputCallback: (filePath: string) => void,
    options?: { delayedReadTime?: number }
  ): vscode.Disposable {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // ディレクトリの存在を確認
      if (!fs.existsSync(projectPath)) {
        Logger.warn(`FileSystemService: プロジェクトディレクトリが存在しません: ${projectPath}`);
        return { dispose: () => {} };
      }
      
      Logger.info(`FileSystemService: プロジェクト全体の監視を開始します: ${projectPath}`);
      
      // 遅延読み込み時間（デフォルトは500ms）
      const delayedReadTime = options?.delayedReadTime || 500;
      
      // 最後の更新からのデバウンスタイマー
      let debounceTimer: NodeJS.Timeout | null = null;
      
      // 更新保留中のファイルパスのセット（重複防止）
      const pendingUpdates = new Set<string>();
      
      // VSCodeのファイルシステムウォッチャーを使用
      // projectPath/**/* パターンでサブディレクトリを含むすべてのファイルを監視
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.file(projectPath),
          '**/*'
        )
      );
      
      // 変更イベントハンドラー
      const handleFileChange = (filePath: string) => {
        // node_modules、.git などの監視対象外のディレクトリやファイルはスキップ
        if (filePath.includes('node_modules') || filePath.includes('.git') || 
            filePath.includes('.DS_Store') || filePath.includes('.vscode')) {
          return;
        }
        
        // ファイルパスを追跡対象に追加
        pendingUpdates.add(filePath);
        
        // 既存のタイマーがあればクリア
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        
        // 新しいタイマーを設定
        debounceTimer = setTimeout(() => {
          Logger.info(`FileSystemService: プロジェクト内の${pendingUpdates.size}ファイルの変更をバッチ処理します`);
          
          // 保留中のすべてのファイルに対してコールバックを実行
          for (const path of pendingUpdates) {
            try {
              outputCallback(path);
            } catch (callbackError) {
              Logger.error(`FileSystemService: ファイル変更コールバック実行エラー: ${path}`, callbackError as Error);
            }
          }
          
          // 保留セットをクリア
          pendingUpdates.clear();
          debounceTimer = null;
        }, delayedReadTime);
      };
      
      // ファイル変更イベントを処理
      watcher.onDidChange((uri) => {
        Logger.info(`FileSystemService: ファイル変更を検出: ${uri.fsPath}`);
        handleFileChange(uri.fsPath);
      });
      
      // ファイル作成イベントを処理
      watcher.onDidCreate((uri) => {
        Logger.info(`FileSystemService: ファイル作成を検出: ${uri.fsPath}`);
        handleFileChange(uri.fsPath);
      });
      
      // ファイル削除イベントを処理
      watcher.onDidDelete((uri) => {
        Logger.info(`FileSystemService: ファイル削除を検出: ${uri.fsPath}`);
        handleFileChange(uri.fsPath);
      });
      
      Logger.info(`FileSystemService: プロジェクト全体の監視を設定しました: ${projectPath}`);
      
      // 複合Disposableを返す（タイマーとウォッチャーを適切に解放）
      return {
        dispose: () => {
          watcher.dispose();
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          pendingUpdates.clear();
          Logger.info(`FileSystemService: プロジェクト全体の監視を終了しました: ${projectPath}`);
        }
      };
    } catch (error) {
      Logger.error(`FileSystemService: プロジェクト監視の設定中にエラーが発生しました: ${projectPath}`, error as Error);
      // エラー時は空のDisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * ディレクトリ内のファイルとフォルダを一覧取得する
   * @param directoryPath ディレクトリパス
   * @param recursive 再帰的に取得するかどうか（デフォルトはfalse）
   * @returns ファイルとフォルダの情報のリスト
   */
  public async listDirectory(directoryPath: string, recursive: boolean = false): Promise<IProjectDocument[]> {
    try {
      if (!directoryPath) {
        throw new Error('ディレクトリパスが指定されていません');
      }

      // 念のため最後の部分が隠しファイルやシステムファイルを参照していないか確認
      const lastPathComponent = path.basename(directoryPath);
      if (lastPathComponent.startsWith('.')) {
        Logger.warn(`FileSystemService: 不正なパス(隠しファイル参照)を検出: ${directoryPath}`);
        // 親ディレクトリを使用
        directoryPath = path.dirname(directoryPath);
      }

      // ディレクトリが存在するか確認
      if (!fs.existsSync(directoryPath)) {
        Logger.warn(`FileSystemService: ディレクトリが存在しません: ${directoryPath}`);
        return [];
      }

      const result: IProjectDocument[] = [];
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);

        // 隠しファイル（ドットで始まるファイル）、node_modulesディレクトリをスキップ
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        try {
          const stats = fs.statSync(entryPath);
          const isDir = entry.isDirectory();
          
          // インターフェースに合わせてオプショナルプロパティとして扱う
          const document: IProjectDocument = {
            path: entryPath,
            name: entry.name,
            type: this.getFileType(entryPath),
            lastModified: new Date(stats.mtime),
            parentFolder: directoryPath,
            isDirectory: isDir,
            size: stats.size
          };

          // 再帰的に取得する場合は子ディレクトリも処理
          if (isDir && recursive) {
            document.children = await this.listDirectory(entryPath, true);
          }

          result.push(document);
        } catch (entryError) {
          Logger.warn(`FileSystemService: エントリ処理中にエラー: ${entryPath}`, entryError as Error);
          // エラーのあるエントリは無視して続行
        }
      }

      // ディレクトリが先頭、その後にファイルを名前順にソート
      result.sort((a, b) => {
        // ディレクトリを先にソート
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        
        // 同じタイプであれば名前でソート
        return a.name.localeCompare(b.name);
      });

      // 結果をキャッシュし、イベントを発火
      this._currentFileList = result;
      this._onFileBrowserUpdated.fire(result);

      return result;
    } catch (error) {
      Logger.error(`FileSystemService: ディレクトリリスト取得中にエラー: ${directoryPath}`, error as Error);
      return [];
    }
  }

  /**
   * ファイルの種類を判別する
   * @param filePath ファイルパス
   * @returns ファイルタイプ（文字列）
   */
  public getFileType(filePath: string): string {
    try {
      if (!filePath) {
        return 'unknown';
      }

      const extension = path.extname(filePath).toLowerCase();
      
      // ディレクトリの場合
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        return 'directory';
      }

      // 拡張子によるタイプ分類
      switch (extension) {
        case '.md':
          return 'markdown';
        case '.js':
          return 'javascript';
        case '.ts':
          return 'typescript';
        case '.json':
          return 'json';
        case '.html':
          return 'html';
        case '.css':
          return 'css';
        case '.svg':
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.gif':
          return 'image';
        default:
          return extension ? extension.substring(1) : 'unknown';
      }
    } catch (error) {
      Logger.warn(`FileSystemService: ファイルタイプ判別エラー: ${filePath}`, error as Error);
      return 'unknown';
    }
  }
  
  /**
   * 要件定義ファイルを検索して見つける
   * @param projectPath プロジェクトパス
   * @returns 要件定義ファイルのパス（見つからない場合はnull）
   */
  public async findRequirementsFile(projectPath: string): Promise<string | null> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }

      // 優先順位付きの候補ファイル名一覧
      const candidateNames = [
        'requirements.md',
        'REQUIREMENTS.md',
        'Requirements.md',
        'requirement.md',
        'REQUIREMENT.md',
        'Requirement.md'
      ];

      // 優先順位付きの検索ディレクトリ
      const searchDirs = [
        path.join(projectPath, 'docs'),     // 最優先: docs/
        projectPath,                         // 次: プロジェクトルート
        path.join(projectPath, 'design'),   // design/
        path.join(projectPath, 'doc'),      // doc/
        path.join(projectPath, 'documents') // documents/
      ];

      // 各ディレクトリで候補ファイルを検索
      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          for (const candidateName of candidateNames) {
            const candidatePath = path.join(dir, candidateName);
            if (fs.existsSync(candidatePath)) {
              Logger.info(`FileSystemService: 要件定義ファイルを発見: ${candidatePath}`);
              return candidatePath;
            }
          }
        }
      }

      // 見つからなかった場合
      Logger.warn(`FileSystemService: 要件定義ファイルが見つかりませんでした: ${projectPath}`);
      return null;
    } catch (error) {
      Logger.error(`FileSystemService: 要件定義ファイル検索中にエラーが発生しました: ${projectPath}`, error as Error);
      return null;
    }
  }

  /**
   * 要件定義ファイルのパスを取得
   * @param projectPath オプショナル - 指定しない場合はProjectServiceImplから最新のパスを取得
   * @returns 要件定義ファイルのパス
   */
  public getRequirementsFilePath(projectPath?: string): string {
    // プロジェクトパスが指定されていない場合はProjectServiceImplから最新のパスを取得
    if (!projectPath) {
      try {
        // ProjectServiceImplのインスタンスを取得
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ProjectServiceImpl } = require('../implementations/ProjectServiceImpl');
        const projectService = ProjectServiceImpl.getInstance();

        // 最新のアクティブプロジェクトパスを取得
        projectPath = projectService.getActiveProjectPath();

        Logger.info(`FileSystemService: ProjectServiceImplから最新プロジェクトパスを取得: ${projectPath}`);
      } catch (error) {
        Logger.error('FileSystemService: ProjectServiceImplからのパス取得に失敗', error as Error);
        throw new Error('有効なプロジェクトが選択されていません');
      }
    }

    if (!projectPath) {
      throw new Error('プロジェクトパスが取得できません');
    }

    // docs/requirements.mdというパスを構築
    const docsDir = path.join(projectPath, 'docs');
    return path.join(docsDir, 'requirements.md');
  }

  /**
   * 要件定義ファイルの監視を設定
   * @param projectPath プロジェクトパス
   * @param outputCallback ファイル変更時のコールバック
   */
  /**
   * 要件定義ファイル（requirements.md）の変更監視を設定するための専用メソッド
   * @param filePath 監視ファイルのパス
   * @param onFileChanged ファイル変更時のコールバック
   * @param options オプション設定（遅延読み込み時間など）
   */
  public setupRequirementsWatcher(
    filePath: string,
    onFileChanged: (filePath: string) => void,
    options?: { delayedReadTime?: number }
  ): vscode.Disposable {
    // 標準ログへ切り替え
    Logger.info(`FileSystemServiceImpl: 要件定義ファイル監視設定を開始: ${filePath}`);

    try {
      if (!filePath) {
        throw new Error('監視対象のファイルパスが指定されていません');
      }

      const projectPath = path.dirname(path.dirname(filePath)); // docs/<file>からプロジェクトパスを取得

      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      // requirements.md ファイルパスの構築
      const fileName = 'requirements.md';
      const watchPath = path.join(docsDir, fileName);

      Logger.info(`FileSystemServiceImpl: 要件定義ファイル監視パス: ${watchPath}`);

      // 遅延読み込み時間（オプションか、デフォルトで500ms）
      const delayTime = options?.delayedReadTime || 500;

      // 標準的なファイルシステムウォッチャーを設定
      const pattern = new vscode.RelativePattern(vscode.Uri.file(docsDir), fileName);
      const watcher = vscode.workspace.createFileSystemWatcher(
        pattern,
        false, // 作成イベントを無視しない
        false, // 変更イベントを無視しない
        false  // 削除イベントを無視しない
      );

      // ファイル変更時のイベントハンドラを設定
      watcher.onDidChange(async (uri) => {
        Logger.info(`【重要】FileSystemService: 要件定義ファイル変更イベント検出: ${uri.fsPath}, 監視対象ファイル=${fileName}`);

        try {
          // ファイル情報を取得
          const stats = fs.statSync(uri.fsPath);
          Logger.info(`FileSystemService: 要件定義ファイル情報 - 最終更新: ${stats.mtime.toString()}, サイズ: ${stats.size}バイト`);

          // 即時読み込みと通知
          onFileChanged(uri.fsPath);
          Logger.info(`FileSystemService: 要件定義ファイル変更通知完了`);

          // 遅延読み込みによる安定性強化
          if (delayTime > 0) {
            setTimeout(() => {
              try {
                Logger.info(`FileSystemService: 要件定義ファイル遅延読み込み(${delayTime}ms後): ${uri.fsPath}`);
                onFileChanged(uri.fsPath);
                Logger.info(`FileSystemService: 要件定義ファイル遅延読み込み完了`);
              } catch (delayedError) {
                Logger.error(`FileSystemService: 要件定義ファイル遅延読み込みエラー: ${delayedError}`);
              }
            }, delayTime);
          }
        } catch (error) {
          Logger.error(`FileSystemService: 要件定義ファイル変更処理エラー: ${error}`);
        }
      });

      // ファイル作成時のイベントハンドラを設定
      watcher.onDidCreate(async (uri) => {
        Logger.info(`FileSystemService: 要件定義ファイルが作成されました: ${uri.fsPath}`);
        onFileChanged(uri.fsPath);
      });

      Logger.info(`FileSystemService: 要件定義ファイルウォッチャーを設定しました: ${watchPath}`);
      return watcher;
    } catch (error) {
      Logger.error(`FileSystemService: 要件定義ファイルウォッチャー設定中にエラー: ${filePath}`, error as Error);
      return { dispose: () => {} };
    }
  }

  /**
   * 要件定義ファイルの監視を設定（従来のインターフェース互換性のため）
   * @param projectPath プロジェクトパス
   * @param outputCallback ファイル変更時のコールバック
   */
  public async setupRequirementsFileWatcher(
    projectPath?: string,
    outputCallback?: (filePath: string) => void
  ): Promise<vscode.Disposable> {
    try {
      // プロジェクトパスが指定されていない場合はProjectServiceImplから最新のパスを取得
      if (!projectPath) {
        try {
          // ProjectServiceImplのインスタンスを取得
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { ProjectServiceImpl } = require('../implementations/ProjectServiceImpl');
          const projectService = ProjectServiceImpl.getInstance();

          // 最新のアクティブプロジェクトパスを取得
          projectPath = projectService.getActiveProjectPath();

          Logger.info(`FileSystemService: ProjectServiceImplから最新プロジェクトパスを取得: ${projectPath}`);
        } catch (error) {
          Logger.error('FileSystemService: ProjectServiceImplからのパス取得に失敗', error as Error);
          throw new Error('有効なプロジェクトが選択されていません');
        }
      }

      if (!projectPath) {
        throw new Error('プロジェクトパスが取得できません');
      }

      // outputCallbackが指定されていない場合のデフォルト処理
      const callback = outputCallback || ((filePath: string) => {
        Logger.info(`FileSystemService: ファイル変更を検出: ${filePath} (デフォルトハンドラ)`);
      });

      // 要件定義ファイルのパスを取得 - 直接構築（エラー回避）
      const docsDir = path.join(projectPath, 'docs');
      const requirementsFilePath = path.join(docsDir, 'requirements.md');

      // ファイルウォッチャーを設定
      const fileWatcher = this.setupEnhancedFileWatcher(
        requirementsFilePath,
        callback,
        { delayedReadTime: 500 }  // 500ms後に遅延読み込み
      );

      Logger.info(`FileSystemService: 要件定義ファイルウォッチャーを設定しました: ${requirementsFilePath}`);
      return fileWatcher;
    } catch (error) {
      Logger.error(`FileSystemService: 要件定義ファイルウォッチャーの設定中にエラーが発生しました: ${projectPath || '不明'}`, error as Error);
      // エラー時は空のDisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * 進捗ファイルを読み込む
   * @param projectPath オプショナル - 指定しない場合はProjectServiceImplから最新のパスを取得
   * @param outputCallback 読み込み完了後のコールバック（オプション）
   */
  public async loadProgressFile(projectPath?: string, outputCallback?: (content: string) => void): Promise<string> {
    try {
      // プロジェクトパスが指定されていない場合はProjectServiceImplから最新のパスを取得
      if (!projectPath) {
        try {
          // ProjectServiceImplのインスタンスを取得
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { ProjectServiceImpl } = require('../implementations/ProjectServiceImpl');
          const projectService = ProjectServiceImpl.getInstance();
          
          // 最新のアクティブプロジェクトパスを取得
          projectPath = projectService.getActiveProjectPath();
          
          Logger.info(`FileSystemService: ProjectServiceImplから最新プロジェクトパスを取得: ${projectPath}`);
        } catch (error) {
          Logger.error('FileSystemService: ProjectServiceImplからのパス取得に失敗', error as Error);
          throw new Error('有効なプロジェクトが選択されていません');
        }
      }
      
      if (!projectPath) {
        throw new Error('プロジェクトパスが取得できません');
      }
      
      // 進捗ファイルのパスを取得
      const progressFilePath = this.getProgressFilePath(projectPath);
      
      // 進捗ファイルの存在を確認し、なければ作成
      const exists = await this.fileExists(progressFilePath);
      if (!exists) {
        await this.createProgressFile(projectPath);
      }
      
      // ファイルを読み込む
      const content = await this.readMarkdownFile(progressFilePath);
      
      // コールバックが指定されている場合は実行
      if (outputCallback) {
        outputCallback(content);
      }
      
      return content;
    } catch (error) {
      Logger.error(`FileSystemService: 進捗ファイル読み込み中にエラーが発生しました: ${projectPath || '不明'}`, error as Error);
      throw error;
    }
  }
  
  /**
   * VSCodeエディターでファイルを開く
   * @param filePath ファイルのパス
   */
  public async openFileInEditor(filePath: string): Promise<void> {
    try {
      if (!filePath) {
        throw new Error('ファイルパスが指定されていません');
      }
      
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルをVSCodeエディターで開く
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
      
      Logger.info(`FileSystemService: エディターでファイルを開きました: ${filePath}`);
    } catch (error) {
      Logger.error(`FileSystemService: エディターでファイルを開く際にエラーが発生しました: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * WebViewパネルでディレクトリを移動
   * @param dirPath ディレクトリパス
   * @param panel WebViewパネル
   */
  public async navigateDirectory(dirPath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      if (!dirPath) {
        throw new Error('ディレクトリパスが指定されていません');
      }
      
      // ディレクトリが存在するか確認
      if (!fs.existsSync(dirPath)) {
        throw new Error(`ディレクトリが見つかりません: ${dirPath}`);
      }
      
      // ディレクトリ内のファイルとフォルダを一覧取得
      const files = await this.listDirectory(dirPath);
      
      // WebViewにディレクトリ内容を送信
      panel.webview.postMessage({
        command: 'showDirectoryContent',
        files: files,
        currentPath: dirPath
      });
      
      Logger.info(`FileSystemService: ディレクトリを表示: ${dirPath}`);
    } catch (error) {
      Logger.error(`FileSystemService: ディレクトリ移動中にエラーが発生しました: ${dirPath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * WebViewパネルでファイルを開く
   * @param filePath ファイルパス
   * @param panel WebViewパネル
   */
  public async openFile(filePath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      if (!filePath) {
        throw new Error('ファイルパスが指定されていません');
      }
      
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を読み込む
      const content = await this.readFile(filePath);
      
      // WebViewにファイル内容を送信
      panel.webview.postMessage({
        command: 'showFileContent',
        content: content,
        filePath: filePath,
        fileType: this.getFileType(filePath)
      });
      
      Logger.info(`FileSystemService: WebViewでファイルを開きました: ${filePath}`);
    } catch (error) {
      Logger.error(`FileSystemService: WebViewでファイルを開く際にエラーが発生しました: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * WebViewパネルでファイルブラウザを更新
   * @param projectPath プロジェクトパス
   * @param panel WebViewパネル
   */
  public async refreshFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // プロジェクトディレクトリが存在するか確認
      if (!fs.existsSync(projectPath)) {
        throw new Error(`プロジェクトディレクトリが見つかりません: ${projectPath}`);
      }
      
      // ディレクトリ内のファイルとフォルダを一覧取得
      const files = await this.listDirectory(projectPath);
      
      // WebViewにディレクトリ内容を送信
      // 1. 標準のupdateFileListコマンドとして送信（ファイルブラウザが直接処理できる形式）
      panel.webview.postMessage({
        command: 'updateFileList',
        files: files,
        currentPath: projectPath
      });
      
      // 2. 互換性のためupdateFileBrowserコマンドも送信
      panel.webview.postMessage({
        command: 'updateFileBrowser',
        files: files,
        currentPath: projectPath
      });
      
      Logger.info(`FileSystemService: ファイルブラウザを更新しました: ${projectPath}`);
    } catch (error) {
      Logger.error(`FileSystemService: ファイルブラウザの更新中にエラーが発生しました: ${projectPath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * WebViewパネルでファイルブラウザを初期化
   * @param projectPath プロジェクトパス
   * @param panel WebViewパネル
   */
  public async initializeFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // ディレクトリ内のファイルとフォルダを一覧取得（初期状態）
      const files = await this.listDirectory(projectPath);
      
      // WebViewにディレクトリ内容を送信
      panel.webview.postMessage({
        command: 'initFileBrowser',
        files: files,
        currentPath: projectPath
      });
      
      Logger.info(`FileSystemService: ファイルブラウザを初期化しました: ${projectPath}`);
    } catch (error) {
      Logger.error(`FileSystemService: ファイルブラウザの初期化中にエラーが発生しました: ${projectPath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * ディレクトリ構造を再帰的に読み込む（内部ヘルパーメソッド）
   * @param dirPath ディレクトリパス
   * @returns ディレクトリ構造オブジェクト
   */
  private async _readDirectoryStructure(dirPath: string): Promise<any> {
    try {
      // ディレクトリが存在するか確認
      if (!fs.existsSync(dirPath)) {
        return null;
      }
      
      const result: any = { name: path.basename(dirPath), type: 'directory', children: [] };
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // 隠しファイル（ドットで始まるファイル）、node_modulesディレクトリをスキップ
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        const entryPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // 再帰的にサブディレクトリを処理
          const subDir = await this._readDirectoryStructure(entryPath);
          if (subDir) {
            result.children.push(subDir);
          }
        } else {
          // ファイルを追加
          result.children.push({
            name: entry.name,
            type: this.getFileType(entryPath),
            path: entryPath
          });
        }
      }
      
      return result;
    } catch (error) {
      Logger.error(`FileSystemService: ディレクトリ構造読み込み中にエラーが発生しました: ${dirPath}`, error as Error);
      return null;
    }
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    try {
      // ファイルウォッチャーを解放
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
        this._fileWatcher = null;
      }
      
      // docsディレクトリウォッチャーを解放
      if (this._docsDirWatcher) {
        this._docsDirWatcher.close();
        this._docsDirWatcher = null;
      }
      
      // すべてのディスポーザブルを解放
      while (this._disposables.length) {
        const x = this._disposables.pop();
        if (x) {
          x.dispose();
        }
      }
      
      Logger.info('FileSystemService: リソースを解放しました');
    } catch (error) {
      Logger.error('FileSystemService: リソース解放中にエラーが発生しました', error as Error);
    }
  }

  //#region IWebViewCommunication インターフェースの実装

  /**
   * WebViewにメッセージを送信
   * @param panel WebViewパネル
   * @param message 送信するメッセージ
   */
  public sendToWebView(panel: vscode.WebviewPanel, message: Message): void {
    if (this._messageDispatchService) {
      this._messageDispatchService.sendMessage(panel, message);
    } else {
      Logger.warn('FileSystemService: メッセージディスパッチサービスが設定されていません');
      try {
        // フォールバック: 直接WebViewにメッセージを送信
        panel.webview.postMessage(message);
      } catch (error) {
        Logger.error(`FileSystemService: メッセージ送信に失敗: ${message.command}`, error as Error);
      }
    }
  }

  /**
   * WebViewにエラーメッセージを表示
   * @param panel WebViewパネル
   * @param errorMessage エラーメッセージ
   */
  public showError(panel: vscode.WebviewPanel, errorMessage: string): void {
    this.sendToWebView(panel, {
      command: 'showError',
      message: errorMessage,
      priority: 'high'
    });
  }

  /**
   * WebViewに成功メッセージを表示
   * @param panel WebViewパネル
   * @param successMessage 成功メッセージ
   */
  public showSuccess(panel: vscode.WebviewPanel, successMessage: string): void {
    this.sendToWebView(panel, {
      command: 'showSuccess',
      message: successMessage,
      priority: 'high'
    });
  }

  /**
   * メッセージハンドラを登録
   * @param messageDispatchService メッセージディスパッチサービス
   */
  public registerMessageHandlers(messageDispatchService: IMessageDispatchService): void {
    this._messageDispatchService = messageDispatchService;

    // ファイル読み込みハンドラー
    messageDispatchService.registerHandler('readMarkdownFile', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }

      try {
        const content = await this.readMarkdownFile(message.filePath);
        this.sendToWebView(panel, {
          command: 'updateMarkdownContent',
          content,
          timestamp: Date.now(),
          priority: 'high',
          filePath: message.filePath
        });
      } catch (error) {
        this.showError(panel, `ファイル読み込みに失敗: ${(error as Error).message}`);
      }
    });

    // getMarkdownContentハンドラー（クライアント側との互換性のため）
    messageDispatchService.registerHandler('getMarkdownContent', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }

      try {
        const content = await this.readMarkdownFile(message.filePath);
        this.sendToWebView(panel, {
          command: 'updateMarkdownContent',
          content,
          timestamp: Date.now(),
          priority: 'high',
          filePath: message.filePath,
          forScopeProgress: message.forScopeProgress,
          forRequirements: message.forRequirements,
          forceRefresh: message.forceRefresh
        });
      } catch (error) {
        this.showError(panel, `マークダウンファイル読み込みに失敗: ${(error as Error).message}`);
      }
    });

    // 一般ファイル読み込みハンドラー
    messageDispatchService.registerHandler('readFile', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }

      try {
        const content = await this.readFile(message.filePath);
        this.sendToWebView(panel, {
          command: 'updateFileContent',
          content,
          filePath: message.filePath,
          fileName: path.basename(message.filePath),
          fileType: this.getFileType(message.filePath)
        });
      } catch (error) {
        this.showError(panel, `ファイル読み込みに失敗: ${(error as Error).message}`);
      }
    });
    
    // ディレクトリ内容一覧取得ハンドラー
    messageDispatchService.registerHandler('listDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.path) {
        this.showError(panel, 'ディレクトリパスが指定されていません');
        return;
      }
      
      try {
        const files = await this.listDirectory(message.path);
        this.sendToWebView(panel, {
          command: 'updateFileList',
          files,
          currentPath: message.path,
          parentPath: path.dirname(message.path) !== message.path ? path.dirname(message.path) : null
        });
      } catch (error) {
        this.showError(panel, `ディレクトリリスティングに失敗: ${(error as Error).message}`);
      }
    });
    
    // ファイルブラウザ更新ハンドラー
    messageDispatchService.registerHandler('refreshFileBrowser', async (message: Message, panel: vscode.WebviewPanel) => {
      try {
        const projectPath = message.projectPath || message.path;
        if (!projectPath) {
          this.showError(panel, 'プロジェクトパスが指定されていません');
          return;
        }
        
        const structure = await this.getDirectoryStructure(projectPath);
        this.sendToWebView(panel, {
          command: 'updateDirectoryStructure',
          structure,
          projectPath
        });
      } catch (error) {
        this.showError(panel, `ディレクトリ構造の更新に失敗: ${(error as Error).message}`);
      }
    });
    
    // エディタでファイルを開くハンドラー
    messageDispatchService.registerHandler('openFileInEditor', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }
      
      try {
        await this.openFileInEditor(message.filePath);
        this.showSuccess(panel, `エディタでファイルを開きました: ${path.basename(message.filePath)}`);
      } catch (error) {
        this.showError(panel, `ファイルを開けませんでした: ${(error as Error).message}`);
      }
    });
    
    // ファイルをタブで開くハンドラー
    messageDispatchService.registerHandler('openFileAsTab', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }
      
      try {
        const content = await this.readFile(message.filePath);
        const fileType = this.getFileType(message.filePath);
        const isMarkdown = fileType === 'markdown';
        const fileName = path.basename(message.filePath);
        const tabId = `file-${message.filePath.split('/').join('-').replace(/[^\w-]/g, '')}`;
        
        this.sendToWebView(panel, {
          command: 'addFileTab',
          tabId,
          title: fileName,
          content,
          isMarkdown,
          filePath: message.filePath,
          lastModified: message.lastModified || new Date().toISOString()
        });
      } catch (error) {
        this.showError(panel, `ファイルを開けませんでした: ${(error as Error).message}`);
      }
    });
    
    Logger.info('FileSystemService: メッセージハンドラーを登録しました');
  }
  
  //#endregion
}