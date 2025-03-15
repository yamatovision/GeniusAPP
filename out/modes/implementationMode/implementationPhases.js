"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImplementationPhaseManager = exports.ImplementationPhase = void 0;
const logger_1 = require("../../utils/logger");
/**
 * 実装フェーズの定義
 */
var ImplementationPhase;
(function (ImplementationPhase) {
    ImplementationPhase["SCOPE_SELECTION"] = "scopeSelection";
    ImplementationPhase["IMPLEMENTATION_PLANNING"] = "implementationPlanning";
    ImplementationPhase["CODE_GENERATION"] = "codeGeneration";
    ImplementationPhase["TESTING"] = "testing";
})(ImplementationPhase || (exports.ImplementationPhase = ImplementationPhase = {}));
/**
 * 実装フェーズを管理するクラス
 */
class ImplementationPhaseManager {
    constructor() {
        this._phases = new Map();
        this._currentPhase = ImplementationPhase.SCOPE_SELECTION;
        this.initializePhases();
    }
    /**
     * フェーズの初期化
     */
    initializePhases() {
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
        logger_1.Logger.debug('実装フェーズを初期化しました');
    }
    /**
     * 現在のフェーズを取得
     */
    getCurrentPhase() {
        return this._phases.get(this._currentPhase);
    }
    /**
     * 次のフェーズに進む
     */
    advanceToNextPhase() {
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
        logger_1.Logger.info(`フェーズを進行: ${this._currentPhase}`);
        return true;
    }
    /**
     * 特定のフェーズに移動
     */
    moveToPhase(phase) {
        if (!this._phases.has(phase)) {
            return false;
        }
        this._currentPhase = phase;
        logger_1.Logger.info(`フェーズを変更: ${phase}`);
        return true;
    }
    /**
     * フェーズの完了状態を設定
     */
    setPhaseCompletion(phase, isCompleted) {
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
    get allPhases() {
        return Array.from(this._phases.values());
    }
    /**
     * 特定のフェーズの情報を取得
     */
    getPhaseInfo(phase) {
        return this._phases.get(phase);
    }
    /**
     * 現在のフェーズID
     */
    get currentPhaseId() {
        return this._currentPhase;
    }
}
exports.ImplementationPhaseManager = ImplementationPhaseManager;
//# sourceMappingURL=implementationPhases.js.map