import * as vscode from 'vscode';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { MarkdownManager } from '../../utils/MarkdownManager';
import { ScopeItemStatus, IImplementationItem, IImplementationScope } from '../../types';

/**
 * スコープの型定義（互換性維持のため）
 */
export interface ImplementationScope {
  id?: string | null; // スコープID（CLI連携用）
  items: IImplementationItem[];
  selectedIds: string[];
  estimatedTime: string;
  totalProgress: number; // 全体の進捗率
  startDate?: string; // プロジェクト開始日
  targetDate?: string; // 目標完了日
  projectPath?: string; // プロジェクトパス
}

// 既存のコードとの互換性のため
export type ImplementationItem = IImplementationItem;

/**
 * スコープ選択クラス
 */
export class ScopeSelector {
  private _aiService: AIService;
  private _requirementsDocument: string = '';
  private _items: IImplementationItem[] = [];
  private _selectedIds: string[] = [];
  private _markdownManager: MarkdownManager;
  private _projectPath: string = '';
  private _currentScopeId: string | null = null;

  constructor(aiService: AIService) {
    this._aiService = aiService;
    this._markdownManager = MarkdownManager.getInstance();
  }

  /**
   * プロジェクトパスを設定
   */
  public setProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    Logger.info(`プロジェクトパスを設定しました: ${projectPath}`);
  }
  
  /**
   * 現在のプロジェクトパスを取得
   */
  public getProjectPath(): string {
    return this._projectPath;
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
  public async extractImplementationItems(): Promise<IImplementationItem[]> {
    try {
      if (!this._requirementsDocument) {
        throw new Error('要件定義書が設定されていません');
      }

      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }

      Logger.info('要件定義書から実装項目を抽出します');

      // 要件定義からスコープを作成
      const scopeId = await this._markdownManager.createScopeFromRequirements(
        this._projectPath,
        this._requirementsDocument,
        this._aiService
      );

      if (!scopeId) {
        throw new Error('スコープの作成に失敗しました');
      }

      // 読み込み前に少し待機（ファイル操作のタイミングの問題を軽減）
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 作成されたスコープを読み込む
      const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, scopeId);
      
      if (!scope) {
        // ファイルシステムを調べるための追加ログ
        Logger.debug(`スコープ ${scopeId} の読み込みを再試行します`);
        
        // 再試行
        await new Promise(resolve => setTimeout(resolve, 3000));
        const retryScope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, scopeId);
        
        if (!retryScope) {
          throw new Error('作成されたスコープの読み込みに失敗しました');
        }
        
        // 再試行で成功した場合はそれを使用
        this._currentScopeId = scopeId;
        this._items = retryScope.items;
        this._selectedIds = retryScope.selectedIds;
      } else {
        // 現在のスコープIDを保存
        this._currentScopeId = scopeId;
        
        // アイテムとIDを更新
        this._items = scope.items;
        this._selectedIds = scope.selectedIds;
      }

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
    if (!this._projectPath || !this._currentScopeId) {
      Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
      return;
    }

    const item = this._items.find(item => item.id === id);
    if (!item) {
      Logger.error(`項目が見つかりません: ${id}`);
      return;
    }

    const isSelected = !item.isSelected;
    
    // アイテム選択状態を更新
    const result = this._markdownManager.toggleScopeItemSelection(
      this._projectPath,
      this._currentScopeId,
      id,
      isSelected
    );

    if (result) {
      // 成功したら内部状態も更新
      item.isSelected = isSelected;
      
      if (isSelected) {
        this._selectedIds.push(id);
        
        // 新しく選択された項目はpending状態で初期化
        if (!item.status) {
          item.status = ScopeItemStatus.PENDING;
          item.progress = 0;
        }
      } else {
        this._selectedIds = this._selectedIds.filter(selectedId => selectedId !== id);
      }

      Logger.debug(`項目「${item.title}」の選択状態を変更: ${item.isSelected}`);
    } else {
      Logger.error(`項目「${item.title}」の選択状態の更新に失敗しました`);
    }
  }
  
  /**
   * 実装項目のステータスを更新
   */
  public updateItemStatus(id: string, status: ScopeItemStatus): void {
    if (!this._projectPath || !this._currentScopeId) {
      Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
      return;
    }

    const item = this._items.find(item => item.id === id);
    if (!item) {
      Logger.error(`項目が見つかりません: ${id}`);
      return;
    }

    // ステータスを更新
    const result = this._markdownManager.updateScopeItemStatus(
      this._projectPath,
      this._currentScopeId,
      id,
      status
    );

    if (result) {
      // 成功したら内部状態も更新
      item.status = status;
      
      // ステータスに応じて進捗率を自動調整
      if (status === ScopeItemStatus.COMPLETED) {
        item.progress = 100;
      } else if (status === ScopeItemStatus.PENDING && item.progress === 0) {
        // 既に設定されている場合は変更しない
      } else if (status === ScopeItemStatus.IN_PROGRESS && item.progress === 0) {
        item.progress = 10; // 開始時は10%程度
      }
      
      // スコープを再読み込み
      this.reloadCurrentScope();
      
      Logger.debug(`項目「${item.title}」のステータスを更新: ${status}`);
    } else {
      Logger.error(`項目「${item.title}」のステータス更新に失敗しました`);
    }
  }
  
  /**
   * 実装項目の進捗率を更新
   */
  public updateItemProgress(id: string, progress: number): void {
    if (!this._projectPath || !this._currentScopeId) {
      Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
      return;
    }

    const item = this._items.find(item => item.id === id);
    if (!item) {
      Logger.error(`項目が見つかりません: ${id}`);
      return;
    }

    // 進捗率に応じてステータスを自動調整
    let status = item.status || ScopeItemStatus.PENDING;
    
    if (progress >= 100) {
      status = ScopeItemStatus.COMPLETED;
    } else if (progress > 0 && progress < 100 && status === ScopeItemStatus.PENDING) {
      status = ScopeItemStatus.IN_PROGRESS;
    }

    // ステータスを更新（進捗率も同時に更新される）
    const result = this._markdownManager.updateScopeItemStatus(
      this._projectPath,
      this._currentScopeId,
      id,
      status,
      progress
    );

    if (result) {
      // 成功したら内部状態も更新
      item.progress = Math.max(0, Math.min(100, progress)); // 0-100の範囲に制限
      item.status = status;
      
      // スコープを再読み込み
      this.reloadCurrentScope();
      
      Logger.debug(`項目「${item.title}」の進捗率を更新: ${progress}%`);
    } else {
      Logger.error(`項目「${item.title}」の進捗率更新に失敗しました`);
    }
  }
  
  /**
   * 実装項目にメモを追加
   */
  public updateItemNotes(id: string, notes: string): void {
    if (!this._projectPath || !this._currentScopeId) {
      Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
      return;
    }

    const item = this._items.find(item => item.id === id);
    if (!item) {
      Logger.error(`項目が見つかりません: ${id}`);
      return;
    }

    // メモを更新
    const result = this._markdownManager.updateScopeItemNotes(
      this._projectPath,
      this._currentScopeId,
      id,
      notes
    );

    if (result) {
      // 成功したら内部状態も更新
      item.notes = notes;
      Logger.debug(`項目「${item.title}」のメモを更新`);
    } else {
      Logger.error(`項目「${item.title}」のメモ更新に失敗しました`);
    }
  }

  /**
   * 選択された項目の一覧を取得
   */
  public getSelectedItems(): IImplementationItem[] {
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
      
      // 現在のスコープが存在する場合、推定時間を更新
      if (this._projectPath && this._currentScopeId) {
        const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
        
        if (scope) {
          scope.estimatedTime = estimatedTime;
          this._markdownManager.saveScopeToClaudeMd(this._projectPath, scope);
        }
      }
      
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
    // 現在のスコープがすでにCLAUDE.mdに保存されている場合はそれを読み込む
    if (this._projectPath && this._currentScopeId) {
      const savedScope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
      
      if (savedScope) {
        // 内部状態を更新
        this._items = savedScope.items;
        this._selectedIds = savedScope.selectedIds;
        
        return {
          id: savedScope.id,
          items: savedScope.items,
          selectedIds: savedScope.selectedIds,
          estimatedTime: savedScope.estimatedTime,
          totalProgress: savedScope.totalProgress,
          startDate: savedScope.startDate,
          targetDate: savedScope.targetDate,
          projectPath: this._projectPath
        };
      }
    }
    
    // 保存されたスコープがない場合は従来の方法で生成
    const estimatedTime = await this.estimateScope();
    const totalProgress = this.calculateTotalProgress();
    
    // 開始日と目標日を設定（存在しない場合は現在の日付から自動生成）
    let startDate = undefined;
    let targetDate = undefined;
    
    // 既存のスコープから日付情報を取得
    try {
      const config = await vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', {});
      if (config) {
        // 文字列の場合はJSONとしてパース、オブジェクトの場合はそのまま使用
        const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
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
    
    // 現在のスコープが存在しない場合は新規作成
    if (this._projectPath && !this._currentScopeId && this._items.length > 0) {
      // スコープを作成
      const scopeData: IImplementationScope = {
        id: `scope-${Date.now()}`,
        name: `スコープ ${new Date().toISOString().split('T')[0]}`,
        description: '手動作成されたスコープ',
        items: this._items,
        selectedIds: this._selectedIds,
        estimatedTime,
        totalProgress,
        startDate,
        targetDate,
        projectPath: this._projectPath
      };
      
      // CLAUDE.mdに保存
      if (this._markdownManager.saveScopeToClaudeMd(this._projectPath, scopeData)) {
        this._currentScopeId = scopeData.id;
        Logger.info(`新規スコープをCLAUDE.mdに保存しました: ${scopeData.id}`);
      }
    }
    
    return {
      id: this._currentScopeId || null,
      items: this._items,
      selectedIds: this._selectedIds,
      estimatedTime,
      totalProgress,
      startDate,
      targetDate,
      projectPath: this._projectPath
    };
  }

  /**
   * 現在のスコープを再読み込み
   */
  private reloadCurrentScope(): void {
    if (!this._projectPath || !this._currentScopeId) {
      return;
    }
    
    const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
    
    if (scope) {
      this._items = scope.items;
      this._selectedIds = scope.selectedIds;
    }
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
      
      // 現在のスコープの選択済みアイテムに関連ファイルを追加
      if (this._projectPath && this._currentScopeId) {
        const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
        
        if (scope) {
          let modified = false;
          
          // 選択されている項目に関連ファイルを追加
          for (const item of scope.items) {
            if (scope.selectedIds.includes(item.id)) {
              if (!item.relatedFiles) {
                item.relatedFiles = [];
              }
              
              // 新しいファイルのみ追加
              for (const file of files) {
                if (!item.relatedFiles.includes(file)) {
                  item.relatedFiles.push(file);
                  modified = true;
                }
              }
            }
          }
          
          // 変更があればスコープを保存
          if (modified) {
            this._markdownManager.saveScopeToClaudeMd(this._projectPath, scope);
            // 内部状態を更新
            this._items = scope.items;
          }
        }
      }
      
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
      
      // 生成された計画をスコープのノートに保存
      if (this._projectPath && this._currentScopeId) {
        const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
        
        if (scope) {
          // 選択されている最初の項目のメモに計画を保存
          const firstSelected = scope.items.find(item => scope.selectedIds.includes(item.id));
          
          if (firstSelected) {
            firstSelected.notes = `## 実装計画\n\n${response}`;
            this._markdownManager.saveScopeToClaudeMd(this._projectPath, scope);
            
            // 内部状態を更新
            this._items = scope.items;
          }
        }
      }
      
      Logger.info('実装計画の生成が完了しました');
      return response;
    } catch (error) {
      Logger.error('実装計画の生成に失敗しました', error as Error);
      throw error;
    }
  }
  
  /**
   * CLAUDE.mdに保存を完了し、ClaudeCodeに通知
   */
  public async completeSelection(): Promise<boolean> {
    // 現在のスコープを取得
    const scope = await this.getCurrentScope();
    
    if (!this._projectPath || !this._currentScopeId) {
      Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
      return false;
    }
    
    try {
      // スコープに完了通知
      this._markdownManager.notifyClaudeCodeOfScopeUpdate(this._projectPath, this._currentScopeId);
      return true;
    } catch (error) {
      Logger.error('スコープ選択の完了通知に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * VSCode設定からスコープをインポート
   */
  public async importFromVSCodeSettings(): Promise<boolean> {
    if (!this._projectPath) {
      Logger.error('プロジェクトパスが設定されていません');
      return false;
    }
    
    try {
      const result = this._markdownManager.importScopeFromVSCodeSettings(this._projectPath);
      
      if (result) {
        // 現在のスコープを再読み込み
        const scopes = this._markdownManager.getScopesFromClaudeMd(this._projectPath);
        
        if (scopes.length > 0) {
          // 最後に追加されたスコープを使用
          const latestScope = scopes[scopes.length - 1];
          this._currentScopeId = latestScope.id;
          this._items = latestScope.items;
          this._selectedIds = latestScope.selectedIds;
          
          Logger.info(`VSCode設定からスコープをインポートしました: ${latestScope.id}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.error('VSCode設定からのスコープインポートに失敗しました', error as Error);
      return false;
    }
  }
}