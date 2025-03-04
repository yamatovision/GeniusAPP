import { Logger } from '../../utils/logger';

/**
 * 開発アシスタントのフェーズ定義
 */
export enum DevelopmentPhase {
  INFORMATION_GATHERING = 'informationGathering',
  IMPACT_ANALYSIS = 'impactAnalysis',
  IMPLEMENTATION_PLAN = 'implementationPlan',
  IMPLEMENTATION = 'implementation'
}

/**
 * フェーズ情報の型定義
 */
export interface PhaseInfo {
  id: DevelopmentPhase;
  name: string;
  description: string;
  isCompleted: boolean;
  tasks: string[];
}

/**
 * 開発フェーズを管理するクラス
 */
export class DevelopmentPhaseManager {
  private _phases: Map<DevelopmentPhase, PhaseInfo> = new Map();
  private _currentPhase: DevelopmentPhase = DevelopmentPhase.INFORMATION_GATHERING;

  constructor() {
    this.initializePhases();
  }

  /**
   * フェーズの初期化
   */
  private initializePhases(): void {
    // 情報収集フェーズ
    this._phases.set(DevelopmentPhase.INFORMATION_GATHERING, {
      id: DevelopmentPhase.INFORMATION_GATHERING,
      name: '情報収集フェーズ',
      description: 'プロジェクトの現状と開発要件を把握します',
      isCompleted: false,
      tasks: [
        'ディレクトリ構造の確認',
        '開発スコープの確認',
        '関連ファイルの確認'
      ]
    });

    // 影響範囲分析フェーズ
    this._phases.set(DevelopmentPhase.IMPACT_ANALYSIS, {
      id: DevelopmentPhase.IMPACT_ANALYSIS,
      name: '影響範囲の特定と承認',
      description: '現状分析と変更が必要な箇所を特定します',
      isCompleted: false,
      tasks: [
        '現状分析の説明',
        '変更が必要な箇所の特定',
        '予想される影響の説明',
        'ユーザーからの承認取得'
      ]
    });

    // 実装計画フェーズ
    this._phases.set(DevelopmentPhase.IMPLEMENTATION_PLAN, {
      id: DevelopmentPhase.IMPLEMENTATION_PLAN,
      name: '実装計画の確認',
      description: '実装方法と手順を計画します',
      isCompleted: false,
      tasks: [
        '変更ファイル一覧の作成',
        'ディレクトリ構造の計画',
        '各ファイルでの変更内容の説明',
        '想定される影響の説明',
        'ユーザーからの承認取得'
      ]
    });

    // 実装フェーズ
    this._phases.set(DevelopmentPhase.IMPLEMENTATION, {
      id: DevelopmentPhase.IMPLEMENTATION,
      name: '実装',
      description: '計画に基づいてコードを実装します',
      isCompleted: false,
      tasks: [
        'ファイルの作成/修正',
        'コードの実装',
        '動作確認'
      ]
    });

    Logger.debug('開発フェーズを初期化しました');
  }

  /**
   * 現在のフェーズを取得
   */
  public get currentPhase(): DevelopmentPhase {
    return this._currentPhase;
  }

  /**
   * すべてのフェーズ情報を取得
   */
  public get allPhases(): PhaseInfo[] {
    return Array.from(this._phases.values());
  }

  /**
   * 特定のフェーズの情報を取得
   */
  public getPhaseInfo(phase: DevelopmentPhase): PhaseInfo | undefined {
    return this._phases.get(phase);
  }

  /**
   * 現在のフェーズの情報を取得
   */
  public getCurrentPhaseInfo(): PhaseInfo | undefined {
    return this._phases.get(this._currentPhase);
  }

  /**
   * 指定されたフェーズに移動
   */
  public moveToPhase(phase: DevelopmentPhase): void {
    if (!this._phases.has(phase)) {
      throw new Error(`無効なフェーズです: ${phase}`);
    }

    this._currentPhase = phase;
    Logger.info(`フェーズを変更しました: ${phase}`);
  }

  /**
   * フェーズの完了状態を設定
   */
  public setPhaseCompletion(phase: DevelopmentPhase, isCompleted: boolean): void {
    const phaseInfo = this._phases.get(phase);
    if (!phaseInfo) {
      throw new Error(`無効なフェーズです: ${phase}`);
    }

    phaseInfo.isCompleted = isCompleted;
    this._phases.set(phase, phaseInfo);
    Logger.info(`フェーズの完了状態を変更しました: ${phase}, ${isCompleted}`);
  }

  /**
   * 次のフェーズに進む
   */
  public advanceToNextPhase(): boolean {
    const currentPhaseInfo = this._phases.get(this._currentPhase);
    if (!currentPhaseInfo) {
      return false;
    }

    // 現在のフェーズを完了とマーク
    this.setPhaseCompletion(this._currentPhase, true);

    // 次のフェーズを決定
    switch (this._currentPhase) {
      case DevelopmentPhase.INFORMATION_GATHERING:
        this._currentPhase = DevelopmentPhase.IMPACT_ANALYSIS;
        break;
      case DevelopmentPhase.IMPACT_ANALYSIS:
        this._currentPhase = DevelopmentPhase.IMPLEMENTATION_PLAN;
        break;
      case DevelopmentPhase.IMPLEMENTATION_PLAN:
        this._currentPhase = DevelopmentPhase.IMPLEMENTATION;
        break;
      case DevelopmentPhase.IMPLEMENTATION:
        // 最終フェーズの場合は何もしない
        return false;
    }

    Logger.info(`次のフェーズに進みました: ${this._currentPhase}`);
    return true;
  }

  /**
   * すべてのフェーズがリセット
   */
  public resetAllPhases(): void {
    this._phases.forEach((phaseInfo, phaseId) => {
      phaseInfo.isCompleted = false;
      this._phases.set(phaseId, phaseInfo);
    });
    
    this._currentPhase = DevelopmentPhase.INFORMATION_GATHERING;
    Logger.info('すべてのフェーズをリセットしました');
  }
}