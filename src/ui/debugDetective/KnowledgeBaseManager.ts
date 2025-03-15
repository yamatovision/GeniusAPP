import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../../utils/logger';

/**
 * 知見の型定義
 */
interface Knowledge {
  id?: string;
  title: string;
  errorType: string;
  problem: string;
  solution: string;
  relatedFiles?: string[];
  tags?: string[];
  createdAt: string;
}

/**
 * 知見ベースマネージャー
 * デバッグ知見の保存、検索、管理を行うクラス
 */
export class KnowledgeBaseManager {
  private _projectPath: string;
  private _debugPath: string;
  private _knowledgePath: string;
  
  /**
   * コンストラクタ
   */
  constructor(projectPath: string) {
    this._projectPath = projectPath;
    this._debugPath = path.join(projectPath, 'logs', 'debug');
    this._knowledgePath = path.join(this._debugPath, 'knowledge');
  }
  
  /**
   * プロジェクトパスを更新
   */
  public updateProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    this._debugPath = path.join(projectPath, 'logs', 'debug');
    this._knowledgePath = path.join(this._debugPath, 'knowledge');
    
    Logger.info(`知見ベースマネージャーのプロジェクトパスを更新しました: ${projectPath}`);
  }
  
  /**
   * 初期化
   */
  public async initialize(): Promise<void> {
    try {
      // 知見ディレクトリを作成
      if (!fs.existsSync(this._knowledgePath)) {
        fs.mkdirSync(this._knowledgePath, { recursive: true });
      }
      
      Logger.info(`知見ベースマネージャーを初期化しました: ${this._knowledgePath}`);
    } catch (error) {
      Logger.error('知見ベースマネージャー初期化エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 知見の追加
   */
  public async addKnowledge(knowledge: Knowledge): Promise<string> {
    try {
      // 知見IDを生成
      const knowledgeId = knowledge.id || this._generateKnowledgeId();
      
      // タイトルから安全なファイル名を生成
      const safeTitle = this._sanitizeFileName(knowledge.title);
      
      // 知見情報を作成
      const knowledgeData: Knowledge = {
        ...knowledge,
        id: knowledgeId,
        createdAt: knowledge.createdAt || new Date().toISOString()
      };
      
      // タグが文字列の場合、配列に変換
      if (typeof knowledgeData.tags === 'string') {
        knowledgeData.tags = (knowledgeData.tags as string)
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag !== '');
      }
      
      // 知見ファイルのパスを生成
      const knowledgeFilePath = path.join(
        this._knowledgePath, 
        `${knowledgeId}-${safeTitle}.json`
      );
      
      // 知見ファイルを作成
      fs.writeFileSync(knowledgeFilePath, JSON.stringify(knowledgeData, null, 2), 'utf8');
      
      // 実装注意点ドキュメントを更新
      await this._updateImplementationNotes(knowledgeData);
      
      Logger.info(`知見を追加しました: ${knowledgeId}`);
      
      return knowledgeId;
    } catch (error) {
      Logger.error('知見追加エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 知見の取得
   */
  public async getKnowledge(knowledgeId: string): Promise<Knowledge | null> {
    try {
      // 知見フォルダ内の全ファイルを検索
      const files = fs.readdirSync(this._knowledgePath);
      
      // 知見IDに一致するファイルを検索
      const knowledgeFile = files.find(file => file.startsWith(`${knowledgeId}-`) && file.endsWith('.json'));
      
      if (!knowledgeFile) {
        return null;
      }
      
      // 知見ファイルを読み込み
      const knowledgeFilePath = path.join(this._knowledgePath, knowledgeFile);
      const knowledgeData = JSON.parse(fs.readFileSync(knowledgeFilePath, 'utf8'));
      
      return knowledgeData;
    } catch (error) {
      Logger.error(`知見取得エラー: ${knowledgeId}`, error as Error);
      return null;
    }
  }
  
  /**
   * 全知見の取得
   */
  public async getAllKnowledge(filter?: any): Promise<Knowledge[]> {
    try {
      // 知見フォルダ内の全ファイルを検索
      const files = fs.readdirSync(this._knowledgePath);
      
      // JSONファイルのみを対象にする
      const knowledgeFiles = files.filter(file => file.endsWith('.json'));
      
      // 各知見ファイルを読み込む
      const knowledgeList: Knowledge[] = [];
      
      for (const file of knowledgeFiles) {
        try {
          const filePath = path.join(this._knowledgePath, file);
          const knowledgeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          knowledgeList.push(knowledgeData);
        } catch (e) {
          Logger.error(`知見ファイル読み込みエラー: ${file}`, e as Error);
        }
      }
      
      // フィルタリング
      let filteredList = knowledgeList;
      
      if (filter) {
        if (filter.errorType) {
          filteredList = filteredList.filter(item => 
            item.errorType === filter.errorType
          );
        }
        
        if (filter.keyword) {
          const keyword = filter.keyword.toLowerCase();
          filteredList = filteredList.filter(item => 
            item.title.toLowerCase().includes(keyword) ||
            item.problem.toLowerCase().includes(keyword) ||
            item.solution.toLowerCase().includes(keyword) ||
            (item.tags && item.tags.some(tag => 
              tag.toLowerCase().includes(keyword)
            ))
          );
        }
      }
      
      // 作成日時の降順でソート（新しい順）
      return filteredList.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } catch (error) {
      Logger.error('知見一覧取得エラー', error as Error);
      return [];
    }
  }
  
  /**
   * 関連知見の検索
   */
  public async findRelatedKnowledge(errorLog: string, errorType?: string): Promise<Knowledge[]> {
    try {
      // 全知見を取得
      const allKnowledge = await this.getAllKnowledge();
      
      // エラータイプによるフィルタリング
      let filteredKnowledge = allKnowledge;
      if (errorType) {
        filteredKnowledge = filteredKnowledge.filter(item => 
          item.errorType === errorType
        );
      }
      
      // キーワードを抽出
      const keywords = this._extractKeywords(errorLog);
      
      // 各知見ごとにスコアを計算
      const scoredKnowledge = filteredKnowledge.map(knowledge => {
        const score = this._calculateRelevanceScore(knowledge, keywords, errorLog);
        return { knowledge, score };
      });
      
      // スコアが一定以上の知見のみを抽出（スコア降順）
      const relatedKnowledge = scoredKnowledge
        .filter(({ score }) => score > 0.3) // 30%以上の関連度
        .sort((a, b) => b.score - a.score)
        .map(({ knowledge }) => knowledge);
      
      return relatedKnowledge;
    } catch (error) {
      Logger.error('関連知見検索エラー', error as Error);
      return [];
    }
  }
  
  /**
   * 実装注意点ドキュメントの更新
   */
  private async _updateImplementationNotes(knowledge: Knowledge): Promise<void> {
    try {
      // 実装注意点ドキュメントのパス
      const notesPath = path.join(this._projectPath, 'docs', 'implementation_notes.md');
      
      // ファイルが存在しない場合は作成
      if (!fs.existsSync(notesPath)) {
        fs.writeFileSync(notesPath, '# 実装注意点\n\n', 'utf8');
      }
      
      // 現在の内容を読み込み
      let content = fs.readFileSync(notesPath, 'utf8');
      
      // 知見を追加
      content += `\n## ${knowledge.title}\n\n`;
      content += `### 問題\n${knowledge.problem}\n\n`;
      content += `### 解決策\n${knowledge.solution}\n\n`;
      
      if (knowledge.relatedFiles && knowledge.relatedFiles.length > 0) {
        content += `### 関連ファイル\n`;
        for (const file of knowledge.relatedFiles) {
          content += `- \`${file}\`\n`;
        }
        content += '\n';
      }
      
      if (knowledge.tags && knowledge.tags.length > 0) {
        content += `### タグ\n`;
        content += knowledge.tags.map(tag => `\`${tag}\``).join(', ');
        content += '\n\n';
      }
      
      content += `### 追加日時\n${new Date(knowledge.createdAt).toLocaleString()}\n\n`;
      content += `---\n`;
      
      // ファイルを更新
      fs.writeFileSync(notesPath, content, 'utf8');
      
      // CLAUDE.md のセクションにも追加
      await this._updateClaudeMd(knowledge);
      
      Logger.info(`実装注意点ドキュメントを更新しました: ${notesPath}`);
    } catch (error) {
      Logger.error('実装注意点ドキュメント更新エラー', error as Error);
    }
  }
  
  /**
   * CLAUDE.mdの更新
   */
  private async _updateClaudeMd(knowledge: Knowledge): Promise<void> {
    try {
      // CLAUDE.mdのパス
      const claudeMdPath = path.join(this._projectPath, 'CLAUDE.md');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(claudeMdPath)) {
        return;
      }
      
      // 現在の内容を読み込み
      let content = fs.readFileSync(claudeMdPath, 'utf8');
      
      // 実装注意点セクションを探す
      const sectionTitle = '## 実装注意点';
      let sectionIndex = content.indexOf(sectionTitle);
      
      if (sectionIndex === -1) {
        // セクションが存在しない場合は追加
        content += `\n${sectionTitle}\n\n`;
        sectionIndex = content.length;
      } else {
        // セクションが存在する場合は、その後に追加
        sectionIndex += sectionTitle.length;
      }
      
      // 知見を追加
      let newContent = content.substring(0, sectionIndex);
      newContent += `\n\n### ${knowledge.title}\n`;
      newContent += `- 問題: ${knowledge.problem.split('\n')[0]}\n`;
      newContent += `- 解決策: ${knowledge.solution.split('\n')[0]}\n`;
      
      if (knowledge.relatedFiles && knowledge.relatedFiles.length > 0) {
        newContent += `- 対象ファイル: \`${knowledge.relatedFiles[0]}\``;
        if (knowledge.relatedFiles.length > 1) {
          newContent += ` 他${knowledge.relatedFiles.length - 1}ファイル`;
        }
        newContent += '\n';
      }
      
      newContent += `- 注意: このエラーに対応する際は上記の解決策を参照してください\n`;
      
      // 既存の残りの内容を追加
      newContent += content.substring(sectionIndex);
      
      // ファイルを更新
      fs.writeFileSync(claudeMdPath, newContent, 'utf8');
      
      Logger.info(`CLAUDE.mdを更新しました: ${claudeMdPath}`);
    } catch (error) {
      Logger.error('CLAUDE.md更新エラー', error as Error);
    }
  }
  
  /**
   * 知見IDの生成
   */
  private _generateKnowledgeId(): string {
    // タイムスタンプと乱数から一意のIDを生成
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    
    return `k-${timestamp}-${random}`;
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
      
      // 一般的な単語も追加
      const words = line
        .split(/\s+/)
        .filter(word => word.length > 3) // 短すぎる単語は除外
        .map(word => word.replace(/[.,;:!?'"]/g, '')); // 句読点を除去
        
      keywords.push(...words);
    }
    
    // 重複を削除
    return [...new Set(keywords)];
  }
  
  /**
   * 関連度スコアの計算
   */
  private _calculateRelevanceScore(knowledge: Knowledge, keywords: string[], errorLog: string): number {
    // 知見からも同様にキーワードを抽出
    const knowledgeKeywords = this._extractKeywords(knowledge.problem);
    
    // 一致するキーワード数をカウント
    let matchCount = 0;
    
    for (const keyword of keywords) {
      // 知見のキーワードに一致するか
      const hasMatch = knowledgeKeywords.some(k => 
        k.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(k.toLowerCase())
      );
      
      if (hasMatch) {
        matchCount++;
      }
    }
    
    // キーワードがない場合は別の方法で関連度を判定
    if (keywords.length === 0 || matchCount === 0) {
      // エラータイプが同じか
      if (errorLog.includes(knowledge.errorType)) {
        return 0.4; // 40%の関連度
      }
      
      // エラーメッセージの類似度
      const errorLogSample = errorLog.substring(0, 200).toLowerCase();
      const problemSample = knowledge.problem.substring(0, 200).toLowerCase();
      
      if (errorLogSample.includes(problemSample) || 
          problemSample.includes(errorLogSample)) {
        return 0.5; // 50%の関連度
      }
      
      return 0.1; // 10%の関連度
    }
    
    // 関連度スコアを計算（0～1）
    return matchCount / keywords.length;
  }
}