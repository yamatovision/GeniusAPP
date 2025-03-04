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
  userPreferences?: {
    theme?: 'light' | 'dark';
    codeStyle?: 'standard' | 'prettier' | 'eslint';
    tabSize?: number;
    language?: string;
    streamingEnabled?: boolean;
    markdownEnabled?: boolean;
    parallelToolExecution?: boolean;
  };
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
  updated?: number;
}

/**
 * 検索結果
 */
export interface SearchResult {
  filePath: string;
  relativePath: string;
  content?: string;
  matchType?: 'filename' | 'content';
  error?: string;
  errorType?: string;
  suggestions?: string[];
  retryOptions?: RetryOptions;
}

export interface RetryOptions {
  canRetry: boolean;
  correctArgs?: any;
}

/**
 * ファイル操作結果
 */
export interface FileOperationResult {
  success: boolean;
  filePath: string;
  error?: string;
  errorType?: string;
  suggestions?: string[];
}

/**
 * バッチファイル操作
 */
export interface BatchFileOperation {
  file_path: string;
  operations: {
    old_string: string;
    new_string: string;
  }[];
}

/**
 * バッチファイル操作結果
 */
export interface BatchOperationResult {
  overall_success: boolean;
  results: {
    file_path: string;
    success: boolean;
    operations_completed: number;
    operations_total: number;
    error?: string;
  }[];
  summary: string;
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
    tool_use?: {
      id: string;
      name: string;
      input: any;
    };
    tool_result?: {
      tool_use_id: string;
      content: string;
    };
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
 * ストリーミングコールバック関数
 */
export type StreamCallback = (chunk: string) => void;

/**
 * ツール使用結果
 */
export interface ToolUseResult {
  toolName: string;
  args: any;
  result: any;
  error?: string;
  errorType?: 'validation' | 'execution' | 'timeout' | 'permission' | 'notFound' | 'unknown' | 'syntax' | 'network' | 'conflict' | 'limit' | 'unsupported' | 'format' | 'security' | 'api' | 'compatibility';
  suggestions?: string[];
  retryOptions?: RetryOptions;
  duration?: number;
}