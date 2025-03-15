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
exports.GitManager = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitManager {
    constructor() {
        // ワークスペースルートを初期化
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        }
    }
    /**
     * Gitリポジトリかどうかを確認する
     */
    async isGitRepository() {
        if (!this.workspaceRoot) {
            return false;
        }
        try {
            await this.executeGitCommand('git rev-parse --is-inside-work-tree');
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Git ステータスを取得する
     */
    async getStatus() {
        if (!await this.isGitRepository()) {
            throw new Error('現在のワークスペースはGitリポジトリではありません');
        }
        try {
            const { stdout } = await this.executeGitCommand('git status --porcelain');
            const staged = [];
            const unstaged = [];
            const untracked = [];
            const lines = stdout.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                const status = line.substring(0, 2);
                const file = line.substring(3);
                if (status.includes('?')) {
                    untracked.push(file);
                }
                else if (status[0] !== ' ') {
                    staged.push(file);
                }
                if (status[1] !== ' ') {
                    unstaged.push(file);
                }
            }
            return {
                staged,
                unstaged,
                untracked,
                hasChanges: lines.length > 0
            };
        }
        catch (error) {
            logger_1.Logger.error('Gitステータス取得エラー', error);
            throw new Error('Gitステータスの取得に失敗しました');
        }
    }
    /**
     * ファイルをステージングする
     */
    async stageFiles(files) {
        if (files.length === 0) {
            return;
        }
        try {
            const fileArgs = files.map(file => this.escapeShellArg(file)).join(' ');
            await this.executeGitCommand(`git add ${fileArgs}`);
            logger_1.Logger.info(`${files.length}個のファイルをステージングしました`);
        }
        catch (error) {
            logger_1.Logger.error('ファイルのステージングに失敗', error);
            throw new Error('ファイルのステージングに失敗しました');
        }
    }
    /**
     * 変更をコミットする
     */
    async commit(message) {
        try {
            // メッセージをエスケープ
            const escapedMessage = this.escapeShellArg(message);
            // コミット実行
            const { stdout } = await this.executeGitCommand(`git commit -m ${escapedMessage}`);
            // コミットハッシュを取得
            const { stdout: commitIdOutput } = await this.executeGitCommand('git rev-parse HEAD');
            const commitId = commitIdOutput.trim();
            return {
                success: true,
                message: stdout,
                commitId
            };
        }
        catch (error) {
            logger_1.Logger.error('コミットエラー', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    /**
     * 現在のブランチ情報を取得する
     */
    async getBranchInfo() {
        try {
            const { stdout } = await this.executeGitCommand('git branch');
            const branches = stdout.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            const current = branches
                .find(branch => branch.startsWith('*'))
                ?.substring(1)
                .trim() || '';
            const branchNames = branches.map(branch => branch.startsWith('*') ? branch.substring(1).trim() : branch.trim());
            return {
                current,
                branches: branchNames
            };
        }
        catch (error) {
            logger_1.Logger.error('ブランチ情報取得エラー', error);
            throw new Error('ブランチ情報の取得に失敗しました');
        }
    }
    /**
     * 新しいブランチを作成する
     */
    async createBranch(branchName) {
        try {
            await this.executeGitCommand(`git checkout -b ${this.escapeShellArg(branchName)}`);
            logger_1.Logger.info(`ブランチ "${branchName}" を作成しました`);
        }
        catch (error) {
            logger_1.Logger.error('ブランチ作成エラー', error);
            throw new Error(`ブランチ "${branchName}" の作成に失敗しました`);
        }
    }
    /**
     * ブランチを切り替える
     */
    async checkoutBranch(branchName) {
        try {
            await this.executeGitCommand(`git checkout ${this.escapeShellArg(branchName)}`);
            logger_1.Logger.info(`ブランチ "${branchName}" にチェックアウトしました`);
        }
        catch (error) {
            logger_1.Logger.error('ブランチ切替エラー', error);
            throw new Error(`ブランチ "${branchName}" へのチェックアウトに失敗しました`);
        }
    }
    /**
     * 変更の差分を取得する
     */
    async getDiff(file) {
        try {
            let command = 'git diff';
            if (file) {
                command += ` ${this.escapeShellArg(file)}`;
            }
            const { stdout } = await this.executeGitCommand(command);
            return stdout;
        }
        catch (error) {
            logger_1.Logger.error('差分取得エラー', error);
            throw new Error('変更の差分取得に失敗しました');
        }
    }
    /**
     * コミット履歴を取得する
     */
    async getCommitHistory(count = 10) {
        try {
            const { stdout } = await this.executeGitCommand(`git log --pretty=format:"%h - %an, %ar : %s" -n ${count}`);
            return stdout;
        }
        catch (error) {
            logger_1.Logger.error('コミット履歴取得エラー', error);
            throw new Error('コミット履歴の取得に失敗しました');
        }
    }
    /**
     * Gitコマンドを実行する
     */
    async executeGitCommand(command) {
        if (!this.workspaceRoot) {
            throw new Error('ワークスペースが開かれていません');
        }
        try {
            return await execAsync(command, { cwd: this.workspaceRoot });
        }
        catch (error) {
            logger_1.Logger.error(`Git command failed: ${command}`, error);
            throw error;
        }
    }
    /**
     * シェル引数をエスケープする
     */
    escapeShellArg(arg) {
        return `"${arg.replace(/"/g, '\\"')}"`;
    }
    /**
     * 任意のGitコマンドを実行する
     * @param command 実行するGitコマンド
     * @returns コマンドの実行結果
     */
    async executeCommand(command) {
        try {
            // Gitコマンドかどうかのチェック
            if (!command.trim().startsWith('git ')) {
                command = `git ${command}`;
            }
            const { stdout } = await this.executeGitCommand(command);
            logger_1.Logger.info(`Git command executed: ${command}`);
            return stdout;
        }
        catch (error) {
            logger_1.Logger.error(`Git command execution failed: ${command}`, error);
            throw new Error(`Gitコマンド実行エラー: ${error.message}`);
        }
    }
}
exports.GitManager = GitManager;
//# sourceMappingURL=gitManager.js.map