import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { SharedFile, FileSaveOptions } from '../types/SharingTypes';

/**
 * 一時ファイル管理クラス
 * ClaudeCodeとの共有のための一時ファイルを管理
 */
export class TempFileManager {
  private basePath: string;
  private imagePath: string;

  /**
   * コンストラクタ
   * @param basePath 一時ファイルの基本ディレクトリ（デフォルトは/tmp/claude-share）
   */
  constructor(basePath: string = '') {
    // 基本パスを設定（プラットフォームに応じて調整）
    if (basePath) {
      this.basePath = basePath;
    } else {
      this.basePath = path.join(this.getTempDir(), 'claude-share');
    }
    
    this.imagePath = path.join(this.basePath, 'images');
    
    // 必要なディレクトリを作成
    this.ensureDirectories();
  }

  /**
   * プラットフォーム固有の一時ディレクトリを取得
   */
  private getTempDir(): string {
    if (process.platform === 'win32') {
      return process.env.TEMP || process.env.TMP || 'C:\\temp';
    } else {
      return '/tmp';
    }
  }

  /**
   * 必要なディレクトリを作成
   */
  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
      }
      
      if (!fs.existsSync(this.imagePath)) {
        fs.mkdirSync(this.imagePath, { recursive: true });
      }
    } catch (error) {
      throw new Error(`一時ディレクトリの作成に失敗しました: ${error}`);
    }
  }

  /**
   * 一時ファイルパスを作成
   * @param type ファイルタイプ（'text' または 'image'）
   * @param extension ファイル拡張子
   * @param customName カスタムファイル名（オプション）
   */
  private generateTempFilePath(type: 'text' | 'image', extension: string = '', customName?: string): string {
    // 人間が読みやすい日付形式
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 短い一意の識別子
    const randomStr = crypto.randomBytes(3).toString('hex');
    
    // カスタム名が提供された場合は使用
    const safeCustomName = customName 
      ? this.sanitizeFileName(customName) 
      : '';
    
    if (type === 'text') {
      const prefix = safeCustomName || 'shared_text';
      // テキストファイルの命名規則：prefix_YYYYMMDD_HHMM_random.txt
      return path.join(this.basePath, `${prefix}_${dateStr}_${timeStr}_${randomStr}.txt`);
    } else {
      // 画像のファイル名はより明確に
      const prefix = safeCustomName || 'image';
      // 画像ファイルの命名規則：prefix_YYYYMMDD_HHMM_random.ext
      return path.join(this.imagePath, `${prefix}_${dateStr}_${timeStr}_${randomStr}.${extension}`);
    }
  }
  
  /**
   * ファイル名を安全な形式に変換
   * @param name 元のファイル名
   * @returns 安全なファイル名
   */
  private sanitizeFileName(name: string): string {
    if (!name) return 'untitled';
    
    // 日本語を含むかチェック
    const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(name);
    
    // 日本語を含む場合の処理
    if (hasJapanese) {
      console.log('日本語を含むファイル名を検出: ' + name);
      
      // 空白をアンダースコアに置換
      let safeName = name.replace(/\s+/g, '_');
      
      // ファイル名に使用できない文字を削除
      safeName = safeName.replace(/[\\/:*?"<>|]/g, '');
      
      // 長すぎる場合は省略
      if (safeName.length > 30) {
        safeName = safeName.substring(0, 30);
      }
      
      return safeName || 'untitled';
    } 
    // 英数字の場合の処理（従来通り）
    else {
      // 空白をアンダースコアに置換
      let safeName = name.replace(/\s+/g, '_');
      
      // 使用不可文字を除去
      safeName = safeName.replace(/[^a-zA-Z0-9_\-]/g, '');
      
      // 長すぎる場合は省略
      if (safeName.length > 30) {
        safeName = safeName.substring(0, 30);
      }
      
      return safeName || 'untitled';
    }
  }

  /**
   * テキストファイルを保存
   * @param content テキスト内容
   * @param options 保存オプション
   */
  public async saveTextFile(content: string, options?: FileSaveOptions): Promise<SharedFile> {
    // テキストの先頭部分からファイル名を生成
    let customName = options?.title;
    let originalSuggestedName = '';
    
    // オプションで提供されているsuggestedFilenameを優先的に使用
    if (options && options.metadata && options.metadata.suggestedFilename) {
      originalSuggestedName = options.metadata.suggestedFilename;
      customName = originalSuggestedName;
      console.log(`提案されたファイル名を使用します: ${customName}`);
      
      // 日本語ファイル名の場合、特別な処理
      const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(customName);
      if (hasJapanese) {
        console.log('日本語の提案ファイル名を検出しました');
      }
    }
    // フロントエンドからの提案ファイル名がない場合、テキスト内容から生成
    else if (!customName && content) {
      // 先頭の最大50文字を取得
      const firstLine = content.split('\n')[0].trim();
      if (firstLine) {
        customName = firstLine.slice(0, 50);
        originalSuggestedName = customName;
        console.log(`テキスト内容からファイル名を生成します: ${customName}`);
      }
    }
    
    const filePath = this.generateTempFilePath('text', 'txt', customName);
    const now = new Date();
    
    // ファイルに書き込み
    try {
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`テキストファイルの保存に失敗しました: ${error}`);
    }
    
    // 有効期限を計算
    const expirationHours = options?.expirationHours || 24;
    const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);
    
    // テキストの先頭部分を使ってタイトルを設定
    // 日本語対応 - 表示用タイトルには日本語をそのまま使用
    const displayTitle = originalSuggestedName || customName || content.substring(0, 50) || 'テキスト';
    const fileNameTitle = customName || this.sanitizeFileName(content.substring(0, 50)) || 'テキスト';
    
    // ファイル情報を作成 - IDに完全なランダム要素を追加して一意性を確保
    const uniqueId = `${path.basename(filePath, '.txt')}_${crypto.randomBytes(6).toString('hex')}`;
    
    const fileInfo: SharedFile = {
      id: uniqueId, // 完全にユニークなIDを使用
      fileName: path.basename(filePath),
      originalName: originalSuggestedName || options?.title || `${fileNameTitle}.txt`,
      title: displayTitle, // 表示用タイトルには元の日本語を使用
      type: 'text',
      size: Buffer.from(content).length,
      format: 'text/plain',
      createdAt: now,
      expiresAt: expiresAt,
      path: filePath,
      accessCount: 0,
      isExpired: false,
      metadata: {
        originalSuggestedName: originalSuggestedName, // 元の提案名を保持
        uniqueId: uniqueId // メタデータにもIDを保存
      }
    };
    
    return fileInfo;
  }

  /**
   * 画像ファイルを保存
   * @param content 画像バイナリデータ
   * @param options 保存オプション
   */
  public async saveImageFile(content: Buffer, options?: FileSaveOptions): Promise<SharedFile> {
    const format = options?.format || 'png';
    
    // カスタム名が提供されているか、元のファイル名から拡張子を取り除いた部分を使用
    let customName = options?.title;
    if (customName && customName.includes('.')) {
      // 拡張子を除去
      customName = customName.split('.').slice(0, -1).join('.');
    }
    
    const filePath = this.generateTempFilePath('image', format, customName);
    const now = new Date();
    
    // ファイルに書き込み
    try {
      fs.writeFileSync(filePath, content);
    } catch (error) {
      throw new Error(`画像ファイルの保存に失敗しました: ${error}`);
    }
    
    // 有効期限を計算
    const expirationHours = options?.expirationHours || 24;
    const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);
    
    // タイトルを設定（オリジナルのファイル名または生成された名前）
    const title = customName || '画像';
    
    // ファイル情報を作成 - IDに完全なランダム要素を追加して一意性を確保
    const uniqueId = `${path.basename(filePath).split('.')[0]}_${crypto.randomBytes(6).toString('hex')}`;
    
    const fileInfo: SharedFile = {
      id: uniqueId, // 完全にユニークなIDを使用
      fileName: path.basename(filePath),
      originalName: options?.title || `${title}.${format}`,
      title: title,
      type: 'image',
      size: content.length,
      format: `image/${format}`,
      createdAt: now,
      expiresAt: expiresAt,
      path: filePath,
      accessCount: 0,
      isExpired: false,
      metadata: {
        uniqueId: uniqueId // メタデータにもIDを保存
      }
    };
    
    return fileInfo;
  }

  /**
   * ファイルが存在するか確認
   * @param filePath ファイルパス
   */
  public fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * ファイルを削除
   * @param filePath ファイルパス
   */
  public deleteFile(filePath: string): boolean {
    try {
      if (this.fileExists(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`ファイルの削除に失敗しました: ${error}`);
      return false;
    }
  }

  /**
   * 期限切れファイルをクリーンアップ
   * @param files チェックするファイルのリスト（省略時は全ファイル）
   */
  public cleanupExpiredFiles(files?: SharedFile[]): number {
    let deletedCount = 0;
    const now = new Date();
    
    try {
      if (files && files.length > 0) {
        // 特定のファイルのみクリーンアップ
        for (const file of files) {
          if (now > file.expiresAt && this.fileExists(file.path)) {
            this.deleteFile(file.path);
            deletedCount++;
          }
        }
      } else {
        // すべての一時ファイルをスキャン
        if (fs.existsSync(this.basePath)) {
          // テキストファイルをクリーンアップ
          const textFiles = fs.readdirSync(this.basePath)
            .filter(file => file.endsWith('.txt'))
            .map(file => path.join(this.basePath, file));
          
          // ファイルの作成日時をチェック
          for (const file of textFiles) {
            try {
              const stats = fs.statSync(file);
              const createdTime = stats.birthtime || stats.mtime;
              const expiresAt = new Date(createdTime.getTime() + 24 * 60 * 60 * 1000);
              
              if (now > expiresAt) {
                this.deleteFile(file);
                deletedCount++;
              }
            } catch (error) {
              console.error(`ファイル情報の取得に失敗しました: ${file}`, error);
            }
          }
          
          // 画像ファイルをクリーンアップ
          if (fs.existsSync(this.imagePath)) {
            const imageFiles = fs.readdirSync(this.imagePath)
              .filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file))
              .map(file => path.join(this.imagePath, file));
            
            for (const file of imageFiles) {
              try {
                const stats = fs.statSync(file);
                const createdTime = stats.birthtime || stats.mtime;
                const expiresAt = new Date(createdTime.getTime() + 24 * 60 * 60 * 1000);
                
                if (now > expiresAt) {
                  this.deleteFile(file);
                  deletedCount++;
                }
              } catch (error) {
                console.error(`ファイル情報の取得に失敗しました: ${file}`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('ファイルクリーンアップ中にエラーが発生しました:', error);
    }
    
    return deletedCount;
  }

  /**
   * クリーンアップジョブをスケジュール
   * @param intervalHours クリーンアップの間隔（時間単位、デフォルト3時間）
   */
  public scheduleCleanupJob(intervalHours: number = 3): void {
    // 最初のクリーンアップ実行
    this.cleanupExpiredFiles();
    
    // 定期的なクリーンアップをスケジュール
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, intervalHours * 60 * 60 * 1000);
  }
}