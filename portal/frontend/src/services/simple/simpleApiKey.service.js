import axios from 'axios';
import simpleAuthHeader from '../../utils/simple-auth-header';

// APIのベースURL
// API URLガイドラインに従い、/apiプレフィックスは省略
const API_SIMPLE_URL = '/simple';

/**
 * シンプル版のAPIキー関連サービス
 */

// 組織のAPIキー一覧を取得
export const getSimpleOrganizationApiKeys = async (organizationId) => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/organizations/${organizationId}/apikeys`, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// APIキーを追加
export const createSimpleApiKey = async (organizationId, keyValue) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/organizations/${organizationId}/apikeys`, 
      { keyValue }, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// APIキーを削除
export const deleteSimpleApiKey = async (organizationId, apiKeyId) => {
  try {
    const response = await axios.delete(
      `${API_SIMPLE_URL}/organizations/${organizationId}/apikeys/${apiKeyId}`, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// APIキーの詳細を取得
export const getSimpleApiKey = async (organizationId, apiKeyId) => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/organizations/${organizationId}/apikeys/${apiKeyId}`, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};