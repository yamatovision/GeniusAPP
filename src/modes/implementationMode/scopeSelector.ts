import * as vscode from 'vscode';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';

/**
 * 実装項目の型定義
 */
export interface ImplementationItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  complexity: 'high' | 'medium' | 'low';
  isSelected: boolean;
  dependencies: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  progress: number; // 0-100 の進捗率
  notes?: string; // 実装メモ
}

/**
 * スコープの型定義
 */
export interface ImplementationScope {
  items: ImplementationItem[];
  selectedIds: string[];
  estimatedTime: string;
  totalProgress: number; // 全体の進捗率
  startDate?: string; // プロジェクト開始日
  targetDate?: string; // 目標完了日
}

/**
 * スコープ選択クラス
 */
export class ScopeSelector {
  private _aiService: AIService;
  private _requirementsDocument: string = '';
  private _items: ImplementationItem[] = [];
  private _selectedIds: string[] = [];

  constructor(aiService: AIService) {
    this._aiService = aiService;
  }

  /**
   * 要件定義書を設定
   */
  public setRequirementsDocument(document: string): void {
    this._requirementsDocument = document;
    Logger.info('要件定義書を設定しました');
  }

  /**
   * 要件定義書から実装項目を抽出
   */
  public async extractImplementationItems(): Promise<ImplementationItem[]> {
    try {
      if (!this._requirementsDocument) {
        throw new Error('要件定義書が設定されていません');
      }

      Logger.info('要件定義書から実装項目を抽出します');

      // AIに要件定義書から実装項目を抽出させる
      const prompt = `以下の要件定義書から実装項目を抽出し、ID、タイトル、説明、優先度、複雑度、依存関係を付けてJSONフォーマットで返してください。
JSONの形式は以下のようにしてください:
\`\`\`json
[
  {
    "id": "ITEM-001",
    "title": "ユーザー登録機能",
    "description": "新規ユーザーを登録できる機能。氏名、メールアドレス、パスワードを入力する。",
    "priority": "high", // high, medium, lowのいずれか
    "complexity": "medium", // high, medium, lowのいずれか
    "dependencies": [] // 依存する他の項目のIDの配列
  },
  ...
]
\`\`\`

要件定義書:
${this._requirementsDocument}`;
      
      const response = await this._aiService.sendMessage(prompt, 'implementation');
      
      // レスポンスからJSON部分を抽出
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('AIからの応答をパースできませんでした');
      }
      
      const items = JSON.parse(jsonMatch[1]) as ImplementationItem[];
      
      // 進捗管理用のプロパティを追加
      this._items = items.map(item => ({
        ...item,
        isSelected: false,
        status: 'pending',
        progress: 0,
        notes: ''
      }));
      
      Logger.info(`${this._items.length}件の実装項目を抽出しました`);
      return this._items;
    } catch (error) {
      Logger.error('実装項目の抽出に失敗しました', error as Error);
      throw error;
    }
  }

  /**
   * 項目の選択状態を更新
   */
  public toggleItemSelection(id: string): void {
    const item = this._items.find(item => item.id === id);
    if (item) {
      item.isSelected = !item.isSelected;
      
      if (item.isSelected) {
        this._selectedIds.push(id);
        // 新しく選択された項目はpending状態で初期化
        if (!item.status) {
          item.status = 'pending';
          item.progress = 0;
        }
      } else {
        this._selectedIds = this._selectedIds.filter(selectedId => selectedId !== id);
      }

      Logger.debug(`項目「${item.title}」の選択状態を変更: ${item.isSelected}`);
    }
  }
  
  /**
   * 実装項目のステータスを更新
   */
  public updateItemStatus(id: string, status: 'pending' | 'in-progress' | 'completed' | 'blocked'): void {
    const item = this._items.find(item => item.id === id);
    if (item) {
      item.status = status;
      
      // ステータスに応じて進捗率を自動調整
      if (status === 'completed') {
        item.progress = 100;
      } else if (status === 'pending' && item.progress === 0) {
        // 既に設定されている場合は変更しない
      } else if (status === 'in-progress' && item.progress === 0) {
        item.progress = 10; // 開始時は10%程度
      }
      
      Logger.debug(`項目「${item.title}」のステータスを更新: ${status}`);
    }
  }
  
  /**
   * 実装項目の進捗率を更新
   */
  public updateItemProgress(id: string, progress: number): void {
    const item = this._items.find(item => item.id === id);
    if (item) {
      item.progress = Math.max(0, Math.min(100, progress)); // 0-100の範囲に制限
      
      // 進捗率に応じてステータスを自動調整
      if (progress >= 100 && item.status !== 'completed') {
        item.status = 'completed';
      } else if (progress > 0 && progress < 100 && item.status === 'pending') {
        item.status = 'in-progress';
      }
      
      Logger.debug(`項目「${item.title}」の進捗率を更新: ${progress}%`);
    }
  }
  
  /**
   * 実装項目にメモを追加
   */
  public updateItemNotes(id: string, notes: string): void {
    const item = this._items.find(item => item.id === id);
    if (item) {
      item.notes = notes;
      Logger.debug(`項目「${item.title}」のメモを更新`);
    }
  }

  /**
   * 選択された項目の一覧を取得
   */
  public getSelectedItems(): ImplementationItem[] {
    return this._items.filter(item => item.isSelected);
  }

  /**
   * スコープの工数見積りを取得
   */
  public async estimateScope(): Promise<string> {
    try {
      const selectedItems = this.getSelectedItems();
      
      if (selectedItems.length === 0) {
        return '0時間';
      }
      
      Logger.info('スコープの工数見積りを計算します');
      
      const prompt = `以下の実装項目リストについて、工数見積り（時間）を算出してください。
各項目の複雑度も考慮してください。
返答では時間の見積りのみを端的に「XX時間」という形式で返してください。

実装項目:
${JSON.stringify(selectedItems, null, 2)}`;
      
      const response = await this._aiService.sendMessage(prompt, 'implementation');
      
      // 時間の部分を抽出 (例: "約20時間")
      const timeMatch = response.match(/(\d+[\-～]?\d*)\s*(時間|日|週間)/);
      const estimatedTime = timeMatch ? timeMatch[0] : '見積り不明';
      
      Logger.info(`工数見積り結果: ${estimatedTime}`);
      return estimatedTime;
    } catch (error) {
      Logger.error('工数見積りの取得に失敗しました', error as Error);
      return '見積りエラー';
    }
  }

  /**
   * 全体の進捗率を計算
   */
  public calculateTotalProgress(): number {
    const selectedItems = this.getSelectedItems();
    
    if (selectedItems.length === 0) {
      return 0;
    }
    
    // 各項目の進捗率の平均を計算
    const totalProgress = selectedItems.reduce((sum, item) => sum + (item.progress || 0), 0) / selectedItems.length;
    return Math.round(totalProgress);
  }

  /**
   * 現在のスコープを取得
   */
  public async getCurrentScope(): Promise<ImplementationScope> {
    const estimatedTime = await this.estimateScope();
    const totalProgress = this.calculateTotalProgress();
    
    // 開始日と目標日を設定（存在しない場合は現在の日付から自動生成）
    let startDate = undefined;
    let targetDate = undefined;
    
    // 既存のスコープから日付情報を取得
    try {
      const config = await vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', '');
      if (config) {
        const parsedConfig = JSON.parse(config as string);
        if (parsedConfig.startDate) {
          startDate = parsedConfig.startDate;
        }
        if (parsedConfig.targetDate) {
          targetDate = parsedConfig.targetDate;
        }
      }
    } catch (error) {
      // 設定の読み込みに失敗した場合は何もしない
      Logger.error('スコープ設定の読み込みに失敗しました', error as Error);
    }
    
    // 日付が設定されていない場合は自動生成
    if (!startDate) {
      startDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    }
    
    if (!targetDate) {
      // 推定時間から目標日を設定（単純に1日8時間で計算）
      const timeMatch = estimatedTime.match(/(\d+)(?:\-|\～)?(\d+)?/);
      let hours = 0;
      if (timeMatch) {
        if (timeMatch[2]) { // 範囲の場合は平均を取る
          hours = (parseInt(timeMatch[1]) + parseInt(timeMatch[2])) / 2;
        } else {
          hours = parseInt(timeMatch[1]);
        }
      }
      
      const days = Math.ceil(hours / 8);
      const targetDateObj = new Date();
      targetDateObj.setDate(targetDateObj.getDate() + days);
      targetDate = targetDateObj.toISOString().split('T')[0];
    }
    
    return {
      items: this._items,
      selectedIds: this._selectedIds,
      estimatedTime,
      totalProgress,
      startDate,
      targetDate
    };
  }

  /**
   * モックアップから必要なファイル一覧を取得
   */
  public async getRequiredFilesList(mockupHtml: string, framework: string = 'react'): Promise<string[]> {
    try {
      if (!mockupHtml) {
        throw new Error('モックアップHTMLが提供されていません');
      }

      Logger.info('モックアップからファイル一覧を抽出します');

      const prompt = `以下のモックアップHTMLから、実装に必要なファイル一覧を抽出してください。
フレームワークは${framework}を使用します。
返答はファイルパスのみの配列としてJSONフォーマットで返してください。

\`\`\`html
${mockupHtml}
\`\`\`

期待する出力形式:
\`\`\`json
["src/components/Login.jsx", "src/services/authService.js", ...]
\`\`\``;

      const response = await this._aiService.sendMessage(prompt, 'implementation');

      // レスポンスからJSON部分を抽出
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('AIからの応答をパースできませんでした');
      }

      const files = JSON.parse(jsonMatch[1]) as string[];
      Logger.info(`${files.length}個のファイルを抽出しました`);
      return files;
    } catch (error) {
      Logger.error('必要なファイル一覧の抽出に失敗しました', error as Error);
      throw error;
    }
  }

  /**
   * 選択されたアイテムに基づく実装計画を生成
   */
  public async generateImplementationPlan(): Promise<string> {
    try {
      const selectedItems = this.getSelectedItems();
      
      if (selectedItems.length === 0) {
        throw new Error('実装項目が選択されていません');
      }
      
      Logger.info('実装計画を生成します');
      
      const prompt = `以下の実装項目に基づいて、実装計画を生成してください。
計画には以下を含めてください:
1. タスクの分解
2. 実装順序
3. 各タスクの所要時間見積り
4. テスト計画
5. 考えられるリスクと対策

選択された実装項目:
${JSON.stringify(selectedItems, null, 2)}`;
      
      const response = await this._aiService.sendMessage(prompt, 'implementation');
      Logger.info('実装計画の生成が完了しました');
      
      return response;
    } catch (error) {
      Logger.error('実装計画の生成に失敗しました', error as Error);
      throw error;
    }
  }
}