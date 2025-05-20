/**
 * 物件管理機能の統合テスト
 */
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../../src/app';
import { 
  connectTestDB, 
  disconnectTestDB, 
  clearTestCollections,
  createTestUser,
  createTestOrganization,
  createTestProperty
} from '../../utils/db-test-helper';
import { generateAuthToken, getAuthHeader } from '../../utils/test-auth-helper';
import { ZoneType, FireZone, ShadowRegulation, PropertyStatus } from '../../../src/types';

// テスト前の準備
beforeAll(async () => {
  await connectTestDB();
}, 10000); // 10秒のタイムアウト設定

// テスト後のクリーンアップ
afterAll(async () => {
  await disconnectTestDB();
}, 10000); // 10秒のタイムアウト設定

// テストケース間のデータクリーンアップ
beforeEach(async () => {
  await clearTestCollections();
});

// 全体のテストタイムアウト設定を30秒から1分に延長
jest.setTimeout(60000);

describe('物件管理API統合テスト', () => {
  
  describe('GET /api/properties', () => {
    it('認証済みユーザーが自組織の物件一覧を取得できること', async () => {
      // テスト用組織を作成
      const org = await createTestOrganization('テスト組織1');
      
      // テスト用ユーザーを作成
      const user = await createTestUser({
        email: 'test1@example.com',
        organizationId: org._id
      });
      
      // 組織に属する物件を複数作成
      const property1 = await createTestProperty({
        name: 'テスト物件1',
        organizationId: org._id
      });
      
      const property2 = await createTestProperty({
        name: 'テスト物件2',
        organizationId: org._id
      });
      
      // 別組織に属する物件を作成
      const otherOrg = await createTestOrganization('別組織');
      await createTestProperty({
        name: '別組織の物件',
        organizationId: otherOrg._id
      });
      
      // 認証トークンを生成
      const accessToken = await generateAuthToken(user);
      
      // APIリクエスト
      const response = await request(app)
        .get('/api/properties')
        .set(getAuthHeader(accessToken));
      
      // レスポンスの検証
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((p: any) => p.name)).toContain('テスト物件1');
      expect(response.body.data.map((p: any) => p.name)).toContain('テスト物件2');
      expect(response.body.data.map((p: any) => p.name)).not.toContain('別組織の物件');
    });
    
    it('認証なしで物件一覧にアクセスすると401エラーになること', async () => {
      // 認証なしでAPIリクエスト
      const response = await request(app)
        .get('/api/properties');
      
      // レスポンスの検証
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('フィルタリングパラメータで物件を絞り込めること', async () => {
      // テスト用組織とユーザーを作成
      const org = await createTestOrganization();
      const user = await createTestUser({ organizationId: org._id });
      
      // 異なる種類の物件を作成
      await createTestProperty({
        name: '商業エリア物件',
        zoneType: ZoneType.CATEGORY9,
        status: PropertyStatus.NEW,
        organizationId: org._id
      });
      
      await createTestProperty({
        name: '住宅エリア物件',
        zoneType: ZoneType.CATEGORY1,
        status: PropertyStatus.NEGOTIATING,
        organizationId: org._id
      });
      
      // 認証トークンを生成
      const accessToken = await generateAuthToken(user);
      
      // 用途地域でフィルタリング
      const response1 = await request(app)
        .get('/api/properties?zoneType=category9')
        .set(getAuthHeader(accessToken));
      
      expect(response1.status).toBe(200);
      expect(response1.body.data).toHaveLength(1);
      expect(response1.body.data[0].name).toBe('商業エリア物件');
      
      // ステータスでフィルタリング
      const response2 = await request(app)
        .get('/api/properties?status=negotiating')
        .set(getAuthHeader(accessToken));
      
      expect(response2.status).toBe(200);
      expect(response2.body.data).toHaveLength(1);
      expect(response2.body.data[0].name).toBe('住宅エリア物件');
    });
  });
  
  describe('GET /api/properties/:id', () => {
    it('認証済みユーザーが自組織の物件詳細を取得できること', async () => {
      // テスト用組織とユーザーを作成
      const org = await createTestOrganization();
      const user = await createTestUser({ organizationId: org._id });
      
      // テスト用物件を作成
      const property = await createTestProperty({
        name: 'テスト物件詳細',
        organizationId: org._id,
        shapeData: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ],
          width: 10,
          depth: 10
        }
      });
      
      // 認証トークンを生成
      const accessToken = await generateAuthToken(user);
      
      // APIリクエスト
      const response = await request(app)
        .get(`/api/properties/${property._id}`)
        .set(getAuthHeader(accessToken));
      
      // レスポンスの検証
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('テスト物件詳細');
      expect(response.body.data.organizationId.toString()).toBe(org._id.toString());
      expect(response.body.data.shapeData).toBeDefined();
      expect(response.body.data.shapeData.points).toHaveLength(4);
    });
    
    it('他組織の物件詳細にアクセスすると404エラーになること', async () => {
      // 2つの組織とユーザーを作成
      const org1 = await createTestOrganization('組織1');
      const user1 = await createTestUser({ 
        email: 'user1@example.com',
        organizationId: org1._id 
      });
      
      const org2 = await createTestOrganization('組織2');
      
      // 組織2に属する物件を作成
      const property = await createTestProperty({
        name: '組織2の物件',
        organizationId: org2._id
      });
      
      // 組織1のユーザーで認証
      const accessToken = await generateAuthToken(user1);
      
      // 組織2の物件にアクセス
      const response = await request(app)
        .get(`/api/properties/${property._id}`)
        .set(getAuthHeader(accessToken));
      
      // レスポンスの検証
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
  
  // POST /api/properties テスト - テストコントローラーを使用
  it('認証済みユーザーが新規物件を作成できること', async () => {
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ organizationId: org._id });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // 不足した物件データ（必要な情報が不足）
    const incompleteProperty = {
      name: '不十分な物件',
      // addressが欠落
      area: 500
      // zoneTypeが欠落
    };
    
    // まずバリデーションエラーのテスト（422エラーを期待）
    const errorResponse = await request(app)
      .post('/api/properties')
      .set(getAuthHeader(accessToken))
      .send(incompleteProperty);
    
    // バリデーションエラーの確認
    expect(errorResponse.status).toBe(422);
    expect(errorResponse.body.success).toBe(false);
    
    // 正しい物件データ
    const validProperty = {
      name: '新規テスト物件',
      address: '福岡市中央区天神1-1-1',
      area: 500,
      zoneType: ZoneType.CATEGORY1 // 必要最小限のパラメーター
    };
    
    // 正しいリクエストの送信
    const successResponse = await request(app)
      .post('/api/properties')
      .set(getAuthHeader(accessToken))
      .send(validProperty);
    
    // 成功レスポンスの確認
    expect(successResponse.status).toBe(201);
    expect(successResponse.body.success).toBe(true);
    expect(successResponse.body.data.name).toBe('新規テスト物件');
    expect(successResponse.body.data.address).toBe('福岡市中央区天神1-1-1');
    
    // IDと組織IDが設定されていることを確認
    expect(successResponse.body.data.id).toBeDefined();
    expect(successResponse.body.data.organizationId).toBeDefined();
  });
  
  it('必須フィールドが不足していると422エラーになること', async () => {
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ organizationId: org._id });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // 不完全な物件データ（必須フィールドが欠落）
    const incompleteProperty = {
      name: '不完全な物件',
      // address: 欠落
      area: 500,
      // zoneType: 欠落
      fireZone: FireZone.NONE
    };
    
    // APIリクエスト
    const response = await request(app)
      .post('/api/properties')
      .set(getAuthHeader(accessToken))
      .send(incompleteProperty);
    
    // レスポンスの検証
    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  
  // PUT /api/properties/:id テスト
  it('認証済みユーザーが自組織の物件を更新できること', async () => {
    
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ organizationId: org._id });
    
    // テスト用物件を作成
    const property = await createTestProperty({
      name: '更新前物件名',
      address: '福岡市中央区天神1-1-1',
      organizationId: org._id
    });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // 更新データ
    const updatedData = {
      name: '更新後物件名',
      address: '福岡市中央区大名2-2-2',
      status: PropertyStatus.NEGOTIATING
    };
    
    // APIリクエスト
    const response = await request(app)
      .put(`/api/properties/${property._id}`)
      .set(getAuthHeader(accessToken))
      .send(updatedData);
    
    // レスポンスの検証
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('更新後物件名');
    expect(response.body.data.address).toBe('福岡市中央区大名2-2-2');
    expect(response.body.data.status).toBe(PropertyStatus.NEGOTIATING);
    
    // データベースでも更新されていることを確認
    const updatedProperty = await mongoose.model('Property').findById(property._id);
    expect(updatedProperty.name).toBe('更新後物件名');
  });
  
  it('他組織の物件を更新しようとすると404エラーになること', async () => {
    
    // 2つの組織とユーザーを作成
    const org1 = await createTestOrganization('組織1');
    const user1 = await createTestUser({ 
      email: 'user1@example.com',
      organizationId: org1._id 
    });
    
    const org2 = await createTestOrganization('組織2');
    
    // 組織2に属する物件を作成
    const property = await createTestProperty({
      name: '組織2の物件',
      organizationId: org2._id
    });
    
    // 組織1のユーザーで認証
    const accessToken = await generateAuthToken(user1);
    
    // 更新データ
    const updatedData = {
      name: '更新しようとした物件名'
    };
    
    // 組織2の物件を更新しようとする
    const response = await request(app)
      .put(`/api/properties/${property._id}`)
      .set(getAuthHeader(accessToken))
      .send(updatedData);
    
    // レスポンスの検証
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    
    // データベースでも更新されていないことを確認
    const unchangedProperty = await mongoose.model('Property').findById(property._id);
    expect(unchangedProperty.name).toBe('組織2の物件');
  });
  
  // PATCH /api/properties/:id テスト
  it('認証済みユーザーが自組織の物件を部分的に更新できること', async () => {
    
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ organizationId: org._id });
    
    // テスト用物件を作成
    const property = await createTestProperty({
      name: '部分更新テスト',
      price: 100000000,
      organizationId: org._id
    });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // 部分更新データ（価格のみ）
    const patchData = {
      price: 120000000
    };
    
    // APIリクエスト
    const response = await request(app)
      .patch(`/api/properties/${property._id}`)
      .set(getAuthHeader(accessToken))
      .send(patchData);
    
    // レスポンスの検証
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.price).toBe(120000000);
    
    // レスポンスには更新フィールドのみ含まれていること
    expect(response.body.data).not.toHaveProperty('name');
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('updatedAt');
    
    // データベースでも更新されていることを確認
    const updatedProperty = await mongoose.model('Property').findById(property._id);
    expect(updatedProperty.price).toBe(120000000);
    expect(updatedProperty.name).toBe('部分更新テスト'); // 未更新項目は変わっていない
  });
  
  // DELETE /api/properties/:id テスト
  it('認証済みユーザーが自組織の物件を論理削除できること', async () => {
    
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ organizationId: org._id });
    
    // テスト用物件を作成
    const property = await createTestProperty({
      name: '削除テスト物件',
      organizationId: org._id
    });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // APIリクエスト（削除）
    const response = await request(app)
      .delete(`/api/properties/${property._id}`)
      .set(getAuthHeader(accessToken));
    
    // レスポンスの検証
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.deleted).toBe(true);
    
    // データベースで論理削除されていることを確認
    const deletedProperty = await mongoose.model('Property').findById(property._id);
    expect(deletedProperty.isDeleted).toBe(true);
    
    // 物件一覧に表示されなくなっていることを確認
    const listResponse = await request(app)
      .get('/api/properties')
      .set(getAuthHeader(accessToken));
    
    expect(listResponse.body.data).toHaveLength(0);
  });
  
  // PUT /api/properties/:id/shape テスト
  it('認証済みユーザーが自組織の物件の敷地形状を更新できること', async () => {
    
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ organizationId: org._id });
    
    // テスト用物件を作成（形状なし）
    const property = await createTestProperty({
      name: '形状更新テスト',
      organizationId: org._id
    });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // 敷地形状データ
    const shapeData = {
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 25 },
        { x: 0, y: 25 }
      ],
      width: 20,
      depth: 25
    };
    
    // APIリクエスト（形状更新）
    const response = await request(app)
      .put(`/api/properties/${property._id}/shape`)
      .set(getAuthHeader(accessToken))
      .send(shapeData);
    
    // レスポンスの検証
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.shapeData.points).toHaveLength(4);
    expect(response.body.data.shapeData.width).toBe(20);
    expect(response.body.data.shapeData.depth).toBe(25);
    
    // データベースでも更新されていることを確認
    const updatedProperty = await mongoose.model('Property').findById(property._id);
    expect(updatedProperty.shapeData.points).toHaveLength(4);
  });
  
  // GET /api/properties/:id/history テスト
  it('認証済みユーザーが自組織の物件の履歴を取得できること', async () => {
    
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ organizationId: org._id });
    
    // テスト用物件を作成
    const property = await createTestProperty({
      name: '履歴テスト物件',
      organizationId: org._id
    });
    
    // 認証トークンを生成
    const accessToken = await generateAuthToken(user);
    
    // 物件を更新して履歴を作成（1回目）
    await request(app)
      .patch(`/api/properties/${property._id}`)
      .set(getAuthHeader(accessToken))
      .send({ name: '履歴テスト物件（改名）' });
    
    // 物件を更新して履歴を作成（2回目）
    await request(app)
      .patch(`/api/properties/${property._id}`)
      .set(getAuthHeader(accessToken))
      .send({ status: PropertyStatus.NEGOTIATING });
    
    // 履歴を取得
    const historyResponse = await request(app)
      .get(`/api/properties/${property._id}/history`)
      .set(getAuthHeader(accessToken));
    
    // レスポンスの検証
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);
    expect(historyResponse.body.data).toHaveLength(2);
  });
});