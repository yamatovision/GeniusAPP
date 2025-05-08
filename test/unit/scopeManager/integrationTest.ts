import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

// VSCodeモック
import { mockVscode } from '../../mocks/vscode.mock';

// 新実装（リファクタリング済み）
import { FileSystemServiceImpl } from '../../../src/ui/scopeManager/services/implementations/FileSystemServiceImpl';
import { ProjectServiceImpl } from '../../../src/ui/scopeManager/services/implementations/ProjectServiceImpl';
import { TabStateServiceImpl } from '../../../src/ui/scopeManager/services/implementations/TabStateServiceImpl';
import { PanelServiceImpl } from '../../../src/ui/scopeManager/services/implementations/PanelServiceImpl';
import { MessageDispatchServiceImpl } from '../../../src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl';

import { EventBus } from '../../../src/services/EventBus';

/**
 * ScopeManagerサービス統合テスト
 */
class ScopeManagerIntegrationTest {
  private testProjectPath: string;
  private mockWebviewPanel: vscode.WebviewPanel;
  private mockExtensionUri: vscode.Uri;
  private mockExtensionContext: vscode.ExtensionContext;
  private sentMessages: any[] = [];
  private receivedEvents: any[] = [];
  
  // サービスインスタンス
  private fileSystemService: FileSystemServiceImpl;
  private projectService: ProjectServiceImpl;
  private tabStateService: TabStateServiceImpl;
  private panelService: PanelServiceImpl;
  private messageService: MessageDispatchServiceImpl;
  private eventBus: EventBus;
  
  constructor() {
    // テスト用プロジェクトパスの設定
    this.testProjectPath = path.join(__dirname, '..', '..', '..', 'test_projects', 'integration_test_project');
    
    // モックの設定
    this.setupMocks();
    
    // サービスを初期化
    this.initializeServices();
    
    // イベントリスナーを設定
    this.setupEventListeners();
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
   * サービスの初期化
   */
  private initializeServices() {
    this.eventBus = EventBus.getInstance();
    
    this.fileSystemService = FileSystemServiceImpl.getInstance();
    this.projectService = ProjectServiceImpl.getInstance(this.fileSystemService);
    this.tabStateService = TabStateServiceImpl.getInstance(this.projectService, this.fileSystemService);
    this.panelService = PanelServiceImpl.getInstance(this.mockExtensionUri, this.mockExtensionContext);
    this.messageService = MessageDispatchServiceImpl.getInstance();
    
    // 依存関係を設定
    this.panelService.setProjectService(this.projectService);
    this.panelService.setFileSystemService(this.fileSystemService);
    this.panelService.setTabStateService(this.tabStateService);
    
    this.messageService.setDependencies({
      projectService: this.projectService,
      fileSystemService: this.fileSystemService,
      panelService: this.panelService
    });
  }
  
  /**
   * イベントリスナーの設定
   */
  private setupEventListeners() {
    // イベントバスからのイベントを記録
    this.eventBus.on('tab-changed', (data) => {
      this.receivedEvents.push({ event: 'tab-changed', data });
    });
    
    this.eventBus.on('message-sent', (data) => {
      this.receivedEvents.push({ event: 'message-sent', data });
    });
    
    this.eventBus.on('message-processed', (data) => {
      this.receivedEvents.push({ event: 'message-processed', data });
    });
    
    this.eventBus.on('directory-structure-updated', (data) => {
      this.receivedEvents.push({ event: 'directory-structure-updated', data });
    });
  }
  
  /**
   * メッセージとイベントをクリア
   */
  private clearMessagesAndEvents() {
    this.sentMessages = [];
    this.receivedEvents = [];
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
    fs.writeFileSync(progressFilePath, '# 統合テストプロジェクト\n\nこれは統合テスト用プロジェクトの進捗ファイルです。\n\n## 現在の進捗\n\n- [x] テスト環境のセットアップ\n- [ ] リファクタリングの実施\n- [ ] 統合テストの実行\n');
    
    // テスト用のrequirements.mdファイルを作成
    const requirementsFilePath = path.join(docsPath, 'requirements.md');
    fs.writeFileSync(requirementsFilePath, '# 要件定義\n\nこれは統合テスト用プロジェクトの要件定義ファイルです。\n\n## 主要機能\n\n- 効率的なプロジェクト切り替え\n- 状態の一元管理\n- メッセージングの最適化\n');
  }
  
  /**
   * テスト完了後のクリーンアップ
   */
  async teardown() {
    // イベントバスをクリア
    this.eventBus.dispose();
    
    // サービスをクリーンアップ
    this.panelService.dispose();
    this.messageService.dispose();
  }
  
  /**
   * プロジェクト選択の統合テスト
   */
  async testProjectSelection() {
    console.log('========== プロジェクト選択の統合テスト ==========');
    
    this.clearMessagesAndEvents();
    
    const projectName = '統合テストプロジェクト';
    const projectPath = this.testProjectPath;
    
    // プロジェクト選択を実行
    await this.messageService.selectProject(this.mockWebviewPanel, projectName, projectPath);
    
    // アクティブプロジェクトの確認
    const activeProject = this.projectService.getActiveProject();
    assert.strictEqual(activeProject?.name, projectName, 'アクティブプロジェクト名が一致すべき');
    assert.strictEqual(activeProject?.path, projectPath, 'アクティブプロジェクトパスが一致すべき');
    
    // 送信されたメッセージの確認
    console.log(`送信されたメッセージ数: ${this.sentMessages.length}`);
    assert.ok(this.sentMessages.length > 0, 'メッセージが送信されるべき');
    
    // syncFullProjectStateメッセージがあるか確認
    const syncMessage = this.sentMessages.find(m => m.command === 'syncFullProjectState');
    if (syncMessage) {
      console.log('syncFullProjectStateメッセージを検出（最適化済み実装）');
      assert.ok(syncMessage.state, 'メッセージには状態が含まれるべき');
      assert.ok(syncMessage.state.activeProject, 'アクティブプロジェクト情報が含まれるべき');
      assert.ok(syncMessage.state.progressContent, '進捗ファイル内容が含まれるべき');
    } else {
      // 従来実装の場合、複数のメッセージが送信される
      console.log('個別のメッセージを検出（従来の実装）');
      
      // 少なくともプロジェクト状態同期メッセージがあるか確認
      const projectStateMessage = this.sentMessages.find(m => m.command === 'syncProjectState');
      assert.ok(projectStateMessage, 'プロジェクト状態同期メッセージがあるべき');
      
      // マークダウン内容更新メッセージもあるか確認
      const markdownMessage = this.sentMessages.find(m => m.command === 'updateMarkdownContent');
      assert.ok(markdownMessage, 'マークダウン内容更新メッセージがあるべき');
    }
    
    // イベントの確認
    console.log(`発行されたイベント数: ${this.receivedEvents.length}`);
    assert.ok(this.receivedEvents.length > 0, 'イベントが発行されるべき');
    
    console.log('プロジェクト選択の統合テストに成功しました');
    return true;
  }
  
  /**
   * タブ選択の統合テスト
   */
  async testTabSelection() {
    console.log('========== タブ選択の統合テスト ==========');
    
    this.clearMessagesAndEvents();
    
    // まずプロジェクトを選択しておく
    const projectName = '統合テストプロジェクト';
    const projectPath = this.testProjectPath;
    await this.messageService.selectProject(this.mockWebviewPanel, projectName, projectPath);
    
    this.clearMessagesAndEvents();
    
    // タブ選択を実行
    const tabId = 'requirements';
    await this.tabStateService.selectTab(tabId);
    
    // 送信されたメッセージの確認
    console.log(`送信されたメッセージ数: ${this.sentMessages.length}`);
    
    // selectTabメッセージがあるか確認
    const tabMessage = this.sentMessages.find(m => m.command === 'selectTab');
    assert.ok(tabMessage, 'タブ選択メッセージがあるべき');
    assert.strictEqual(tabMessage.tabId, tabId, 'タブIDが一致すべき');
    
    // イベントの確認
    console.log(`発行されたイベント数: ${this.receivedEvents.length}`);
    
    // tab-changedイベントがあるか確認
    const tabChangedEvent = this.receivedEvents.find(e => e.event === 'tab-changed');
    assert.ok(tabChangedEvent, 'タブ変更イベントがあるべき');
    
    console.log('タブ選択の統合テストに成功しました');
    return true;
  }
  
  /**
   * メッセージハンドリングの統合テスト
   */
  async testMessageHandling() {
    console.log('========== メッセージハンドリングの統合テスト ==========');
    
    this.clearMessagesAndEvents();
    
    // メッセージハンドラーを登録
    this.messageService.registerHandler('testCommand', async (message, panel) => {
      this.messageService.showSuccess(panel, 'テストコマンドが実行されました');
      return Promise.resolve();
    });
    
    // メッセージを処理
    const testMessage = { command: 'testCommand', data: 'testData' };
    await this.messageService.handleMessage(testMessage, this.mockWebviewPanel);
    
    // 送信されたメッセージの確認
    console.log(`送信されたメッセージ数: ${this.sentMessages.length}`);
    assert.ok(this.sentMessages.length > 0, 'メッセージが送信されるべき');
    
    // showSuccessメッセージがあるか確認
    const successMessage = this.sentMessages.find(m => m.command === 'showSuccess');
    assert.ok(successMessage, '成功メッセージがあるべき');
    
    // イベントの確認
    console.log(`発行されたイベント数: ${this.receivedEvents.length}`);
    
    // message-processedイベントがあるか確認
    const messageProcessedEvent = this.receivedEvents.find(e => e.event === 'message-processed');
    assert.ok(messageProcessedEvent, 'メッセージ処理イベントがあるべき');
    
    console.log('メッセージハンドリングの統合テストに成功しました');
    return true;
  }
  
  /**
   * ファイル読み込みの統合テスト
   */
  async testFileReading() {
    console.log('========== ファイル読み込みの統合テスト ==========');
    
    this.clearMessagesAndEvents();
    
    // ファイルパスを設定
    const progressFilePath = path.join(this.testProjectPath, 'docs', 'SCOPE_PROGRESS.md');
    
    // ファイル読み込みを実行
    const content = await this.fileSystemService.readMarkdownFile(progressFilePath);
    
    // コンテンツの確認
    assert.ok(content.includes('統合テストプロジェクト'), 'ファイル内容が正しく取得されるべき');
    
    console.log('ファイル読み込みの統合テストに成功しました');
    return true;
  }
  
  /**
   * すべての統合テストを実行
   */
  async runAllTests() {
    try {
      await this.setup();
      
      // 各テストを実行
      const projectSelectionResult = await this.testProjectSelection();
      const tabSelectionResult = await this.testTabSelection();
      const messageHandlingResult = await this.testMessageHandling();
      const fileReadingResult = await this.testFileReading();
      
      // 総合結果をコンソールに出力
      console.log('\n========== 総合テスト結果 ==========');
      console.log(`プロジェクト選択テスト: ${projectSelectionResult ? '成功' : '失敗'}`);
      console.log(`タブ選択テスト: ${tabSelectionResult ? '成功' : '失敗'}`);
      console.log(`メッセージハンドリングテスト: ${messageHandlingResult ? '成功' : '失敗'}`);
      console.log(`ファイル読み込みテスト: ${fileReadingResult ? '成功' : '失敗'}`);
      
      // テスト結果をファイルに出力
      const resultPath = path.join(__dirname, '..', '..', 'temp_results', 'scopeManager_integration_results.json');
      fs.mkdirSync(path.dirname(resultPath), { recursive: true });
      fs.writeFileSync(resultPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        projectSelection: projectSelectionResult,
        tabSelection: tabSelectionResult,
        messageHandling: messageHandlingResult,
        fileReading: fileReadingResult,
        allPassed: 
          projectSelectionResult && 
          tabSelectionResult && 
          messageHandlingResult && 
          fileReadingResult
      }, null, 2));
      
      console.log(`テスト結果を ${resultPath} に保存しました`);
      
      return projectSelectionResult && 
             tabSelectionResult && 
             messageHandlingResult && 
             fileReadingResult;
    } finally {
      await this.teardown();
    }
  }
}

// テストを実行
if (require.main === module) {
  const test = new ScopeManagerIntegrationTest();
  test.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { ScopeManagerIntegrationTest };