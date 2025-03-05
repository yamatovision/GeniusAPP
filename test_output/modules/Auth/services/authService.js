/**
 * 認証関連のサービス
 * APIとの通信や、トークンの管理を担当
 */
class AuthService {
  /**
   * ログイン処理
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   * @returns {Promise} - ログイン結果
   */
  async login(email, password) {
    try {
      const response = await this.api.post('/auth/login', { email, password });
      this.saveToken(response.data.token);
      return response.data;
    } catch (error) {
      console.error('ログイン処理中にエラーが発生しました', error);
      throw error;
    }
  }

  /**
   * トークンを保存
   * @param {string} token - JWTトークン
   */
  saveToken(token) {
    localStorage.setItem('auth_token', token);
  }
}

export default new AuthService();