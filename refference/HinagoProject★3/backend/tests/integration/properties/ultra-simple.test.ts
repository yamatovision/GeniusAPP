/**
 * 非常に単純なテスト
 * MongoDBへの接続とモデルの基本機能のみをテスト
 */
import mongoose from 'mongoose';
import { 
  connectTestDB, 
  disconnectTestDB, 
  clearTestCollections,
  createTestUser,
  createTestOrganization,
  createTestProperty
} from '../../utils/db-test-helper';
import { Organization, User, Property } from '../../../src/db/models';

// テストタイムアウトを60秒に設定
jest.setTimeout(60000);

// テスト前の準備
beforeAll(async () => {
  await connectTestDB();
  console.log('DB接続状態:', mongoose.connection.readyState);
  
  // コレクション一覧を確認
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('利用可能なコレクション:', collections.map(c => c.name).join(', '));
});

// テスト後のクリーンアップ
afterAll(async () => {
  await disconnectTestDB();
});

// テストケース間のデータクリーンアップ
beforeEach(async () => {
  await clearTestCollections();
});

describe('基本的なモデル動作テスト', () => {
  it('組織を作成できること', async () => {
    // テスト用組織を作成
    const org = await createTestOrganization('テスト組織ABC');
    
    // 検証
    expect(org).toBeDefined();
    expect(org._id).toBeDefined();
    expect(org.name).toContain('テスト組織ABC');
    
    // データベースから読み取り
    const savedOrg = await Organization.findById(org._id);
    expect(savedOrg).toBeDefined();
    expect(savedOrg!.name).toBe(org.name);
  });
  
  it('ユーザーを作成できること', async () => {
    // テスト用組織とユーザーを作成
    const org = await createTestOrganization();
    const user = await createTestUser({ 
      organizationId: org._id,
      name: 'テストユーザーXYZ'
    });
    
    // 検証
    expect(user).toBeDefined();
    expect(user._id).toBeDefined();
    expect(user.name).toBe('テストユーザーXYZ');
    expect(user.organizationId.toString()).toBe(org._id.toString());
    
    // データベースから読み取り
    const savedUser = await User.findById(user._id);
    expect(savedUser).toBeDefined();
    expect(savedUser!.name).toBe(user.name);
    expect(savedUser!.organizationId.toString()).toBe(org._id.toString());
  });
  
  it('物件を作成できること', async () => {
    // テスト用組織と物件を作成
    const org = await createTestOrganization();
    const property = await createTestProperty({
      name: 'テスト物件123',
      organizationId: org._id
    });
    
    // 検証
    expect(property).toBeDefined();
    expect(property._id).toBeDefined();
    expect(property.name).toBe('テスト物件123');
    expect(property.organizationId.toString()).toBe(org._id.toString());
    
    // データベースから読み取り
    const savedProperty = await Property.findById(property._id);
    expect(savedProperty).toBeDefined();
    expect(savedProperty!.name).toBe(property.name);
    expect(savedProperty!.organizationId.toString()).toBe(org._id.toString());
  });
});