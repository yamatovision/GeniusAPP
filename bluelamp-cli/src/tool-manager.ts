import { Tool, ToolDefinition } from './tools/base';
import { ReadTool } from './tools/read';
import { WriteTool } from './tools/write';
import { EditTool } from './tools/edit';
import { BashTool } from './tools/bash';
import { GlobTool } from './tools/glob';
import { GrepTool } from './tools/grep';
import { LSTool } from './tools/ls';

export class ToolManager {
  private tools = new Map<string, Tool>();
  
  constructor() {
    // 7つの基本ツールを登録
    this.registerTool(new ReadTool());
    this.registerTool(new WriteTool());
    this.registerTool(new EditTool());
    this.registerTool(new BashTool());
    this.registerTool(new GlobTool());
    this.registerTool(new GrepTool());
    this.registerTool(new LSTool());
    
    console.log(`✅ ${this.tools.size}個のツールを初期化しました`);
  }
  
  /**
   * ツールを登録
   */
  private registerTool(tool: Tool): void {
    this.tools.set(tool.name.toLowerCase(), tool);
  }
  
  /**
   * Claude API用のツール定義を取得
   */
  getToolsForClaude(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }
  
  /**
   * システムプロンプトに含めるツール説明を生成
   */
  generateToolDescriptions(): string {
    const descriptions = Array.from(this.tools.values())
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');
    
    return `
### 利用可能なツール
${descriptions}`;
  }
  
  /**
   * ツールを実行
   */
  async executeTool(name: string, input: any): Promise<string> {
    const tool = this.tools.get(name.toLowerCase());
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    try {
      return await tool.execute(input);
    } catch (error: any) {
      // エラーメッセージをユーザーフレンドリーに整形
      throw new Error(`${tool.name} failed: ${error.message}`);
    }
  }
  
  /**
   * ツール名の一覧を取得
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
  
  /**
   * ツールの詳細情報を表示（デバッグ用）
   */
  printToolInfo(): void {
    console.log('\n=== 利用可能なツール ===');
    this.tools.forEach((tool) => {
      const definition = tool.getDefinition();
      console.log(`\n📦 ${tool.name}`);
      console.log(`   ${tool.description}`);
      console.log('   パラメータ:');
      Object.entries(definition.input_schema.properties).forEach(([key, value]: [string, any]) => {
        const required = definition.input_schema.required?.includes(key) ? '[必須]' : '[任意]';
        console.log(`     - ${key} ${required}: ${value.description || ''}`);
      });
    });
  }
}