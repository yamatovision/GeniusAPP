import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AIService } from '../core/aiService';
import { Logger } from '../utils/logger';
import { FileOperationManager } from '../utils/fileOperationManager';
import { ProjectManagementService } from '../services/ProjectManagementService';
import { AppGeniusStateManager, Requirements } from '../services/AppGeniusStateManager';
import { ClaudeMdService } from '../utils/ClaudeMdService';
import { ClaudeCodeLauncherService } from '../services/ClaudeCodeLauncherService';
import { ClaudeCodeIntegrationService } from '../services/ClaudeCodeIntegrationService';
import { ProtectedPanel } from './auth/ProtectedPanel';
import { Feature } from '../core/auth/roles';
import { RequirementsParser, PageInfo } from '../core/requirementsParser';

/**
 * シンプルなチャットパネルを管理するクラス
 * 権限保護されたパネルの基底クラスを継承
 */
export class SimpleChatPanel extends ProtectedPanel implements vscode.Disposable {
  public static currentPanel: SimpleChatPanel | undefined;
  private static readonly viewType = 'simpleChat';
  // 必要な権限を指定
  protected static readonly _feature: Feature = Feature.SIMPLE_CHAT;
  
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _aiService: AIService;
  private readonly _claudeMdService = ClaudeMdService.getInstance();
  private readonly _claudeCodeLauncherService = ClaudeCodeLauncherService.getInstance();
  private _extractedCodeBlocks: Array<{id: number, language: string, code: string}> = [];
  private _chatHistory: Array<{role: 'user' | 'ai', content: string}> = [];
  private _projectPath?: string; // プロジェクトのパス
  private _fileWatcher?: vscode.FileSystemWatcher; // ファイル監視用
  
  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  protected static _createOrShowPanel(extensionUri: vscode.Uri, aiService: AIService, projectPath?: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
      
    // すでにパネルがある場合は表示する
    if (SimpleChatPanel.currentPanel) {
      SimpleChatPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが変更された場合は再読み込み
      if (projectPath && SimpleChatPanel.currentPanel._projectPath !== projectPath) {
        SimpleChatPanel.currentPanel._projectPath = projectPath;
        SimpleChatPanel.currentPanel._loadInitialData();
      }
      return SimpleChatPanel.currentPanel;
    }
    
    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      SimpleChatPanel.viewType,
      '要件定義ビジュアライザー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ],
        enableFindWidget: true
      }
    );
    
    SimpleChatPanel.currentPanel = new SimpleChatPanel(panel, extensionUri, aiService, projectPath);
    return SimpleChatPanel.currentPanel;
  }
  
  /**
   * 外部向けのパネル作成・表示メソッド
   * 権限チェック付きで、パネルを表示する
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService, projectPath?: string): SimpleChatPanel | undefined {
    // 権限チェック
    if (!this.checkPermissionForFeature(Feature.SIMPLE_CHAT, 'SimpleChatPanel')) {
      return undefined;
    }
    
    // 権限があれば表示
    return this._createOrShowPanel(extensionUri, aiService, projectPath);
  }
  
  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService, projectPath?: string) {
    super(); // 親クラスのコンストラクタを呼び出し
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;
    this._projectPath = projectPath;
    
    // WebViewのHTMLをセット
    this._update();
    
    // パネルが閉じられたときのイベント処理
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    
    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendMessage':
            await this._handleSendMessage(message.text);
            break;
          case 'saveCodeBlock':
            await this._handleSaveCodeBlock(message.blockId);
            break;
          case 'clearChat':
            await this._handleClearChat();
            break;
          case 'openExternalPreview':
            await this._handleOpenExternalPreview(message.html, message.blockId);
            break;
          case 'generateProjectStructure':
            await this._handleGenerateProjectStructure();
            break;
          case 'createProject':
            await this._handleCreateProject();
            break;
          case 'exportRequirements':
            await this._handleExportRequirements();
            break;
          case 'launchMockupCreator':
            await this._handleLaunchMockupCreator();
            break;
          case 'initialize':
            // 初期化時にファイル内容を読み込む
            await this._loadInitialData();
            break;
          case 'updateFile':
            // ファイル更新処理
            await this._handleFileUpdate(message.filePath, message.content);
            break;
          case 'launchClaudeCode':
            // ClaudeCode起動処理
            await this._launchClaudeCode(message.filePath);
            break;
        }
      },
      null,
      this._disposables
    );
    
    // ログ出力
    Logger.info('シンプルAIチャットパネルを作成しました');
    if (this._projectPath) {
      Logger.info(`プロジェクトパス: ${this._projectPath}`);
    }
  }
  
  /**
   * メッセージ送信処理
   */
  private async _handleSendMessage(text: string): Promise<void> {
    try {
      Logger.info(`チャットメッセージを送信します: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // チャット履歴にユーザーメッセージを追加
      this._chatHistory.push({ role: 'user', content: text });
      
      // ストリーミングモードを取得
      const useStreaming = vscode.workspace.getConfiguration('appgeniusAI').get<boolean>('useStreaming', true);
      
      // 要件定義クリエイター用のシステムメッセージを追加
      // docs/prompts/requirements_creator.mdから取得
      const systemMessage = {
        role: 'system' as 'system',
        content: `# 要件定義クリエイター

あなたはUI/UXと要件定義のエキスパートです。
非技術者の要望を具体的な要件定義書に変換し、必要なページと機能を洗い出す役割を担います。

## 目的
ユーザーのビジネス要件をヒアリングし、具体的な要件定義書と必要ページリストを作成します。

## Phase#1：プロジェクト情報の収集
まず以下の情報を収集することから始めてください：
  - 業界や分野（ECサイト、SNS、情報サイト、管理ツールなど）
  - ターゲットユーザー（年齢層、技術レベルなど）
  - 競合他社やインスピレーションとなる既存サービス
  - デザインテイスト（モダン、シンプル、カラフルなど）
このフェーズは会話形式で進め、ユーザーの回答を深掘りしてください。

## Phase#2：機能要件の策定
収集した情報をもとに、以下を明確にします：
  - コアとなる機能
  - 必須機能と追加機能の区別
  - データ構造と主要エンティティ
  - ユーザーフロー

## Phase#3：必要ページの洗い出し
機能要件に基づいて、以下の形式で必要なページリストを作成します：

### ページリスト
1. **ページ名**: [ページ名]
   - **説明**: [簡潔な説明]
   - **主要機能**:
     - [機能1]
     - [機能2]
     - [機能3]

2. **ページ名**: [ページ名]
   - **説明**: [簡潔な説明]
   - **主要機能**:
     - [機能1]
     - [機能2]

※このページリストは後続のモックアップ生成に使用されるため、明確かつ詳細に記述してください。

## Phase#4：要件定義書の作成
すべての情報を統合し、構造化された要件定義書を作成します。以下の項目を含めてください：

1. **プロジェクト概要**
2. **目標とゴール**
3. **ターゲットユーザー**
4. **機能要件**
5. **非機能要件**
6. **ページリスト**（Phase#3で作成したもの）
7. **データモデル**
8. **技術スタック**（もし特定の技術やフレームワークが決まっている場合）
9. **制約条件**
10. **マイルストーン**

## 鉄の掟
- 常に1問1答を心がける
- 具体的で詳細な質問を通じて、ユーザーの真のニーズを引き出す
- 要件は明確かつ具体的に記述する
- ページリストは漏れなく作成する
- 要件定義書はマークダウン形式で構造化する`
      };
      
      // 会話履歴をAPI形式に変換
      const formattedChatHistory = this._chatHistory.map(msg => ({
        role: (msg.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant' | 'system',
        content: msg.content
      }));
      
      // システムメッセージを先頭に追加
      const messages = [systemMessage, ...formattedChatHistory];
      
      Logger.debug(`会話履歴: ${messages.length}メッセージ`);
      
      if (useStreaming) {
        // ストリーミングモードでAI応答を取得
        Logger.info('ストリーミングモードでAI応答を取得します');
        
        // 空のレスポンスをUIに作成
        this._panel.webview.postMessage({
          command: 'startAIResponse'
        });
        
        let streamingText = '';
        
        // ストリーミングでメッセージを送信
        await this._aiService.sendMessageWithStreaming(
          text, 
          'design', // 「design」モードを使用
          // チャンクを受信するたびに呼び出されるコールバック
          async (chunk: string) => {
            // 通常のテキストチャンクの場合
            streamingText += chunk;
            
            // ストリーミング用に部分的な更新を送信
            this._panel.webview.postMessage({
              command: 'appendToAIResponse',
              text: chunk,
              type: 'chunk'
            });
          },
          // 完了時に呼び出されるコールバック
          async (response: string) => {
            // チャット履歴にAI応答を追加
            this._chatHistory.push({ role: 'ai', content: response });
            
            // コードブロックを抽出
            this._extractedCodeBlocks = this._extractCodeBlocks(response);
            
            // 完全な応答を新たに整形してWebViewに送信
            this._panel.webview.postMessage({
              command: 'finalizeAIResponse',
              text: response,
              codeBlocks: this._extractedCodeBlocks.map(block => ({
                id: block.id,
                language: block.language
              }))
            });
            
            Logger.info('AI応答のストリーミングが完了しました');
          },
          // システムメッセージを渡す
          messages
        );
      } else {
        // 通常モード（非ストリーミング）
        const response = await this._aiService.sendMessage(text, 'design', messages); // 「design」モードを使用し、システムメッセージを渡す
        
        // チャット履歴にAI応答を追加
        this._chatHistory.push({ role: 'ai', content: response });
        
        // コードブロックを抽出
        this._extractedCodeBlocks = this._extractCodeBlocks(response);
        
        // WebViewに応答を送信
        this._panel.webview.postMessage({
          command: 'addAIResponse',
          text: response,
          codeBlocks: this._extractedCodeBlocks.map(block => ({
            id: block.id,
            language: block.language
          }))
        });
        
        Logger.info('AI応答を受信して表示しました');
      }
    } catch (error) {
      Logger.error(`AI応答の取得に失敗: ${(error as Error).message}`);
      
      // エラーメッセージをWebViewに送信
      this._panel.webview.postMessage({
        command: 'showError',
        text: `AI応答の取得に失敗しました: ${(error as Error).message}`
      });
    }
  }
  
  /**
   * チャット履歴をクリアする
   */
  private async _handleClearChat(): Promise<void> {
    try {
      // チャット履歴をリセット
      this._chatHistory = [];
      this._extractedCodeBlocks = [];
      
      // WebViewに通知
      this._panel.webview.postMessage({
        command: 'chatCleared'
      });
      
      Logger.info('チャット履歴をクリアしました');
    } catch (error) {
      Logger.error(`チャット履歴のクリアに失敗: ${(error as Error).message}`);
      
      vscode.window.showErrorMessage(`チャット履歴のクリアに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 外部ブラウザでHTMLをプレビュー
   */
  private async _handleOpenExternalPreview(html: string, blockId?: number): Promise<void> {
    try {
      let htmlContent = html;
      
      // ブロックIDが指定されている場合は、抽出済みのコードブロックからHTMLを取得
      // これにより保存機能と同じソースからコードを取得できる
      if (blockId !== undefined) {
        const codeBlock = this._extractedCodeBlocks.find(block => block.id === blockId);
        if (codeBlock) {
          htmlContent = codeBlock.code;
        }
      }
      
      // 一時ファイルパスの作成
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `preview-${Date.now()}.html`);
      
      // HTMLを整形する (必要に応じて)
      const formattedHtml = this._formatHtmlForPreview(htmlContent);
      
      // 整形したHTMLを一時ファイルに書き込む
      fs.writeFileSync(tempFile, formattedHtml);
      
      // デフォルトブラウザで開く
      await vscode.env.openExternal(vscode.Uri.file(tempFile));
      
      Logger.info(`HTMLプレビューを外部ブラウザで表示: ${tempFile}`);
    } catch (error) {
      Logger.error(`外部ブラウザでのプレビュー表示に失敗: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`プレビューの表示に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * HTMLコードを整形してプレビュー用に最適化
   */
  private _formatHtmlForPreview(html: string): string {
    // すでに整形されていて正しくインデントされているかチェック
    const isFormatted = /\n\s+</.test(html);
    
    if (isFormatted) {
      // すでに整形されている場合はそのまま返す
      return html;
    }
    
    try {
      // 基本的な整形 - タグの後に改行を追加
      let formatted = html
        .replace(/></g, '>\n<')         // タグの間に改行を追加
        .replace(/>\s+</g, '>\n<')      // 既存のスペースを改行に置き換え
        .replace(/\n+/g, '\n');         // 連続した改行を1つにまとめる
      
      // インデントを追加
      const lines = formatted.split('\n');
      let indentLevel = 0;
      const indentedLines = lines.map(line => {
        // 閉じタグの場合はインデントレベルを下げる
        if (line.match(/^<\//) && indentLevel > 0) {
          indentLevel--;
        }
        
        // 現在のインデントレベルでインデント
        const indentedLine = '  '.repeat(indentLevel) + line;
        
        // 開始タグの場合はインデントレベルを上げる
        // 自己終了タグ以外の開始タグの場合
        if (line.match(/^<[^/][^>]*>$/) && !line.match(/\/>$/)) {
          indentLevel++;
        }
        
        return indentedLine;
      });
      
      return indentedLines.join('\n');
    } catch (error) {
      // 整形に失敗した場合は元のHTMLを返す
      Logger.warn(`HTMLの整形に失敗しました: ${(error as Error).message}`);
      return html;
    }
  }
  
  /**
   * コードブロックを抽出
   */
  private _extractCodeBlocks(text: string): Array<{id: number, language: string, code: string}> {
    const codeBlocks: Array<{id: number, language: string, code: string}> = [];
    // 複数のパターンに対応するための正規表現
    // 1. 標準的なバッククォート3つのマークダウン: ```language \n code \n ```
    // 2. 空白を含む場合: ``` language \n code \n ```
    // 3. 直後に改行がない場合も対応: ```language\ncode```
    const regex = /```\s*([a-zA-Z0-9_+-]*)\s*\n([\s\S]*?)```/g;
    
    let match;
    let id = 0;
    
    // 抽出を試みる
    while ((match = regex.exec(text)) !== null) {
      let language = (match[1] || '').trim();
      if (!language) language = 'text';
      
      const code = match[2];
      
      // 空のコードブロックはスキップ
      if (code.trim().length === 0) continue;
      
      Logger.debug(`コードブロック抽出: 言語=${language}, コード長さ=${code.length}`);
      
      codeBlocks.push({
        id: id++,
        language,
        code
      });
    }
    
    // ブロックが見つからない場合のデバッグ情報
    if (codeBlocks.length === 0) {
      Logger.warn(`コードブロックが見つかりませんでした。入力テキスト先頭(200文字):\n${text.substring(0, 200)}...`);
      
      // 代替パターンを試す (```の形式が厳密でない場合)
      const alternativeRegex = /```([\s\S]*?)```/g;
      while ((match = alternativeRegex.exec(text)) !== null) {
        const content = match[1];
        if (content.trim().length > 0) {
          // コードの先頭行を言語として扱う試み
          const lines = content.split('\n');
          const firstLine = lines[0].trim();
          const remainingContent = lines.slice(1).join('\n');
          
          // 先頭行が短く、言語っぽければ言語として扱う
          const language = (firstLine.length < 20 && /^[a-zA-Z0-9_+-]+$/.test(firstLine)) 
            ? firstLine 
            : 'text';
          
          const code = (language === firstLine) ? remainingContent : content;
          
          Logger.debug(`代替パターンでコードブロック抽出: 言語=${language}, コード長さ=${code.length}`);
          
          codeBlocks.push({
            id: id++,
            language,
            code
          });
        }
      }
    }
    
    return codeBlocks;
  }
  
  /**
   * コードブロック保存処理
   */
  private async _handleSaveCodeBlock(blockId: number): Promise<void> {
    try {
      // 対象のコードブロックを取得
      const codeBlock = this._extractedCodeBlocks.find(block => block.id === blockId);
      if (!codeBlock) {
        throw new Error('指定されたコードブロックが見つかりません');
      }
      
      // HTML形式のコードブロックの場合のみモックアップとして保存
      const isHtmlBlock = codeBlock.language === 'html';
      
      if (isHtmlBlock) {
        // モックアップとして保存
        await this._saveAsNewMockup(codeBlock.code);
      } else {
        // HTMLでない場合は通知
        vscode.window.showInformationMessage('HTMLコードブロックのみモックアップとして保存できます');
      }
    } catch (error) {
      Logger.error(`コードブロック保存エラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`コードブロックの保存に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * HTMLコードをモックアップとして保存
   */
  private async _saveAsNewMockup(htmlCode: string): Promise<void> {
    try {
      // 現在の日付を取得してフォーマット
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const mockupName = `モックアップ_${formattedDate}`;
      
      // プロジェクトパスの確認
      if (!this._projectPath) {
        // プロジェクトパスが設定されていない場合はエラー
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // HTMLファイルを直接保存
      const mockupsDir = path.join(this._projectPath, 'mockups');
      
      // mockupsディレクトリが存在しない場合は作成
      if (!fs.existsSync(mockupsDir)) {
        fs.mkdirSync(mockupsDir, { recursive: true });
      }
      
      // HTMLファイルのパス
      const htmlFilePath = path.join(mockupsDir, `${mockupName}.html`);
      
      // HTMLファイルを保存
      fs.writeFileSync(htmlFilePath, htmlCode);
      
      // 成功メッセージを表示
      vscode.window.showInformationMessage(`モックアップとして保存しました: ${mockupName}`);
      
    } catch (error) {
      Logger.error(`モックアップ保存エラー: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`モックアップの保存に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 言語に応じたファイル拡張子を取得
   */
  private _getExtensionForLanguage(language: string): string {
    const extensions: { [key: string]: string } = {
      'javascript': 'js',
      'js': 'js',
      'typescript': 'ts',
      'ts': 'ts',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'python': 'py',
      'py': 'py',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'csharp': 'cs',
      'cs': 'cs',
      'go': 'go',
      'ruby': 'rb',
      'php': 'php',
      'swift': 'swift',
      'kotlin': 'kt',
      'rust': 'rs',
      'shell': 'sh',
      'bash': 'sh',
      'sql': 'sql',
      'xml': 'xml',
      'yaml': 'yml',
      'markdown': 'md',
      'md': 'md'
    };
    
    return extensions[language.toLowerCase()] || 'txt';
  }
  
  /**
   * WebViewのHTMLを更新
   */
  private _update() {
    if (this._panel.webview) {
      this._panel.webview.html = this._getHtmlForWebview();
      Logger.debug('WebViewのHTMLを更新しました');
    }
  }
  
  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    // スタイルシートとスクリプトのパスを設定
    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'simpleChat.js')
    );
    
    const styleUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'simpleChat.css')
    );
    
    const resetCssUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    
    // WebViewに表示するHTML
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src ${this._panel.webview.cspSource} 'unsafe-inline'; frame-src data:;">
      <link rel="stylesheet" href="${resetCssUri}">
      <link rel="stylesheet" href="${styleUri}">
      <title>要件定義ビジュアライザー</title>
      <style>
        .claudecode-button {
          background-color: #42b883 !important;
          color: white !important;
          border: none !important;
          padding: 4px 12px !important;
          margin-left: 8px;
          font-size: 14px;
        }
        
        .claudecode-button:hover {
          background-color: #35a573 !important;
        }
      </style>
    </head>
    <body>
      <div class="chat-container">
        <div class="chat-header">
          <h2>要件定義ビジュアライザー</h2>
          <div class="header-actions">
            <button id="export-requirements-button" class="export-btn" title="要件定義をプロジェクトに保存">プロジェクトに保存</button>
            <button id="clear-chat-button" class="clear-chat-btn" title="チャット履歴をクリア">クリア</button>
          </div>
        </div>
        
        <div class="tabs">
          <button id="tab-chat" class="tab-button active">AIチャット</button>
          <button id="tab-requirements" class="tab-button">要件定義</button>
        </div>
        
        <div id="content-chat" class="tab-content active">
          <div class="chat-messages" id="chat-messages">
            <div class="message ai">
              <p>はじめまして。私はあなたのアイデアや要望を具体的な形にするUI/UX設計の専門家です。
まずは、どのようなシステムを作りたいのか、普段の業務や課題について教えていただけませんか？

専門的な用語は必要ありません。普段どんな作業をしているか、何に困っているか、
理想的にはどうなってほしいかを、できるだけ具体的に教えてください。

例えば：
- 毎日の在庫管理が大変で、もっと簡単にしたい
- 顧客情報がバラバラで一元管理したい
- 営業報告をスマホからさっと入力したい

といった具合です。どんなことでも構いませんので、お聞かせください。</p>
            </div>
          </div>
          
          <div class="chat-input">
            <textarea id="message-input" placeholder="メッセージを入力..."></textarea>
            <button id="send-button">送信</button>
          </div>
        </div>
        
        <div id="content-requirements" class="tab-content">
          <div class="file-preview">
            <div class="file-preview-header">
              <h3>要件定義</h3>
              <div class="actions">
                <button id="edit-requirements" class="action-button">編集</button>
                <button id="save-requirements" class="action-button" disabled>保存</button>
                <button id="claudecode-requirements" class="claudecode-button">AIと相談・編集</button>
              </div>
            </div>
            <div class="file-preview-content">
              <div id="requirements-preview" class="preview-mode"></div>
              <textarea id="requirements-editor" class="edit-mode hidden"></textarea>
            </div>
          </div>
        </div>
        
        <div class="status-bar">
          <span id="status-message" class="status-message">準備完了</span>
        </div>
      </div>
      
      <script src="${scriptUri}"></script>
    </body>
    </html>`;
  }
  
  /**
   * プロジェクト構造生成
   */
  private async _handleGenerateProjectStructure(): Promise<void> {
    try {
      Logger.info('プロジェクト構造生成を開始します');
      
      // 会話履歴をAPI形式に変換
      const formattedChatHistory = this._chatHistory.map(msg => ({
        role: (msg.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant' | 'system',
        content: msg.content
      }));
      
      // システムメッセージを追加（プロジェクト構造生成用）
      const systemMessage = {
        role: 'system' as 'system',
        content: `あなたはプロジェクト構造と設計の専門家です。
これまでの会話内容に基づいて、適切なディレクトリ構造とファイル構成を提案してください。
回答は以下の形式で行ってください：

1. 会話から把握した要件の要約
2. 推奨するディレクトリ構造をツリー形式で表示
3. 主要なファイルとその役割の説明
4. 使用する技術やライブラリの提案
5. 実装におけるポイントや注意点

ディレクトリ構造は機能別に整理してください。例えば、認証機能であれば「Twitter」フォルダの中に「twitterRoute.js」「twitterService.js」「twitterController.js」などを配置する形式です。

レイヤー別（routes, services, controllersなど横断的に分ける）ではなく、機能別（Twitter, Auth, Profileなど）にフォルダを分けてください。

ディレクトリ構造は視覚的に理解しやすいように、以下のようなフォーマットで表現してください：

\`\`\`
project/
├── src/
│   ├── Twitter/
│   │   ├── twitterRoute.js
│   │   ├── twitterService.js
│   │   └── twitterController.js
│   ├── Auth/
│   │   ├── authRoute.js
│   │   └── authService.js
│   ├── Profile/
│   │   ├── profileRoute.js
│   │   └── profileService.js
│   └── App.js
├── public/
│   └── index.html
└── package.json
\`\`\`

各ファイルの説明は簡潔かつ的確に行ってください。`
      };
      
      const messages = [systemMessage, ...formattedChatHistory];
      
      // AIに要求を送信
      const response = await this._aiService.sendMessage(
        "プロジェクト構造を生成してください", 
        'project-structure'
      );
      
      // チャット履歴にユーザーメッセージを追加
      this._chatHistory.push({ 
        role: 'user', 
        content: "プロジェクト構造を生成してください。これまでの会話をもとに最適なディレクトリ構造とファイル構成を提案してください。" 
      });
      
      // チャット履歴にAI応答を追加
      this._chatHistory.push({ role: 'ai', content: response });
      
      // コードブロックを抽出
      this._extractedCodeBlocks = this._extractCodeBlocks(response);
      
      // WebViewに応答を送信
      this._panel.webview.postMessage({
        command: 'projectStructureGenerated',
        text: response,
        codeBlocks: this._extractedCodeBlocks.map(block => ({
          id: block.id,
          language: block.language
        }))
      });
      
      Logger.info('プロジェクト構造生成が完了しました');
      
    } catch (error) {
      Logger.error(`プロジェクト構造生成に失敗: ${(error as Error).message}`);
      
      // エラーメッセージをWebViewに送信
      this._panel.webview.postMessage({
        command: 'showError',
        text: `プロジェクト構造生成に失敗しました: ${(error as Error).message}`
      });
    }
  }
  
  /**
   * プロジェクト作成（スケルトン生成）
   */
  private async _handleCreateProject(): Promise<void> {
    try {
      // WebViewにプロジェクト作成中のメッセージを送信
      this._panel.webview.postMessage({
        command: 'showMessage',
        text: 'プロジェクト作成準備中...'
      });
      
      Logger.info('プロジェクト作成を開始します');
      
      // ユーザーにプロジェクト名を最初に確認
      const suggestedProjectName = "新規プロジェクト";
      
      // ダイアログを確実に表示するためにActiveWindowの確認
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      
      // 少し遅延を入れる（VSCode UIの問題対策）
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ユーザーにプロジェクト名を直接確認
      const projectName = await vscode.window.showInputBox({
        title: 'プロジェクト作成',
        prompt: 'プロジェクト名を入力してください',
        value: suggestedProjectName,
        placeHolder: '例: my-awesome-project',
        ignoreFocusOut: true // フォーカスが外れても閉じない
      });
      
      if (!projectName) {
        Logger.info('プロジェクト名入力がキャンセルされました');
        // キャンセルメッセージをWebViewに送信
        await this._panel.webview.postMessage({
          command: 'showMessage',
          text: 'プロジェクト作成がキャンセルされました'
        });
        return;
      }
      
      // WebViewに進行状況を通知
      await this._panel.webview.postMessage({
        command: 'showMessage',
        text: `プロジェクト「${projectName}」の構造を生成中...`
      });
      
      // 会話履歴をAPI形式に変換
      const formattedChatHistory = this._chatHistory.map(msg => ({
        role: (msg.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant' | 'system',
        content: msg.content
      }));
      
      // システムメッセージを追加（ディレクトリ構造とプロジェクト名を生成）
      const systemMessage = {
        role: 'system' as 'system',
        content: `あなたはプロジェクト構造の専門家です。
これまでの会話に基づいて、ディレクトリとファイルの構造を生成してください。
コード内容は生成せず、単純なディレクトリとファイルの構造をリストアップしてください。

以下の形式で回答してください：

\`\`\`
${projectName}/
├── package.json
├── public/
│   ├── index.html
│   └── styles/
│       └── main.css
├── src/
│   ├── Twitter/
│   │   ├── twitterController.js
│   │   ├── twitterService.js
│   │   └── twitterRoutes.js
│   ├── Auth/
│   │   ├── authController.js
│   │   ├── authService.js
│   │   └── authRoutes.js
│   └── App.js
\`\`\`

重要なルール:
- 指定されたプロジェクト名「${projectName}」を使用してください
- 実際のコードは生成しないでください
- ディレクトリ構造のみをツリー形式で表示してください
- それぞれのファイルに適切な拡張子を付けてください
- フォルダ名の後には必ず / を付けてください
- 説明が必要な場合はディレクトリ構造の後に簡潔に説明してください
- ディレクトリ構造はレイヤー別（controllers/, services/, routes/など）ではなく、機能別（Twitter/, Auth/, Profile/など）に設計してください`
      };
      
      const messages = [systemMessage, ...formattedChatHistory];
      
      // AIに要求を送信
      const response = await this._aiService.sendMessage(
        `${projectName}プロジェクトのディレクトリとファイル構造を生成してください`, 
        'project-creation',
        messages
      );
      
      // チャット履歴にユーザーメッセージを追加
      this._chatHistory.push({ 
        role: 'user', 
        content: `${projectName}プロジェクトのディレクトリとファイル構造を生成してください` 
      });
      
      // チャット履歴にAI応答を追加
      this._chatHistory.push({ role: 'ai', content: response });
      
      // WebViewに応答を送信
      await this._panel.webview.postMessage({
        command: 'projectCreated',
        text: response
      });
      
      Logger.info('プロジェクト構造生成応答が完了しました');
      
      // ファイル操作マネージャーを取得
      const fileManager = FileOperationManager.getInstance();
      
      // 親ディレクトリ選択ダイアログを表示
      await this._panel.webview.postMessage({
        command: 'showMessage',
        text: 'プロジェクトを作成する親ディレクトリを選択してください'
      });
      
      // 少し遅延を入れる（VSCode UIの問題対策）
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const parentDirPath = await fileManager.selectProjectRoot();
      if (!parentDirPath) {
        Logger.info('親ディレクトリ選択がキャンセルされました');
        // キャンセルメッセージをWebViewに送信
        await this._panel.webview.postMessage({
          command: 'showMessage',
          text: 'プロジェクト作成がキャンセルされました'
        });
        return;
      }
      
      // プロジェクトフォルダを作成
      const rootPath = path.join(parentDirPath, projectName);
      await fileManager.ensureDirectoryExists(rootPath);
      Logger.info(`プロジェクトフォルダを作成しました: ${rootPath}`);
      
      // ディレクトリ構造を解析
      let files: Array<{ path: string, content: string }> = [];
      
      // ディレクトリ構造を抽出（```で囲まれたブロック内）
      const structureMatch = response.match(/```[\s\S]*?([\s\S]*?)```/);
      if (!structureMatch || !structureMatch[1]) {
        throw new Error('ディレクトリ構造が見つかりませんでした');
      }
      
      const structureText = structureMatch[1].trim();
      Logger.debug(`抽出されたディレクトリ構造:\n${structureText}`);
      
      // ディレクトリ構造からファイルパスを抽出する関数
      function parseDirectoryTree(text: string): Array<{ path: string, content: string }> {
        const result: Array<{ path: string, content: string }> = [];
        
        // 空行を除去して行ごとに分割
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        // ルートディレクトリを特定
        let rootDir = '';
        if (lines.length > 0 && lines[0].trim().endsWith('/')) {
          rootDir = lines[0].trim().replace('/', '');
          Logger.debug(`ルートディレクトリ: ${rootDir}`);
          lines.shift();
        }
        
        // ディレクトリの階層を管理するスタック
        const dirStack: string[] = [];
        
        // 各行を処理
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // インデントの深さを計算 (スペースと記号の数)
          const indent = line.search(/[^\s│├└─+|\\]/);
          
          // インデントからレベルを計算 (2スペースで1レベル)
          const level = Math.floor(indent / 2);
          
          // 名前部分を抽出 (すべての記号とスペースを除去)
          let name = line.trim();
          name = name.replace(/[│├└─+|\\]/g, '').trim(); // すべての記号を削除
          
          // ディレクトリかファイルかを判定
          const isDirectory = name.endsWith('/');
          
          // クリーンな名前 (末尾のスラッシュを除去)
          const cleanName = isDirectory ? name.slice(0, -1) : name;
          
          // スタックをレベルに合わせる
          while (dirStack.length > level) {
            dirStack.pop();
          }
          
          if (isDirectory) {
            // ディレクトリの場合はスタックに追加
            dirStack[level] = cleanName;
            Logger.debug(`ディレクトリを追加: ${cleanName}, レベル=${level}, スタック=${dirStack.filter(Boolean).join('/')}`);
          } else {
            // ファイルの場合はパスを構築
            const validDirs = dirStack.slice(0, level).filter(Boolean);
            const filePath = [...validDirs, cleanName].join('/');
            
            // ルートディレクトリがある場合は付加
            const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
            
            // スケルトンコンテンツ
            const content = `// ${fullPath}\n\n// このファイルは自動生成されたスケルトンです\n\n`;
            
            result.push({
              path: fullPath,
              content: content
            });
            
            Logger.debug(`ファイルを抽出: ${fullPath}`);
          }
        }
        
        return result;
      }
      
      // パースしたファイルを取得
      files = parseDirectoryTree(structureText);
      
      // 代替パーサーを使用（ファイルが見つからない場合）
      if (files.length === 0) {
        Logger.info("メインパーサーでファイルが見つからなかったため、代替パーサーを使用します");
        
        // より強力な代替パーサーを実装
        try {
          // ツリー構造を解析する強化版パーサー
          const parseTreeStructure = (text: string): Array<{ path: string, content: string }> => {
            const result: Array<{ path: string, content: string }> = [];
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            // ルートディレクトリ名を特定
            let rootDir = '';
            if (lines.length > 0 && lines[0].endsWith('/')) {
              rootDir = lines[0].replace('/', '');
              lines.shift(); // ルート行を削除
            }
            
            // 各行のインデントレベルを計算
            const lineInfo = lines.map(line => {
              // インデントレベルを計算（記号を含む先頭の空白文字の数）
              let indentLevel = 0;
              for (const char of line) {
                if ([' ', '│', '├', '└', '─'].includes(char)) {
                  indentLevel++;
                } else {
                  break;
                }
              }
              
              // 実際のパス部分を抽出（インデントと記号を除去）
              const pathPart = line.replace(/^[│├└─\s]+/, '').trim();
              
              return {
                indentLevel: Math.ceil(indentLevel / 2), // 適切なレベル計算
                isDirectory: pathPart.endsWith('/'),
                pathPart: pathPart.endsWith('/') ? pathPart.slice(0, -1) : pathPart
              };
            });
            
            // パスの構築用
            const pathStack: string[] = [];
            
            for (let i = 0; i < lineInfo.length; i++) {
              const { indentLevel, isDirectory, pathPart } = lineInfo[i];
              
              // スタックをインデントレベルに合わせる
              while (pathStack.length > indentLevel) {
                pathStack.pop();
              }
              
              if (isDirectory) {
                pathStack[indentLevel] = pathPart;
              } else {
                // スタックの有効な部分だけを取得
                const validStack = pathStack.slice(0, indentLevel);
                
                // ファイルパスを構築
                const filePath = [...validStack, pathPart].join('/');
                
                // コンテンツを作成
                const content = `// ${filePath}\n\n// このファイルは自動生成されたスケルトンです\n\n`;
                
                result.push({
                  path: filePath,
                  content: content
                });
                
                Logger.debug(`強化パーサーでファイルパスを抽出: ${filePath}, スタック: ${JSON.stringify(validStack)}`);
              }
            }
            
            return result;
          };
          
          // 強化版パーサーでファイルを抽出
          const extractedFiles = parseTreeStructure(structureText);
          if (extractedFiles.length > 0) {
            files.push(...extractedFiles);
            Logger.info(`強化パーサーで ${extractedFiles.length} 個のファイルを抽出しました`);
          } else {
            // それでも見つからない場合は単純な正規表現でファイルパスを探す
            Logger.info("強化パーサーでもファイルが見つからなかったため、正規表現パーサーを使用します");
            const filePathRegex = /([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/g;
            let match;
            while ((match = filePathRegex.exec(structureText)) !== null) {
              const filePath = match[1];
              const content = `// ${filePath}\n\n// このファイルは自動生成されたスケルトンです\n\n`;
              
              files.push({
                path: filePath,
                content: content
              });
              
              Logger.debug(`正規表現パーサーでファイルパスを抽出しました: ${filePath}`);
            }
          }
        } catch (error) {
          Logger.error(`強化パーサーでエラーが発生しました: ${(error as Error).message}`);
          
          // 最後の手段として単純な正規表現でファイルパスを探す
          const filePathRegex = /([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/g;
          let match;
          while ((match = filePathRegex.exec(structureText)) !== null) {
            const filePath = match[1];
            const content = `// ${filePath}\n\n// このファイルは自動生成されたスケルトンです\n\n`;
            
            files.push({
              path: filePath,
              content: content
            });
            
            Logger.debug(`緊急パーサーでファイルパスを抽出しました: ${filePath}`);
          }
        }
      }
      
      // それでもファイルがない場合
      if (files.length === 0) {
        // エラーメッセージをWebViewに送信
        await this._panel.webview.postMessage({
          command: 'showError',
          text: 'ディレクトリ構造からファイル情報を抽出できませんでした。'
        });
        return;
      }
      
      // デバッグ用に抽出されたファイルパスを表示（テスト用）
      Logger.info(`抽出されたファイル一覧 (${files.length}件):`);
      files.forEach((file, index) => {
        Logger.info(`${index + 1}. ${file.path}`);
      });
      
      // ファイル作成前にディレクトリが正しく構築されているか確認するテスト関数
      const testDirectoryCreation = async (rootDir: string, filePaths: string[]): Promise<void> => {
        try {
          Logger.info(`ディレクトリ作成テストを開始: ${rootDir}`);
          
          // 各ファイルパスからディレクトリパスを抽出
          const dirPaths = new Set<string>();
          
          filePaths.forEach(filePath => {
            const parts = filePath.split('/');
            // ファイル名を除外してディレクトリパスを取得
            if (parts.length > 1) {
              const dirPath = parts.slice(0, -1).join('/');
              dirPaths.add(dirPath);
            }
          });
          
          // ディレクトリパスを階層順（浅い順）にソート
          const sortedDirPaths = Array.from(dirPaths).sort((a, b) => 
            a.split('/').length - b.split('/').length
          );
          
          Logger.info(`作成予定のディレクトリ (${sortedDirPaths.length}件): ${sortedDirPaths.join(', ')}`);
        } catch (error) {
          Logger.error(`ディレクトリ作成テストに失敗: ${(error as Error).message}`);
        }
      };
      
      // テスト実行（実際のファイル作成は行わず、ログのみ出力）
      await testDirectoryCreation(rootPath, files.map(f => f.path));
      
      // プロジェクト構造を作成
      const success = await fileManager.createProjectStructure(rootPath, files);
      
      if (success) {
        // 成功メッセージをWebViewに送信
        await this._panel.webview.postMessage({
          command: 'showMessage',
          text: `プロジェクト「${projectName}」を作成しました: ${rootPath}`
        });
        
        // VSCodeでフォルダを開くか確認
        const openFolder = await vscode.window.showInformationMessage(
          `プロジェクト「${projectName}」を作成しました`,
          'フォルダを開く'
        );
        
        if (openFolder === 'フォルダを開く') {
          // 新しいウィンドウでフォルダを開く
          vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(rootPath), true);
        }
      }
      
    } catch (error) {
      Logger.error(`プロジェクト作成に失敗: ${(error as Error).message}`);
      
      // エラーメッセージをWebViewに送信
      this._panel.webview.postMessage({
        command: 'showError',
        text: `プロジェクト作成に失敗しました: ${(error as Error).message}`
      });
    }
  }

  /**
   * 要件定義をプロジェクトに保存
   */
  private async _handleExportRequirements(): Promise<void> {
    try {
      Logger.info('要件定義のプロジェクト保存を開始します');
      
      // プロジェクト管理サービスからアクティブなプロジェクトを取得
      const projectService = ProjectManagementService.getInstance();
      const activeProject = projectService.getActiveProject();
      
      if (!activeProject) {
        throw new Error('アクティブなプロジェクトがありません。プロジェクトを作成または選択してください。');
      }
      
      // プロジェクトのパスを確認
      if (!activeProject.path) {
        throw new Error('プロジェクトのパスが設定されていません。');
      }
      
      // 会話履歴から要件定義を抽出
      const requirementsDocument = this._generateRequirementsFromChat();
      
      // 要件定義オブジェクトを作成
      const requirements: Requirements = {
        document: requirementsDocument.document,
        sections: requirementsDocument.sections,
        extractedItems: requirementsDocument.extractedItems,
        chatHistory: this._chatHistory.map(msg => ({
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: Date.now()
        }))
      };
      
      // 状態管理サービスに保存
      const stateManager = AppGeniusStateManager.getInstance();
      await stateManager.saveRequirements(activeProject.id, requirements);
      
      // ユーザーに成功メッセージを表示
      vscode.window.showInformationMessage(`要件定義をプロジェクト「${activeProject.name}」に保存しました`);
      
      // WebViewに保存成功メッセージを送信
      this._panel.webview.postMessage({
        command: 'showNotification',
        message: `要件定義をプロジェクト「${activeProject.name}」に保存しました`,
        type: 'success'
      });
      
      Logger.info(`要件定義を保存しました: ${activeProject.id}`);
    } catch (error) {
      Logger.error(`要件定義のプロジェクト保存に失敗: ${(error as Error).message}`);
      
      // エラーメッセージを表示
      vscode.window.showErrorMessage(`要件定義の保存に失敗しました: ${(error as Error).message}`);
      
      // WebViewにエラーメッセージを送信
      this._panel.webview.postMessage({
        command: 'showError',
        text: `要件定義の保存に失敗しました: ${(error as Error).message}`
      });
    }
  }
  
  /**
   * チャット履歴から要件定義を生成
   */
  private _generateRequirementsFromChat(): { document: string, sections: any[], extractedItems: any[] } {
    // 会話履歴を元に要件をまとめる
    let document = '';
    const sections = [];
    const extractedItems = [];
    
    // AIの応答から要件らしき内容を抽出
    for (let i = 0; i < this._chatHistory.length; i++) {
      const message = this._chatHistory[i];
      
      if (message.role === 'ai') {
        // AIの応答から要件定義に関する部分を抽出
        document += message.content + '\n\n';
        
        // 見出しを含む行を検出してセクションに分割
        const headingRegex = /#+\s+(.*)/g;
        let match;
        
        while ((match = headingRegex.exec(message.content)) !== null) {
          const headingTitle = match[1];
          const sectionId: string = `section_${Date.now()}_${sections.length}`;
          
          sections.push({
            id: sectionId,
            title: headingTitle,
            content: match[0] // 見出しを含む行
          });
          
          // 機能要件と思われる項目を抽出
          if (headingTitle.includes('機能要件') || headingTitle.includes('要件') || 
              headingTitle.includes('必要な機能') || headingTitle.includes('主な機能')) {
            
            // 番号付きリストアイテムを検出
            const listItemRegex = /\d+\.\s+(.*?)(?=\n\d+\.|$)/gs;
            let listMatch;
            
            while ((listMatch = listItemRegex.exec(message.content)) !== null) {
              const itemText = listMatch[1].trim();
              const itemLines = itemText.split('\n');
              const itemTitle = itemLines[0].trim();
              
              // 優先度を検出（ない場合はデフォルト「medium」）
              let priority = 'medium';
              const priorityMatch = itemText.match(/優先[度順][:：]?\s*(高|中|低)/);
              if (priorityMatch) {
                const priorityText = priorityMatch[1];
                if (priorityText === '高') priority = 'high';
                else if (priorityText === '中') priority = 'medium';
                else if (priorityText === '低') priority = 'low';
              }
              
              extractedItems.push({
                id: `req_${Date.now()}_${extractedItems.length}`,
                title: itemTitle,
                description: itemText,
                priority: priority
              });
            }
          }
        }
      }
    }
    
    return {
      document,
      sections,
      extractedItems
    };
  }

  /**
   * 初期データ読み込み処理
   */
  /**
   * デフォルトのプロジェクトパスを取得
   * @returns デフォルトのプロジェクトパス
   */
  private _getDefaultProjectPath(): string {
    try {
      // AppGeniusStateManagerからアクティブプロジェクトパスの取得を試みる
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { AppGeniusStateManager } = require('../services/AppGeniusStateManager');
        const stateManager = AppGeniusStateManager.getInstance();
        const activeProjectId = stateManager.getActiveProjectId();
        
        if (activeProjectId) {
          const projectPath = stateManager.getProjectPath(activeProjectId);
          if (projectPath) {
            // プロジェクトのdocsフォルダにrequirements.mdファイルがあるか確認
            const requirementsPath = path.join(projectPath, 'docs', 'requirements.md');
            if (fs.existsSync(requirementsPath)) {
              Logger.info(`プロジェクトのdocsフォルダにrequirements.mdファイルが見つかりました: ${requirementsPath}`);
            }
            
            Logger.info(`AppGeniusStateManagerからプロジェクトパスを取得: ${projectPath}`);
            return projectPath;
          }
        }
      } catch (stateError) {
        // ステートマネージャーの取得に失敗した場合は警告を出して次の方法へ
        Logger.debug(`StateManagerからのパス取得失敗: ${(stateError as Error).message}`);
      }
      
      // VSCodeのアクティブなプロジェクトパスを取得（ワークスペースフォルダ）
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (workspaceFolders && workspaceFolders.length > 0) {
        const wsPath = workspaceFolders[0].uri.fsPath;
        
        // ワークスペースのdocsフォルダにrequirements.mdファイルがあるか確認
        const requirementsPath = path.join(wsPath, 'docs', 'requirements.md');
        if (fs.existsSync(requirementsPath)) {
          Logger.info(`ワークスペースのdocsフォルダにrequirements.mdファイルが見つかりました: ${requirementsPath}`);
        }
        
        Logger.info(`ワークスペースフォルダからプロジェクトパスを取得: ${wsPath}`);
        return wsPath;
      }
      
      // ProjectManagementServiceからアクティブプロジェクト取得を試みる
      try {
        const projectService = ProjectManagementService.getInstance();
        const activeProject = projectService.getActiveProject();
        if (activeProject && activeProject.path) {
          const projectPath = activeProject.path;
          Logger.info(`ProjectManagementServiceからプロジェクトパスを取得: ${projectPath}`);
          return projectPath;
        }
      } catch (e) {
        Logger.warn(`ProjectManagementService取得エラー: ${(e as Error).message}`);
      }
      
      // 現在のディレクトリを使用
      const currentPath = process.cwd();
      
      // 現在のディレクトリのdocsフォルダにrequirements.mdファイルがあるか確認
      const currentRequirementsPath = path.join(currentPath, 'docs', 'requirements.md');
      if (fs.existsSync(currentRequirementsPath)) {
        Logger.info(`カレントディレクトリのdocsフォルダにrequirements.mdファイルが見つかりました: ${currentRequirementsPath}`);
      }
      
      Logger.info(`カレントディレクトリからプロジェクトパスを取得: ${currentPath}`);
      return currentPath;
    } catch (error) {
      // エラーが発生した場合は現在のディレクトリをフォールバックとして使用
      const fallbackPath = process.cwd();
      Logger.error(`プロジェクトパスの取得中にエラー: ${(error as Error).message}`);
      Logger.info(`フォールバックパスを使用: ${fallbackPath}`);
      return fallbackPath;
    }
  }

  private async _loadInitialData(): Promise<void> {
    try {
      // プロジェクトパスが設定されているか確認
      const projectPath = this._projectPath;
      Logger.info(`_loadInitialData開始: 現在のプロジェクトパス: ${projectPath || 'なし'}`);
      
      if (!projectPath) {
        Logger.warn('プロジェクトパスが設定されていません。デフォルト値を使用します。');
        
        // デフォルトプロジェクトパスを取得
        this._projectPath = this._getDefaultProjectPath();
        Logger.info(`デフォルトプロジェクトパスを設定しました: ${this._projectPath}`);
      }
      
      // プロジェクトパスを使用
      const basePath = this._projectPath || this._getDefaultProjectPath();
      Logger.info(`プロジェクトパスを使用: ${basePath}`);
      
      // docsディレクトリのパス
      const docsDir = path.join(basePath, 'docs');
      
      // docsディレクトリが存在するか確認
      if (!fs.existsSync(docsDir)) {
        Logger.info(`docsディレクトリが存在しないため作成します: ${docsDir}`);
        try {
          fs.mkdirSync(docsDir, { recursive: true });
          Logger.info(`docsディレクトリを作成しました: ${docsDir}`);
        } catch (mkdirError) {
          Logger.error(`docsディレクトリの作成に失敗しました: ${(mkdirError as Error).message}`);
        }
      }
      
      // 要件定義ファイルのパスを構成
      const requirementsPath = path.join(docsDir, 'requirements.md');
      
      Logger.info(`要件定義ファイルパス: ${requirementsPath}`);
      
      // 要件定義ファイルの読み込み
      let requirementsContent = '';
      if (fs.existsSync(requirementsPath)) {
        Logger.info('要件定義ファイルが見つかりました、読み込みを開始します');
        try {
          requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
          Logger.info(`要件定義ファイルを読み込みました (${requirementsContent.length} 文字)`);
        } catch (readError) {
          Logger.error(`要件定義ファイルの読み込みに失敗しました: ${(readError as Error).message}`);
          // ファイル読み込み失敗時のメッセージを表示
          this._panel.webview.postMessage({
            command: 'showError',
            text: `要件定義ファイルの読み込みに失敗しました: ${(readError as Error).message}`
          });
        }
      } else {
        Logger.warn(`要件定義ファイルが見つかりません: ${requirementsPath}`);
        
        // ファイルが存在しない場合に表示するメッセージ
        this._panel.webview.postMessage({
          command: 'showWarning',
          text: `要件定義ファイルが見つかりません: ${requirementsPath}`
        });
      }
      
      // 初期テンプレートからの変更を検出し、フェーズを更新
      try {
        // ProjectManagementServiceを取得
        const { ProjectManagementService } = await import('../services/ProjectManagementService');
        const { AppGeniusStateManager } = await import('../services/AppGeniusStateManager');
        
        const projectService = ProjectManagementService.getInstance();
        const stateManager = AppGeniusStateManager.getInstance();
        
        // アクティブなプロジェクトを取得
        const activeProject = projectService.getActiveProject();
        if (activeProject) {
          const projectId = activeProject.id;
          
          // 要件定義ファイルの変更を検出
          if (requirementsContent) {
            const isRequirementsChanged = await this._isFileChangedFromTemplate(
              requirementsContent, 
              'requirements'
            );
            
            if (isRequirementsChanged) {
              // フェーズを更新
              await projectService.updateProjectPhase(projectId, 'requirements', true);
              Logger.info(`要件定義ファイルの変更を検出し、フェーズを更新しました: ${projectId}`);
            }
          }
        }
      } catch (e) {
        Logger.warn(`フェーズ更新処理でエラーが発生しました: ${(e as Error).message}`);
      }

      // ファイル監視を設定
      this._setupFileWatcher();

      // WebViewに初期データ送信
      this._panel.webview.postMessage({
        command: 'initialData',
        requirementsContent,
        projectRoot: basePath,
        projectPath: this._projectPath || 'パスなし',
        projectInfo: {
          path: this._projectPath,
          source: this._projectPath === basePath ? '直接指定パス' : 'デフォルトパス'
        }
      });
      
      Logger.info('WebViewに初期データを送信しました');
      
      // デバッグ用にパネルに直接メッセージを表示
      this._panel.webview.postMessage({
        command: 'showMessage',
        text: `ファイル読み込み: 要件定義(${requirementsContent.length}文字)`
      });
    } catch (error) {
      Logger.error('初期データ読み込みエラー', error as Error);
      
      // エラーをWebViewに通知
      this._panel.webview.postMessage({
        command: 'showError',
        text: `ファイル読み込みエラー: ${(error as Error).message}`
      });
    }
  }
  
  /**
   * 要件定義ファイルの監視を設定
   */
  private _setupFileWatcher(): void {
    try {
      // 既存のウォッチャーがあれば破棄
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
      }
      
      // プロジェクトパスが設定されていない場合はデフォルトパスを取得
      if (!this._projectPath) {
        this._projectPath = this._getDefaultProjectPath();
        Logger.info(`ファイル監視用にデフォルトプロジェクトパスを設定: ${this._projectPath}`);
      }
      
      // requirements.mdファイルの格納されているdocsディレクトリのパス
      const docsDir = path.join(this._projectPath, 'docs');
      
      // ディレクトリが存在するか確認
      if (!fs.existsSync(docsDir)) {
        try {
          fs.mkdirSync(docsDir, { recursive: true });
          Logger.info(`docsディレクトリを作成しました: ${docsDir}`);
        } catch (mkdirError) {
          Logger.error(`docsディレクトリの作成に失敗しました: ${(mkdirError as Error).message}`);
        }
      }
      
      // 要件定義ファイルのパターン
      const requirementsGlob = new vscode.RelativePattern(
        this._projectPath,
        'docs/requirements.md'
      );
      
      // 要件定義ファイルのパス
      const requirementsPath = path.join(docsDir, 'requirements.md');
      
      // ファイルの存在を確認してログに記録
      if (fs.existsSync(requirementsPath)) {
        Logger.info(`監視対象ファイルが存在します: ${requirementsPath}`);
      } else {
        Logger.warn(`監視対象ファイルが存在しません: ${requirementsPath}`);
      }
      
      // ファイルウォッチャーを作成
      this._fileWatcher = vscode.workspace.createFileSystemWatcher(requirementsGlob);
      
      // ファイル変更イベントをリッスン
      this._fileWatcher.onDidChange(async (uri) => {
        try {
          Logger.info(`要件定義ファイルの変更を検出しました: ${uri.fsPath}`);
          
          // ファイルが存在するか確認
          if (fs.existsSync(uri.fsPath)) {
            try {
              // ファイル内容を読み込む
              const content = fs.readFileSync(uri.fsPath, 'utf8');
              
              // WebViewに更新通知
              this._panel.webview.postMessage({
                command: 'updateRequirementsContent',
                content: content
              });
              
              Logger.info(`要件定義タブの内容を更新しました (${content.length} 文字)`);
              
              // ユーザーに通知
              this._panel.webview.postMessage({
                command: 'showMessage',
                text: `要件定義ファイルが更新されました (${content.length} 文字)`
              });
            } catch (readError) {
              Logger.error(`ファイル読み込みエラー: ${(readError as Error).message}`);
              
              // エラーをユーザーに通知
              this._panel.webview.postMessage({
                command: 'showError',
                text: `ファイル読み込みエラー: ${(readError as Error).message}`
              });
            }
          } else {
            Logger.warn(`変更を検出したファイルが存在しません: ${uri.fsPath}`);
          }
        } catch (error) {
          Logger.error(`要件定義ファイル更新の監視中にエラーが発生: ${(error as Error).message}`);
        }
      });
      
      // ファイル作成イベントのリスナーを追加
      this._fileWatcher.onDidCreate(async uri => {
        try {
          const filePath = uri.fsPath;
          Logger.info(`新しい要件定義ファイルが作成されました: ${filePath}`);
          
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            this._panel.webview.postMessage({
              command: 'updateRequirementsContent',
              content
            });
            
            Logger.info(`新しい要件定義ファイルを読み込みました: ${filePath} (${content.length} 文字)`);
            
            // ユーザーに通知
            this._panel.webview.postMessage({
              command: 'showMessage',
              text: `要件定義ファイルが作成されました (${content.length} 文字)`
            });
          } catch (readError) {
            Logger.error(`新ファイル読み込みエラー: ${(readError as Error).message}`);
          }
        } catch (error) {
          Logger.error(`ファイル作成の処理中にエラー: ${(error as Error).message}`);
        }
      });
      
      // ファイル削除イベントのリスナーを追加
      this._fileWatcher.onDidDelete(uri => {
        try {
          const filePath = uri.fsPath;
          Logger.warn(`要件定義ファイルが削除されました: ${filePath}`);
          
          // 要件定義ファイルが削除された場合
          this._panel.webview.postMessage({
            command: 'updateRequirementsContent',
            content: ''
          });
          
          // ユーザーに通知
          this._panel.webview.postMessage({
            command: 'showWarning',
            text: `要件定義ファイルが削除されました: ${filePath}`
          });
        } catch (error) {
          Logger.error(`ファイル削除の処理中にエラー: ${(error as Error).message}`);
        }
      });
      
      // ウォッチャーを破棄リストに追加
      this._disposables.push(this._fileWatcher);
      
      Logger.info(`要件定義ファイルの監視を開始しました: ${requirementsPath}`);
    } catch (error) {
      Logger.error(`ファイル監視の設定に失敗: ${(error as Error).message}`);
    }
  }
  
  /**
   * ファイル更新処理
   */
  private async _handleFileUpdate(filePath: string, content: string): Promise<void> {
    try {
      // プロジェクトパスを使用
      const basePath = this._projectPath || '';
      Logger.info(`プロジェクトパスを使用: ${basePath}`);
      
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(basePath, filePath);
      
      // ディレクトリが存在しない場合、作成
      const dirPath = path.dirname(fullPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // ファイル書き込み
      fs.writeFileSync(fullPath, content, 'utf8');
      
      // CLAUDE.md進捗状況も更新
      const isRequirements = filePath.includes('requirements.md');
      
      if (isRequirements) {
        const updates: { [key: string]: boolean } = {
          'requirements': true
        };
        
        // AppGeniusStateManagerを通して要件定義フェーズを更新
        try {
          const { AppGeniusStateManager } = await import('../services/AppGeniusStateManager');
          const { ProjectManagementService } = await import('../services/ProjectManagementService');
          
          const stateManager = AppGeniusStateManager.getInstance();
          const projectService = ProjectManagementService.getInstance();
          
          // アクティブなプロジェクトを取得
          const activeProject = projectService.getActiveProject();
          if (activeProject) {
            // 要件定義ファイルの内容をStateManagerに保存し、フェーズを更新
            await stateManager.saveRequirements(activeProject.id, {
              document: content,
              sections: [],
              extractedItems: [],
              chatHistory: []
            });
          }
        } catch (e) {
          Logger.warn(`プロジェクトフェーズの更新に失敗しました: ${(e as Error).message}`);
        }
        
        // プロジェクトパスを使用
        const basePath = this._projectPath || '';
        
        if (basePath) {
          await this._claudeMdService.updateMultipleProgressStatus(basePath, updates);
        } else {
          Logger.warn('プロジェクトパスが設定されていないため、CLAUDE.md更新をスキップします');
        }
      }
      
      this._panel.webview.postMessage({
        command: 'fileSaved',
        filePath,
        message: `ファイルを保存しました: ${filePath}`
      });
      
      Logger.info(`ファイルを更新しました: ${filePath}`);
    } catch (error) {
      Logger.error(`ファイル更新エラー: ${filePath}`, error as Error);
      
      this._panel.webview.postMessage({
        command: 'showError',
        text: `ファイル保存エラー: ${(error as Error).message}`
      });
    }
  }

  /**
   * ファイルが初期テンプレートから変更されているか確認
   * @param content ファイルの内容
   * @param fileType ファイルの種類（'requirements' または 'structure'）
   */
  private async _isFileChangedFromTemplate(content: string, fileType: 'requirements' | 'structure'): Promise<boolean> {
    // テンプレート内容
    const templates: Record<string, string> = {
      requirements: `# 要件定義

## 機能要件

1. 要件1
   - 説明: 機能の詳細説明
   - 優先度: 高

2. 要件2
   - 説明: 機能の詳細説明
   - 優先度: 中

## 非機能要件

1. パフォーマンス
   - 説明: レスポンス時間や処理能力に関する要件
   - 優先度: 中

2. セキュリティ
   - 説明: セキュリティに関する要件
   - 優先度: 高

## ユーザーストーリー

- ユーザーとして、[機能]を使いたい。それによって[目的]を達成できる。`,
      structure: `# ディレクトリ構造

\`\`\`
project/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── assets/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── models/
\`\`\``
    };
    
    const templateContent = templates[fileType];
    
    // 行数が異なるか確認
    const contentLines = content.split('\n').filter(line => line.trim() !== '');
    const templateLines = templateContent.split('\n').filter(line => line.trim() !== '');
    
    // 行数が明らかに異なる場合は変更されたと判断
    if (Math.abs(contentLines.length - templateLines.length) > 3) {
      return true;
    }
    
    // 同じ行数でも内容が異なるか確認（最低でも30%以上の行が変更されていること）
    let differentLines = 0;
    for (let i = 0; i < Math.min(contentLines.length, templateLines.length); i++) {
      if (contentLines[i] !== templateLines[i]) {
        differentLines++;
      }
    }
    
    const diffPercentage = differentLines / Math.min(contentLines.length, templateLines.length);
    return diffPercentage > 0.3; // 30%以上の行が異なる場合は変更されたと判断
  }

  /**
   * 「モックアップ作成プロンプトを起動」ボタンのハンドラ
   */
  private async _handleLaunchMockupCreator(): Promise<void> {
    try {
      // 確認ダイアログを表示
      const result = await vscode.window.showInformationMessage(
        'モックアップ作成プロンプトを起動しますか？',
        { modal: true },
        '起動する'
      );

      // キャンセルされた場合
      if (result !== '起動する') {
        this._panel?.webview.postMessage({
          command: 'hideLoading'
        });
        return;
      }
      
      // プロジェクトパスを取得
      const projectPath = this._projectPath || this._getDefaultProjectPath();
      
      // ClaudeCodeIntegrationServiceのインスタンスを取得
      const integrationService = ClaudeCodeIntegrationService.getInstance();

      // モックアップクリエイター用のプロンプトURL
      const mockupCreatorUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed';

      // 単一プロンプトでモックアップ作成を起動
      const success = await integrationService.launchWithPublicUrl(
        mockupCreatorUrl,
        projectPath
      );

      // WebViewに通知
      if (success) {
        // 成功メッセージを表示
        vscode.window.showInformationMessage('モックアップ作成プロンプトを起動しました');
        
        this._panel?.webview.postMessage({
          command: 'showSuccess',
          message: 'モックアップ作成プロンプトを起動しました'
        });
      } else {
        throw new Error('モックアップ作成プロンプトの起動に失敗しました');
      }

    } catch (error) {
      Logger.error('モックアップ作成プロンプトの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`モックアップ作成プロンプトの起動に失敗しました: ${(error as Error).message}`);

      // WebViewに通知
      this._panel?.webview.postMessage({
        command: 'showError',
        message: `モックアップ作成プロンプトの起動に失敗しました: ${(error as Error).message}`
      });
    }
  }

  /**
   * 並列モックアップ生成機能
   */
  private async _launchParallelMockupGeneration(
    pages: PageInfo[],
    requirementsPath: string,
    promptUrl: string,
    integrationService: ClaudeCodeIntegrationService
  ): Promise<void> {
    // 同時実行数の制限（設定値または3をデフォルトとする）
    const maxConcurrent = 3;

    // ページごとにClaudeCodeを起動（同時実行数を考慮）
    for (let i = 0; i < pages.length; i += maxConcurrent) {
      // 現在のバッチのページを取得
      const batchPages = pages.slice(i, i + maxConcurrent);

      // バッチ内のページを並列処理
      await Promise.all(batchPages.map(async (page) => {
        try {
          // ページ情報を含む追加コンテンツを生成
          const additionalContent = `
# 追加情報

## ページ情報
- ページ名: ${page.name}
- 説明: ${page.description || 'なし'}
- 主要機能: ${(page.features || []).join(', ')}

## 要件定義ファイル
- パス: ${requirementsPath}

## 指示
このページ（${page.name}）に関するモックアップのみを作成してください。
`;

          // ClaudeCodeを起動
          await integrationService.launchWithPublicUrl(
            promptUrl,
            path.dirname(requirementsPath),
            additionalContent
          );

          Logger.info(`モックアップ生成を開始しました: ${page.name}`);
        } catch (error) {
          Logger.error(`モックアップ生成エラー (${page.name}): ${(error as Error).message}`);
        }
      }));

      // バッチ間で少し待機（システム負荷を考慮）
      if (i + maxConcurrent < pages.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * ClaudeCodeをファイル参照モードで起動
   */
  private async _launchClaudeCode(filePath: string): Promise<boolean> {
    try {
      // プロジェクトパスを取得 - クラスのプロパティを使用
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません。アクティブなプロジェクトを選択してください。');
      }
      
      Logger.info(`プロジェクトパスを使用: ${this._projectPath}`);
      
      // 要件定義ファイルの絶対パスを取得
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this._projectPath, filePath);

      if (!fs.existsSync(fullPath)) {
        this._panel.webview.postMessage({
          command: 'showError',
          text: `ファイルが見つかりません: ${filePath}`
        });
        return false;
      }
      
      // WebViewに起動中メッセージを表示
      this._panel.webview.postMessage({
        command: 'showMessage',
        text: `AIを起動しています: ${filePath}`
      });
      
      // 要件定義ファイルの内容を読み込み
      const fileContent = fs.readFileSync(fullPath, 'utf8');
      
      // 追加情報として要件定義ファイルの内容を設定
      let analysisContent = '# 追加情報\n\n';
      analysisContent += `## 要件定義ファイル: ${path.basename(fullPath)}\n\n`;
      analysisContent += '```markdown\n';
      analysisContent += fileContent;
      analysisContent += '\n```\n\n';
      
      // ClaudeCodeIntegrationServiceのインスタンスを取得
      const integrationService = ClaudeCodeIntegrationService.getInstance();
      
      // 要件定義アドバイザーのプロンプトURL（セキュリティプロンプトなしで直接使用）
      const featurePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39';
      
      Logger.info(`要件定義アドバイザープロンプトを直接使用してClaudeCodeを起動: ${featurePromptUrl}`);
      
      // 単一プロンプトでClaudeCodeを起動（セキュリティプロンプトは使用しない）
      const success = await integrationService.launchWithPublicUrl(
        featurePromptUrl,
        this._projectPath,
        analysisContent // 重要：要件分析内容を追加コンテンツとして渡す
      );
      
      if (success) {
        // 成功メッセージを表示
        this._panel.webview.postMessage({
          command: 'showMessage',
          text: `AIと相談・編集を開始しました: ${filePath}`
        });
        Logger.info(`要件定義アドバイザーを起動しました`);
      }
      
      return success;
    } catch (error) {
      Logger.error(`AI起動エラー: ${filePath}`, error as Error);
      
      this._panel.webview.postMessage({
        command: 'showError',
        text: `AI起動エラー: ${(error as Error).message}`
      });
      
      return false;
    }
  }

  /**
   * リソース解放
   */
  public dispose(): void {
    SimpleChatPanel.currentPanel = undefined;
    
    // ファイルウォッチャーを解放（すでに_disposablesに追加されている場合もあるが念のため）
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = undefined;
    }
    
    this._panel.dispose();
    
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    Logger.info('シンプルAIチャットパネルを破棄しました');
  }
}