import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { FileSystemService } from './FileSystemService';

export interface IMarkdownService {
  // マークダウン読み込み/解析
  readMarkdownFile(filePath: string): Promise<string>;
  updateMarkdownCheckbox(filePath: string, index: number, checked: boolean): Promise<boolean>;
  parseScopes(content: string): { name: string, status: string, progress: number }[];
  
  // イベント
  onMarkdownUpdated: vscode.Event<{ filePath: string, content: string }>;
}

export class MarkdownService implements IMarkdownService {
  private _onMarkdownUpdated = new vscode.EventEmitter<{ filePath: string, content: string }>();
  public readonly onMarkdownUpdated = this._onMarkdownUpdated.event;
  
  private _fileSystemService: FileSystemService;
  
  private static _instance: MarkdownService;
  
  public static getInstance(fileSystemService?: FileSystemService): MarkdownService {
    if (!MarkdownService._instance) {
      MarkdownService._instance = new MarkdownService(fileSystemService);
    }
    return MarkdownService._instance;
  }
  
  private constructor(fileSystemService?: FileSystemService) {
    this._fileSystemService = fileSystemService || FileSystemService.getInstance();
  }
  
  /**
   * マークダウンファイルを読み込む
   */
  public async readMarkdownFile(filePath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      const content = await this._fileSystemService.readMarkdownFile(filePath);
      
      // イベントを発火
      this._onMarkdownUpdated.fire({ filePath, content });
      
      return content;
    } catch (error) {
      Logger.error(`MarkdownService: ファイル読み込みに失敗しました: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * マークダウンファイルのチェックボックスを更新
   */
  public async updateMarkdownCheckbox(filePath: string, index: number, checked: boolean): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を読み込む
      const content = fs.readFileSync(filePath, 'utf8');
      
      // チェックボックスを検索して更新
      const lines = content.split('\n');
      let checkboxCount = 0;
      
      const updatedLines = lines.map(line => {
        // チェックボックスを含む行を検索
        if (line.match(/- \[[ x]\]/i)) {
          if (checkboxCount === index) {
            // 指定されたインデックスのチェックボックスを更新
            return line.replace(/- \[[ x]\]/i, checked ? '- [x]' : '- [ ]');
          }
          checkboxCount++;
        }
        return line;
      });
      
      // 更新された内容を書き込む
      fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf8');
      
      // 更新された内容を読み込んでイベントを発火
      const updatedContent = fs.readFileSync(filePath, 'utf8');
      this._onMarkdownUpdated.fire({ filePath, content: updatedContent });
      
      return true;
    } catch (error) {
      Logger.error(`MarkdownService: チェックボックス更新に失敗しました: ${filePath}`, error as Error);
      return false;
    }
  }
  
  /**
   * マークダウン内のスコープ情報を解析
   */
  public parseScopes(content: string): { name: string, status: string, progress: number }[] {
    try {
      const scopes: { name: string, status: string, progress: number }[] = [];
      
      // 進行中スコープを抽出
      const inProgressRegex = /### 進行中スコープ\s+([^#]*)/s;
      const inProgressMatch = content.match(inProgressRegex);
      if (inProgressMatch && inProgressMatch[1]) {
        const scopeLines = inProgressMatch[1].trim().split('\n');
        
        for (const line of scopeLines) {
          // - [ ] スコープ名 (進捗率%) - 説明 の形式を解析
          const scopeMatch = line.match(/- \[[ ]\] ([^(]+) \((\d+)%\)(.*)/);
          if (scopeMatch) {
            const name = scopeMatch[1].trim();
            const progress = parseInt(scopeMatch[2], 10);
            
            scopes.push({
              name,
              status: 'in-progress',
              progress
            });
          }
        }
      }
      
      // 未着手スコープを抽出
      const pendingRegex = /### 未着手スコープ\s+([^#]*)/s;
      const pendingMatch = content.match(pendingRegex);
      if (pendingMatch && pendingMatch[1]) {
        const scopeLines = pendingMatch[1].trim().split('\n');
        
        for (const line of scopeLines) {
          // - [ ] スコープ名 (0%) - 説明 の形式を解析
          const scopeMatch = line.match(/- \[[ ]\] ([^(]+)(?:\s*\((\d+)%\))?/);
          if (scopeMatch) {
            const name = scopeMatch[1].trim();
            const progress = scopeMatch[2] ? parseInt(scopeMatch[2], 10) : 0;
            
            scopes.push({
              name,
              status: 'pending',
              progress
            });
          }
        }
      }
      
      // 完了済みスコープを抽出
      const completedRegex = /### 完了済みスコープ\s+([^#]*)/s;
      const completedMatch = content.match(completedRegex);
      if (completedMatch && completedMatch[1]) {
        const scopeLines = completedMatch[1].trim().split('\n');
        
        for (const line of scopeLines) {
          // - [x] スコープ名 (100%) - 説明 の形式を解析
          const scopeMatch = line.match(/- \[x\] ([^(]+)(?:\s*\((\d+)%\))?/);
          if (scopeMatch) {
            const name = scopeMatch[1].trim();
            const progress = scopeMatch[2] ? parseInt(scopeMatch[2], 10) : 100;
            
            scopes.push({
              name,
              status: 'completed',
              progress
            });
          }
        }
      }
      
      return scopes;
    } catch (error) {
      Logger.error('MarkdownService: スコープ解析に失敗しました', error as Error);
      return [];
    }
  }
}