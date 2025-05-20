import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * CLAUDE.mdファイルを管理するサービス
 */
export class ClaudeMdService {
  private static instance: ClaudeMdService;
  
  private constructor() {}
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ClaudeMdService {
    if (!ClaudeMdService.instance) {
      ClaudeMdService.instance = new ClaudeMdService();
    }
    return ClaudeMdService.instance;
  }

  /**
   * CLAUDE.mdを生成 - プロジェクト情報から
   * @param projectPath プロジェクトパス
   * @param projectInfo プロジェクト情報
   * @returns CLAUDE.mdのパス、または失敗時はnull
   */
  public async generateClaudeMd(projectPath: string, projectInfo: { 
    name: string, 
    description?: string 
  }): Promise<string | null> {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      
      // 重要: すでにCLAUDE.mdが存在する場合は上書きしない
      if (fs.existsSync(claudeMdPath)) {
        Logger.info(`CLAUDE.mdはすでに存在します。上書きしません: ${claudeMdPath}`);
        return claudeMdPath;
      }
      
      // テンプレートを取得
      let template = this.getDefaultTemplate();
      
      // プロジェクト名とプロジェクト説明を置換
      template = template
        .replace(/\${PROJECT_NAME}/g, projectInfo.name || 'プロジェクト名')
        .replace(/\${PROJECT_DESCRIPTION}/g, projectInfo.description || `${projectInfo.name}プロジェクトの説明をここに記述します。`);
      
      // ファイルに書き込む
      fs.writeFileSync(claudeMdPath, template, 'utf8');
      
      Logger.info(`CLAUDE.mdを生成しました: ${claudeMdPath}`);
      return claudeMdPath;
    } catch (error) {
      Logger.error('CLAUDE.md生成エラー', error as Error);
      return null;
    }
  }
  
  /**
   * 既存のCLAUDE.mdを読み込む
   * @param projectPath プロジェクトパス
   * @returns CLAUDE.mdの内容、または失敗時はnull
   */
  public loadClaudeMd(projectPath: string): string | null {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      if (fs.existsSync(claudeMdPath)) {
        return fs.readFileSync(claudeMdPath, 'utf8');
      }
      return null;
    } catch (error) {
      Logger.error('CLAUDE.md読み込みエラー', error as Error);
      return null;
    }
  }
  
  /**
   * CLAUDE.md内の指定セクションを更新
   * @param projectPath プロジェクトパス
   * @param sectionName セクション名
   * @param content 新しい内容
   * @returns 成功したかどうか
   */
  public updateClaudeMdSection(projectPath: string, sectionName: string, content: string): boolean {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(claudeMdPath)) {
        // ファイルが存在しない場合は警告して処理停止
        Logger.warn(`CLAUDE.mdが見つかりません: ${claudeMdPath}`);
        return false;
      }
      
      // ファイルを読み込む
      let claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
      
      // セクションのパターン
      const sectionPattern = new RegExp(`## ${sectionName}[\\s\\S]*?(?=##|$)`, 'm');
      const newSection = `## ${sectionName}\n\n${content}\n\n`;
      
      // セクションの置換または追加
      if (claudeMdContent.match(sectionPattern)) {
        claudeMdContent = claudeMdContent.replace(sectionPattern, newSection);
      } else {
        claudeMdContent += `\n${newSection}`;
      }
      
      // ファイルに書き戻す
      fs.writeFileSync(claudeMdPath, claudeMdContent, 'utf8');
      
      Logger.info(`CLAUDE.mdの${sectionName}セクションを更新しました`);
      return true;
    } catch (error) {
      Logger.error(`CLAUDE.mdセクション更新エラー: ${sectionName}`, error as Error);
      return false;
    }
  }
  
  /**
   * CLAUDE.md内の指定セクションを取得
   * @param projectPath プロジェクトパス
   * @param sectionName セクション名
   * @returns セクションの内容、または失敗時はnull
   */
  public getClaudeMdSection(projectPath: string, sectionName: string): string | null {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(claudeMdPath)) {
        Logger.warn(`CLAUDE.mdが見つかりません: ${claudeMdPath}`);
        return null;
      }
      
      // ファイルを読み込む
      const claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
      
      // セクションを正規表現で抽出
      const sectionPattern = new RegExp(`## ${sectionName}([\\s\\S]*?)(?=##|$)`, 'm');
      const match = claudeMdContent.match(sectionPattern);
      
      if (match && match[1]) {
        return match[1].trim();
      }
      
      return null;
    } catch (error) {
      Logger.error(`CLAUDE.mdセクション取得エラー: ${sectionName}`, error as Error);
      return null;
    }
  }

  /**
   * CLAUDE.mdの存在チェックと必要に応じた作成
   * @param projectPath プロジェクトパス
   * @param projectInfo プロジェクト情報
   * @returns 成功したかどうか
   */
  public async ensureClaudeMdExists(projectPath: string, projectInfo: {
    name: string,
    description?: string
  }): Promise<boolean> {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      
      // すでに存在する場合は何もしない
      if (fs.existsSync(claudeMdPath)) {
        Logger.info(`CLAUDE.mdはすでに存在します: ${claudeMdPath}`);
        return true;
      }
      
      // 存在しない場合は生成
      const result = await this.generateClaudeMd(projectPath, projectInfo);
      return result !== null;
    } catch (error) {
      Logger.error('CLAUDE.md存在確認エラー', error as Error);
      return false;
    }
  }
  
  /**
   * デフォルトのテンプレートを取得
   */
  private getDefaultTemplate(): string {
    try {
      // TemplateServiceを使用してテンプレートを取得
      const { TemplateService } = require('./TemplateService');
      const templateService = TemplateService.getInstance();
      return templateService.getClaudeTemplate();
    } catch (error) {
      Logger.error('テンプレート取得中にエラーが発生しました', error as Error);
      
      // フォールバック: 最小限のテンプレートを返す
      return `# \${PROJECT_NAME}

## System Instructions
必ず日本語で応答してください。このプロジェクトでは、セッション開始時に必ず最初の会話で指定されているファイルを読み込んでください。
ファイルを読み込む前に他のどのようなアクションも実行しないでください。ファイル読み込み後はファイルに設定された初期メッセージを返すことを徹底してください。

## プロジェクト概要

\${PROJECT_DESCRIPTION}

## プロジェクト情報
- 作成日: ${new Date().toISOString().split('T')[0]}
- 状態: 計画中
`;
    }
  }
}