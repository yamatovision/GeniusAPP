import axios from 'axios';
import { AIMessage, ClaudeResponse, Tool, ToolUseResult } from '../types';
import { logger } from '../utils/logger';
import { configManager } from '../utils/configManager';

// Claude API のベースURL
const CLAUDE_API_BASE_URL = 'https://api.anthropic.com/v1/messages';

// Claude モデル
export enum ClaudeModel {
  CLAUDE_3_OPUS = 'claude-3-opus-20240229',
  CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307'
}

/**
 * Claude AI サービスのオプション
 */
export interface ClaudeServiceOptions {
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Claude AI サービスクラス
 * Claude APIを使用して自然言語処理を行う
 */
export class ClaudeService {
  private apiKey: string;
  private model: ClaudeModel;
  private maxTokens: number;
  private temperature: number;
  private systemPrompt: string;
  private tools: Map<string, Tool>;
  private conversation: AIMessage[] = [];

  /**
   * コンストラクタ
   */
  constructor(options?: ClaudeServiceOptions) {
    const config = configManager.getConfig();
    this.apiKey = config.apiKey;
    this.model = options?.model || ClaudeModel.CLAUDE_3_SONNET;
    this.maxTokens = options?.maxTokens || 4000;
    this.temperature = options?.temperature || 0.7;
    this.systemPrompt = options?.systemPrompt || this.getDefaultSystemPrompt();
    this.tools = new Map();
    
    // システムプロンプトを会話履歴の最初に追加
    this.conversation = [
      { role: 'system', content: this.systemPrompt }
    ];
    
    logger.debug('Claude AIサービスを初期化しました', {
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    });
  }

  /**
   * デフォルトのシステムプロンプトを取得
   */
  private getDefaultSystemPrompt(): string {
    return `You are AppGenius, an AI assistant specialized in software development.
You help users with coding tasks, software architecture, debugging, and implementing features.
When a user asks for help with a task:

1. Break down the problem
2. Provide clear explanations
3. Generate well-structured, idiomatic code
4. Offer guidance on testing and best practices

You have access to tools for file operations, which allow you to search, read, and edit files.
When using these tools, be precise and careful, especially with file paths.

You specialize in TypeScript, JavaScript, Node.js, and web development, but can assist with most programming languages.
Always prioritize writing clean, maintainable, and efficient code.`;
  }

  /**
   * APIキーを設定
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    configManager.setApiKey(apiKey);
  }

  /**
   * ツールを登録
   */
  public registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    logger.debug(`ツールを登録しました: ${tool.name}`);
  }

  /**
   * 複数のツールを登録
   */
  public registerTools(tools: Tool[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * 会話履歴をクリア（システムプロンプトは保持）
   */
  public clearConversation(): void {
    this.conversation = [this.conversation[0]]; // システムプロンプトのみ保持
    logger.debug('会話履歴をクリアしました');
  }

  /**
   * 会話履歴を取得
   */
  public getConversation(): AIMessage[] {
    return [...this.conversation];
  }

  /**
   * システムプロンプトを更新
   */
  public updateSystemPrompt(systemPrompt: string): void {
    this.systemPrompt = systemPrompt;
    
    // 会話履歴の最初のメッセージを更新
    if (this.conversation.length > 0 && this.conversation[0].role === 'system') {
      this.conversation[0].content = systemPrompt;
    } else {
      this.conversation.unshift({ role: 'system', content: systemPrompt });
    }
    
    logger.debug('システムプロンプトを更新しました');
  }

  /**
   * Claude APIにメッセージを送信
   */
  public async sendMessage(message: string): Promise<string> {
    try {
      if (!this.apiKey) {
        const errorMessage = 'Claude APIキーが設定されていません';
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      // ユーザーメッセージを会話履歴に追加
      this.conversation.push({ role: 'user', content: message });
      
      logger.debug('Claude APIにリクエスト送信', {
        model: this.model,
        messageCount: this.conversation.length
      });
      
      // システムメッセージを取得
      const systemMessage = this.conversation[0].content;
      
      // メッセージ配列からシステムメッセージを除外
      const messagesWithoutSystem = this.conversation.filter(msg => msg.role !== 'system');
      
      // リクエストボディを構築
      const requestBody = {
        model: this.model,
        messages: messagesWithoutSystem,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemMessage
      };
      
      // APIリクエストを送信
      const response = await axios.post<ClaudeResponse>(CLAUDE_API_BASE_URL, requestBody, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      // レスポンスを処理
      const claudeResponse = response.data;
      const assistantMessage = claudeResponse.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');
      
      // アシスタントの応答を会話履歴に追加
      this.conversation.push({ role: 'assistant', content: assistantMessage });
      
      logger.debug('Claude APIからの応答を受信', {
        inputTokens: claudeResponse.usage.inputTokens,
        outputTokens: claudeResponse.usage.outputTokens
      });
      
      return assistantMessage;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Claude API呼び出しエラー', error);
        throw new Error(`Claude API呼び出しエラー: ${error.message}`);
      } else {
        logger.error('Claude APIとの通信中に予期しないエラーが発生しました', error as Error);
        throw error;
      }
    }
  }

  /**
   * ツール使用リクエストを検出・実行
   */
  public async detectAndExecuteTools(message: string): Promise<{ 
    responseText: string; 
    toolResults: ToolUseResult[];
  }> {
    try {
      // 会話履歴にユーザーメッセージを追加
      this.conversation.push({ role: 'user', content: message });
      
      // ツール使用パターンを探す特別なプロンプトを構築
      const toolPrompt = `You have the following tools available:
${Array.from(this.tools.values()).map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

If you need to use any of these tools to answer the user's question, format your response as follows:
<tool_use name="ToolName">
{
  "param1": "value1",
  "param2": "value2"
}
</tool_use>

You can use multiple tools if needed. After using a tool, provide your complete answer based on the tool results.`;
      
      // 特別なシステムプロンプトを一時的に使用
      const originalSystemPrompt = this.systemPrompt;
      this.updateSystemPrompt(`${this.systemPrompt}\n\n${toolPrompt}`);
      
      logger.debug('ツール検出モードでClaude APIにリクエスト送信');
      
      // システムメッセージを取得
      const systemMessage = this.conversation[0].content;
      
      // メッセージ配列からシステムメッセージを除外
      const messagesWithoutSystem = this.conversation.filter(msg => msg.role !== 'system');
      
      // リクエストボディを構築
      const requestBody = {
        model: this.model,
        messages: messagesWithoutSystem,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemMessage
      };
      
      // APIリクエストを送信
      const response = await axios.post<ClaudeResponse>(CLAUDE_API_BASE_URL, requestBody, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      // 元のシステムプロンプトを復元
      this.updateSystemPrompt(originalSystemPrompt);
      
      // レスポンスを処理
      const claudeResponse = response.data;
      const assistantMessage = claudeResponse.content
        .filter(item => item.type === 'text')
        .map(item => item.text || '')
        .join('');
      
      // ツール使用パターンを検出
      const toolUsePattern = /<tool_use name="([^"]+)">\s*(\{[\s\S]*?\})\s*<\/tool_use>/g;
      let toolUseMatch;
      const toolResults: ToolUseResult[] = [];
      let processedMessage = assistantMessage;
      
      // すべてのツール使用パターンを処理
      while ((toolUseMatch = toolUsePattern.exec(assistantMessage)) !== null) {
        const toolName = toolUseMatch[1];
        const argsJson = toolUseMatch[2];
        
        try {
          // ツール引数をJSONとしてパース
          const args = JSON.parse(argsJson);
          
          // ツールを実行
          if (this.tools.has(toolName)) {
            logger.debug(`ツール実行: ${toolName}`, args);
            const tool = this.tools.get(toolName)!;
            const result = await tool.execute(args);
            
            // ツール結果を記録
            toolResults.push({
              toolName,
              args,
              result
            });
            
            // レスポンスから該当ツール使用部分を削除して結果に置き換え
            const resultJson = JSON.stringify(result, null, 2);
            processedMessage = processedMessage.replace(
              toolUseMatch[0],
              `<tool_result name="${toolName}">\n${resultJson}\n</tool_result>`
            );
          } else {
            logger.warn(`要求されたツール "${toolName}" が見つかりません`);
            toolResults.push({
              toolName,
              args,
              result: null,
              error: `ツール "${toolName}" が見つかりません`
            });
          }
        } catch (error) {
          logger.error(`ツール使用パターンの処理中にエラーが発生しました: ${toolName}`, error as Error);
          toolResults.push({
            toolName,
            args: {} as any,
            result: null,
            error: (error as Error).message
          });
        }
      }
      
      // ツール結果を含む修正されたメッセージを会話履歴に追加
      if (toolResults.length > 0) {
        // ツール結果を含むメッセージをAIに送り返す
        this.conversation.push({ role: 'assistant', content: processedMessage });
        
        // AIに結果の解釈を依頼
        const followUpMessage = 'Please interpret the tool results above and provide your complete answer.';
        this.conversation.push({ role: 'user', content: followUpMessage });
        
        // 最終応答を取得
        const finalResponse = await this.sendMessage(followUpMessage);
        return {
          responseText: finalResponse,
          toolResults
        };
      } else {
        // ツールが使用されなかった場合は単純に応答を返す
        this.conversation.push({ role: 'assistant', content: assistantMessage });
        return {
          responseText: assistantMessage,
          toolResults: []
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('ツール検出・実行中にエラーが発生しました', error);
        throw new Error(`ツール検出・実行中にエラーが発生しました: ${error.message}`);
      } else {
        logger.error('ツール検出・実行中にエラーが発生しました', error as Error);
        throw error;
      }
    }
  }
}