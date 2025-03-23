const anthropicAdminService = require('../anthropicAdminService');
const axios = require('axios');

// axiosのモック化
jest.mock('axios');

describe('Anthropic Admin Service Test', () => {
  // テスト前にモックをリセット
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // 組織メンバー取得のテスト
  it('should retrieve organization members', async () => {
    // モックレスポンスの設定
    const mockResponse = {
      data: {
        data: [
          {
            id: 'user_123',
            email: 'user1@example.com',
            name: 'User One',
            role: 'admin',
            created_at: '2025-01-01T00:00:00Z'
          },
          {
            id: 'user_456',
            email: 'user2@example.com',
            name: 'User Two',
            role: 'developer',
            created_at: '2025-01-02T00:00:00Z'
          }
        ],
        has_more: false
      }
    };

    // axiosのモックレスポンスを設定
    axios.request.mockResolvedValue(mockResponse);

    // サービスメソッドを呼び出し
    const result = await anthropicAdminService.getOrganizationMembers({
      adminApiKey: 'sk-ant-admin123',
      limit: 10
    });

    // axiosが正しいパラメータで呼び出されたことを確認
    expect(axios.request).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://api.anthropic.com/v1/organizations/users',
      params: { limit: 10 },
      headers: {
        'anthropic-version': expect.any(String),
        'x-api-key': 'sk-ant-admin123'
      }
    });

    // 結果の検証
    expect(result).toEqual(mockResponse.data);
  });

  // 組織メンバーの役割更新テスト
  it('should update member role', async () => {
    // モックレスポンスの設定
    const mockResponse = {
      data: {
        id: 'user_123',
        email: 'user1@example.com',
        name: 'User One',
        role: 'developer', // 更新後の役割
        created_at: '2025-01-01T00:00:00Z'
      }
    };

    // axiosのモックレスポンスを設定
    axios.request.mockResolvedValue(mockResponse);

    // サービスメソッドを呼び出し
    const result = await anthropicAdminService.updateMemberRole({
      adminApiKey: 'sk-ant-admin123',
      userId: 'user_123',
      role: 'developer'
    });

    // axiosが正しいパラメータで呼び出されたことを確認
    expect(axios.request).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/organizations/users/user_123',
      data: { role: 'developer' },
      headers: {
        'anthropic-version': expect.any(String),
        'x-api-key': 'sk-ant-admin123'
      }
    });

    // 結果の検証
    expect(result).toEqual(mockResponse.data);
  });

  // メンバー削除テスト
  it('should remove member from organization', async () => {
    // モックレスポンスの設定
    const mockResponse = {
      status: 204,
      data: {}
    };

    // axiosのモックレスポンスを設定
    axios.request.mockResolvedValue(mockResponse);

    // サービスメソッドを呼び出し
    await anthropicAdminService.removeMember({
      adminApiKey: 'sk-ant-admin123',
      userId: 'user_123'
    });

    // axiosが正しいパラメータで呼び出されたことを確認
    expect(axios.request).toHaveBeenCalledWith({
      method: 'DELETE',
      url: 'https://api.anthropic.com/v1/organizations/users/user_123',
      headers: {
        'anthropic-version': expect.any(String),
        'x-api-key': 'sk-ant-admin123'
      }
    });
  });

  // 招待作成テスト
  it('should create organization invite', async () => {
    // モックレスポンスの設定
    const mockResponse = {
      data: {
        id: 'invite_123',
        email: 'newuser@example.com',
        role: 'developer',
        created_at: '2025-01-10T00:00:00Z',
        expires_at: '2025-01-31T00:00:00Z'
      }
    };

    // axiosのモックレスポンスを設定
    axios.request.mockResolvedValue(mockResponse);

    // サービスメソッドを呼び出し
    const result = await anthropicAdminService.createInvite({
      adminApiKey: 'sk-ant-admin123',
      email: 'newuser@example.com',
      role: 'developer'
    });

    // axiosが正しいパラメータで呼び出されたことを確認
    expect(axios.request).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/organizations/invites',
      data: {
        email: 'newuser@example.com',
        role: 'developer'
      },
      headers: {
        'anthropic-version': expect.any(String),
        'x-api-key': 'sk-ant-admin123'
      }
    });

    // 結果の検証
    expect(result).toEqual(mockResponse.data);
  });

  // ワークスペース作成テスト
  it('should create workspace', async () => {
    // モックレスポンスの設定
    const mockResponse = {
      data: {
        id: 'wrkspc_123',
        name: 'New Workspace',
        created_at: '2025-01-15T00:00:00Z'
      }
    };

    // axiosのモックレスポンスを設定
    axios.request.mockResolvedValue(mockResponse);

    // サービスメソッドを呼び出し
    const result = await anthropicAdminService.createWorkspace({
      adminApiKey: 'sk-ant-admin123',
      name: 'New Workspace'
    });

    // axiosが正しいパラメータで呼び出されたことを確認
    expect(axios.request).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/organizations/workspaces',
      data: { name: 'New Workspace' },
      headers: {
        'anthropic-version': expect.any(String),
        'x-api-key': 'sk-ant-admin123'
      }
    });

    // 結果の検証
    expect(result).toEqual(mockResponse.data);
  });

  // ワークスペース一覧取得テスト
  it('should list workspaces', async () => {
    // モックレスポンスの設定
    const mockResponse = {
      data: {
        data: [
          {
            id: 'wrkspc_123',
            name: 'Workspace 1',
            created_at: '2025-01-01T00:00:00Z'
          },
          {
            id: 'wrkspc_456',
            name: 'Workspace 2',
            created_at: '2025-01-02T00:00:00Z'
          }
        ],
        has_more: false
      }
    };

    // axiosのモックレスポンスを設定
    axios.request.mockResolvedValue(mockResponse);

    // サービスメソッドを呼び出し
    const result = await anthropicAdminService.listWorkspaces({
      adminApiKey: 'sk-ant-admin123',
      limit: 10,
      include_archived: false
    });

    // axiosが正しいパラメータで呼び出されたことを確認
    expect(axios.request).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://api.anthropic.com/v1/organizations/workspaces',
      params: { limit: 10, include_archived: false },
      headers: {
        'anthropic-version': expect.any(String),
        'x-api-key': 'sk-ant-admin123'
      }
    });

    // 結果の検証
    expect(result).toEqual(mockResponse.data);
  });

  // APIキー一覧取得テスト
  it('should list API keys', async () => {
    // モックレスポンスの設定
    const mockResponse = {
      data: {
        data: [
          {
            id: 'key_123',
            name: 'API Key 1',
            workspace_id: 'wrkspc_123',
            status: 'active',
            last_four: '1234',
            created_at: '2025-01-01T00:00:00Z'
          },
          {
            id: 'key_456',
            name: 'API Key 2',
            workspace_id: 'wrkspc_123',
            status: 'inactive',
            last_four: '5678',
            created_at: '2025-01-02T00:00:00Z'
          }
        ],
        has_more: false
      }
    };

    // axiosのモックレスポンスを設定
    axios.request.mockResolvedValue(mockResponse);

    // サービスメソッドを呼び出し
    const result = await anthropicAdminService.listApiKeys({
      adminApiKey: 'sk-ant-admin123',
      limit: 10,
      status: 'active',
      workspace_id: 'wrkspc_123'
    });

    // axiosが正しいパラメータで呼び出されたことを確認
    expect(axios.request).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://api.anthropic.com/v1/organizations/api_keys',
      params: { limit: 10, status: 'active', workspace_id: 'wrkspc_123' },
      headers: {
        'anthropic-version': expect.any(String),
        'x-api-key': 'sk-ant-admin123'
      }
    });

    // 結果の検証
    expect(result).toEqual(mockResponse.data);
  });

  // エラーハンドリングのテスト
  it('should handle API errors', async () => {
    // エラーレスポンスの設定
    const mockError = {
      response: {
        status: 401,
        data: {
          error: {
            type: 'invalid_request_error',
            message: 'Invalid API key'
          }
        }
      }
    };

    // axiosのモックエラーを設定
    axios.request.mockRejectedValue(mockError);

    // サービスメソッドを呼び出し、エラーをキャッチ
    await expect(
      anthropicAdminService.getOrganizationMembers({
        adminApiKey: 'invalid-key',
        limit: 10
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid API key'
    });
  });

  // ネットワークエラーのテスト
  it('should handle network errors', async () => {
    // ネットワークエラーの設定
    const mockError = new Error('Network Error');

    // axiosのモックエラーを設定
    axios.request.mockRejectedValue(mockError);

    // サービスメソッドを呼び出し、エラーをキャッチ
    await expect(
      anthropicAdminService.getOrganizationMembers({
        adminApiKey: 'sk-ant-admin123',
        limit: 10
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Network Error'
    });
  });
});