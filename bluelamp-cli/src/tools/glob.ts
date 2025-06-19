import fastGlob from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Tool } from './base';

interface GlobToolInput {
  pattern: string;
  path?: string;
}

export class GlobTool extends Tool {
  name = 'Glob';
  description = 'Fast file pattern matching tool that works with any codebase size.';
  
  input_schema = {
    type: 'object' as const,
    properties: {
      pattern: {
        type: 'string',
        description: 'The glob pattern to match files against'
      },
      path: {
        type: 'string',
        description: 'The directory to search in. If not specified, the current working directory will be used.'
      }
    },
    required: ['pattern']
  };
  
  async execute(input: GlobToolInput): Promise<string> {
    try {
      // 検索パスの決定
      const searchPath = input.path ? path.resolve(input.path) : process.cwd();
      
      // ディレクトリの存在確認
      try {
        const stats = await fs.stat(searchPath);
        if (!stats.isDirectory()) {
          throw new Error(`Path is not a directory: ${searchPath}`);
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`Directory not found: ${searchPath}`);
        }
        throw error;
      }
      
      // globパターンで検索
      const matches = await fastGlob(input.pattern, {
        cwd: searchPath,
        absolute: true,
        dot: true, // 隠しファイルも含める
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**'
        ],
        suppressErrors: true // アクセスできないファイルは無視
      });
      
      if (matches.length === 0) {
        return `No files found matching pattern: ${input.pattern} in ${searchPath}`;
      }
      
      // ファイル情報を取得して修正時刻でソート
      const filesWithStats = await Promise.all(
        matches.map(async (filePath) => {
          try {
            const stats = await fs.stat(filePath);
            return {
              path: filePath,
              mtime: stats.mtime.getTime(),
              size: stats.size
            };
          } catch {
            // ファイルが読めない場合は現在時刻を使用
            return {
              path: filePath,
              mtime: Date.now(),
              size: 0
            };
          }
        })
      );
      
      // 修正時刻で降順ソート（新しいファイルが先）
      filesWithStats.sort((a, b) => b.mtime - a.mtime);
      
      // 結果のフォーマット
      const result = [
        `Found ${matches.length} files matching pattern: ${input.pattern}`,
        `Search directory: ${searchPath}`,
        '',
        ...filesWithStats.map(file => {
          const relativePath = path.relative(searchPath, file.path);
          const modifiedDate = new Date(file.mtime).toLocaleString();
          return `${relativePath} (modified: ${modifiedDate})`;
        })
      ].join('\n');
      
      return result;
      
    } catch (error: any) {
      throw new Error(`Glob search failed: ${error.message}`);
    }
  }
}