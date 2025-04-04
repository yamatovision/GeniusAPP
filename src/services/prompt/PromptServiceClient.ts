import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../../utils/logger';
import { ClaudeCodeLauncherService } from '../ClaudeCodeLauncherService';
import { ClaudeCodeIntegrationService } from '../ClaudeCodeIntegrationService';

/**
 * プロンプト情報インターフェース
 */
export interface IPrompt {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  url: string;
}

/**
 * プロンプトサービスクライアント
 * プロンプトURLの管理と取得を行う
 */
export class PromptServiceClient {
  private static instance: PromptServiceClient;
  private _tempDir: string;

  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): PromptServiceClient {
    if (!PromptServiceClient.instance) {
      PromptServiceClient.instance = new PromptServiceClient();
    }
    return PromptServiceClient.instance;
  }

  /**
   * コンストラクタ
   */
  private constructor() {
    this._tempDir = path.join(os.tmpdir(), 'appgenius-prompts');
    
    // 一時ディレクトリの作成
    if (!fs.existsSync(this._tempDir)) {
      fs.mkdirSync(this._tempDir, { recursive: true });
    }
  }

  /**
   * 定義済みプロンプト一覧
   */
  private readonly _prompts: IPrompt[] = [
    {
      id: "system-architecture",
      title: "システムアーキテクチャー",
      description: "システム設計と構造を分析",
      category: "設計",
      icon: "architecture",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec"
    },
    {
      id: "project-analysis",
      title: "プロジェクト分析アシスタント",
      description: "プロジェクト全体を分析",
      category: "分析",
      icon: "psychology",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6"
    },
    {
      id: "requirements-advisor",
      title: "要件定義アドバイザー",
      description: "要件の作成と改善をサポート",
      category: "計画",
      icon: "description",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39"
    },
    {
      id: "scope-manager",
      title: "スコープマネージャー",
      description: "実装スコープの管理と監視",
      category: "管理",
      icon: "visibility",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704"
    },
    {
      id: "env-assistant",
      title: "環境変数設定アシスタント",
      description: "環境設定の管理をサポート",
      category: "環境",
      icon: "settings",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589"
    },
    {
      id: "tester",
      title: "テスター",
      description: "コードテストを支援",
      category: "テスト",
      icon: "science",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed"
    },
    {
      id: "mockup-analyzer",
      title: "モックアップアナライザー",
      description: "UIモックアップを分析",
      category: "UI",
      icon: "web",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb"
    },
    {
      id: "scope-implementer",
      title: "スコープインプリメンター",
      description: "実装作業を支援",
      category: "実装",
      icon: "build",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a"
    },
    {
      id: "debug-detective",
      title: "デバッグ探偵",
      description: "エラー・バグの解決を支援",
      category: "デバッグ",
      icon: "bug_report",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09"
    },
    {
      id: "verification-assistant",
      title: "精査管",
      description: "コード品質の確認と改善",
      category: "検証",
      icon: "check_circle",
      url: "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/bbc6e76a5f448e02bea16918fa1dc9ad"
    }
  ];

  /**
   * 全プロンプトの取得
   */
  public getPrompts(): IPrompt[] {
    return this._prompts;
  }

  /**
   * ID指定でプロンプトを取得
   * @param id プロンプトID
   */
  public getPromptById(id: string): IPrompt | undefined {
    return this._prompts.find(p => p.id === id);
  }

  /**
   * カテゴリ指定でプロンプトを取得
   * @param category カテゴリ名
   */
  public getPromptsByCategory(category: string): IPrompt[] {
    return this._prompts.filter(p => p.category === category);
  }

  /**
   * URLからプロンプト内容を取得
   * @param url プロンプトURL
   */
  public async fetchPromptFromURL(url: string): Promise<string> {
    try {
      Logger.info(`プロンプトURLからコンテンツを取得: ${url}`);
      
      // APIからプロンプトを取得（実際の実装ではfetchを使用）
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`プロンプト取得エラー: ${response.status} ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      Logger.error(`プロンプト取得中にエラーが発生しました: ${url}`, error as Error);
      throw error;
    }
  }

  /**
   * URLから一時ファイルを作成
   * @param url プロンプトURL
   * @returns 一時ファイルのパス
   */
  public async createTempFileFromURL(url: string): Promise<string> {
    try {
      // 一時ファイル名の生成
      const timestamp = Date.now();
      const filename = `prompt_${timestamp}.md`;
      const tempFilePath = path.join(this._tempDir, filename);
      
      // プロンプト内容の取得
      const content = await this.fetchPromptFromURL(url);
      
      // ファイルへの書き込み
      fs.writeFileSync(tempFilePath, content, 'utf8');
      
      Logger.info(`プロンプトを一時ファイルに保存しました: ${tempFilePath}`);
      return tempFilePath;
    } catch (error) {
      Logger.error('一時ファイル作成中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * URLからClaudeCodeを起動
   * @param projectPath プロジェクトパス
   * @param promptUrl プロンプトURL
   */
  public async launchClaudeCodeFromURL(projectPath: string, promptUrl: string): Promise<void> {
    try {
      Logger.info(`プロンプトURLからClaudeCodeを起動: ${promptUrl}`);
      
      // 方法1: ClaudeCodeIntegrationServiceのlaunchWithPublicURLを使用
      const integrationService = ClaudeCodeIntegrationService.getInstance();
      
      await integrationService.launchWithPublicUrl(
        promptUrl,
        projectPath,
        '', // 追加コンテンツなし
        true // 分割表示を有効にする
      );
      
      vscode.window.showInformationMessage('ClaudeCodeを起動しました');
    } catch (error) {
      Logger.error('ClaudeCode起動中にエラーが発生しました', error as Error);
      
      // 方法2: 一時ファイルを作成してClaudeCodeLauncherServiceを使用（フォールバック）
      try {
        Logger.info('一時ファイル経由でClaudeCodeの起動を試みます');
        
        // 一時ファイルの作成
        const tempFile = await this.createTempFileFromURL(promptUrl);
        
        // ClaudeCodeの起動
        const launcherService = ClaudeCodeLauncherService.getInstance();
        await launcherService.launchClaudeCodeWithPrompt(projectPath, tempFile);
        
        vscode.window.showInformationMessage('ClaudeCodeを起動しました（一時ファイル経由）');
      } catch (fallbackError) {
        Logger.error('フォールバック起動にも失敗しました', fallbackError as Error);
        throw new Error(`ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      }
    }
  }

  /**
   * IDからClaudeCodeを起動
   * @param projectPath プロジェクトパス
   * @param promptId プロンプトID
   */
  public async launchClaudeCodeById(projectPath: string, promptId: string): Promise<void> {
    const prompt = this.getPromptById(promptId);
    if (!prompt) {
      throw new Error(`プロンプトID '${promptId}' が見つかりません`);
    }
    
    await this.launchClaudeCodeFromURL(projectPath, prompt.url);
  }
}