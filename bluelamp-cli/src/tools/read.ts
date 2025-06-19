import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool } from './base';

interface ReadToolInput {
  file_path: string;
  limit?: number;
  offset?: number;
}

export class ReadTool extends Tool {
  name = 'Read';
  description = 'Reads a file from the local filesystem. You can access any file directly by using this tool.';
  
  input_schema = {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to read'
      },
      limit: {
        type: 'number',
        description: 'The number of lines to read. Only provide if the file is too large to read at once.'
      },
      offset: {
        type: 'number',
        description: 'The line number to start reading from. Only provide if the file is too large to read at once'
      }
    },
    required: ['file_path']
  };
  
  async execute(input: ReadToolInput): Promise<string> {
    try {
      // 絶対パスの検証
      const filePath = path.resolve(input.file_path);
      
      // ファイルの存在確認
      await fs.access(filePath);
      
      // ファイルの内容を読み込む
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 行に分割
      const lines = content.split('\n');
      
      // offset と limit の処理
      const start = input.offset ? input.offset - 1 : 0;
      const end = input.limit ? start + input.limit : lines.length;
      
      // 指定された範囲の行を取得
      const selectedLines = lines.slice(start, end);
      
      // cat -n 形式で行番号を付ける
      const numberedLines = selectedLines.map((line, index) => {
        const lineNumber = start + index + 1;
        // 行番号を右詰め6桁でフォーマット
        const paddedNumber = lineNumber.toString().padStart(6, ' ');
        return `${paddedNumber}→${line}`;
      });
      
      // ファイル情報を含めた結果を返す
      const fileInfo = `File: ${filePath} (${lines.length} lines total)`;
      const rangeInfo = input.offset || input.limit 
        ? `\nShowing lines ${start + 1}-${Math.min(end, lines.length)} of ${lines.length}`
        : '';
      
      return fileInfo + rangeInfo + '\n' + numberedLines.join('\n');
      
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${input.file_path}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${input.file_path}`);
      } else if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory, not a file: ${input.file_path}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
}