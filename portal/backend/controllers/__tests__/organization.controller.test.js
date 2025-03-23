const mongoose = require('mongoose');
const httpMocks = require('node-mocks-http');
const organizationController = require('../organization.controller');
const OrganizationModel = require('../../models/organization.model');
const UserModel = require('../../models/user.model');

// OrganizationModelとUserModelのモック
jest.mock('../../models/organization.model');
jest.mock('../../models/user.model');

describe('Organization Controller Test', () => {
  // テスト前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 組織作成テスト
  it('should create a new organization', async () => {
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/organizations',
      body: {
        name: 'Test Organization',
        anthropicOrgId: 'org_123456',
        settings: {
          usageLimit: 1000000,
          alertThreshold: 80
        }
      },
      user: {
        id: 'user_123'
      }
    });
    const res = httpMocks.createResponse();

    // OrganizationモデルとUserモデルのモック実装
    OrganizationModel.prototype.save = jest.fn().mockResolvedValue({
      _id: 'org_mock_id',
      name: 'Test Organization',
      anthropicOrgId: 'org_123456',
      adminUserId: 'user_123',
      settings: {
        usageLimit: 1000000,
        alertThreshold: 80
      },
      isActive: true,
      members: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    UserModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
      _id: 'user_123',
      organizationIds: ['org_mock_id']
    });

    // コントローラメソッドを呼び出し
    await organizationController.create(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res._getData())).toHaveProperty('name', 'Test Organization');
    expect(JSON.parse(res._getData())).toHaveProperty('adminUserId', 'user_123');

    // モデルメソッドが正しく呼び出されたか確認
    expect(OrganizationModel.prototype.save).toHaveBeenCalled();
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user_123',
      { $addToSet: { organizationIds: expect.any(String) } },
      { new: true }
    );
  });

  // 組織一覧取得テスト
  it('should get all organizations for an admin user', async () => {
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/organizations',
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // OrganizationモデルとUserモデルのモック実装
    const mockOrgs = [
      {
        _id: 'org_1',
        name: 'Org 1',
        anthropicOrgId: 'antho_org_1',
        adminUserId: 'user_123',
        isActive: true
      },
      {
        _id: 'org_2',
        name: 'Org 2',
        anthropicOrgId: 'antho_org_2',
        adminUserId: 'user_456',
        isActive: true
      }
    ];

    OrganizationModel.find = jest.fn().mockReturnThis();
    OrganizationModel.sort = jest.fn().mockReturnThis();
    OrganizationModel.exec = jest.fn().mockResolvedValue(mockOrgs);

    // コントローラメソッドを呼び出し
    await organizationController.findAll(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveLength(2);
    expect(JSON.parse(res._getData())[0].name).toBe('Org 1');

    // adminユーザーの場合、全組織が取得できることを確認
    expect(OrganizationModel.find).toHaveBeenCalledWith({});
  });

  // 一般ユーザーの組織一覧取得テスト
  it('should get organizations for a regular user', async () => {
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/organizations',
      user: {
        id: 'user_123',
        role: 'user',
        organizationIds: ['org_1', 'org_3']
      }
    });
    const res = httpMocks.createResponse();

    // Organizationモデルのモック実装
    const mockOrgs = [
      {
        _id: 'org_1',
        name: 'Org 1',
        anthropicOrgId: 'antho_org_1',
        adminUserId: 'user_123',
        isActive: true
      },
      {
        _id: 'org_3',
        name: 'Org 3',
        anthropicOrgId: 'antho_org_3',
        adminUserId: 'user_789',
        isActive: true
      }
    ];

    OrganizationModel.find = jest.fn().mockReturnThis();
    OrganizationModel.sort = jest.fn().mockReturnThis();
    OrganizationModel.exec = jest.fn().mockResolvedValue(mockOrgs);

    // コントローラメソッドを呼び出し
    await organizationController.findAll(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveLength(2);

    // 一般ユーザーの場合、自分がメンバーの組織のみ取得することを確認
    expect(OrganizationModel.find).toHaveBeenCalledWith({
      _id: { $in: ['org_1', 'org_3'] }
    });
  });

  // 組織詳細取得テスト
  it('should get organization by id', async () => {
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/organizations/${orgId}`,
      params: {
        id: orgId
      },
      user: {
        id: 'user_123',
        role: 'user',
        organizationIds: [orgId.toString()]
      }
    });
    const res = httpMocks.createResponse();

    // Organizationモデルのモック実装
    const mockOrg = {
      _id: orgId,
      name: 'Test Org',
      anthropicOrgId: 'antho_org_id',
      adminUserId: 'user_123',
      isActive: true,
      members: [
        { userId: 'user_123', role: 'admin', email: 'admin@example.com' },
        { userId: 'user_456', role: 'developer', email: 'dev@example.com' }
      ]
    };

    OrganizationModel.findById = jest.fn().mockResolvedValue(mockOrg);

    // コントローラメソッドを呼び出し
    await organizationController.findOne(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveProperty('_id', orgId.toString());
    expect(JSON.parse(res._getData())).toHaveProperty('name', 'Test Org');
    expect(JSON.parse(res._getData()).members).toHaveLength(2);

    // findByIdが正しいIDで呼び出されたことを確認
    expect(OrganizationModel.findById).toHaveBeenCalledWith(orgId.toString());
  });

  // 組織が見つからない場合のテスト
  it('should return 404 if organization not found', async () => {
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/organizations/${orgId}`,
      params: {
        id: orgId
      },
      user: {
        id: 'user_123',
        role: 'user',
        organizationIds: [orgId.toString()]
      }
    });
    const res = httpMocks.createResponse();

    // Organizationモデルのモック実装（組織が見つからない）
    OrganizationModel.findById = jest.fn().mockResolvedValue(null);

    // コントローラメソッドを呼び出し
    await organizationController.findOne(req, res);

    // 404レスポンスの検証
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res._getData())).toHaveProperty('message', 'Organization not found');
  });

  // 組織更新テスト
  it('should update organization', async () => {
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'PUT',
      url: `/api/organizations/${orgId}`,
      params: {
        id: orgId
      },
      body: {
        name: 'Updated Org Name',
        settings: {
          usageLimit: 2000000,
          alertThreshold: 90
        }
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // Organizationモデルのモック実装
    const mockUpdatedOrg = {
      _id: orgId,
      name: 'Updated Org Name',
      anthropicOrgId: 'antho_org_id',
      adminUserId: 'user_123',
      settings: {
        usageLimit: 2000000,
        alertThreshold: 90
      },
      isActive: true
    };

    OrganizationModel.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUpdatedOrg);

    // コントローラメソッドを呼び出し
    await organizationController.update(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveProperty('name', 'Updated Org Name');
    expect(JSON.parse(res._getData()).settings).toHaveProperty('usageLimit', 2000000);

    // findByIdAndUpdateが正しいパラメータで呼び出されたことを確認
    expect(OrganizationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      orgId.toString(),
      {
        name: 'Updated Org Name',
        settings: {
          usageLimit: 2000000,
          alertThreshold: 90
        }
      },
      { new: true }
    );
  });

  // メンバー追加テスト
  it('should add member to organization', async () => {
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/api/organizations/${orgId}/members`,
      params: {
        id: orgId
      },
      body: {
        userId: 'user_789',
        role: 'developer',
        email: 'newdev@example.com'
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // 元の組織データ
    const originalOrg = {
      _id: orgId,
      name: 'Test Org',
      adminUserId: 'user_123',
      members: [
        { userId: 'user_123', role: 'admin', email: 'admin@example.com' }
      ],
      save: jest.fn().mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        adminUserId: 'user_123',
        members: [
          { userId: 'user_123', role: 'admin', email: 'admin@example.com' },
          { userId: 'user_789', role: 'developer', email: 'newdev@example.com' }
        ]
      })
    };

    // ユーザーのモック
    const mockUser = {
      _id: 'user_789',
      email: 'newdev@example.com',
      organizationIds: []
    };

    // モックの実装
    OrganizationModel.findById = jest.fn().mockResolvedValue(originalOrg);
    UserModel.findById = jest.fn().mockResolvedValue(mockUser);
    UserModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
      ...mockUser,
      organizationIds: [orgId.toString()]
    });

    // コントローラメソッドを呼び出し
    await organizationController.addMember(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData()).members).toHaveLength(2);
    expect(JSON.parse(res._getData()).members[1]).toHaveProperty('userId', 'user_789');
    expect(JSON.parse(res._getData()).members[1]).toHaveProperty('role', 'developer');

    // 組織の保存が呼び出されたことを確認
    expect(originalOrg.save).toHaveBeenCalled();
    
    // ユーザーのorganizationIdsが更新されたことを確認
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user_789',
      { $addToSet: { organizationIds: orgId.toString() } },
      { new: true }
    );
  });

  // メンバー削除テスト
  it('should remove member from organization', async () => {
    const orgId = new mongoose.Types.ObjectId();
    const memberUserId = 'user_456';
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'DELETE',
      url: `/api/organizations/${orgId}/members/${memberUserId}`,
      params: {
        id: orgId,
        userId: memberUserId
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // 元の組織データ
    const originalOrg = {
      _id: orgId,
      name: 'Test Org',
      adminUserId: 'user_123',
      members: [
        { userId: 'user_123', role: 'admin', email: 'admin@example.com' },
        { userId: memberUserId, role: 'developer', email: 'dev@example.com' }
      ],
      save: jest.fn().mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        adminUserId: 'user_123',
        members: [
          { userId: 'user_123', role: 'admin', email: 'admin@example.com' }
        ]
      })
    };

    // モックの実装
    OrganizationModel.findById = jest.fn().mockResolvedValue(originalOrg);
    UserModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
      _id: memberUserId,
      organizationIds: []
    });

    // コントローラメソッドを呼び出し
    await organizationController.removeMember(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData()).members).toHaveLength(1);
    expect(JSON.parse(res._getData()).members[0]).toHaveProperty('userId', 'user_123');

    // 組織の保存が呼び出されたことを確認
    expect(originalOrg.save).toHaveBeenCalled();
    
    // ユーザーのorganizationIdsが更新されたことを確認
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      memberUserId,
      { $pull: { organizationIds: orgId.toString() } },
      { new: true }
    );
  });

  // 組織削除テスト
  it('should delete organization', async () => {
    const orgId = new mongoose.Types.ObjectId();
    
    // リクエストとレスポンスのモック
    const req = httpMocks.createRequest({
      method: 'DELETE',
      url: `/api/organizations/${orgId}`,
      params: {
        id: orgId
      },
      user: {
        id: 'user_123',
        role: 'admin'
      }
    });
    const res = httpMocks.createResponse();

    // モックの実装
    const mockMembers = [
      { userId: 'user_123' },
      { userId: 'user_456' }
    ];
    
    OrganizationModel.findById = jest.fn().mockResolvedValue({
      _id: orgId,
      name: 'Test Org',
      adminUserId: 'user_123',
      members: mockMembers
    });

    OrganizationModel.findByIdAndRemove = jest.fn().mockResolvedValue({
      _id: orgId,
      name: 'Test Org'
    });

    UserModel.updateMany = jest.fn().mockResolvedValue({ nModified: 2 });

    // コントローラメソッドを呼び出し
    await organizationController.delete(req, res);

    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData())).toHaveProperty('message', 'Organization deleted successfully');

    // 組織が削除されたことを確認
    expect(OrganizationModel.findByIdAndRemove).toHaveBeenCalledWith(orgId.toString());
    
    // メンバーのorganizationIdsから組織IDが削除されたことを確認
    expect(UserModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['user_123', 'user_456'] } },
      { $pull: { organizationIds: orgId.toString() } }
    );
  });
});