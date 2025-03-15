import axios from 'axios';
import authHeader from '../utils/auth-header';
import { refreshTokenService } from '../utils/token-refresh';

// APIのベースURL
// プロジェクト関連の操作はプロンプトAPIに統合
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/prompts/projects`;

/**
 * プロジェクトサービス
 * プロジェクト関連のAPI呼び出しを管理します
 */
class ProjectService {
  /**
   * プロジェクト一覧を取得
   * @param {Object} options - 検索オプション
   * @param {number} options.page - ページ番号
   * @param {number} options.limit - 1ページの表示件数
   * @param {string} options.sort - ソート条件 (例: 'lastActivity:desc')
   * @param {string} options.search - 検索キーワード
   * @param {boolean} options.archived - アーカイブ済みプロジェクトを含めるか
   * @returns {Promise} プロジェクト一覧
   */
  async getProjects(options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_URL}?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      // 新しいAPI形式に合わせて戻り値を調整
      return {
        projects: response.data.projects,
        totalItems: response.data.total,
        page: options.page || 1,
        limit: options.limit || 10,
        totalPages: Math.ceil(response.data.total / (options.limit || 10))
      };
    } catch (error) {
      console.error('プロジェクト一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getProjects(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクト詳細を取得
   * @param {string} id - プロジェクトID
   * @returns {Promise} プロジェクト詳細
   */
  async getProjectById(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクト詳細取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getProjectById(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 新規プロジェクト作成
   * @param {Object} projectData - プロジェクトデータ
   * @param {string} projectData.name - プロジェクト名
   * @param {string} projectData.description - 説明
   * @param {string} projectData.icon - アイコン
   * @param {string} projectData.color - カラー
   * @param {Object} projectData.settings - プロジェクト設定
   * @returns {Promise} 作成結果
   */
  async createProject(projectData) {
    try {
      const response = await axios.post(API_URL, projectData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度作成を試みる
          return this.createProject(projectData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクト更新
   * @param {string} id - プロジェクトID
   * @param {Object} projectData - 更新データ
   * @returns {Promise} 更新結果
   */
  async updateProject(id, projectData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, projectData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクト更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateProject(id, projectData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクト削除（論理削除）
   * @param {string} id - プロジェクトID
   * @returns {Promise} 削除結果
   */
  async deleteProject(id) {
    try {
      const response = await axios.delete(`${API_URL}/${id}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度削除を試みる
          return this.deleteProject(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクトメンバー一覧取得
   * @param {string} id - プロジェクトID
   * @returns {Promise} メンバー一覧
   */
  async getProjectMembers(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/members`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクトメンバー一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getProjectMembers(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクトメンバー追加
   * @param {string} id - プロジェクトID
   * @param {Object} memberData - メンバーデータ
   * @param {string} memberData.email - メンバーのメールアドレス
   * @param {string} memberData.role - メンバーの役割 (editor/viewer)
   * @returns {Promise} 追加結果
   */
  async addProjectMember(id, memberData) {
    try {
      const response = await axios.post(`${API_URL}/${id}/members`, memberData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクトメンバー追加エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度追加を試みる
          return this.addProjectMember(id, memberData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクトメンバーの役割更新
   * @param {string} id - プロジェクトID
   * @param {string} userId - メンバーのユーザーID
   * @param {Object} roleData - 役割データ
   * @param {string} roleData.role - 新しい役割 (editor/viewer)
   * @returns {Promise} 更新結果
   */
  async updateMemberRole(id, userId, roleData) {
    try {
      const response = await axios.put(`${API_URL}/${id}/members/${userId}`, roleData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('メンバー役割更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateMemberRole(id, userId, roleData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクトメンバー削除
   * @param {string} id - プロジェクトID
   * @param {string} userId - メンバーのユーザーID
   * @returns {Promise} 削除結果
   */
  async removeProjectMember(id, userId) {
    try {
      const response = await axios.delete(`${API_URL}/${id}/members/${userId}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクトメンバー削除エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度削除を試みる
          return this.removeProjectMember(id, userId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロジェクト内のプロンプト一覧取得
   * @param {string} id - プロジェクトID
   * @param {Object} options - 検索オプション
   * @param {number} options.page - ページ番号
   * @param {number} options.limit - 1ページの表示件数
   * @param {string} options.sort - ソート条件
   * @param {string} options.search - 検索キーワード
   * @param {string} options.category - カテゴリーフィルター
   * @param {string} options.tags - タグフィルター
   * @returns {Promise} プロンプト一覧
   */
  async getProjectPrompts(id, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_URL}/${id}/prompts?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロジェクトプロンプト一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getProjectPrompts(id, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * トークンのリフレッシュ
   * 共通リフレッシュトークンサービスを呼び出す
   * @returns {Promise<string>} 新しいアクセストークン
   */
  async refreshToken() {
    try {
      return await refreshTokenService.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }
}

export default new ProjectService();