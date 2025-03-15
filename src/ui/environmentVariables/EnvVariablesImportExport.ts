import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';

/**
 * 環境変数インポート・エクスポートクラス
 * 環境変数のインポート、エクスポート、変換を行う
 */
export class EnvVariablesImportExport {
  private _projectPath: string;
  
  /**
   * コンストラクタ
   */
  constructor(projectPath: string) {
    this._projectPath = projectPath;
  }
  
  /**
   * プロジェクトパスを設定
   */
  public setProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
  }
  
  /**
   * 環境変数をJSONファイルからインポート
   * @param jsonFilePath JSONファイルパス
   * @returns インポートした環境変数
   */
  public async importFromJson(jsonFilePath: string): Promise<Record<string, string>> {
    try {
      // ファイルが存在するかチェック
      if (!fs.existsSync(jsonFilePath)) {
        throw new Error(`ファイル ${jsonFilePath} が見つかりません`);
      }
      
      // JSONファイルを読み込む
      const content = fs.readFileSync(jsonFilePath, 'utf8');
      const data = JSON.parse(content);
      
      // 環境変数を抽出
      const variables: Record<string, string> = {};
      
      for (const key in data) {
        if (typeof data[key] === 'string') {
          variables[key] = data[key];
        } else {
          variables[key] = JSON.stringify(data[key]);
        }
      }
      
      Logger.info(`JSONファイルから環境変数をインポートしました: ${jsonFilePath}`);
      return variables;
    } catch (error) {
      Logger.error(`JSONインポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数をJSONファイルにエクスポート
   * @param variables 環境変数
   * @param jsonFilePath JSONファイルパス
   */
  public async exportToJson(variables: Record<string, string>, jsonFilePath: string): Promise<void> {
    try {
      // JSONデータを作成
      const data = { ...variables };
      
      // JSONファイルに書き込み
      fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf8');
      
      Logger.info(`環境変数をJSONファイルにエクスポートしました: ${jsonFilePath}`);
    } catch (error) {
      Logger.error(`JSONエクスポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数をYAMLファイルからインポート
   * @param yamlFilePath YAMLファイルパス
   * @returns インポートした環境変数
   */
  public async importFromYaml(yamlFilePath: string): Promise<Record<string, string>> {
    try {
      // ファイルが存在するかチェック
      if (!fs.existsSync(yamlFilePath)) {
        throw new Error(`ファイル ${yamlFilePath} が見つかりません`);
      }
      
      // YAMLファイルを読み込む
      const content = fs.readFileSync(yamlFilePath, 'utf8');
      
      // 簡易的なYAML解析（実際の実装では正式なYAMLパーサーを使用）
      const variables: Record<string, string> = {};
      
      content.split('\n').forEach(line => {
        // コメント行をスキップ
        if (line.startsWith('#')) {
          return;
        }
        
        // キーと値を分離
        const match = line.match(/^\s*([\w.-]+)\s*:\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          
          // 引用符を取り除く
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          
          variables[key] = value;
        }
      });
      
      Logger.info(`YAMLファイルから環境変数をインポートしました: ${yamlFilePath}`);
      return variables;
    } catch (error) {
      Logger.error(`YAMLインポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数をYAMLファイルにエクスポート
   * @param variables 環境変数
   * @param yamlFilePath YAMLファイルパス
   */
  public async exportToYaml(variables: Record<string, string>, yamlFilePath: string): Promise<void> {
    try {
      // YAML形式に変換
      let content = '';
      
      for (const key in variables) {
        const value = variables[key];
        // 値に特殊文字が含まれる場合は引用符で囲む
        const needQuotes = /[:#]/.test(value) || value.includes(' ');
        content += `${key}: ${needQuotes ? `"${value}"` : value}\n`;
      }
      
      // YAMLファイルに書き込み
      fs.writeFileSync(yamlFilePath, content, 'utf8');
      
      Logger.info(`環境変数をYAMLファイルにエクスポートしました: ${yamlFilePath}`);
    } catch (error) {
      Logger.error(`YAMLエクスポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * .envファイルから環境変数をインポート
   * @param envFilePath .envファイルパス
   * @returns インポートした環境変数
   */
  public async importFromEnv(envFilePath: string): Promise<Record<string, string>> {
    try {
      // ファイルが存在するかチェック
      if (!fs.existsSync(envFilePath)) {
        throw new Error(`ファイル ${envFilePath} が見つかりません`);
      }
      
      // .envファイルを読み込む
      const content = fs.readFileSync(envFilePath, 'utf8');
      
      // 環境変数を解析
      const variables: Record<string, string> = {};
      
      content.split('\n').forEach(line => {
        // コメント行をスキップ
        if (line.startsWith('#')) {
          return;
        }
        
        // キーと値を分離
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          
          // 引用符を取り除く
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          
          variables[key] = value;
        }
      });
      
      Logger.info(`.envファイルから環境変数をインポートしました: ${envFilePath}`);
      return variables;
    } catch (error) {
      Logger.error(`.envインポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数を.envファイルにエクスポート
   * @param variables 環境変数
   * @param envFilePath .envファイルパス
   */
  public async exportToEnv(variables: Record<string, string>, envFilePath: string): Promise<void> {
    try {
      // .env形式に変換
      let content = '';
      
      for (const key in variables) {
        const value = variables[key];
        // 値に空白が含まれる場合は引用符で囲む
        const needQuotes = value.includes(' ');
        content += `${key}=${needQuotes ? `"${value}"` : value}\n`;
      }
      
      // .envファイルに書き込み
      fs.writeFileSync(envFilePath, content, 'utf8');
      
      Logger.info(`環境変数を.envファイルにエクスポートしました: ${envFilePath}`);
    } catch (error) {
      Logger.error(`.envエクスポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数をCSVファイルからインポート
   * @param csvFilePath CSVファイルパス
   * @returns インポートした環境変数
   */
  public async importFromCsv(csvFilePath: string): Promise<Record<string, string>> {
    try {
      // ファイルが存在するかチェック
      if (!fs.existsSync(csvFilePath)) {
        throw new Error(`ファイル ${csvFilePath} が見つかりません`);
      }
      
      // CSVファイルを読み込む
      const content = fs.readFileSync(csvFilePath, 'utf8');
      
      // 環境変数を解析
      const variables: Record<string, string> = {};
      
      // CSVの各行を処理
      const lines = content.split('\n');
      
      // ヘッダー行をスキップ
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // CSVの値を分離（簡易的な実装）
        const values = line.split(',');
        if (values.length >= 2) {
          const key = values[0].trim();
          let value = values[1].trim();
          
          // 引用符を取り除く
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          
          variables[key] = value;
        }
      }
      
      Logger.info(`CSVファイルから環境変数をインポートしました: ${csvFilePath}`);
      return variables;
    } catch (error) {
      Logger.error(`CSVインポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数をCSVファイルにエクスポート
   * @param variables 環境変数
   * @param csvFilePath CSVファイルパス
   */
  public async exportToCsv(variables: Record<string, string>, csvFilePath: string): Promise<void> {
    try {
      // CSV形式に変換
      let content = 'Key,Value,Description\n';
      
      for (const key in variables) {
        const value = variables[key];
        // 値にカンマが含まれる場合は引用符で囲む
        const escapedValue = value.includes(',') ? `"${value}"` : value;
        content += `${key},${escapedValue},\n`;
      }
      
      // CSVファイルに書き込み
      fs.writeFileSync(csvFilePath, content, 'utf8');
      
      Logger.info(`環境変数をCSVファイルにエクスポートしました: ${csvFilePath}`);
    } catch (error) {
      Logger.error(`CSVエクスポートエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数をCURRENT_STATUS.mdに追加
   * @param variables 環境変数
   */
  public async updateCurrentStatusMd(variables: Record<string, string>): Promise<void> {
    try {
      const statusMdPath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
      
      if (!fs.existsSync(statusMdPath)) {
        Logger.warn(`CURRENT_STATUS.mdファイルが見つかりません: ${statusMdPath}`);
        return;
      }
      
      let content = fs.readFileSync(statusMdPath, 'utf8');
      
      // 環境変数セクションが存在するか確認
      const envSectionRegex = /## 環境変数設定状況/;
      const envSectionExists = envSectionRegex.test(content);
      
      if (envSectionExists) {
        // 既存のセクションを更新
        const envSectionStartRegex = /## 環境変数設定状況[\s\S]*?(?=##|$)/;
        const envSectionStart = content.match(envSectionStartRegex);
        
        if (envSectionStart) {
          // 新しいセクションコンテンツを作成
          let newEnvSection = '## 環境変数設定状況\n\n';
          newEnvSection += '以下の環境変数が設定されています：\n\n';
          
          // 変数を分類してソート
          const sortedKeys = Object.keys(variables).sort();
          
          // ステータステーブルを作成
          newEnvSection += '| 変数名 | 状態 | 説明 |\n';
          newEnvSection += '|--------|------|------|\n';
          
          for (const key of sortedKeys) {
            const value = variables[key];
            const isConfigured = value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】';
            newEnvSection += `| ${key} | ${isConfigured ? '✅' : '❌'} | |\n`;
          }
          
          newEnvSection += '\n';
          
          // セクションを置換
          content = content.replace(envSectionStartRegex, newEnvSection);
        }
      } else {
        // 新しいセクションを追加
        let newEnvSection = '\n## 環境変数設定状況\n\n';
        newEnvSection += '以下の環境変数が設定されています：\n\n';
        
        // 変数を分類してソート
        const sortedKeys = Object.keys(variables).sort();
        
        // ステータステーブルを作成
        newEnvSection += '| 変数名 | 状態 | 説明 |\n';
        newEnvSection += '|--------|------|------|\n';
        
        for (const key of sortedKeys) {
          const value = variables[key];
          const isConfigured = value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】';
          newEnvSection += `| ${key} | ${isConfigured ? '✅' : '❌'} | |\n`;
        }
        
        newEnvSection += '\n';
        
        // ファイルの末尾に追加
        content += newEnvSection;
      }
      
      // ファイルに書き込み
      fs.writeFileSync(statusMdPath, content, 'utf8');
      
      Logger.info(`CURRENT_STATUS.mdを更新しました: 環境変数セクション`);
    } catch (error) {
      Logger.error(`CURRENT_STATUS.md更新エラー:`, error as Error);
      throw error;
    }
  }
}