import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

/**
 * マークダウンドキュメント情報
 */
export interface MarkdownDocument {
  id: string;
  name: string;
  filePath: string;
  content: string;
  lastModified: number;
  tags: string[];
  category?: string;
}

/**
 * マークダウンドキュメント情報のインデックス
 */
interface MarkdownIndex {
  [id: string]: MarkdownDocument;
}

/**
 * マークダウンストレージサービス
 * プロジェクト内のマークダウンファイルを管理する
 */
export class MarkdownStorageService {
  private static _instance: MarkdownStorageService;
  private _projectPath: string = '';
  private _initialized: boolean = false;
  private _markdownIndex: MarkdownIndex = {};
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MarkdownStorageService {
    if (!MarkdownStorageService._instance) {
      MarkdownStorageService._instance = new MarkdownStorageService();
    }
    return MarkdownStorageService._instance;
  }
  
  /**
   * コンストラクタ
   */
  private constructor() {
    Logger.info('MarkdownStorageService: 初期化完了');
  }
  
  /**
   * プロジェクトパスで初期化
   * @param projectPath プロジェクトパス
   */
  public initializeWithPath(projectPath: string): void {
    this._projectPath = projectPath;
    this._initialized = true;
    this._markdownIndex = {};
    
    Logger.info(`MarkdownStorageService: プロジェクトパスで初期化: ${projectPath}`);
  }
  
  /**
   * 初期化済みかどうか
   * @returns 初期化済みかどうか
   */
  public isInitialized(): boolean {
    return this._initialized;
  }
  
  /**
   * マークダウンファイルを読み込む
   */
  public async loadMarkdownFiles(): Promise<void> {
    try {
      if (!this._initialized || !this._projectPath) {
        throw new Error('ストレージが初期化されていません');
      }
      
      // mdファイルを検索するディレクトリ
      const docsDir = path.join(this._projectPath, 'docs');
      
      if (!fs.existsSync(docsDir)) {
        Logger.warn(`MarkdownStorageService: docsディレクトリが存在しません: ${docsDir}`);
        return;
      }
      
      // インデックスをクリア
      this._markdownIndex = {};
      
      // マークダウンファイルの検索と読み込み
      await this._scanMarkdownFiles(docsDir);
      
      const count = Object.keys(this._markdownIndex).length;
      Logger.info(`MarkdownStorageService: ${count}個のマークダウンファイルを読み込みました`);
    } catch (error) {
      Logger.error('MarkdownStorageService: マークダウンファイル読み込みエラー', error as Error);
    }
  }
  
  /**
   * ディレクトリを再帰的に検索してマークダウンファイルを読み込む
   * @param dir 検索対象ディレクトリ
   */
  private async _scanMarkdownFiles(dir: string): Promise<void> {
    try {
      // ディレクトリ内のファイル一覧を取得
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // node_modulesなどは除外
          if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            await this._scanMarkdownFiles(entryPath);
          }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          // マークダウンファイルを処理
          await this._addMarkdownFile(entryPath);
        }
      }
    } catch (error) {
      Logger.error(`MarkdownStorageService: ディレクトリ検索エラー: ${dir}`, error as Error);
    }
  }
  
  /**
   * マークダウンファイルをインデックスに追加
   * @param filePath マークダウンファイルのパス
   */
  private async _addMarkdownFile(filePath: string): Promise<void> {
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // ファイル名をドキュメント名として使用
      const fileName = path.basename(filePath);
      const name = fileName.replace(/\.md$/i, '');
      
      // ファイルパスをIDとして使用（プロジェクトパスからの相対パス）
      const relativePath = path.relative(this._projectPath, filePath);
      const id = Buffer.from(relativePath).toString('base64');
      
      // タグの抽出（frontmatterなどから）
      const tags = this._extractTags(content);
      
      // カテゴリの抽出（ディレクトリ構造から）
      const category = path.dirname(relativePath) !== '.' ? path.dirname(relativePath) : undefined;
      
      // ドキュメント情報を作成
      const document: MarkdownDocument = {
        id,
        name,
        filePath,
        content,
        lastModified: stats.mtimeMs,
        tags,
        category
      };
      
      // インデックスに追加
      this._markdownIndex[id] = document;
      
      Logger.debug(`MarkdownStorageService: マークダウンファイルを追加: ${fileName}`);
    } catch (error) {
      Logger.error(`MarkdownStorageService: マークダウンファイル追加エラー: ${filePath}`, error as Error);
    }
  }
  
  /**
   * タグを抽出
   * @param content マークダウンコンテンツ
   * @returns タグ配列
   */
  private _extractTags(content: string): string[] {
    const tags: string[] = [];
    
    try {
      // タグ行を検索（シンプルな実装、ヘッダーの最初の方にあるタグ行を検出）
      const match = content.match(/tags:\s*\[(.*?)\]/i) || content.match(/tags:\s*(.*?)$/im);
      
      if (match && match[1]) {
        // カンマ区切りのタグを配列に変換
        const tagStr = match[1].trim();
        tags.push(...tagStr.split(/\s*,\s*/).map(tag => tag.replace(/['"]/g, '').trim()));
      }
    } catch (error) {
      Logger.warn('MarkdownStorageService: タグ抽出エラー', error as Error);
    }
    
    return tags;
  }
  
  /**
   * ファイルパスからドキュメントを取得
   * @param filePath ファイルパス
   * @returns マークダウンドキュメント
   */
  public async getDocumentByFilePath(filePath: string): Promise<MarkdownDocument | null> {
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        Logger.error(`MarkdownStorageService: ファイルが存在しません: ${filePath}`);
        return null;
      }
      
      // 相対パスを生成
      const relativePath = path.relative(this._projectPath, filePath);
      const id = Buffer.from(relativePath).toString('base64');
      
      // 既存のドキュメントがあれば返す
      if (this._markdownIndex[id]) {
        return this._markdownIndex[id];
      }
      
      // なければ新しく追加
      await this._addMarkdownFile(filePath);
      
      return this._markdownIndex[id] || null;
    } catch (error) {
      Logger.error(`MarkdownStorageService: ドキュメント取得エラー: ${filePath}`, error as Error);
      return null;
    }
  }
  
  /**
   * IDでドキュメントを取得
   * @param id ドキュメントID
   * @returns マークダウンドキュメント
   */
  public getDocument(id: string): MarkdownDocument | null {
    return this._markdownIndex[id] || null;
  }
  
  /**
   * すべてのドキュメントを取得
   * @returns マークダウンドキュメントの配列
   */
  public getAllDocuments(): MarkdownDocument[] {
    return Object.values(this._markdownIndex);
  }
  
  /**
   * ドキュメントを更新
   * @param document 更新するドキュメント
   */
  public updateDocument(document: MarkdownDocument): void {
    try {
      // IDでドキュメントを更新
      this._markdownIndex[document.id] = document;
      
      Logger.debug(`MarkdownStorageService: ドキュメントを更新: ${document.name}`);
    } catch (error) {
      Logger.error(`MarkdownStorageService: ドキュメント更新エラー: ${document.id}`, error as Error);
    }
  }
  
  /**
   * ファイル変更を監視
   * @param listener 変更リスナー
   * @returns disposable
   */
  public watchFileChanges(listener: (document: MarkdownDocument) => void): vscode.Disposable {
    // ファイルシステムの変更監視を設定
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    
    // ファイル変更イベントをリッスン
    const changeDisposable = watcher.onDidChange(async uri => {
      const filePath = uri.fsPath;
      
      // プロジェクト外のファイルは無視
      if (!filePath.startsWith(this._projectPath)) {
        return;
      }
      
      // ドキュメントを更新
      const document = await this.getDocumentByFilePath(filePath);
      if (document) {
        listener(document);
      }
    });
    
    // ファイル作成イベントをリッスン
    const createDisposable = watcher.onDidCreate(async uri => {
      const filePath = uri.fsPath;
      
      // プロジェクト外のファイルは無視
      if (!filePath.startsWith(this._projectPath)) {
        return;
      }
      
      // ドキュメントを追加
      const document = await this.getDocumentByFilePath(filePath);
      if (document) {
        listener(document);
      }
    });
    
    // 複合Disposableを返す
    return {
      dispose: () => {
        watcher.dispose();
        changeDisposable.dispose();
        createDisposable.dispose();
      }
    };
  }
  
  /**
   * リソース解放
   */
  public dispose(): void {
    this._markdownIndex = {};
    this._initialized = false;
    
    Logger.info('MarkdownStorageService: リソースを解放しました');
  }
}