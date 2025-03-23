import axios from 'axios';
import authHeader from '../../utils/auth-header';

// APIのベースURL
const API_URL = process.env.REACT_APP_API_URL || '/api';

const API_SIMPLE_URL = `${API_URL}/simple`;

/**
 * シンプル版のユーザー関連サービス
 */

// 組織のユーザー一覧を取得
export const getSimpleOrganizationUsers = async (organizationId) => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users`, 
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

// 組織にユーザーを追加（新規ユーザー作成）
export const addSimpleOrganizationUser = async (organizationId, name, email, password, role) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users`, 
      { name, email, password, role }, 
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

// ユーザーを削除（組織から削除）
export const removeSimpleOrganizationUser = async (organizationId, userId) => {
  try {
    const response = await axios.delete(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users/${userId}`, 
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

// ユーザーの詳細を取得
export const getSimpleUser = async (userId) => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/users/${userId}`, 
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

// ユーザー情報を更新
export const updateSimpleUser = async (userId, name, email) => {
  try {
    const response = await axios.put(
      `${API_SIMPLE_URL}/users/${userId}`, 
      { name, email }, 
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

// ユーザーのパスワードを変更
export const changeSimpleUserPassword = async (userId, currentPassword, newPassword) => {
  try {
    const response = await axios.put(
      `${API_SIMPLE_URL}/users/${userId}/password`, 
      { currentPassword, newPassword }, 
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

// ユーザーの役割を更新
export const updateSimpleUserRole = async (organizationId, userId, role) => {
  try {
    const response = await axios.put(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users/${userId}/role`, 
      { role }, 
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