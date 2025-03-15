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
exports.RequirementManager = exports.RequirementStatus = exports.RequirementPriority = exports.RequirementType = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fileManager_1 = require("../../utils/fileManager");
const logger_1 = require("../../utils/logger");
var RequirementType;
(function (RequirementType) {
    RequirementType["FUNCTIONAL"] = "functional";
    RequirementType["NON_FUNCTIONAL"] = "nonFunctional";
    RequirementType["UI"] = "ui";
    RequirementType["DATA"] = "data";
    RequirementType["SECURITY"] = "security";
    RequirementType["PERFORMANCE"] = "performance";
    RequirementType["OTHER"] = "other";
})(RequirementType || (exports.RequirementType = RequirementType = {}));
var RequirementPriority;
(function (RequirementPriority) {
    RequirementPriority["CRITICAL"] = "critical";
    RequirementPriority["HIGH"] = "high";
    RequirementPriority["MEDIUM"] = "medium";
    RequirementPriority["LOW"] = "low";
})(RequirementPriority || (exports.RequirementPriority = RequirementPriority = {}));
var RequirementStatus;
(function (RequirementStatus) {
    RequirementStatus["PROPOSED"] = "proposed";
    RequirementStatus["APPROVED"] = "approved";
    RequirementStatus["IMPLEMENTED"] = "implemented";
    RequirementStatus["TESTED"] = "tested";
    RequirementStatus["DEPLOYED"] = "deployed";
    RequirementStatus["REJECTED"] = "rejected";
})(RequirementStatus || (exports.RequirementStatus = RequirementStatus = {}));
class RequirementManager {
    constructor(aiService) {
        this.requirements = new Map();
        this.aiService = aiService;
        // 要件保存用のファイルパスを設定 - ユーザーのホームディレクトリに保存
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const appDir = path.join(homeDir, '.appgenius-ai');
        // 現在のワークスペース名を取得
        const workspaceName = vscode.workspace.name || 'default';
        this.configPath = path.join(appDir, `${workspaceName}-requirements.json`);
        // 初期化時に既存の要件を読み込む
        this.loadRequirements();
    }
    /**
     * 要件をファイルから読み込む
     */
    async loadRequirements() {
        try {
            // ディレクトリが存在しない場合、または作成できない場合は一時ディレクトリを使用
            try {
                // 設定ディレクトリが存在するか確認
                const configDir = path.dirname(this.configPath);
                if (!await fileManager_1.FileManager.directoryExists(configDir)) {
                    await fileManager_1.FileManager.createDirectory(configDir);
                }
            }
            catch (dirError) {
                logger_1.Logger.info(`設定ディレクトリの作成に失敗しました。メモリ内で要件を管理します: ${dirError.message}`);
                // ディレクトリ作成に失敗した場合は、メモリ内で要件を管理
                this.requirements.clear();
                return;
            }
            // 設定ファイルが存在するか確認
            if (await fileManager_1.FileManager.fileExists(this.configPath)) {
                const content = await fileManager_1.FileManager.readFile(this.configPath);
                const data = JSON.parse(content);
                this.requirements.clear();
                for (const req of data.requirements) {
                    this.requirements.set(req.id, req);
                }
                logger_1.Logger.info(`${this.requirements.size}個の要件を読み込みました`);
            }
            else {
                // 初期ファイルを作成
                try {
                    await this.saveRequirements();
                    logger_1.Logger.info('新しい要件ファイルを作成しました');
                }
                catch (fileError) {
                    logger_1.Logger.info(`要件ファイルの作成に失敗しました。メモリ内で要件を管理します: ${fileError.message}`);
                }
            }
        }
        catch (error) {
            logger_1.Logger.error('要件の読み込みに失敗しました', error);
            logger_1.Logger.info('メモリ内で要件を管理します');
            // エラーは投げずに、メモリ内の空の要件リストで続行
            this.requirements.clear();
        }
    }
    /**
     * 要件をファイルに保存
     */
    async saveRequirements() {
        try {
            const data = {
                version: '1.0',
                updatedAt: new Date().toISOString(),
                requirements: Array.from(this.requirements.values())
            };
            await fileManager_1.FileManager.writeFile(this.configPath, JSON.stringify(data, null, 2));
            logger_1.Logger.info(`${this.requirements.size}個の要件を保存しました`);
        }
        catch (error) {
            // 保存に失敗してもエラーをスローせず、ログに記録するだけ
            logger_1.Logger.error('要件の保存に失敗しました', error);
            logger_1.Logger.info('要件はメモリ内にのみ保持されます');
            // エラーは投げずに続行
        }
    }
    /**
     * 新しい要件を作成
     */
    async createRequirement(requirement) {
        // 必須フィールドを確認
        if (!requirement.title) {
            throw new Error('タイトルは必須です');
        }
        // 新しい要件オブジェクトを作成
        const now = new Date().toISOString();
        const id = `REQ-${Date.now().toString(36)}`;
        const newRequirement = {
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
        logger_1.Logger.info(`新しい要件を作成しました: ${id} - ${newRequirement.title}`);
        return newRequirement;
    }
    /**
     * 要件の更新
     */
    async updateRequirement(id, updates) {
        // 要件が存在するか確認
        if (!this.requirements.has(id)) {
            throw new Error(`要件 ${id} は存在しません`);
        }
        // 現在の要件を取得
        const requirement = this.requirements.get(id);
        // 更新を適用
        const updatedRequirement = {
            ...requirement,
            ...updates,
            id, // IDは変更不可
            updatedAt: new Date().toISOString()
        };
        // 要件を保存
        this.requirements.set(id, updatedRequirement);
        await this.saveRequirements();
        logger_1.Logger.info(`要件を更新しました: ${id}`);
        return updatedRequirement;
    }
    /**
     * 要件の削除
     */
    async deleteRequirement(id) {
        // 要件が存在するか確認
        if (!this.requirements.has(id)) {
            throw new Error(`要件 ${id} は存在しません`);
        }
        // 要件を削除
        this.requirements.delete(id);
        await this.saveRequirements();
        logger_1.Logger.info(`要件を削除しました: ${id}`);
        return true;
    }
    /**
     * 全ての要件を取得
     */
    getAllRequirements() {
        return Array.from(this.requirements.values());
    }
    /**
     * 要件をフィルタリングして取得
     */
    getFilteredRequirements(filter) {
        return this.getAllRequirements().filter(req => {
            // 各フィルター条件をチェック
            for (const [key, value] of Object.entries(filter)) {
                if (Array.isArray(req[key])) {
                    // 配列フィールドは部分一致
                    if (!Array.isArray(value) || !value.some(v => req[key].includes(v))) {
                        return false;
                    }
                }
                else if (req[key] !== value) {
                    return false;
                }
            }
            return true;
        });
    }
    /**
     * 要件IDから要件を取得
     */
    getRequirementById(id) {
        return this.requirements.get(id);
    }
    /**
     * テキスト記述から要件を自動生成
     */
    async generateRequirementsFromText(text) {
        try {
            logger_1.Logger.info('テキストから要件を生成します');
            // AIサービスにプロンプトを送信
            const prompt = this.buildRequirementPrompt(text);
            const aiResponse = await this.aiService.sendMessage(prompt, 'requirement');
            // AIレスポンスから要件を抽出して保存
            const requirements = await this.parseRequirementsFromResponse(aiResponse);
            // 新しい要件を追加
            const newRequirements = [];
            for (const req of requirements) {
                const newReq = await this.createRequirement(req);
                newRequirements.push(newReq);
            }
            return newRequirements;
        }
        catch (error) {
            logger_1.Logger.error('要件生成エラー', error);
            throw error;
        }
    }
    /**
     * 要件生成プロンプトを構築
     */
    buildRequirementPrompt(text) {
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
    async parseRequirementsFromResponse(aiResponse) {
        try {
            // JSONブロックを抽出
            const jsonPattern = /```json\s*([\s\S]*?)```/;
            const match = jsonPattern.exec(aiResponse);
            if (!match) {
                logger_1.Logger.error('AIレスポンスからJSONが見つかりませんでした');
                return [];
            }
            const jsonStr = match[1];
            const requirements = JSON.parse(jsonStr);
            if (!Array.isArray(requirements)) {
                logger_1.Logger.error('抽出されたJSONが配列ではありません');
                return [];
            }
            return requirements;
        }
        catch (error) {
            logger_1.Logger.error('要件の抽出に失敗しました', error);
            return [];
        }
    }
    /**
     * 要件を要約したマークダウンテキストを生成
     */
    async exportRequirementsToMarkdown() {
        const requirements = this.getAllRequirements();
        let markdown = '# 要件定義書\n\n';
        markdown += `生成日時: ${new Date().toLocaleString()}\n\n`;
        // 要件タイプごとにグループ化
        const groupedReqs = {};
        for (const req of requirements) {
            if (!groupedReqs[req.type]) {
                groupedReqs[req.type] = [];
            }
            groupedReqs[req.type].push(req);
        }
        // グループごとに出力
        for (const [type, reqs] of Object.entries(groupedReqs)) {
            markdown += `## ${this.getRequirementTypeLabel(type)}\n\n`;
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
    getRequirementTypeLabel(type) {
        const labels = {
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
    getRequirementPriorityLabel(priority) {
        const labels = {
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
    getRequirementStatusLabel(status) {
        const labels = {
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
exports.RequirementManager = RequirementManager;
//# sourceMappingURL=requirementManager.js.map