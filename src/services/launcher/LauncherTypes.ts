import * as vscode from 'vscode';
import { IImplementationScope as ImplementationScope } from '../../types';

/**
 * ClaudeCode実行状態
 */
export enum ClaudeCodeExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

/**
 * モックアップ解析プロセス情報
 */
export interface MockupAnalysisProcess {
  id: string;
  mockupName: string;
  mockupPath: string;
  projectPath: string;
  analysisFilePath: string;
  terminal: vscode.Terminal | null;
  status: ClaudeCodeExecutionStatus;
  startTime: number;
}

/**
 * ターミナル設定オプション（拡張可能）
 */
export interface TerminalOptions {
  title?: string;
  cwd?: string;
  additionalParams?: string;
  deletePromptFile?: boolean;
  location?: vscode.ViewColumn;
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined;
  promptType?: string; // プロンプトの種類（要件定義、リファクタリングなど）
  
  /**
   * アクティブなターミナルを分割してClaudeCodeを起動するかどうか
   * trueの場合、既存のアクティブなターミナルを分割して新しいターミナルを作成
   * falseの場合は通常通り新しいタブとしてターミナルを作成（デフォルト）
   */
  splitTerminal?: boolean;
}

/**
 * プロンプト実行オプション
 */
export interface PromptExecutionOptions extends TerminalOptions {
  promptFilePath: string;
  projectPath: string;
}

/**
 * スコープ実行オプション
 */
export interface ScopeExecutionOptions {
  scope: ImplementationScope;
}

/**
 * モックアップ解析オプション
 */
export interface MockupAnalysisOptions {
  mockupFilePath: string;
  projectPath: string;
  source?: string;
}