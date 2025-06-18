/**
 * セッション管理サービス
 * ユーザーのセッション状態を管理し、同時ログイン制限を実現する
 */

const SimpleUser = require('../models/simpleUser.model');
const crypto = require('crypto');

class SessionService {
  /**
   * セッションIDを生成
   * @returns {string} ユニークなセッションID
   */
  static generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * ユーザーの現在のセッション情報を取得
   * @param {string} userId - ユーザーID
   * @returns {Promise<Object|null>} セッション情報
   */
  static async getUserSession(userId) {
    try {
      const user = await SimpleUser.findById(userId);
      if (!user || !user.activeSession || !user.activeSession.sessionId) {
        return null;
      }
      return user.activeSession;
    } catch (error) {
      console.error('セッション情報取得エラー:', error);
      throw error;
    }
  }

  /**
   * ユーザーがアクティブなセッションを持っているか確認
   * @param {string} userId - ユーザーID
   * @returns {Promise<boolean>} アクティブセッションの有無
   */
  static async hasActiveSession(userId) {
    try {
      const user = await SimpleUser.findById(userId);
      return user ? user.hasActiveSession() : false;
    } catch (error) {
      console.error('アクティブセッション確認エラー:', error);
      throw error;
    }
  }

  /**
   * 新しいセッションを作成
   * @param {string} userId - ユーザーID
   * @param {string} ipAddress - IPアドレス
   * @param {string} userAgent - ユーザーエージェント
   * @returns {Promise<string>} セッションID
   */
  static async createSession(userId, ipAddress, userAgent) {
    try {
      const user = await SimpleUser.findById(userId);
      if (!user) {
        throw new Error('ユーザーが見つかりません');
      }

      const sessionId = this.generateSessionId();
      await user.setActiveSession(sessionId, ipAddress, userAgent);
      
      return sessionId;
    } catch (error) {
      console.error('セッション作成エラー:', error);
      throw error;
    }
  }

  /**
   * セッションを強制終了して新しいセッションを作成
   * @param {string} userId - ユーザーID
   * @param {string} ipAddress - IPアドレス
   * @param {string} userAgent - ユーザーエージェント
   * @returns {Promise<Object>} 新しいセッションIDと前のセッション情報
   */
  static async forceCreateSession(userId, ipAddress, userAgent) {
    try {
      const user = await SimpleUser.findById(userId);
      if (!user) {
        throw new Error('ユーザーが見つかりません');
      }

      // 既存のセッション情報を保存
      const previousSession = user.activeSession ? {
        sessionId: user.activeSession.sessionId,
        loginTime: user.activeSession.loginTime,
        lastActivity: user.activeSession.lastActivity,
        ipAddress: user.activeSession.ipAddress
      } : null;

      // 新しいセッションを作成
      const sessionId = this.generateSessionId();
      await user.setActiveSession(sessionId, ipAddress, userAgent);

      return {
        newSessionId: sessionId,
        previousSession: previousSession
      };
    } catch (error) {
      console.error('強制セッション作成エラー:', error);
      throw error;
    }
  }

  /**
   * セッションの有効性を検証
   * @param {string} userId - ユーザーID
   * @param {string} sessionId - セッションID
   * @returns {Promise<boolean>} セッションが有効かどうか
   */
  static async validateSession(userId, sessionId) {
    try {
      const user = await SimpleUser.findById(userId);
      if (!user || !user.activeSession || !user.activeSession.sessionId) {
        return false;
      }

      return user.activeSession.sessionId === sessionId;
    } catch (error) {
      console.error('セッション検証エラー:', error);
      throw error;
    }
  }

  /**
   * セッションをクリア
   * @param {string} userId - ユーザーID
   * @returns {Promise<void>}
   */
  static async clearSession(userId) {
    try {
      const user = await SimpleUser.findById(userId);
      if (!user) {
        throw new Error('ユーザーが見つかりません');
      }

      await user.clearActiveSession();
    } catch (error) {
      console.error('セッションクリアエラー:', error);
      throw error;
    }
  }

  /**
   * セッションのアクティビティを更新
   * @param {string} userId - ユーザーID
   * @returns {Promise<void>}
   */
  static async updateSessionActivity(userId) {
    try {
      const user = await SimpleUser.findById(userId);
      if (!user) {
        throw new Error('ユーザーが見つかりません');
      }

      await user.updateSessionActivity();
    } catch (error) {
      console.error('セッションアクティビティ更新エラー:', error);
      throw error;
    }
  }

  /**
   * トークンからセッションIDを抽出（JWTペイロードに含める場合）
   * @param {Object} tokenPayload - デコードされたトークンペイロード
   * @returns {string|null} セッションID
   */
  static extractSessionIdFromToken(tokenPayload) {
    return tokenPayload.sessionId || null;
  }
}

module.exports = SessionService;