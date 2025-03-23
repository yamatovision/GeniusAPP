const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../portal/backend/app');
const OrganizationModel = require('../../portal/backend/models/organization.model');
const WorkspaceModel = require('../../portal/backend/models/workspace.model');
const UserModel = require('../../portal/backend/models/user.model');
const jwt = require('jsonwebtoken');
const config = require('../../portal/backend/config/auth.config');

// テスト用データ
let adminToken;
let testUser;
let testOrganization;
let testWorkspace;

// セットアップ関数: テストユーザーとトークンを作成
const setupTestData = async () => {
  try {
    // テストユーザーの作成
    testUser = await UserModel.create({
      username: 'admin_test_user',
      email: 'admin_test@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi', // "testpassword"
      role: 'admin',
      isActive: true,
      anthropicUserId: 'antho_user_test',
      organizationIds: []
    });

    // 管理者権限を持つJWTトークンの作成
    adminToken = jwt.sign(
      { id: testUser._id, role: 'admin' },
      config.secret,
      { expiresIn: '24h' }
    );

    // テスト組織の作成
    testOrganization = await OrganizationModel.create({
      name: 'Test Organization',
      anthropicOrgId: 'org_test_123',
      adminUserId: testUser._id,
      members: [
        { userId: testUser._id, role: 'admin', email: 'admin_test@example.com' }
      ],
      settings: {
        usageLimit: 1000000,
        alertThreshold: 80
      }
    });

    // テストユーザーの組織IDを更新
    await UserModel.findByIdAndUpdate(
      testUser._id,
      { $addToSet: { organizationIds: testOrganization._id } }
    );

    // テストワークスペースの作成
    testWorkspace = await WorkspaceModel.create({
      name: 'Test Workspace',
      organizationId: testOrganization._id,
      anthropicWorkspaceId: 'wrkspc_test_123',
      description: 'Test workspace for integration tests',
      members: [
        { userId: testUser._id, role: 'workspace_admin', email: 'admin_test@example.com' }
      ],
      settings: {
        usageLimit: 500000,
        alertThreshold: 70
      }
    });

  } catch (error) {
    console.error('Error setting up test data:', error);
    throw error;
  }
};

// テスト開始前のセットアップ
beforeAll(async () => {
  // MongoDB接続
  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/appgenius_test';
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  // テストデータの作成
  await setupTestData();
});

// テスト終了後のクリーンアップ
afterAll(async () => {
  // テストデータの削除
  await UserModel.deleteMany({ email: 'admin_test@example.com' });
  await OrganizationModel.deleteMany({ anthropicOrgId: 'org_test_123' });
  await WorkspaceModel.deleteMany({ anthropicWorkspaceId: 'wrkspc_test_123' });

  // MongoDB接続を閉じる
  await mongoose.connection.close();
});

// 組織管理APIのテスト
describe('Organization API Tests', () => {
  // 組織一覧取得テスト
  it('should get all organizations', async () => {
    const response = await request(app)
      .get('/api/organizations')
      .set('x-access-token', adminToken);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.some(org => org.name === 'Test Organization')).toBe(true);
  });

  // 組織詳細取得テスト
  it('should get organization details', async () => {
    const response = await request(app)
      .get(`/api/organizations/${testOrganization._id}`)
      .set('x-access-token', adminToken);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('_id', testOrganization._id.toString());
    expect(response.body).toHaveProperty('name', 'Test Organization');
    expect(response.body).toHaveProperty('adminUserId', testUser._id.toString());
    expect(response.body.members).toBeInstanceOf(Array);
    expect(response.body.members.length).toBe(1);
  });

  // 組織更新テスト
  it('should update organization', async () => {
    const updatedName = 'Updated Test Organization';
    const updatedSettings = {
      usageLimit: 2000000,
      alertThreshold: 90
    };

    const response = await request(app)
      .put(`/api/organizations/${testOrganization._id}`)
      .set('x-access-token', adminToken)
      .send({
        name: updatedName,
        settings: updatedSettings
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('name', updatedName);
    expect(response.body.settings).toHaveProperty('usageLimit', updatedSettings.usageLimit);
    expect(response.body.settings).toHaveProperty('alertThreshold', updatedSettings.alertThreshold);

    // 変更を元に戻す
    await OrganizationModel.findByIdAndUpdate(
      testOrganization._id,
      {
        name: 'Test Organization',
        settings: {
          usageLimit: 1000000,
          alertThreshold: 80
        }
      }
    );
  });

  // メンバー追加のテスト（モックユーザー）
  it('should add member to organization', async () => {
    // 新しいテストユーザーを作成
    const newMemberUser = await UserModel.create({
      username: 'test_member',
      email: 'test_member@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi',
      role: 'user',
      isActive: true
    });

    const response = await request(app)
      .post(`/api/organizations/${testOrganization._id}/members`)
      .set('x-access-token', adminToken)
      .send({
        userId: newMemberUser._id,
        role: 'developer',
        email: 'test_member@example.com'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.members.length).toBe(2);
    expect(response.body.members.some(m => m.userId === newMemberUser._id.toString())).toBe(true);
    expect(response.body.members.find(m => m.userId === newMemberUser._id.toString()).role).toBe('developer');

    // ユーザーの組織IDsが更新されていることを確認
    const updatedUser = await UserModel.findById(newMemberUser._id);
    expect(updatedUser.organizationIds).toContain(testOrganization._id.toString());

    // テスト後にユーザーを削除
    await UserModel.findByIdAndDelete(newMemberUser._id);
  });
});

// ワークスペース管理APIのテスト
describe('Workspace API Tests', () => {
  // ワークスペース一覧取得テスト
  it('should get all workspaces', async () => {
    const response = await request(app)
      .get('/api/workspaces')
      .set('x-access-token', adminToken);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.some(ws => ws.name === 'Test Workspace')).toBe(true);
  });

  // 組織IDでフィルタリングされたワークスペース一覧取得テスト
  it('should get workspaces filtered by organization', async () => {
    const response = await request(app)
      .get(`/api/workspaces?organizationId=${testOrganization._id}`)
      .set('x-access-token', adminToken);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.every(ws => ws.organizationId === testOrganization._id.toString())).toBe(true);
  });

  // ワークスペース詳細取得テスト
  it('should get workspace details', async () => {
    const response = await request(app)
      .get(`/api/workspaces/${testWorkspace._id}`)
      .set('x-access-token', adminToken);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('_id', testWorkspace._id.toString());
    expect(response.body).toHaveProperty('name', 'Test Workspace');
    expect(response.body).toHaveProperty('organizationId', testOrganization._id.toString());
    expect(response.body.members).toBeInstanceOf(Array);
    expect(response.body.members.length).toBe(1);
  });

  // ワークスペース更新テスト
  it('should update workspace', async () => {
    const updatedName = 'Updated Test Workspace';
    const updatedDescription = 'Updated test workspace description';
    const updatedSettings = {
      usageLimit: 800000,
      alertThreshold: 85
    };

    const response = await request(app)
      .put(`/api/workspaces/${testWorkspace._id}`)
      .set('x-access-token', adminToken)
      .send({
        name: updatedName,
        description: updatedDescription,
        settings: updatedSettings
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('name', updatedName);
    expect(response.body).toHaveProperty('description', updatedDescription);
    expect(response.body.settings).toHaveProperty('usageLimit', updatedSettings.usageLimit);
    expect(response.body.settings).toHaveProperty('alertThreshold', updatedSettings.alertThreshold);

    // 変更を元に戻す
    await WorkspaceModel.findByIdAndUpdate(
      testWorkspace._id,
      {
        name: 'Test Workspace',
        description: 'Test workspace for integration tests',
        settings: {
          usageLimit: 500000,
          alertThreshold: 70
        }
      }
    );
  });

  // ワークスペースアーカイブテスト
  it('should archive workspace', async () => {
    const response = await request(app)
      .post(`/api/workspaces/${testWorkspace._id}/archive`)
      .set('x-access-token', adminToken);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('isArchived', true);

    // アーカイブ状態を元に戻す
    await WorkspaceModel.findByIdAndUpdate(
      testWorkspace._id,
      { isArchived: false }
    );
  });

  // メンバー追加のテスト
  it('should add member to workspace', async () => {
    // 新しいテストユーザーを作成
    const newMemberUser = await UserModel.create({
      username: 'workspace_test_member',
      email: 'workspace_test_member@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi',
      role: 'user',
      isActive: true,
      organizationIds: [testOrganization._id]
    });

    // まず組織に追加
    await OrganizationModel.findByIdAndUpdate(
      testOrganization._id,
      {
        $push: {
          members: {
            userId: newMemberUser._id,
            role: 'developer',
            email: 'workspace_test_member@example.com'
          }
        }
      }
    );

    // ワークスペースにメンバーを追加
    const response = await request(app)
      .post(`/api/workspaces/${testWorkspace._id}/members`)
      .set('x-access-token', adminToken)
      .send({
        userId: newMemberUser._id,
        role: 'workspace_developer',
        email: 'workspace_test_member@example.com'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.members.length).toBe(2);
    expect(response.body.members.some(m => m.userId === newMemberUser._id.toString())).toBe(true);
    expect(response.body.members.find(m => m.userId === newMemberUser._id.toString()).role).toBe('workspace_developer');

    // テスト後にユーザーを削除
    await UserModel.findByIdAndDelete(newMemberUser._id);
  });
});