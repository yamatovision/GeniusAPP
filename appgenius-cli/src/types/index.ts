/**
 * 共通の型定義
 */

/**
 * アプリケーション設定
 */
export interface AppConfig {
  apiKey: string;
  projectRoot: string;
  logLevel: LogLevel;
  tempDir?: string;
}

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * スコープデータ（VSCodeからの入力で使用）
 */
export interface ScopeData {
  id: string;
  projectPath: string;
  name: string;
  description: string;
  requirements?: string[];
  selectedItems?: Array<{
    id?: string;
    title?: string;
  }>;
}

/**
 * 検索結果
 */
export interface SearchResult {
  filePath: string;
  relativePath: string;
  content?: string;
  matchType?: 'filename' | 'content';
}

/**
 * ファイル操作結果
 */
export interface FileOperationResult {
  success: boolean;
  filePath: string;
  error?: string;
}

/**
 * 進捗データ
 */
export interface ProgressData {
  scopeId: string;
  status: 'started' | 'in-progress' | 'completed' | 'failed';
  completed: number;
  total: number;
  currentTask?: string;
  error?: string;
}

/**
 * Claude API のレスポンス型
 */
export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
  model: string;
  stopReason: string;
  stopSequence: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * ツールインターフェース
 */
export interface Tool {
  name: string;
  description: string;
  execute(args: any): Promise<any>;
}

/**
 * AIメッセージ
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * ツール使用結果
 */
export interface ToolUseResult {
  toolName: string;
  args: any;
  result: any;
  error?: string;
}