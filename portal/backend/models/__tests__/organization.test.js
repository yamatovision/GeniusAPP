const mongoose = require('mongoose');
const OrganizationModel = require('../organization.model');

// メモリ内のMongoDBサーバーに接続
beforeAll(async () => {
  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_db';
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// テスト後にデータベース接続を閉じる
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// 各テスト前にコレクションをクリア
beforeEach(async () => {
  await OrganizationModel.deleteMany({});
});

describe('Organization Model Test', () => {
  // 基本的な組織作成テスト
  it('should create and save organization successfully', async () => {
    const orgData = {
      name: 'Test Organization',
      anthropicOrgId: 'org_123456',
      adminUserId: 'user_123456',
      settings: {
        usageLimit: 1000000,
        alertThreshold: 80
      }
    };
    
    const validOrg = new OrganizationModel(orgData);
    const savedOrg = await validOrg.save();
    
    // ObjectIdを含むため、toObjectメソッドを使用して比較
    expect(savedOrg.name).toBe(orgData.name);
    expect(savedOrg.anthropicOrgId).toBe(orgData.anthropicOrgId);
    expect(savedOrg.adminUserId).toBe(orgData.adminUserId);
    expect(savedOrg.settings.usageLimit).toBe(orgData.settings.usageLimit);
    expect(savedOrg.settings.alertThreshold).toBe(orgData.settings.alertThreshold);
    expect(savedOrg.isActive).toBe(true); // デフォルト値のテスト
    expect(savedOrg.members).toEqual([]); // デフォルト値のテスト
    expect(savedOrg.createdAt).toBeDefined();
    expect(savedOrg.updatedAt).toBeDefined();
  });

  // 必須フィールドのバリデーションテスト
  it('should fail when required fields are missing', async () => {
    const orgWithoutName = new OrganizationModel({
      anthropicOrgId: 'org_123456',
      adminUserId: 'user_123456'
    });
    
    let err;
    try {
      await orgWithoutName.save();
    } catch (error) {
      err = error;
    }
    
    expect(err).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  // メンバー追加のテスト
  it('should add members to organization', async () => {
    const org = new OrganizationModel({
      name: 'Test Organization',
      anthropicOrgId: 'org_123456',
      adminUserId: 'user_123456'
    });
    
    await org.save();
    
    // メンバーを追加
    org.members.push({
      userId: 'user_789',
      role: 'developer',
      email: 'dev@example.com'
    });
    
    await org.save();
    
    const updatedOrg = await OrganizationModel.findById(org._id);
    expect(updatedOrg.members.length).toBe(1);
    expect(updatedOrg.members[0].userId).toBe('user_789');
    expect(updatedOrg.members[0].role).toBe('developer');
  });

  // 組織の検索クエリテスト
  it('should find organizations by query', async () => {
    // 複数の組織を作成
    await OrganizationModel.create([
      {
        name: 'Org Alpha',
        anthropicOrgId: 'org_alpha',
        adminUserId: 'user_123'
      },
      {
        name: 'Org Beta',
        anthropicOrgId: 'org_beta',
        adminUserId: 'user_456',
        isActive: false
      },
      {
        name: 'Org Gamma',
        anthropicOrgId: 'org_gamma',
        adminUserId: 'user_123'
      }
    ]);
    
    // 管理者IDによる検索
    const adminOrgs = await OrganizationModel.find({ adminUserId: 'user_123' });
    expect(adminOrgs.length).toBe(2);
    
    // アクティブステータスによる検索
    const activeOrgs = await OrganizationModel.find({ isActive: true });
    expect(activeOrgs.length).toBe(2);
    
    const inactiveOrgs = await OrganizationModel.find({ isActive: false });
    expect(inactiveOrgs.length).toBe(1);
    expect(inactiveOrgs[0].name).toBe('Org Beta');
  });

  // メンバーシップ検索のテスト
  it('should find organizations by membership', async () => {
    // メンバーを含む組織を作成
    await OrganizationModel.create([
      {
        name: 'Org One',
        anthropicOrgId: 'org_one',
        adminUserId: 'admin_1',
        members: [
          { userId: 'user_a', role: 'user', email: 'a@example.com' },
          { userId: 'user_b', role: 'developer', email: 'b@example.com' }
        ]
      },
      {
        name: 'Org Two',
        anthropicOrgId: 'org_two',
        adminUserId: 'admin_2',
        members: [
          { userId: 'user_b', role: 'user', email: 'b@example.com' },
          { userId: 'user_c', role: 'developer', email: 'c@example.com' }
        ]
      }
    ]);
    
    // メンバーシップによる検索
    const userBOrgs = await OrganizationModel.find({ 'members.userId': 'user_b' });
    expect(userBOrgs.length).toBe(2);
    
    const userAOrgs = await OrganizationModel.find({ 'members.userId': 'user_a' });
    expect(userAOrgs.length).toBe(1);
    expect(userAOrgs[0].name).toBe('Org One');
  });
});