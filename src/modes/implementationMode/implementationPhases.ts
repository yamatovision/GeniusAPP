import { Logger } from '../../utils/logger';

/**
 * 実装フェーズの定義
 */
export enum ImplementationPhase {
  SCOPE_SELECTION = 'scopeSelection',
  IMPLEMENTATION_PLANNING = 'implementationPlanning',
  CODE_GENERATION = 'codeGeneration',
  TESTING = 'testing'
}

/**
 * フェーズ情報の型定義
 */
export interface PhaseInfo {
  id: ImplementationPhase;
  name: string;
  description: string;
  isCompleted: boolean;
  tasks: string[];
}

/**
 * 実装フェーズを管理するクラス
 */
export class ImplementationPhaseManager {
  private _phases: Map<ImplementationPhase, PhaseInfo> = new Map();
  private _currentPhase: ImplementationPhase = ImplementationPhase.SCOPE_SELECTION;

  constructor() {
    this.initializePhases();
  }

  /**
   * フェーズの初期化
   */
  private initializePhases(): void {
    // スコープ選択フェーズ
    this._phases.set(ImplementationPhase.SCOPE_SELECTION, {
      id: ImplementationPhase.SCOPE_SELECTION,
      name: 'スコープ選択',
      description: '実装する機能や修正内容の範囲を決定します',
      isCompleted: false,
      tasks: [
        '要件定義書からの実装項目抽出',
        '優先度の決定',
        '実装スコープの設定'
      ]
    });

    // 実装計画フェーズ
    this._phases.set(ImplementationPhase.IMPLEMENTATION_PLANNING, {
      id: ImplementationPhase.IMPLEMENTATION_PLANNING,
      name: '実装計画',
      description: 'スコープに基づいて具体的な実装計画を立てます',
      isCompleted: false,
      tasks: [
        'タスク分解',
        '影響範囲の特定',
        '実装手順の決定'
      ]
    });

    // コード生成フェーズ
    this._phases.set(ImplementationPhase.CODE_GENERATION, {
      id: ImplementationPhase.CODE_GENERATION,
      name: 'コード生成',
      description: '計画に基づいてコードを生成します',
      isCompleted: false,
      tasks: [
        'コードテンプレート生成',
        'コード実装',
        'レビュー対応'
      ]
    });

    // テストフェーズ
    this._phases.set(ImplementationPhase.TESTING, {
      id: ImplementationPhase.TESTING,
      name: 'テスト作成',
      description: '実装したコードのテストを作成します',
      isCompleted: false,
      tasks: [
        'テスト計画',
        'テストコード作成',
        'テスト実行と修正'
      ]
    });

    Logger.debug('実装フェーズを初期化しました');
  }

  /**
   * 現在のフェーズを取得
   */
  public getCurrentPhase(): PhaseInfo | undefined {
    return this._phases.get(this._currentPhase);
  }

  /**
   * 次のフェーズに進む
   */
  public advanceToNextPhase(): boolean {
    const currentPhase = this.getCurrentPhase();
    if (!currentPhase) {
      return false;
    }

    // 現在のフェーズを完了とマーク
    this.setPhaseCompletion(currentPhase.id, true);

    // 次のフェーズを決定
    switch (currentPhase.id) {
      case ImplementationPhase.SCOPE_SELECTION:
        this._currentPhase = ImplementationPhase.IMPLEMENTATION_PLANNING;
        break;
      case ImplementationPhase.IMPLEMENTATION_PLANNING:
        this._currentPhase = ImplementationPhase.CODE_GENERATION;
        break;
      case ImplementationPhase.CODE_GENERATION:
        this._currentPhase = ImplementationPhase.TESTING;
        break;
      case ImplementationPhase.TESTING:
        // 最終フェーズの場合は何もしない
        return false;
    }

    Logger.info(`フェーズを進行: ${this._currentPhase}`);
    return true;
  }

  /**
   * 特定のフェーズに移動
   */
  public moveToPhase(phase: ImplementationPhase): boolean {
    if (!this._phases.has(phase)) {
      return false;
    }
    this._currentPhase = phase;
    Logger.info(`フェーズを変更: ${phase}`);
    return true;
  }

  /**
   * フェーズの完了状態を設定
   */
  public setPhaseCompletion(phase: ImplementationPhase, isCompleted: boolean): boolean {
    const phaseInfo = this._phases.get(phase);
    if (!phaseInfo) {
      return false;
    }
    phaseInfo.isCompleted = isCompleted;
    this._phases.set(phase, phaseInfo);
    return true;
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
  public getPhaseInfo(phase: ImplementationPhase): PhaseInfo | undefined {
    return this._phases.get(phase);
  }

  /**
   * 現在のフェーズID
   */
  public get currentPhaseId(): ImplementationPhase {
    return this._currentPhase;
  }
}