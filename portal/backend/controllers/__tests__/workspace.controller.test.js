const mongoose = require('mongoose');
const httpMocks = require('node-mocks-http');
const workspaceController = require('../workspace.controller');
const WorkspaceModel = require('../../models/workspace.model');
const OrganizationModel = require('../../models/organization.model');
const UserModel = require('../../models/user.model');

// モデルのモック
jest.mock('../../models/workspace.model');
jest.mock('../../models/organization.model');
jest.mock('../../models/user.model');

describe('Workspace Controller Test', () => {
  // テスト前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ワークスペース作成テスト
  it('should create a new workspace', async () => {
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/workspaces',
      body: {
        name: 'Test Workspace',
        organizationId: orgId.toString(),
        anthropicWorkspaceId: 'wrkspc_123456',
        description: 'Test workspace description',
        settings: {
          usageLimit: 500000,
          alertThreshold: 70
        }
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // 組織のモック
    const mockOrg = {
      _id: orgId,
      name: 'Test Org',
      adminUserId: 'user_123',
      members: [
        { userId: 'user_123', role: 'admin' }
      ]
    };

    // ワークスペースのモック
    const mockWorkspace = {
      _id: 'workspace_id',
      name: 'Test Workspace',
      organizationId: orgId.toString(),
      anthropicWorkspaceId: 'wrkspc_123456',
      description: 'Test workspace description',
      settings: {
        usageLimit: 500000,
        alertThreshold: 70
      },
      isArchived: false,
      members: [],
      apiKeys: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // モック実装
    OrganizationModel.findById = jest.fn().mockResolvedValue(mockOrg);
    WorkspaceModel.prototype.save = jest.fn().mockResolvedValue(mockWorkspace);

    // コントローラメソッドを呼び出し
    await workspaceController.create(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res._getData())).toHaveProperty('name', 'Test Workspace');
    expect(JSON.parse(res._getData())).toHaveProperty('organizationId', orgId.toString());

    // 組織の存在確認が行われたことを確認
    expect(OrganizationModel.findById).toHaveBeenCalledWith(orgId.toString());
    // WorkspaceModelが正しく保存されたことを確認
    expect(WorkspaceModel.prototype.save).toHaveBeenCalled();
  });

  // 組織IDが無効な場合のテスト
  it('should return 404 if organization not found', async () => {
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/workspaces',
      body: {
        name: 'Test Workspace',
        organizationId: orgId.toString(),
        description: 'Test workspace description'
      },
      user: {
        id: 'user_123'
      }
    });
    const res = httpMocks.createResponse();

    // 組織が見つからない場合のモック
    OrganizationModel.findById = jest.fn().mockResolvedValue(null);

    // コントローラメソッドを呼び出し
    await workspaceController.create(req, res);

    // 404レスポンスの検証
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res._getData())).toHaveProperty('message', 'Organization not found');
  });

  // ワークスペース一覧取得テスト
  it('should get all workspaces for an admin user', async () => {
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/workspaces',
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // ワークスペースのモック
    const mockWorkspaces = [
      {
        _id: 'workspace_1',
        name: 'Workspace 1',
        organizationId: 'org_1',
        isArchived: false
      },
      {
        _id: 'workspace_2',
        name: 'Workspace 2',
        organizationId: 'org_2',
        isArchived: false
      }
    ];

    // モック実装
    WorkspaceModel.find = jest.fn().mockReturnThis();
    WorkspaceModel.sort = jest.fn().mockReturnThis();
    WorkspaceModel.exec = jest.fn().mockResolvedValue(mockWorkspaces);

    // コントローラメソッドを呼び出し
    await workspaceController.findAll(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveLength(2);
    expect(JSON.parse(res._getData())[0].name).toBe('Workspace 1');

    // adminユーザーの場合、全ワークスペースが取得できることを確認
    expect(WorkspaceModel.find).toHaveBeenCalledWith({});
  });

  // 組織IDでフィルタリングされたワークスペース一覧取得テスト
  it('should get workspaces filtered by organization', async () => {
    const orgId = 'org_1';
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/workspaces?organizationId=' + orgId,
      query: {
        organizationId: orgId
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // ワークスペースのモック
    const mockWorkspaces = [
      {
        _id: 'workspace_1',
        name: 'Workspace 1',
        organizationId: orgId,
        isArchived: false
      },
      {
        _id: 'workspace_3',
        name: 'Workspace 3',
        organizationId: orgId,
        isArchived: false
      }
    ];

    // モック実装
    WorkspaceModel.find = jest.fn().mockReturnThis();
    WorkspaceModel.sort = jest.fn().mockReturnThis();
    WorkspaceModel.exec = jest.fn().mockResolvedValue(mockWorkspaces);

    // コントローラメソッドを呼び出し
    await workspaceController.findAll(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveLength(2);
    expect(JSON.parse(res._getData())[0].organizationId).toBe(orgId);

    // 組織IDでフィルタリングされていることを確認
    expect(WorkspaceModel.find).toHaveBeenCalledWith({ organizationId: orgId });
  });

  // ワークスペース詳細取得テスト
  it('should get workspace by id', async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}`,
      params: {
        id: workspaceId
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // ワークスペースのモック
    const mockWorkspace = {
      _id: workspaceId,
      name: 'Test Workspace',
      organizationId: 'org_123',
      description: 'Test workspace description',
      isArchived: false,
      members: [
        { userId: 'user_123', role: 'workspace_admin', email: 'admin@example.com' },
        { userId: 'user_456', role: 'workspace_developer', email: 'dev@example.com' }
      ],
      apiKeys: [
        { keyId: 'key_123', name: 'API Key 1', lastFour: '1234', status: 'active' }
      ]
    };

    // モック実装
    WorkspaceModel.findById = jest.fn().mockResolvedValue(mockWorkspace);

    // コントローラメソッドを呼び出し
    await workspaceController.findOne(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveProperty('_id', workspaceId.toString());
    expect(JSON.parse(res._getData())).toHaveProperty('name', 'Test Workspace');
    expect(JSON.parse(res._getData()).members).toHaveLength(2);
    expect(JSON.parse(res._getData()).apiKeys).toHaveLength(1);

    // findByIdが正しいIDで呼び出されたことを確認
    expect(WorkspaceModel.findById).toHaveBeenCalledWith(workspaceId.toString());
  });

  // ワークスペースが見つからない場合のテスト
  it('should return 404 if workspace not found', async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}`,
      params: {
        id: workspaceId
      },
      user: {
        id: 'user_123'
      }
    });
    const res = httpMocks.createResponse();

    // ワークスペースが見つからない場合のモック
    WorkspaceModel.findById = jest.fn().mockResolvedValue(null);

    // コントローラメソッドを呼び出し
    await workspaceController.findOne(req, res);

    // 404レスポンスの検証
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res._getData())).toHaveProperty('message', 'Workspace not found');
  });

  // ワークスペース更新テスト
  it('should update workspace', async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'PUT',
      url: `/api/workspaces/${workspaceId}`,
      params: {
        id: workspaceId
      },
      body: {
        name: 'Updated Workspace Name',
        description: 'Updated description',
        settings: {
          usageLimit: 800000,
          alertThreshold: 85
        }
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // 更新後のワークスペースのモック
    const mockUpdatedWorkspace = {
      _id: workspaceId,
      name: 'Updated Workspace Name',
      description: 'Updated description',
      organizationId: 'org_123',
      settings: {
        usageLimit: 800000,
        alertThreshold: 85
      },
      isArchived: false
    };

    // モック実装
    WorkspaceModel.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUpdatedWorkspace);

    // コントローラメソッドを呼び出し
    await workspaceController.update(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveProperty('name', 'Updated Workspace Name');
    expect(JSON.parse(res._getData())).toHaveProperty('description', 'Updated description');
    expect(JSON.parse(res._getData()).settings).toHaveProperty('usageLimit', 800000);

    // findByIdAndUpdateが正しいパラメータで呼び出されたことを確認
    expect(WorkspaceModel.findByIdAndUpdate).toHaveBeenCalledWith(
      workspaceId.toString(),
      {
        name: 'Updated Workspace Name',
        description: 'Updated description',
        settings: {
          usageLimit: 800000,
          alertThreshold: 85
        }
      },
      { new: true }
    );
  });

  // ワークスペースアーカイブテスト
  it('should archive workspace', async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/archive`,
      params: {
        id: workspaceId
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // アーカイブ後のワークスペースのモック
    const mockArchivedWorkspace = {
      _id: workspaceId,
      name: 'Test Workspace',
      organizationId: 'org_123',
      isArchived: true // アーカイブされた状態
    };

    // モック実装
    WorkspaceModel.findByIdAndUpdate = jest.fn().mockResolvedValue(mockArchivedWorkspace);

    // コントローラメソッドを呼び出し
    await workspaceController.archive(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveProperty('isArchived', true);

    // findByIdAndUpdateが正しいパラメータで呼び出されたことを確認
    expect(WorkspaceModel.findByIdAndUpdate).toHaveBeenCalledWith(
      workspaceId.toString(),
      { isArchived: true },
      { new: true }
    );
  });

  // メンバー追加テスト
  it('should add member to workspace', async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/members`,
      params: {
        id: workspaceId
      },
      body: {
        userId: 'user_789',
        role: 'workspace_developer',
        email: 'newdev@example.com'
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // 元のワークスペースデータ
    const originalWorkspace = {
      _id: workspaceId,
      name: 'Test Workspace',
      organizationId: orgId.toString(),
      members: [
        { userId: 'user_123', role: 'workspace_admin', email: 'admin@example.com' }
      ],
      save: jest.fn().mockResolvedValue({
        _id: workspaceId,
        name: 'Test Workspace',
        organizationId: orgId.toString(),
        members: [
          { userId: 'user_123', role: 'workspace_admin', email: 'admin@example.com' },
          { userId: 'user_789', role: 'workspace_developer', email: 'newdev@example.com' }
        ]
      })
    };

    // 組織のモック
    const mockOrg = {
      _id: orgId,
      members: [
        { userId: 'user_123', role: 'admin' },
        { userId: 'user_789', role: 'developer' }
      ]
    };

    // ユーザーのモック
    const mockUser = {
      _id: 'user_789',
      email: 'newdev@example.com'
    };

    // モックの実装
    WorkspaceModel.findById = jest.fn().mockResolvedValue(originalWorkspace);
    OrganizationModel.findById = jest.fn().mockResolvedValue(mockOrg);
    UserModel.findById = jest.fn().mockResolvedValue(mockUser);

    // コントローラメソッドを呼び出し
    await workspaceController.addMember(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData()).members).toHaveLength(2);
    expect(JSON.parse(res._getData()).members[1]).toHaveProperty('userId', 'user_789');
    expect(JSON.parse(res._getData()).members[1]).toHaveProperty('role', 'workspace_developer');

    // ワークスペースの保存が呼び出されたことを確認
    expect(originalWorkspace.save).toHaveBeenCalled();
  });

  // APIキー更新テスト
  it('should update API key status', async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const keyId = 'key_123';
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'PUT',
      url: `/api/workspaces/${workspaceId}/api-keys/${keyId}`,
      params: {
        id: workspaceId,
        keyId: keyId
      },
      body: {
        status: 'inactive',
        name: 'Updated Key Name'
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // 元のワークスペースデータ
    const originalWorkspace = {
      _id: workspaceId,
      name: 'Test Workspace',
      apiKeys: [
        { keyId: keyId, name: 'API Key 1', lastFour: '1234', status: 'active' }
      ]
    };

    // 更新後のワークスペース
    const updatedWorkspace = {
      ...originalWorkspace,
      apiKeys: [
        { keyId: keyId, name: 'Updated Key Name', lastFour: '1234', status: 'inactive' }
      ]
    };

    // モックの実装
    WorkspaceModel.findById = jest.fn().mockResolvedValue(originalWorkspace);
    WorkspaceModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedWorkspace);

    // コントローラメソッドを呼び出し
    await workspaceController.updateApiKey(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData()).apiKeys[0]).toHaveProperty('status', 'inactive');
    expect(JSON.parse(res._getData()).apiKeys[0]).toHaveProperty('name', 'Updated Key Name');

    // findByIdAndUpdateが正しいパラメータで呼び出されたことを確認
    expect(WorkspaceModel.findByIdAndUpdate).toHaveBeenCalledWith(
      workspaceId.toString(),
      {
        'apiKeys.$.status': 'inactive',
        'apiKeys.$.name': 'Updated Key Name'
      },
      { new: true }
    );
  });
});