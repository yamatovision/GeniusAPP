import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export class ImplementationViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview();

    // メッセージハンドラの設定
    webviewView.webview.onDidReceiveMessage(async (data) => {
      Logger.debug(`Received message from Implementation view: ${JSON.stringify(data)}`);
      
      switch (data.type) {
        case 'sendMessage':
          // AIへのメッセージ送信処理（Phase 1では単純なエコー）
          webviewView.webview.postMessage({
            type: 'receiveMessage',
            message: `AIからの応答: ${data.message}`,
            sender: 'ai'
          });
          break;
      }
    });
  }

  private _getHtmlForWebview() {
    return /*html*/`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>実装管理</title>
        <style>
          body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
          }
          .chat-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: 10px;
          }
          .view-header {
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .messages {
            flex-grow: 1;
            overflow-y: auto;
            margin-bottom: 10px;
          }
          .message {
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 6px;
            max-width: 80%;
          }
          .user-message {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            align-self: flex-end;
            margin-left: auto;
          }
          .ai-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            align-self: flex-start;
          }
          .input-area {
            display: flex;
            padding: 8px 0;
          }
          #message-input {
            flex-grow: 1;
            padding: 6px 8px;
            margin-right: 8px;
            border-radius: 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
          }
          #send-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
          }
          #send-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="chat-container">
          <div class="view-header">
            <h3>実装管理</h3>
          </div>
          <div class="messages" id="messages">
            <div class="message ai-message">
              コード生成や実装のサポートを行います。どのような機能を実装しますか？
            </div>
          </div>
          <div class="input-area">
            <input type="text" id="message-input" placeholder="メッセージを入力...">
            <button id="send-button">送信</button>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const messagesContainer = document.getElementById('messages');
          const messageInput = document.getElementById('message-input');
          const sendButton = document.getElementById('send-button');

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
                message: message
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
}