import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AIService } from '../core/aiService';
import { Logger } from '../utils/logger';
import { FileOperationManager } from '../utils/fileOperationManager';

/**
 * シンプルなチャットパネルを管理するクラス
 */
export class SimpleChatPanel {
  public static currentPanel: SimpleChatPanel | undefined;
  private static readonly viewType = 'simpleChat';
  
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _aiService: AIService;
  private _extractedCodeBlocks: Array<{id: number, language: string, code: string}> = [];
  private _chatHistory: Array<{role: 'user' | 'ai', content: string}> = [];
  
  /**
   * シンプルチャットパネルを作成または表示する
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
      
    // すでにパネルがある場合は表示する
    if (SimpleChatPanel.currentPanel) {
      SimpleChatPanel.currentPanel._panel.reveal(column);
      return;
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
        ]
      }
    );
    
    SimpleChatPanel.currentPanel = new SimpleChatPanel(panel, extensionUri, aiService);
  }
  
  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;
    
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
          case 'initialize':
            // 初期化処理（必要に応じて）
            break;
        }
      },
      null,
      this._disposables
    );
    
    // ログ出力
    Logger.info('シンプルAIチャットパネルを作成しました');
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
      
      // 要件定義ビジュアライザー用のシステムメッセージを追加
      const systemMessage = {
        role: 'system' as 'system',
        content: `あなたはUI/UX設計のエキスパートビジュアライザーです。
非技術者の要望を具体的な形にし、技術者が実装できる明確なモックアップと仕様に変換する役割を担います。

目的：
非技術者の要望を視覚的に具現化し、具体的な要件定義の土台を作成し、それを動作するのに必要なページを洗い出して完璧なモックアップを形成し、その後ディレクトリ構造を提案する。
＊モックアップはモックデータを使い、この時点でかなり精密につくりあげておくこと。
＊また、ディレクトリ構造はわかりやすくするためにフロントエンドはページ別、バックエンドは機能別のフォルダ分けの構造をつくる。(絶対に1つのファイルで拡張する予定もないのに馬鹿みたいにディレクトリを作ることは避けること)

Phase#1： 基本要件の把握
ヒアリング項目:
  目的:
    - 解決したい課題
    - 実現したい状態
  ユーザー:
    - 主な利用者
    - 利用シーン
  機能:
    - 必須機能
    - あったら嬉しい機能

Phase#2： 要件を満たす効果的なフロントエンドのページ数とその機能の策定。
・ユーザーにヒアリングをしながら抜け漏れはないかを固める。

Phase#3：Phase#2で満たしたページを1つずつHTMLの1枚モックアップを作る。

【生成規則】
・必ず以下の要素を含む完全なHTMLファイルを一括生成すること:
  1. 必要なすべてのCDNライブラリ（最新の安定バージョンを使用）
  2. スタイリングとレイアウト用のCSS
  3. モックデータとロジック
  4. エラーハンドリング
  5. 視覚的フィードバック用のローディング表示

【テンプレート必須要素】
1. Reactの初期化コード
2. MaterialUIのセットアップ
3. グローバルスタイルの定義
4. エラーバウンダリ
5. ローディング表示
6. レスポンシブ対応
7. アニメーションとトランジション

【品質保証項目】
・HTMLファイルを開いた直後から正常動作すること
・すべてのライブラリが正しい順序で読み込まれること
・視覚的要素が即座に表示されること
・コンソールエラーが発生しないこと

各モックアップ作成後、そのページに必要なバックエンドの項目を自然言語で提出し、ロジックの擦り合わせを行う。

Phase#4：ディレクトリ構造の作成
フロントエンド：ページ別構造
バックエンド：機能別構造
※不要なディレクトリは作成しない

Phase#5：要件定義書のまとめ
他のAIが実装可能な形での明確な仕様書作成

鉄の掟：
・常に1問1答を心がける
・ユーザーの承認がなければ絶対に次のPhaseにすすまない
・ユーザーとのフィードバックループを継続的に回し、精度の高い成果物を作り上げる

各フェーズでの成果物：
Phase#1：要件定義シート
Phase#2：ページ一覧と機能一覧
Phase#3：動作確認済みモックアップ一式
Phase#4：ディレクトリ構造図
Phase#5：実装用要件定義書`
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
      
      // HTML形式のコードブロックかチェック
      const isHtmlBlock = codeBlock.language === 'html';
      
      // ダイアログのオプションを設定
      const saveOptions = ['ファイルとして保存'];
      if (isHtmlBlock) {
        saveOptions.push('モックアップとして保存');
      }
      
      // 保存方法を選択するダイアログを表示
      const saveMethod = await vscode.window.showQuickPick(saveOptions, {
        placeHolder: '保存方法を選択してください'
      });
      
      if (!saveMethod) {
        // ユーザーがキャンセルした場合
        return;
      }
      
      if (saveMethod === 'モックアップとして保存') {
        // モックアップとして保存
        await this._saveAsNewMockup(codeBlock.code);
        return;
      }
      
      // 通常の保存処理
      // ファイル名を入力するダイアログを表示
      const defaultExtension = this._getExtensionForLanguage(codeBlock.language);
      const fileName = await vscode.window.showInputBox({
        prompt: 'ファイル名を入力してください',
        placeHolder: `example.${defaultExtension}`,
        value: `code.${defaultExtension}`
      });
      
      if (!fileName) {
        // ユーザーがキャンセルした場合
        return;
      }
      
      // 保存場所を選択するダイアログを表示
      let saveLocation: vscode.Uri[] | undefined;
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        // ワークスペースがある場合はその中から選択
        saveLocation = [vscode.workspace.workspaceFolders[0].uri];
      } else {
        // ワークスペースがない場合はファイル選択ダイアログを表示
        saveLocation = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: '保存先を選択'
        });
      }
      
      if (!saveLocation || saveLocation.length === 0) {
        // ユーザーがキャンセルした場合
        return;
      }
      
      // ファイルパスを作成
      const filePath = path.join(saveLocation[0].fsPath, fileName);
      
      // ファイル操作マネージャーを使用してファイルを保存
      const fileManager = FileOperationManager.getInstance();
      const success = await fileManager.createFile(filePath, codeBlock.code);
      
      if (success) {
        // 成功メッセージを表示
        vscode.window.showInformationMessage(`コードを保存しました: ${filePath}`);
        
        // WebViewに成功メッセージを送信
        await this._panel.webview.postMessage({
          command: 'codeSaved',
          blockId,
          fileName
        });
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
      // モックアップ名を入力するダイアログを表示
      const mockupName = await vscode.window.showInputBox({
        prompt: 'モックアップ名を入力してください',
        placeHolder: 'モックアップ名',
        value: `Mockup ${new Date().toLocaleString()}`
      });
      
      if (!mockupName) {
        // ユーザーがキャンセルした場合
        return;
      }
      
      // モックアップストレージサービスをロード
      // 動的インポートを使用して循環参照を避ける
      const { MockupStorageService } = require('../../services/mockupStorageService');
      const storageService = MockupStorageService.getInstance();
      
      // モックアップを保存
      const mockupId = await storageService.saveMockup(
        { html: htmlCode },
        {
          name: mockupName,
          sourceType: 'requirements',
          description: '要件定義ビジュアライザーから生成'
        }
      );
      
      if (mockupId) {
        // 成功メッセージを表示
        vscode.window.showInformationMessage(`モックアップとして保存しました: ${mockupName}`);
        
        // モックアップエディターを開くか確認
        const openEditor = await vscode.window.showInformationMessage(
          'モックアップエディターで開きますか？',
          'はい',
          'いいえ'
        );
        
        if (openEditor === 'はい') {
          // モックアップエディターを開く
          vscode.commands.executeCommand('appgenius-ai.openMockupEditor', mockupId);
        }
      }
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
    
    // WebViewに表示するHTML
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src ${this._panel.webview.cspSource} 'unsafe-inline'; frame-src data:;">
      <link rel="stylesheet" href="${styleUri}">
      <title>要件定義ビジュアライザー</title>
    </head>
    <body>
      <div class="chat-container">
        <div class="chat-header">
          <h2>要件定義ビジュアライザー</h2>
          <div class="header-actions">
            <button id="create-project-button" class="project-action-btn create-project-btn">プロジェクト作成</button>
            <button id="clear-chat-button" class="clear-chat-btn" title="チャット履歴をクリア">クリア</button>
          </div>
        </div>
        
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
   * リソース解放
   */
  public dispose() {
    SimpleChatPanel.currentPanel = undefined;
    
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