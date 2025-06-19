import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './base';

const execAsync = promisify(exec);

interface BashToolInput {
  command: string;
  description?: string;
  timeout?: number;
}

export class BashTool extends Tool {
  name = 'Bash';
  description = 'Executes a given bash command in a persistent shell session with optional timeout.';
  
  input_schema = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'The command to execute'
      },
      description: {
        type: 'string',
        description: 'Clear, concise description of what this command does in 5-10 words.'
      },
      timeout: {
        type: 'number',
        description: 'Optional timeout in milliseconds (max 600000)'
      }
    },
    required: ['command']
  };
  
  // 危険なコマンドのブロックリスト
  private blockedPatterns = [
    /rm\s+-rf\s+\//,        // 危険な削除コマンド
    /:(){ :|:& };:/,        // Fork bomb
    /dd\s+if=.*of=\/dev/,   // ディスク破壊
    /mkfs/,                 // ファイルシステムのフォーマット
    />\s*\/dev\/sd/,        // ディスクへの直接書き込み
  ];
  
  async execute(input: BashToolInput): Promise<string> {
    try {
      // セキュリティチェック
      if (this.isDangerousCommand(input.command)) {
        throw new Error('This command is potentially dangerous and has been blocked');
      }
      
      // タイムアウトの検証（最大10分）
      const timeout = input.timeout && input.timeout <= 600000 ? input.timeout : 120000;
      
      // コマンドの実行
      const { stdout, stderr } = await execAsync(input.command, {
        encoding: 'utf-8',
        maxBuffer: 30000, // 出力の最大文字数
        timeout: timeout
      });
      
      // 結果の整形
      let result = '';
      
      if (input.description) {
        result += `Command: ${input.description}\n`;
      }
      
      result += `$ ${input.command}\n`;
      
      if (stdout) {
        result += stdout;
      }
      
      if (stderr) {
        result += `\n[stderr]:\n${stderr}`;
      }
      
      // 出力が空の場合
      if (!stdout && !stderr) {
        result += '(Command completed with no output)';
      }
      
      return result;
      
    } catch (error: any) {
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`Command timed out after ${input.timeout || 120000}ms`);
      } else if (error.code === 'ENOENT') {
        throw new Error(`Command not found: ${input.command.split(' ')[0]}`);
      }
      
      // エラーメッセージを含む
      let errorMessage = `Command failed: ${input.command}\n`;
      if (error.stdout) errorMessage += `stdout: ${error.stdout}\n`;
      if (error.stderr) errorMessage += `stderr: ${error.stderr}\n`;
      errorMessage += `Exit code: ${error.code}`;
      
      throw new Error(errorMessage);
    }
  }
  
  private isDangerousCommand(command: string): boolean {
    // ブロックリストのパターンをチェック
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) {
        return true;
      }
    }
    
    // sudo/su コマンドの制限
    if (/^(sudo|su)\s/.test(command.trim())) {
      return true;
    }
    
    return false;
  }
}