/**
 * ClaudeCode共有機能の型定義
 */

/**
 * 共有ファイルのデータモデル
 */
export interface SharedFile {
  id: string;               // 一意のID
  fileName: string;         // 生成されたファイル名
  originalName?: string;    // 元のファイル名（ユーザーが設定可能）
  title?: string;           // タイトル（ユーザーが設定可能）
  type: 'text' | 'image';   // ファイルタイプ
  size: number;             // ファイルサイズ（バイト）
  format: string;           // ファイル形式（テキストならプレーンテキスト、画像ならPNG/JPG等）
  createdAt: Date;          // 作成日時 
  expiresAt: Date;          // 有効期限
  path: string;             // ファイルパス
  accessCount: number;      // アクセス回数
  isExpired: boolean;       // 有効期限切れフラグ
  metadata: {               // 追加メタデータ（拡張性のため）
    [key: string]: any;
  }
}

/**
 * 共有履歴のデータモデル
 */
export interface SharingHistory {
  items: SharedFile[];      // 共有ファイルのリスト
  lastUpdated: Date;        // 最終更新日時
}

/**
 * 共有設定のデータモデル
 */
export interface SharingSettings {
  // 基本設定
  defaultExpirationHours: number;  // デフォルト有効期限（時間）
  maxHistoryItems: number;         // 履歴に保存する最大アイテム数
  
  // ファイル制限
  maxTextSize: number;             // テキスト最大サイズ（文字数）
  maxImageSize: number;            // 画像最大サイズ（バイト）
  allowedImageFormats: string[];   // 許可される画像形式
  
  // 詳細設定
  preserveHistoryBetweenSessions: boolean;  // セッション間で履歴を保持するか
  baseStoragePath: string;                  // 保存先ベースパス
}

/**
 * ファイル保存オプション
 */
export interface FileSaveOptions {
  type: 'text' | 'image';
  title?: string;
  format?: string;
  expirationHours?: number; // デフォルト24時間
}

/**
 * 共有イベントタイプ
 */
export enum SharingEventType {
  FILE_CREATED = 'file_created',
  FILE_ACCESSED = 'file_accessed',
  FILE_EXPIRED = 'file_expired',
  FILE_DELETED = 'file_deleted'
}

/**
 * 共有イベント
 */
export interface SharingEvent {
  type: SharingEventType;
  fileId: string;
  timestamp: Date;
  metadata?: any;
}