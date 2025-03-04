import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AIService } from '../../core/aiService';
import { FileManager } from '../../utils/fileManager';
import { Logger } from '../../utils/logger';

export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  status: RequirementStatus;
  createdAt: string;
  updatedAt: string;
  dependencies?: string[];
  tags?: string[];
  notes?: string;
}

export enum RequirementType {
  FUNCTIONAL = 'functional',
  NON_FUNCTIONAL = 'nonFunctional',
  UI = 'ui',
  DATA = 'data',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  OTHER = 'other'
}

export enum RequirementPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum RequirementStatus {
  PROPOSED = 'proposed',
  APPROVED = 'approved',
  IMPLEMENTED = 'implemented',
  TESTED = 'tested',
  DEPLOYED = 'deployed',
  REJECTED = 'rejected'
}

export class RequirementManager {
  private requirements: Map<string, Requirement> = new Map();
  private configPath: string;
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    
    // 要件保存用のファイルパスを設定 - ユーザーのホームディレクトリに保存
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const appDir = path.join(homeDir, '.appgenius-ai');
    
    // 現在のワークスペース名を取得
    const workspaceName = vscode.workspace.name || 'default';
    
    this.configPath = path.join(
      appDir,
      `${workspaceName}-requirements.json`
    );

    // 初期化時に既存の要件を読み込む
    this.loadRequirements();
  }

  /**
   * 要件をファイルから読み込む
   */
  private async loadRequirements(): Promise<void> {
    try {
      // ディレクトリが存在しない場合、または作成できない場合は一時ディレクトリを使用
      try {
        // 設定ディレクトリが存在するか確認
        const configDir = path.dirname(this.configPath);
        if (!await FileManager.directoryExists(configDir)) {
          await FileManager.createDirectory(configDir);
        }
      } catch (dirError) {
        Logger.info(`設定ディレクトリの作成に失敗しました。メモリ内で要件を管理します: ${(dirError as Error).message}`);
        // ディレクトリ作成に失敗した場合は、メモリ内で要件を管理
        this.requirements.clear();
        return;
      }

      // 設定ファイルが存在するか確認
      if (await FileManager.fileExists(this.configPath)) {
        const content = await FileManager.readFile(this.configPath);
        const data = JSON.parse(content);
        
        this.requirements.clear();
        for (const req of data.requirements) {
          this.requirements.set(req.id, req);
        }
        
        Logger.info(`${this.requirements.size}個の要件を読み込みました`);
      } else {
        // 初期ファイルを作成
        try {
          await this.saveRequirements();
          Logger.info('新しい要件ファイルを作成しました');
        } catch (fileError) {
          Logger.info(`要件ファイルの作成に失敗しました。メモリ内で要件を管理します: ${(fileError as Error).message}`);
        }
      }
    } catch (error) {
      Logger.error('要件の読み込みに失敗しました', error as Error);
      Logger.info('メモリ内で要件を管理します');
      // エラーは投げずに、メモリ内の空の要件リストで続行
      this.requirements.clear();
    }
  }

  /**
   * 要件をファイルに保存
   */
  private async saveRequirements(): Promise<void> {
    try {
      const data = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        requirements: Array.from(this.requirements.values())
      };
      
      await FileManager.writeFile(this.configPath, JSON.stringify(data, null, 2));
      Logger.info(`${this.requirements.size}個の要件を保存しました`);
    } catch (error) {
      // 保存に失敗してもエラーをスローせず、ログに記録するだけ
      Logger.error('要件の保存に失敗しました', error as Error);
      Logger.info('要件はメモリ内にのみ保持されます');
      // エラーは投げずに続行
    }
  }

  /**
   * 新しい要件を作成
   */
  public async createRequirement(requirement: Partial<Requirement>): Promise<Requirement> {
    // 必須フィールドを確認
    if (!requirement.title) {
      throw new Error('タイトルは必須です');
    }
    
    // 新しい要件オブジェクトを作成
    const now = new Date().toISOString();
    const id = `REQ-${Date.now().toString(36)}`;
    
    const newRequirement: Requirement = {
      id,
      title: requirement.title,
      description: requirement.description || '',
      type: requirement.type || RequirementType.FUNCTIONAL,
      priority: requirement.priority || RequirementPriority.MEDIUM,
      status: requirement.status || RequirementStatus.PROPOSED,
      createdAt: now,
      updatedAt: now,
      dependencies: requirement.dependencies || [],
      tags: requirement.tags || [],
      notes: requirement.notes || ''
    };
    
    // 要件を保存
    this.requirements.set(id, newRequirement);
    await this.saveRequirements();
    
    Logger.info(`新しい要件を作成しました: ${id} - ${newRequirement.title}`);
    
    return newRequirement;
  }

  /**
   * 要件の更新
   */
  public async updateRequirement(id: string, updates: Partial<Requirement>): Promise<Requirement> {
    // 要件が存在するか確認
    if (!this.requirements.has(id)) {
      throw new Error(`要件 ${id} は存在しません`);
    }
    
    // 現在の要件を取得
    const requirement = this.requirements.get(id)!;
    
    // 更新を適用
    const updatedRequirement: Requirement = {
      ...requirement,
      ...updates,
      id, // IDは変更不可
      updatedAt: new Date().toISOString()
    };
    
    // 要件を保存
    this.requirements.set(id, updatedRequirement);
    await this.saveRequirements();
    
    Logger.info(`要件を更新しました: ${id}`);
    
    return updatedRequirement;
  }

  /**
   * 要件の削除
   */
  public async deleteRequirement(id: string): Promise<boolean> {
    // 要件が存在するか確認
    if (!this.requirements.has(id)) {
      throw new Error(`要件 ${id} は存在しません`);
    }
    
    // 要件を削除
    this.requirements.delete(id);
    await this.saveRequirements();
    
    Logger.info(`要件を削除しました: ${id}`);
    
    return true;
  }

  /**
   * 全ての要件を取得
   */
  public getAllRequirements(): Requirement[] {
    return Array.from(this.requirements.values());
  }

  /**
   * 要件をフィルタリングして取得
   */
  public getFilteredRequirements(filter: Partial<Requirement>): Requirement[] {
    return this.getAllRequirements().filter(req => {
      // 各フィルター条件をチェック
      for (const [key, value] of Object.entries(filter)) {
        if (Array.isArray((req as any)[key])) {
          // 配列フィールドは部分一致
          if (!Array.isArray(value) || !(value as any[]).some(v => (req as any)[key].includes(v))) {
            return false;
          }
        } else if ((req as any)[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * 要件IDから要件を取得
   */
  public getRequirementById(id: string): Requirement | undefined {
    return this.requirements.get(id);
  }

  /**
   * テキスト記述から要件を自動生成
   */
  public async generateRequirementsFromText(text: string): Promise<Requirement[]> {
    try {
      Logger.info('テキストから要件を生成します');
      
      // AIサービスにプロンプトを送信
      const prompt = this.buildRequirementPrompt(text);
      const aiResponse = await this.aiService.sendMessage(prompt, 'requirement');
      
      // AIレスポンスから要件を抽出して保存
      const requirements = await this.parseRequirementsFromResponse(aiResponse);
      
      // 新しい要件を追加
      const newRequirements: Requirement[] = [];
      
      for (const req of requirements) {
        const newReq = await this.createRequirement(req);
        newRequirements.push(newReq);
      }
      
      return newRequirements;
    } catch (error) {
      Logger.error('要件生成エラー', error as Error);
      throw error;
    }
  }

  /**
   * 要件生成プロンプトを構築
   */
  private buildRequirementPrompt(text: string): string {
    return `あなたはAppGenius AIの要件分析エンジンです。
以下のテキストから具体的な要件を抽出し、構造化してください。

ユーザーの入力:
${text}

要件の抽出規則:
1. 機能要件と非機能要件を識別して整理してください
2. 各要件に適切なタイプ、優先度を設定してください
3. 要件間の依存関係を考慮してください
4. 要件は以下のJSONフォーマットで出力してください

出力フォーマット:
\`\`\`json
[
  {
    "title": "要件タイトル",
    "description": "詳細な説明",
    "type": "functional|nonFunctional|ui|data|security|performance|other",
    "priority": "critical|high|medium|low",
    "dependencies": [],
    "tags": []
  }
]
\`\`\`

要件を抽出してください。`;
  }

  /**
   * AIレスポンスから要件を抽出
   */
  private async parseRequirementsFromResponse(aiResponse: string): Promise<Partial<Requirement>[]> {
    try {
      // JSONブロックを抽出
      const jsonPattern = /```json\s*([\s\S]*?)```/;
      const match = jsonPattern.exec(aiResponse);
      
      if (!match) {
        Logger.error('AIレスポンスからJSONが見つかりませんでした');
        return [];
      }
      
      const jsonStr = match[1];
      const requirements = JSON.parse(jsonStr);
      
      if (!Array.isArray(requirements)) {
        Logger.error('抽出されたJSONが配列ではありません');
        return [];
      }
      
      return requirements;
    } catch (error) {
      Logger.error('要件の抽出に失敗しました', error as Error);
      return [];
    }
  }

  /**
   * 要件を要約したマークダウンテキストを生成
   */
  public async exportRequirementsToMarkdown(): Promise<string> {
    const requirements = this.getAllRequirements();
    
    let markdown = '# 要件定義書\n\n';
    markdown += `生成日時: ${new Date().toLocaleString()}\n\n`;
    
    // 要件タイプごとにグループ化
    const groupedReqs: { [key: string]: Requirement[] } = {};
    
    for (const req of requirements) {
      if (!groupedReqs[req.type]) {
        groupedReqs[req.type] = [];
      }
      groupedReqs[req.type].push(req);
    }
    
    // グループごとに出力
    for (const [type, reqs] of Object.entries(groupedReqs)) {
      markdown += `## ${this.getRequirementTypeLabel(type as RequirementType)}\n\n`;
      
      for (const req of reqs) {
        markdown += `### ${req.title} (${req.id})\n\n`;
        markdown += `**優先度**: ${this.getRequirementPriorityLabel(req.priority)}\n\n`;
        markdown += `**ステータス**: ${this.getRequirementStatusLabel(req.status)}\n\n`;
        markdown += `${req.description}\n\n`;
        
        if (req.dependencies && req.dependencies.length > 0) {
          markdown += '**依存関係**:\n';
          for (const depId of req.dependencies) {
            const dep = this.getRequirementById(depId);
            if (dep) {
              markdown += `- ${dep.title} (${depId})\n`;
            }
          }
          markdown += '\n';
        }
        
        if (req.tags && req.tags.length > 0) {
          markdown += `**タグ**: ${req.tags.join(', ')}\n\n`;
        }
        
        if (req.notes) {
          markdown += `**備考**:\n${req.notes}\n\n`;
        }
        
        markdown += '---\n\n';
      }
    }
    
    return markdown;
  }

  /**
   * 要件タイプのラベルを取得
   */
  private getRequirementTypeLabel(type: RequirementType): string {
    const labels: { [key: string]: string } = {
      [RequirementType.FUNCTIONAL]: '機能要件',
      [RequirementType.NON_FUNCTIONAL]: '非機能要件',
      [RequirementType.UI]: 'UI要件',
      [RequirementType.DATA]: 'データ要件',
      [RequirementType.SECURITY]: 'セキュリティ要件',
      [RequirementType.PERFORMANCE]: 'パフォーマンス要件',
      [RequirementType.OTHER]: 'その他の要件'
    };
    
    return labels[type] || '未分類';
  }

  /**
   * 要件優先度のラベルを取得
   */
  private getRequirementPriorityLabel(priority: RequirementPriority): string {
    const labels: { [key: string]: string } = {
      [RequirementPriority.CRITICAL]: '最重要',
      [RequirementPriority.HIGH]: '高',
      [RequirementPriority.MEDIUM]: '中',
      [RequirementPriority.LOW]: '低'
    };
    
    return labels[priority] || '未設定';
  }

  /**
   * 要件ステータスのラベルを取得
   */
  private getRequirementStatusLabel(status: RequirementStatus): string {
    const labels: { [key: string]: string } = {
      [RequirementStatus.PROPOSED]: '提案',
      [RequirementStatus.APPROVED]: '承認済み',
      [RequirementStatus.IMPLEMENTED]: '実装済み',
      [RequirementStatus.TESTED]: 'テスト済み',
      [RequirementStatus.DEPLOYED]: 'デプロイ済み',
      [RequirementStatus.REJECTED]: '却下'
    };
    
    return labels[status] || '未設定';
  }
}