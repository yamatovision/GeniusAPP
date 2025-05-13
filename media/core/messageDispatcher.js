/**
 * MessageDispatcher - コンポーネント間メッセージング
 * 
 * このモジュールは、ScopeManagerの各コンポーネント間のメッセージングを
 * 効率的に行うためのシンプルなイベントバスを提供します。
 * CustomEventを使用して疎結合なコンポーネント間通信を実現します。
 */

class MessageDispatcher {
  /**
   * メッセージを送信（イベントを発行）
   * @param {string} eventName イベント名
   * @param {object} data イベントデータ
   */
  static dispatch(eventName, data = {}) {
    // カスタムイベントを作成して発行
    const event = new CustomEvent(eventName, { detail: data });
    document.dispatchEvent(event);
  }

  /**
   * メッセージリスナーを登録
   * @param {string} eventName イベント名
   * @param {function} callback コールバック関数
   * @returns {function} リスナー解除用の関数
   */
  static subscribe(eventName, callback) {
    // イベントリスナーを登録
    document.addEventListener(eventName, callback);
    
    // 登録解除用の関数を返す
    return () => document.removeEventListener(eventName, callback);
  }

  /**
   * 一度だけ実行されるメッセージリスナーを登録
   * @param {string} eventName イベント名
   * @param {function} callback コールバック関数
   */
  static subscribeOnce(eventName, callback) {
    const onceCallback = (event) => {
      // リスナーを解除
      document.removeEventListener(eventName, onceCallback);
      // コールバックを実行
      callback(event);
    };
    
    // 一度だけ実行されるリスナーを登録
    document.addEventListener(eventName, onceCallback);
  }
}

// エクスポート
export default MessageDispatcher;