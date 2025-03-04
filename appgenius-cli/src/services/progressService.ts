import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ProgressData, ScopeData } from '../types';
import { logger } from '../utils/logger';
import { configManager } from '../utils/configManager';

/**
 * 進捗管理サービスクラス
 * 実装タスクの進捗を管理・追跡する
 */
export class ProgressService {
  private static instance: ProgressService;
  private progressDir: string;
  private currentProgress: Map<string, ProgressData> = new Map();

  private constructor() {
    const config = configManager.getConfig();
    this.progressDir = path.join(config.tempDir || os.tmpdir(), 'appgenius', 'progress');
    this.ensureProgressDir();
    this.loadExistingProgress();
  }

  /**
   * 進捗管理サービスのインスタンスを取得
   */
  public static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  /**
   * 進捗ディレクトリの存在を確認し、必要なら作成
   */
  private ensureProgressDir(): void {
    if (!fs.existsSync(this.progressDir)) {
      fs.mkdirSync(this.progressDir, { recursive: true });
      logger.debug(`進捗管理ディレクトリを作成しました: ${this.progressDir}`);
    }
  }

  /**
   * 既存の進捗データを読み込み
   */
  private loadExistingProgress(): void {
    try {
      if (!fs.existsSync(this.progressDir)) {
        return;
      }

      const files = fs.readdirSync(this.progressDir)
        .filter(file => file.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = path.join(this.progressDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content) as ProgressData;
          
          // 有効な進捗データのみをマップに追加
          if (data && data.scopeId) {
            this.currentProgress.set(data.scopeId, data);
          }
        } catch (err) {
          logger.warn(`進捗ファイルの読み込みに失敗しました: ${file}`, err);
        }
      }
      
      logger.debug(`${this.currentProgress.size}件の進捗データを読み込みました`);
    } catch (error) {
      logger.error('既存の進捗データの読み込みに失敗しました', error as Error);
    }
  }

  /**
   * スコープデータから新しい進捗を作成
   */
  public createProgress(scopeData: ScopeData): ProgressData {
    const scopeId = scopeData.id || uuidv4();
    
    const progressData: ProgressData = {
      scopeId,
      status: 'started',
      completed: 0,
      total: 100,
      currentTask: '初期化中...'
    };
    
    this.currentProgress.set(scopeId, progressData);
    this.saveProgress(progressData);
    
    logger.info(`新しい進捗を作成しました: ${scopeId}`);
    return progressData;
  }

  /**
   * 進捗を更新
   */
  public updateProgress(
    scopeId: string,
    updates: Partial<Omit<ProgressData, 'scopeId'>>
  ): ProgressData {
    if (!this.currentProgress.has(scopeId)) {
      throw new Error(`進捗 ID ${scopeId} が見つかりません`);
    }
    
    const currentData = this.currentProgress.get(scopeId)!;
    const updatedData: ProgressData = { ...currentData, ...updates };
    
    this.currentProgress.set(scopeId, updatedData);
    this.saveProgress(updatedData);
    
    return updatedData;
  }

  /**
   * 進捗を取得
   */
  public getProgress(scopeId: string): ProgressData | undefined {
    return this.currentProgress.get(scopeId);
  }

  /**
   * すべての進捗を取得
   */
  public getAllProgress(): ProgressData[] {
    return Array.from(this.currentProgress.values());
  }

  /**
   * 進捗データをファイルに保存
   */
  private saveProgress(progressData: ProgressData): void {
    try {
      const filePath = path.join(this.progressDir, `${progressData.scopeId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(progressData, null, 2));
      logger.debug(`進捗データを保存しました: ${progressData.scopeId}`);
    } catch (error) {
      logger.error(`進捗データの保存に失敗しました: ${progressData.scopeId}`, error as Error);
    }
  }

  /**
   * 進捗をステップ単位で更新
   */
  public updateStep(
    scopeId: string, 
    step: number, 
    totalSteps: number, 
    description: string
  ): ProgressData {
    const completed = Math.round((step / totalSteps) * 100);
    
    return this.updateProgress(scopeId, {
      completed,
      total: 100,
      currentTask: description,
      status: completed >= 100 ? 'completed' : 'in-progress'
    });
  }

  /**
   * 進捗を完了としてマーク
   */
  public completeProgress(scopeId: string, message?: string): ProgressData {
    return this.updateProgress(scopeId, {
      status: 'completed',
      completed: 100,
      currentTask: message || '完了'
    });
  }

  /**
   * 進捗をエラーとしてマーク
   */
  public failProgress(scopeId: string, error: string): ProgressData {
    return this.updateProgress(scopeId, {
      status: 'failed',
      error
    });
  }

  /**
   * 進捗ファイルを削除
   */
  public removeProgress(scopeId: string): boolean {
    try {
      if (!this.currentProgress.has(scopeId)) {
        return false;
      }
      
      const filePath = path.join(this.progressDir, `${scopeId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      this.currentProgress.delete(scopeId);
      logger.info(`進捗データを削除しました: ${scopeId}`);
      return true;
    } catch (error) {
      logger.error(`進捗データの削除に失敗しました: ${scopeId}`, error as Error);
      return false;
    }
  }
}

// 簡易アクセス用のエクスポート
export const progressService = ProgressService.getInstance();