const mongoose = require('mongoose');
const WorkspaceModel = require('../workspace.model');

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
  await WorkspaceModel.deleteMany({});
});

describe('Workspace Model Test', () => {
  // 基本的なワークスペース作成テスト
  it('should create and save workspace successfully', async () => {
    const workspaceData = {
      name: 'Test Workspace',
      organizationId: new mongoose.Types.ObjectId(),
      anthropicWorkspaceId: 'wrkspc_123456',
      description: 'Test workspace description',
      settings: {
        usageLimit: 500000,
        alertThreshold: 70
      }
    };
    
    const validWorkspace = new WorkspaceModel(workspaceData);
    const savedWorkspace = await validWorkspace.save();
    
    // 保存されたデータの検証
    expect(savedWorkspace.name).toBe(workspaceData.name);
    expect(savedWorkspace.organizationId.toString()).toBe(workspaceData.organizationId.toString());
    expect(savedWorkspace.anthropicWorkspaceId).toBe(workspaceData.anthropicWorkspaceId);
    expect(savedWorkspace.description).toBe(workspaceData.description);
    expect(savedWorkspace.settings.usageLimit).toBe(workspaceData.settings.usageLimit);
    expect(savedWorkspace.settings.alertThreshold).toBe(workspaceData.settings.alertThreshold);
    expect(savedWorkspace.isArchived).toBe(false); // デフォルト値のテスト
    expect(savedWorkspace.members).toEqual([]); // デフォルト値のテスト
    expect(savedWorkspace.apiKeys).toEqual([]); // デフォルト値のテスト
    expect(savedWorkspace.createdAt).toBeDefined();
    expect(savedWorkspace.updatedAt).toBeDefined();
  });

  // 必須フィールドのバリデーションテスト
  it('should fail when required fields are missing', async () => {
    const workspaceWithoutName = new WorkspaceModel({
      organizationId: new mongoose.Types.ObjectId(),
      anthropicWorkspaceId: 'wrkspc_123456'
    });
    
    let err;
    try {
      await workspaceWithoutName.save();
    } catch (error) {
      err = error;
    }
    
    expect(err).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  // メンバー追加のテスト
  it('should add members to workspace', async () => {
    const workspace = new WorkspaceModel({
      name: 'Test Workspace',
      organizationId: new mongoose.Types.ObjectId(),
      anthropicWorkspaceId: 'wrkspc_123456'
    });
    
    await workspace.save();
    
    // メンバーを追加
    workspace.members.push({
      userId: 'user_789',
      role: 'workspace_developer',
      email: 'dev@example.com'
    });
    
    await workspace.save();
    
    const updatedWorkspace = await WorkspaceModel.findById(workspace._id);
    expect(updatedWorkspace.members.length).toBe(1);
    expect(updatedWorkspace.members[0].userId).toBe('user_789');
    expect(updatedWorkspace.members[0].role).toBe('workspace_developer');
  });

  // APIキー追加のテスト
  it('should add API keys to workspace', async () => {
    const workspace = new WorkspaceModel({
      name: 'Test Workspace',
      organizationId: new mongoose.Types.ObjectId(),
      anthropicWorkspaceId: 'wrkspc_123456'
    });
    
    await workspace.save();
    
    // APIキーを追加
    workspace.apiKeys.push({
      keyId: 'key_123456',
      name: 'Test API Key',
      lastFour: '7890',
      status: 'active',
      createdBy: 'user_123'
    });
    
    await workspace.save();
    
    const updatedWorkspace = await WorkspaceModel.findById(workspace._id);
    expect(updatedWorkspace.apiKeys.length).toBe(1);
    expect(updatedWorkspace.apiKeys[0].keyId).toBe('key_123456');
    expect(updatedWorkspace.apiKeys[0].name).toBe('Test API Key');
    expect(updatedWorkspace.apiKeys[0].status).toBe('active');
  });

  // ワークスペースの検索クエリテスト
  it('should find workspaces by query', async () => {
    const orgId1 = new mongoose.Types.ObjectId();
    const orgId2 = new mongoose.Types.ObjectId();
    
    // 複数のワークスペースを作成
    await WorkspaceModel.create([
      {
        name: 'Workspace Alpha',
        organizationId: orgId1,
        anthropicWorkspaceId: 'wrkspc_alpha'
      },
      {
        name: 'Workspace Beta',
        organizationId: orgId1,
        anthropicWorkspaceId: 'wrkspc_beta',
        isArchived: true
      },
      {
        name: 'Workspace Gamma',
        organizationId: orgId2,
        anthropicWorkspaceId: 'wrkspc_gamma'
      }
    ]);
    
    // 組織IDによる検索
    const org1Workspaces = await WorkspaceModel.find({ organizationId: orgId1 });
    expect(org1Workspaces.length).toBe(2);
    
    // アーカイブステータスによる検索
    const activeWorkspaces = await WorkspaceModel.find({ isArchived: false });
    expect(activeWorkspaces.length).toBe(2);
    
    const archivedWorkspaces = await WorkspaceModel.find({ isArchived: true });
    expect(archivedWorkspaces.length).toBe(1);
    expect(archivedWorkspaces[0].name).toBe('Workspace Beta');
  });

  // メンバーシップとAPIキー検索のテスト
  it('should find workspaces by membership and API keys', async () => {
    // メンバーとAPIキーを含むワークスペースを作成
    await WorkspaceModel.create([
      {
        name: 'Workspace One',
        organizationId: new mongoose.Types.ObjectId(),
        anthropicWorkspaceId: 'wrkspc_one',
        members: [
          { userId: 'user_a', role: 'workspace_user', email: 'a@example.com' },
          { userId: 'user_b', role: 'workspace_developer', email: 'b@example.com' }
        ],
        apiKeys: [
          { keyId: 'key_1', name: 'Key 1', lastFour: '1234', status: 'active', createdBy: 'user_a' }
        ]
      },
      {
        name: 'Workspace Two',
        organizationId: new mongoose.Types.ObjectId(),
        anthropicWorkspaceId: 'wrkspc_two',
        members: [
          { userId: 'user_b', role: 'workspace_admin', email: 'b@example.com' }
        ],
        apiKeys: [
          { keyId: 'key_2', name: 'Key 2', lastFour: '5678', status: 'active', createdBy: 'user_b' },
          { keyId: 'key_3', name: 'Key 3', lastFour: '9012', status: 'inactive', createdBy: 'user_b' }
        ]
      }
    ]);
    
    // メンバーシップによる検索
    const userBWorkspaces = await WorkspaceModel.find({ 'members.userId': 'user_b' });
    expect(userBWorkspaces.length).toBe(2);
    
    const userAWorkspaces = await WorkspaceModel.find({ 'members.userId': 'user_a' });
    expect(userAWorkspaces.length).toBe(1);
    expect(userAWorkspaces[0].name).toBe('Workspace One');
    
    // APIキーによる検索
    const activeKeyWorkspaces = await WorkspaceModel.find({ 'apiKeys.status': 'active' });
    expect(activeKeyWorkspaces.length).toBe(2);
    
    const inactiveKeyWorkspaces = await WorkspaceModel.find({ 'apiKeys.status': 'inactive' });
    expect(inactiveKeyWorkspaces.length).toBe(1);
    expect(inactiveKeyWorkspaces[0].name).toBe('Workspace Two');
  });
});