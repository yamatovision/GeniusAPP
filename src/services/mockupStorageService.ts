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
}

/**
 * モックアップの保存と取得を管理する共通ストレージサービス
 */
export class MockupStorageService {
  private static instance: MockupStorageService;
  private mockups: Map<string, Mockup> = new Map();
  private storageDir: string;
  private metadataFile: string;
  private _initialized: boolean = false;

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
    // 初期状態ではデフォルトのワークスペースパスを使用
    this.initializeWithDefaultPath();
  }

  /**
   * デフォルトのワークスペースパスで初期化
   */
  private initializeWithDefaultPath(): void {
    // VSCodeのワークスペースパスを取得
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const rootPath = workspaceFolders && workspaceFolders.length > 0 
      ? workspaceFolders[0].uri.fsPath 
      : process.cwd();
    
    this.initializeWithPath(rootPath);
  }

  /**
   * 指定されたプロジェクトパスでストレージを初期化
   * @param projectPath プロジェクトのパス
   */
  public initializeWithPath(projectPath: string): void {
    // プロジェクトディレクトリ内の'mockups'ディレクトリを使用
    this.storageDir = path.join(projectPath, 'mockups');
    this.metadataFile = path.join(this.storageDir, 'metadata.json');

    // ディレクトリの作成
    this.ensureDirectoryExists(this.storageDir);
    
    // 既存のモックアップをロード
    this.loadMockups();
    
    this._initialized = true;
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
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
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
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
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
      
      // メタデータの更新
      await this.saveMetadata();
      
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
      
      // メタデータファイルが存在するか確認
      if (fs.existsSync(this.metadataFile)) {
        // メタデータファイルを読み込む
        const metadata = await fs.promises.readFile(this.metadataFile, 'utf8');
        const mockupList = JSON.parse(metadata) as Mockup[];
        
        // メタデータをマップに設定
        mockupList.forEach(mockup => {
          this.mockups.set(mockup.id, mockup);
        });
        
        Logger.info(`Loaded ${mockupList.length} mockups from metadata`);
      }
      
      // ディレクトリ内のモックアップをロード
      if (fs.existsSync(this.storageDir)) {
        // 1. まずstructured mockupをロード (mockup_ディレクトリ)
        const directories = fs.readdirSync(this.storageDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('mockup_'))
          .map(dirent => dirent.name);
        
        for (const dir of directories) {
          if (this.mockups.has(dir)) continue; // メタデータから既にロードされている場合はスキップ
          
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
              sourceType: 'imported' // ディレクトリから復元されたものはインポートとして扱う
            };
            
            // マップに追加
            this.mockups.set(dir, mockup);
          }
        }
        
        // 2. 次にルートディレクトリのHTMLファイルをインポート
        const htmlFiles = fs.readdirSync(this.storageDir, { withFileTypes: true })
          .filter(dirent => dirent.isFile() && (dirent.name.endsWith('.html') || dirent.name.endsWith('.htm')))
          .map(dirent => dirent.name);
        
        for (const htmlFile of htmlFiles) {
          const htmlPath = path.join(this.storageDir, htmlFile);
          const fileNameWithoutExt = htmlFile.replace(/\.[^/.]+$/, ''); // 拡張子を削除
          const mockupId = `mockup_${Date.now()}_${fileNameWithoutExt}`;
          
          // ファイルが既にロードされているかチェック (同じパスのファイルがあるか)
          const alreadyExists = Array.from(this.mockups.values()).some(
            mockup => mockup.description === `File: ${htmlPath}`
          );
          
          if (!alreadyExists) {
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
              description: `File: ${htmlPath}`
            };
            
            // マップに追加
            this.mockups.set(mockupId, mockup);
            Logger.info(`Imported HTML file: ${htmlFile}`);
          }
        }
        
        // 新しいメタデータファイルを作成
        await this.saveMetadata();
        
        Logger.info(`Loaded ${this.mockups.size} mockups from directory structure`);
      }
    } catch (error) {
      Logger.error(`Failed to load mockups: ${(error as Error).message}`);
    }
  }

  /**
   * メタデータをファイルに保存
   */
  private async saveMetadata(): Promise<void> {
    try {
      const mockupList = Array.from(this.mockups.values());
      await fs.promises.writeFile(this.metadataFile, JSON.stringify(mockupList, null, 2), 'utf8');
      Logger.debug(`Saved metadata for ${mockupList.length} mockups`);
    } catch (error) {
      Logger.error(`Failed to save metadata: ${(error as Error).message}`);
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
}