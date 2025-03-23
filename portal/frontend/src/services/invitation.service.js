import axios from 'axios';
import authHeader from '../utils/auth-header';
import { refreshTokenService } from '../utils/token-refresh';
import { withRetry } from '../utils/api-retry';

// APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const ORGANIZATIONS_API_URL = `${API_BASE_URL}/organizations`;
const INVITATIONS_API_URL = `${API_BASE_URL}/invitations`;

/**
 * 招待管理サービス
 * 組織への招待作成、一覧取得、承諾などの機能を提供
 */
class InvitationService {
  /**
   * トークンのリフレッシュ
   */
  async refreshToken() {
    try {
      return await refreshTokenService.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * 組織に新規メンバーを招待
   * @param {string} organizationId - 組織ID
   * @param {Object} invitationData - 招待データ（email, role, message）
   * @returns {Promise} 招待結果
   */
  async createInvitation(organizationId, invitationData) {
    try {
      const response = await axios.post(`${ORGANIZATIONS_API_URL}/${organizationId}/invitations`, invitationData, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.createInvitation(organizationId, invitationData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * 組織の招待一覧を取得
   * @param {string} organizationId - 組織ID
   * @returns {Promise} 招待一覧
   */
  async getOrganizationInvitations(organizationId) {
    try {
      const response = await axios.get(`${ORGANIZATIONS_API_URL}/${organizationId}/invitations`, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.getOrganizationInvitations(organizationId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * 招待をキャンセル
   * @param {string} organizationId - 組織ID
   * @param {string} invitationId - 招待ID
   * @returns {Promise} キャンセル結果
   */
  async cancelInvitation(organizationId, invitationId) {
    try {
      const response = await axios.delete(`${ORGANIZATIONS_API_URL}/${organizationId}/invitations/${invitationId}`, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.cancelInvitation(organizationId, invitationId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * 招待を検証（トークンから招待情報を取得）
   * @param {string} token - 招待トークン
   * @returns {Promise} 招待情報
   */
  async verifyInvitation(token) {
    try {
      const response = await axios.get(`${INVITATIONS_API_URL}/${token}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 招待を承諾（新規ユーザー登録）
   * @param {string} token - 招待トークン
   * @param {Object} userData - ユーザー登録データ
   * @returns {Promise} 登録結果
   */
  async acceptInvitationNewUser(token, userData) {
    try {
      const response = await axios.post(`${INVITATIONS_API_URL}/${token}/register`, userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 招待を承諾（既存ユーザー）
   * @param {string} token - 招待トークン
   * @param {Object} loginData - ログインデータ
   * @returns {Promise} ログイン結果
   */
  async acceptInvitationExistingUser(token, loginData) {
    try {
      const response = await axios.post(`${INVITATIONS_API_URL}/${token}/login`, loginData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default new InvitationService();