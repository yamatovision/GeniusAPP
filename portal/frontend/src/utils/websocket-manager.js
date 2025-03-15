/**
 * WebSocketマネージャー
 * バックエンドとのリアルタイム通信を管理します
 */

// WebSocketのベースURL（環境変数から取得または推測）
const getWebSocketUrl = () => {
  const apiUrl = process.env.REACT_APP_API_URL || '/api';
  
  // HTTP(S)からWS(S)に変換
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  } else if (apiUrl.startsWith('/')) {
    // 相対パスの場合は現在のホストからWSプロトコルで接続
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${apiUrl}`;
  }
  
  return apiUrl;
};

// イベントタイプ
export const EventTypes = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  MESSAGE: 'message',
  PROMPT_UPDATED: 'prompt_updated',
  PROMPT_CREATED: 'prompt_created',
  PROMPT_DELETED: 'prompt_deleted',
  PROMPT_USAGE_RECORDED: 'prompt_usage_recorded',
  PROJECT_UPDATED: 'project_updated',
  USER_UPDATED: 'user_updated'
};

/**
 * WebSocket接続を管理するクラス
 */
class WebSocketManager {
  constructor() {
    this._socket = null;
    this._isConnected = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectInterval = 1000;
    this._listeners = new Map();
    this._messageQueue = [];
    this._token = null;
  }
  
  /**
   * WebSocket接続を初期化
   * @param {string} token - 認証トークン
   * @returns {Promise<boolean>} 接続成功時はtrue
   */
  async connect(token) {
    if (this._socket && this._isConnected) {
      return true;
    }
    
    this._token = token;
    
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${getWebSocketUrl()}/ws?token=${token}`;
        this._socket = new WebSocket(wsUrl);
        
        this._socket.onopen = () => {
          console.log('WebSocket接続が確立されました');
          this._isConnected = true;
          this._reconnectAttempts = 0;
          this._processQueue();
          
          // 接続イベントを発火
          this._notifyListeners(EventTypes.CONNECT);
          resolve(true);
        };
        
        this._socket.onclose = (event) => {
          console.log(`WebSocket接続が閉じられました: ${event.code} ${event.reason}`);
          this._isConnected = false;
          
          // 切断イベントを発火
          this._notifyListeners(EventTypes.DISCONNECT, {
            code: event.code,
            reason: event.reason
          });
          
          // 自動再接続（クリーンな切断でない場合）
          if (event.code !== 1000 && event.code !== 1001) {
            this._attemptReconnect();
          }
        };
        
        this._socket.onerror = (error) => {
          console.error('WebSocketエラー:', error);
          
          // エラーイベントを発火
          this._notifyListeners(EventTypes.ERROR, error);
          
          if (!this._isConnected) {
            reject(new Error('WebSocket接続エラー'));
          }
        };
        
        this._socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // メッセージタイプに基づいて適切なイベントを発火
            if (message.type) {
              this._notifyListeners(message.type, message.data);
            }
            
            // すべてのメッセージリスナーにも通知
            this._notifyListeners(EventTypes.MESSAGE, message);
          } catch (error) {
            console.error('WebSocketメッセージの解析に失敗:', error);
          }
        };
      } catch (error) {
        console.error('WebSocket初期化エラー:', error);
        reject(error);
      }
    });
  }
  
  /**
   * WebSocket接続を切断
   */
  disconnect() {
    if (this._socket) {
      this._socket.close(1000, 'クライアントから切断');
      this._socket = null;
      this._isConnected = false;
    }
  }
  
  /**
   * WebSocketを通じてメッセージを送信
   * @param {string} type - メッセージタイプ
   * @param {Object} data - メッセージデータ
   * @returns {boolean} 送信成功時はtrue
   */
  send(type, data = {}) {
    const message = JSON.stringify({
      type,
      data
    });
    
    if (this._isConnected && this._socket) {
      this._socket.send(message);
      return true;
    } else {
      // 未接続時はキューに追加
      this._messageQueue.push(message);
      
      // 自動接続を試みる
      if (this._token && !this._isConnected) {
        this.connect(this._token).catch(error => {
          console.error('自動再接続に失敗:', error);
        });
      }
      
      return false;
    }
  }
  
  /**
   * イベントリスナーを登録
   * @param {string} event - イベントタイプ
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー登録解除用の関数
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    
    const listeners = this._listeners.get(event);
    listeners.add(callback);
    
    // リスナー登録解除用の関数を返す
    return () => {
      const listeners = this._listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }
  
  /**
   * イベントリスナーを一度だけ呼び出すよう登録
   * @param {string} event - イベントタイプ
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー登録解除用の関数
   */
  once(event, callback) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      callback(...args);
    };
    
    return this.on(event, onceWrapper);
  }
  
  /**
   * イベントリスナーを登録解除
   * @param {string} event - イベントタイプ
   * @param {Function} callback - コールバック関数
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  /**
   * 接続状態を確認
   * @returns {boolean} 接続中はtrue
   */
  isConnected() {
    return this._isConnected;
  }
  
  /**
   * メッセージキューを処理
   */
  _processQueue() {
    if (this._isConnected && this._messageQueue.length > 0) {
      // キューのメッセージを送信
      while (this._messageQueue.length > 0) {
        const message = this._messageQueue.shift();
        this._socket.send(message);
      }
    }
  }
  
  /**
   * 自動再接続を試みる
   */
  _attemptReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.log('最大再接続試行回数に達しました');
      return;
    }
    
    this._reconnectAttempts++;
    const delay = this._reconnectInterval * Math.pow(2, this._reconnectAttempts - 1);
    
    console.log(`${delay}ms後に再接続を試みます (${this._reconnectAttempts}/${this._maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this._isConnected && this._token) {
        this.connect(this._token).catch(error => {
          console.error('再接続に失敗:', error);
        });
      }
    }, delay);
  }
  
  /**
   * 登録されたリスナーに通知
   * @param {string} event - イベントタイプ
   * @param {any} data - イベントデータ
   */
  _notifyListeners(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`リスナーの実行中にエラーが発生しました (${event}):`, error);
        }
      });
    }
  }
}

// シングルトンインスタンスをエクスポート
export default new WebSocketManager();