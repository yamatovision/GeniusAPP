import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from './logger';
import { ConfigManager } from './configManager';

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
   * プロジェクト用のCLAUDE.mdを生成
   */
  public async generateClaudeMd(projectPath: string, config: any): Promise<string> {
    try {
      const templatePath = path.join(__dirname, '..', '..', 'templates', 'claude_md_template.md');
      let template = fs.existsSync(templatePath) 
        ? fs.readFileSync(templatePath, 'utf8')
        : this.getDefaultTemplate();
      
      // テンプレートに置換を適用
      const claudeMd = this.applyReplacements(template, config);
      
      // CLAUDE.mdを保存
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      fs.writeFileSync(claudeMdPath, claudeMd, 'utf8');
      
      Logger.info(`CLAUDE.mdを生成しました: ${claudeMdPath}`);
      return claudeMdPath;
    } catch (error) {
      Logger.error('CLAUDE.md生成エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 既存のCLAUDE.mdを読み込む
   */
  public loadClaudeMd(projectPath: string): string | null {
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      return fs.readFileSync(claudeMdPath, 'utf8');
    }
    return null;
  }
  
  /**
   * CLAUDE.md内の指定セクションを更新
   */
  public updateClaudeMdSection(projectPath: string, sectionName: string, content: string): boolean {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(claudeMdPath)) {
        // ファイルが存在しない場合は新規作成
        const template = this.getDefaultTemplate();
        fs.writeFileSync(claudeMdPath, template, 'utf8');
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
   */
  public getClaudeMdSection(projectPath: string, sectionName: string): string | null {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(claudeMdPath)) {
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
   * テンプレートに変数を適用
   */
  private applyReplacements(template: string, config: any): string {
    return template
      .replace(/\${PROJECT_NAME}/g, config.name || 'AppGenius Project')
      .replace(/\${BUILD_COMMANDS}/g, this.formatBuildCommands(config.buildCommands))
      .replace(/\${PROJECT_STRUCTURE}/g, this.formatProjectStructure(config.structure))
      .replace(/\${REQUIREMENTS}/g, this.formatRequirements(config.requirements));
  }
  
  /**
   * ビルドコマンドをフォーマット
   */
  private formatBuildCommands(commands: string[] = []): string {
    if (!commands || commands.length === 0) {
      return '```bash\n# 開発時のビルド\nnpm install\nnpm run dev\n\n# 本番用ビルド\nnpm run build\n```';
    }
    
    return '```bash\n' + commands.join('\n') + '\n```';
  }
  
  /**
   * プロジェクト構造をフォーマット
   */
  private formatProjectStructure(structure: string = ''): string {
    if (!structure) {
      return '- `src/` - ソースコード\n- `dist/` - ビルド後のファイル\n- `public/` - 静的ファイル';
    }
    
    return structure;
  }
  
  /**
   * 要件をフォーマット
   */
  private formatRequirements(requirements: string[] = []): string {
    if (!requirements || requirements.length === 0) {
      return '1. ユーザー認証機能\n2. データ管理機能\n3. レポート生成機能';
    }
    
    return requirements.map((req, index) => `${index + 1}. ${req}`).join('\n');
  }
  
  /**
   * デフォルトのテンプレートを取得
   */
  public getDefaultTemplate(): string {
    return `# \${PROJECT_NAME} 開発ガイド

## 要件定義
\${REQUIREMENTS}

## ディレクトリ構造
\${PROJECT_STRUCTURE}

## モックアップ
UI/UXデザインの説明とモックアップへの参照を記載します。

## スコープ
実装するべき機能の詳細と優先順位を記載します。

## ビルドコマンド
\${BUILD_COMMANDS}

## コーディング規約
- クラス名: PascalCase
- メソッド名: camelCase
- プライベート変数: _camelCase
- 定数: UPPER_CASE
- インターフェース名: IPascalCase
- 型名: TPascalCase

## アーキテクチャパターン
- コンポーネント間は依存性注入を使用して結合を低く保つ
- ビジネスロジックとUIを明確に分離する
- エラーハンドリングは一貫したパターンで行う
- 非同期処理は async/await を優先的に使用する

## ワーク状況
実装状況とタスクの進捗を記録します。`;
  }
}