/**
 * ユーザー管理API フローテスト
 */
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../../src/app';
import User from '../../../src/db/models/User';
import Organization from '../../../src/db/models/Organization';
import { connectTestDB, disconnectTestDB, clearTestCollections } from '../../utils/db-test-helper';
import { generateAuthToken } from '../../utils/test-auth-helper';
import { createTestUser } from '../../utils/db-test-helper';
import { UserRole, SubscriptionType } from '../../../src/types';

describe('ユーザー管理API 統合テスト', () => {
  let testUser: any;
  let anotherUser: any;
  let testOrg: any;
  let authToken: string;

  beforeEach(async () => {
    await clearTestCollections();

    // テスト組織を作成
    testOrg = new Organization({
      name: 'テスト組織',
      subscription: SubscriptionType.FREE,
    });
    await testOrg.save();

    // テストユーザーを作成
    testUser = await createTestUser({
      email: 'test@example.com',
      password: 'Test1234!',
      name: 'テストユーザー',
      role: UserRole.USER,
      organizationId: testOrg.id,
    });

    // 別のテストユーザーを作成
    anotherUser = await createTestUser({
      email: 'another@example.com',
      password: 'Test1234!',
      name: '別のユーザー',
      role: UserRole.USER,
      organizationId: testOrg.id,
    });

    // 認証トークンを生成
    authToken = await generateAuthToken(testUser);
  });

  describe('GET /api/users - ユーザー一覧取得', () => {
    it('認証がある場合、自組織のユーザー一覧を取得できること', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
      
      // ユーザー情報が正しいことを確認
      const users = response.body.data;
      const userEmails = users.map((u: any) => u.email);
      expect(userEmails).toContain(testUser.email);
      expect(userEmails).toContain(anotherUser.email);
    });

    it('認証がない場合、401エラーが返されること', async () => {
      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('検索パラメータで名前によるフィルタリングができること', async () => {
      const response = await request(app)
        .get('/api/users?search=another')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email).toBe(anotherUser.email);
    });
  });

  describe('GET /api/users/:id - 特定ユーザー情報取得', () => {
    it('自組織のユーザー情報を取得できること', async () => {
      const response = await request(app)
        .get(`/api/users/${anotherUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(anotherUser.id);
      expect(response.body.data.name).toBe(anotherUser.name);
      expect(response.body.data.email).toBe(anotherUser.email);
    });

    it('存在しないユーザーIDの場合、404エラーが返されること', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('PUT /api/users/:id - ユーザー情報更新', () => {
    it('自分自身の情報を更新できること', async () => {
      const updatedName = 'Updated Name';
      const response = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: updatedName });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updatedName);

      // データベースの値が更新されたことを確認
      const updatedUser = await User.findById(testUser.id);
      expect(updatedUser!.name).toBe(updatedName);
    });

    it('他のユーザーの情報を更新しようとすると403エラーが返されること', async () => {
      const response = await request(app)
        .put(`/api/users/${anotherUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cannot Update' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('不正なデータ形式の場合、422エラーが返されること', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }); // 空の名前は不正

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/users/profile - 自身のプロフィール取得', () => {
    it('自身のプロフィール情報を取得できること', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it('認証がない場合、401エラーが返されること', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('PUT /api/users/profile - 自身のプロフィール更新', () => {
    it('自身のプロフィール情報を更新できること', async () => {
      const updateData = {
        name: 'プロフィール更新テスト',
        preferences: {
          theme: 'dark',
          notifications: {
            email: false,
            browser: true
          }
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.preferences).toEqual(updateData.preferences);
    });

    it('不正なデータ形式の場合、422エラーが返されること', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: {
            theme: 'invalid-theme' // 不正なテーマ値
          }
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});