import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { performance } from 'perf_hooks';

// VSCodeモック
import { mockVscode } from '../../mocks/vscode.mock';

// 新実装（リファクタリング済み）
import { FileSystemServiceImpl } from '../../../src/ui/scopeManager/services/implementations/FileSystemServiceImpl';
import { ProjectServiceImpl } from '../../../src/ui/scopeManager/services/implementations/ProjectServiceImpl';
import { TabStateServiceImpl } from '../../../src/ui/scopeManager/services/implementations/TabStateServiceImpl';
import { PanelServiceImpl } from '../../../src/ui/scopeManager/services/implementations/PanelServiceImpl';
import { MessageDispatchServiceImpl } from '../../../src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl';

// 旧実装
import { FileSystemService } from '../../../src/ui/scopeManager/services/FileSystemService';
import { ProjectService } from '../../../src/ui/scopeManager/services/ProjectService';
import { TabStateService } from '../../../src/ui/scopeManager/services/TabStateService';
import { PanelService } from '../../../src/ui/scopeManager/services/PanelService';
import { MessageDispatchService } from '../../../src/ui/scopeManager/services/MessageDispatchService';

import { EventBus } from '../../../src/services/EventBus';

/**
 * パフォーマンステスト用ユーティリティ関数
 * @param name 計測名称
 * @param fn 計測対象の非同期関数
 * @returns 実行時間（ミリ秒）と関数の戻り値
 */
async function measure<T>(name: string, fn: () => Promise<T>): Promise<[number, T]> {
  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    const elapsed = end - start;
    console.log(`[${name}] ${elapsed.toFixed(2)}ms`);
    return [elapsed, result];
  } catch (error) {
    const end = performance.now();
    const elapsed = end - start;
    console.error(`[${name}] エラー: ${elapsed.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * テスト実行のメインクラス
 */
class ScopeManagerPerformanceTest {
  private testProjectPath: string;
  private mockWebviewPanel: vscode.WebviewPanel;
  private mockExtensionUri: vscode.Uri;
  private mockExtensionContext: vscode.ExtensionContext;
  private sentMessages: any[] = [];
  
  // 新実装のサービスインスタンス
  private newFileSystemService: FileSystemServiceImpl;
  private newProjectService: ProjectServiceImpl;
  private newTabStateService: TabStateServiceImpl;
  private newPanelService: PanelServiceImpl;
  private newMessageService: MessageDispatchServiceImpl;
  
  // 旧実装のサービスインスタンス
  private oldFileSystemService: FileSystemService;
  private oldProjectService: ProjectService;
  private oldTabStateService: TabStateService;
  private oldPanelService: PanelService;
  private oldMessageService: MessageDispatchService;
  
  constructor() {
    // テスト用プロジェクトパスの設定
    this.testProjectPath = path.join(__dirname, '..', '..', '..', 'test_projects', 'test_project');
    
    // モックの設定
    this.setupMocks();
    
    // 新実装のサービスを初期化
    this.initializeNewServices();
    
    // 旧実装のサービスを初期化
    this.initializeOldServices();
  }
  
  /**
   * モックのセットアップ
   */
  private setupMocks() {
    // モックWebviewPanelを作成
    this.mockWebviewPanel = {
      webview: {
        postMessage: (message: any) => {
          this.sentMessages.push(message);
          return true;
        },
        html: '',
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: '',
        onDidReceiveMessage: () => ({ dispose: () => {} })
      },
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeViewState: () => ({ dispose: () => {} }),
      reveal: () => {},
      dispose: () => {},
      visible: true,
      active: true,
      viewColumn: vscode.ViewColumn.One,
      title: 'Test Panel',
      iconPath: undefined,
      viewType: 'testPanel'
    } as any;
    
    // モックのExtensionUriとExtensionContextを作成
    this.mockExtensionUri = vscode.Uri.file(__dirname);
    this.mockExtensionContext = {
      subscriptions: [],
      extensionUri: this.mockExtensionUri,
      extensionPath: __dirname,
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        setKeysForSync: () => {},
      },
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        setKeysForSync: () => {},
      },
      secrets: {
        get: () => Promise.resolve(''),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve()
      },
      extensionMode: vscode.ExtensionMode.Development,
      logUri: vscode.Uri.file(path.join(__dirname, 'logs')),
      globalStorageUri: vscode.Uri.file(path.join(__dirname, 'globalStorage')),
      storagePath: path.join(__dirname, 'storage'),
      globalStoragePath: path.join(__dirname, 'globalStorage'),
      logPath: path.join(__dirname, 'logs'),
      asAbsolutePath: (relativePath: string) => path.join(__dirname, relativePath),
      storageUri: vscode.Uri.file(path.join(__dirname, 'storage')),
      environmentVariableCollection: {} as any
    } as any;
  }
  
  /**
   * 新実装のサービスを初期化
   */
  private initializeNewServices() {
    this.newFileSystemService = FileSystemServiceImpl.getInstance();
    this.newProjectService = ProjectServiceImpl.getInstance(this.newFileSystemService);
    this.newTabStateService = TabStateServiceImpl.getInstance(this.newProjectService, this.newFileSystemService);
    this.newPanelService = PanelServiceImpl.getInstance(this.mockExtensionUri, this.mockExtensionContext);
    this.newMessageService = MessageDispatchServiceImpl.getInstance();
    
    // 依存関係を設定
    this.newPanelService.setProjectService(this.newProjectService);
    this.newPanelService.setFileSystemService(this.newFileSystemService);
    this.newPanelService.setTabStateService(this.newTabStateService);
    
    this.newMessageService.setDependencies({
      projectService: this.newProjectService,
      fileSystemService: this.newFileSystemService,
      panelService: this.newPanelService
    });
  }
  
  /**
   * 旧実装のサービスを初期化
   */
  private initializeOldServices() {
    this.oldFileSystemService = FileSystemService.getInstance();
    this.oldProjectService = ProjectService.getInstance(this.oldFileSystemService);
    this.oldTabStateService = TabStateService.getInstance();
    this.oldPanelService = PanelService.getInstance(this.mockExtensionUri, this.mockExtensionContext, {} as any);
    this.oldMessageService = MessageDispatchService.getInstance();
    
    // 依存関係を設定
    (this.oldPanelService as any)._projectService = this.oldProjectService;
    (this.oldPanelService as any)._fileSystemService = this.oldFileSystemService;
    
    this.oldMessageService.setDependencies({
      projectService: this.oldProjectService,
      fileSystemService: this.oldFileSystemService,
      panelService: this.oldPanelService
    });
  }
  
  /**
   * メッセージをクリア
   */
  private clearMessages() {
    this.sentMessages = [];
  }
  
  /**
   * テスト前準備
   */
  async setup() {
    // テスト用ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.testProjectPath)) {
      fs.mkdirSync(this.testProjectPath, { recursive: true });
    }
    
    // テスト用のdocsディレクトリを作成
    const docsPath = path.join(this.testProjectPath, 'docs');
    if (!fs.existsSync(docsPath)) {
      fs.mkdirSync(docsPath, { recursive: true });
    }
    
    // テスト用のSCOPE_PROGRESS.mdファイルを作成
    const progressFilePath = path.join(docsPath, 'SCOPE_PROGRESS.md');
    fs.writeFileSync(progressFilePath, '# テストプロジェクト\n\nこれはテスト用プロジェクトの進捗ファイルです。\n\n## 現在の進捗\n\n- [ ] 項目1\n- [ ] 項目2\n- [ ] 項目3\n');
    
    // テスト用のrequirements.mdファイルを作成
    const requirementsFilePath = path.join(docsPath, 'requirements.md');
    fs.writeFileSync(requirementsFilePath, '# 要件定義\n\nこれはテスト用プロジェクトの要件定義ファイルです。\n\n## 主要機能\n\n- 機能1\n- 機能2\n- 機能3\n');
  }
  
  /**
   * テスト完了後のクリーンアップ
   */
  async teardown() {
    // イベントバスをクリア
    EventBus.getInstance().dispose();
    
    // 新実装のサービスをクリーンアップ
    this.newPanelService.dispose();
    this.newMessageService.dispose();
    
    // 旧実装のサービスをクリーンアップ
    this.oldPanelService.dispose();
    this.oldMessageService.dispose();
  }
  
  /**
   * プロジェクト切り替えパフォーマンステスト
   */
  async testProjectSwitchPerformance() {
    console.log('========== プロジェクト切り替えパフォーマンステスト ==========');
    
    const projectName = 'テストプロジェクト';
    const projectPath = this.testProjectPath;
    
    // 旧実装でのプロジェクト選択パフォーマンス測定
    this.clearMessages();
    const [oldTime, _] = await measure('旧実装: プロジェクト選択', async () => {
      await this.oldMessageService.selectProject(this.mockWebviewPanel, projectName, projectPath);
      return this.sentMessages.length;
    });
    const oldMessageCount = this.sentMessages.length;
    
    // 新実装でのプロジェクト選択パフォーマンス測定
    this.clearMessages();
    const [newTime, __] = await measure('新実装: プロジェクト選択', async () => {
      await this.newMessageService.selectProject(this.mockWebviewPanel, projectName, projectPath);
      return this.sentMessages.length;
    });
    const newMessageCount = this.sentMessages.length;
    
    // 改善率を計算
    const timeImprovement = ((oldTime - newTime) / oldTime) * 100;
    const messageImprovement = ((oldMessageCount - newMessageCount) / oldMessageCount) * 100;
    
    console.log(`== 結果 ==`);
    console.log(`実行時間: ${oldTime.toFixed(2)}ms → ${newTime.toFixed(2)}ms (${timeImprovement.toFixed(2)}% 改善)`);
    console.log(`メッセージ数: ${oldMessageCount}件 → ${newMessageCount}件 (${messageImprovement.toFixed(2)}% 削減)`);
    
    return {
      oldTime,
      newTime,
      oldMessageCount,
      newMessageCount,
      timeImprovement,
      messageImprovement
    };
  }
  
  /**
   * ファイル読み込みパフォーマンステスト
   */
  async testFileReadPerformance() {
    console.log('========== ファイル読み込みパフォーマンステスト ==========');
    
    const progressFilePath = path.join(this.testProjectPath, 'docs', 'SCOPE_PROGRESS.md');
    
    // 旧実装でのファイル読み込みパフォーマンス測定
    this.clearMessages();
    const [oldTime, oldContent] = await measure('旧実装: ファイル読み込み', async () => {
      return this.oldFileSystemService.readMarkdownFile(progressFilePath);
    });
    
    // 新実装でのファイル読み込みパフォーマンス測定
    this.clearMessages();
    const [newTime, newContent] = await measure('新実装: ファイル読み込み', async () => {
      return this.newFileSystemService.readMarkdownFile(progressFilePath);
    });
    
    // 改善率を計算
    const timeImprovement = ((oldTime - newTime) / oldTime) * 100;
    
    console.log(`== 結果 ==`);
    console.log(`実行時間: ${oldTime.toFixed(2)}ms → ${newTime.toFixed(2)}ms (${timeImprovement.toFixed(2)}% 改善)`);
    
    // コンテンツが同じかチェック
    assert.strictEqual(oldContent, newContent, 'ファイル内容が一致すべき');
    
    return {
      oldTime,
      newTime,
      timeImprovement,
      contentMatches: oldContent === newContent
    };
  }
  
  /**
   * ディレクトリ構造取得パフォーマンステスト
   */
  async testDirectoryStructurePerformance() {
    console.log('========== ディレクトリ構造取得パフォーマンステスト ==========');
    
    // 旧実装でのディレクトリ構造取得パフォーマンス測定
    this.clearMessages();
    const [oldTime, oldStructure] = await measure('旧実装: ディレクトリ構造取得', async () => {
      return this.oldFileSystemService.getDirectoryStructure(this.testProjectPath);
    });
    
    // 新実装でのディレクトリ構造取得パフォーマンス測定
    this.clearMessages();
    const [newTime, newStructure] = await measure('新実装: ディレクトリ構造取得', async () => {
      return this.newFileSystemService.getDirectoryStructure(this.testProjectPath);
    });
    
    // 改善率を計算
    const timeImprovement = ((oldTime - newTime) / oldTime) * 100;
    
    console.log(`== 結果 ==`);
    console.log(`実行時間: ${oldTime.toFixed(2)}ms → ${newTime.toFixed(2)}ms (${timeImprovement.toFixed(2)}% 改善)`);
    
    return {
      oldTime,
      newTime,
      timeImprovement
    };
  }
  
  /**
   * 総合パフォーマンステスト実行
   */
  async runAllTests() {
    try {
      await this.setup();
      
      // 各テストを実行
      const projectSwitchResults = await this.testProjectSwitchPerformance();
      const fileReadResults = await this.testFileReadPerformance();
      const directoryStructureResults = await this.testDirectoryStructurePerformance();
      
      // 総合結果をコンソールに出力
      console.log('\n========== 総合テスト結果 ==========');
      console.log(`プロジェクト切り替え: ${projectSwitchResults.timeImprovement.toFixed(2)}% 改善`);
      console.log(`メッセージ数: ${projectSwitchResults.messageImprovement.toFixed(2)}% 削減`);
      console.log(`ファイル読み込み: ${fileReadResults.timeImprovement.toFixed(2)}% 改善`);
      console.log(`ディレクトリ構造取得: ${directoryStructureResults.timeImprovement.toFixed(2)}% 改善`);
      
      // テスト結果をファイルに出力
      const resultPath = path.join(__dirname, '..', '..', 'temp_results', 'scopeManager_performance_results.json');
      fs.mkdirSync(path.dirname(resultPath), { recursive: true });
      fs.writeFileSync(resultPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        projectSwitch: projectSwitchResults,
        fileRead: fileReadResults,
        directoryStructure: directoryStructureResults
      }, null, 2));
      
      console.log(`テスト結果を ${resultPath} に保存しました`);
    } finally {
      await this.teardown();
    }
  }
}

// テストを実行
if (require.main === module) {
  const test = new ScopeManagerPerformanceTest();
  test.runAllTests().catch(error => {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { ScopeManagerPerformanceTest };