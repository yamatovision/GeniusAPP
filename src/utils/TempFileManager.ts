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
   */
  private generateTempFilePath(type: 'text' | 'image', extension: string = ''): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/T/, '_')
      .substring(0, 15);
    
    const randomStr = crypto.randomBytes(3).toString('hex');
    
    if (type === 'text') {
      return path.join(this.basePath, `shared_${timestamp}_${randomStr}.txt`);
    } else {
      return path.join(this.imagePath, `image_${timestamp}_${randomStr}.${extension}`);
    }
  }

  /**
   * テキストファイルを保存
   * @param content テキスト内容
   * @param options 保存オプション
   */
  public async saveTextFile(content: string, options?: FileSaveOptions): Promise<SharedFile> {
    const filePath = this.generateTempFilePath('text');
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
    
    // ファイル情報を作成
    const fileInfo: SharedFile = {
      id: path.basename(filePath, '.txt'),
      fileName: path.basename(filePath),
      originalName: options?.title || 'shared_text.txt',
      title: options?.title,
      type: 'text',
      size: Buffer.from(content).length,
      format: 'text/plain',
      createdAt: now,
      expiresAt: expiresAt,
      path: filePath,
      accessCount: 0,
      isExpired: false,
      metadata: {}
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
    const filePath = this.generateTempFilePath('image', format);
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
    
    // ファイル情報を作成
    const fileInfo: SharedFile = {
      id: path.basename(filePath).split('.')[0],
      fileName: path.basename(filePath),
      originalName: options?.title || `image.${format}`,
      title: options?.title,
      type: 'image',
      size: content.length,
      format: `image/${format}`,
      createdAt: now,
      expiresAt: expiresAt,
      path: filePath,
      accessCount: 0,
      isExpired: false,
      metadata: {}
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