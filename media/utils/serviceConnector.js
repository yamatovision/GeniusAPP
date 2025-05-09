/**
 * ServiceConnector - WebViewとVSCodeサービス間の通信を担当
 * 
 * このモジュールは、WebViewからVSCodeの各サービスを直接呼び出すための機能を提供します。
 * MessageDispatchServiceを介さず、各サービスに直接メッセージを送信することで、
 * 中間層を排除し、コードをシンプルにします。
 */

// VSCodeのWebViewとの通信用acquireVsCodeApi関数
const vscode = acquireVsCodeApi();

/**
 * サービスタイプの列挙
 */
const ServiceType = {
  FILE_SYSTEM: 'fileSystem',
  PROJECT: 'project',
  SHARING: 'sharing',
  UI_STATE: 'uiState',
  PANEL: 'panel'
};

/**
 * サービスコネクター
 */
class ServiceConnector {
  constructor() {
    this._messageCallbacks = new Map();
    this._pendingRequests = new Map();
    this._requestCounter = 0;
    
    // イベントリスナーの設定
    window.addEventListener('message', this._handleMessage.bind(this));
    
    console.log('ServiceConnector: 初期化完了');
  }
  
  /**
   * VSCodeから受信したメッセージを処理
   * @param {MessageEvent} event 
   */
  _handleMessage(event) {
    const message = event.data;
    
    // デバッグログ
    if (message.command !== 'updateMarkdownContent' && message.command !== 'updateDirectoryStructure') {
      console.log('受信: ', message.command);
    }
    
    // コマンド名から登録済みのコールバックを実行
    if (this._messageCallbacks.has(message.command)) {
      this._messageCallbacks.get(message.command).forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('コールバック実行中にエラー:', error);
        }
      });
    }
    
    // リクエストIDがある場合、そのリクエストの返答として処理
    if (message.requestId && this._pendingRequests.has(message.requestId)) {
      const { resolve, reject, timeout } = this._pendingRequests.get(message.requestId);
      
      // タイムアウトをクリア
      if (timeout) {
        clearTimeout(timeout);
      }
      
      // リクエストを削除
      this._pendingRequests.delete(message.requestId);
      
      // 成功または失敗に応じてPromiseを解決/拒否
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message.data || message);
      }
    }
  }
  
  /**
   * メッセージコマンド用のコールバックを登録
   * @param {string} command コマンド名
   * @param {Function} callback コールバック関数
   * @returns {Function} 登録解除用の関数
   */
  on(command, callback) {
    if (!this._messageCallbacks.has(command)) {
      this._messageCallbacks.set(command, new Set());
    }
    
    this._messageCallbacks.get(command).add(callback);
    
    // 登録解除用の関数を返す
    return () => {
      if (this._messageCallbacks.has(command)) {
        this._messageCallbacks.get(command).delete(callback);
      }
    };
  }
  
  /**
   * VSCodeにメッセージを送信し、返答を待機
   * @param {string} serviceType サービスタイプ
   * @param {string} command コマンド名
   * @param {Object} params パラメータ
   * @param {number} timeoutMs タイムアウト（ミリ秒）
   * @returns {Promise<any>} 処理結果
   */
  async sendRequest(serviceType, command, params = {}, timeoutMs = 10000) {
    const requestId = `req_${Date.now()}_${this._requestCounter++}`;
    
    // リクエストメッセージを作成
    const message = {
      command,
      serviceType,
      requestId,
      ...params
    };
    
    // Promiseを作成
    const promise = new Promise((resolve, reject) => {
      // タイムアウト処理
      const timeout = setTimeout(() => {
        if (this._pendingRequests.has(requestId)) {
          this._pendingRequests.delete(requestId);
          reject(new Error(`リクエストがタイムアウトしました: ${command}`));
        }
      }, timeoutMs);
      
      // 保留中リクエストとして登録
      this._pendingRequests.set(requestId, { resolve, reject, timeout });
      
      // VSCodeにメッセージを送信
      vscode.postMessage(message);
    });
    
    return promise;
  }
  
  // ファイルシステムサービス関連のユーティリティメソッド
  
  /**
   * マークダウンファイルを読み込む
   * @param {string} filePath ファイルパス
   * @returns {Promise<string>} ファイル内容
   */
  async readMarkdownFile(filePath) {
    return this.sendRequest(ServiceType.FILE_SYSTEM, 'readMarkdownFile', { filePath });
  }
  
  /**
   * ファイルをエディタで開く
   * @param {string} filePath ファイルパス
   * @returns {Promise<void>}
   */
  async openFileInEditor(filePath) {
    return this.sendRequest(ServiceType.FILE_SYSTEM, 'openFileInEditor', { filePath });
  }
  
  /**
   * ディレクトリ内容を取得
   * @param {string} path ディレクトリパス
   * @returns {Promise<Array>} ファイル・ディレクトリ一覧
   */
  async listDirectory(path) {
    return this.sendRequest(ServiceType.FILE_SYSTEM, 'listDirectory', { path });
  }
  
  /**
   * ディレクトリ構造を更新
   * @param {string} path プロジェクトパス
   * @returns {Promise<Object>} ディレクトリ構造
   */
  async refreshFileBrowser(path) {
    return this.sendRequest(ServiceType.FILE_SYSTEM, 'refreshFileBrowser', { path });
  }
  
  // プロジェクト関連のユーティリティメソッド
  
  /**
   * プロジェクト一覧を取得
   * @returns {Promise<Array>} プロジェクト一覧
   */
  async getProjectList() {
    return this.sendRequest(ServiceType.PROJECT, 'getProjectList');
  }
  
  /**
   * プロジェクトを選択
   * @param {string} projectName プロジェクト名
   * @param {string} projectPath プロジェクトパス
   * @param {string} activeTab アクティブにするタブID
   * @returns {Promise<Object>} プロジェクト情報
   */
  async selectProject(projectName, projectPath, activeTab) {
    return this.sendRequest(ServiceType.PROJECT, 'selectProject', { 
      projectName, 
      projectPath, 
      activeTab 
    });
  }
  
  /**
   * プロジェクトを作成
   * @param {string} projectName プロジェクト名
   * @param {string} description プロジェクト説明
   * @returns {Promise<Object>} 作成されたプロジェクト情報
   */
  async createProject(projectName, description = '') {
    return this.sendRequest(ServiceType.PROJECT, 'createProject', { 
      projectName, 
      description 
    });
  }
  
  /**
   * プロジェクトを削除
   * @param {string} projectName プロジェクト名
   * @param {string} projectPath プロジェクトパス
   * @param {string} projectId プロジェクトID
   * @returns {Promise<boolean>} 削除成功/失敗
   */
  async removeProject(projectName, projectPath, projectId) {
    return this.sendRequest(ServiceType.PROJECT, 'removeProject', { 
      projectName, 
      projectPath, 
      projectId 
    });
  }
  
  // 共有関連のユーティリティメソッド
  
  /**
   * 共有履歴を取得
   * @returns {Promise<Array>} 共有履歴
   */
  async getHistory() {
    return this.sendRequest(ServiceType.SHARING, 'getHistory');
  }
  
  /**
   * 履歴から項目を削除
   * @param {string} fileId ファイルID
   * @returns {Promise<boolean>} 削除成功/失敗
   */
  async deleteFromHistory(fileId) {
    return this.sendRequest(ServiceType.SHARING, 'deleteFromHistory', { fileId });
  }
  
  /**
   * コマンドをクリップボードにコピー
   * @param {string} fileId ファイルID
   * @returns {Promise<Object>} コピー結果
   */
  async copyCommand(fileId) {
    return this.sendRequest(ServiceType.SHARING, 'copyCommand', { fileId });
  }
  
  /**
   * テキストをクリップボードにコピー
   * @param {string} text コピーするテキスト
   * @returns {Promise<boolean>} コピー成功/失敗
   */
  async copyToClipboard(text) {
    return this.sendRequest(ServiceType.SHARING, 'copyToClipboard', { text });
  }
  
  /**
   * 内容を共有
   * @param {string} content 共有する内容
   * @param {string} title タイトル
   * @returns {Promise<Object>} 共有結果
   */
  async shareContent(content, title) {
    return this.sendRequest(ServiceType.SHARING, 'shareContent', { content, title });
  }
}

// シングルトンインスタンスを作成
const serviceConnector = new ServiceConnector();

export default serviceConnector;