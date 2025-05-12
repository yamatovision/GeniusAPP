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
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    return `# [プロジェクト名] 開発プロセス進捗状況

**バージョン**: 0.1 (初期版)  
**最終更新日**: ${today}  
**ステータス**: プロジェクト作成完了・要件定義開始段階

## 1. 基本情報

- **ステータス**: 開始段階 (5% 完了)
- **完了タスク数**: 1/20
- **進捗率**: 5%
- **次のマイルストーン**: 要件定義完了 (目標: [日付])

## 2. 実装概要

[プロジェクト名]は、[このプロジェクトが解決する核心的な課題と提供する本質的な価値の簡潔な説明を1-2文で記述します]。このプロジェクトは現在、リポジトリとプロジェクト環境の準備が完了し、要件定義フェーズを開始しています。

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