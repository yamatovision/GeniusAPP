/**
 * API呼び出し再試行ユーティリティ
 * ネットワークエラーやサーバーエラーが発生した場合に自動的に再試行するラッパー関数を提供します
 */

/**
 * 指定ミリ秒待機する
 * @param {number} ms - 待機ミリ秒
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * リトライ可能なエラーかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean} リトライ可能ならtrue
 */
const isRetryableError = (error) => {
  // error.retryableがtrueなら再試行可能
  if (error && error.retryable === true) {
    return true;
  }

  // Axiosエラーの場合
  if (error && error.response) {
    const status = error.response.status;
    // 429: レート制限、5xx: サーバーエラー
    return status === 429 || (status >= 500 && status < 600);
  }

  // ネットワークエラー（レスポンスが無い）
  if (error && error.request && !error.response) {
    return true;
  }

  return false;
};

/**
 * 指数バックオフで再試行間隔を計算
 * @param {number} attempt - 試行回数
 * @param {number} baseDelay - 基本ディレイ（ms）
 * @param {number} maxDelay - 最大ディレイ（ms）
 * @returns {number} 待機ミリ秒
 */
const calculateBackoff = (attempt, baseDelay = 1000, maxDelay = 30000) => {
  // 指数バックオフ（2^n）にランダム要素を加える
  const delay = Math.min(
    Math.pow(2, attempt) * baseDelay + Math.random() * 1000,
    maxDelay
  );
  return delay;
};

/**
 * APIコールをリトライロジックでラップする関数
 * @param {Function} apiCall - API呼び出し関数
 * @param {Object} options - オプション
 * @param {number} options.maxRetries - 最大再試行回数（デフォルト: 3）
 * @param {number} options.baseDelay - 基本待機時間ms（デフォルト: 1000）
 * @param {number} options.maxDelay - 最大待機時間ms（デフォルト: 30000）
 * @param {Function} options.onRetry - 再試行時のコールバック
 * @returns {Promise<any>} API呼び出し結果
 */
export const withRetry = async (apiCall, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry = null
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await apiCall();
    } catch (error) {
      attempt++;

      // 最大試行回数を超えたか、リトライ不可能なエラーの場合は例外を投げる
      if (attempt > maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Retry-Afterヘッダーがある場合（429エラー等）は、その値を使用
      let waitTime;
      if (error.response?.headers?.['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10);
        waitTime = isNaN(retryAfter) ? calculateBackoff(attempt, baseDelay, maxDelay) : retryAfter * 1000;
      } else {
        waitTime = calculateBackoff(attempt, baseDelay, maxDelay);
      }

      // 再試行コールバックがあれば実行
      if (onRetry && typeof onRetry === 'function') {
        onRetry({
          error,
          attempt,
          waitTime,
          maxRetries
        });
      }

      // 待機してから再試行
      await sleep(waitTime);
    }
  }
};

/**
 * ロード状態とエラー状態を管理するローディングラッパー
 * @param {Function} apiCall - API呼び出し関数
 * @param {Object} options - オプション
 * @param {Function} options.onStart - 開始時のコールバック
 * @param {Function} options.onSuccess - 成功時のコールバック
 * @param {Function} options.onError - エラー時のコールバック
 * @param {Function} options.onFinally - 完了時のコールバック
 * @returns {Promise<any>} API呼び出し結果
 */
export const withLoading = async (apiCall, options = {}) => {
  const {
    onStart = null,
    onSuccess = null,
    onError = null,
    onFinally = null
  } = options;

  try {
    // 開始イベント
    if (onStart && typeof onStart === 'function') {
      onStart();
    }

    // API呼び出し実行
    const result = await apiCall();

    // 成功イベント
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    // エラーイベント
    if (onError && typeof onError === 'function') {
      onError(error);
    }
    throw error;
  } finally {
    // 完了イベント
    if (onFinally && typeof onFinally === 'function') {
      onFinally();
    }
  }
};