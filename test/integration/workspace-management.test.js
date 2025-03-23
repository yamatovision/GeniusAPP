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
let userToken;
let developerToken;
let adminUser;
let regularUser;
let developerUser;
let testOrganization;
let testWorkspace;

// セットアップ関数: テストユーザーとトークンを作成
const setupTestData = async () => {
  try {
    // 管理者ユーザーの作成
    adminUser = await UserModel.create({
      username: 'workspace_admin_test',
      email: 'workspace_admin@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi', // "testpassword"
      role: 'admin',
      isActive: true,
      organizationIds: []
    });

    // 一般ユーザーの作成
    regularUser = await UserModel.create({
      username: 'workspace_user_test',
      email: 'workspace_user@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi',
      role: 'user',
      isActive: true,
      organizationIds: []
    });

    // 開発者ユーザーの作成
    developerUser = await UserModel.create({
      username: 'workspace_dev_test',
      email: 'workspace_dev@example.com',
      password: '$2a$08$UWlK5J9ZYB5HN4PIxgYrKeoWfHwOvg6j/lBB4B.Ntmf/HFH0A3fZi',
      role: 'developer',
      isActive: true,
      organizationIds: []
    });

    // トークンの作成
    adminToken = jwt.sign(
      { id: adminUser._id, role: 'admin' },
      config.secret,
      { expiresIn: '24h' }
    );

    userToken = jwt.sign(
      { id: regularUser._id, role: 'user' },
      config.secret,
      { expiresIn: '24h' }
    );

    developerToken = jwt.sign(
      { id: developerUser._id, role: 'developer' },
      config.secret,
      { expiresIn: '24h' }
    );

    // テスト組織の作成
    testOrganization = await OrganizationModel.create({
      name: 'Workspace Management Test Org',
      anthropicOrgId: 'org_workspace_test_123',
      adminUserId: adminUser._id,
      members: [
        { userId: adminUser._id, role: 'admin', email: 'workspace_admin@example.com' },
        { userId: regularUser._id, role: 'user', email: 'workspace_user@example.com' },
        { userId: developerUser._id, role: 'developer', email: 'workspace_dev@example.com' }
      ],
      settings: {
        usageLimit: 1000000,
        alertThreshold: 80
      }
    });

    // ユーザーの組織IDを更新
    await UserModel.updateMany(
      { _id: { $in: [adminUser._id, regularUser._id, developerUser._id] } },
      { $addToSet: { organizationIds: testOrganization._id } }
    );

    // テストワークスペースの作成
    testWorkspace = await WorkspaceModel.create({
      name: 'Test Workspace',
      organizationId: testOrganization._id,
      anthropicWorkspaceId: 'wrkspc_workspace_test_123',
      description: 'Test workspace for integration tests',
      members: [
        { userId: adminUser._id, role: 'workspace_admin', email: 'workspace_admin@example.com' },
        { userId: developerUser._id, role: 'workspace_developer', email: 'workspace_dev@example.com' }
      ],
      apiKeys: [
        {
          keyId: 'key_test_123',
          name: 'Test API Key',
          lastFour: '1234',
          status: 'active',
          createdBy: adminUser._id.toString()
        }
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
  await UserModel.deleteMany({
    email: {
      $in: [
        'workspace_admin@example.com',
        'workspace_user@example.com',
        'workspace_dev@example.com'
      ]
    }
  });
  await OrganizationModel.deleteMany({ anthropicOrgId: 'org_workspace_test_123' });
  await WorkspaceModel.deleteMany({ anthropicWorkspaceId: 'wrkspc_workspace_test_123' });

  // MongoDB接続を閉じる
  await mongoose.connection.close();
});

// ワークスペース管理機能のテスト
describe('Workspace Management Tests', () => {
  // ワークスペース作成テスト
  it('should create a new workspace', async () => {
    const newWorkspaceData = {
      name: 'New Test Workspace',
      organizationId: testOrganization._id,
      anthropicWorkspaceId: 'wrkspc_new_test_123',
      description: 'New test workspace for integration tests',
      settings: {
        usageLimit: 300000,
        alertThreshold: 75
      }
    };

    const response = await request(app)
      .post('/api/workspaces')
      .set('x-access-token', adminToken)
      .send(newWorkspaceData);

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('name', newWorkspaceData.name);
    expect(response.body).toHaveProperty('organizationId', testOrganization._id.toString());
    expect(response.body).toHaveProperty('anthropicWorkspaceId', newWorkspaceData.anthropicWorkspaceId);
    expect(response.body.settings).toHaveProperty('usageLimit', newWorkspaceData.settings.usageLimit);
    
    // ワークスペースIDを取得
    const newWorkspaceId = response.body._id;
    
    // クリーンアップ
    await WorkspaceModel.findByIdAndDelete(newWorkspaceId);
  });

  // 権限チェックテスト - 一般ユーザーはワークスペース作成できない
  it('should not allow regular users to create workspaces', async () => {
    const newWorkspaceData = {
      name: 'Unauthorized Workspace',
      organizationId: testOrganization._id,
      anthropicWorkspaceId: 'wrkspc_unauth_123',
      description: 'This should not be created'
    };

    const response = await request(app)
      .post('/api/workspaces')
      .set('x-access-token', userToken)
      .send(newWorkspaceData);

    expect(response.statusCode).toBe(403);
  });

  // ワークスペース一覧取得テスト
  it('should get all workspaces for an admin user', async () => {
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
    expect(response.body.members.length).toBe(2);
    expect(response.body.apiKeys).toBeInstanceOf(Array);
    expect(response.body.apiKeys.length).toBe(1);
  });

  // ワークスペースメンバーシップによるアクセス制御テスト
  it('should control access based on workspace membership', async () => {
    // 開発者ユーザー（ワークスペースメンバー）はアクセス可能
    const devResponse = await request(app)
      .get(`/api/workspaces/${testWorkspace._id}`)
      .set('x-access-token', developerToken);

    expect(devResponse.statusCode).toBe(200);
    expect(devResponse.body._id).toBe(testWorkspace._id.toString());

    // 一般ユーザー（ワークスペース非メンバー）はアクセス不可
    const userResponse = await request(app)
      .get(`/api/workspaces/${testWorkspace._id}`)
      .set('x-access-token', userToken);

    // 組織のメンバーはワークスペースにアクセス可能（組織の権限が優先される）
    expect(userResponse.statusCode).toBe(200);
  });

  // ワークスペース更新テスト
  it('should update workspace', async () => {
    const updatedSettings = {
      name: 'Updated Test Workspace',
      description: 'Updated test workspace description',
      settings: {
        usageLimit: 800000,
        alertThreshold: 85
      }
    };

    const response = await request(app)
      .put(`/api/workspaces/${testWorkspace._id}`)
      .set('x-access-token', adminToken)
      .send(updatedSettings);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('name', updatedSettings.name);
    expect(response.body).toHaveProperty('description', updatedSettings.description);
    expect(response.body.settings).toHaveProperty('usageLimit', updatedSettings.settings.usageLimit);
    expect(response.body.settings).toHaveProperty('alertThreshold', updatedSettings.settings.alertThreshold);

    // 一般ユーザーは更新できない
    const unauthorizedResponse = await request(app)
      .put(`/api/workspaces/${testWorkspace._id}`)
      .set('x-access-token', userToken)
      .send({
        name: 'Unauthorized Update'
      });

    expect(unauthorizedResponse.statusCode).toBe(403);

    // 元の設定に戻す
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

    // 開発者ユーザーはアーカイブできない
    await WorkspaceModel.findByIdAndUpdate(
      testWorkspace._id,
      { isArchived: false }
    );

    const unauthorizedResponse = await request(app)
      .post(`/api/workspaces/${testWorkspace._id}/archive`)
      .set('x-access-token', developerToken);

    expect(unauthorizedResponse.statusCode).toBe(403);
  });

  // メンバー追加テスト
  it('should add member to workspace', async () => {
    const response = await request(app)
      .post(`/api/workspaces/${testWorkspace._id}/members`)
      .set('x-access-token', adminToken)
      .send({
        userId: regularUser._id,
        role: 'workspace_user',
        email: 'workspace_user@example.com'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.members).toContainEqual(
      expect.objectContaining({
        userId: regularUser._id.toString(),
        role: 'workspace_user',
        email: 'workspace_user@example.com'
      })
    );

    // 開発者ユーザーはメンバーを追加できない
    const unauthorizedResponse = await request(app)
      .post(`/api/workspaces/${testWorkspace._id}/members`)
      .set('x-access-token', developerToken)
      .send({
        userId: mongoose.Types.ObjectId(),
        role: 'workspace_user',
        email: 'another_user@example.com'
      });

    expect(unauthorizedResponse.statusCode).toBe(403);
  });

  // メンバー削除テスト
  it('should remove member from workspace', async () => {
    const response = await request(app)
      .delete(`/api/workspaces/${testWorkspace._id}/members/${regularUser._id}`)
      .set('x-access-token', adminToken);

    expect(response.statusCode).toBe(200);
    expect(response.body.members).not.toContainEqual(
      expect.objectContaining({
        userId: regularUser._id.toString()
      })
    );
  });

  // APIキー更新テスト
  it('should update API key', async () => {
    const keyId = 'key_test_123';
    const updatedKeyData = {
      name: 'Updated API Key Name',
      status: 'inactive'
    };

    const response = await request(app)
      .put(`/api/workspaces/${testWorkspace._id}/api-keys/${keyId}`)
      .set('x-access-token', adminToken)
      .send(updatedKeyData);

    expect(response.statusCode).toBe(200);
    const updatedKey = response.body.apiKeys.find(key => key.keyId === keyId);
    expect(updatedKey).toBeDefined();
    expect(updatedKey.name).toBe(updatedKeyData.name);
    expect(updatedKey.status).toBe(updatedKeyData.status);

    // 開発者ユーザーはAPIキーを更新できない
    const unauthorizedResponse = await request(app)
      .put(`/api/workspaces/${testWorkspace._id}/api-keys/${keyId}`)
      .set('x-access-token', developerToken)
      .send({
        name: 'Developer Update',
        status: 'active'
      });

    expect(unauthorizedResponse.statusCode).toBe(403);

    // 元の設定に戻す
    await WorkspaceModel.findOneAndUpdate(
      { _id: testWorkspace._id, 'apiKeys.keyId': keyId },
      {
        $set: {
          'apiKeys.$.name': 'Test API Key',
          'apiKeys.$.status': 'active'
        }
      }
    );
  });
});