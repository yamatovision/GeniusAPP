// @ts-check

/**
 * UIヘルパーユーティリティ
 * 
 * UI操作に関連するヘルパー関数を提供します。
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
}

// グローバルに公開
export default UIHelpers;