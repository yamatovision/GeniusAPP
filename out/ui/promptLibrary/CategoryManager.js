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
exports.CategoryManager = void 0;
const vscode = __importStar(require("vscode"));
const claudeCodeApiClient_1 = require("../../api/claudeCodeApiClient");
/**
 * プロンプトカテゴリを管理するクラス
 * - カテゴリの一覧取得
 * - カテゴリの追加/編集/削除
 * - カテゴリによるフィルタリング機能
 */
class CategoryManager {
    /**
     * コンストラクタ
     */
    constructor() {
        this._categories = [];
        this._selectedCategory = null;
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
    }
    /**
     * 利用可能なすべてのカテゴリを取得
     */
    async fetchCategories() {
        try {
            // プロンプト一覧を取得し、それからカテゴリを抽出
            const prompts = await this._apiClient.getPrompts();
            // プロンプトからユニークなカテゴリリストを作成
            const categorySet = new Set();
            // 空でないカテゴリをセットに追加
            prompts.forEach(prompt => {
                if (prompt.category && typeof prompt.category === 'string' && prompt.category.trim() !== '') {
                    categorySet.add(prompt.category.trim());
                }
            });
            // セットを配列に変換してソート
            this._categories = Array.from(categorySet).sort();
            return this._categories;
        }
        catch (error) {
            console.error('カテゴリ一覧の取得に失敗しました:', error);
            vscode.window.showErrorMessage('カテゴリ一覧の取得に失敗しました。');
            return [];
        }
    }
    /**
     * 現在のカテゴリリストを取得
     */
    getCategories() {
        return this._categories;
    }
    /**
     * 選択されたカテゴリを設定
     */
    setSelectedCategory(category) {
        this._selectedCategory = category;
    }
    /**
     * 現在選択されているカテゴリを取得
     */
    getSelectedCategory() {
        return this._selectedCategory;
    }
    /**
     * 新しいカテゴリ名の入力を求める
     */
    async promptForCategory() {
        return vscode.window.showInputBox({
            prompt: '新しいカテゴリ名を入力してください',
            placeHolder: 'カテゴリ名',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'カテゴリ名を入力してください';
                }
                return null;
            }
        });
    }
    /**
     * クイックピックでカテゴリを選択
     */
    async selectCategoryFromQuickPick() {
        const allCategories = await this.fetchCategories();
        // 「すべて」のオプションを追加
        const options = ['すべて', ...allCategories];
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'カテゴリでフィルタ',
            canPickMany: false
        });
        if (selected === 'すべて') {
            this.setSelectedCategory(null);
            return undefined;
        }
        if (selected) {
            this.setSelectedCategory(selected);
            return selected;
        }
        return undefined;
    }
}
exports.CategoryManager = CategoryManager;
//# sourceMappingURL=CategoryManager.js.map