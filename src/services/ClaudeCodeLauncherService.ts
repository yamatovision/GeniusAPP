import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { Logger } from '../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from './AppGeniusEventBus';
import { ImplementationScope } from './AppGeniusStateManager';
import { 
  ClaudeCodeExecutionStatus, 
  MockupAnalysisProcess,
  CoreLauncherService 
} from './launcher';

/**
 * ClaudeCodeプロセス管理サービス
 * VSCode拡張からClaudeCodeを起動し、実装スコープに基づいて開発を進める
 * 
 * 注: このクラスはリファクタリングされ、内部実装は ./launcher ディレクトリに移動されました。
 * このクラスは後方互換性のために維持されており、新しいコードはCorelauncherServiceを使用してください。
 */
export class ClaudeCodeLauncherService {
  private static instance: ClaudeCodeLauncherService;
  private coreLauncher: CoreLauncherService;
  private eventBus: AppGeniusEventBus;
  
  // 並列処理用の設定
  private readonly maxConcurrentProcesses: number = 3; // 最大同時実行数
  
  private constructor() {
    this.coreLauncher = CoreLauncherService.getInstance();
    this.eventBus = AppGeniusEventBus.getInstance();
    
    Logger.info('ClaudeCodeLauncherService (リファクタリング済み) initialized');
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ClaudeCodeLauncherService {
    if (!ClaudeCodeLauncherService.instance) {
      ClaudeCodeLauncherService.instance = new ClaudeCodeLauncherService();
    }
    return ClaudeCodeLauncherService.instance;
  }
  
  /**
   * スコープ情報を基にClaudeCodeを起動
   * @param scope スコープ情報（CLAUDE.md内のスコープIDでも対応可能）
   */
  public async launchClaudeCode(scope: ImplementationScope): Promise<boolean> {
    // 起動前にカウンターイベントを発行
    this.eventBus.emit(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      { scope },
      'ClaudeCodeLauncherService'
    );
    
    return this.coreLauncher.launchClaudeCode({ scope });
  }
  
  /**
   * モックアップを解析するためにClaudeCodeを起動
   * @param mockupFilePath モックアップHTMLファイルのパス
   * @param projectPath プロジェクトパス
   * @param options 追加オプション（ソース情報など）
   */
  public async launchClaudeCodeWithMockup(
    mockupFilePath: string, 
    projectPath: string, 
    options?: { source?: string }
  ): Promise<boolean> {
    // 起動前にカウンターイベントを発行
    this.eventBus.emit(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      { mockupFilePath, projectPath },
      'ClaudeCodeLauncherService'
    );
    
    return this.coreLauncher.launchClaudeCodeWithMockup({
      mockupFilePath,
      projectPath,
      source: options?.source
    });
  }
  
  /**
   * 指定したプロンプトファイルを使用してClaudeCodeを起動
   * @param projectPath プロジェクトパス
   * @param promptFilePath プロンプトファイルの絶対パス
   * @param options 追加オプション
   */
  public async launchClaudeCodeWithPrompt(
    projectPath: string,
    promptFilePath: string,
    options?: { 
      title?: string, 
      additionalParams?: string, 
      deletePromptFile?: boolean,
      splitTerminal?: boolean, // ターミナル分割パラメータ
      location?: vscode.ViewColumn,
      promptType?: string // プロンプトタイプ（要件定義、システムアーキテクチャなど）
    }
  ): Promise<boolean> {
    // 起動前にカウンターイベントを発行
    this.eventBus.emit(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      { projectPath, promptFilePath, splitTerminal: options?.splitTerminal },
      'ClaudeCodeLauncherService'
    );
    
    return this.coreLauncher.launchClaudeCodeWithPrompt({
      projectPath,
      promptFilePath,
      title: options?.title,
      additionalParams: options?.additionalParams,
      deletePromptFile: options?.deletePromptFile,
      location: options?.location,
      promptType: options?.promptType, // プロンプトタイプを渡す
      splitTerminal: options?.splitTerminal // ターミナル分割パラメータを渡す
    });
  }
  
  /**
   * ClaudeCodeが利用可能かチェック
   */
  public async isClaudeCodeAvailable(): Promise<boolean> {
    return this.coreLauncher.isClaudeCodeAvailable();
  }
  
  /**
   * 現在の実行状態を取得
   */
  public getStatus(): ClaudeCodeExecutionStatus {
    return this.coreLauncher.getStatus();
  }
  
  /**
   * ClaudeCodeの状態を強制リセット
   */
  public resetStatus(): void {
    this.coreLauncher.resetStatus();
  }
  
  /**
   * ClaudeCodeをインストール
   */
  public async installClaudeCode(): Promise<boolean> {
    return this.coreLauncher.installClaudeCode();
  }
  
  /**
   * 実行中のモックアップ解析プロセス一覧を取得
   */
  public getRunningMockupProcesses(): MockupAnalysisProcess[] {
    return this.coreLauncher.getRunningMockupProcesses();
  }
  
  /**
   * モックアップ解析プロセスの状態を取得
   */
  public getMockupProcessInfo(processId: string): MockupAnalysisProcess | undefined {
    return this.coreLauncher.getMockupProcessInfo(processId);
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this.coreLauncher.dispose();
  }
}