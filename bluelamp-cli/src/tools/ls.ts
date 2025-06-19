import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool } from './base';

interface LSToolInput {
  path: string;
  ignore?: string[];
}

interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  permissions: string;
}

export class LSTool extends Tool {
  name = 'LS';
  description = 'Lists files and directories in a given path.';
  
  input_schema = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path to the directory to list (must be absolute, not relative)'
      },
      ignore: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'List of glob patterns to ignore'
      }
    },
    required: ['path']
  };
  
  async execute(input: LSToolInput): Promise<string> {
    try {
      // 絶対パスの検証
      const dirPath = path.resolve(input.path);
      
      // ディレクトリの存在確認
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }
      
      // ディレクトリの内容を読み込む
      const entries = await fs.readdir(dirPath);
      
      // 各エントリの詳細情報を取得
      const fileInfos: FileInfo[] = [];
      
      for (const entry of entries) {
        // ignoreパターンのチェック
        if (this.shouldIgnore(entry, input.ignore)) {
          continue;
        }
        
        const fullPath = path.join(dirPath, entry);
        
        try {
          const entryStats = await fs.stat(fullPath);
          
          fileInfos.push({
            name: entry,
            type: entryStats.isDirectory() ? 'directory' : 'file',
            size: entryStats.size,
            modified: entryStats.mtime,
            permissions: this.formatPermissions(entryStats.mode)
          });
        } catch (error) {
          // アクセスできないファイルはスキップ
          continue;
        }
      }
      
      // ソート（ディレクトリ優先、その後名前順）
      fileInfos.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      // 結果のフォーマット
      const output = [`Directory: ${dirPath}`, `Total: ${fileInfos.length} items`, ''];
      
      // ヘッダー
      output.push('Permissions     Size  Modified              Name');
      output.push('─'.repeat(70));
      
      // 各ファイル/ディレクトリの情報
      for (const info of fileInfos) {
        const sizeStr = info.type === 'directory' 
          ? '<DIR>'.padStart(9) 
          : this.formatFileSize(info.size).padStart(9);
        
        const modifiedStr = this.formatDate(info.modified);
        const nameStr = info.type === 'directory' ? `${info.name}/` : info.name;
        
        output.push(
          `${info.permissions}  ${sizeStr}  ${modifiedStr}  ${nameStr}`
        );
      }
      
      return output.join('\n');
      
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${input.path}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${input.path}`);
      }
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }
  
  private shouldIgnore(name: string, ignorePatterns?: string[]): boolean {
    if (!ignorePatterns || ignorePatterns.length === 0) {
      return false;
    }
    
    for (const pattern of ignorePatterns) {
      // 簡単なワイルドカードマッチング
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      if (regex.test(name)) {
        return true;
      }
    }
    
    return false;
  }
  
  private formatPermissions(mode: number): string {
    const permissions = [
      (mode & 0o400) ? 'r' : '-',
      (mode & 0o200) ? 'w' : '-',
      (mode & 0o100) ? 'x' : '-',
      (mode & 0o040) ? 'r' : '-',
      (mode & 0o020) ? 'w' : '-',
      (mode & 0o010) ? 'x' : '-',
      (mode & 0o004) ? 'r' : '-',
      (mode & 0o002) ? 'w' : '-',
      (mode & 0o001) ? 'x' : '-'
    ];
    
    return permissions.join('');
  }
  
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0';
    
    const units = ['', 'K', 'M', 'G', 'T'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    if (i === 0) {
      return bytes.toString();
    }
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${units[i]}`;
  }
  
  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // 7日以内なら時刻を表示、それ以外は日付を表示
    if (diffDays < 7) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    }
  }
}