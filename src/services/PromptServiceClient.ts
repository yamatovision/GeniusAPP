import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { Logger } from '../utils/logger';

/**
 * プロンプトサービスクライアント
 * 外部プロンプトURLからプロンプト内容を取得し、一時ファイルとして保存する機能を提供
 */
export class PromptServiceClient {
  private static instance: PromptServiceClient;
  private tempDir: string;

  // プロンプト情報マッピング
  private promptInfoMap = [
    { id: 0, name: "システムアーキテクチャー", icon: "architecture", category: "計画", description: "システム設計を支援します" },
    { id: 1, name: "プロジェクト分析アシスタント", icon: "psychology", category: "分析", description: "プロジェクト分析を行います" },
    { id: 2, name: "要件定義アドバイザー", icon: "description", category: "計画", description: "要件定義を支援します" },
    { id: 3, name: "スコープマネージャー", icon: "assignment_turned_in", category: "管理", description: "開発スコープを管理します" },
    { id: 4, name: "環境変数設定アシスタント", icon: "settings", category: "環境", description: "環境変数の設定を支援します" },
    { id: 5, name: "テスト生成アシスタント", icon: "science", category: "テスト", description: "テスト生成を支援します" },
    { id: 6, name: "モックアップアナライザー", icon: "web", category: "UI", description: "モックアップを分析します" },
    { id: 7, name: "スコープインプリメンター", icon: "build", category: "実装", description: "スコープ実装を支援します" },
    { id: 8, name: "デバック探偵", icon: "bug_report", category: "デバッグ", description: "エラーを分析し解決します" },
    { id: 9, name: "検証アシスタント", icon: "check_circle", category: "検証", description: "実装の検証を行います" }
  ];

  private constructor() {
    // 一時ディレクトリの作成
    this.tempDir = path.join(os.tmpdir(), 'appgenius-prompts');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

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
   * プロンプトURLから内容を取得して一時ファイルに保存
   * @param promptUrl プロンプトURL
   * @returns 一時ファイルのパス
   */
  public async fetchAndSavePrompt(promptUrl: string, promptIndex: number): Promise<string> {
    try {
      const response = await axios.get(promptUrl);
      
      if (response.status === 200 && response.data) {
        // プロンプト情報を取得
        const promptInfo = this.promptInfoMap[promptIndex] || {
          name: `プロンプト${promptIndex + 1}`,
          category: "その他"
        };
        
        // APIレスポンスの処理 - オブジェクトの場合は文字列化
        let responseContent = response.data;
        if (typeof responseContent === 'object') {
          try {
            // オブジェクトの場合はJSON形式で整形
            responseContent = JSON.stringify(responseContent, null, 2);
          } catch (err) {
            // 文字列化できない場合はその旨を記録
            Logger.warn('プロンプトデータのJSON形式への変換に失敗しました', err as Error);
            responseContent = '[プロンプトデータの解析に失敗しました]';
          }
        }
        
        // プロンプト内容をMarkdown形式でフォーマット
        const promptContent = `# ${promptInfo.name}\n\n${responseContent}\n\n---\nカテゴリ: ${promptInfo.category}\nURL: ${promptUrl}`;
        
        // タイムスタンプ付きのファイル名を生成
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const fileName = `prompt_${promptIndex + 1}_${timestamp}.md`;
        const filePath = path.join(this.tempDir, fileName);
        
        // ファイルに書き込み
        fs.writeFileSync(filePath, promptContent, 'utf8');
        
        return filePath;
      } else {
        throw new Error(`プロンプトの取得に失敗しました: ${response.status}`);
      }
    } catch (error) {
      Logger.error('プロンプトの取得中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * プロンプトURLのリストから情報を取得
   * @param promptUrls プロンプトURLの配列
   * @returns プロンプト情報の配列
   */
  public getPromptInfoList(): any[] {
    return this.promptInfoMap;
  }
}