// @ts-check

/**
 * UIヘルパーユーティリティ
 * 
 * UI操作に関連するヘルパー関数を提供します。
 * v2: リファクタリングでscopeManager.jsから移植した機能を追加
 */
class UIHelpers {
  /**
   * 要素の表示/非表示を切り替える
   * @param {HTMLElement} element 対象要素
   * @param {boolean} show 表示するかどうか
   */
  static toggleVisibility(element, show) {
    if (!element) return;
    
    if (show) {
      element.style.display = '';
    } else {
      element.style.display = 'none';
    }
  }
  
  /**
   * クラスの有無を切り替える
   * @param {HTMLElement} element 対象要素
   * @param {string} className クラス名
   * @param {boolean} add 追加するかどうか
   */
  static toggleClass(element, className, add) {
    if (!element) return;
    
    if (add) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  }
  
  /**
   * 要素を空にする
   * @param {HTMLElement} element 対象要素
   */
  static clearElement(element) {
    if (!element) return;
    
    element.innerHTML = '';
  }
  
  /**
   * 要素の子要素を作成して追加
   * @param {HTMLElement} parent 親要素
   * @param {string} tagName タグ名
   * @param {object} [attributes={}] 属性オブジェクト
   * @param {string} [innerText=''] 内部テキスト
   * @returns {HTMLElement} 作成された要素
   */
  static createElement(parent, tagName, attributes = {}, innerText = '') {
    const element = document.createElement(tagName);
    
    // 属性を設定
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // 内部テキストを設定
    if (innerText) {
      element.textContent = innerText;
    }
    
    // 親要素に追加
    if (parent) {
      parent.appendChild(element);
    }
    
    return element;
  }
  
  /**
   * フォーム要素の値を取得
   * @param {string} selector セレクタ
   * @returns {string} 要素の値
   */
  static getInputValue(selector) {
    const element = document.querySelector(selector);
    if (!element) return '';
    
    return element.value;
  }
  
  /**
   * フォーム要素の値を設定
   * @param {string} selector セレクタ
   * @param {string} value 設定する値
   */
  static setInputValue(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    element.value = value;
  }
  
  /**
   * フォーム要素の無効化状態を設定
   * @param {string} selector セレクタ
   * @param {boolean} disabled 無効化するかどうか
   */
  static setInputDisabled(selector, disabled) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    element.disabled = disabled;
  }
  
  /**
   * チェックボックスの状態を設定
   * @param {string} selector セレクタ
   * @param {boolean} checked チェックするかどうか
   */
  static setCheckboxChecked(selector, checked) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    element.checked = checked;
  }
  
  /**
   * セレクトボックスの選択を設定
   * @param {string} selector セレクタ
   * @param {string} value 選択する値
   */
  static setSelectValue(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    element.value = value;
  }
  
  /**
   * フォーム要素にフォーカスを設定
   * @param {string} selector セレクタ
   */
  static focusElement(selector) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    element.focus();
  }
  
  /**
   * 要素のテキスト内容を設定
   * @param {string} selector セレクタ
   * @param {string} text テキスト
   */
  static setText(selector, text) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    element.textContent = text;
  }
  
  /**
   * 要素のHTML内容を設定
   * @param {string} selector セレクタ
   * @param {string} html HTML
   */
  static setHtml(selector, html) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    element.innerHTML = html;
  }
  
  /**
   * 要素へのイベントリスナーを追加
   * @param {string} selector セレクタ
   * @param {string} eventType イベントタイプ
   * @param {Function} handler ハンドラ
   */
  static addEventListenerToElements(selector, eventType, handler) {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach(element => {
      element.addEventListener(eventType, handler);
    });
  }
  
  /**
   * 要素をフェードイン
   * @param {HTMLElement} element 対象要素
   * @param {number} [duration=300] アニメーション時間（ミリ秒）
   */
  static fadeIn(element, duration = 300) {
    if (!element) return;
    
    element.style.opacity = '0';
    element.style.display = '';
    
    let start = null;
    
    function animate(timestamp) {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const opacity = Math.min(progress / duration, 1);
      
      element.style.opacity = opacity.toString();
      
      if (progress < duration) {
        window.requestAnimationFrame(animate);
      }
    }
    
    window.requestAnimationFrame(animate);
  }
  
  /**
   * 要素をフェードアウト
   * @param {HTMLElement} element 対象要素
   * @param {number} [duration=300] アニメーション時間（ミリ秒）
   * @returns {Promise<void>} アニメーション完了時に解決されるPromise
   */
  static fadeOut(element, duration = 300) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }
      
      let start = null;
      
      function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const opacity = Math.max(1 - progress / duration, 0);
        
        element.style.opacity = opacity.toString();
        
        if (progress < duration) {
          window.requestAnimationFrame(animate);
        } else {
          element.style.display = 'none';
          resolve();
        }
      }
      
      window.requestAnimationFrame(animate);
    });
  }
  
  /**
   * 要素をスライドダウン
   * @param {HTMLElement} element 対象要素
   * @param {number} [duration=300] アニメーション時間（ミリ秒）
   */
  static slideDown(element, duration = 300) {
    if (!element) return;
    
    // 一時的に表示して高さを取得
    const originalDisplay = element.style.display;
    element.style.display = 'block';
    const height = element.scrollHeight;
    element.style.display = 'none';
    
    // アニメーション開始
    element.style.overflow = 'hidden';
    element.style.height = '0';
    element.style.display = originalDisplay || 'block';
    element.style.transition = `height ${duration}ms ease`;
    
    // 次のフレームで高さを設定（CSSトランジションのため）
    setTimeout(() => {
      element.style.height = `${height}px`;
      
      // アニメーション終了時の処理
      setTimeout(() => {
        element.style.height = '';
        element.style.overflow = '';
        element.style.transition = '';
      }, duration);
    }, 10);
  }
  
  /**
   * 要素をスライドアップ
   * @param {HTMLElement} element 対象要素
   * @param {number} [duration=300] アニメーション時間（ミリ秒）
   * @returns {Promise<void>} アニメーション完了時に解決されるPromise
   */
  static slideUp(element, duration = 300) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }
      
      // 現在の高さを設定
      const height = element.scrollHeight;
      element.style.overflow = 'hidden';
      element.style.height = `${height}px`;
      element.style.transition = `height ${duration}ms ease`;
      
      // 次のフレームで高さを0に設定（CSSトランジションのため）
      setTimeout(() => {
        element.style.height = '0';
        
        // アニメーション終了時の処理
        setTimeout(() => {
          element.style.display = 'none';
          element.style.height = '';
          element.style.overflow = '';
          element.style.transition = '';
          resolve();
        }, duration);
      }, 10);
    });
  }
  
  /**
   * エラーメッセージを表示
   * @param {string} message 表示するエラーメッセージ
   */
  static showError(message) {
    console.error('エラー:', message);
    
    // 既存のメッセージがあれば削除
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(el => el.remove());
    
    // エラーメッセージの作成
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<span>⚠️</span> ${message}`;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.color = '#721c24';
    errorDiv.style.padding = '10px 20px';
    errorDiv.style.borderRadius = '4px';
    errorDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    errorDiv.style.zIndex = '10000';
    
    document.body.appendChild(errorDiv);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }
  
  /**
   * 成功メッセージ表示
   * @param {string} message 表示する成功メッセージ
   */
  static showSuccess(message) {
    console.log('成功:', message);
    
    // 既存のメッセージがあれば削除
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(el => el.remove());
    
    // 成功メッセージの作成
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `<span>✅</span> ${message}`;
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.left = '50%';
    successDiv.style.transform = 'translateX(-50%)';
    successDiv.style.backgroundColor = '#d4edda';
    successDiv.style.color = '#155724';
    successDiv.style.padding = '10px 20px';
    successDiv.style.borderRadius = '4px';
    successDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    successDiv.style.zIndex = '10000';
    
    document.body.appendChild(successDiv);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 5000);
  }
  
  /**
   * ステータスに応じたCSSクラスを返す
   * @param {string} status ステータス文字列
   * @returns {string} 対応するCSSクラス名
   */
  static getStatusClass(status) {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'in-progress':
        return 'status-in-progress';
      case 'blocked':
        return 'status-blocked';
      case 'pending':
      default:
        return 'status-pending';
    }
  }
  
  /**
   * ステータスの表示テキストを返す
   * @param {string} status ステータス文字列
   * @returns {string} 日本語表示テキスト
   */
  static getStatusText(status) {
    switch (status) {
      case 'completed':
        return '完了';
      case 'in-progress':
        return '進行中';
      case 'blocked':
        return '停止中';
      case 'pending':
      default:
        return '未着手';
    }
  }
  
  /**
   * 相対時間の取得（〇分前、など）
   * @param {Date} date 日付
   * @returns {string} 相対時間
   */
  static getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffMin < 1) {
      return '数秒前';
    } else if (diffMin < 60) {
      return `${diffMin}分前`;
    } else if (diffHour < 24) {
      return `${diffHour}時間前`;
    } else {
      // 日付のフォーマット
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  }
  
  // ディレクトリ構造表示機能は削除（UIで使用されていないため）
}

// クラス全体をexport
export default UIHelpers;

// 個別関数をエクスポート（scopeManager.jsから移行した関数）
export const showError = UIHelpers.showError;
export const showSuccess = UIHelpers.showSuccess;
export const getStatusClass = UIHelpers.getStatusClass;
export const getStatusText = UIHelpers.getStatusText;
export const getTimeAgo = UIHelpers.getTimeAgo;