import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

/**
 * モックアップデータの型定義
 */
export interface Mockup {
  id: string;
  name: string;
  html: string;
  css?: string;
  js?: string;
  createdAt: number;
  updatedAt: number;
  sourceType: 'requirements' | 'manual' | 'imported';
  description?: string;
  // 以下を追加
  status?: 'pending' | 'generating' | 'review' | 'approved';
  feedback?: string[];
  implementationNotes?: string;
}

/**
 * モックアップの保存と取得を管理する共通ストレージサービス
 */
export class MockupStorageService {
  private static instance: MockupStorageService;
  private mockups: Map<string, Mockup> = new Map();
  private storageDir: string = '';
  private _initialized: boolean = false;
  // 最後に初期化されたパスを追跡
  private _lastInitializedPath: string = '';
  
  /**
   * モックアップを名前で検索
   */
  public getMockupByName(name: string): Mockup | undefined {
    return Array.from(this.mockups.values()).find(mockup => 
      mockup.name === name || mockup.name === name.replace(/\.html$/, '')
    );
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MockupStorageService {
    if (!MockupStorageService.instance) {
      MockupStorageService.instance = new MockupStorageService();
    }
    return MockupStorageService.instance;
  }

  /**
   * コンストラクタ
   */
  private constructor() {
    // 初期化は外部から明示的に行うため、コンストラクタでは初期化しない
    Logger.debug('MockupStorageService: インスタンス作成 (未初期化)');
  }
  
  /**
   * 初期化状態を確認
   * @returns 初期化済みかどうか
   */
  public isInitialized(): boolean {
    return this._initialized;
  }
  
  /**
   * 現在のストレージパスを取得
   * @returns 初期化されたストレージパス
   */
  public getStoragePath(): string {
    return this.storageDir;
  }

  /**
   * 指定されたプロジェクトパスでストレージを初期化
   * @param projectPath プロジェクトのパス
   */
  public initializeWithPath(projectPath: string): void {
    // 同じパスで初期化済みの場合はスキップ
    if (this._lastInitializedPath === projectPath) {
      Logger.debug(`MockupStorageService: 既に同じパスで初期化済み: ${projectPath}`);
      return;
    }
    
    // プロジェクトディレクトリ内の'mockups'ディレクトリを使用
    this.storageDir = path.join(projectPath, 'mockups');

    // ディレクトリの作成
    this.ensureDirectoryExists(this.storageDir);
    
    // 既存のモックアップをロード
    this.loadMockups();
    
    this._initialized = true;
    this._lastInitializedPath = projectPath;
    Logger.info(`MockupStorageService initialized with path: ${this.storageDir}`);
  }

  /**
   * モックアップの保存
   * @param content モックアップのコンテンツ
   * @param options 保存オプション
   * @returns 保存されたモックアップのID
   */
  public async saveMockup(
    content: { 
      html: string,
      css?: string,
      js?: string 
    }, 
    options: {
      id?: string,
      name?: string,
      sourceType?: 'requirements' | 'manual' | 'imported',
      description?: string
    } = {}
  ): Promise<string> {
    try {
      // モックアップIDの生成
      const id = options.id || `mockup_${Date.now()}`;
      const mockupDir = path.join(this.storageDir, id);
      
      // ディレクトリの作成
      this.ensureDirectoryExists(mockupDir);
      
      // HTMLファイルの保存
      const htmlPath = path.join(mockupDir, 'index.html');
      await fs.promises.writeFile(htmlPath, content.html, 'utf8');
      
      // CSSファイルの保存（存在する場合）
      let cssPath: string | undefined;
      if (content.css) {
        cssPath = path.join(mockupDir, 'style.css');
        await fs.promises.writeFile(cssPath, content.css, 'utf8');
      }
      
      // JSファイルの保存（存在する場合）
      let jsPath: string | undefined;
      if (content.js) {
        jsPath = path.join(mockupDir, 'script.js');
        await fs.promises.writeFile(jsPath, content.js, 'utf8');
      }
      
      // 現在時刻を取得
      const now = Date.now();
      
      // モックアップメタデータを作成
      const mockup: Mockup = {
        id,
        name: options.name || `Mockup ${new Date(now).toLocaleString()}`,
        html: content.html,
        css: content.css,
        js: content.js,
        createdAt: now,
        updatedAt: now,
        sourceType: options.sourceType || 'manual',
        description: options.description
      };
      
      // メモリ上のマップに保存
      this.mockups.set(id, mockup);
      
      Logger.info(`Mockup saved: ${id}`);
      
      return id;
    } catch (error) {
      Logger.error(`Failed to save mockup: ${(error as Error).message}`);
      throw new Error(`モックアップの保存に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップの更新
   * @param id モックアップID
   * @param content 更新するコンテンツ
   * @returns 更新されたモックアップ
   */
  public async updateMockup(
    id: string, 
    content: { 
      html?: string,
      css?: string,
      js?: string,
      name?: string,
      description?: string
    }
  ): Promise<Mockup | undefined> {
    try {
      // 既存のモックアップを取得
      const mockup = this.mockups.get(id);
      if (!mockup) {
        Logger.warn(`Mockup not found: ${id}`);
        return undefined;
      }
      
      // モックアップディレクトリのパス
      const mockupDir = path.join(this.storageDir, id);
      
      // HTMLの更新
      if (content.html) {
        mockup.html = content.html;
        const htmlPath = path.join(mockupDir, 'index.html');
        await fs.promises.writeFile(htmlPath, content.html, 'utf8');
      }
      
      // CSSの更新
      if (content.css) {
        mockup.css = content.css;
        const cssPath = path.join(mockupDir, 'style.css');
        await fs.promises.writeFile(cssPath, content.css, 'utf8');
      }
      
      // JSの更新
      if (content.js) {
        mockup.js = content.js;
        const jsPath = path.join(mockupDir, 'script.js');
        await fs.promises.writeFile(jsPath, content.js, 'utf8');
      }
      
      // 名前の更新
      if (content.name) {
        mockup.name = content.name;
      }
      
      // 説明の更新
      if (content.description) {
        mockup.description = content.description;
      }
      
      // 更新日時を設定
      mockup.updatedAt = Date.now();
      
      Logger.info(`Mockup updated: ${id}`);
      
      return mockup;
    } catch (error) {
      Logger.error(`Failed to update mockup: ${(error as Error).message}`);
      throw new Error(`モックアップの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップの取得
   * @param id モックアップID
   * @returns モックアップデータ
   */
  public getMockup(id: string): Mockup | undefined {
    return this.mockups.get(id);
  }

  /**
   * 全てのモックアップを取得
   * @returns モックアップの配列
   */
  public getAllMockups(): Mockup[] {
    return Array.from(this.mockups.values())
      .sort((a, b) => b.updatedAt - a.updatedAt); // 更新日時でソート
  }

  /**
   * 指定したソースタイプのモックアップを取得
   * @param sourceType ソースタイプ
   * @returns モックアップの配列
   */
  public getMockupsBySourceType(sourceType: 'requirements' | 'manual' | 'imported'): Mockup[] {
    return Array.from(this.mockups.values())
      .filter(mockup => mockup.sourceType === sourceType)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * モックアップの削除
   * @param id モックアップID
   * @returns 削除が成功したかどうか
   */
  public async deleteMockup(id: string): Promise<boolean> {
    try {
      // 存在確認
      if (!this.mockups.has(id)) {
        return false;
      }
      
      // メモリから削除
      this.mockups.delete(id);
      
      // ディレクトリのパス
      const mockupDir = path.join(this.storageDir, id);
      
      // ディレクトリが存在する場合は削除
      if (fs.existsSync(mockupDir)) {
        await this.deleteDirectory(mockupDir);
      }
      
      Logger.info(`Mockup deleted: ${id}`);
      
      return true;
    } catch (error) {
      Logger.error(`Failed to delete mockup: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * モックアップのディスクからのロード
   */
  private async loadMockups(): Promise<void> {
    try {
      this.mockups.clear(); // 既存のモックアップをクリア
      
      // ディレクトリ内のモックアップをロード
      if (fs.existsSync(this.storageDir)) {
        // 1. まずstructured mockupをロード (mockup_ディレクトリ)
        const directories = fs.readdirSync(this.storageDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('mockup_'))
          .map(dirent => dirent.name);
        
        for (const dir of directories) {
          const mockupDir = path.join(this.storageDir, dir);
          const htmlPath = path.join(mockupDir, 'index.html');
          const cssPath = path.join(mockupDir, 'style.css');
          const jsPath = path.join(mockupDir, 'script.js');
          
          // HTMLファイルが存在するか確認
          if (fs.existsSync(htmlPath)) {
            const html = await fs.promises.readFile(htmlPath, 'utf8');
            
            // CSSファイルの読み込み
            let css: string | undefined;
            if (fs.existsSync(cssPath)) {
              css = await fs.promises.readFile(cssPath, 'utf8');
            }
            
            // JSファイルの読み込み
            let js: string | undefined;
            if (fs.existsSync(jsPath)) {
              js = await fs.promises.readFile(jsPath, 'utf8');
            }
            
            // ディレクトリの作成日時を取得
            const stats = fs.statSync(mockupDir);
            const createdAt = stats.birthtimeMs;
            const updatedAt = stats.mtimeMs;
            
            // モックアップオブジェクトを作成
            const mockup: Mockup = {
              id: dir,
              name: `Mockup ${new Date(createdAt).toLocaleString()}`,
              html,
              css,
              js,
              createdAt,
              updatedAt,
              sourceType: 'imported', // ディレクトリから復元されたものはインポートとして扱う
              status: 'review'        // デフォルトのステータス
            };
            
            // マップに追加
            this.mockups.set(dir, mockup);
          }
        }
        
        // 2. 次にルートディレクトリのHTMLファイルをインポート
        const htmlFiles = fs.readdirSync(this.storageDir, { withFileTypes: true })
          .filter(dirent => dirent.isFile() && (dirent.name.endsWith('.html') || dirent.name.endsWith('.htm')))
          .filter(dirent => dirent.name !== 'metadata.json') // metadata.jsonを除外
          .map(dirent => dirent.name);
        
        for (const htmlFile of htmlFiles) {
          const htmlPath = path.join(this.storageDir, htmlFile);
          const fileNameWithoutExt = htmlFile.replace(/\.[^/.]+$/, ''); // 拡張子を削除
          
          // ファイル名自体をモックアップIDとして使用
          const mockupId = fileNameWithoutExt;
          
          // HTMLの内容を読み込む
          const html = await fs.promises.readFile(htmlPath, 'utf8');
          
          // ファイルの状態を取得
          const stats = fs.statSync(htmlPath);
          const createdAt = stats.birthtimeMs;
          const updatedAt = stats.mtimeMs;
          
          // モックアップオブジェクトを作成
          const mockup: Mockup = {
            id: mockupId,
            name: fileNameWithoutExt,
            html,
            createdAt,
            updatedAt,
            sourceType: 'imported',
            description: `File: ${htmlPath}`,
            status: 'review'        // デフォルトのステータス
          };
          
          // マップに追加
          this.mockups.set(mockupId, mockup);
          Logger.info(`Imported HTML file: ${htmlFile}`);
        }
        
        Logger.info(`Loaded ${this.mockups.size} mockups from directory structure`);
      }
    } catch (error) {
      Logger.error(`Failed to load mockups: ${(error as Error).message}`);
    }
  }
  
  /**
   * モックアップのステータスを更新
   * @param id モックアップID
   * @param status 新しいステータス
   * @returns 更新されたモックアップ、失敗時はundefined
   */
  public async updateMockupStatus(id: string, status: string): Promise<Mockup | undefined> {
    try {
      // モックアップの取得
      const mockup = this.mockups.get(id);
      if (!mockup) {
        Logger.warn(`Mockup not found for status update: ${id}`);
        return undefined;
      }
      
      // ステータスを更新
      mockup.status = status as 'pending' | 'generating' | 'review' | 'approved';
      mockup.updatedAt = Date.now();
      
      Logger.info(`Mockup status updated: ${id} -> ${status}`);
      
      return mockup;
    } catch (error) {
      Logger.error(`Failed to update mockup status: ${(error as Error).message}`);
      return undefined;
    }
  }
  
  /**
   * フィードバックを追加
   * @param id モックアップID
   * @param feedback フィードバックテキスト
   * @returns 更新されたモックアップ、失敗時はundefined
   */
  public async addFeedback(id: string, feedback: string): Promise<Mockup | undefined> {
    try {
      // モックアップの取得
      const mockup = this.mockups.get(id);
      if (!mockup) {
        Logger.warn(`Mockup not found for adding feedback: ${id}`);
        return undefined;
      }
      
      // フィードバック配列の初期化
      if (!mockup.feedback) {
        mockup.feedback = [];
      }
      
      // フィードバックを追加
      mockup.feedback.push(feedback);
      mockup.updatedAt = Date.now();
      
      Logger.info(`Feedback added to mockup: ${id}`);
      
      return mockup;
    } catch (error) {
      Logger.error(`Failed to add feedback: ${(error as Error).message}`);
      return undefined;
    }
  }
  
  /**
   * 実装メモを保存
   * @param id モックアップID
   * @param notes 実装メモテキスト
   * @returns 更新されたモックアップ、失敗時はundefined
   */
  public async saveImplementationNotes(id: string, notes: string): Promise<Mockup | undefined> {
    try {
      // モックアップの取得
      const mockup = this.mockups.get(id);
      if (!mockup) {
        Logger.warn(`Mockup not found for saving implementation notes: ${id}`);
        return undefined;
      }
      
      // 実装メモを保存
      mockup.implementationNotes = notes;
      mockup.updatedAt = Date.now();
      
      Logger.info(`Implementation notes saved for mockup: ${id}`);
      
      return mockup;
    } catch (error) {
      Logger.error(`Failed to save implementation notes: ${(error as Error).message}`);
      return undefined;
    }
  }
  
  /**
   * キューの状態を取得
   * @returns キュー状態オブジェクト
   */
  public getQueueStatus(): {pending: number, generating: number, completed: number, total: number} {
    const mockupList = Array.from(this.mockups.values());
    
    const pending = mockupList.filter(m => m.status === 'pending').length;
    const generating = mockupList.filter(m => m.status === 'generating').length;
    const completed = mockupList.filter(m => m.status && ['review', 'approved'].includes(m.status)).length;
    const total = mockupList.length;
    
    return { pending, generating, completed, total };
  }
  
  /**
   * ファイルパスからモックアップを取得または作成
   * @param filePath HTMLファイルパス
   * @returns モックアップオブジェクト
   */
  public async getMockupByFilePath(filePath: string): Promise<Mockup | null> {
    try {
      // 既に同じファイルパスに関連するモックアップが存在するか確認
      const existingMockup = Array.from(this.mockups.values()).find(
        mockup => mockup.description === `File: ${filePath}`
      );
      
      if (existingMockup) {
        return existingMockup;
      }
      
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        Logger.error(`File not found: ${filePath}`);
        return null;
      }
      
      // ファイル名から情報を抽出
      const fileName = path.basename(filePath);
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // 拡張子を削除
      
      // HTMLの内容を読み込む
      const html = await fs.promises.readFile(filePath, 'utf8');
      
      // ファイルの状態を取得
      const stats = fs.statSync(filePath);
      const createdAt = stats.birthtimeMs;
      const updatedAt = stats.mtimeMs;
      
      // ファイル名自体をIDとして使用
      const mockupId = fileNameWithoutExt;
      
      // モックアップオブジェクトを作成
      const mockup: Mockup = {
        id: mockupId,
        name: fileNameWithoutExt,
        html,
        createdAt,
        updatedAt,
        sourceType: 'imported',
        description: `File: ${filePath}`,
        status: 'review'
      };
      
      // マップに追加
      this.mockups.set(mockupId, mockup);
      
      Logger.info(`Created mockup from file: ${filePath}`);
      return mockup;
    } catch (error) {
      Logger.error(`Failed to get mockup by file path: ${(error as Error).message}`);
      return null;
    }
  }
  
  /**
   * ファイルパスから直接モックアップを読み込んで表示
   * @param filePath HTMLファイルパス
   * @returns HTMLコンテンツ
   */
  public async getHTMLContentFromFile(filePath: string): Promise<string | null> {
    try {
      if (!fs.existsSync(filePath)) {
        Logger.error(`File not found: ${filePath}`);
        return null;
      }
      
      const html = await fs.promises.readFile(filePath, 'utf8');
      return html;
    } catch (error) {
      Logger.error(`Failed to read file: ${(error as Error).message}`);
      return null;
    }
  }


  /**
   * ディレクトリが存在することを確認し、なければ作成
   * @param dir ディレクトリパス
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * ディレクトリを再帰的に削除
   * @param dir ディレクトリパス
   */
  private async deleteDirectory(dir: string): Promise<void> {
    // Node.js v14.14.0以降であれば fs.promises.rm を使用できる
    if (fs.promises.rm) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } else {
      // 古いバージョンのNode.jsの場合は再帰的に削除
      const files = await fs.promises.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.promises.lstat(filePath);
        
        if (stat.isDirectory()) {
          await this.deleteDirectory(filePath);
        } else {
          await fs.promises.unlink(filePath);
        }
      }
      
      await fs.promises.rmdir(dir);
    }
  }
  
  /**
   * モックアップを再読み込み（ファイル変更検出時に使用）
   */
  public async reloadMockups(): Promise<void> {
    try {
      if (!this._initialized || !this.storageDir) {
        Logger.warn('モックアップストレージが初期化されていません');
        return;
      }
      
      // 既存のモックアップを再読み込み
      await this.loadMockups();
      
      Logger.debug('モックアップを再読み込みしました');
    } catch (error) {
      Logger.error(`モックアップの再読み込みに失敗: ${(error as Error).message}`);
    }
  }
}