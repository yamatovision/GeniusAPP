import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../utils/logger';
import { FileOperationManager } from '../../../../utils/fileOperationManager';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../../services/AppGeniusEventBus';
import { IFileSystemService, IProjectDocument } from '../interfaces';

/**
 * ファイルシステムサービス実装
 * IFileSystemServiceインターフェースの実装
 */
export class FileSystemServiceImpl implements IFileSystemService {
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
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        // ファイルが見つからない場合はエラーを出さずに空文字を返す
        Logger.warn(`FileSystemService: ファイルが見つかりません（空文字を返します）: ${filePath}`);
        return '';
      }
      
      // ファイルの内容を読み込む
      const content = await this._fileManager.readFileAsString(filePath);
      
      Logger.info(`FileSystemService: マークダウンコンテンツを読み込みました: ${filePath}`);
      
      // 読み込んだファイルの内容をイベントとして通知
      this._onProgressFileChanged.fire(filePath);
      
      return content;
    } catch (error) {
      Logger.error(`FileSystemService: マークダウンファイル読み込み中にエラーが発生しました: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * ファイルを読み込む
   * @param filePath ファイルパス
   * @param fileType ファイルのタイプ（オプション）
   */
  public async readFile(filePath: string, fileType?: string): Promise<string> {
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        // ファイルが見つからない場合はエラーを出さずに空文字を返す
        Logger.warn(`FileSystemService: ファイルが見つかりません（空文字を返します）: ${filePath}`);
        return '';
      }
      
      // ファイルのタイプが指定されていない場合は拡張子から判定
      const type = fileType || this.getFileType(filePath);
      
      // マークダウンファイルの場合は専用の関数を使用
      if (type === 'markdown') {
        return await this.readMarkdownFile(filePath);
      }
      
      // ファイルの内容を読み込む
      const content = await this._fileManager.readFileAsString(filePath);
      
      Logger.info(`FileSystemService: ファイルコンテンツを読み込みました: ${filePath} (タイプ: ${type})`);
      
      return content;
    } catch (error) {
      Logger.error(`FileSystemService: ファイル読み込み中にエラーが発生しました: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * ディレクトリ構造を取得
   * @param projectPath プロジェクトのパス
   * @returns ディレクトリ構造のJSONシリアライズ文字列
   */
  public async getDirectoryStructure(projectPath: string): Promise<string> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // ディレクトリが存在するか確認
      if (!fs.existsSync(projectPath)) {
        Logger.warn(`FileSystemService: プロジェクトディレクトリが存在しません: ${projectPath}`);
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
      Logger.error(`FileSystemService: ディレクトリ構造の取得中にエラーが発生しました: ${projectPath}`, error as Error);
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
    try {
      if (!dirPath) {
        throw new Error('ディレクトリパスが指定されていません');
      }
      
      // ディレクトリが存在するか確認
      if (fs.existsSync(dirPath)) {
        return;
      }
      
      // 階層的にディレクトリを作成（親ディレクトリが無い場合も自動的に作成）
      fs.mkdirSync(dirPath, { recursive: true });
      Logger.info(`FileSystemService: ディレクトリを作成しました: ${dirPath}`);
    } catch (error) {
      Logger.error(`FileSystemService: ディレクトリ作成中にエラーが発生しました: ${dirPath}`, error as Error);
      throw error;
    }
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
    return `# [プロジェクト名] スコープと進捗状況

## 全体進捗

| カテゴリ | 進捗状況 | 前回からの変化 |
|---------|---------|--------------|
| 要件定義 | 🔄 進行中 | - |
| 設計    | ⏱️ 未着手 | - |
| 実装    | ⏱️ 未着手 | - |
| テスト  | ⏱️ 未着手 | - |
| 全体    | 🔄 進行中 | - |

## 現在のフォーカス

- 要件定義の完成
- プロジェクト構造の決定

## 実装スコープ

### 必須機能（MVP）

- [ ] 機能1: 説明
- [ ] 機能2: 説明

### 追加機能（時間があれば）

- [ ] 機能A: 説明
- [ ] 機能B: 説明

## タイムライン

- YYYY/MM/DD: プロジェクト開始
`.replace(/\[プロジェクト名\]/g, projectName);
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

      // ディレクトリが存在するか確認
      if (!fs.existsSync(directoryPath)) {
        Logger.warn(`FileSystemService: ディレクトリが存在しません: ${directoryPath}`);
        return [];
      }

      const result: IProjectDocument[] = [];
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        
        // .gitおよび.vscodeディレクトリはスキップ
        if (entry.name === '.git' || entry.name === '.vscode' || entry.name === 'node_modules') {
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
        // 除外するディレクトリとファイル
        if (entry.name === '.git' || entry.name === '.vscode' || entry.name === 'node_modules') {
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
}