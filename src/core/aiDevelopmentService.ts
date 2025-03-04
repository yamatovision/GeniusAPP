import * as vscode from 'vscode';
import { AIService } from './aiService';
import { Logger } from '../utils/logger';

/**
 * 開発モード専用のAIサービス
 * 開発に関連するAI機能を提供する
 */
export class AIDevelopmentService {
  private _aiService: AIService;
  private _systemPrompt: string;

  constructor(aiService: AIService) {
    this._aiService = aiService;
    this._systemPrompt = this._getDefaultSystemPrompt();
  }

  /**
   * デフォルトのシステムプロンプトを取得
   */
  private _getDefaultSystemPrompt(): string {
    return `あなたは開発アシスタントとして、ソフトウェア開発を支援します。
以下のフェーズに沿って開発作業をガイドします。各フェーズは必ず順番に実施し、ユーザーの承認を得てから次に進んでください。

# 情報収集フェーズ
まず、プロジェクトの現状を理解するための情報を集めます。
- ディレクトリ構造の確認
- 開発スコープの確認
- 関連ファイルの確認

# 影響範囲の特定と承認フェーズ
収集した情報に基づいて分析を行い、変更が必要な部分を特定します。
- 現状分析の説明
- 変更が必要な箇所の特定
- 予想される影響の説明
- ユーザーからの承認取得

# 実装計画の確認フェーズ
実装方法と手順を計画します。
- 変更ファイル一覧の作成
- ディレクトリ構造の計画
- 各ファイルでの変更内容の説明
- 想定される影響の説明
- ユーザーからの承認取得

# 実装フェーズ
承認された計画に従って実装を行います。
- ファイルの作成/修正
- コードの実装
- 動作確認

コードブロックを出力する際は、次の形式で言語とファイル名を明示してください：
\`\`\`言語 ファイル名
コード内容
\`\`\`

各フェーズでの質問や指示に対して、具体的かつ明確に回答してください。`;
  }

  /**
   * システムプロンプトを更新
   */
  public updateSystemPrompt(newPrompt: string): void {
    this._systemPrompt = newPrompt;
    Logger.info('開発アシスタントのシステムプロンプトを更新しました');
  }

  /**
   * 開発関連のメッセージを処理する
   */
  public async processMessage(
    message: string,
    chatHistory?: Array<{ role: string, content: string }>
  ): Promise<string> {
    try {
      // チャット履歴がない場合は新しく作成
      const history = chatHistory || [];
      
      // システムプロンプトがまだ履歴に含まれていない場合は追加
      const hasSystemPrompt = history.some(msg => msg.role === 'system');
      if (!hasSystemPrompt) {
        history.unshift({
          role: 'system',
          content: this._systemPrompt
        });
      }
      
      // 新しいユーザーメッセージを追加
      history.push({
        role: 'user',
        content: message
      });
      
      // AI サービスでメッセージを処理
      const response = await this._aiService.sendMessage(message, 'development', history);
      
      // アシスタントの応答を履歴に追加
      history.push({
        role: 'assistant',
        content: response
      });
      
      return response;
    } catch (error) {
      Logger.error('開発アシスタントのメッセージ処理エラー:', error as Error);
      return `エラーが発生しました: ${(error as Error).message}`;
    }
  }

  /**
   * ストリーミングモードでメッセージを処理
   */
  public async processMessageWithStreaming(
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    chatHistory?: Array<{ role: string, content: string }>
  ): Promise<void> {
    try {
      // チャット履歴がない場合は新しく作成
      const history = chatHistory || [];
      
      // システムプロンプトがまだ履歴に含まれていない場合は追加
      const hasSystemPrompt = history.some(msg => msg.role === 'system');
      if (!hasSystemPrompt) {
        history.unshift({
          role: 'system',
          content: this._systemPrompt
        });
      }
      
      // 新しいユーザーメッセージを追加
      history.push({
        role: 'user',
        content: message
      });
      
      // ストリーミングモードでメッセージを処理
      await this._aiService.sendMessageWithStreaming(
        message,
        'development',
        (chunk) => {
          onChunk(chunk);
        },
        (fullResponse) => {
          // アシスタントの応答を履歴に追加
          history.push({
            role: 'assistant',
            content: fullResponse
          });
          onComplete(fullResponse);
        },
        history
      );
    } catch (error) {
      Logger.error('開発アシスタントのストリーミングメッセージ処理エラー:', error as Error);
      const errorMessage = `エラーが発生しました: ${(error as Error).message}`;
      onChunk(errorMessage);
      onComplete(errorMessage);
    }
  }

  /**
   * フェーズに応じたプロンプトを取得
   */
  public getPhasePrompt(phase: string): string {
    switch (phase) {
      case 'informationGathering':
        return `情報収集フェーズを開始します。以下の質問に回答してください：

Q1: 現在のディレクトリ構造を教えてください
Q2: 今回の開発スコープを教えてください
Q3: 関連するファイルはありますか？`;

      case 'impactAnalysis':
        return `影響範囲の特定と承認フェーズを開始します。

収集した情報に基づいて影響範囲を分析してください：
- 現状分析の説明
- 変更が必要な箇所の特定
- 予想される影響の説明
- 変更に必要な技術的なアプローチ`;

      case 'implementationPlan':
        return `実装計画の確認フェーズを開始します。

以下の内容で実装計画を作成してください：
1. 変更/作成するファイル一覧
2. 各ファイルでの変更内容の詳細
3. 実装の順序と依存関係
4. テストシナリオ`;

      case 'implementation':
        return `実装フェーズを開始します。

承認された計画に従って実装を行ってください。コードブロックは自動的にファイルに保存できます。
実装を開始するにあたり、必要な情報はすべて揃っていますか？`;

      default:
        return '次のステップについて教えてください。';
    }
  }

  /**
   * コード生成用の特化したプロンプトで処理
   */
  public async generateCode(
    description: string,
    context: string,
    language: string
  ): Promise<string> {
    try {
      const prompt = `次の仕様に基づいてコードを生成してください。

仕様:
${description}

コンテキスト:
${context}

言語: ${language}

以下の形式でコードを出力してください:
\`\`\`${language}
// ここにコードが入ります
\`\`\`

コードは完全に機能する必要があり、エラー処理やベストプラクティスに準拠してください。`;

      return await this._aiService.sendMessage(prompt, 'code');
    } catch (error) {
      Logger.error('コード生成エラー:', error as Error);
      return `コード生成中にエラーが発生しました: ${(error as Error).message}`;
    }
  }
}