import { 
  API_PATHS, 
  AuthResponse, 
  LoginData, 
  RegisterData, 
  PasswordResetRequest, 
  PasswordResetConfirm,
  User
} from '../../../../shared/index';
import api, { authStorage } from '@common/utils/api';

/**
 * 認証関連のAPI操作
 */
export const AuthAPI = {
  /**
   * ログイン処理
   * @param loginData ログイン情報
   */
  login: async (loginData: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(API_PATHS.AUTH.LOGIN, loginData);
    
    if (response.success && response.data) {
      const { user, token } = response.data;
      // トークンをローカルストレージに保存
      authStorage.saveTokens(
        token.token,
        token.refreshToken,
        token.expiresAt,
        loginData.rememberMe || false
      );
      return response.data;
    }
    
    throw new Error('ログインに失敗しました');
  },
  
  /**
   * ログアウト処理
   */
  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
      try {
        await api.post(API_PATHS.AUTH.LOGOUT, { refreshToken });
      } catch (error) {
        console.error('ログアウトエラー:', error);
      }
    }
    
    // トークンをローカルストレージから削除
    authStorage.clearTokens();
  },
  
  /**
   * ユーザー登録
   * @param registerData 登録情報
   */
  register: async (registerData: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(API_PATHS.AUTH.REGISTER, registerData);
    
    if (response.success && response.data) {
      const { user, token } = response.data;
      // トークンをローカルストレージに保存
      authStorage.saveTokens(
        token.token,
        token.refreshToken,
        token.expiresAt,
        false // 新規登録時はrememberMeをfalseに
      );
      return response.data;
    }
    
    throw new Error('ユーザー登録に失敗しました');
  },
  
  /**
   * パスワードリセット要求
   * @param resetData リセット要求情報
   */
  requestPasswordReset: async (resetData: PasswordResetRequest): Promise<void> => {
    const response = await api.post<void>(API_PATHS.AUTH.PASSWORD_RESET_REQUEST, resetData);
    
    if (!response.success) {
      throw new Error('パスワードリセット要求に失敗しました');
    }
  },
  
  /**
   * パスワードリセット確認
   * @param resetData リセット確認情報
   */
  confirmPasswordReset: async (resetData: PasswordResetConfirm): Promise<void> => {
    const response = await api.post<void>(API_PATHS.AUTH.PASSWORD_RESET_CONFIRM, resetData);
    
    if (!response.success) {
      throw new Error('パスワードリセットに失敗しました');
    }
  },
  
  /**
   * 現在のユーザー情報を取得
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>(API_PATHS.AUTH.ME);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error('ユーザー情報の取得に失敗しました');
  },
};

export default AuthAPI;