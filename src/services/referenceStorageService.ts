import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { PlatformManager } from '../utils/PlatformManager';
import { ClaudeMdService } from '../utils/ClaudeMdService';

/**
 * リファレンスの種類
 */
export enum ReferenceType {
  API = 'api',
  Code = 'code',
  Environment = 'environment',
  Documentation = 'documentation',
  Screenshot = 'screenshot'
}

/**
 * リファレンス項目のインターフェース
 */
export interface Reference {
  id: string;
  title: string;
  content: string;
  type: ReferenceType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  fileRefs?: string[]; // 関連ファイルパス (画像ファイルなど)
  source?: string; // 情報の出所
}

/**
 * リファレンス管理サービス
 * リファレンス情報の保存・分類・取得を担当
 */
export class ReferenceStorageService {
  private static instance: ReferenceStorageService;
  private references: Map<string, Reference> = new Map();
  private _initialized: boolean = false;
  private _projectPath: string = '';
  private _storagePath: string = '';
  private _mediaPath: string = '';
  
  /**
   * プライベートコンストラクタ
   */
  private constructor() {}
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): ReferenceStorageService {
    if (!ReferenceStorageService.instance) {
      ReferenceStorageService.instance = new ReferenceStorageService();
    }
    return ReferenceStorageService.instance;
  }
  
  /**
   * 初期化
   * @param projectPath プロジェクトパス
   */
  public async initialize(projectPath: string): Promise<void> {
    if (this._initialized && this._projectPath === projectPath) {
      return;
    }
    
    this._projectPath = projectPath;
    this._storagePath = path.join(projectPath, 'docs');
    this._mediaPath = path.join(projectPath, 'media', 'references');
    
    // メディアフォルダの作成
    if (!fs.existsSync(this._mediaPath)) {
      fs.mkdirSync(this._mediaPath, { recursive: true });
    }
    
    // docsフォルダの作成
    if (!fs.existsSync(this._storagePath)) {
      fs.mkdirSync(this._storagePath, { recursive: true });
    }
    
    // 各リファレンスファイルを確認
    await this.ensureReferenceFiles();
    
    // リファレンスインデックスを読み込む
    await this.loadReferences();
    
    this._initialized = true;
    Logger.info(`ReferenceStorageService initialized for project: ${projectPath}`);
  }
  
  /**
   * 必要なリファレンスファイルが存在するか確認し、なければ作成
   */
  private async ensureReferenceFiles(): Promise<void> {
    // API ドキュメントファイルの確認
    const apiPath = path.join(this._storagePath, 'api.md');
    if (!fs.existsSync(apiPath)) {
      fs.writeFileSync(apiPath, '# API リファレンス\n\nこのファイルにはプロジェクトで使用するAPIの情報が記録されます。\n\n', 'utf8');
    }
    
    // コードスニペットファイルの確認
    const snippetsPath = path.join(this._storagePath, 'snippets.md');
    if (!fs.existsSync(snippetsPath)) {
      fs.writeFileSync(snippetsPath, '# コードスニペット\n\nこのファイルにはプロジェクトで使用するコードサンプルが記録されます。\n\n', 'utf8');
    }
    
    // リファレンスファイルの確認
    const referencePath = path.join(this._storagePath, 'reference.md');
    if (!fs.existsSync(referencePath)) {
      fs.writeFileSync(referencePath, '# 開発リファレンス\n\nこのファイルにはプロジェクト開発に関する一般的なリファレンス情報が記録されます。\n\n', 'utf8');
    }
    
    // 環境設定ファイルの確認
    const envPath = path.join(this._storagePath, 'env.example');
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, '# 環境変数設定例\n\n# APIキー\nAPI_KEY=your_api_key_here\n\n# その他の環境変数\n', 'utf8');
    }
    
    // リファレンスインデックスファイルの確認
    const indexPath = path.join(this._storagePath, 'reference_index.json');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, JSON.stringify({ references: [] }, null, 2), 'utf8');
    }
  }
  
  /**
   * リファレンスインデックスを読み込む
   */
  private async loadReferences(): Promise<void> {
    try {
      const indexPath = path.join(this._storagePath, 'reference_index.json');
      const content = fs.readFileSync(indexPath, 'utf8');
      const data = JSON.parse(content);
      
      this.references.clear();
      if (data.references && Array.isArray(data.references)) {
        for (const ref of data.references) {
          this.references.set(ref.id, ref);
        }
      }
      
      Logger.info(`Loaded ${this.references.size} references from index`);
    } catch (error) {
      Logger.error('リファレンスインデックスの読み込みに失敗しました', error as Error);
      this.references.clear();
    }
  }
  
  /**
   * リファレンスインデックスを保存
   */
  private async saveIndex(): Promise<void> {
    try {
      const indexPath = path.join(this._storagePath, 'reference_index.json');
      const data = {
        references: Array.from(this.references.values())
      };
      
      fs.writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf8');
      Logger.info(`Saved ${this.references.size} references to index`);
    } catch (error) {
      Logger.error('リファレンスインデックスの保存に失敗しました', error as Error);
    }
  }
  
  /**
   * リファレンスを追加
   * @param content リファレンスコンテンツ
   * @param title タイトル (自動検出されなかった場合)
   * @param type リファレンスタイプ (自動検出されなかった場合)
   * @returns 追加されたリファレンスのID
   */
  public async addReference(content: string, title?: string, type?: ReferenceType): Promise<string> {
    // 初期化確認
    if (!this._initialized) {
      throw new Error('ReferenceStorageService has not been initialized');
    }
    
    // コンテンツからタイプを自動検出
    const detectedType = type || this.detectReferenceType(content);
    
    // コンテンツからタイトルを自動検出
    const detectedTitle = title || this.extractTitle(content, detectedType);
    
    // タグを自動抽出
    const tags = this.extractTags(content, detectedType);
    
    // リファレンスIDを生成
    const id = `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // リファレンスオブジェクトを作成
    const reference: Reference = {
      id,
      title: detectedTitle,
      content,
      type: detectedType,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // インデックスに追加
    this.references.set(id, reference);
    
    // リファレンスを保存
    await this.saveReferenceContent(reference);
    
    // インデックスを保存
    await this.saveIndex();
    
    // CLAUDE.mdを更新
    await this.updateClaudeMd();
    
    return id;
  }
  
  /**
   * リファレンスを更新
   * @param id リファレンスID
   * @param updates 更新内容
   */
  public async updateReference(id: string, updates: Partial<Reference>): Promise<boolean> {
    // 初期化確認
    if (!this._initialized) {
      throw new Error('ReferenceStorageService has not been initialized');
    }
    
    // リファレンスが存在するか確認
    if (!this.references.has(id)) {
      Logger.warn(`リファレンスが見つかりません: ${id}`);
      return false;
    }
    
    // リファレンスを取得
    const reference = this.references.get(id)!;
    
    // 更新
    const updatedReference = {
      ...reference,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // リファレンスを保存
    this.references.set(id, updatedReference);
    await this.saveReferenceContent(updatedReference);
    
    // インデックスを保存
    await this.saveIndex();
    
    // CLAUDE.mdを更新
    await this.updateClaudeMd();
    
    return true;
  }
  
  /**
   * リファレンスを削除
   * @param id リファレンスID
   */
  public async deleteReference(id: string): Promise<boolean> {
    // 初期化確認
    if (!this._initialized) {
      throw new Error('ReferenceStorageService has not been initialized');
    }
    
    // リファレンスが存在するか確認
    if (!this.references.has(id)) {
      Logger.warn(`リファレンスが見つかりません: ${id}`);
      return false;
    }
    
    // リファレンスを取得
    const reference = this.references.get(id)!;
    
    // リファレンスをインデックスから削除
    this.references.delete(id);
    
    // ファイル参照を削除
    if (reference.fileRefs && reference.fileRefs.length > 0) {
      for (const filePath of reference.fileRefs) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          Logger.warn(`関連ファイルの削除に失敗しました: ${filePath}`, error as Error);
        }
      }
    }
    
    // インデックスを保存
    await this.saveIndex();
    
    // CLAUDE.mdを更新
    await this.updateClaudeMd();
    
    return true;
  }
  
  /**
   * すべてのリファレンスを取得
   */
  public getAllReferences(): Reference[] {
    return Array.from(this.references.values());
  }
  
  /**
   * 特定タイプのリファレンスをすべて取得
   * @param type リファレンスタイプ
   */
  public getReferencesByType(type: ReferenceType): Reference[] {
    return Array.from(this.references.values()).filter(ref => ref.type === type);
  }
  
  /**
   * タグでリファレンスを検索
   * @param tag 検索タグ
   */
  public getReferencesByTag(tag: string): Reference[] {
    return Array.from(this.references.values()).filter(ref => ref.tags.includes(tag));
  }
  
  /**
   * リファレンスを検索
   * @param query 検索クエリ
   */
  public searchReferences(query: string): Reference[] {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.references.values()).filter(ref => 
      ref.title.toLowerCase().includes(lowercaseQuery) || 
      ref.content.toLowerCase().includes(lowercaseQuery) ||
      ref.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }
  
  /**
   * リファレンスタイプを自動検出
   * @param content リファレンスコンテンツ
   */
  private detectReferenceType(content: string): ReferenceType {
    const lowerContent = content.toLowerCase();
    
    // API関連の検出
    if (
      lowerContent.includes('api') ||
      lowerContent.includes('endpoint') ||
      lowerContent.includes('http') ||
      lowerContent.includes('request') ||
      lowerContent.includes('response') ||
      lowerContent.includes('rest') ||
      lowerContent.includes('graphql')
    ) {
      return ReferenceType.API;
    }
    
    // コードスニペット検出
    if (
      lowerContent.includes('function') ||
      lowerContent.includes('class') ||
      lowerContent.includes('import ') ||
      lowerContent.includes('const ') ||
      lowerContent.includes('let ') ||
      lowerContent.includes('var ') ||
      lowerContent.includes('{') ||
      lowerContent.includes('(') ||
      lowerContent.includes('=>') ||
      lowerContent.includes('return') ||
      lowerContent.includes('```')
    ) {
      return ReferenceType.Code;
    }
    
    // 環境設定検出
    if (
      lowerContent.includes('env') ||
      lowerContent.includes('environment') ||
      lowerContent.includes('config') ||
      lowerContent.includes('setting') ||
      lowerContent.includes('variable') ||
      lowerContent.includes('secret') ||
      lowerContent.includes('key=') ||
      lowerContent.includes('password') ||
      lowerContent.includes('.env')
    ) {
      return ReferenceType.Environment;
    }
    
    // スクリーンショット検出 (通常この関数でのスクリーンショット検出はテキスト内容のみで行う)
    if (
      lowerContent.includes('screenshot') ||
      lowerContent.includes('screen shot') ||
      lowerContent.includes('画面キャプチャ') ||
      lowerContent.includes('スクリーンショット')
    ) {
      return ReferenceType.Screenshot;
    }
    
    // デフォルトはドキュメント
    return ReferenceType.Documentation;
  }
  
  /**
   * コンテンツからタイトルを抽出
   * @param content リファレンスコンテンツ
   * @param type リファレンスタイプ
   */
  private extractTitle(content: string, type: ReferenceType): string {
    // # で始まるマークダウンタイトルを探す
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    // コードの場合は関数名やクラス名を抽出
    if (type === ReferenceType.Code) {
      const functionMatch = content.match(/function\s+(\w+)/);
      if (functionMatch && functionMatch[1]) {
        return `Function: ${functionMatch[1]}`;
      }
      
      const classMatch = content.match(/class\s+(\w+)/);
      if (classMatch && classMatch[1]) {
        return `Class: ${classMatch[1]}`;
      }
      
      // その他のパターン
      if (content.includes('export')) {
        return 'Exported Code Snippet';
      }
    }
    
    // APIの場合はURLやエンドポイントを抽出
    if (type === ReferenceType.API) {
      const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch && urlMatch[1]) {
        return `API: ${urlMatch[1].substring(0, 30)}${urlMatch[1].length > 30 ? '...' : ''}`;
      }
      
      const endpointMatch = content.match(/\/api\/([^\s/]+)/);
      if (endpointMatch && endpointMatch[1]) {
        return `Endpoint: ${endpointMatch[1]}`;
      }
    }
    
    // 環境変数の場合は変数名を抽出
    if (type === ReferenceType.Environment) {
      const envMatch = content.match(/([A-Z_]+)=/);
      if (envMatch && envMatch[1]) {
        return `Env: ${envMatch[1]}`;
      }
    }
    
    // 最初の行をタイトルとして使用
    const firstLine = content.split('\n')[0].trim();
    if (firstLine && firstLine.length <= 50) {
      return firstLine;
    }
    
    // デフォルトタイトル
    const typeNames = {
      [ReferenceType.API]: 'API Reference',
      [ReferenceType.Code]: 'Code Snippet',
      [ReferenceType.Environment]: 'Environment Config',
      [ReferenceType.Documentation]: 'Documentation',
      [ReferenceType.Screenshot]: 'Screenshot'
    };
    
    return `${typeNames[type]} - ${new Date().toLocaleString('ja-JP')}`;
  }
  
  /**
   * タグを抽出
   * @param content リファレンスコンテンツ
   * @param type リファレンスタイプ
   */
  private extractTags(content: string, type: ReferenceType): string[] {
    const tags: Set<string> = new Set([type]); // タイプは常にタグとして含める
    
    // 言語を検出（コードブロックから）
    const codeBlockMatch = content.match(/```(\w+)/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      tags.add(codeBlockMatch[1]);
    }
    
    // フレームワーク/ライブラリを検出
    const frameworks = ['react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'laravel', 'typescript'];
    for (const framework of frameworks) {
      if (content.toLowerCase().includes(framework)) {
        tags.add(framework);
      }
    }
    
    // APIメソッドを検出
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    for (const method of methods) {
      const pattern = new RegExp(`\\b${method}\\b`, 'i');
      if (pattern.test(content)) {
        tags.add(method.toUpperCase());
      }
    }
    
    // 特殊タグ
    if (content.toLowerCase().includes('auth') || content.toLowerCase().includes('認証')) {
      tags.add('authentication');
    }
    
    if (content.toLowerCase().includes('database') || content.toLowerCase().includes('db') || content.toLowerCase().includes('データベース')) {
      tags.add('database');
    }
    
    // @タグの抽出
    const tagMatches = content.match(/@(\w+)/g);
    if (tagMatches) {
      for (const tag of tagMatches) {
        tags.add(tag.substring(1));
      }
    }
    
    // ハッシュタグの抽出
    const hashTagMatches = content.match(/#(\w+)/g);
    if (hashTagMatches) {
      for (const tag of hashTagMatches) {
        // #が含まれるコード例外を避けるためのフィルタリング
        if (tag.length > 1 && tag.length < 20) {
          tags.add(tag.substring(1));
        }
      }
    }
    
    return Array.from(tags);
  }
  
  /**
   * リファレンスの内容を保存
   * @param reference リファレンス
   */
  private async saveReferenceContent(reference: Reference): Promise<void> {
    try {
      // リファレンスタイプに基づいてターゲットファイルを選択
      let targetFile: string;
      let targetSection: string | null = null;
      
      switch (reference.type) {
        case ReferenceType.API:
          targetFile = path.join(this._storagePath, 'api.md');
          targetSection = `## ${reference.title}`;
          break;
        case ReferenceType.Code:
          targetFile = path.join(this._storagePath, 'snippets.md');
          targetSection = `## ${reference.title}`;
          break;
        case ReferenceType.Environment:
          targetFile = path.join(this._storagePath, 'env.example');
          // 環境変数ファイルはセクション分けせず、コメントで区切る
          targetSection = `# ${reference.title}`;
          break;
        case ReferenceType.Screenshot:
          // スクリーンショットはメディアフォルダに保存する（未実装）
          targetFile = path.join(this._storagePath, 'reference.md');
          targetSection = `## ${reference.title}`;
          break;
        default:
          targetFile = path.join(this._storagePath, 'reference.md');
          targetSection = `## ${reference.title}`;
          break;
      }
      
      // ファイルが存在するか確認
      if (!fs.existsSync(targetFile)) {
        // ファイルが存在しない場合、タイプに応じた初期内容を作成
        let initialContent = '';
        switch (reference.type) {
          case ReferenceType.API:
            initialContent = '# API リファレンス\n\nこのファイルにはプロジェクトで使用するAPIの情報が記録されます。\n\n';
            break;
          case ReferenceType.Code:
            initialContent = '# コードスニペット\n\nこのファイルにはプロジェクトで使用するコードサンプルが記録されます。\n\n';
            break;
          case ReferenceType.Environment:
            initialContent = '# 環境変数設定例\n\n';
            break;
          default:
            initialContent = '# 開発リファレンス\n\nこのファイルにはプロジェクト開発に関する一般的なリファレンス情報が記録されます。\n\n';
            break;
        }
        fs.writeFileSync(targetFile, initialContent, 'utf8');
      }
      
      // ファイルを読み込む
      let fileContent = fs.readFileSync(targetFile, 'utf8');
      
      // リファレンスの内容を整形
      let formattedContent = this.formatReferenceContent(reference);
      
      // ファイルにリファレンスを追加
      if (reference.type === ReferenceType.Environment) {
        // 環境変数は既存の内容を拡張
        fileContent += `\n${formattedContent}\n`;
      } else {
        // 他のタイプはセクションとして追加
        if (fileContent.includes(targetSection!)) {
          // 既存のセクションがある場合は更新
          const sectionRegex = new RegExp(`${this.escapeRegExp(targetSection!)}[\\s\\S]*?(##|$)`, 'g');
          fileContent = fileContent.replace(sectionRegex, `${targetSection}\n\n${formattedContent}\n\n$1`);
        } else {
          // 新しいセクションを追加
          fileContent += `\n${targetSection}\n\n${formattedContent}\n\n`;
        }
      }
      
      // ファイルに書き込む
      fs.writeFileSync(targetFile, fileContent, 'utf8');
      
      Logger.info(`リファレンスを保存しました: ${reference.id} - ${reference.title}`);
    } catch (error) {
      Logger.error(`リファレンスの保存に失敗しました: ${reference.id}`, error as Error);
    }
  }
  
  /**
   * リファレンスの内容を整形
   * @param reference リファレンス
   */
  private formatReferenceContent(reference: Reference): string {
    switch (reference.type) {
      case ReferenceType.API:
        return this.formatAPIReference(reference);
      case ReferenceType.Code:
        return this.formatCodeSnippet(reference);
      case ReferenceType.Environment:
        return this.formatEnvironmentConfig(reference);
      case ReferenceType.Screenshot:
        return this.formatScreenshotReference(reference);
      default:
        return this.formatDocumentation(reference);
    }
  }
  
  /**
   * API リファレンスの整形
   * @param reference リファレンス
   */
  private formatAPIReference(reference: Reference): string {
    // タグを整形
    const tagString = reference.tags.filter(tag => tag !== 'api').length > 0
      ? `\nタグ: ${reference.tags.filter(tag => tag !== 'api').join(', ')}\n`
      : '';
    
    // 基本的にそのまま保持し、最後にタグと更新日を追加
    return `${reference.content}\n\n${tagString}\n更新日: ${new Date(reference.updatedAt).toLocaleString('ja-JP')}\n`;
  }
  
  /**
   * コードスニペットの整形
   * @param reference リファレンス
   */
  private formatCodeSnippet(reference: Reference): string {
    // タグを整形
    const tagString = reference.tags.filter(tag => tag !== 'code').length > 0
      ? `\nタグ: ${reference.tags.filter(tag => tag !== 'code').join(', ')}\n`
      : '';
    
    // 基本的にそのまま保持し、最後にタグと更新日を追加
    return `${reference.content}\n\n${tagString}\n更新日: ${new Date(reference.updatedAt).toLocaleString('ja-JP')}\n`;
  }
  
  /**
   * 環境設定の整形
   * @param reference リファレンス
   */
  private formatEnvironmentConfig(reference: Reference): string {
    // 環境変数はコメントで区切る
    return `# ${reference.title}\n# 追加日: ${new Date(reference.createdAt).toLocaleString('ja-JP')}\n${reference.content}\n`;
  }
  
  /**
   * スクリーンショットリファレンスの整形
   * @param reference リファレンス
   */
  private formatScreenshotReference(reference: Reference): string {
    // 関連ファイルがある場合はリンクを追加
    let imageLinks = '';
    if (reference.fileRefs && reference.fileRefs.length > 0) {
      for (const filePath of reference.fileRefs) {
        const relativePath = path.relative(this._projectPath, filePath).replace(/\\/g, '/');
        imageLinks += `\n![Screenshot](${relativePath})\n`;
      }
    }
    
    // タグを整形
    const tagString = reference.tags.filter(tag => tag !== 'screenshot').length > 0
      ? `\nタグ: ${reference.tags.filter(tag => tag !== 'screenshot').join(', ')}\n`
      : '';
    
    return `${reference.content}\n${imageLinks}\n${tagString}\n更新日: ${new Date(reference.updatedAt).toLocaleString('ja-JP')}\n`;
  }
  
  /**
   * ドキュメントの整形
   * @param reference リファレンス
   */
  private formatDocumentation(reference: Reference): string {
    // タグを整形
    const tagString = reference.tags.filter(tag => tag !== 'documentation').length > 0
      ? `\nタグ: ${reference.tags.filter(tag => tag !== 'documentation').join(', ')}\n`
      : '';
    
    // 基本的にそのまま保持し、最後にタグと更新日を追加
    return `${reference.content}\n\n${tagString}\n更新日: ${new Date(reference.updatedAt).toLocaleString('ja-JP')}\n`;
  }
  
  /**
   * 画像リファレンスを追加
   * @param imagePath 画像パス
   * @param title タイトル
   * @param description 説明
   */
  public async addImageReference(imagePath: string, title: string, description: string): Promise<string> {
    try {
      // 初期化確認
      if (!this._initialized) {
        throw new Error('ReferenceStorageService has not been initialized');
      }
      
      // 画像ファイルを保存する
      const fileExt = path.extname(imagePath);
      const fileName = `img_${Date.now()}${fileExt}`;
      const destPath = path.join(this._mediaPath, fileName);
      
      // 画像をコピー
      fs.copyFileSync(imagePath, destPath);
      
      // リファレンスを作成
      const content = `# ${title}\n\n${description}`;
      const id = `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // リファレンスオブジェクトを作成
      const reference: Reference = {
        id,
        title,
        content,
        type: ReferenceType.Screenshot,
        tags: ['screenshot'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileRefs: [destPath]
      };
      
      // インデックスに追加
      this.references.set(id, reference);
      
      // リファレンスを保存
      await this.saveReferenceContent(reference);
      
      // インデックスを保存
      await this.saveIndex();
      
      // CLAUDE.mdを更新
      await this.updateClaudeMd();
      
      return id;
    } catch (error) {
      Logger.error('画像リファレンスの追加に失敗しました', error as Error);
      throw error;
    }
  }
  
  /**
   * 正規表現のエスケープ
   * @param str エスケープする文字列
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * CLAUDE.mdのリファレンスセクションを更新
   */
  private async updateClaudeMd(): Promise<void> {
    try {
      // 各タイプのリファレンス数をカウント
      const apiCount = this.getReferencesByType(ReferenceType.API).length;
      const codeCount = this.getReferencesByType(ReferenceType.Code).length;
      const envCount = this.getReferencesByType(ReferenceType.Environment).length;
      const docCount = this.getReferencesByType(ReferenceType.Documentation).length;
      const screenshotCount = this.getReferencesByType(ReferenceType.Screenshot).length;
      
      // リファレンスセクションの内容
      const content = `
### API リファレンス (${apiCount})
[API リファレンスファイル](./docs/api.md)

### コードスニペット (${codeCount})
[コードスニペットファイル](./docs/snippets.md)

### 環境設定 (${envCount})
[環境変数設定ファイル](./docs/env.example)

### 一般リファレンス (${docCount})
[リファレンスファイル](./docs/reference.md)

### スクリーンショット (${screenshotCount})
[media/referencesフォルダ](./media/references/)

合計リファレンス数: ${this.references.size}
`;
      
      // CLAUDE.mdのリファレンスセクションを更新
      const claudeMdService = ClaudeMdService.getInstance();
      claudeMdService.updateClaudeMdSection(this._projectPath, '開発リファレンス', content.trim());
      
      Logger.info('CLAUDE.mdのリファレンスセクションを更新しました');
    } catch (error) {
      Logger.error('CLAUDE.mdのリファレンスセクション更新に失敗しました', error as Error);
    }
  }
}