// ツールの基本インターフェース
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// ツールの基底クラス
export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract input_schema: ToolDefinition['input_schema'];
  
  // ツール定義を取得
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.input_schema
    };
  }
  
  // ツールの実行
  abstract execute(input: any): Promise<string>;
}