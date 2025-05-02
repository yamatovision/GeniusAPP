import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { FileOperationManager } from '../../../utils/fileOperationManager';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../services/AppGeniusEventBus';

/**
 * ファイルシステムサービスインターフェース
 * ScopeManagerPanelのファイル操作関連の責務を分離
 */
export interface IFileSystemService {
  // ファイル操作
  readMarkdownFile(filePath: string): Promise<string>;
  createDefaultStatusFile(projectPath: string, projectName?: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  
  // ディレクトリ操作
  getDirectoryStructure(projectPath: string): Promise<string>;
  ensureDirectoryExists(dirPath: string): Promise<void>;
  
  // ファイル監視
  setupFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void): vscode.Disposable;
  setupEnhancedFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void, options?: { delayedReadTime?: number }): vscode.Disposable;
  setupStatusFileEventListener(projectPath: string, statusFilePath: string, onStatusUpdate: (filePath: string) => void): vscode.Disposable;
  dispose(): void;
  
  // イベント
  onStatusFileChanged: vscode.Event<string>;
}

/**
 * ファイルシステムサービス実装クラス
 */
export class FileSystemService implements IFileSystemService {
  private _onStatusFileChanged = new vscode.EventEmitter<string>();
  public readonly onStatusFileChanged = this._onStatusFileChanged.event;
  
  private _disposables: vscode.Disposable[] = [];
  private _fileManager: FileOperationManager;
  private _fileWatcher: vscode.FileSystemWatcher | null = null;
  private _docsDirWatcher: fs.FSWatcher | null = null;
  private _extensionPath: string;
  
  // シングルトンインスタンス
  private static _instance: FileSystemService;
  
  public static getInstance(): FileSystemService {
    if (!FileSystemService._instance) {
      FileSystemService._instance = new FileSystemService();
    }
    return FileSystemService._instance;
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
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を読み込む
      const content = await this._fileManager.readFileAsString(filePath);
      
      Logger.info(`FileSystemService: マークダウンコンテンツを読み込みました: ${filePath}`);
      
      // 読み込んだファイルの内容をイベントとして通知
      this._onStatusFileChanged.fire(filePath);
      
      return content;
    } catch (error) {
      Logger.error(`FileSystemService: マークダウンコンテンツの読み込みに失敗しました: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * デフォルトのステータスファイルを作成
   * @param projectPath プロジェクトパス
   * @param projectName プロジェクト名（省略時はディレクトリ名）
   */
  public async createDefaultStatusFile(projectPath: string, projectName?: string): Promise<void> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(projectPath, 'docs');
      await this.ensureDirectoryExists(docsDir);
      
      // ステータスファイルのパス
      const statusFilePath = path.join(docsDir, 'CURRENT_STATUS.md');
      
      // ステータスファイルが存在しない場合はテンプレートを作成
      if (!fs.existsSync(statusFilePath)) {
        Logger.info('FileSystemService: CURRENT_STATUS.mdファイルが存在しないため、テンプレートを作成します');
        
        // プロジェクト名が未指定の場合はディレクトリ名を使用
        const actualProjectName = projectName || path.basename(projectPath);
        
        // CURRENT_STATUSTEMPLATEからコンテンツを読み込む
        let templateContent = '';
        // 拡張機能のパスを使用して正確なテンプレートファイルを参照
        const statusTemplatePath = path.join(this._extensionPath, 'docs', 'CURRENT_STATUSTEMPLATE.md');
        
        try {
          if (fs.existsSync(statusTemplatePath)) {
            // テンプレートファイルを読み込む
            templateContent = fs.readFileSync(statusTemplatePath, 'utf8');
            // プロジェクト名と日付を置換
            templateContent = templateContent
              .replace(/# AppGeniusスコープマネージャー使用ガイド/, `# ${actualProjectName} - スコープマネージャー使用ガイド`)
              .replace(/\(YYYY\/MM\/DD更新\)/g, `(${new Date().toISOString().split('T')[0].replace(/-/g, '/')}更新)`);
              
            Logger.info(`FileSystemService: CURRENT_STATUSTEMPLATEを読み込みました: ${statusTemplatePath}`);
          } else {
            // テンプレートが見つからない場合はデフォルトテンプレートを使用
            templateContent = this._getDefaultTemplate(actualProjectName);
            Logger.warn(`FileSystemService: CURRENT_STATUSTEMPLATEが見つかりませんでした。デフォルトテンプレートを使用します。検索パス: ${statusTemplatePath}`);
          }
        } catch (error) {
          // エラーが発生した場合はデフォルトテンプレートを使用
          templateContent = this._getDefaultTemplate(actualProjectName);
          Logger.error(`FileSystemService: CURRENT_STATUSTEMPLATEの読み込みに失敗しました: ${statusTemplatePath}`, error as Error);
        }
        
        await fs.promises.writeFile(statusFilePath, templateContent, 'utf8');
        
        // ファイルが作成されたことをイベントとして通知
        this._onStatusFileChanged.fire(statusFilePath);
      }
    } catch (error) {
      Logger.error('FileSystemService: ステータスファイルの作成中にエラーが発生しました', error as Error);
      throw error;
    }
  }
  
  /**
   * ディレクトリ構造を取得
   * @param projectPath プロジェクトパス
   */
  public async getDirectoryStructure(projectPath: string): Promise<string> {
    if (!projectPath) {
      return '';
    }
    
    try {
      // ディレクトリツールを利用してプロジェクト構造を取得
      const { execSync } = require('child_process');
      
      // コマンドを実行
      const command = process.platform === 'win32'
        ? `cmd /c cd "${projectPath}" && tree /F /A`
        : `find "${projectPath}" -type f | grep -v "node_modules" | grep -v ".git" | sort`;
      
      const output = execSync(command, { maxBuffer: 10 * 1024 * 1024 }).toString();
      
      return output;
    } catch (error) {
      Logger.error('FileSystemService: ディレクトリ構造の取得中にエラーが発生しました', error as Error);
      return 'ディレクトリ構造の取得に失敗しました。';
    }
  }
  
  /**
   * ディレクトリの存在確認・作成
   * @param dirPath ディレクトリパス
   */
  public async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        Logger.info(`FileSystemService: ディレクトリを作成しました: ${dirPath}`);
      }
    } catch (error) {
      Logger.error(`FileSystemService: ディレクトリの作成に失敗しました: ${dirPath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * ファイル変更の監視を設定
   * @param statusFilePath 監視対象のステータスファイルパス
   * @param onFileChanged ファイル変更時のコールバック
   */
  public setupFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void): vscode.Disposable {
    try {
      // 既存の監視があれば破棄
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
        this._fileWatcher = null;
      }
      
      if (this._docsDirWatcher) {
        this._docsDirWatcher.close();
        this._docsDirWatcher = null;
      }
      
      if (!statusFilePath) {
        throw new Error('監視対象のファイルパスが指定されていません');
      }
      
      const projectPath = path.dirname(path.dirname(statusFilePath)); // docs/<file>からプロジェクトパスを取得
      
      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      
      // VSCodeのFileSystemWatcherを使用してCURRENT_STATUS.mdファイルの変更を直接監視
      const watchStatusPath = path.join(docsDir, 'CURRENT_STATUS.md');
      let watcher: vscode.FileSystemWatcher | null = null;
      
      // パスを文字列からURIに変換（VSCodeのウォッチャーはURIを使用）
      const fileUri = vscode.Uri.file(watchStatusPath);
      
      if (fs.existsSync(watchStatusPath)) {
        // ファイルが存在する場合はそのファイルのみを監視
        // 変更監視をより適切に設定（パターンではなく直接URIを指定）
        watcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(vscode.Uri.file(docsDir), 'CURRENT_STATUS.md'),
          false, // 作成イベントを無視しない
          false, // 変更イベントを無視しない
          false  // 削除イベントを無視しない
        );
        
        // ファイル変更時にマークダウンコンテンツを更新
        // ファイル変更イベントのリスナーを強化
        watcher.onDidChange(async (uri) => {
          Logger.info(`【重要】FileSystemService: ファイル変更イベント検出: ${uri.fsPath}`);
          
          // ファイルが存在するか確認
          const fs = require('fs');
          if (fs.existsSync(uri.fsPath)) {
            // 最終更新日時を取得して確実に変更を検出
            const stats = fs.statSync(uri.fsPath);
            Logger.info(`FileSystemService: ファイル情報 - 最終更新: ${stats.mtime}, サイズ: ${stats.size}バイト`);
            
            // ファイル内容をすぐに読み込んで通知
            try {
              const content = await this.readMarkdownFile(uri.fsPath);
              Logger.info(`FileSystemService: ファイル読み込み成功 - 長さ: ${content.length}文字`);
              
              // イベントを発火（より早く反応できるように先に実行）
              this._onStatusFileChanged.fire(uri.fsPath);
              Logger.info(`FileSystemService: イベント発火完了 - onStatusFileChanged`);
              
              // コールバックも呼び出して従来の動作も維持
              onFileChanged(uri.fsPath);
              Logger.info(`FileSystemService: コールバック実行完了 - onFileChanged`);
            } catch (error) {
              Logger.error(`FileSystemService: ファイル変更検出後の読み込みに失敗: ${uri.fsPath}`, error as Error);
              onFileChanged(uri.fsPath);
              this._onStatusFileChanged.fire(uri.fsPath);
            }
          } else {
            Logger.warn(`FileSystemService: 変更が検出されたファイルが存在しません: ${uri.fsPath}`);
          }
        });
        
        Logger.info(`FileSystemService: CURRENT_STATUS.mdファイルの監視を設定: ${watchStatusPath}`);
      } else {
        // ファイルが存在しない場合はdocsディレクトリ内のマークダウンファイルを監視
        const pattern = new vscode.RelativePattern(docsDir, '*CURRENT_STATUS.md');
        watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        // ファイル作成時にマークダウンコンテンツを更新
        watcher.onDidCreate(async (uri) => {
          Logger.info(`FileSystemService: CURRENT_STATUS.mdファイルが作成されました: ${uri.fsPath}`);
          onFileChanged(uri.fsPath);
          this._onStatusFileChanged.fire(uri.fsPath);
        });
        
        // ファイル変更時にマークダウンコンテンツを更新
        // ファイル変更イベントのリスナーを強化
        watcher.onDidChange(async (uri) => {
          Logger.info(`【重要】FileSystemService: ファイル変更イベント検出: ${uri.fsPath}`);
          
          // ファイルが存在するか確認
          const fs = require('fs');
          if (fs.existsSync(uri.fsPath)) {
            // 最終更新日時を取得して確実に変更を検出
            const stats = fs.statSync(uri.fsPath);
            Logger.info(`FileSystemService: ファイル情報 - 最終更新: ${stats.mtime}, サイズ: ${stats.size}バイト`);
            
            // ファイル内容をすぐに読み込んで通知
            try {
              const content = await this.readMarkdownFile(uri.fsPath);
              Logger.info(`FileSystemService: ファイル読み込み成功 - 長さ: ${content.length}文字`);
              
              // イベントを発火（より早く反応できるように先に実行）
              this._onStatusFileChanged.fire(uri.fsPath);
              Logger.info(`FileSystemService: イベント発火完了 - onStatusFileChanged`);
              
              // コールバックも呼び出して従来の動作も維持
              onFileChanged(uri.fsPath);
              Logger.info(`FileSystemService: コールバック実行完了 - onFileChanged`);
            } catch (error) {
              Logger.error(`FileSystemService: ファイル変更検出後の読み込みに失敗: ${uri.fsPath}`, error as Error);
              onFileChanged(uri.fsPath);
              this._onStatusFileChanged.fire(uri.fsPath);
            }
          } else {
            Logger.warn(`FileSystemService: 変更が検出されたファイルが存在しません: ${uri.fsPath}`);
          }
        });
        
        Logger.info(`FileSystemService: docsディレクトリ内のCURRENT_STATUS.mdファイルの監視を設定: ${docsDir}`);
      }
      
      this._fileWatcher = watcher;
      
      // イベントバスからのCURRENT_STATUS_UPDATEDイベントをリッスン
      const eventBus = AppGeniusEventBus.getInstance();
      const eventListener = eventBus.onEventType(AppGeniusEventType.CURRENT_STATUS_UPDATED, async (event) => {
        // 自分自身が送信したイベントは無視（循環を防ぐ）
        if (event.source === 'FileSystemService') {
          return;
        }
        
        // プロジェクトIDが一致しない場合は無視
        if (!projectPath || !event.projectId || 
            !projectPath.includes(event.projectId)) {
          return;
        }
        
        Logger.info('FileSystemService: 他のコンポーネントからのCURRENT_STATUS更新イベントを受信しました');
        
        // ステータスファイルが存在する場合はその内容を読み込み
        const eventStatusPath = path.join(projectPath, 'docs', 'CURRENT_STATUS.md');
        if (fs.existsSync(eventStatusPath)) {
          onFileChanged(eventStatusPath);
          this._onStatusFileChanged.fire(eventStatusPath);
        }
      });
      
      this._disposables.push(eventListener);
      
      // 複合disposableを返す
      return {
        dispose: () => {
          if (watcher) {
            watcher.dispose();
          }
          eventListener.dispose();
        }
      };
    } catch (error) {
      Logger.error('FileSystemService: ファイル監視の設定中にエラーが発生しました', error as Error);
      throw error;
    }
  }
  
  /**
   * デフォルトテンプレートを取得
   */
  private _getDefaultTemplate(projectName: string): string {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    
    return `# ${projectName} - 進行状況 (${today}更新)

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
- [ ] 基本機能の実装 (0%)
  - 説明: プロジェクトの基本機能を実装します
  - ステータス: 未着手
  - スコープID: scope-${Date.now()}
  - 関連ファイル:
    - (ファイルはまだ定義されていません)
`;
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
        } catch (error) {
          Logger.error(`FileSystemService(Enhanced): ファイル読み込み中にエラー: ${filePath}`, error as Error);
          // エラーがあっても通知だけは行う
          onFileChanged(filePath);
        }
      });
      
      // 基本的なウォッチャーを返す
      return baseWatcher;
    } catch (error) {
      Logger.error(`FileSystemService(Enhanced): ファイル監視の設定に失敗: ${statusFilePath}`, error as Error);
      // 空のdisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * ステータスファイル用のイベントリスナーを設定
   * AppGeniusEventBusからのCURRENT_STATUS_UPDATEDイベントをリッスン
   * @param projectPath プロジェクトパス
   * @param statusFilePath ステータスファイルパス
   * @param onStatusUpdate ステータス更新時のコールバック
   */
  public setupStatusFileEventListener(
    projectPath: string,
    statusFilePath: string,
    onStatusUpdate: (filePath: string) => void
  ): vscode.Disposable {
    try {
      // イベントバスからのCURRENT_STATUS_UPDATEDイベントをリッスン
      const eventBus = AppGeniusEventBus.getInstance();
      const listener = eventBus.onEventType(AppGeniusEventType.CURRENT_STATUS_UPDATED, async (event) => {
        // 自分自身が送信したイベントは無視（循環を防ぐ）
        if (event.source === 'FileSystemService') {
          return;
        }
        
        // プロジェクトIDが一致しない場合は無視
        if (!projectPath || !event.projectId || 
            !projectPath.includes(event.projectId)) {
          return;
        }
        
        Logger.info(`FileSystemService: 他のコンポーネントからのCURRENT_STATUS更新イベントを受信: projectPath=${projectPath}`);
        
        // ステータスファイルが存在する場合はその内容を読み込み
        if (await this.fileExists(statusFilePath)) {
          try {
            await this.readMarkdownFile(statusFilePath);
            onStatusUpdate(statusFilePath);
          } catch (error) {
            Logger.error(`FileSystemService: ステータスファイル読み込みに失敗: ${statusFilePath}`, error as Error);
            // エラーがあっても通知だけは行う
            onStatusUpdate(statusFilePath);
          }
        } else {
          Logger.warn(`FileSystemService: ステータスファイルが存在しません: ${statusFilePath}`);
        }
      });
      
      return listener;
    } catch (error) {
      Logger.error(`FileSystemService: イベントリスナーの設定に失敗: ${projectPath}`, error as Error);
      // 空のdisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    // イベントエミッターを解放
    this._onStatusFileChanged.dispose();
    
    // ファイルウォッチャーを破棄
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    
    // Node.jsのファイルシステムウォッチャーも破棄
    if (this._docsDirWatcher) {
      this._docsDirWatcher.close();
      this._docsDirWatcher = null;
    }
    
    // disposable なオブジェクトを破棄
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}