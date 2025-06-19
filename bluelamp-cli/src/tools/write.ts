import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool } from './base';

interface WriteToolInput {
  file_path: string;
  content: string;
}

export class WriteTool extends Tool {
  name = 'Write';
  description = 'Writes a file to the local filesystem.';
  
  input_schema = {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to write (must be absolute, not relative)'
      },
      content: {
        type: 'string',
        description: 'The content to write to the file'
      }
    },
    required: ['file_path', 'content']
  };
  
  async execute(input: WriteToolInput): Promise<string> {
    try {
      // 絶対パスの検証
      const filePath = path.resolve(input.file_path);
      
      // ディレクトリが存在しない場合は作成
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // ファイルの書き込み
      await fs.writeFile(filePath, input.content, 'utf-8');
      
      // ファイルサイズの取得
      const stats = await fs.stat(filePath);
      const sizeInBytes = stats.size;
      const sizeFormatted = this.formatFileSize(sizeInBytes);
      
      return `File written successfully: ${filePath} (${sizeFormatted})`;
      
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${input.file_path}`);
      } else if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device: ${input.file_path}`);
      } else if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory, not a file: ${input.file_path}`);
      }
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }
  
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 bytes';
    
    const units = ['bytes', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
  }
}