"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignPhaseManager = exports.DesignPhase = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../../utils/logger");
/**
 * デザインフェーズの定義
 */
var DesignPhase;
(function (DesignPhase) {
    DesignPhase["REQUIREMENTS"] = "requirements";
    DesignPhase["PAGE_STRUCTURE"] = "pageStructure";
    DesignPhase["MOCKUPS"] = "mockups";
    DesignPhase["DIRECTORY_STRUCTURE"] = "directoryStructure";
    DesignPhase["SPECIFICATION"] = "specification";
})(DesignPhase || (exports.DesignPhase = DesignPhase = {}));
/**
 * デザインフェーズマネージャー
 * プロジェクト設計の各フェーズを管理する
 */
class DesignPhaseManager {
    constructor() {
        this._currentPhase = DesignPhase.REQUIREMENTS;
        this._phases = new Map();
        this._phaseCompletedEvent = new vscode.EventEmitter();
        this.initializePhases();
    }
    /**
     * フェーズ完了イベント
     */
    get onPhaseCompleted() {
        return this._phaseCompletedEvent.event;
    }
    /**
     * 現在のフェーズを取得
     */
    get currentPhase() {
        return this._currentPhase;
    }
    /**
     * 現在のフェーズ情報を取得
     */
    get currentPhaseInfo() {
        return this._phases.get(this._currentPhase);
    }
    /**
     * 全フェーズ情報を取得
     */
    get allPhases() {
        return Array.from(this._phases.values());
    }
    /**
     * フェーズを初期化
     */
    initializePhases() {
        // Phase 1: 基本要件の把握
        this._phases.set(DesignPhase.REQUIREMENTS, {
            id: DesignPhase.REQUIREMENTS,
            name: 'Phase 1: 基本要件の把握',
            description: 'プロジェクトの目的、ユーザー、必要な機能を定義します',
            tasks: [
                '解決したい課題と実現したい状態を明確化',
                '主な利用者と利用シーンを特定',
                '必須機能とあったら嬉しい機能を列挙'
            ],
            outputs: ['要件定義シート'],
            isCompleted: false
        });
        // Phase 2: ページ構造と機能の策定
        this._phases.set(DesignPhase.PAGE_STRUCTURE, {
            id: DesignPhase.PAGE_STRUCTURE,
            name: 'Phase 2: ページ構造と機能の策定',
            description: '必要なページとその機能を明確にします',
            tasks: [
                'ユーザーフローの設計',
                '必要なページの一覧化',
                '各ページの機能を定義',
                'ページ間の関連性を確認'
            ],
            outputs: ['ページ一覧と機能一覧'],
            isCompleted: false
        });
        // Phase 3: モックアップ作成
        this._phases.set(DesignPhase.MOCKUPS, {
            id: DesignPhase.MOCKUPS,
            name: 'Phase 3: モックアップ作成',
            description: '各ページのモックアップを作成します',
            tasks: [
                '各ページのUIデザイン',
                'モックデータの作成',
                'インタラクションの定義',
                'バックエンド要件の抽出'
            ],
            outputs: ['動作確認済みモックアップ一式'],
            isCompleted: false
        });
        // Phase 4: ディレクトリ構造の作成
        this._phases.set(DesignPhase.DIRECTORY_STRUCTURE, {
            id: DesignPhase.DIRECTORY_STRUCTURE,
            name: 'Phase 4: ディレクトリ構造の作成',
            description: 'プロジェクトのディレクトリ構造を設計します',
            tasks: [
                'フロントエンドのディレクトリ構造設計',
                'バックエンドのディレクトリ構造設計',
                '共通リソースの配置計画'
            ],
            outputs: ['ディレクトリ構造図'],
            isCompleted: false
        });
        // Phase 5: 要件定義書のまとめ
        this._phases.set(DesignPhase.SPECIFICATION, {
            id: DesignPhase.SPECIFICATION,
            name: 'Phase 5: 要件定義書のまとめ',
            description: '実装に必要な詳細な仕様を文書化します',
            tasks: [
                'フロントエンド実装仕様の文書化',
                'バックエンド実装仕様の文書化',
                'テスト要件の定義',
                '非機能要件の整理'
            ],
            outputs: ['実装用要件定義書'],
            isCompleted: false
        });
    }
    /**
     * フェーズを進める
     */
    advanceToNextPhase() {
        // 現在のフェーズを完了としてマーク
        const currentPhaseInfo = this._phases.get(this._currentPhase);
        if (currentPhaseInfo) {
            currentPhaseInfo.isCompleted = true;
            this._phases.set(this._currentPhase, currentPhaseInfo);
        }
        // 次のフェーズに進む
        switch (this._currentPhase) {
            case DesignPhase.REQUIREMENTS:
                this._currentPhase = DesignPhase.PAGE_STRUCTURE;
                break;
            case DesignPhase.PAGE_STRUCTURE:
                this._currentPhase = DesignPhase.MOCKUPS;
                break;
            case DesignPhase.MOCKUPS:
                this._currentPhase = DesignPhase.DIRECTORY_STRUCTURE;
                break;
            case DesignPhase.DIRECTORY_STRUCTURE:
                this._currentPhase = DesignPhase.SPECIFICATION;
                break;
            case DesignPhase.SPECIFICATION:
                // 最終フェーズなので何もしない
                return false;
        }
        // フェーズ変更をログに記録
        logger_1.Logger.info(`デザインフェーズを進めました: ${this._currentPhase}`);
        // フェーズ完了イベントを発火
        this._phaseCompletedEvent.fire(this._currentPhase);
        return true;
    }
    /**
     * 特定のフェーズに移動
     */
    moveToPhase(phase) {
        if (this._phases.has(phase)) {
            this._currentPhase = phase;
            logger_1.Logger.info(`デザインフェーズを変更しました: ${phase}`);
        }
        else {
            logger_1.Logger.error(`無効なフェーズ: ${phase}`);
        }
    }
    /**
     * フェーズの完了状態を設定
     */
    setPhaseCompletion(phase, isCompleted) {
        const phaseInfo = this._phases.get(phase);
        if (phaseInfo) {
            phaseInfo.isCompleted = isCompleted;
            this._phases.set(phase, phaseInfo);
            if (isCompleted) {
                this._phaseCompletedEvent.fire(phase);
            }
        }
    }
    /**
     * フェーズに関連するデータを保存
     */
    async savePhaseData(phase, _phaseData) {
        try {
            // フェーズごとのデータを保存する実装
            // ここでは単純化のためにコンソールログに出力
            logger_1.Logger.info(`フェーズ ${phase} のデータを保存しました`);
            // 実際のアプリでは永続化処理を実装
            // await vscode.workspace.getConfiguration('appgeniusAI').update(`designPhase.${phase}`, _phaseData, true);
        }
        catch (error) {
            logger_1.Logger.error(`フェーズデータ保存エラー: ${phase}`, error);
        }
    }
}
exports.DesignPhaseManager = DesignPhaseManager;
//# sourceMappingURL=designPhases.js.map