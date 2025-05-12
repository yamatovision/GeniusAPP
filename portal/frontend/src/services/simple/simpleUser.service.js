import axios from 'axios';
import simpleAuthHeader from '../../utils/simple-auth-header';

// APIのベースURL
// API URLガイドラインに従い、/apiプレフィックスは省略
const API_SIMPLE_URL = '/simple';

/**
 * シンプル版のユーザー関連サービス
 */

// ユーザー一覧を取得（全ユーザー）
export const getUsers = async () => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/users`, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// 組織のユーザー一覧を取得
export const getSimpleOrganizationUsers = async (organizationId) => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users`, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// 新規ユーザーを作成
export const createUser = async (name, email, password, role, organizationId = null) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/users`, 
      { name, email, password, role, organizationId }, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// 組織にユーザーを追加（新規ユーザー作成）
export const addSimpleOrganizationUser = async (organizationId, name, email, password, role, apiKeyId = null) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users`, 
      { name, email, password, role, apiKeyId }, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// ユーザーを削除
export const deleteUser = async (userId) => {
  try {
    console.log(`deleteUser: ユーザー削除リクエスト開始 - ID: ${userId}`);

    // オプションでタイムアウトを指定
    const response = await axios.delete(
      `${API_SIMPLE_URL}/users/${userId}`,
      {
        headers: simpleAuthHeader(),
        timeout: 10000 // 10秒のタイムアウト
      }
    );

    console.log(`deleteUser: サーバーレスポンス - ステータス: ${response.status}`);
    console.log(`deleteUser: レスポンスデータ:`, response.data);

    return response.data;
  } catch (error) {
    console.error(`deleteUser: エラー発生 - `, error);

    // エラーの詳細情報をログ出力
    if (error.response) {
      console.error(`deleteUser: サーバーエラーレスポンス - ステータス: ${error.response.status}`);
      console.error(`deleteUser: エラー詳細:`, error.response.data);
      throw error.response.data;
    }

    if (error.request) {
      console.error(`deleteUser: リクエストは送信されましたが、レスポンスがありません`);
    }

    throw new Error('接続エラーが発生しました');
  }
};

// ユーザーを削除（組織から削除）
export const removeSimpleOrganizationUser = async (organizationId, userId) => {
  try {
    const response = await axios.delete(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users/${userId}`, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// ユーザーの詳細を取得
export const getSimpleUser = async (userId) => {
  try {
    const response = await axios.get(
      `${API_SIMPLE_URL}/users/${userId}`, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// ユーザー情報を更新
export const updateUser = async (userId, name, email, password = null, apiKeyId = null) => {
  try {
    const data = { name, email };
    
    // パスワードが提供された場合のみ含める
    if (password) {
      data.password = password;
    }
    
    // APIキーIDが提供された場合のみ含める
    if (apiKeyId) {
      data.apiKeyId = apiKeyId;
    }
    
    const response = await axios.put(
      `${API_SIMPLE_URL}/users/${userId}`, 
      data, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// 後方互換性のためのエイリアス - updateSimpleUser
export const updateSimpleUser = updateUser;

// ユーザーのパスワードを変更
export const changeSimpleUserPassword = async (userId, currentPassword, newPassword) => {
  try {
    const response = await axios.put(
      `${API_SIMPLE_URL}/users/${userId}/password`, 
      { currentPassword, newPassword }, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// ユーザーの役割を更新
export const updateUserRole = async (organizationId, userId, role) => {
  try {
    const response = await axios.put(
      `${API_SIMPLE_URL}/organizations/${organizationId}/users/${userId}/role`, 
      { role }, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};

// 後方互換性のためのエイリアス - updateSimpleUserRole
export const updateSimpleUserRole = updateUserRole;

// ClaudeCode起動カウンターをインクリメント
export const incrementClaudeCodeLaunchCount = async (userId) => {
  try {
    const response = await axios.post(
      `${API_SIMPLE_URL}/users/${userId}/increment-claude-code-launch`, 
      {}, 
      { headers: simpleAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw new Error('接続エラーが発生しました');
  }
};