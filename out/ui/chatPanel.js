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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
class ChatPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // パネルが既に存在する場合は、それを表示
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }
        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel('appGeniusChat', 'AppGenius AI Chat', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri]
        });
        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        // WebViewのHTMLを設定
        this._updateWebview(extensionUri);
        // パネルが破棄されたときの処理
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // メッセージハンドラの設定
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'sendMessage':
                    // AIへのメッセージ送信処理（Phase 1では単純なエコー）
                    this._panel.webview.postMessage({
                        type: 'receiveMessage',
                        message: `AIからの応答: ${message.text}`,
                        sender: 'ai'
                    });
                    break;
            }
        }, null, this._disposables);
    }
    _updateWebview(extensionUri) {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);
    }
    _getHtmlForWebview(_webview, _extensionUri) {
        return /*html*/ `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AppGenius AI Chat</title>
        <style>
          body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          .chat-container {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 40px);
          }
          .chat-header {
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 16px;
          }
          .messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 10px 0;
            display: flex;
            flex-direction: column;
          }
          .message {
            margin-bottom: 16px;
            padding: 10px 16px;
            border-radius: 8px;
            max-width: 80%;
          }
          .user-message {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            align-self: flex-end;
          }
          .ai-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            align-self: flex-start;
          }
          .input-area {
            display: flex;
            padding: 16px 0;
            border-top: 1px solid var(--vscode-panel-border);
          }
          .message-input {
            flex-grow: 1;
            padding: 8px 12px;
            margin-right: 10px;
            border-radius: 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 14px;
          }
          .send-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .send-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .mode-selector {
            display: flex;
            margin-bottom: 16px;
          }
          .mode-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            margin-right: 8px;
            border-radius: 4px;
            cursor: pointer;
          }
          .mode-button.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
        </style>
      </head>
      <body>
        <div class="chat-container">
          <div class="chat-header">
            <h2>AppGenius AI</h2>
            <div class="mode-selector">
              <button class="mode-button active" id="chat-mode">チャット</button>
              <button class="mode-button" id="requirement-mode">要件定義</button>
              <button class="mode-button" id="implementation-mode">実装</button>
            </div>
          </div>
          
          <div class="messages" id="messages">
            <div class="message ai-message">
              こんにちは！AppGenius AIです。私はあなたの開発をサポートします。何かお手伝いできることはありますか？
            </div>
          </div>
          
          <div class="input-area">
            <input type="text" class="message-input" id="message-input" placeholder="メッセージを入力...">
            <button class="send-button" id="send-button">送信</button>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const messagesContainer = document.getElementById('messages');
          const messageInput = document.getElementById('message-input');
          const sendButton = document.getElementById('send-button');
          
          // モードボタンの設定
          const chatMode = document.getElementById('chat-mode');
          const requirementMode = document.getElementById('requirement-mode');
          const implementationMode = document.getElementById('implementation-mode');
          
          let currentMode = 'chat';
          
          // モード切替の処理
          chatMode.addEventListener('click', () => setMode('chat'));
          requirementMode.addEventListener('click', () => setMode('requirement'));
          implementationMode.addEventListener('click', () => setMode('implementation'));
          
          function setMode(mode) {
            currentMode = mode;
            
            // ボタンの見た目を更新
            chatMode.classList.remove('active');
            requirementMode.classList.remove('active');
            implementationMode.classList.remove('active');
            
            switch(mode) {
              case 'chat':
                chatMode.classList.add('active');
                break;
              case 'requirement':
                requirementMode.classList.add('active');
                break;
              case 'implementation':
                implementationMode.classList.add('active');
                break;
            }
            
            // AIにモード変更を通知
            const aiMessageElement = document.createElement('div');
            aiMessageElement.className = 'message ai-message';
            
            switch(mode) {
              case 'chat':
                aiMessageElement.textContent = 'チャットモードに切り替えました。何かお手伝いできることはありますか？';
                break;
              case 'requirement':
                aiMessageElement.textContent = '要件定義モードに切り替えました。プロジェクトの要件について教えてください。';
                break;
              case 'implementation':
                aiMessageElement.textContent = '実装モードに切り替えました。どのような実装が必要ですか？';
                break;
            }
            
            messagesContainer.appendChild(aiMessageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
          
          // メッセージ送信処理
          function sendMessage() {
            const message = messageInput.value.trim();
            if (message) {
              // UIにユーザーメッセージを追加
              const userMessageElement = document.createElement('div');
              userMessageElement.className = 'message user-message';
              userMessageElement.textContent = message;
              messagesContainer.appendChild(userMessageElement);
              
              // 入力欄をクリア
              messageInput.value = '';
              
              // VSCodeにメッセージを送信
              vscode.postMessage({
                type: 'sendMessage',
                text: message,
                mode: currentMode
              });
              
              // スクロールを最下部へ
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          }
          
          // メッセージ受信処理
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'receiveMessage') {
              const aiMessageElement = document.createElement('div');
              aiMessageElement.className = 'message ai-message';
              aiMessageElement.textContent = message.message;
              messagesContainer.appendChild(aiMessageElement);
              
              // スクロールを最下部へ
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          });
          
          // ボタンクリックイベント
          sendButton.addEventListener('click', sendMessage);
          
          // Enterキーイベント
          messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              sendMessage();
            }
          });
        </script>
      </body>
      </html>
    `;
    }
    dispose() {
        ChatPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.ChatPanel = ChatPanel;
//# sourceMappingURL=chatPanel.js.map