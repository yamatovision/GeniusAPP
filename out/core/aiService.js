"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class AIService {
    constructor() {
        // 初期化時に保存されたAPIキーを非同期で取得
        this.loadSavedApiKey().then(key => {
            if (key) {
                this.apiKey = key;
                logger_1.Logger.debug('保存されたAPI キーを読み込みました');
            }
        }).catch(error => {
            logger_1.Logger.error(`API キーのロード中にエラーが発生: ${error.message}`);
        });
    }
    /**
     * API キーを設定する
     */
    async setApiKey(presetKey) {
        // 事前に設定されたキーがある場合はそれを使用
        let key = presetKey;
        // プリセットされたキーがない場合はユーザーに入力を求める
        if (!key) {
            key = await vscode.window.showInputBox({
                prompt: 'Claude API キーを入力してください (sk-... で始まるキー)',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'sk-ant-api03-...'
            });
        }
        if (key) {
            this.apiKey = key;
            // APIキーを設定に保存（暗号化された形式で）
            await vscode.workspace.getConfiguration('appgeniusAI').update('apiKeyExists', true, true);
            // APIキーを設定に保存（安全ではありませんが、今は単純化のため）
            try {
                // APIキーを設定に保存
                await vscode.workspace.getConfiguration('appgeniusAI').update('apiKey', key, true);
                logger_1.Logger.info('API キーが設定に保存されました');
            }
            catch (error) {
                logger_1.Logger.error(`API キーの保存に失敗: ${error.message}`);
                return false;
            }
            return true;
        }
        return false;
    }
    /**
     * 保存されたAPIキーを読み込む
     */
    async loadSavedApiKey() {
        try {
            // 設定から読み込む
            const configKey = vscode.workspace.getConfiguration('appgeniusAI').get('apiKey');
            if (configKey) {
                logger_1.Logger.debug('設定からAPI キーを読み込みました');
                return configKey;
            }
            // 環境変数から読み込む試行
            const envApiKey = this.getApiKeyFromEnv();
            if (envApiKey) {
                logger_1.Logger.debug('環境変数からAPI キーを読み込みました');
                // 環境変数から取得したキーを設定にも保存
                await this.setApiKey(envApiKey);
                return envApiKey;
            }
        }
        catch (error) {
            logger_1.Logger.error(`API キーの読み込みに失敗: ${error.message}`);
        }
        return undefined;
    }
    /**
     * 環境変数からAPIキーを取得
     */
    getApiKeyFromEnv() {
        try {
            // API キーを環境変数から取得する
            // ハードコードされたキーは使用しない
            // 一般的な環境変数名を試す
            const envVarNames = [
                'CLAUDE_API_KEY',
                'ANTHROPIC_API_KEY',
                'CLAUDE_KEY',
                'ANTHROPIC_KEY'
            ];
            for (const varName of envVarNames) {
                const envKey = process.env[varName];
                if (envKey && envKey.startsWith('sk-')) {
                    logger_1.Logger.debug(`環境変数 ${varName} からAPIキーを読み込みました`);
                    return envKey;
                }
            }
        }
        catch (error) {
            logger_1.Logger.error(`環境変数からのAPI キー読み込みに失敗: ${error.message}`);
        }
        return undefined;
    }
    /**
     * APIキーが設定されているか確認
     */
    hasApiKey() {
        return !!this.apiKey;
    }
    /**
     * メッセージを処理する（ターミナルインターフェース用）
     */
    async processMessage(query) {
        // 簡易コマンド処理
        if (query.startsWith('/')) {
            return this.processCommand(query);
        }
        // 会話履歴を取得・保存するためのコード（将来的に実装）
        // const conversationHistory = await this.getConversationHistory();
        // conversationHistory.push({ role: 'user', content: query });
        // 通常のメッセージとして処理
        const response = await this.sendMessage(query, 'terminal');
        // 応答を会話履歴に追加（将来的に実装）
        // conversationHistory.push({ role: 'assistant', content: response });
        // await this.saveConversationHistory(conversationHistory);
        return response;
    }
    /**
     * コマンドを処理する
     */
    processCommand(command) {
        const cmd = command.trim().toLowerCase();
        if (cmd === '/help') {
            return `
利用可能なコマンド:
/help - このヘルプメッセージを表示
/clear - ターミナルをクリア
/apikey - API キーを設定
/version - バージョン情報を表示
/status - システム状態を表示
/logout - アカウントからログアウト
`;
        }
        else if (cmd === '/clear') {
            // クリアコマンドは呼び出し元で処理
            return '[CLEAR_TERMINAL]';
        }
        else if (cmd === '/apikey') {
            // APIキー設定コマンドは非同期で処理されるため、即時メッセージのみ返す
            vscode.commands.executeCommand('appgenius-ai.setApiKey');
            return 'API キー設定プロセスを開始しました...';
        }
        else if (cmd === '/version') {
            const extension = vscode.extensions.getExtension('appgenius.appgenius-ai');
            const version = extension ? extension.packageJSON.version : '不明';
            return `AppGenius AI バージョン: ${version}`;
        }
        else if (cmd === '/status') {
            return `
システム状態:
- API キー設定済み: ${this.hasApiKey() ? 'はい' : 'いいえ'}
- 現在の時刻: ${new Date().toLocaleString('ja-JP')}
- 拡張機能状態: アクティブ
`;
        }
        else if (cmd === '/logout') {
            // ログアウトコマンドは非同期で処理されるため、即時メッセージのみ返す
            vscode.commands.executeCommand('appgenius-ai.logout');
            return 'ログアウト処理を実行しています...';
        }
        return `未知のコマンド: ${command}\n/help でコマンド一覧を表示できます。`;
    }
    /**
     * メッセージを送信してレスポンスを取得する
     * @param message ユーザーメッセージ
     * @param mode 動作モード
     * @param systemMessages システムメッセージを含むメッセージ配列（オプション）
     */
    async sendMessage(message, mode = 'chat', systemMessages) {
        if (!this.apiKey) {
            logger_1.Logger.warn('API キーが設定されていません。APIキー設定プロセスを開始します');
            const success = await this.setApiKey();
            if (!success) {
                logger_1.Logger.error('API キーの設定に失敗しました');
                return 'API キーが設定されていません。設定から Claude API キーを設定してください。';
            }
        }
        try {
            // デバッグ目的でのモックレスポンスの有効化
            const debugMode = vscode.workspace.getConfiguration('appgeniusAI').get('debugMode', false); // デバッグモードはデフォルトで無効
            logger_1.Logger.debug(`送信モード: ${mode}, デバッグモード: ${debugMode}`);
            logger_1.Logger.debug(`メッセージ: ${message.substring(0, 100)}...`);
            if (debugMode) {
                // 開発用モックレスポンス（デバッグ目的のみ）
                logger_1.Logger.info('デバッグモード: モックレスポンスを生成します');
                const response = await this.getMockResponse(message, mode);
                logger_1.Logger.debug(`モックレスポンス生成完了: ${response.substring(0, 100)}...`);
                return response;
            }
            else {
                // 実際のAPI呼び出し
                logger_1.Logger.info('実際のClaude APIを使用します');
                logger_1.Logger.debug(`API キー: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'なし'}`);
                try {
                    const response = await this.callClaudeApi(message, mode, systemMessages);
                    logger_1.Logger.debug(`API応答取得完了: ${response.substring(0, 100)}...`);
                    return response;
                }
                catch (apiError) {
                    logger_1.Logger.error('Claude API呼び出しエラー:', apiError);
                    // APIエラーをそのまま返す（モックレスポンスへのフォールバックは行わない）
                    throw apiError;
                }
            }
        }
        catch (error) {
            logger_1.Logger.error('AI API処理中のエラー:', error);
            logger_1.Logger.debug(`エラーの詳細: ${error.stack || 'スタックトレースなし'}`);
            return `AIサービスエラー: ${error.message}。しばらくしてからもう一度お試しください。`;
        }
    }
    /**
     * ストリーミングモードでメッセージを送信
     * @param message ユーザーメッセージ
     * @param mode 動作モード
     * @param onChunk チャンク受信時のコールバック
     * @param onComplete 完了時のコールバック
     * @param systemMessages カスタムシステムメッセージ配列（オプション）
     */
    async sendMessageWithStreaming(message, mode = 'chat', onChunk, onComplete, systemMessages) {
        if (!this.apiKey) {
            logger_1.Logger.warn('API キーが設定されていません。APIキー設定プロセスを開始します');
            const success = await this.setApiKey();
            if (!success) {
                logger_1.Logger.error('API キーの設定に失敗しました');
                onChunk('API キーが設定されていません。設定から Claude API キーを設定してください。');
                onComplete('API キーが設定されていません。設定から Claude API キーを設定してください。');
                return;
            }
        }
        try {
            // デバッグ目的でのモックレスポンスの有効化
            const debugMode = vscode.workspace.getConfiguration('appgeniusAI').get('debugMode', false);
            const useStreaming = vscode.workspace.getConfiguration('appgeniusAI').get('useStreaming', true);
            logger_1.Logger.debug(`送信モード: ${mode}, デバッグモード: ${debugMode}, ストリーミング: ${useStreaming}`);
            logger_1.Logger.debug(`メッセージ: ${message.substring(0, 100)}...`);
            // ストリーミングが無効の場合、通常の送信に切り替え
            if (!useStreaming) {
                const response = await this.sendMessage(message, mode);
                onChunk(response);
                onComplete(response);
                return;
            }
            if (debugMode) {
                // デバッグモードでのモックストリーミング
                this.simulateStreaming(message, mode, onChunk, onComplete);
            }
            else {
                // 実際のストリーミングAPI呼び出し
                await this.callClaudeApiWithStreaming(message, mode, onChunk, onComplete, systemMessages);
            }
        }
        catch (error) {
            logger_1.Logger.error('AI API処理中のエラー:', error);
            logger_1.Logger.debug(`エラーの詳細: ${error.stack || 'スタックトレースなし'}`);
            const errorMessage = `AIサービスエラー: ${error.message}。しばらくしてからもう一度お試しください。`;
            onChunk(errorMessage);
            onComplete(errorMessage);
        }
    }
    /**
     * デバッグモード用のストリーミングをシミュレート
     */
    simulateStreaming(message, mode, onChunk, onComplete) {
        // モックレスポンスを取得
        this.getMockResponse(message, mode).then(fullResponse => {
            const words = fullResponse.split(' ');
            let currentIndex = 0;
            let accumulatedResponse = '';
            // 単語ごとに送信するインターバル
            const interval = setInterval(() => {
                if (currentIndex < words.length) {
                    const chunk = words[currentIndex] + ' ';
                    accumulatedResponse += chunk;
                    onChunk(chunk);
                    currentIndex++;
                }
                else {
                    clearInterval(interval);
                    onComplete(fullResponse);
                }
            }, 100); // 100msごとに単語を送信
        });
    }
    /**
     * モードとメッセージに応じたモックレスポンスを生成（Phase 1用）
     */
    getMockResponse(message, mode) {
        // デバッグログにメッセージを記録
        logger_1.Logger.debug(`Mock response requested for mode: ${mode}, message: ${message}`);
        // 現実的なレスポンスタイム（非同期処理を模擬）
        return new Promise((resolve) => {
            setTimeout(() => {
                let response = '';
                // designモードの場合は会話型モックアップデザイナー用の特別な応答を返す
                if (mode === 'design') {
                    response = `会話型モックアップデザイナーへようこそ。あなたの要望を理解しました: "${message}"

まず基本要件をさらに詳しく教えていただけますか？

- どのような業界や分野向けのアプリケーションですか？
- ターゲットユーザーの特性（年齢層、技術レベルなど）はどうですか？
- 競合他社やインスピレーションとなる既存サービスはありますか？

これらの情報をもとに、最適なUI/UXを設計していきます。`;
                    resolve(response);
                    return;
                }
                switch (mode) {
                    case 'chat':
                        if (message.includes('こんにちは') || message.includes('はじめまして')) {
                            response = 'こんにちは！AppGenius AIです。どのようなお手伝いができますか？';
                        }
                        else if (message.includes('できること') || message.includes('機能')) {
                            response = 'AppGenius AIでは、以下のことができます：\n- AIとの自然な対話\n- 要件の整理と構造化\n- モックアップの自動生成\n- コードの自動生成と修正\n\nまずは何から始めましょうか？';
                        }
                        else {
                            response = `ご質問ありがとうございます。「${message}」についてですね。さらに詳しく教えていただけますか？`;
                        }
                        break;
                    case 'requirement':
                        if (message.includes('要件') || message.includes('機能')) {
                            response = '要件を整理しましょう。以下の点について教えていただけますか？\n\n1. このプロジェクトの目的は何ですか？\n2. 主要なユーザーは誰ですか？\n3. 最も重要な機能は何ですか？';
                        }
                        else if (message.includes('モックアップ') || message.includes('画面')) {
                            // モックアップ生成用の具体的なレスポンスを追加
                            if (message.includes('ログイン画面')) {
                                response = `ログイン画面のモックアップを生成しました：

\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ログイン | AppGenius</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="login-container">
    <div class="login-header">
      <h1>AppGenius</h1>
      <p>アカウントにログイン</p>
    </div>
    <form class="login-form">
      <div class="form-group">
        <label for="email">メールアドレス</label>
        <input type="email" id="email" placeholder="メールアドレスを入力" required>
      </div>
      <div class="form-group">
        <label for="password">パスワード</label>
        <input type="password" id="password" placeholder="パスワードを入力" required>
      </div>
      <div class="form-options">
        <label class="remember-me">
          <input type="checkbox"> ログイン状態を保持
        </label>
        <a href="#" class="forgot-password">パスワードをお忘れですか？</a>
      </div>
      <button type="submit" class="login-button">ログイン</button>
    </form>
    <div class="login-footer">
      <p>アカウントをお持ちでない場合 <a href="#">新規登録</a></p>
    </div>
  </div>
</body>
</html>
\`\`\`

\`\`\`css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

body {
  background-color: #f5f8fa;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  padding: 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  color: #1a73e8;
  margin-bottom: 8px;
}

.login-header p {
  color: #5f6368;
  font-size: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #202124;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #1a73e8;
  outline: none;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 14px;
}

.remember-me {
  display: flex;
  align-items: center;
  color: #5f6368;
}

.remember-me input {
  margin-right: 8px;
}

.forgot-password {
  color: #1a73e8;
  text-decoration: none;
}

.forgot-password:hover {
  text-decoration: underline;
}

.login-button {
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  width: 100%;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover {
  background-color: #0d62d1;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #5f6368;
}

.login-footer a {
  color: #1a73e8;
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}

@media (max-width: 480px) {
  .login-container {
    max-width: 100%;
    border-radius: 0;
    box-shadow: none;
    padding: 20px;
  }
}
\`\`\`

\`\`\`js
document.addEventListener('DOMContentLoaded', function() {
  // フォーム送信をハンドル
  const loginForm = document.querySelector('.login-form');
  
  loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
      alert('すべてのフィールドを入力してください');
      return;
    }
    
    // ここで実際のログイン処理を実装
    console.log('ログイン試行:', { email });
    
    // 成功時のリダイレクト（実際の実装ではここがサーバーレスポンスに基づく）
    // window.location.href = '/dashboard';
    
    // モックアップデモ用のアラート
    alert('ログイン成功！リダイレクト中...');
  });
});
\`\`\``;
                            }
                            else {
                                response = 'モックアップを作成するために、画面の詳細情報が必要です。どのような画面が必要ですか？レイアウトや必要な要素について教えてください。';
                            }
                        }
                        else {
                            response = `要件「${message}」について理解しました。これを要件リストに追加しておきます。他にありますか？`;
                        }
                        break;
                    case 'implementation':
                        if (message.includes('コード') || message.includes('実装')) {
                            response = 'コード実装のサポートをします。どのような機能を実装したいですか？使用言語やフレームワークについても教えてください。';
                        }
                        else if (message.includes('テスト') || message.includes('検証')) {
                            response = 'テストコードの作成をサポートします。どのような機能のテストが必要ですか？';
                        }
                        else {
                            response = `「${message}」の実装について検討します。まずはプロジェクトの構造を分析してみましょう。`;
                        }
                        break;
                    case 'design':
                        if (message.includes('ページ') || message.includes('構造')) {
                            response = `
以下のページ構造を提案します：

1. ホームページ
   - ID: home
   - 説明: ユーザーが最初に訪れるランディングページ。主要機能への導線を提供。
   - ルート: /
   - コンポーネント: ヘッダー、ヒーローセクション、機能紹介、CTAボタン、フッター
   - API エンドポイント: /api/featured-content

2. ログインページ
   - ID: login
   - 説明: ユーザー認証を行うページ
   - ルート: /login
   - コンポーネント: ログインフォーム、ソーシャルログインボタン、パスワードリセットリンク
   - API エンドポイント: /api/auth/login, /api/auth/social-login

3. 登録ページ
   - ID: register
   - 説明: 新規ユーザー登録を行うページ
   - ルート: /register
   - コンポーネント: 登録フォーム、利用規約同意チェックボックス、ソーシャル登録ボタン
   - API エンドポイント: /api/auth/register, /api/auth/validate-email

4. ダッシュボード
   - ID: dashboard
   - 説明: ログイン後のメイン画面。ユーザーの活動概要と主要機能へのアクセスを提供
   - ルート: /dashboard
   - コンポーネント: サイドバーナビゲーション、アクティビティサマリー、クイックアクセスカード
   - API エンドポイント: /api/user/dashboard, /api/user/activities, /api/user/stats
`;
                        }
                        else if (message.includes('モックアップ') || message.includes('画面')) {
                            // モックアップ用のサンプルHTMLを返す
                            response = `ログイン画面のモックアップを生成しました：

\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ログイン | AppGenius</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="login-container">
    <div class="login-header">
      <h1>AppGenius</h1>
      <p>アカウントにログイン</p>
    </div>
    <form class="login-form">
      <div class="form-group">
        <label for="email">メールアドレス</label>
        <input type="email" id="email" placeholder="メールアドレスを入力" required>
      </div>
      <div class="form-group">
        <label for="password">パスワード</label>
        <input type="password" id="password" placeholder="パスワードを入力" required>
      </div>
      <div class="form-options">
        <label class="remember-me">
          <input type="checkbox"> ログイン状態を保持
        </label>
        <a href="#" class="forgot-password">パスワードをお忘れですか？</a>
      </div>
      <button type="submit" class="login-button">ログイン</button>
    </form>
    <div class="login-footer">
      <p>アカウントをお持ちでない場合 <a href="#">新規登録</a></p>
    </div>
  </div>
</body>
</html>
\`\`\`

\`\`\`css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

body {
  background-color: #f5f8fa;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  padding: 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  color: #1a73e8;
  margin-bottom: 8px;
}

.login-header p {
  color: #5f6368;
  font-size: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #202124;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #1a73e8;
  outline: none;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 14px;
}

.remember-me {
  display: flex;
  align-items: center;
  color: #5f6368;
}

.remember-me input {
  margin-right: 8px;
}

.forgot-password {
  color: #1a73e8;
  text-decoration: none;
}

.forgot-password:hover {
  text-decoration: underline;
}

.login-button {
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  width: 100%;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover {
  background-color: #0d62d1;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #5f6368;
}

.login-footer a {
  color: #1a73e8;
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .login-container {
    max-width: 100%;
    border-radius: 0;
    box-shadow: none;
    padding: 20px;
  }
}
\`\`\`

\`\`\`js
document.addEventListener('DOMContentLoaded', function() {
  // フォーム送信をハンドル
  const loginForm = document.querySelector('.login-form');
  
  loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
      alert('すべてのフィールドを入力してください');
      return;
    }
    
    // ここで実際のログイン処理を実装
    console.log('ログイン試行:', { email });
    
    // 成功時のリダイレクト（実際の実装ではここがサーバーレスポンスに基づく）
    // window.location.href = '/dashboard';
    
    // モックアップデモ用のアラート
    alert('ログイン成功！リダイレクト中...');
  });
});
\`\`\``;
                        }
                        else if (message.includes('ディレクトリ構造') || message.includes('フォルダ構成')) {
                            response = `
プロジェクトのディレクトリ構造を以下のように提案します：

/project-root
├── frontend/
│   ├── public/
│   │   ├── index.html       # HTML エントリーポイント
│   │   ├── favicon.ico      # サイトアイコン
│   │   └── assets/          # 静的リソース（画像、フォントなど）
│   │       ├── images/      # 画像ファイル
│   │       └── fonts/       # フォントファイル
│   │
│   ├── src/
│   │   ├── components/      # 再利用可能なコンポーネント
│   │   │   ├── common/      # 汎用コンポーネント（ボタン、フォームなど）
│   │   │   │   ├── Button/
│   │   │   │   ├── Form/
│   │   │   │   └── ...
│   │   │   │
│   │   │   └── layout/      # レイアウト関連コンポーネント
│   │   │       ├── Header/
│   │   │       ├── Footer/
│   │   │       ├── Sidebar/
│   │   │       └── ...
│   │   │
│   │   ├── pages/           # ページコンポーネント
│   │   │   ├── Home/        # ホームページ
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── Home.css
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── Login/       # ログインページ
│   │   │   ├── Register/    # 登録ページ
│   │   │   └── Dashboard/   # ダッシュボードページ
│   │   │
│   │   ├── services/        # API通信、外部サービス連携
│   │   │   ├── api.ts       # APIクライアント
│   │   │   ├── auth.ts      # 認証関連
│   │   │   └── ...
│   │   │
│   │   ├── store/           # 状態管理
│   │   │   ├── actions/     # アクション定義
│   │   │   ├── reducers/    # リデューサー
│   │   │   └── index.ts     # ストア設定
│   │   │
│   │   ├── utils/           # ユーティリティ関数
│   │   │   ├── formatting.ts # フォーマット関連
│   │   │   ├── validation.ts # バリデーション関連
│   │   │   └── ...
│   │   │
│   │   ├── types/           # 型定義
│   │   │   ├── models.ts    # データモデル
│   │   │   └── ...
│   │   │
│   │   ├── App.tsx          # アプリルート
│   │   ├── index.tsx        # エントリーポイント
│   │   └── router.tsx       # ルーティング設定
│   │
│   ├── package.json         # フロントエンド依存パッケージ
│   └── tsconfig.json        # TypeScript設定
│
├── backend/
│   ├── src/
│   │   ├── controllers/     # リクエスト処理
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   └── ...
│   │   │
│   │   ├── models/          # データモデル
│   │   │   ├── User.js
│   │   │   └── ...
│   │   │
│   │   ├── routes/          # APIルート
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   └── ...
│   │   │
│   │   ├── services/        # ビジネスロジック
│   │   │   ├── authService.js
│   │   │   └── ...
│   │   │
│   │   ├── middleware/      # ミドルウェア
│   │   │   ├── auth.js      # 認証ミドルウェア
│   │   │   └── ...
│   │   │
│   │   ├── utils/           # ユーティリティ
│   │   │   ├── logger.js
│   │   │   └── ...
│   │   │
│   │   ├── config/          # 設定ファイル
│   │   │   ├── database.js
│   │   │   └── ...
│   │   │
│   │   └── app.js          # アプリケーションエントリーポイント
│   │
│   ├── package.json        # バックエンド依存パッケージ
│   └── .env.example        # 環境変数テンプレート
│
├── package.json            # ルートパッケージ（ワークスペース設定）
├── README.md               # プロジェクト説明
└── docker-compose.yml      # 開発環境設定（オプション）
`;
                        }
                        else if (message.includes('要件定義') || message.includes('仕様書')) {
                            response = `
# 要件定義書

## 1. プロジェクト概要

### 1.1 目的
ユーザーが簡単にオンラインでログインし、パーソナライズされたダッシュボードにアクセスできるウェブアプリケーションを開発する。

### 1.2 背景
既存のシステムでは、ユーザー体験が良くないという課題があり、より直感的で使いやすいインターフェースが求められている。

### 1.3 ターゲットユーザー
- 一般消費者（20〜50代）
- システム管理者

## 2. 機能要件

### 2.1 認証機能
- ユーザー登録
  - メールアドレスとパスワードによる登録
  - ソーシャルアカウント（Google、Facebook）による登録
  - メール確認プロセス
- ログイン
  - メールアドレスとパスワードによるログイン
  - ソーシャルアカウントによるログイン
  - パスワード再設定
  - ログイン状態の保持

### 2.2 ダッシュボード機能
- ユーザープロファイル管理
  - 個人情報の表示と編集
  - アカウント設定
- アクティビティ表示
  - 最近のアクティビティリスト
  - 統計情報のグラフ表示

## 3. 非機能要件

### 3.1 パフォーマンス要件
- ページ読み込み時間: 2秒以内
- API応答時間: 500ms以内
- 同時接続ユーザー: 最大1000ユーザー

### 3.2 セキュリティ要件
- パスワードは暗号化して保存
- セッション管理
- HTTPS通信
- XSS・CSRF対策

### 3.3 信頼性要件
- システム稼働率: 99.9%
- バックアップ: 毎日

## 4. フロントエンド実装仕様

### 4.1 使用技術
- React 18
- TypeScript
- Material UI
- Redux Toolkit
- React Router

### 4.2 コンポーネント設計
#### 4.2.1 共通コンポーネント
- Button: プライマリボタン、セカンダリボタン
- Input: テキスト入力、パスワード入力
- Form: フォームラッパー
- Card: 情報カード
- Modal: モーダルダイアログ

#### 4.2.2 ページコンポーネント
- Home: ランディングページ
- Login: ログイン画面
- Register: 登録画面
- Dashboard: ダッシュボード
  - Profile: プロファイル管理
  - Activities: アクティビティ一覧

### 4.3 状態管理
- Redux Storeの構造
  - auth: 認証情報
  - user: ユーザーデータ
  - ui: UI状態（ローディング、エラーなど）

## 5. バックエンド実装仕様

### 5.1 使用技術
- Node.js
- Express
- MongoDB
- JWT認証

### 5.2 API設計
#### 5.2.1 認証API
- POST /api/auth/register - ユーザー登録
- POST /api/auth/login - ログイン
- POST /api/auth/forgot-password - パスワードリセット
- GET /api/auth/verify-email/:token - メール確認

#### 5.2.2 ユーザーAPI
- GET /api/users/me - 現在のユーザー情報
- PATCH /api/users/me - ユーザー情報更新
- GET /api/users/activities - ユーザーアクティビティ

### 5.3 データモデル
- User
  - email: String (unique)
  - password: String (hashed)
  - name: String
  - role: String (enum: user, admin)
  - isEmailVerified: Boolean
  - createdAt: Date
  - updatedAt: Date

- Activity
  - user: ObjectId (ref: User)
  - type: String
  - data: Object
  - createdAt: Date

## 6. 開発タスクリスト

### 6.1 フェーズ1: 認証機能
1. ユーザー登録画面の実装
2. ログイン画面の実装
3. パスワードリセット機能の実装
4. ソーシャルログイン連携の実装

### 6.2 フェーズ2: ダッシュボード
1. ダッシュボードレイアウトの実装
2. ユーザープロファイル管理の実装
3. アクティビティ表示の実装

### 6.3 フェーズ3: 管理機能
1. 管理者ダッシュボードの実装
2. ユーザー管理機能の実装
3. システム設定の実装

## 7. テスト要件

### 7.1 単体テスト
- コンポーネントテスト
- サービスロジックテスト

### 7.2 統合テスト
- API エンドポイントテスト
- ユーザーフローテスト

### 7.3 E2Eテスト
- 登録〜ログイン〜ダッシュボード操作のフロー
`;
                        }
                        else {
                            response = `「${message}」について考えてみました。UI/UX設計には以下のポイントを考慮するとよいでしょう：

1. ユーザー中心設計 - ターゲットユーザーのニーズと行動パターンを理解する
2. 一貫性のあるデザイン - 色、フォント、レイアウトなどの要素を統一する
3. 明確なナビゲーション - ユーザーが迷わないような構造にする
4. レスポンシブデザイン - 様々なデバイスで適切に表示される
5. アクセシビリティ - 障害のあるユーザーも使いやすい設計

これらを踏まえて、より具体的な設計に進みましょう。どのような点に焦点を当てるべきでしょうか？`;
                        }
                        break;
                    default:
                        response = 'ご質問を受け付けました。もう少し詳しく教えていただけますか？';
                }
                resolve(response);
            }, 1000); // 1秒の遅延で応答
        });
    }
    /**
     * Claude APIを呼び出す
     */
    async callClaudeApi(message, mode, systemMessages) {
        try {
            if (!this.apiKey) {
                throw new Error('API キーが設定されていません');
            }
            // APIエンドポイント
            const endpoint = 'https://api.anthropic.com/v1/messages';
            // モードに応じたシステムプロンプトを選択
            let systemPrompt = this.getSystemPromptForMode(mode);
            // 設定からモデルとトークン数を取得
            const config = vscode.workspace.getConfiguration('appgeniusAI');
            const model = config.get('model', 'claude-3-7-sonnet-20250219');
            const maxTokens = config.get('maxTokens', 10000); // モックアップ作成に適したサイズに調整
            logger_1.Logger.debug(`Using AI model: ${model}`);
            // デバッグモードがオフの場合のみAPIリクエストを送信
            const debugMode = config.get('debugMode', false);
            if (debugMode) {
                logger_1.Logger.debug('デバッグモードが有効なため、APIリクエストを送信せずモックレスポンスを返します');
                return await this.getMockResponse(message, mode);
            }
            // フォーマットされたメッセージの作成
            let formattedMessages = [];
            // システムメッセージが外部から提供された場合はシステムメッセージを置き換える
            if (systemMessages && systemMessages.length > 0) {
                // システムメッセージを探す
                const sysMsg = systemMessages.find(msg => msg.role === 'system');
                if (sysMsg) {
                    // システムメッセージを見つけた場合、それを使用
                    systemPrompt = sysMsg.content;
                }
                // ユーザーとアシスタントのメッセージのみ抽出
                const chatMessages = systemMessages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
                if (chatMessages.length > 0) {
                    // チャットメッセージがある場合はそれらだけを使用
                    formattedMessages = chatMessages.map(msg => ({
                        role: msg.role,
                        content: [{ type: 'text', text: msg.content }]
                    }));
                    // ユーザーから新しいメッセージがあればそれも追加
                    const lastMsg = chatMessages[chatMessages.length - 1];
                    if (lastMsg.role !== 'user') {
                        formattedMessages.push({
                            role: 'user',
                            content: [{ type: 'text', text: message }]
                        });
                    }
                }
                else {
                    // チャットメッセージがない場合は新しいメッセージだけ追加
                    formattedMessages = [
                        {
                            role: 'user',
                            content: [{ type: 'text', text: message }]
                        }
                    ];
                }
            }
            else {
                // 従来通りの単一メッセージ
                formattedMessages = [
                    {
                        role: 'user',
                        content: [{ type: 'text', text: message }]
                    }
                ];
            }
            // 拡張出力設定を取得
            const useExtendedOutput = vscode.workspace.getConfiguration('appgeniusAI').get('useExtendedOutput', false);
            // 拡張出力を使用する場合のトークン数
            let adjustedMaxTokens = maxTokens;
            if (useExtendedOutput) {
                // 拡張出力モードでは最大128,000まで設定可能
                adjustedMaxTokens = Math.min(128000, maxTokens);
                logger_1.Logger.debug(`Using extended output mode with ${adjustedMaxTokens} max tokens`);
            }
            // リクエストボディ
            const requestBody = {
                model,
                max_tokens: adjustedMaxTokens,
                system: systemPrompt,
                messages: formattedMessages
            };
            // 思考モードが有効な場合に追加
            const useThinking = vscode.workspace.getConfiguration('appgeniusAI').get('useThinking', false);
            if (useThinking) {
                const thinkingBudget = vscode.workspace.getConfiguration('appgeniusAI').get('thinkingBudget', 8000);
                // @ts-ignore - APIの型定義がアップデートされていない可能性があるため
                requestBody.thinking = {
                    type: "enabled",
                    budget_tokens: thinkingBudget
                };
                logger_1.Logger.debug(`Using thinking mode with budget of ${thinkingBudget} tokens`);
            }
            logger_1.Logger.debug(`Sending request to Claude API: ${JSON.stringify({
                model,
                max_tokens: adjustedMaxTokens,
                system: systemPrompt.substring(0, 100) + '...',
                messages: formattedMessages,
                useExtendedOutput,
                useThinking
            })}`);
            // トークンカウント用のリクエスト（オプショナル）
            try {
                // トークンカウント用のヘッダーも同様に設定
                const tokenCountHeaders = {
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'token-counting-2024-11-01',
                    'content-type': 'application/json'
                };
                if (this.apiKey) {
                    // 安全にAPIキーを設定 - セキュリティ対策済み
                    tokenCountHeaders['x-Api-Key'] = this.apiKey;
                }
                const tokenCountResponse = await axios_1.default.post('https://api.anthropic.com/v1/messages/count_tokens', {
                    model,
                    messages: formattedMessages,
                    system: systemPrompt
                }, { headers: tokenCountHeaders });
                logger_1.Logger.debug(`Token count: ${JSON.stringify(tokenCountResponse.data)}`);
            }
            catch (tokenError) {
                // トークンカウントに失敗してもメインリクエストは続行
                logger_1.Logger.warn(`Failed to count tokens: ${tokenError}`);
            }
            // APIリクエスト用ヘッダーを準備
            const requestHeaders = {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            };
            // APIキー処理
            if (this.apiKey) {
                // 安全にAPIキーを設定 - セキュリティ対策済み
                requestHeaders['x-Api-Key'] = this.apiKey;
            }
            else {
                throw new Error('APIキーが設定されていません');
            }
            // 拡張出力モードが有効な場合にベータヘッダーを追加
            if (useExtendedOutput) {
                // @ts-ignore - 動的にプロパティを追加
                requestHeaders['anthropic-beta'] = 'output-128k-2025-02-19';
            }
            // APIリクエストを送信
            const response = await axios_1.default.post(endpoint, requestBody, {
                headers: requestHeaders
            });
            // レスポンスからテキスト部分を抽出
            if (response.data && response.data.content && response.data.content.length > 0) {
                const content = response.data.content;
                let resultText = '';
                // 各コンテンツブロックを処理
                for (const block of content) {
                    if (block.type === 'text') {
                        resultText += block.text;
                    }
                }
                logger_1.Logger.debug(`Received response from Claude API: ${resultText.substring(0, 100)}...`);
                return resultText;
            }
            else {
                logger_1.Logger.error(`Unexpected API response format: ${JSON.stringify(response.data)}`);
                throw new Error('APIからの応答が不正です');
            }
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response) {
                logger_1.Logger.error(`Claude API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
                if (error.response.status === 401) {
                    throw new Error('API認証エラー：APIキーが無効です');
                }
                else if (error.response.status === 429) {
                    throw new Error('レート制限エラー：しばらく時間をおいてお試しください');
                }
                else {
                    throw new Error(`APIエラー：${error.response.status} - ${error.response.statusText}`);
                }
            }
            else {
                logger_1.Logger.error('Claude API Error:', error);
                throw error;
            }
        }
    }
    /**
     * ストリーミングモードでClaude APIを呼び出す
     */
    async callClaudeApiWithStreaming(message, mode, onChunk, onComplete, systemMessages) {
        try {
            if (!this.apiKey) {
                throw new Error('API キーが設定されていません');
            }
            // APIエンドポイント
            const endpoint = 'https://api.anthropic.com/v1/messages';
            // モードに応じたシステムプロンプトを選択
            let systemPrompt = this.getSystemPromptForMode(mode);
            // 設定からモデルとトークン数を取得
            const config = vscode.workspace.getConfiguration('appgeniusAI');
            const model = config.get('model', 'claude-3-7-sonnet-20250219');
            const maxTokens = config.get('maxTokens', 32000);
            logger_1.Logger.debug(`Using AI model: ${model} with streaming mode`);
            // フォーマットされたメッセージの作成
            let formattedMessages = [];
            // システムメッセージが外部から提供された場合はシステムメッセージを置き換える
            if (systemMessages && systemMessages.length > 0) {
                // システムメッセージを探す
                const sysMsg = systemMessages.find(msg => msg.role === 'system');
                if (sysMsg) {
                    // システムメッセージを見つけた場合、それを使用
                    systemPrompt = sysMsg.content;
                }
                // ユーザーとアシスタントのメッセージのみ抽出
                const chatMessages = systemMessages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
                if (chatMessages.length > 0) {
                    // チャットメッセージがある場合はそれらだけを使用
                    formattedMessages = chatMessages.map(msg => ({
                        role: msg.role,
                        content: [{ type: 'text', text: msg.content }]
                    }));
                    // ユーザーから新しいメッセージがあればそれも追加
                    const lastMsg = chatMessages[chatMessages.length - 1];
                    if (lastMsg.role !== 'user') {
                        formattedMessages.push({
                            role: 'user',
                            content: [{ type: 'text', text: message }]
                        });
                    }
                }
                else {
                    // チャットメッセージがない場合は新しいメッセージだけ追加
                    formattedMessages = [
                        {
                            role: 'user',
                            content: [{ type: 'text', text: message }]
                        }
                    ];
                }
            }
            else {
                // 従来通りの単一メッセージ
                formattedMessages = [
                    {
                        role: 'user',
                        content: [{ type: 'text', text: message }]
                    }
                ];
            }
            // 拡張出力設定を取得
            const useExtendedOutput = vscode.workspace.getConfiguration('appgeniusAI').get('useExtendedOutput', false);
            // 拡張出力を使用する場合のトークン数
            let adjustedMaxTokens = maxTokens;
            if (useExtendedOutput) {
                // 拡張出力モードでは最大128,000まで設定可能
                adjustedMaxTokens = Math.min(128000, maxTokens);
                logger_1.Logger.debug(`Using extended output mode with ${adjustedMaxTokens} max tokens`);
            }
            // リクエストボディ
            const requestBody = {
                model,
                max_tokens: adjustedMaxTokens,
                system: systemPrompt,
                messages: formattedMessages,
                stream: true // ストリーミングモードを有効化
            };
            // 思考モードが有効な場合に追加
            const useThinking = vscode.workspace.getConfiguration('appgeniusAI').get('useThinking', false);
            if (useThinking) {
                // @ts-ignore - APIの型定義がアップデートされていない可能性があるため
                requestBody.thinking = {
                    type: "enabled",
                    budget_tokens: vscode.workspace.getConfiguration('appgeniusAI').get('thinkingBudget', 8000)
                };
            }
            // APIリクエスト用ヘッダーを準備
            const requestHeaders = {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            };
            // APIキーが存在する場合のみ追加
            if (this.apiKey) {
                requestHeaders['x-Api-Key'] = this.apiKey;
            }
            // 拡張出力モードが有効な場合にベータヘッダーを追加
            if (useExtendedOutput) {
                requestHeaders['anthropic-beta'] = 'output-128k-2025-02-19';
            }
            logger_1.Logger.debug('Making streaming API request to Claude API');
            // fetchを使用してストリーミングAPIリクエストを送信
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorText = await response.text();
                logger_1.Logger.error(`API error (${response.status}): ${errorText}`);
                throw new Error(`API error: ${response.status} - ${response.statusText}`);
            }
            // レスポンスボディが存在しない場合はエラー
            if (!response.body) {
                throw new Error('レスポンスボディが空です');
            }
            // ストリームリーダーを取得
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let buffer = '';
            // SSEデータを処理する関数
            const processSSE = (text) => {
                buffer += text;
                // 完全な行を処理
                while (buffer.includes('\n\n')) {
                    const eventEndIndex = buffer.indexOf('\n\n');
                    const eventData = buffer.substring(0, eventEndIndex);
                    buffer = buffer.substring(eventEndIndex + 2);
                    // データ行を探す
                    const dataLines = eventData.split('\n');
                    for (const line of dataLines) {
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6);
                            // ストリーム終了イベント
                            if (data === '[DONE]') {
                                logger_1.Logger.debug('Streaming complete, received [DONE]');
                                onComplete(fullResponse);
                                return;
                            }
                            try {
                                const parsedData = JSON.parse(data);
                                // コンテンツデルタ処理
                                if (parsedData.type === 'content_block_delta' &&
                                    parsedData.delta?.type === 'text_delta') {
                                    const textChunk = parsedData.delta.text || '';
                                    if (textChunk) {
                                        fullResponse += textChunk;
                                        onChunk(textChunk);
                                    }
                                }
                            }
                            catch (e) {
                                logger_1.Logger.error(`Error parsing SSE data: ${e}`);
                            }
                        }
                    }
                }
            };
            // ストリームの読み取り
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 残りのバッファを処理
                    if (buffer.length > 0) {
                        processSSE(buffer);
                    }
                    // 完了を通知
                    logger_1.Logger.debug('Stream reading complete');
                    onComplete(fullResponse);
                    break;
                }
                // 受信したチャンクを処理
                const chunk = decoder.decode(value, { stream: true });
                processSSE(chunk);
            }
        }
        catch (error) {
            logger_1.Logger.error('Streaming API error:', error);
            onChunk(`エラー: ${error.message}`);
            onComplete(`エラー: ${error.message}`);
        }
    }
    /**
     * モードに応じたシステムプロンプトを取得
     */
    getSystemPromptForMode(mode) {
        switch (mode) {
            case 'terminal':
                return `あなたはAppGenius AIのターミナルアシスタントです。VSCode拡張機能内のターミナルで動作し、ユーザーの開発作業を支援します。

役割:
- プログラミングや開発に関する質問への回答
- コード生成や修正の提案
- ファイル操作のサポート
- トラブルシューティングの支援
- 要件定義やプロジェクト設計の補助

出力形式:
- 回答は簡潔かつ的確に
- 長いコードブロックを含む場合は適切にフォーマット
- コード生成の場合は必ず完全な実行可能なコードを提供
- ファイル操作が必要な場合は明示的に指示（例: "ファイルXを作成します"）

ユーザーとの対話:
- 丁寧かつ専門的な口調を維持
- 不明点があれば質問で明確化
- 複雑な要求は段階的に対応
- 技術的な正確さを優先

特に重要:
- VSCode内のターミナルで動作していることを意識し、IDEの機能を活用した回答を心がける
- ユーザーのプロジェクトコンテキストを理解し、それに適した回答を提供する
- 必要に応じてファイル作成、編集、削除などの操作を説明する

回答の際は常に明確で実用的な情報を提供し、ユーザーの作業効率向上に貢献してください。`;
            case 'chat':
                return `あなたはAppGenius AIのチャットアシスタントです。VSCode拡張機能内で動作し、ユーザーからの質問に回答します。
ユーザーのプログラミングや開発に関する質問に対して、簡潔で役立つ回答を提供してください。`;
            case 'requirement':
                return `あなたはAppGenius AIの要件分析アシスタントです。VSCode拡張機能内で動作し、ユーザーのプロジェクト要件を定義・管理するのを支援します。
要件の抽出、構造化、優先順位付け、依存関係の特定などについて支援してください。`;
            case 'implementation':
                return `あなたはAppGenius AIの実装アシスタントです。VSCode拡張機能内で動作し、コード生成や実装のサポートを行います。
ユーザーの要件に基づいて、高品質なコードを生成し、実装のガイダンスを提供してください。`;
            case 'design':
                return `あなたはUI/UX設計のエキスパートビジュアライザーです。
非技術者の要望を具体的な形にし、技術者が実装できる明確なモックアップと仕様に変換する役割を担います。

目的：
非技術者の要望を視覚的に具現化し、具体的な要件定義の土台を作成し、それを動作するのに必要なページを洗い出して完璧なモックアップを形成し、その後ディレクトリ構造を提案する。
＊モックアップはモックデータを使い、この時点でかなり精密につくりあげること。
＊また、ディレクトリ構造はわかりやすくするためにフロントエンドはページ別、バックエンドは機能別のフォルダ分けの構造をつくる。

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

【モックアップコード生成の重要指示】
・コードブロックは必ず \`\`\`html と \`\`\` で囲むこと
・HTMLは完全で有効なものを生成し、必ず </html> タグで終わらせること
・コードの生成が完了するまで、コード以外のテキスト説明を入れないこと
・HTMLコード完成後に初めて説明文を書くこと
・コードの途中で自然言語による説明を挟まないこと
・トークン制限でコードが途中で切れる場合は、最低限HTMLの基本構造（DOCTYPE、html、head、body）は完結させること
・途中でコードが切れそうな場合は、機能を簡略化してでも完全なHTMLを生成すること

Phase#4：ディレクトリ構造の作成
フロントエンド：ページ別構造
バックエンド：機能別構造
※不要なディレクトリは作成しない

Phase#5：要件定義書のまとめ
他のAIが実装可能な形での明確な仕様書作成

重要：ユーザーの質問に必ず応答し、対話に一貫性を持たせてください。`;
            case 'mockup-generation':
                return `あなたはウェブアプリケーションモックアップ作成の専門家です。
提供された情報から、機能的で美しいHTMLモックアップを作成することが任務です。

【モックアップ作成の原則】
1. シンプルで見やすいデザインを心がける
2. モダンなデザイン要素を取り入れる
3. 必要最小限のスタイリングを含める（インラインスタイル推奨）
4. 日本語UIとする
5. レスポンシブデザインを考慮する
6. 適切なフォームバリデーションとフィードバック
7. 視覚的なユーザーフローを意識する

【技術要素】
- HTML5, CSS3の最新標準を使用
- 複雑なJavaScriptは避け、見た目とインタラクションの基本を優先
- モックデータを使用した具体的な表示

【出力形式】
- 完全なHTMLファイルをコードブロック内に出力
- コードブロックは\`\`\`htmlと\`\`\`で囲む
- コード以外の説明は最小限に

重要: ユーザーが提供するページ名と要件に基づいて、単一の完結したHTMLモックアップを生成してください。`;
            case 'mockup-update':
                return `あなたはウェブアプリケーションモックアップ更新の専門家です。
ユーザーからのフィードバックに基づいて、既存のHTMLモックアップを修正することが任務です。

【モックアップ更新の原則】
1. ユーザーのフィードバックに忠実に従う
2. HTMLの基本構造を維持する（不要な部分を削除しない）
3. フィードバックのみに対応し、余計な変更を加えない
4. スタイリングはインラインスタイルを使用する
5. 元の設計思想とデザイン言語を尊重する

【更新プロセス】
1. ユーザーのフィードバックを分析する
2. 対応が必要な変更点を特定する
3. 必要最小限の変更で目的を達成する
4. 一貫性のあるデザインを維持する

【出力形式】
- 更新された完全なHTMLファイルをコードブロック内に出力
- コードブロックは\`\`\`htmlと\`\`\`で囲む
- 変更内容の簡単な説明を含める

重要: ユーザーが提供するHTMLとフィードバックに基づいて、修正されたHTMLモックアップを生成してください。`;
            case 'development':
                return `あなたは追加開発を支援するアシスタントです。システム的な制約で以下のプロンプトの掟に従う必要があります：

【プロンプトの掟】
1. すべての質問は1問1答形式で進める
2. PHASEは必ず順序通りに実施し、飛ばすことは禁止
3. PHASE 1、2では必ず自然言語で説明を行う
4. 既存ファイルの変更前には、必ず対象ファイルの提出を求める
5. 次のPHASEに進む前に必ずユーザーの承認を得る

以下の手順で開発を支援します：

## 情報収集フェーズ
※1問ずつ回答を待ち、確認してから次の質問に進みます

Q1: 現在のディレクトリ構造を教えてください
→ 回答を確認してから次に進みます

Q2: 今回のスコープを教えてください
→ 回答を確認してから次に進みます

Q3: 関連ファイルを教えてください
→ ファイルの内容の確認が完了するまで次に進めません

## 開発支援フェーズ

PHASE 1: 影響範囲の特定と承認
※すべて自然言語で説明します
- 現状分析の説明
- 変更が必要な箇所の特定
- 予想される影響の説明
→ ご確認とご承認をいただけましたでしょうか？
※承認がない場合、次のPHASEには進めません

PHASE 2: 実装計画の確認
※すべて自然言語で説明します
1. 変更ファイル一覧：
- 修正が必要な既存ファイル（要提出）
- 新規作成が必要なファイル

2. ディレクトリ構造：
必要なディレクトリ構造を提示

3. 各ファイルでの変更内容の説明
4. 想定される影響の説明
→ この実装計画についてご承認をいただけますでしょうか？
※承認がない場合、次のPHASEには進めません

PHASE 3: 実装
※必要なファイルがすべて提出済みであることを確認してから開始します
承認をいただけましたら、実装フェーズに移ります。

【注意事項】
- 各フェーズでの承認は明示的に得る必要があります
- ファイルの提出がない場合は実装を開始できません
- 不明点がある場合は、必ず質問して明確にしてから進めます
- 型定義は最小限に抑え、必須フィールドのみ厳密に定義してください

コードブロックを出力する際は、以下の形式を使用してください：
\`\`\`言語 ファイル名
コード内容
\`\`\`

コードブロックは自動的にファイルに保存されることがあります。ファイル名は絶対パスまたはワークスペースルートからの相対パスで指定してください。`;
            default:
                return `あなたはAppGenius AIのアシスタントです。VSCode拡張機能内で動作し、ユーザーの開発作業を支援します。
質問に対して簡潔で有用な回答を提供してください。`;
        }
    }
    /**
     * 特定のページのモックアップを生成
     * @param pageName ページ名
     * @param requirements 要件テキスト
     * @returns 生成されたHTML
     */
    async generateMockupForPage(pageName, requirements) {
        try {
            const prompt = this.buildMockupGenerationPrompt(pageName, requirements);
            const response = await this.sendMessage(prompt, 'mockup-generation');
            // HTMLコードを抽出
            const html = this.extractHtmlFromResponse(response);
            if (!html) {
                throw new Error('No HTML found in the response');
            }
            return html;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to generate mockup for page ${pageName}: ${error.message}`);
            throw new Error(`モックアップ生成に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップをフィードバックに基づいて更新
     * @param html 現在のHTML
     * @param feedback フィードバックテキスト
     * @returns 更新されたHTML
     */
    async updateMockupWithFeedback(html, feedback) {
        try {
            const prompt = this.buildMockupUpdatePrompt(html, feedback);
            const response = await this.sendMessage(prompt, 'mockup-update');
            // HTMLコードを抽出
            const updatedHtml = this.extractHtmlFromResponse(response);
            if (!updatedHtml) {
                throw new Error('No HTML found in the response');
            }
            return updatedHtml;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to update mockup with feedback: ${error.message}`);
            throw new Error(`モックアップ更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップ生成用のプロンプトを作成
     * @param pageName ページ名
     * @param requirements 要件テキスト
     * @returns プロンプト
     */
    buildMockupGenerationPrompt(pageName, requirements) {
        return `あなたはウェブアプリケーションモックアップ作成の専門家です。
以下の情報から、機能的で美しいHTMLモックアップを作成してください。

ページ名: ${pageName}

要件:
${requirements}

重要なポイント:
1. シンプルで見やすいデザインを心がける
2. 必要最小限のスタイリングを含める (インラインスタイル推奨)
3. 複雑なJavaScriptは避け、見た目のデモンストレーションを優先
4. レスポンシブデザインを考慮する

モックアップHTMLを以下のフォーマットで出力してください:

\`\`\`html
<!DOCTYPE html>
<html>
...
</html>
\`\`\``;
    }
    /**
     * モックアップ更新用のプロンプトを作成
     * @param html 現在のHTML
     * @param feedback フィードバックテキスト
     * @returns プロンプト
     */
    buildMockupUpdatePrompt(html, feedback) {
        return `以下のHTMLモックアップを、フィードバックに基づいて更新してください:

フィードバック:
${feedback}

現在のHTML:
\`\`\`html
${html}
\`\`\`

重要なポイント:
1. HTMLの基本構造を維持する
2. 不要な部分を削除しない
3. フィードバックのみに対応する
4. インラインスタイルを使用する
5. 完全なHTMLドキュメントを返す

更新したHTMLを以下のフォーマットで出力してください:

\`\`\`html
<!DOCTYPE html>
<html>
...
</html>
\`\`\``;
    }
    /**
     * AIレスポンスからHTMLコードを抽出
     * @param response AIの応答
     * @returns HTMLコード、見つからない場合はnull
     */
    extractHtmlFromResponse(response) {
        // コードブロックを検出
        const htmlMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
        if (htmlMatch && htmlMatch[1]) {
            return htmlMatch[1].trim();
        }
        // HTMLタグを探す
        const docTypeMatch = response.match(/<(!DOCTYPE html|html)[\s\S]*<\/html>/i);
        if (docTypeMatch) {
            return docTypeMatch[0].trim();
        }
        return null;
    }
}
exports.AIService = AIService;
//# sourceMappingURL=aiService.js.map