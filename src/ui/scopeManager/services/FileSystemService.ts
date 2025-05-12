import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { FileOperationManager } from '../../../utils/fileOperationManager';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../services/AppGeniusEventBus';
import { IProjectDocument } from '../types/ScopeManagerTypes';

/**
 * ファイルシステムサービスインターフェース
 * ScopeManagerPanelのファイル操作関連の責務を分離
 */
export interface IFileSystemService {
  // ファイル操作
  readMarkdownFile(filePath: string): Promise<string>;
  createProgressFile(projectPath: string, projectName?: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  
  // ディレクトリ操作
  getDirectoryStructure(projectPath: string): Promise<string>;
  ensureDirectoryExists(dirPath: string): Promise<void>;
  
  // ファイル監視
  setupFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void): vscode.Disposable;
  setupEnhancedFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void, options?: { delayedReadTime?: number }): vscode.Disposable;
  setupStatusFileEventListener(projectPath: string, statusFilePath: string, onStatusUpdate: (filePath: string) => void): vscode.Disposable;
  dispose(): void;
  
  // ファイルパスとテンプレート取得
  getProgressFilePath(projectPath: string): string;
  findRequirementsFile(projectPath: string): Promise<string | null>;
  
  // 新規メソッド
  loadProgressFile(projectPath: string, outputCallback?: (content: string) => void): Promise<string>;
  updateDirectoryStructure(projectPath: string): Promise<string>;
  setupProjectFileWatcher(projectPath: string, outputCallback: (filePath: string) => void): vscode.Disposable;
  
  // ファイルブラウザ関連の新規メソッド
  listDirectory(directoryPath: string, recursive?: boolean): Promise<IProjectDocument[]>;
  readFile(filePath: string, fileType?: string): Promise<string>;
  getFileType(filePath: string): string;
  
  // ScopeManagerPanelから移行するファイル操作メソッド
  openFileInEditor(filePath: string): Promise<void>;
  navigateDirectory(dirPath: string, panel: vscode.WebviewPanel): Promise<void>;
  openFile(filePath: string, panel: vscode.WebviewPanel): Promise<void>;
  refreshFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void>;
  initializeFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void>;
  
  // イベント
  onProgressFileChanged: vscode.Event<string>;
  onDirectoryStructureUpdated: vscode.Event<string>;
  onFileBrowserUpdated: vscode.Event<IProjectDocument[]>;
}

/**
 * ファイルシステムサービス実装クラス
 */
export class FileSystemService implements IFileSystemService {
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
      Logger.warn(`FileSystemService: マークダウンコンテンツの読み込みに失敗しました（空文字を返します）: ${filePath}`, error as Error);
      return ''; // エラーが発生した場合でも空文字を返してアプリケーションの動作を妨げない
    }
  }
  
  /**
   * 進捗ファイルパスを取得
   * @param projectPath プロジェクトパス
   * @returns 進捗ファイルパス
   */
  public getProgressFilePath(projectPath: string): string {
    const docsDir = path.join(projectPath, 'docs');
    return path.join(docsDir, 'SCOPE_PROGRESS.md');
  }

  /**
   * 要件定義ファイルのパスを取得
   * @param projectPath プロジェクトパス
   * @returns 要件定義ファイルのパス
   */
  public getRequirementsFilePath(projectPath?: string): string {
    if (!projectPath) {
      throw new Error('プロジェクトパスが指定されていません');
    }
    const docsDir = path.join(projectPath, 'docs');
    return path.join(docsDir, 'requirements.md');
  }

  /**
   * 進捗ファイルを作成 - SCOPE_PROGRESS.mdのみ対応
   * @param projectPath プロジェクトパス
   * @param projectName プロジェクト名
   */
  public async createProgressFile(
    projectPath: string, 
    projectName?: string
  ): Promise<void> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // 常にSCOPE_PROGRESS.mdのみを使用
      const validFileName = 'SCOPE_PROGRESS.md';
        
      // docsディレクトリの確認
      const docsDir = path.join(projectPath, 'docs');
      await this.ensureDirectoryExists(docsDir);
      
      // ファイルパスの生成
      const filePath = path.join(docsDir, validFileName);
      
      // ファイルが既に存在する場合は何もしない
      if (fs.existsSync(filePath)) {
        Logger.info(`FileSystemService: 進捗ファイルは既に存在します: ${filePath}`);
        return;
      }
      
      // テンプレートの読み込み
      const templateName = 'SCOPE_PROGRESS_TEMPLATE.md';
      let templatePath = path.join(this._extensionPath, 'docs', templateName);
      
      // プロジェクト名が未指定の場合はディレクトリ名を使用
      const actualProjectName = projectName || path.basename(projectPath);
      
      // テンプレート読み込みと内容生成
      let templateContent = '';
      
      try {
        if (fs.existsSync(templatePath)) {
          // テンプレートファイルを読み込む
          templateContent = fs.readFileSync(templatePath, 'utf8');
          
          // 新しいテンプレート用の置換
          templateContent = templateContent
            .replace(/\[プロジェクト名\]/g, actualProjectName)
            .replace(/YYYY-MM-DD/g, new Date().toISOString().split('T')[0]);
          
          Logger.info(`FileSystemService: ${templateName}を読み込みました: ${templatePath}`);
        } else {
          // テンプレートが見つからない場合はデフォルトテンプレート
          templateContent = this._getDefaultProgressTemplate(actualProjectName);
          Logger.warn(`FileSystemService: ${templateName}が見つかりません。デフォルトテンプレートを使用します。`);
        }
      } catch (error) {
        // エラーが発生した場合はデフォルトテンプレートを使用
        templateContent = this._getDefaultProgressTemplate(actualProjectName);
        Logger.error(`FileSystemService: ${templateName}の読み込みに失敗しました: ${templatePath}`, error as Error);
      }
      
      // ファイルに書き込み
      await fs.promises.writeFile(filePath, templateContent, 'utf8');
      
      // ファイルが作成されたことをイベントとして通知
      this._onProgressFileChanged.fire(filePath);
      
      Logger.info(`FileSystemService: 進捗ファイルを作成しました: ${filePath}`);
    } catch (error) {
      Logger.error(`FileSystemService: 進捗ファイルの作成に失敗しました`, error as Error);
      throw error;
    }
  }
  
  // createDefaultStatusFileメソッドを削除
  
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
   * @param filePath 監視対象のファイルパス
   * @param onFileChanged ファイル変更時のコールバック
   */
  public setupFileWatcher(filePath: string, onFileChanged: (filePath: string) => void): vscode.Disposable {
    // デバッグ - メソッド開始
    console.log(`★★★★ FileSystemService.setupFileWatcher 開始: ${filePath}`);
    Logger.info(`★★★★ FileSystemService.setupFileWatcher 開始: ${filePath}`);
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
      
      if (!filePath) {
        throw new Error('監視対象のファイルパスが指定されていません');
      }

      const projectPath = path.dirname(path.dirname(filePath)); // docs/<file>からプロジェクトパスを取得
      
      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      
      // SCOPE_PROGRESS.md を監視（ハードコードに戻す）
      const watchers: vscode.FileSystemWatcher[] = [];
      const fileName = 'SCOPE_PROGRESS.md';
      const watchPath = path.join(docsDir, fileName);

      console.log(`★★★★ 監視対象ファイル設定(ハードコード版): fileName=${fileName}, watchPath=${watchPath}`);
      Logger.info(`★★★★ 監視対象ファイル設定(ハードコード版): fileName=${fileName}, watchPath=${watchPath}`);
      
      if (fs.existsSync(watchPath)) {
        // ファイルが存在する場合はそのファイルのみを監視
        // 元の実装に戻す - RelativePatternを使用
        const pattern = new vscode.RelativePattern(vscode.Uri.file(docsDir), fileName);

        // より詳細なログを出力
        console.log(`★★★★ VSCodeウォッチャー設定: docsDir=${docsDir}, fileName=${fileName}`);
        Logger.info(`★★★★ VSCodeウォッチャー設定: relativePattern=${pattern.pattern}`);

        const watcher = vscode.workspace.createFileSystemWatcher(
          pattern,
          false, // 作成イベントを無視しない
          false, // 変更イベントを無視しない
          false  // 削除イベントを無視しない
        );
        
        // ファイル変更時のイベントハンドラを設定
        watcher.onDidChange(async (uri) => {
          console.log(`★★★★ ファイル変更イベント検出: ${uri.fsPath}, 監視していたファイル=${fileName}, pattern=${pattern.pattern}`);
          Logger.info(`【重要】FileSystemService: ファイル変更イベント検出: ${uri.fsPath}, 監視対象ファイル=${fileName}`);
          Logger.info(`【デバッグ詳細】イベント: path=${uri.fsPath}, baseFileName=${path.basename(uri.fsPath)}, isRequirements=${path.basename(uri.fsPath) === 'requirements.md'}`);
          
          // ファイルが存在するか確認
          if (fs.existsSync(uri.fsPath)) {
            // 最終更新日時を取得して確実に変更を検出
            const stats = fs.statSync(uri.fsPath);
            Logger.info(`FileSystemService: ファイル情報 - 最終更新: ${stats.mtime}, サイズ: ${stats.size}バイト`);
            
            // ファイル内容をすぐに読み込んで通知
            try {
              const content = await this.readMarkdownFile(uri.fsPath);
              Logger.info(`FileSystemService: ファイル読み込み成功 - 長さ: ${content.length}文字`);
              
              // イベントを発火（より早く反応できるように先に実行）
              this._onProgressFileChanged.fire(uri.fsPath);
              Logger.info(`FileSystemService: イベント発火完了 - onProgressFileChanged`);
              
              // コールバックも呼び出して従来の動作も維持
              onFileChanged(uri.fsPath);
              Logger.info(`FileSystemService: コールバック実行完了 - onFileChanged`);
            } catch (error) {
              Logger.error(`FileSystemService: ファイル変更検出後の読み込みに失敗: ${uri.fsPath}`, error as Error);
              onFileChanged(uri.fsPath);
              this._onProgressFileChanged.fire(uri.fsPath);
            }
          } else {
            Logger.warn(`FileSystemService: 変更が検出されたファイルが存在しません: ${uri.fsPath}`);
          }
        });
        
        // ファイル作成時のイベントハンドラを設定
        watcher.onDidCreate(async (uri) => {
          Logger.info(`FileSystemService: ファイルが作成されました: ${uri.fsPath}`);
          onFileChanged(uri.fsPath);
          this._onProgressFileChanged.fire(uri.fsPath);
        });
        
        watchers.push(watcher);
        Logger.info(`FileSystemService: ${fileName}ファイルの監視を設定: ${watchPath}`);
      } else {
        // ファイルが存在しない場合でも、ファイル作成を監視
        // 元の実装に戻す - RelativePatternを使用
        const pattern = new vscode.RelativePattern(vscode.Uri.file(docsDir), fileName);

        // より詳細なログを出力
        console.log(`★★★★ VSCodeウォッチャー設定(ファイル未存在): docsDir=${docsDir}, fileName=${fileName}`);
        Logger.info(`★★★★ VSCodeウォッチャー設定(ファイル未存在): relativePattern=${pattern.pattern}`);

        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        // ファイル作成時にマークダウンコンテンツを更新
        watcher.onDidCreate(async (uri) => {
          Logger.info(`FileSystemService: ${fileName}ファイルが作成されました: ${uri.fsPath}`);
          onFileChanged(uri.fsPath);
          this._onProgressFileChanged.fire(uri.fsPath);
        });
        
        // ファイル変更時にマークダウンコンテンツを更新
        watcher.onDidChange(async (uri) => {
          console.log(`★★★★ ファイル変更イベント検出(ファイル未存在時の監視): ${uri.fsPath}, 監視していたファイル=${fileName}, pattern=${pattern.pattern}`);
          Logger.info(`【重要】FileSystemService: ファイル変更イベント検出: ${uri.fsPath}, 監視対象ファイル=${fileName}`);
          Logger.info(`【デバッグ詳細】イベント: path=${uri.fsPath}, baseFileName=${path.basename(uri.fsPath)}, isRequirements=${path.basename(uri.fsPath) === 'requirements.md'}`);
          
          // ファイルが存在するか確認
          if (fs.existsSync(uri.fsPath)) {
            // 最終更新日時を取得して確実に変更を検出
            const stats = fs.statSync(uri.fsPath);
            Logger.info(`FileSystemService: ファイル情報 - 最終更新: ${stats.mtime}, サイズ: ${stats.size}バイト`);
            
            // ファイル内容をすぐに読み込んで通知
            try {
              const content = await this.readMarkdownFile(uri.fsPath);
              Logger.info(`FileSystemService: ファイル読み込み成功 - 長さ: ${content.length}文字`);
              
              // イベントを発火（より早く反応できるように先に実行）
              this._onProgressFileChanged.fire(uri.fsPath);
              Logger.info(`FileSystemService: イベント発火完了 - onProgressFileChanged`);
              
              // コールバックも呼び出して従来の動作も維持
              onFileChanged(uri.fsPath);
              Logger.info(`FileSystemService: コールバック実行完了 - onFileChanged`);
            } catch (error) {
              Logger.error(`FileSystemService: ファイル変更検出後の読み込みに失敗: ${uri.fsPath}`, error as Error);
              onFileChanged(uri.fsPath);
              this._onProgressFileChanged.fire(uri.fsPath);
            }
          } else {
            Logger.warn(`FileSystemService: 変更が検出されたファイルが存在しません: ${uri.fsPath}`);
          }
        });
        
        watchers.push(watcher);
        Logger.info(`FileSystemService: ${fileName}ファイル作成の監視を設定: ${docsDir}`);
      }
      
      // 複合ウォッチャーを作成
      this._fileWatcher = {
        dispose: () => {
          watchers.forEach(w => w.dispose());
        }
      };
      
      // イベントバスからの更新イベントをリッスン
      const eventBus = AppGeniusEventBus.getInstance();
      
      // SCOPE_PROGRESS_UPDATED イベントを処理
      const scopeProgressEventListener = eventBus.onEventType(AppGeniusEventType.SCOPE_PROGRESS_UPDATED, async (event) => {
        // 自分自身が送信したイベントは無視（循環を防ぐ）
        if (event.source === 'FileSystemService') {
          return;
        }
        
        // プロジェクトIDが一致しない場合は無視
        if (!projectPath || !event.projectId || 
            !projectPath.includes(event.projectId)) {
          return;
        }
        
        Logger.info('FileSystemService: 他のコンポーネントからのSCOPE_PROGRESS更新イベントを受信しました');
        
        // 進捗ファイルパスを取得
        const progressFilePath = this.getProgressFilePath(projectPath);
        if (fs.existsSync(progressFilePath)) {
          onFileChanged(progressFilePath);
          this._onProgressFileChanged.fire(progressFilePath);
        }
      });
      
      this._disposables.push(scopeProgressEventListener);
      
      // 複合disposableを返す
      return {
        dispose: () => {
          watchers.forEach(w => w.dispose());
          scopeProgressEventListener.dispose();
        }
      };
    } catch (error) {
      Logger.error('FileSystemService: ファイル監視の設定中にエラーが発生しました', error as Error);
      throw error;
    }
  }
  
  // デフォルトテンプレート（従来の形式）は不要なため削除
  
  /**
   * デフォルトの進捗テンプレートを取得（SCOPE_PROGRESS形式）
   */
  private _getDefaultProgressTemplate(projectName: string): string {
    const today = new Date().toISOString().split('T')[0];
    
    return `# ${projectName} 開発プロセス進捗状況

**バージョン**: 0.1 (初期版)  
**最終更新日**: ${today}  
**ステータス**: プロジェクト作成完了・要件定義開始段階

## 1. 基本情報

- **ステータス**: 開始段階 (5% 完了)
- **完了タスク数**: 1/20
- **進捗率**: 5%
- **次のマイルストーン**: 要件定義完了 (目標: [日付])

## 2. 実装概要

${projectName}は、[このプロジェクトが解決する核心的な課題と提供する本質的な価値の簡潔な説明を1-2文で記述します]。このプロジェクトは現在、リポジトリとプロジェクト環境の準備が完了し、要件定義フェーズを開始しています。

## 3. 参照ドキュメント

*このスコープで重要となる参照ドキュメントができるたびにこちらに記載*

## 4. 開発フロー進捗状況

AppGeniusでの開発は以下のフローに沿って進行します。現在の進捗は以下の通りです：

| フェーズ | 状態 | 進捗 | 担当エージェント | 成果物 | 依存/並列情報 |
|---------|------|------|----------------|--------|--------------|
| **0. プロジェクト準備** | ✅ 完了 | 100% | - | プロジェクトリポジトリ、環境設定 | 先行必須 |
| **1. 要件定義** | 🔄 進行中 | 5% | プロジェクトファウンデーション (#1) | [requirements.md](/docs/requirements.md) | 先行必須 |
| **2. 技術選定** | ⏱ 未着手 | 0% | プロジェクトファウンデーション (#1) | [tech-stack.md](/docs/architecture/tech-stack.md) | フェーズ1後 |
| **3. モックアップ作成** | ⏱ 未着手 | 0% | モックアップクリエイター (#2) | [mockups/](/mockups/) | フェーズ1後 |
| **4. データモデル設計** | ⏱ 未着手 | 0% | データモデルアーキテクト (#3) | [shared/index.ts](/shared/index.ts) | フェーズ3後、5と並列可 |
| **5. API設計** | ⏱ 未着手 | 0% | APIデザイナー (#4) | [docs/api/](/docs/api/) | フェーズ3後、4と並列可 |
| **6. 実装計画** | ⏱ 未着手 | 0% | スコーププランナー (#8) | SCOPE_PROGRESS.md 更新 | フェーズ4,5後 |
| **7. バックエンド実装** | ⏱ 未着手 | 0% | バックエンド実装エージェント (#10) | サーバーサイドコード | フェーズ6後、8と並列可 |
| **8. フロントエンド実装** | ⏱ 未着手 | 0% | フロントエンド実装エージェント (#9) | クライアントサイドコード | フェーズ6後、7と並列可 |
| **9. テスト** | ⏱ 未着手 | 0% | テスト管理エージェント (#11) | テストコード | フェーズ7,8後 |
| **10. デプロイ準備** | ⏱ 未着手 | 0% | デプロイ設定エージェント (#13) | [docs/deployment/](/docs/deployment/) | フェーズ9後 |

## 5. タスクリスト

### プロジェクト準備フェーズ
- [x] 1. プロジェクトリポジトリ作成
- [x] 2. 開発環境のセットアップ
- [x] 3. 初期ディレクトリ構造の作成
- [x] 4. README.mdの作成
- [x] 5. 開発フレームワークの初期設定

### 要件定義フェーズ
- [🔄] 6. プロジェクト目的と背景の明確化
- [ ] 7. ターゲットユーザーの特定
- [ ] 8. 主要機能リストの作成
- [ ] 9. 画面一覧の作成
- [ ] 10. ユーザーストーリーの作成
- [ ] 11. 技術要件の定義

### 技術選定フェーズ
- [ ] 12. フロントエンド技術の評価と選定
- [ ] 13. バックエンド技術の評価と選定
- [ ] 14. データベース技術の評価と選定
- [ ] 15. インフラストラクチャの計画

## 6. 次のステップ

要件定義が完了したら、以下のステップに進みます：

1. **技術スタックの選定**
   - プロジェクト要件に適した技術の評価
   - フロントエンド/バックエンド技術の決定
   - インフラストラクチャとデプロイ方法の検討

2. **モックアップ作成**
   - 優先度の高い画面から順にモックアップ作成
   - ユーザーフローとインタラクションの検討
   - 要件定義書のブラッシュアップ

3. **データモデル設計**
   - 要件から必要なデータ構造を特定
   - エンティティと関係性を定義
   - 初期データモデルの設計

## 7. エラー引き継ぎログ

このセクションは、AI間の知識継承のための重要な機能です。複雑なエラーや課題に遭遇した場合、次のAIが同じ問題解決に時間を浪費しないよう記録します。

**重要ルール**:
1. エラーが解決されたらすぐに該当ログを削除すること
2. 一度に対応するのは原則1タスクのみ（並列開発中のタスクを除く）
3. 試行済みのアプローチと結果を詳細に記録すること
4. コンテキストウィンドウの制限を考慮し、簡潔かつ重要な情報のみを記載すること
5. 解決の糸口や参考リソースを必ず含めること

### 現在のエラーログ

| タスクID | 問題・課題の詳細 | 試行済みアプローチとその結果 | 現状 | 次のステップ | 参考資料 |
|---------|----------------|------------------------|------|------------|---------|
| 【例】R-001 | 関係者間でプロジェクト目標の認識に差異がある | 1. ステークホルダーとの個別ヒアリング：優先事項に不一致<br>2. KPI設定の試み：測定基準に合意できず | 1. 必須目標と任意目標の区別ができていない<br>2. 成功の定義が明確でない | 1. ビジネスゴールワークショップの開催<br>2. 優先順位付けの共同セッション<br>3. 成功基準の数値化 | [プロジェクト目標設定ガイド](/docs/guides/project-goal-setting.md) |

## 8. 付録

### A. プロジェクト開発標準フロー

\`\`\`
[プロジェクト準備] → [要件定義] → [モックアップ作成] → [データモデル設計] → [API設計] → [実装計画] → [フロントエンド/バックエンド実装] → [テスト] → [デプロイ]
\`\`\`

### B. AIエージェント活用ガイド

開発プロンプトをクリックして要件定義 (#1) を活用するところから始めてください

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
      // 詳細なログを追加
      console.log(`★★★★ 拡張ファイル監視設定開始: path=${statusFilePath}, fileName=${path.basename(statusFilePath)}`);
      Logger.info(`★★★★ 拡張ファイル監視設定開始: path=${statusFilePath}, fileName=${path.basename(statusFilePath)}`);

      // 基本的なファイル監視を設定
      const baseWatcher = this.setupFileWatcher(statusFilePath, async (filePath) => {
        // ファイル変更時に即時通知（詳細ログ追加）
        Logger.info(`★★★ FileSystemService(Enhanced): ファイル変更検出: ${filePath}`);
        console.log(`★★★ ENHANCED FILE WATCHER: ファイル変更検出: ${filePath}`);

        try {
          // ファイル拡張子を確認
          const ext = path.extname(filePath).toLowerCase();
          Logger.info(`ファイル拡張子: ${ext}, ベース名: ${path.basename(filePath)}`);

          // ファイル情報を取得して表示（修正日時）
          try {
            const stats = fs.statSync(filePath);
            Logger.info(`ファイル情報: サイズ=${stats.size}バイト, 最終更新=${stats.mtime.toISOString()}`);
          } catch (statErr) {
            Logger.warn(`ファイル情報取得失敗: ${statErr}`);
          }

          // 即時読み込みと通知
          const content = await this.readMarkdownFile(filePath);
          Logger.info(`★★★ ファイル読み込み成功: ${content.length}文字`);

          // 要件定義ファイルの場合は特別なイベントを発行
          const fileBaseName = path.basename(filePath).toLowerCase();
          if (fileBaseName === 'requirements.md' ||
              filePath.toLowerCase().includes('requirement') ||
              filePath.toLowerCase().includes('要件')) {

            // より詳細なログを出力
            console.log(`★★★★ 要件定義ファイル変更を検出: path=${filePath}, baseName=${fileBaseName}`);
            Logger.info(`★★★★ 要件定義ファイル変更を検出: path=${filePath}, baseName=${fileBaseName}`);
            Logger.info(`★★★ FileSystemService(Enhanced): 要件定義ファイルの変更を検出: ${filePath}`);
            console.log(`★★★ REQUIREMENTS FILE CHANGED: ${filePath}`);

            // 既存のREQUIREMENTS_UPDATEDイベントを使用して通知
            const eventBus = AppGeniusEventBus.getInstance();
            eventBus.emit(AppGeniusEventType.REQUIREMENTS_UPDATED, {
              path: filePath,
              content: content
            }, 'FileSystemService', this._getProjectIdFromPath(filePath));

            Logger.info(`★★★ FileSystemService(Enhanced): 要件定義更新イベントを発行しました`);
            console.log(`★★★ REQUIREMENTS_UPDATED EVENT FIRED`);
          }

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
   * 進捗ファイル用のイベントリスナーを設定
   * AppGeniusEventBusからのSCOPE_PROGRESS_UPDATEDイベントをリッスン
   * @param projectPath プロジェクトパス
   * @param progressFilePath 進捗ファイルパス
   * @param onProgressUpdate 進捗更新時のコールバック
   */
  public setupStatusFileEventListener(
    projectPath: string,
    progressFilePath: string,
    onProgressUpdate: (filePath: string) => void
  ): vscode.Disposable {
    try {
      // イベントバスからのSCOPE_PROGRESS_UPDATEDイベントをリッスン
      const eventBus = AppGeniusEventBus.getInstance();
      const listener = eventBus.onEventType(AppGeniusEventType.SCOPE_PROGRESS_UPDATED, async (event) => {
        // 自分自身が送信したイベントは無視（循環を防ぐ）
        if (event.source === 'FileSystemService') {
          return;
        }
        
        // プロジェクトIDが一致しない場合は無視
        if (!projectPath || !event.projectId || 
            !projectPath.includes(event.projectId)) {
          return;
        }
        
        Logger.info(`FileSystemService: 他のコンポーネントからのSCOPE_PROGRESS更新イベントを受信: projectPath=${projectPath}`);
        
        // 進捗ファイルが存在する場合はその内容を読み込み
        if (await this.fileExists(progressFilePath)) {
          try {
            await this.readMarkdownFile(progressFilePath);
            onProgressUpdate(progressFilePath);
          } catch (error) {
            Logger.error(`FileSystemService: 進捗ファイル読み込みに失敗: ${progressFilePath}`, error as Error);
            // エラーがあっても通知だけは行う
            onProgressUpdate(progressFilePath);
          }
        } else {
          Logger.warn(`FileSystemService: 進捗ファイルが存在しません: ${progressFilePath}`);
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
   * 進捗ファイルを読み込み、必要に応じて作成する
   * @param projectPath プロジェクトパス
   * @param outputCallback 出力コールバック - ファイル内容が変更された時に呼び出される
   * @returns 進捗ファイルの内容
   */
  public async loadProgressFile(projectPath: string, outputCallback?: (content: string) => void): Promise<string> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }

      // 進捗ファイルのパスを取得
      const docsDir = path.join(projectPath, 'docs');
      await this.ensureDirectoryExists(docsDir);
      
      // 進捗ファイルのパスを取得
      const progressFilePath = this.getProgressFilePath(projectPath);
      
      // ファイルの存在確認
      const fileExists = await this.fileExists(progressFilePath);

      // 進捗ファイルが存在しない場合はテンプレートを作成
      if (!fileExists) {
        const projectName = path.basename(projectPath);
        await this.createProgressFile(projectPath, projectName);
        Logger.info(`進捗ファイルを作成しました: ${progressFilePath}`);
      }

      // ファイルを読み込む
      const content = await this.readMarkdownFile(progressFilePath);
      
      // コールバックがあれば呼び出す
      if (outputCallback) {
        outputCallback(content);
      }
      
      return content;
    } catch (error) {
      Logger.error('進捗ファイルの読み込み中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * プロジェクトのディレクトリ構造を更新
   * @param projectPath プロジェクトパス
   * @returns ディレクトリ構造を表す文字列
   */
  public async updateDirectoryStructure(projectPath: string): Promise<string> {
    if (!projectPath) {
      return '';
    }
    
    try {
      // 既存のgetDirectoryStructureメソッドを使用
      const structure = await this.getDirectoryStructure(projectPath);
      
      // イベントを発火
      this._onDirectoryStructureUpdated.fire(structure);
      
      return structure;
    } catch (error) {
      Logger.error('ディレクトリ構造の更新中にエラーが発生しました', error as Error);
      return 'ディレクトリ構造の取得に失敗しました。';
    }
  }

  /**
   * プロジェクト用のファイル監視設定
   * 進捗ファイル（SCOPE_PROGRESS.md）の変更を監視し、イベントとコールバックで通知
   * @param projectPath プロジェクトのルートパス
   * @param outputCallback ファイル変更時のコールバック
   * @returns Disposable - 監視を停止するためのオブジェクト
   */
  public setupProjectFileWatcher(projectPath: string, outputCallback: (filePath: string) => void): vscode.Disposable {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // 進捗ファイルのパスを取得
      const docsDir = path.join(projectPath, 'docs');
      // ディレクトリを確保
      this.ensureDirectoryExists(docsDir);
      
      // 進捗ファイルのパスを取得
      const progressFilePath = this.getProgressFilePath(projectPath);
      
      // 拡張ファイル監視を設定（遅延読み込みオプション付き）
      const watcher = this.setupEnhancedFileWatcher(
        progressFilePath,
        async (filePath) => {
          // ファイル変更を検出したらコールバックを呼び出す
          Logger.info(`FileSystemService: ファイル変更を検出: ${filePath}`);
          outputCallback(filePath);
        },
        { delayedReadTime: 100 } // 100ms後に2回目の読み込みを実行
      );
      
      // イベントリスナーも設定
      const eventListener = this.setupStatusFileEventListener(
        projectPath,
        progressFilePath,
        async (filePath) => {
          // イベントバス経由の通知を受けた場合もコールバックを呼び出す
          Logger.info(`FileSystemService: イベントバス経由でファイル更新を検出: ${filePath}`);
          outputCallback(filePath);
        }
      );
      
      // 複合Disposableを返す
      return {
        dispose: () => {
          watcher.dispose();
          eventListener.dispose();
        }
      };
    } catch (error) {
      Logger.error('ファイル監視の設定中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    // イベントエミッターを解放
    this._onProgressFileChanged.dispose();
    this._onDirectoryStructureUpdated.dispose();
    this._onFileBrowserUpdated.dispose();
    
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
          
          const document: IProjectDocument = {
            path: entryPath,
            name: entry.name,
            type: this.getFileType(entryPath),
            lastModified: new Date(stats.mtime),
            parentFolder: directoryPath,
            isDirectory: entry.isDirectory(),
            size: stats.size
          };

          // 再帰的に取得する場合は子ディレクトリも処理
          if (entry.isDirectory() && recursive) {
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
        projectPath,                        // 次優先: プロジェクトルート
        path.join(projectPath, 'doc'),      // 代替: doc/
        path.join(projectPath, 'documents') // 代替: documents/
      ];

      // 各ディレクトリで候補ファイルを検索
      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          for (const fileName of candidateNames) {
            const filePath = path.join(dir, fileName);
            if (await this.fileExists(filePath)) {
              Logger.info(`FileSystemService: 要件定義ファイルを見つけました: ${filePath}`);
              return filePath;
            }
          }

          // ディレクトリ内のすべての.mdファイルをチェック
          try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              if (path.extname(file).toLowerCase() === '.md') {
                const filePath = path.join(dir, file);

                // ファイル名に「要件」「requirement」が含まれているかチェック
                const fileName = path.basename(file).toLowerCase();
                if (
                  fileName.includes('要件') ||
                  fileName.includes('requirement') ||
                  fileName.includes('youken')
                ) {
                  Logger.info(`FileSystemService: 要件関連のマークダウンファイルを見つけました: ${filePath}`);
                  return filePath;
                }

                // ファイル内容をチェック（最初の数行だけ）
                try {
                  const content = fs.readFileSync(filePath, 'utf8').slice(0, 1000).toLowerCase();
                  if (
                    content.includes('# 要件') ||
                    content.includes('# requirement') ||
                    content.includes('要件定義') ||
                    content.includes('requirements definition')
                  ) {
                    Logger.info(`FileSystemService: 内容から要件定義ファイルと判断: ${filePath}`);
                    return filePath;
                  }
                } catch (readError) {
                  // ファイル読み込みエラーは無視して次のファイルへ
                  continue;
                }
              }
            }
          } catch (readDirError) {
            // ディレクトリ読み込みエラーは無視して次のディレクトリへ
            continue;
          }
        }
      }

      // 見つからなかった場合
      Logger.warn('FileSystemService: 要件定義ファイルが見つかりませんでした');
      return null;
    } catch (error) {
      Logger.error(`FileSystemService: 要件定義ファイル検索中にエラー: ${(error as Error).message}`, error as Error);
      return null;
    }
  }

  /**
   * パスからプロジェクトIDを抽出するヘルパーメソッド
   * ファイルパスから適切なプロジェクトIDを生成する
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
   * 要件定義ファイルの監視を設定
   * @param projectPath プロジェクトパス
   * @param outputCallback ファイル変更時のコールバック
   * @returns 監視オブジェクト
   */
  public async setupRequirementsFileWatcher(
    projectPath?: string,
    outputCallback?: (filePath: string) => void
  ): Promise<vscode.Disposable> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }

      // コールバックが未指定の場合のデフォルト処理
      const callback = outputCallback || ((filePath: string) => {
        Logger.info(`FileSystemService: 要件定義ファイル変更を検出（デフォルト処理）: ${filePath}`);
      });

      // 要件定義ファイルのパスを取得
      const requirementsFilePath = this.getRequirementsFilePath(projectPath);

      // ファイルウォッチャーを設定
      Logger.info(`FileSystemService: 要件定義ファイルの監視を設定します: ${requirementsFilePath}`);
      const fileWatcher = this.setupEnhancedFileWatcher(
        requirementsFilePath,
        callback,
        { delayedReadTime: 500 }  // 500ms後に遅延読み込み
      );

      return fileWatcher;
    } catch (error) {
      Logger.error(`FileSystemService: 要件定義ファイル監視の設定に失敗しました: ${projectPath || '不明'}`, error as Error);
      // エラー時は空のDisposableを返す
      return { dispose: () => {} };
    }
  }

  /**
   * ファイルを読み込む汎用メソッド
   * markdown以外のファイル形式にも対応
   * @param filePath ファイルパス
   * @param fileType ファイルタイプ（指定がない場合は拡張子から自動判別）
   * @returns ファイル内容
   */
  public async readFile(filePath: string, fileType?: string): Promise<string> {
    try {
      if (!filePath) {
        throw new Error('ファイルパスが指定されていません');
      }

      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        Logger.warn(`FileSystemService: ファイルが存在しません: ${filePath}`);
        return '';
      }

      // ファイルタイプが指定されていない場合は判別
      const actualFileType = fileType || this.getFileType(filePath);

      // ファイルタイプに応じた処理
      switch (actualFileType) {
        case 'markdown':
          // マークダウンファイルは既存のメソッドを使用
          return this.readMarkdownFile(filePath);
        
        case 'image':
          // 画像ファイルの場合はデータURLを返す
          return 'このファイルは画像です。プレビューは現在サポートされていません。';
        
        case 'binary':
          // バイナリファイルの場合
          return 'このファイルはバイナリファイルです。テキスト表示できません。';
        
        default:
          // テキストファイルとして読み込む
          const content = fs.readFileSync(filePath, 'utf8');
          return content;
      }
    } catch (error) {
      Logger.error(`FileSystemService: ファイル読み込みエラー: ${filePath}`, error as Error);
      return `ファイルの読み込みに失敗しました: ${(error as Error).message}`;
    }
  }

  /**
   * ファイルをVSCodeエディタで開く
   * @param filePath 開くファイルのパス
   */
  public async openFileInEditor(filePath: string): Promise<void> {
    try {
      Logger.info(`FileSystemService: ファイルをエディタで開きます: ${filePath}`);
      
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // VSCodeのOpen APIを使用してファイルを開く
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(document);
      
      Logger.info(`FileSystemService: ファイルをエディタで開きました: ${filePath}`);
    } catch (error) {
      Logger.error(`FileSystemService: ファイルをエディタで開く際にエラーが発生しました: ${filePath}`, error as Error);
      throw error;
    }
  }

  /**
   * 指定されたディレクトリに移動する
   * @param dirPath 移動先のディレクトリパス
   * @param panel WebViewパネル（ファイル一覧の更新に使用）
   */
  public async navigateDirectory(dirPath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      Logger.info(`FileSystemService: ディレクトリに移動します: ${dirPath}`);
      
      // ディレクトリの存在確認
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        throw new Error(`ディレクトリが見つかりません: ${dirPath}`);
      }
      
      // ディレクトリの内容をリストアップ
      const files = await this.listDirectory(dirPath);
      
      // ファイルリストを送信
      panel.webview.postMessage({
        command: 'updateFileList',
        files: files,
        currentPath: dirPath,
        parentPath: path.dirname(dirPath) !== dirPath ? path.dirname(dirPath) : null
      });
      
      // イベント発火
      this._onFileBrowserUpdated.fire(files);
      
      Logger.info(`FileSystemService: ディレクトリ内容を取得しました: ${dirPath}, ${files.length}件`);
    } catch (error) {
      Logger.error(`FileSystemService: ディレクトリの移動に失敗しました: ${dirPath}`, error as Error);
      throw error;
    }
  }

  /**
   * ファイルを開いてプレビュー表示する
   * @param filePath 開くファイルのパス
   * @param panel WebViewパネル（コンテンツの表示に使用）
   */
  public async openFile(filePath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      Logger.info(`FileSystemService: ファイルを開きます: ${filePath}`);
      
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの種類を判定
      const fileExt = path.extname(filePath).toLowerCase();
      
      // テキストファイルかどうかを判断
      if (['.md', '.txt', '.js', '.ts', '.json', '.html', '.css', '.scss', '.yml', '.yaml', '.xml', '.svg'].includes(fileExt)) {
        // テキストファイルの場合は内容を読み込んで表示
        const content = await this.readFile(filePath);
        
        panel.webview.postMessage({
          command: 'updateFilePreview',
          filePath: filePath,
          content: content,
          type: 'text',
          extension: fileExt
        });
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(fileExt)) {
        // 画像ファイルの場合は画像として表示
        panel.webview.postMessage({
          command: 'updateFilePreview',
          filePath: filePath,
          type: 'image',
          extension: fileExt,
          // ファイルURIをWebView用に変換
          uri: panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString()
        });
      } else {
        // その他のファイルはVSCodeで開く
        await this.openFileInEditor(filePath);
        
        // 成功メッセージを表示
        panel.webview.postMessage({
          command: 'showSuccess',
          message: `ファイル「${path.basename(filePath)}」をVSCodeで開きました`
        });
      }
      
      Logger.info(`FileSystemService: ファイル「${path.basename(filePath)}」を開きました`);
    } catch (error) {
      Logger.error(`FileSystemService: ファイルを開く際にエラーが発生しました: ${filePath}`, error as Error);
      throw error;
    }
  }

  /**
   * ファイルブラウザを更新
   * @param projectPath プロジェクトパス
   * @param panel WebViewパネル（ファイル一覧の更新に使用）
   */
  public async refreshFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      Logger.info(`FileSystemService: ファイルブラウザを更新します: ${projectPath}`);
      
      // ディレクトリ構造を更新
      const structure = await this.updateDirectoryStructure(projectPath);
      
      // WebViewにディレクトリ構造を送信
      panel.webview.postMessage({
        command: 'updateFileBrowser',
        structure: structure
      });
      
      // イベント発火
      this._onDirectoryStructureUpdated.fire(structure);
      
      Logger.info(`FileSystemService: ファイルブラウザを更新しました`);
    } catch (error) {
      Logger.error(`FileSystemService: ファイルブラウザの更新に失敗しました: ${projectPath}`, error as Error);
      throw error;
    }
  }

  /**
   * ファイルブラウザの初期化
   * @param projectPath プロジェクトパス
   * @param panel WebViewパネル（ファイル一覧の更新に使用）
   */
  public async initializeFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      Logger.info(`FileSystemService: ファイルブラウザの初期化を開始します: ${projectPath}`);
      
      // プロジェクトパスが設定されていない場合は処理しない
      if (!projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // docsディレクトリのパスを生成
      const docsPath = path.join(projectPath, 'docs');
      
      // docsディレクトリの存在確認と作成
      await this.ensureDirectoryExists(docsPath);
      
      // ディレクトリ構造を更新
      const structure = await this.updateDirectoryStructure(projectPath);
      
      // ファイルブラウザ用のディレクトリ構造を送信
      panel.webview.postMessage({
        command: 'updateFileBrowser',
        structure: structure
      });
      
      // ディレクトリの内容をリストアップ
      const files = await this.listDirectory(docsPath);
      
      // ファイルリストを送信
      panel.webview.postMessage({
        command: 'updateFileList',
        files: files,
        currentPath: docsPath
      });
      
      // イベント発火
      this._onFileBrowserUpdated.fire(files);
      
      Logger.info(`FileSystemService: ファイルブラウザを初期化しました: ${docsPath}`);
    } catch (error) {
      Logger.error(`FileSystemService: ファイルブラウザの初期化中にエラーが発生しました: ${projectPath}`, error as Error);
      throw error;
    }
  }
}