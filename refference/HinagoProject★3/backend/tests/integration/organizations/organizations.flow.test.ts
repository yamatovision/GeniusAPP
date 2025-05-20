/**
 * 組織管理API フローテスト
 */
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../../src/app';
import Organization from '../../../src/db/models/Organization';
import { connectTestDB, disconnectTestDB, clearTestCollections } from '../../utils/db-test-helper';
import { generateAuthToken } from '../../utils/test-auth-helper';
import { createTestUser } from '../../utils/db-test-helper';
import { UserRole, SubscriptionType } from '../../../src/types';

describe('組織管理API 統合テスト', () => {
  let testUser: any;
  let otherOrgUser: any;
  let testOrg: any;
  let otherOrg: any;
  let authToken: string;
  let otherAuthToken: string;

  beforeEach(async () => {
    await clearTestCollections();

    // テスト組織を作成
    testOrg = new Organization({
      name: 'テスト組織',
      subscription: SubscriptionType.FREE,
    });
    await testOrg.save();

    // 別の組織を作成
    otherOrg = new Organization({
      name: '別の組織',
      subscription: SubscriptionType.BASIC,
    });
    await otherOrg.save();

    // テストユーザーを作成
    testUser = await createTestUser({
      email: 'test@example.com',
      password: 'Test1234!',
      name: 'テストユーザー',
      role: UserRole.USER,
      organizationId: testOrg.id,
    });

    // 別の組織のユーザーを作成
    otherOrgUser = await createTestUser({
      email: 'other-org@example.com',
      password: 'Test1234!',
      name: '別組織ユーザー',
      role: UserRole.USER,
      organizationId: otherOrg.id,
    });

    // 認証トークンを生成
    authToken = await generateAuthToken(testUser);
    otherAuthToken = await generateAuthToken(otherOrgUser);
  });

  describe('GET /api/organizations/:id - 組織情報取得', () => {
    it('自分が所属する組織情報を取得できること', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testOrg.id);
      expect(response.body.data.name).toBe(testOrg.name);
      expect(response.body.data.subscription).toBe(testOrg.subscription);
      
      // 統計情報も含まれていることを確認
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.limits).toBeDefined();
    });

    it('他の組織情報を取得しようとすると403エラーが返されること', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('存在しない組織IDの場合、404エラーが返されること', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/organizations/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('PUT /api/organizations/:id - 組織情報更新', () => {
    it('自組織の情報を更新できること', async () => {
      const updatedName = 'Updated Organization Name';
      const response = await request(app)
        .put(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: updatedName });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updatedName);

      // データベースの値が更新されたことを確認
      const updatedOrg = await Organization.findById(testOrg.id);
      expect(updatedOrg!.name).toBe(updatedName);
    });

    it('他の組織の情報を更新しようとすると403エラーが返されること', async () => {
      const response = await request(app)
        .put(`/api/organizations/${otherOrg.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cannot Update' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('不正なデータ形式の場合、422エラーが返されること', async () => {
      const response = await request(app)
        .put(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }); // 空の組織名は不正

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('組織名が重複する場合、409エラーが返されること', async () => {
      // 別の組織と同じ名前に更新しようとする
      const response = await request(app)
        .put(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: otherOrg.name });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_NAME');
    });
  });

  describe('認証と権限の違いによるアクセス制御', () => {
    it('異なる組織のユーザーが互いの組織情報にアクセスできないこと', async () => {
      // testUserがotherOrgにアクセス
      const response1 = await request(app)
        .get(`/api/organizations/${otherOrg.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(403);
      
      // otherOrgUserがtestOrgにアクセス
      const response2 = await request(app)
        .get(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${otherAuthToken}`);

      expect(response2.status).toBe(403);
    });
  });
});