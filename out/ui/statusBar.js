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
exports.StatusBar = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class StatusBar {
    constructor() {
        // メインのステータスバーアイテム
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.text = '$(robot) AppGenius AI';
        this.statusBarItem.tooltip = 'AppGenius AI: 準備完了';
        this.statusBarItem.command = 'appgenius-ai.showMainMenu';
        this.statusBarItem.show();
        logger_1.Logger.debug('ステータスバーにAppGenius AIアイコンを表示しました');
    }
    /**
     * ステータスバーの表示を更新
     */
    update(state) {
        switch (state) {
            case 'Active':
                this.statusBarItem.text = '$(radio-tower) AppGenius AI';
                this.statusBarItem.tooltip = 'AppGenius AI: アクティブ';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case 'Busy':
                this.statusBarItem.text = '$(sync~spin) AppGenius AI';
                this.statusBarItem.tooltip = 'AppGenius AI: 処理中...';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case 'Ready':
                this.statusBarItem.text = '$(robot) AppGenius AI';
                this.statusBarItem.tooltip = 'AppGenius AI: 準備完了';
                this.statusBarItem.backgroundColor = undefined;
                break;
            default:
                this.statusBarItem.text = '$(robot) AppGenius AI';
                this.statusBarItem.tooltip = 'AppGenius AI: 準備完了';
                this.statusBarItem.backgroundColor = undefined;
        }
    }
    /**
     * リソースを解放
     */
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBar = StatusBar;
//# sourceMappingURL=statusBar.js.map