import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool } from './base';

interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export class EditTool extends Tool {
  name = 'Edit';
  description = 'Performs exact string replacements in files.';
  
  input_schema = {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to modify'
      },
      old_string: {
        type: 'string',
        description: 'The text to replace'
      },
      new_string: {
        type: 'string',
        description: 'The text to replace it with (must be different from old_string)'
      },
      replace_all: {
        type: 'boolean',
        description: 'Replace all occurences of old_string (default false)',
        default: false
      }
    },
    required: ['file_path', 'old_string', 'new_string']
  };
  
  async execute(input: EditToolInput): Promise<string> {
    try {
      // 絶対パスの検証
      const filePath = path.resolve(input.file_path);
      
      // old_stringとnew_stringが同じでないことを確認
      if (input.old_string === input.new_string) {
        throw new Error('old_string and new_string must be different');
      }
      
      // ファイルの内容を読み込む
      const content = await fs.readFile(filePath, 'utf-8');
      
      // old_stringが存在するか確認
      if (!content.includes(input.old_string)) {
        throw new Error(`The specified old_string was not found in the file: "${input.old_string}"`);
      }
      
      // 置換処理
      let updatedContent: string;
      let replacementCount: number;
      
      if (input.replace_all) {
        // 全置換
        const regex = new RegExp(this.escapeRegExp(input.old_string), 'g');
        replacementCount = (content.match(regex) || []).length;
        updatedContent = content.replace(regex, input.new_string);
      } else {
        // 最初の1つだけ置換
        replacementCount = 1;
        updatedContent = content.replace(input.old_string, input.new_string);
      }
      
      // ファイルの書き込み
      await fs.writeFile(filePath, updatedContent, 'utf-8');
      
      // 結果のメッセージ
      const action = input.replace_all ? 'all occurrences' : 'first occurrence';
      return `File edited successfully: ${filePath}\nReplaced ${replacementCount} ${action} of the specified string.`;
      
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${input.file_path}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${input.file_path}`);
      }
      throw error;
    }
  }
  
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}