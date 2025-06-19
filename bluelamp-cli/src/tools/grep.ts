import * as fs from 'fs/promises';
import * as path from 'path';
import fastGlob from 'fast-glob';
import { Tool } from './base';

interface GrepToolInput {
  pattern: string;
  include?: string;
  path?: string;
}

interface MatchResult {
  file: string;
  matches: Array<{
    line: number;
    content: string;
  }>;
}

export class GrepTool extends Tool {
  name = 'Grep';
  description = 'Fast content search tool that works with any codebase size.';
  
  input_schema = {
    type: 'object' as const,
    properties: {
      pattern: {
        type: 'string',
        description: 'The regular expression pattern to search for in file contents'
      },
      include: {
        type: 'string',
        description: 'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'
      },
      path: {
        type: 'string',
        description: 'The directory to search in. Defaults to the current working directory.'
      }
    },
    required: ['pattern']
  };
  
  async execute(input: GrepToolInput): Promise<string> {
    try {
      // 検索パスの決定
      const searchPath = input.path ? path.resolve(input.path) : process.cwd();
      
      // 正規表現の作成
      let regex: RegExp;
      try {
        regex = new RegExp(input.pattern, 'gmi');
      } catch (error) {
        throw new Error(`Invalid regular expression: ${input.pattern}`);
      }
      
      // 検索するファイルパターン
      const filePattern = input.include || '**/*';
      
      // ファイルを検索
      const files = await fastGlob(filePattern, {
        cwd: searchPath,
        absolute: true,
        dot: true,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/*.{jpg,jpeg,png,gif,ico,svg,pdf,zip,tar,gz,mp4,mp3,wav,mov,avi}' // バイナリファイルを除外
        ],
        suppressErrors: true
      });
      
      if (files.length === 0) {
        return `No files found matching pattern: ${filePattern} in ${searchPath}`;
      }
      
      // 各ファイルを検索
      const results: MatchResult[] = [];
      let totalMatches = 0;
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');
          const matches: Array<{ line: number; content: string }> = [];
          
          lines.forEach((line, index) => {
            if (regex.test(line)) {
              matches.push({
                line: index + 1,
                content: line.trim()
              });
              totalMatches++;
            }
            // 正規表現のステートをリセット
            regex.lastIndex = 0;
          });
          
          if (matches.length > 0) {
            results.push({
              file,
              matches
            });
          }
        } catch (error) {
          // バイナリファイルや読み取れないファイルはスキップ
          continue;
        }
      }
      
      if (results.length === 0) {
        return `No matches found for pattern: ${input.pattern}`;
      }
      
      // 結果を修正時刻でソート
      const sortedResults = await this.sortByModificationTime(results);
      
      // 結果のフォーマット
      const output = [
        `Found ${totalMatches} matches in ${results.length} files for pattern: ${input.pattern}`,
        `Search directory: ${searchPath}`,
        ''
      ];
      
      for (const result of sortedResults) {
        const relativePath = path.relative(searchPath, result.file);
        output.push(`\n${relativePath}:`);
        
        // 最大10個のマッチを表示
        const displayMatches = result.matches.slice(0, 10);
        for (const match of displayMatches) {
          const lineStr = match.line.toString().padStart(6, ' ');
          output.push(`${lineStr}: ${match.content}`);
        }
        
        if (result.matches.length > 10) {
          output.push(`   ... and ${result.matches.length - 10} more matches`);
        }
      }
      
      return output.join('\n');
      
    } catch (error: any) {
      throw new Error(`Grep search failed: ${error.message}`);
    }
  }
  
  private async sortByModificationTime(results: MatchResult[]): Promise<MatchResult[]> {
    const resultsWithTime = await Promise.all(
      results.map(async (result) => {
        try {
          const stats = await fs.stat(result.file);
          return {
            result,
            mtime: stats.mtime.getTime()
          };
        } catch {
          return {
            result,
            mtime: 0
          };
        }
      })
    );
    
    resultsWithTime.sort((a, b) => b.mtime - a.mtime);
    return resultsWithTime.map(item => item.result);
  }
}