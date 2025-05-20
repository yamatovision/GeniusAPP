/**
 * 非常に単純なテスト
 */
import request from 'supertest';
import app from '../../../src/app';
import jwt from 'jsonwebtoken';
import { 
  connectTestDB, 
  disconnectTestDB, 
  clearTestCollections,
  createTestUser,
  createTestOrganization
} from '../../utils/db-test-helper';
import { getAuthHeader } from '../../utils/test-auth-helper';

// 直接テスト用トークンを生成する関数
const generateSimpleTestToken = (userId: string, organizationId: string) => {
  console.log('シンプルトークン生成', { userId, organizationId });
  
  // 固定の秘密鍵を使用
  const secret = '8f42a1d5c1e9b8a3f6d7e2c5b9a8d3f6'; // .envのJWT_SECRET
  
  const payload = {
    id: userId,
    email: 'test_direct@example.com',
    role: 'user',
    organizationId
  };
  
  return jwt.sign(payload, secret, { expiresIn: '1h' });
};

// テスト前の準備
beforeAll(async () => {
  await connectTestDB();
});

// テスト後のクリーンアップ
afterAll(async () => {
  await disconnectTestDB();
});

// テストケース間のデータクリーンアップ
beforeEach(async () => {
  await clearTestCollections();
});

// タイムアウトを短く設定（10秒）
jest.setTimeout(10000);

describe('基本的なテスト', () => {
  it('GET /api/properties に認証なしでアクセスすると401エラーになること', async () => {
    // 認証なしでAPIリクエスト
    const response = await request(app)
      .get('/api/properties');
    
    // レスポンスの検証
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
  
  it('認証ヘッダーが無効な場合は401エラーになること', async () => {
    // 無効な認証ヘッダーでリクエスト
    const invalidToken = 'invalid-token';
    const response = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${invalidToken}`);
    
    // レスポンスの検証
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
  
  it('テストエンドポイントにアクセスできること', async () => {
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization('test_endpoint_org');
    console.log('テスト組織を作成:', org._id.toString());
    
    const user = await createTestUser({
      email: 'test_endpoint@example.com',
      organizationId: org._id.toString()
    });
    console.log('テストユーザーを作成:', user._id.toString());
    
    // 直接トークンを生成
    const accessToken = generateSimpleTestToken(user._id.toString(), org._id.toString());
    
    // リクエストタイムアウトを5秒に設定
    const response = await request(app)
      .get('/api/properties/test')
      .set('Authorization', `Bearer ${accessToken}`)
      .timeout(5000);
    
    console.log('テストエンドポイント レスポンス:', response.status);
    if (response.body) {
      console.log('レスポンスボディ:', JSON.stringify(response.body));
    }
    
    // レスポンスの検証
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  it('認証済みユーザーが物件一覧（空）を取得できること', async () => {
    try {
      // テスト用組織とユーザーを作成
      const org = await createTestOrganization('test_simp_org');
      console.log('テスト組織を作成:', org._id.toString());
      
      const user = await createTestUser({
        email: 'test_simple@example.com',
        organizationId: org._id.toString()
      });
      console.log('テストユーザーを作成:', user._id.toString());
      
      // 直接トークンを生成（ヘルパー関数を使わず）
      const accessToken = generateSimpleTestToken(user._id.toString(), org._id.toString());
      console.log('シンプルテストトークンを生成');
      
      // トークンログ
      console.log('トークン:', accessToken.substring(0, 20) + '...');
      
      // APIリクエスト
      console.log('APIリクエスト開始');
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${accessToken}`)
        .timeout(5000); // 5秒でタイムアウト
      
      console.log('APIリクエスト完了:', response.status);
      
      // レスポンスの検証
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0); // 物件がまだないので空配列
    } catch (error) {
      console.error('テスト実行エラー:', error);
      throw error;
    }
  });
});