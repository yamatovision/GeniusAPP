import axios from 'axios';
import authHeader from '../../utils/auth-header';

// APIのベースURL
// API URLガイドラインに従い、/apiプレフィックスは省略
const API_SIMPLE_URL = '/simple';

/**
 * シンプル版の組織関連サービス
 */

// 組織一覧を取得
export const getSimpleOrganizations = async () => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/organizations`, 
      { headers: authHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// 組織の詳細を取得
export const getSimpleOrganization = async (organizationId) => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/organizations/${organizationId}`, 
      { headers: authHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// 組織を作成
export const createSimpleOrganization = async (name, description, workspaceName) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/organizations`, 
      { name, description, workspaceName }, 
      { headers: authHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// 組織を更新
export const updateSimpleOrganization = async (organizationId, name, description, workspaceName) => {
  try {
    const response = await axios.put(
      `${API_SIMPLE_URL}/organizations/${organizationId}`, 
      { name, description, workspaceName }, 
      { headers: authHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// 組織を削除
export const deleteSimpleOrganization = async (organizationId) => {
  try {
    const response = await axios.delete(
      `${API_SIMPLE_URL}/organizations/${organizationId}`, 
      { headers: authHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// ワークスペースを作成
export const createSimpleWorkspace = async (organizationId) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/organizations/${organizationId}/create-workspace`, 
      {}, // リクエストボディは空でOK
      { headers: authHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};