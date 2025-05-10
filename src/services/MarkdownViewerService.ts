import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { MarkdownStorageService, MarkdownDocument } from './markdownStorageService';
import { ProjectServiceImpl } from '../ui/scopeManager/services/implementations/ProjectServiceImpl';
import { AppGeniusEventBus, AppGeniusEventType } from './AppGeniusEventBus';

/**
 * マークダウンビューアサービス
 * マークダウンファイルの表示と管理を行う中央サービス
 */
export class MarkdownViewerService {
  private static _instance: MarkdownViewerService;
  private _storage: MarkdownStorageService;
  private _eventBus: AppGeniusEventBus;
  private _disposables: vscode.Disposable[] = [];
  private _activePanel: vscode.WebviewPanel | undefined;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MarkdownViewerService {
    if (!MarkdownViewerService._instance) {
      MarkdownViewerService._instance = new MarkdownViewerService();
    }
    return MarkdownViewerService._instance;
  }
  
  /**
   * コンストラクタ
   */
  private constructor() {
    this._storage = MarkdownStorageService.getInstance();
    this._eventBus = AppGeniusEventBus.getInstance();
    
    // イベントリスナーを設定
    this._setupEventListeners();
    
    Logger.info('MarkdownViewerService: 初期化完了');
  }
  
  /**
   * イベントリスナーの設定
   */
  private _setupEventListeners(): void {
    // プロジェクト変更イベントをリッスン
    this._eventBus.onEvent((event) => {
      if (event.type === AppGeniusEventType.ProjectChanged) {
        // プロジェクトが変更されたらマークダウンストレージを初期化
        this._initializeStorageForCurrentProject();
      }
    });
    
    Logger.debug('MarkdownViewerService: イベントリスナーを設定しました');
  }
  
  /**
   * 現在のプロジェクトに対してマークダウンストレージを初期化
   */
  private _initializeStorageForCurrentProject(): void {
    try {
      const projectService = ProjectServiceImpl.getInstance();
      const projectPath = projectService.getActiveProjectPath();
      
      if (projectPath) {
        this._storage.initializeWithPath(projectPath);
        Logger.info(`MarkdownViewerService: ストレージをプロジェクトパス ${projectPath} で初期化しました`);
      } else {
        Logger.warn('MarkdownViewerService: アクティブなプロジェクトパスが取得できません');
      }
    } catch (error) {
      Logger.error('MarkdownViewerService: ストレージ初期化エラー', error as Error);
    }
  }
  
  /**
   * マークダウンビューアを開く
   * @param filePath マークダウンファイルのパス
   * @param extensionUri 拡張機能のURI
   */
  public async openMarkdownViewer(filePath: string, extensionUri: vscode.Uri): Promise<void> {
    try {
      // ファイルパスの正規化（重複スラッシュを除去）
      filePath = filePath.replace(/\/+/g, '/');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        Logger.error(`MarkdownViewerService: ファイルが存在しません: ${filePath}`);
        throw new Error(`指定されたファイルが存在しません: ${filePath}`);
      }
      
      // マークダウンファイルかどうか確認
      if (!filePath.toLowerCase().endsWith('.md')) {
        Logger.warn(`MarkdownViewerService: ファイルがマークダウン形式ではありません: ${filePath}`);
      }
      
      Logger.info(`MarkdownViewerService: マークダウンビューアを開きます: ${filePath}`);
      
      // プロジェクトパスを取得してストレージを初期化
      this._initializeStorageForCurrentProject();
      
      // MarkdownViewerPanelを作成または表示
      const viewPanel = await this._createOrShowWebViewPanel(extensionUri, filePath);
      
      Logger.info(`MarkdownViewerService: マークダウンビューアを表示しました: ${filePath}`);
      return viewPanel;
    } catch (error) {
      Logger.error(`MarkdownViewerService: マークダウンビューアを開くエラー: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * WebViewパネルを作成または表示する
   * @param extensionUri 拡張機能のURI
   * @param filePath マークダウンファイルのパス
   */
  private async _createOrShowWebViewPanel(extensionUri: vscode.Uri, filePath?: string): Promise<vscode.WebviewPanel> {
    // vscode.commands.executeCommandを使用してMarkdownViewerPanelを作成
    // これにより、既存のパネルがあればそれを再利用し、なければ新しく作成する
    await vscode.commands.executeCommand('appgenius.openMarkdownViewer', filePath);
    
    return this._activePanel as vscode.WebviewPanel;
  }
  
  /**
   * アクティブなWebViewパネルを設定
   * @param panel WebViewパネル
   */
  public setActivePanel(panel: vscode.WebviewPanel): void {
    this._activePanel = panel;
  }
  
  /**
   * マークダウンファイルを読み込む
   * @param filePath マークダウンファイルのパス
   * @returns マークダウンドキュメント
   */
  public async loadMarkdownFile(filePath: string): Promise<MarkdownDocument | null> {
    try {
      // ストレージが初期化されているか確認
      if (!this._storage.isInitialized()) {
        this._initializeStorageForCurrentProject();
      }
      
      // ファイルパスからドキュメントを取得または作成
      const document = await this._storage.getDocumentByFilePath(filePath);
      if (!document) {
        Logger.error(`MarkdownViewerService: ドキュメントの取得に失敗: ${filePath}`);
        return null;
      }
      
      Logger.debug(`MarkdownViewerService: ドキュメントを読み込みました: ${document.name}`);
      return document;
    } catch (error) {
      Logger.error(`MarkdownViewerService: マークダウンファイル読み込みエラー: ${filePath}`, error as Error);
      return null;
    }
  }
  
  /**
   * マークダウンファイル一覧を取得
   * @returns マークダウンドキュメントの配列
   */
  public async getAllMarkdownFiles(): Promise<MarkdownDocument[]> {
    try {
      // ストレージが初期化されているか確認
      if (!this._storage.isInitialized()) {
        this._initializeStorageForCurrentProject();
      }
      
      // ストレージからドキュメント一覧を取得
      await this._storage.loadMarkdownFiles();
      const documents = this._storage.getAllDocuments();
      
      Logger.debug(`MarkdownViewerService: ${documents.length}個のマークダウンドキュメントを取得しました`);
      return documents;
    } catch (error) {
      Logger.error('MarkdownViewerService: マークダウンファイル一覧取得エラー', error as Error);
      return [];
    }
  }
  
  /**
   * マークダウンファイルをエディタで開く
   * @param documentId ドキュメントID
   */
  public async openInEditor(documentId: string): Promise<void> {
    try {
      // ストレージからドキュメントを取得
      const document = this._storage.getDocument(documentId);
      if (!document) {
        throw new Error(`ドキュメントが見つかりません: ${documentId}`);
      }
      
      // VSCodeエディタでファイルを開く
      const textDocument = await vscode.workspace.openTextDocument(document.filePath);
      await vscode.window.showTextDocument(textDocument);
      
      Logger.info(`MarkdownViewerService: エディタでファイルを開きました: ${document.filePath}`);
    } catch (error) {
      Logger.error(`MarkdownViewerService: エディタでファイルを開くエラー: ${documentId}`, error as Error);
      throw error;
    }
  }
  
  /**
   * マークダウンファイルをブラウザで開く
   * @param documentId ドキュメントID
   */
  public async openInBrowser(documentId: string): Promise<void> {
    try {
      // ストレージからドキュメントを取得
      const document = this._storage.getDocument(documentId);
      if (!document) {
        throw new Error(`ドキュメントが見つかりません: ${documentId}`);
      }
      
      // ブラウザでファイルを開く
      await vscode.env.openExternal(vscode.Uri.file(document.filePath));
      
      Logger.info(`MarkdownViewerService: ブラウザでファイルを開きました: ${document.filePath}`);
    } catch (error) {
      Logger.error(`MarkdownViewerService: ブラウザでファイルを開くエラー: ${documentId}`, error as Error);
      throw error;
    }
  }
  
  /**
   * マークダウンファイルをファイルシステム上で選択する
   * @returns 選択されたファイルパス
   */
  public async selectMarkdownFile(): Promise<string | undefined> {
    try {
      // ファイル選択ダイアログを表示
      const fileUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'Markdown Files': ['md']
        },
        title: '表示するマークダウンファイルを選択'
      });
      
      if (!fileUris || fileUris.length === 0) {
        return undefined;
      }
      
      const filePath = fileUris[0].fsPath;
      Logger.info(`MarkdownViewerService: マークダウンファイルが選択されました: ${filePath}`);
      
      return filePath;
    } catch (error) {
      Logger.error('MarkdownViewerService: ファイル選択エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * ファイル変更通知をWebViewに送信
   * @param document 更新されたドキュメント
   */
  public notifyDocumentUpdate(document: MarkdownDocument): void {
    if (this._activePanel) {
      this._activePanel.webview.postMessage({
        command: 'documentUpdated',
        document: document
      });
      
      Logger.debug(`MarkdownViewerService: ドキュメント更新通知を送信: ${document.name}`);
    }
  }
  
  /**
   * ドキュメント一覧をWebViewに送信
   * @param documents ドキュメント一覧
   */
  public updateDocumentList(documents: MarkdownDocument[]): void {
    if (this._activePanel) {
      this._activePanel.webview.postMessage({
        command: 'updateDocuments',
        documents: documents
      });
      
      Logger.debug(`MarkdownViewerService: ドキュメント一覧を更新: ${documents.length}件`);
    }
  }
  
  /**
   * リソース解放
   */
  public dispose(): void {
    // Disposableなリソースを解放
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    // アクティブなパネルの参照をクリア
    this._activePanel = undefined;
    
    Logger.info('MarkdownViewerService: リソースを解放しました');
  }
}