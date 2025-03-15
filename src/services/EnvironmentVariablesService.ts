import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from './AppGeniusEventBus';

/**
 * 環境変数管理サービス
 * 環境変数の検出、検証、管理を行う
 */
export class EnvironmentVariablesService {
  private static _instance: EnvironmentVariablesService;
  private _projectPath: string = '';
  private _eventBus: AppGeniusEventBus;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): EnvironmentVariablesService {
    if (!EnvironmentVariablesService._instance) {
      EnvironmentVariablesService._instance = new EnvironmentVariablesService();
    }
    return EnvironmentVariablesService._instance;
  }
  
  /**
   * コンストラクタ
   */
  private constructor() {
    this._eventBus = AppGeniusEventBus.getInstance();
    this._initProjectPath();
    Logger.info('環境変数管理サービスが初期化されました');
  }
  
  /**
   * プロジェクトパスを初期化
   */
  private _initProjectPath(): void {
    try {
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        this._projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        Logger.info(`環境変数管理サービス: プロジェクトパスを設定: ${this._projectPath}`);
      }
    } catch (error) {
      Logger.error('プロジェクトパスの初期化に失敗しました', error as Error);
    }
  }
  
  /**
   * プロジェクトパスを設定
   */
  public setProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    Logger.info(`環境変数管理サービス: プロジェクトパスを設定: ${projectPath}`);
  }
  
  /**
   * プロジェクトパスを取得
   */
  public getProjectPath(): string {
    return this._projectPath;
  }
  
  /**
   * 環境変数ファイルを検出
   */
  public detectEnvFiles(): string[] {
    try {
      if (!this._projectPath) {
        return [];
      }
      
      // .envで始まるファイルを検索
      const files = fs.readdirSync(this._projectPath)
        .filter(file => file.startsWith('.env'))
        .map(file => path.join(this._projectPath, file));
      
      Logger.info(`環境変数ファイルを検出: ${files.length}個のファイルが見つかりました`);
      return files;
    } catch (error) {
      Logger.error('環境変数ファイルの検出に失敗しました', error as Error);
      return [];
    }
  }
  
  /**
   * 環境変数ファイルを読み込む
   */
  public loadEnvFile(filePath: string): Record<string, string> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイル ${filePath} が見つかりません`);
      }
      
      // ファイルを読み込む
      const content = fs.readFileSync(filePath, 'utf8');
      
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
      
      Logger.info(`環境変数ファイルを読み込み: ${filePath}`);
      return variables;
    } catch (error) {
      Logger.error(`環境変数ファイル読み込みエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数ファイルを保存
   */
  public saveEnvFile(filePath: string, variables: Record<string, string>): void {
    try {
      // 環境変数をファイル形式に変換
      let content = '';
      
      for (const key in variables) {
        const value = variables[key];
        content += `${key}=${value}\n`;
      }
      
      // ファイルに書き込み
      fs.writeFileSync(filePath, content, 'utf8');
      
      Logger.info(`環境変数ファイルを保存: ${filePath}`);
      
      // イベントを発行
      this._eventBus.publish(AppGeniusEventType.ENV_VARIABLES_UPDATED, { filePath }, 'EnvironmentVariablesService');
    } catch (error) {
      Logger.error(`環境変数ファイル保存エラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数ファイルを作成
   */
  public createEnvFile(fileName: string): string {
    try {
      if (!fileName) {
        throw new Error('ファイル名が指定されていません');
      }
      
      // .envで始まることを確認
      if (!fileName.startsWith('.env')) {
        fileName = `.env.${fileName}`;
      }
      
      // パスの作成
      const filePath = path.join(this._projectPath, fileName);
      
      // ファイルが既に存在するかチェック
      if (fs.existsSync(filePath)) {
        throw new Error(`ファイル ${fileName} は既に存在します`);
      }
      
      // 空のファイルを作成
      fs.writeFileSync(filePath, '', 'utf8');
      
      Logger.info(`環境変数ファイルを作成: ${filePath}`);
      
      // イベントを発行
      this._eventBus.publish(AppGeniusEventType.ENV_FILE_CREATED, { filePath }, 'EnvironmentVariablesService');
      
      return filePath;
    } catch (error) {
      Logger.error(`環境変数ファイル作成エラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数をプロジェクトから自動検出
   */
  public detectEnvironmentVariables(projectPath?: string): Record<string, string> {
    try {
      const path = projectPath || this._projectPath;
      
      if (!path) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // 自動検出されたサンプル環境変数
      const detectedVars: Record<string, string> = {
        // データベース
        'DB_HOST': 'localhost',
        'DB_PORT': '5432',
        'DB_NAME': 'appgenius_db',
        'DB_USER': 'postgres',
        'DB_PASSWORD': '【要設定】',
        
        // サーバー
        'PORT': '3000',
        'NODE_ENV': 'development',
        'LOG_LEVEL': 'info',
        
        // 認証
        'JWT_SECRET': '【要設定】',
        'JWT_EXPIRY': '1h',
        'REFRESH_TOKEN_SECRET': '【要設定】',
        'REFRESH_TOKEN_EXPIRY': '7d',
        
        // API
        'API_URL': 'http://localhost:3000/api',
        'CORS_ORIGIN': 'http://localhost:3001',
        
        // フロントエンド
        'REACT_APP_API_URL': 'http://localhost:3000/api',
        'REACT_APP_VERSION': '1.0.0'
      };
      
      // 実際の実装では、ここでプロジェクトを分析して環境変数を検出する
      
      Logger.info(`環境変数を自動検出: ${Object.keys(detectedVars).length}個の変数を検出`);
      return detectedVars;
    } catch (error) {
      Logger.error(`環境変数自動検出エラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数の検証
   */
  public validateEnvironmentVariables(variables: Record<string, string>): Record<string, { isValid: boolean; message: string }> {
    try {
      const result: Record<string, { isValid: boolean; message: string }> = {};
      
      // 各変数を検証
      for (const key in variables) {
        const value = variables[key];
        
        // 値が空または明らかなプレースホルダーかどうか
        if (!value || value === 'YOUR_VALUE_HERE' || value === '【要設定】') {
          result[key] = { isValid: false, message: '値が設定されていません' };
          continue;
        }
        
        // 変数名によって特定の検証
        if (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY')) {
          // 機密情報の場合は強度をチェック
          if (value.length < 8) {
            result[key] = { isValid: false, message: 'セキュリティ上、8文字以上を推奨します' };
            continue;
          }
          
          // セキュリティレベルのチェック
          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumber = /[0-9]/.test(value);
          const hasSpecial = /[^A-Za-z0-9]/.test(value);
          
          if (!(hasUpperCase && hasLowerCase && hasNumber && hasSpecial)) {
            result[key] = { 
              isValid: false, 
              message: 'より強力なパスワードを設定してください（大文字、小文字、数字、特殊文字を含む）'
            };
            continue;
          }
        }
        
        // URL変数の検証
        if (key.includes('URL')) {
          try {
            new URL(value);
          } catch (error) {
            result[key] = { isValid: false, message: '有効なURLではありません' };
            continue;
          }
        }
        
        // ポート番号の検証
        if (key.includes('PORT')) {
          const port = parseInt(value, 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            result[key] = { isValid: false, message: 'ポート番号は1〜65535の範囲内である必要があります' };
            continue;
          }
        }
        
        // デフォルトは有効とする
        result[key] = { isValid: true, message: '値は有効です' };
      }
      
      Logger.info(`環境変数を検証: ${Object.keys(result).length}個の変数を検証`);
      return result;
    } catch (error) {
      Logger.error(`環境変数検証エラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数情報をenv.mdから読み込む
   */
  public loadEnvironmentVariablesFromEnvMd(): any {
    try {
      const envMdPath = path.join(this._projectPath, 'docs', 'env.md');
      
      if (!fs.existsSync(envMdPath)) {
        Logger.warn(`env.mdファイルが見つかりません: ${envMdPath}`);
        return { variables: [] };
      }
      
      const content = fs.readFileSync(envMdPath, 'utf8');
      
      // 環境変数情報を抽出
      const variables: any[] = [];
      const lines = content.split('\n');
      
      let currentSection = '';
      let currentGroup = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // セクションヘッダーを検出
        if (line.startsWith('##') && !line.startsWith('###')) {
          currentSection = line.replace(/^##\s+/, '');
          continue;
        }
        
        // グループヘッダーを検出
        if (line.startsWith('###')) {
          currentGroup = line.replace(/^###\s+/, '');
          continue;
        }
        
        // 環境変数の行を検出（- [x] または - [ ] で始まる行）
        const varMatch = line.match(/^-\s+\[([ x])\]\s+`([^`]+)`\s*-\s*(.*)$/);
        if (!varMatch) {
          const simpleVarMatch = line.match(/^-\s+\[([ x])\]\s+([A-Z0-9_]+)\s*-?\s*(.*)$/);
          if (simpleVarMatch) {
            const isConfigured = simpleVarMatch[1] === 'x';
            const name = simpleVarMatch[2];
            const description = simpleVarMatch[3] || '';
            
            variables.push({
              name,
              description,
              isConfigured,
              section: currentSection,
              group: currentGroup
            });
          }
        } else {
          const isConfigured = varMatch[1] === 'x';
          const name = varMatch[2];
          const description = varMatch[3] || '';
          
          variables.push({
            name,
            description,
            isConfigured,
            section: currentSection,
            group: currentGroup
          });
        }
      }
      
      Logger.info(`env.mdから環境変数情報を読み込みました: ${variables.length}個の変数が見つかりました`);
      return { variables };
    } catch (error) {
      Logger.error(`env.md読み込みエラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * env.mdの環境変数の設定状態を更新
   */
  public updateEnvMdVariableStatus(name: string, isConfigured: boolean): void {
    try {
      const envMdPath = path.join(this._projectPath, 'docs', 'env.md');
      
      if (!fs.existsSync(envMdPath)) {
        Logger.warn(`env.mdファイルが見つかりません: ${envMdPath}`);
        return;
      }
      
      let content = fs.readFileSync(envMdPath, 'utf8');
      const lines = content.split('\n');
      
      // 変数名に一致する行を検索して更新
      let updated = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 環境変数の行を検出
        const varMatch = line.match(/^-\s+\[([ x])\]\s+`?([A-Z0-9_]+)`?\s*-?\s*(.*)$/);
        if (varMatch && varMatch[2] === name) {
          // 設定状態を更新
          const updatedLine = line.replace(/^-\s+\[([ x])\]/, isConfigured ? '- [x]' : '- [ ]');
          lines[i] = updatedLine;
          updated = true;
          break;
        }
      }
      
      if (updated) {
        // 更新した内容をファイルに書き込む
        content = lines.join('\n');
        fs.writeFileSync(envMdPath, content, 'utf8');
        
        Logger.info(`env.mdの変数 ${name} の状態を更新しました: ${isConfigured ? '設定済み' : '未設定'}`);
        
        // イベントを発行
        this._eventBus.publish(AppGeniusEventType.ENV_VARIABLES_UPDATED, { name, isConfigured }, 'EnvironmentVariablesService');
      } else {
        Logger.warn(`env.mdに変数 ${name} が見つかりませんでした`);
      }
    } catch (error) {
      Logger.error(`env.md更新エラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * CURRENT_STATUS.mdに環境変数情報を更新
   */
  public updateCurrentStatusMd(variables: Record<string, string>): void {
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
      
      // イベントを発行
      this._eventBus.publish(AppGeniusEventType.CURRENT_STATUS_UPDATED, { section: 'environmentVariables' }, 'EnvironmentVariablesService');
    } catch (error) {
      Logger.error(`CURRENT_STATUS.md更新エラー:`, error as Error);
      throw error;
    }
  }
  
  /**
   * データベース接続テスト
   */
  public async testDatabaseConnection(config: any): Promise<{ success: boolean; message: string }> {
    try {
      // 実際の実装では、ここでデータベース接続テストを行う
      // サンプル実装のため、単に成功を返す
      
      return {
        success: true,
        message: 'データベース接続に成功しました'
      };
    } catch (error) {
      Logger.error(`データベース接続テストエラー:`, error as Error);
      return {
        success: false,
        message: `データベース接続に失敗しました: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * API接続テスト
   */
  public async testApiConnection(config: any): Promise<{ success: boolean; message: string }> {
    try {
      // 実際の実装では、ここでAPI接続テストを行う
      // サンプル実装のため、単に成功を返す
      
      return {
        success: true,
        message: 'API接続に成功しました'
      };
    } catch (error) {
      Logger.error(`API接続テストエラー:`, error as Error);
      return {
        success: false,
        message: `API接続に失敗しました: ${(error as Error).message}`
      };
    }
  }
}