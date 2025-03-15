import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
  hasChanges: boolean;
}

export interface GitCommitResult {
  success: boolean;
  message: string;
  commitId?: string;
}

export interface GitBranchInfo {
  current: string;
  branches: string[];
}

export class GitManager {
  private workspaceRoot: string | undefined;

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
  public async isGitRepository(): Promise<boolean> {
    if (!this.workspaceRoot) {
      return false;
    }

    try {
      await this.executeGitCommand('git rev-parse --is-inside-work-tree');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Git ステータスを取得する
   */
  public async getStatus(): Promise<GitStatus> {
    if (!await this.isGitRepository()) {
      throw new Error('現在のワークスペースはGitリポジトリではありません');
    }

    try {
      const { stdout } = await this.executeGitCommand('git status --porcelain');
      
      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];
      
      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        
        if (status.includes('?')) {
          untracked.push(file);
        } else if (status[0] !== ' ') {
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
    } catch (error) {
      Logger.error('Gitステータス取得エラー', error as Error);
      throw new Error('Gitステータスの取得に失敗しました');
    }
  }

  /**
   * ファイルをステージングする
   */
  public async stageFiles(files: string[]): Promise<void> {
    if (files.length === 0) {
      return;
    }
    
    try {
      const fileArgs = files.map(file => this.escapeShellArg(file)).join(' ');
      await this.executeGitCommand(`git add ${fileArgs}`);
      Logger.info(`${files.length}個のファイルをステージングしました`);
    } catch (error) {
      Logger.error('ファイルのステージングに失敗', error as Error);
      throw new Error('ファイルのステージングに失敗しました');
    }
  }

  /**
   * 変更をコミットする
   */
  public async commit(message: string): Promise<GitCommitResult> {
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
    } catch (error) {
      Logger.error('コミットエラー', error as Error);
      return {
        success: false,
        message: (error as Error).message
      };
    }
  }

  /**
   * 現在のブランチ情報を取得する
   */
  public async getBranchInfo(): Promise<GitBranchInfo> {
    try {
      const { stdout } = await this.executeGitCommand('git branch');
      
      const branches = stdout.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const current = branches
        .find(branch => branch.startsWith('*'))
        ?.substring(1)
        .trim() || '';
      
      const branchNames = branches.map(branch => 
        branch.startsWith('*') ? branch.substring(1).trim() : branch.trim()
      );
      
      return {
        current,
        branches: branchNames
      };
    } catch (error) {
      Logger.error('ブランチ情報取得エラー', error as Error);
      throw new Error('ブランチ情報の取得に失敗しました');
    }
  }

  /**
   * 新しいブランチを作成する
   */
  public async createBranch(branchName: string): Promise<void> {
    try {
      await this.executeGitCommand(`git checkout -b ${this.escapeShellArg(branchName)}`);
      Logger.info(`ブランチ "${branchName}" を作成しました`);
    } catch (error) {
      Logger.error('ブランチ作成エラー', error as Error);
      throw new Error(`ブランチ "${branchName}" の作成に失敗しました`);
    }
  }

  /**
   * ブランチを切り替える
   */
  public async checkoutBranch(branchName: string): Promise<void> {
    try {
      await this.executeGitCommand(`git checkout ${this.escapeShellArg(branchName)}`);
      Logger.info(`ブランチ "${branchName}" にチェックアウトしました`);
    } catch (error) {
      Logger.error('ブランチ切替エラー', error as Error);
      throw new Error(`ブランチ "${branchName}" へのチェックアウトに失敗しました`);
    }
  }

  /**
   * 変更の差分を取得する
   */
  public async getDiff(file?: string): Promise<string> {
    try {
      let command = 'git diff';
      if (file) {
        command += ` ${this.escapeShellArg(file)}`;
      }
      
      const { stdout } = await this.executeGitCommand(command);
      return stdout;
    } catch (error) {
      Logger.error('差分取得エラー', error as Error);
      throw new Error('変更の差分取得に失敗しました');
    }
  }

  /**
   * コミット履歴を取得する
   */
  public async getCommitHistory(count: number = 10): Promise<string> {
    try {
      const { stdout } = await this.executeGitCommand(
        `git log --pretty=format:"%h - %an, %ar : %s" -n ${count}`
      );
      return stdout;
    } catch (error) {
      Logger.error('コミット履歴取得エラー', error as Error);
      throw new Error('コミット履歴の取得に失敗しました');
    }
  }

  /**
   * Gitコマンドを実行する
   */
  private async executeGitCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.workspaceRoot) {
      throw new Error('ワークスペースが開かれていません');
    }
    
    try {
      return await execAsync(command, { cwd: this.workspaceRoot });
    } catch (error) {
      Logger.error(`Git command failed: ${command}`, error as Error);
      throw error;
    }
  }

  /**
   * シェル引数をエスケープする
   */
  private escapeShellArg(arg: string): string {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  /**
   * 任意のGitコマンドを実行する
   * @param command 実行するGitコマンド
   * @returns コマンドの実行結果
   */
  public async executeCommand(command: string): Promise<string> {
    try {
      // Gitコマンドかどうかのチェック
      if (!command.trim().startsWith('git ')) {
        command = `git ${command}`;
      }
      
      const { stdout } = await this.executeGitCommand(command);
      Logger.info(`Git command executed: ${command}`);
      return stdout;
    } catch (error) {
      Logger.error(`Git command execution failed: ${command}`, error as Error);
      throw new Error(`Gitコマンド実行エラー: ${(error as Error).message}`);
    }
  }
}