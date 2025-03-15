import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../../utils/logger';

/**
 * エラーセッションの型定義
 */
interface ErrorSession {
  id: string;
  errorLog: string;
  errorType?: string;
  relatedFiles?: string[];
  status: 'new' | 'investigating' | 'resolved' | 'archived';
  createdAt: string;
  investigationStartTime?: string;
  resolvedTime?: string;
  solution?: string;
  solutionApplied?: boolean;
  solutionAppliedTime?: string;
}

/**
 * エラーセッションマネージャー
 * エラーセッションの作成、取得、更新、アーカイブを管理するクラス
 */
export class ErrorSessionManager {
  private _projectPath: string;
  private _debugPath: string;
  private _sessionsPath: string;
  private _archivedPath: string;
  
  /**
   * コンストラクタ
   */
  constructor(projectPath: string) {
    this._projectPath = projectPath;
    this._debugPath = path.join(projectPath, 'logs', 'debug');
    this._sessionsPath = path.join(this._debugPath, 'sessions');
    this._archivedPath = path.join(this._debugPath, 'archived');
  }
  
  /**
   * プロジェクトパスを更新
   */
  public updateProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    this._debugPath = path.join(projectPath, 'logs', 'debug');
    this._sessionsPath = path.join(this._debugPath, 'sessions');
    this._archivedPath = path.join(this._debugPath, 'archived');
    
    Logger.info(`エラーセッションマネージャーのプロジェクトパスを更新しました: ${projectPath}`);
  }
  
  /**
   * 初期化
   */
  public async initialize(): Promise<void> {
    try {
      // セッションディレクトリを作成
      if (!fs.existsSync(this._sessionsPath)) {
        fs.mkdirSync(this._sessionsPath, { recursive: true });
      }
      
      // アーカイブディレクトリを作成
      if (!fs.existsSync(this._archivedPath)) {
        fs.mkdirSync(this._archivedPath, { recursive: true });
      }
      
      // 古いセッションのクリーンアップ
      await this._cleanupOldSessions();
      
      Logger.info(`エラーセッションマネージャーを初期化しました: ${this._sessionsPath}`);
    } catch (error) {
      Logger.error('エラーセッションマネージャー初期化エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 古いセッションのクリーンアップ
   * 48時間以上経過したセッションを自動的にアーカイブ
   */
  private async _cleanupOldSessions(): Promise<void> {
    try {
      // セッションディレクトリ内のファイルを取得
      const files = fs.readdirSync(this._sessionsPath);
      
      // 現在時刻
      const now = new Date();
      
      // 各ファイルをチェック
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this._sessionsPath, file);
        
        try {
          // ファイルのメタデータを取得
          const stats = fs.statSync(filePath);
          const lastModified = new Date(stats.mtime);
          
          // 48時間以上経過しているか確認
          const diff = now.getTime() - lastModified.getTime();
          const hoursDiff = diff / (1000 * 60 * 60);
          
          if (hoursDiff >= 48) {
            // セッション情報を読み込み
            const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // セッションをアーカイブ
            await this.archiveSession(sessionData.id);
            
            Logger.info(`古いセッションをアーカイブしました: ${sessionData.id}`);
          }
        } catch (e) {
          Logger.error(`セッションファイル処理エラー: ${file}`, e as Error);
        }
      }
      
      Logger.info('古いセッションのクリーンアップが完了しました');
    } catch (error) {
      Logger.error('セッションクリーンアップエラー', error as Error);
    }
  }
  
  /**
   * セッションの作成
   */
  public async createSession(errorLog: string): Promise<string> {
    try {
      // セッションIDを生成
      const sessionId = this._generateSessionId();
      
      // エラーの短い説明を生成
      const errorSummary = this._generateErrorSummary(errorLog);
      
      // セッション情報を作成
      const session: ErrorSession = {
        id: sessionId,
        errorLog,
        status: 'new',
        createdAt: new Date().toISOString(),
      };
      
      // セッションファイルのパスを生成
      const sessionFilePath = path.join(
        this._sessionsPath, 
        `${sessionId}-${this._sanitizeFileName(errorSummary)}.json`
      );
      
      // セッションファイルを作成
      fs.writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), 'utf8');
      
      Logger.info(`エラーセッションを作成しました: ${sessionId}`);
      
      return sessionId;
    } catch (error) {
      Logger.error('エラーセッション作成エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * セッションの取得
   */
  public async getSession(sessionId: string): Promise<ErrorSession | null> {
    try {
      // セッションフォルダ内の全ファイルを検索
      const files = fs.readdirSync(this._sessionsPath);
      
      // セッションIDに一致するファイルを検索
      const sessionFile = files.find(file => file.startsWith(`${sessionId}-`) && file.endsWith('.json'));
      
      if (!sessionFile) {
        return null;
      }
      
      // セッションファイルを読み込み
      const sessionFilePath = path.join(this._sessionsPath, sessionFile);
      const sessionData = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
      
      return sessionData;
    } catch (error) {
      Logger.error(`エラーセッション取得エラー: ${sessionId}`, error as Error);
      return null;
    }
  }
  
  /**
   * セッションの更新
   */
  public async updateSession(sessionId: string, updates: Partial<ErrorSession>): Promise<boolean> {
    try {
      // セッションを取得
      const session = await this.getSession(sessionId);
      
      if (!session) {
        throw new Error(`セッションが見つかりません: ${sessionId}`);
      }
      
      // セッション情報を更新
      const updatedSession = { ...session, ...updates };
      
      // セッションフォルダ内の全ファイルを検索
      const files = fs.readdirSync(this._sessionsPath);
      
      // セッションIDに一致するファイルを検索
      const sessionFile = files.find(file => file.startsWith(`${sessionId}-`) && file.endsWith('.json'));
      
      if (!sessionFile) {
        throw new Error(`セッションファイルが見つかりません: ${sessionId}`);
      }
      
      // セッションファイルを更新
      const sessionFilePath = path.join(this._sessionsPath, sessionFile);
      fs.writeFileSync(sessionFilePath, JSON.stringify(updatedSession, null, 2), 'utf8');
      
      Logger.info(`エラーセッションを更新しました: ${sessionId}`);
      
      return true;
    } catch (error) {
      Logger.error(`エラーセッション更新エラー: ${sessionId}`, error as Error);
      throw error;
    }
  }
  
  /**
   * セッションのアーカイブ
   */
  public async archiveSession(sessionId: string): Promise<boolean> {
    try {
      // セッションを取得
      const session = await this.getSession(sessionId);
      
      if (!session) {
        throw new Error(`セッションが見つかりません: ${sessionId}`);
      }
      
      // セッションフォルダ内の全ファイルを検索
      const files = fs.readdirSync(this._sessionsPath);
      
      // セッションIDに一致するファイルを検索
      const sessionFile = files.find(file => file.startsWith(`${sessionId}-`) && file.endsWith('.json'));
      
      if (!sessionFile) {
        throw new Error(`セッションファイルが見つかりません: ${sessionId}`);
      }
      
      // セッションファイルのパス
      const sessionFilePath = path.join(this._sessionsPath, sessionFile);
      
      // アーカイブファイルのパス
      const archivedFilePath = path.join(this._archivedPath, sessionFile);
      
      // セッションをアーカイブ済みに更新
      const archivedSession = { ...session, status: 'archived' };
      
      // アーカイブファイルを作成
      fs.writeFileSync(archivedFilePath, JSON.stringify(archivedSession, null, 2), 'utf8');
      
      // 元のセッションファイルを削除
      fs.unlinkSync(sessionFilePath);
      
      Logger.info(`エラーセッションをアーカイブしました: ${sessionId}`);
      
      return true;
    } catch (error) {
      Logger.error(`エラーセッションアーカイブエラー: ${sessionId}`, error as Error);
      throw error;
    }
  }
  
  /**
   * 全セッションの取得
   */
  public async getAllSessions(): Promise<ErrorSession[]> {
    try {
      // セッションフォルダ内の全ファイルを検索
      const files = fs.readdirSync(this._sessionsPath);
      
      // JSONファイルのみを対象にする
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      // 各セッションファイルを読み込む
      const sessions: ErrorSession[] = [];
      
      for (const file of sessionFiles) {
        try {
          const filePath = path.join(this._sessionsPath, file);
          const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          sessions.push(sessionData);
        } catch (e) {
          Logger.error(`セッションファイル読み込みエラー: ${file}`, e as Error);
        }
      }
      
      // 作成日時の降順でソート（新しい順）
      return sessions.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } catch (error) {
      Logger.error('セッション一覧取得エラー', error as Error);
      return [];
    }
  }
  
  /**
   * 類似セッションの検索
   */
  public async findSimilarSessions(errorLog: string): Promise<ErrorSession[]> {
    try {
      // 全セッションを取得
      const allSessions = await this.getAllSessions();
      
      // キーワードを抽出
      const keywords = this._extractKeywords(errorLog);
      
      // 各セッションごとにスコアを計算
      const scoredSessions = allSessions.map(session => {
        const score = this._calculateSimilarityScore(session.errorLog, keywords);
        return { session, score };
      });
      
      // スコアが一定以上のセッションのみを抽出（スコア降順）
      const similarSessions = scoredSessions
        .filter(({ score }) => score > 0.3) // 30%以上の類似度
        .sort((a, b) => b.score - a.score)
        .map(({ session }) => session);
      
      return similarSessions;
    } catch (error) {
      Logger.error('類似セッション検索エラー', error as Error);
      return [];
    }
  }
  
  /**
   * セッションIDの生成
   */
  private _generateSessionId(): string {
    // タイムスタンプと乱数から一意のIDを生成
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    
    return `${timestamp}-${random}`;
  }
  
  /**
   * エラーの短い説明を生成
   */
  private _generateErrorSummary(errorLog: string): string {
    // エラーログから最初の行を取得
    const firstLine = errorLog.split('\n')[0].trim();
    
    // 短い説明を生成（最大50文字）
    const summary = firstLine.length > 50 
      ? firstLine.substring(0, 47) + '...' 
      : firstLine;
      
    return summary;
  }
  
  /**
   * ファイル名の安全化
   */
  private _sanitizeFileName(fileName: string): string {
    // ファイル名に使用できない文字を除去
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // 禁止文字を置換
      .replace(/\s+/g, '_')          // 空白を_に置換
      .substring(0, 50);             // 長さを制限
  }
  
  /**
   * キーワード抽出
   */
  private _extractKeywords(text: string): string[] {
    // エラーメッセージから重要な単語を抽出
    const keywords: string[] = [];
    
    // 行ごとに処理
    const lines = text.split('\n');
    
    for (const line of lines) {
      // エラーコードやメッセージを抽出
      const errorPatterns = [
        /([A-Z][a-zA-Z0-9_]+Error)/g,        // エラークラス名
        /(ENOENT|EACCES|EPERM|EEXIST)/g,     // ファイル操作エラー
        /(Cannot find module|Module not found)/g, // モジュールエラー
        /(Connection refused|ECONNREFUSED|timeout)/g, // 接続エラー
        /(undefined is not a function|is not a function)/g, // 型エラー
        /(DatabaseError|MongoError|SequelizeError)/g, // データベースエラー
        /(Cannot read property|Cannot access|is undefined)/g, // プロパティアクセスエラー
        /(?:at |from |in )([^()\n:]+\.(?:js|ts|jsx|tsx|vue|html|css|scss|json))/g, // ファイルパス
      ];
      
      for (const pattern of errorPatterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          keywords.push(match[1].trim());
        }
      }
    }
    
    // 重複を削除
    return [...new Set(keywords)];
  }
  
  /**
   * 類似度スコアの計算
   */
  private _calculateSimilarityScore(errorLog: string, keywords: string[]): number {
    let matchCount = 0;
    
    // 各キーワードについてチェック
    for (const keyword of keywords) {
      if (errorLog.includes(keyword)) {
        matchCount++;
      }
    }
    
    // キーワードがない場合は0を返す
    if (keywords.length === 0) {
      return 0;
    }
    
    // 類似度スコアを計算（0～1）
    return matchCount / keywords.length;
  }
}