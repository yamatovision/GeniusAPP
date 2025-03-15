import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SecureStorageManager - 機密データを安全に保存するためのユーティリティクラス
 * 
 * VSCode Secrets APIでカバーできない追加の安全なストレージニーズに対応するために使用します。
 * - 大きなデータオブジェクトの保存
 * - バックアップと復元機能
 * - 複雑なデータ構造の保存
 * - 特定の環境変数でデータを暗号化
 */
export class SecureStorageManager {
  private static instance: SecureStorageManager;
  private context: vscode.ExtensionContext;
  private encryptionKey: Buffer | null = null;
  private storagePath: string;
  
  private readonly STORAGE_FILE_NAME = 'appgenius-secure-data.enc';
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly KEY_ENV_VAR = 'APPGENIUS_STORAGE_KEY';

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.storagePath = path.join(os.homedir(), '.appgenius');
    this._initialize();
  }

  /**
   * SecureStorageManagerのシングルトンインスタンスを取得
   */
  public static getInstance(context?: vscode.ExtensionContext): SecureStorageManager {
    if (!SecureStorageManager.instance) {
      if (!context) {
        throw new Error('SecureStorageManagerの初期化時にはExtensionContextが必要です');
      }
      SecureStorageManager.instance = new SecureStorageManager(context);
    }
    return SecureStorageManager.instance;
  }

  /**
   * ストレージマネージャーの初期化
   */
  private _initialize(): void {
    // ストレージディレクトリの作成
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    // 暗号化キーの初期化
    this._initializeEncryptionKey();
  }

  /**
   * 暗号化キーの初期化
   */
  private _initializeEncryptionKey(): void {
    // 環境変数から暗号化キーを取得
    const envKey = process.env[this.KEY_ENV_VAR];
    
    if (envKey) {
      // 環境変数から取得したキーを使用
      this.encryptionKey = Buffer.from(envKey, 'hex');
    } else {
      // 安全なランダムキーを生成（初回のみ）
      const keyFile = path.join(this.storagePath, '.key');
      
      if (fs.existsSync(keyFile)) {
        // 既存のキーを読み込み
        this.encryptionKey = Buffer.from(fs.readFileSync(keyFile, 'utf8'), 'hex');
      } else {
        // 新しいキーを生成
        this.encryptionKey = crypto.randomBytes(32); // 256ビットキー
        fs.writeFileSync(keyFile, this.encryptionKey.toString('hex'), { mode: 0o600 });
      }
    }
  }

  /**
   * データの保存
   * @param key 保存するデータのキー
   * @param value 保存する値
   */
  public async saveData(key: string, value: any): Promise<void> {
    try {
      // 既存のデータを読み込み
      let data = await this._loadEncryptedData() || {};
      
      // データを更新
      data[key] = value;
      
      // 暗号化して保存
      await this._saveEncryptedData(data);
    } catch (error) {
      console.error('データ保存中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * データの取得
   * @param key 取得するデータのキー
   * @returns 保存された値、または未設定の場合はundefined
   */
  public async getData(key: string): Promise<any> {
    try {
      // 暗号化されたデータを読み込み
      const data = await this._loadEncryptedData() || {};
      return data[key];
    } catch (error) {
      console.error('データ取得中にエラーが発生しました:', error);
      return undefined;
    }
  }

  /**
   * データの削除
   * @param key 削除するデータのキー
   */
  public async deleteData(key: string): Promise<void> {
    try {
      // 既存のデータを読み込み
      const data = await this._loadEncryptedData() || {};
      
      // キーが存在する場合は削除
      if (data[key] !== undefined) {
        delete data[key];
        await this._saveEncryptedData(data);
      }
    } catch (error) {
      console.error('データ削除中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * すべてのデータをクリア
   */
  public async clearAllData(): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, this.STORAGE_FILE_NAME);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('データクリア中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * 暗号化されたデータを保存
   */
  private async _saveEncryptedData(data: any): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('暗号化キーが初期化されていません');
    }
    
    // データをJSON文字列に変換
    const jsonData = JSON.stringify(data);
    
    // 初期化ベクトルを生成
    const iv = crypto.randomBytes(16);
    
    // データを暗号化
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 認証タグを取得
    const authTag = cipher.getAuthTag();
    
    // 暗号化されたデータ、IV、認証タグを保存
    const encryptedData = {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
    
    // ファイルに保存
    const filePath = path.join(this.storagePath, this.STORAGE_FILE_NAME);
    fs.writeFileSync(filePath, JSON.stringify(encryptedData), { mode: 0o600 });
  }

  /**
   * 暗号化されたデータを読み込み
   */
  private async _loadEncryptedData(): Promise<any> {
    if (!this.encryptionKey) {
      throw new Error('暗号化キーが初期化されていません');
    }
    
    const filePath = path.join(this.storagePath, this.STORAGE_FILE_NAME);
    
    // ファイルが存在しない場合は空のオブジェクトを返す
    if (!fs.existsSync(filePath)) {
      return {};
    }
    
    // 暗号化されたデータを読み込み
    const encryptedJson = fs.readFileSync(filePath, 'utf8');
    const encryptedData = JSON.parse(encryptedJson);
    
    // 初期化ベクトルと認証タグを取得
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    // データを復号
    const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // JSON文字列をオブジェクトに変換
    return JSON.parse(decrypted);
  }

  /**
   * データバックアップの作成
   * @param backupPath バックアップファイルのパス
   */
  public async createBackup(backupPath: string): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, this.STORAGE_FILE_NAME);
      if (fs.existsSync(filePath)) {
        // ファイルをバックアップ先にコピー
        fs.copyFileSync(filePath, backupPath);
      }
    } catch (error) {
      console.error('バックアップ作成中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * バックアップからの復元
   * @param backupPath バックアップファイルのパス
   */
  public async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error('バックアップファイルが見つかりません');
      }
      
      const filePath = path.join(this.storagePath, this.STORAGE_FILE_NAME);
      
      // バックアップからファイルを復元
      fs.copyFileSync(backupPath, filePath);
    } catch (error) {
      console.error('バックアップ復元中にエラーが発生しました:', error);
      throw error;
    }
  }
}