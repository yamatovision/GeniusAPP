import axios from 'axios';
import authHeader from '../utils/auth-header';

// APIのベースURL
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/plans`;

/**
 * アクセスプラン管理サービス
 * APIアクセスレベルとプラン設定の管理機能を提供
 */
class PlanService {
  /**
   * プラン一覧を取得
   * @returns {Promise} プラン一覧
   */
  async getAllPlans() {
    try {
      const response = await axios.get(API_URL, { headers: authHeader() });
      return response.data;
    } catch (error) {
      console.error('プラン一覧取得エラー:', error);
      throw error;
    }
  }

  /**
   * プラン詳細を取得
   * @param {string} id プランID
   * @returns {Promise} プラン詳細
   */
  async getPlanById(id) {
    try {
      // IDのバリデーション強化
      if (!id) {
        throw new Error('プランIDが指定されていません');
      }
      
      // 新規モードの特別処理
      if (id === 'new') {
        // 新規プラン用のデフォルト値を返す
        return {
          name: '',
          accessLevel: 'basic',
          monthlyTokenLimit: 100000,
          dailyTokenLimit: null,
          concurrentRequestLimit: 5,
          allowedModels: ['sonnet'],
          description: '',
          isActive: true
        };
      }
      
      if (id === 'undefined' || id === 'null') {
        throw new Error('有効なプランIDが指定されていません');
      }
      
      const response = await axios.get(`${API_URL}/${id}`, { headers: authHeader() });
      return response.data;
    } catch (error) {
      console.error('プラン詳細取得エラー:', error);
      throw error;
    }
  }

  /**
   * プランを作成
   * @param {Object} planData プラン情報
   * @returns {Promise} 作成結果
   */
  async createPlan(planData) {
    try {
      console.log('新規プラン作成APIリクエスト:', planData);
      console.log('API URL:', API_URL);
      console.log('認証ヘッダー:', authHeader());
      
      // データの整形（型変換と不要フィールド削除）
      const cleanData = { ...planData };
      
      // _idがある場合は削除（新規作成時は不要）
      if (cleanData._id) {
        delete cleanData._id;
      }
      
      // 数値フィールドの型変換を確実に
      if (cleanData.monthlyTokenLimit) {
        cleanData.monthlyTokenLimit = Number(cleanData.monthlyTokenLimit);
      }
      
      if (cleanData.dailyTokenLimit) {
        cleanData.dailyTokenLimit = Number(cleanData.dailyTokenLimit);
      } else if (cleanData.dailyTokenLimit === '') {
        cleanData.dailyTokenLimit = null;
      }
      
      if (cleanData.concurrentRequestLimit) {
        cleanData.concurrentRequestLimit = Number(cleanData.concurrentRequestLimit);
      }
      
      console.log('クリーニング後のデータ:', cleanData);
      
      const response = await axios.post(API_URL, cleanData, { 
        headers: authHeader(),
        timeout: 10000 // 10秒のタイムアウト設定
      });
      
      console.log('新規プラン作成APIレスポンス:', response.data);
      return response.data;
    } catch (error) {
      console.error('プラン作成エラー:', error);
      
      if (error.response) {
        // サーバーからのレスポンスがある場合
        console.error('サーバーエラー状態コード:', error.response.status);
        console.error('サーバーエラーデータ:', error.response.data);
        console.error('サーバーエラーヘッダー:', error.response.headers);
      } else if (error.request) {
        // リクエストは送信されたが、レスポンスがない場合
        console.error('リクエストエラー:', error.request);
      } else {
        // リクエスト設定中にエラーが発生した場合
        console.error('エラーメッセージ:', error.message);
      }
      
      throw error;
    }
  }

  /**
   * プランを更新
   * @param {string} id プランID
   * @param {Object} planData 更新情報
   * @returns {Promise} 更新結果
   */
  async updatePlan(id, planData) {
    try {
      console.log(`プラン更新APIリクエスト: ID=${id}`, planData);
      
      // 新規モードとIDなしの処理改善
      if (!id || id === 'new' || id === 'undefined' || id === 'null') {
        console.log('ID指定なし/新規モードのため、createPlanメソッドを代わりに呼び出します');
        return this.createPlan(planData);
      }
      
      // プランデータの整理（必要に応じて）
      const cleanData = { ...planData };
      
      // APIリクエスト
      const response = await axios.put(`${API_URL}/${id}`, cleanData, { headers: authHeader() });
      console.log('プラン更新APIレスポンス:', response.data);
      return response.data;
    } catch (error) {
      console.error('プラン更新エラー:', error);
      console.error('レスポンス詳細:', error.response?.data || '詳細なし');
      throw error;
    }
  }

  /**
   * プランを削除
   * @param {string} id プランID
   * @returns {Promise} 削除結果
   */
  async deletePlan(id) {
    try {
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('有効なプランIDが指定されていません');
      }
      
      const response = await axios.delete(`${API_URL}/${id}`, { headers: authHeader() });
      return response.data;
    } catch (error) {
      console.error('プラン削除エラー:', error);
      throw error;
    }
  }

  /**
   * デフォルトプランを初期化
   * @param {boolean} force 強制初期化フラグ
   * @returns {Promise} 初期化結果
   */
  async initializeDefaultPlans(force = false) {
    try {
      console.log(`デフォルトプラン初期化を実行 (force=${force})`);
      
      // URLを正しく構築
      const url = force 
        ? `${API_URL}/initialize?force=true` 
        : `${API_URL}/initialize`;
      
      console.log(`リクエストURL: ${url}`);
      
      const response = await axios.post(
        url, 
        {}, 
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      console.error('デフォルトプラン初期化エラー:', error);
      console.error('レスポンス:', error.response?.data);
      throw error;
    }
  }

  /**
   * ユーザーのプラン設定を更新
   * @param {string} userId ユーザーID
   * @param {string} accessLevel アクセスレベル
   * @returns {Promise} 更新結果
   */
  async setUserPlan(userId, accessLevel) {
    try {
      const response = await axios.post(
        `${API_URL}/users/${userId}`,
        { accessLevel },
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      console.error('ユーザープラン設定エラー:', error);
      throw error;
    }
  }
}

export default new PlanService();