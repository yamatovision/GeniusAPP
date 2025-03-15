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
exports.AppGeniusEventBus = exports.AppGeniusEventType = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
/**
 * イベントタイプの定義
 * アプリケーション内で発生する各種イベントタイプ
 */
var AppGeniusEventType;
(function (AppGeniusEventType) {
    AppGeniusEventType["REQUIREMENTS_UPDATED"] = "requirements-updated";
    AppGeniusEventType["MOCKUP_CREATED"] = "mockup-created";
    AppGeniusEventType["SCOPE_UPDATED"] = "scope-updated";
    AppGeniusEventType["IMPLEMENTATION_PROGRESS"] = "implementation-progress";
    AppGeniusEventType["PROJECT_STRUCTURE_UPDATED"] = "project-structure-updated";
    AppGeniusEventType["PROJECT_CREATED"] = "project-created";
    AppGeniusEventType["PROJECT_SELECTED"] = "project-selected";
    AppGeniusEventType["PROJECT_DELETED"] = "project-deleted";
    AppGeniusEventType["PROJECT_UPDATED"] = "project-updated";
    AppGeniusEventType["PROJECT_PATH_UPDATED"] = "project-path-updated";
    AppGeniusEventType["PHASE_COMPLETED"] = "phase-completed";
    // 環境変数関連イベント
    AppGeniusEventType["ENV_VARIABLES_UPDATED"] = "env-variables-updated";
    AppGeniusEventType["ENV_FILE_CREATED"] = "env-file-created";
    AppGeniusEventType["CURRENT_STATUS_UPDATED"] = "current-status-updated";
    // ClaudeCode関連イベント
    AppGeniusEventType["CLAUDE_CODE_STARTED"] = "claude-code-started";
    AppGeniusEventType["CLAUDE_CODE_PROGRESS"] = "claude-code-progress";
    AppGeniusEventType["CLAUDE_CODE_COMPLETED"] = "claude-code-completed";
    AppGeniusEventType["CLAUDE_CODE_ERROR"] = "claude-code-error";
    AppGeniusEventType["CLAUDE_CODE_STOPPED"] = "claude-code-stopped";
})(AppGeniusEventType || (exports.AppGeniusEventType = AppGeniusEventType = {}));
/**
 * AppGenius イベントバス
 * モジュール間のコミュニケーションと状態同期を担当
 */
class AppGeniusEventBus {
    constructor() {
        this.eventEmitter = new vscode.EventEmitter();
        logger_1.Logger.info('AppGeniusEventBus initialized');
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!AppGeniusEventBus.instance) {
            AppGeniusEventBus.instance = new AppGeniusEventBus();
        }
        return AppGeniusEventBus.instance;
    }
    /**
     * イベントを発火
     * @param type イベントタイプ
     * @param data イベントデータ
     * @param source イベント発生元
     * @param projectId プロジェクトID
     */
    emit(type, data, source, projectId) {
        const event = {
            type,
            data,
            timestamp: Date.now(),
            source,
            projectId
        };
        logger_1.Logger.debug(`Event emitted: ${type} from ${source}${projectId ? ` for project ${projectId}` : ''}`);
        this.eventEmitter.fire(event);
    }
    /**
     * イベントを発行（emit と同等の機能を持つ別名メソッド）
     * @param type イベントタイプ
     * @param data イベントデータ
     * @param source イベント発生元
     * @param projectId プロジェクトID
     */
    publish(type, data, source, projectId) {
        this.emit(type, data, source, projectId);
    }
    /**
     * 特定のイベントタイプをリッスン
     * @param type イベントタイプ
     * @param listener リスナー関数
     */
    onEventType(type, listener) {
        return this.eventEmitter.event(event => {
            if (event.type === type) {
                listener(event);
            }
        });
    }
    /**
     * 全てのイベントをリッスン
     * @param listener リスナー関数
     */
    onEvent(listener) {
        return this.eventEmitter.event(listener);
    }
    /**
     * 特定のプロジェクトのイベントをリッスン
     * @param projectId プロジェクトID
     * @param listener リスナー関数
     */
    onProjectEvent(projectId, listener) {
        return this.eventEmitter.event(event => {
            if (event.projectId === projectId) {
                listener(event);
            }
        });
    }
}
exports.AppGeniusEventBus = AppGeniusEventBus;
//# sourceMappingURL=AppGeniusEventBus.js.map