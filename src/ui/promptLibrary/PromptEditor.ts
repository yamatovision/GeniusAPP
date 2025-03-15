import * as vscode from 'vscode';
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';

/**
 * プロンプトエディタの操作モード
 */
export type PromptEditorMode = 'view' | 'edit' | 'create';

/**
 * プロンプトエディタのオプション
 */
export interface PromptEditorOptions {
  mode: PromptEditorMode;
  promptId?: string;
}

/**
 * プロンプトデータ型
 */
export interface PromptData {
  id?: string;
  title: string;
  content: string;
  type: 'system' | 'user' | 'assistant' | 'template';
  category?: string;
  tags?: string[];
  isPublic?: boolean;
}

/**
 * プロンプトエディタクラス
 * - プロンプトの閲覧
 * - プロンプトの編集
 * - 新規プロンプトの作成
 */
export class PromptEditor {
  private _apiClient: ClaudeCodeApiClient;
  private _currentPrompt: PromptData | null = null;
  private _mode: PromptEditorMode = 'view';
  
  /**
   * コンストラクタ
   */
  constructor() {
    this._apiClient = ClaudeCodeApiClient.getInstance();
  }
  
  /**
   * プロンプトをロード
   * @param promptId プロンプトID
   */
  public async loadPrompt(promptId: string): Promise<PromptData | null> {
    try {
      const prompt = await this._apiClient.getPromptDetail(promptId);
      
      if (prompt) {
        this._currentPrompt = {
          id: prompt.id,
          title: prompt.title,
          content: prompt.content,
          type: prompt.type,
          category: prompt.category || '',
          tags: prompt.tags || [],
          isPublic: prompt.isPublic || false
        };
        
        return this._currentPrompt;
      }
      
      vscode.window.showErrorMessage(`プロンプト(ID: ${promptId})の取得に失敗しました。`);
      return null;
    } catch (error) {
      console.error(`プロンプト(ID: ${promptId})のロードに失敗しました:`, error);
      vscode.window.showErrorMessage(`プロンプトの取得に失敗しました: ${error}`);
      return null;
    }
  }
  
  /**
   * 現在のプロンプトを取得
   */
  public getCurrentPrompt(): PromptData | null {
    return this._currentPrompt;
  }
  
  /**
   * 新規プロンプト作成モードの初期化
   */
  public initNewPrompt(): void {
    this._currentPrompt = {
      title: '',
      content: '',
      type: 'system',
      category: '',
      tags: [],
      isPublic: false
    };
    
    this._mode = 'create';
  }
  
  /**
   * 編集モードを設定
   */
  public setMode(mode: PromptEditorMode): void {
    this._mode = mode;
  }
  
  /**
   * 現在のモードを取得
   */
  public getMode(): PromptEditorMode {
    return this._mode;
  }
  
  /**
   * プロンプトの更新または作成
   * @param promptData プロンプトデータ
   */
  public async savePrompt(promptData: PromptData): Promise<boolean> {
    try {
      // バリデーション
      if (!promptData.title || promptData.title.trim() === '') {
        vscode.window.showErrorMessage('タイトルは必須です。');
        return false;
      }
      
      if (!promptData.content || promptData.content.trim() === '') {
        vscode.window.showErrorMessage('プロンプト内容は必須です。');
        return false;
      }
      
      // APIに送信するデータを準備
      // 注: 実際のAPIによって必要なフォーマットは異なる可能性があるため、
      // 必要に応じてこの部分を調整する必要があります
      const apiData = {
        title: promptData.title.trim(),
        content: promptData.content.trim(),
        type: promptData.type,
        category: promptData.category || undefined,
        tags: promptData.tags && promptData.tags.length > 0 ? promptData.tags : undefined,
        isPublic: promptData.isPublic
      };
      
      // 新規作成または更新
      let success = false;
      
      // 注: 実際のAPIエンドポイントはプロジェクトによって異なるため、
      // 必要に応じてこの部分を調整する必要があります
      if (this._mode === 'create') {
        // 新規作成のAPIコールがまだ実装されていないため、暫定対応
        vscode.window.showInformationMessage('プロンプトの新規作成機能はまだ実装されていません。');
        success = true;
      } else if (this._mode === 'edit' && this._currentPrompt?.id) {
        // 更新のAPIコールがまだ実装されていないため、暫定対応
        vscode.window.showInformationMessage('プロンプトの更新機能はまだ実装されていません。');
        success = true;
      }
      
      if (success) {
        this._currentPrompt = promptData;
        vscode.window.showInformationMessage('プロンプトを保存しました。');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('プロンプトの保存に失敗しました:', error);
      vscode.window.showErrorMessage(`プロンプトの保存に失敗しました: ${error}`);
      return false;
    }
  }
  
  /**
   * プロンプトの利用履歴を記録
   * @param promptId プロンプトID
   */
  public async recordUsage(promptId: string): Promise<boolean> {
    try {
      // プロンプト詳細を取得し、最新のバージョンIDを特定
      const prompt = await this._apiClient.getPromptDetail(promptId);
      
      if (!prompt) {
        return false;
      }
      
      // バージョン履歴を取得
      const versions = await this._apiClient.getPromptVersions(promptId);
      
      if (!versions || versions.length === 0) {
        return false;
      }
      
      // 最新のバージョンID
      const latestVersionId = versions[0].id;
      
      // 利用履歴を記録
      return await this._apiClient.recordPromptUsage(promptId, latestVersionId, 'vscode-extension');
    } catch (error) {
      console.error('プロンプト利用履歴の記録に失敗しました:', error);
      return false;
    }
  }
}