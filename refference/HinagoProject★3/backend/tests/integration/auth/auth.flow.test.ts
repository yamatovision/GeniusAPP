/**
 * 認証APIの統合テスト
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../src/app';
import config from '../../../src/config';
import { 
  createTestUser, 
  createTestOrganization, 
  createTestRefreshToken 
} from '../../utils/db-test-helper';
import { getAuthHeader } from '../../utils/test-auth-helper';
import { API_PATHS } from '../../../src/types';

describe('認証API', () => {
  describe('ユーザー登録フロー', () => {
    it('有効なデータでユーザーを登録できる', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'Password123',
        name: '新規ユーザー',
        organizationName: '新規組織',
      };
      
      const response = await request(app)
        .post(API_PATHS.AUTH.REGISTER)
        .send(registerData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(registerData.email);
      expect(response.body.data.user.name).toBe(registerData.name);
    });
    
    it('既存のメールアドレスで登録するとエラーになる', async () => {
      const email = 'existing@example.com';
      await createTestUser(email);
      
      const registerData = {
        email,
        password: 'Password123',
        name: '重複ユーザー',
        organizationName: '重複組織',
      };
      
      const response = await request(app)
        .post(API_PATHS.AUTH.REGISTER)
        .send(registerData)
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_ALREADY_EXISTS');
    });
    
    it('不正なデータで登録するとバリデーションエラーになる', async () => {
      // メールアドレスが不正
      const invalidEmailData = {
        email: 'invalid-email',
        password: 'Password123',
        name: 'バリデーションテスト',
        organizationName: 'テスト組織',
      };
      
      const emailResponse = await request(app)
        .post(API_PATHS.AUTH.REGISTER)
        .send(invalidEmailData)
        .expect(422);
      
      expect(emailResponse.body.success).toBe(false);
      expect(emailResponse.body.error.code).toBe('VALIDATION_ERROR');
      
      // パスワードが短すぎる
      const shortPasswordData = {
        email: 'valid@example.com',
        password: 'short',
        name: 'バリデーションテスト',
        organizationName: 'テスト組織',
      };
      
      const passwordResponse = await request(app)
        .post(API_PATHS.AUTH.REGISTER)
        .send(shortPasswordData)
        .expect(422);
      
      expect(passwordResponse.body.success).toBe(false);
      expect(passwordResponse.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('ログインフロー', () => {
    it('正しい認証情報でログインできる', async () => {
      const email = 'login@example.com';
      const password = 'Password123';
      await createTestUser(email, password);
      
      const loginData = {
        email,
        password,
      };
      
      const response = await request(app)
        .post(API_PATHS.AUTH.LOGIN)
        .send(loginData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(email);
    });
    
    it('存在しないユーザーではログインできない', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123',
      };
      
      const response = await request(app)
        .post(API_PATHS.AUTH.LOGIN)
        .send(loginData)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
    
    it('パスワードが間違っているとログインできない', async () => {
      const email = 'wrongpassword@example.com';
      await createTestUser(email, 'Correct123Password');
      
      const loginData = {
        email,
        password: 'Wrong123Password',
      };
      
      const response = await request(app)
        .post(API_PATHS.AUTH.LOGIN)
        .send(loginData)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
  
  describe('認証済みユーザー情報取得', () => {
    it('有効なトークンで自分のユーザー情報を取得できる', async () => {
      const user = await createTestUser();
      const accessToken = jwt.sign(
        { 
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          organizationId: user.organizationId.toString()
        }, 
        config.auth.jwt.secret,
        { expiresIn: '15m' }
      );
      
      const response = await request(app)
        .get(API_PATHS.AUTH.ME)
        .set(getAuthHeader(accessToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user.organization).toBeDefined();
    });
    
    it('認証なしでユーザー情報にアクセスできない', async () => {
      const response = await request(app)
        .get(API_PATHS.AUTH.ME)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });
  });
  
  // TODO: トークン更新、ログアウト、パスワードリセットのテスト
});